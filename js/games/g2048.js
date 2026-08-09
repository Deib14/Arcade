/* ============================================================
   2048 — Corner Arcade
   ============================================================ */

(function () {
  const W = 400, H = 400, size = 4, pad = 12;
  let board, score, cellSize, tileGap, cfg, won, ctxRef, onScore, onEnd;

  const tileColors = {
    2: '#3d3552', 4: '#4a3f66', 8: '#ff8a3d', 16: '#ff6b3d', 32: '#ff3d7f', 64: '#e0257a',
    128: '#ffd93d', 256: '#ffcf1a', 512: '#8bd450', 1024: '#35e0d0', 2048: '#5fb0ff', 4096: '#c48bff'
  };

  function resetState(config) {
    cfg = config;
    board = Array.from({ length: size }, () => Array(size).fill(0));
    score = 0; won = false;
    tileGap = 10;
    cellSize = (W - pad * 2 - tileGap * (size - 1)) / size;
    addTile(); addTile();
  }

  function addTile() {
    const empty = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (board[r][c] === 0) empty.push([r, c]);
    if (empty.length === 0) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    board[r][c] = Math.random() < cfg.fourChance ? 4 : 2;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(ctx) {
    ctx.fillStyle = '#1c1428'; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = pad + c * (cellSize + tileGap), y = pad + r * (cellSize + tileGap);
        ctx.fillStyle = '#251c33';
        roundRect(ctx, x, y, cellSize, cellSize, 8); ctx.fill();
        const v = board[r][c];
        if (v) {
          ctx.fillStyle = tileColors[v] || '#ff3d7f';
          roundRect(ctx, x, y, cellSize, cellSize, 8); ctx.fill();
          ctx.fillStyle = v <= 4 ? '#cfc8de' : '#fff';
          ctx.font = `bold ${v > 512 ? 20 : 24}px monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(v, x + cellSize / 2, y + cellSize / 2 + 2);
        }
      }
    }
  }

  function slideRow(row) {
    let arr = row.filter(v => v !== 0);
    let gained = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) { arr[i] *= 2; gained += arr[i]; arr[i + 1] = 0; }
    }
    arr = arr.filter(v => v !== 0);
    while (arr.length < size) arr.push(0);
    return { arr, gained };
  }

  function move(dir) {
    let gained = 0;
    const rotate = (b) => b[0].map((_, c) => b.map(r => r[c]));
    let b = board.map(r => r.slice());

    if (dir === 'left') {
      b = b.map(row => { const { arr, gained: g } = slideRow(row); gained += g; return arr; });
    } else if (dir === 'right') {
      b = b.map(row => { const { arr, gained: g } = slideRow(row.slice().reverse()); gained += g; return arr.reverse(); });
    } else if (dir === 'up') {
      let rot = rotate(b);
      rot = rot.map(row => { const { arr, gained: g } = slideRow(row); gained += g; return arr; });
      b = rotate(rot);
    } else if (dir === 'down') {
      let rot = rotate(b);
      rot = rot.map(row => { const { arr, gained: g } = slideRow(row.slice().reverse()); gained += g; return arr.reverse(); });
      b = rotate(rot);
    }

    const moved = JSON.stringify(b) !== JSON.stringify(board);
    board = b;
    if (!moved) return;

    window.Arcade.Sound.play(gained > 0 ? 'tileMerge' : 'swap');
    score += gained;
    onScore('Score ' + score);
    addTile();
    draw(ctxRef);

    const maxTile = Math.max(...board.flat());
    if (maxTile >= 2048 && !won) {
      won = true;
      window.Arcade.unlockAchievement('2048_win');
    }
    if (maxTile >= 4096) window.Arcade.unlockAchievement('2048_4096');

    if (!canMove()) {
      onEnd({ score, won: maxTile >= cfg.target, title: maxTile >= cfg.target ? '2048!' : 'Game over' });
    }
  }

  function canMove() {
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (board[r][c] === 0) return true;
      if (c < size - 1 && board[r][c] === board[r][c + 1]) return true;
      if (r < size - 1 && board[r][c] === board[r + 1][c]) return true;
    }
    return false;
  }

  function init({ difficulty }) {
    resetState(window.Arcade.getDifficultyConfig('2048', difficulty));
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  function start({ ctx, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetState(config);
    onScore = os; onEnd = oe;
    draw(ctx);

    const onKey = (e) => {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    };
    addListener(window, 'keydown', onKey);

    let sx = 0, sy = 0;
    const canvas = window.Arcade.Shell.getCanvas();
    addListener(canvas, 'pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    addListener(canvas, 'pointerup', (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
      else move(dy > 0 ? 'down' : 'up');
    });
  }

  // 2048 is event-driven (moves happen on keypress/swipe), so tick is a no-op
  function tick() { return true; }

  window.Arcade.registerGame('2048', {
    title: '2048',
    tagline: 'Slide tiles, combine numbers, reach 2048.',
    icon: '🔢',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Arrow keys, WASD, or swipe to slide all tiles at once.',
    init, renderIdleFrame, start, tick
  });
})();
