/* ============================================================
   2048 — Corner Arcade
   Animated slide/merge: each move computes not just the new board
   but a list of per-tile transitions (from-cell -> to-cell, and
   whether it merged), which a short requestAnimationFrame loop
   interpolates before the board settles into its final state.
   One-move undo is also supported via a single saved snapshot.
   ============================================================ */

(function () {
  const W = 400, H = 400, size = 4, pad = 12;
  let board, score, cellSize, tileGap, cfg, won, ctxRef, onScore, onEnd;
  let animTiles, animStart, animDurationMs, animating, pendingSpawn;
  let undoSnapshot; // { board, score } from immediately before the last move — one level only
  const ANIM_MS = 140;

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
    animTiles = []; animating = false; pendingSpawn = null;
    pauseStartedAt = null;
    undoSnapshot = null;
    addTile(); addTile();
  }

  function addTile() {
    const empty = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (board[r][c] === 0) empty.push([r, c]);
    if (empty.length === 0) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    board[r][c] = Math.random() < cfg.fourChance ? 4 : 2;
    return [r, c];
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

  function cellPos(r, c) {
    return { x: pad + c * (cellSize + tileGap), y: pad + r * (cellSize + tileGap) };
  }

  function drawTileAt(ctx, x, y, value, scale) {
    scale = scale === undefined ? 1 : scale;
    const s = cellSize * scale;
    const ox = x + (cellSize - s) / 2, oy = y + (cellSize - s) / 2;
    ctx.fillStyle = tileColors[value] || '#ff3d7f';
    roundRect(ctx, ox, oy, s, s, 8 * scale); ctx.fill();
    if (scale > 0.3) {
      ctx.fillStyle = value <= 4 ? '#cfc8de' : '#fff';
      ctx.font = `bold ${(value > 512 ? 20 : 24) * scale}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(value, x + cellSize / 2, y + cellSize / 2 + 2);
    }
  }

  function draw(ctx) {
    ctx.fillStyle = '#1c1428'; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const { x, y } = cellPos(r, c);
        ctx.fillStyle = '#251c33';
        roundRect(ctx, x, y, cellSize, cellSize, 8); ctx.fill();
      }
    }

    if (!animating) {
      // static render straight from board state
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c]) {
            const { x, y } = cellPos(r, c);
            drawTileAt(ctx, x, y, board[r][c], 1);
          }
        }
      }
      return;
    }

    // animated render: each tile eases from its origin cell to its
    // destination cell; merged-away tiles fade out, the merge result
    // pops in with a brief overshoot once the slide completes
    const t = Math.min(1, (performance.now() - animStart) / animDurationMs);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — snappy start, gentle settle

    animTiles.forEach(tile => {
      const from = cellPos(tile.fromR, tile.fromC);
      const to = cellPos(tile.toR, tile.toC);
      const x = from.x + (to.x - from.x) * eased;
      const y = from.y + (to.y - from.y) * eased;
      if (tile.mergedAway) {
        // the tile being consumed by a merge just slides and fades near the end
        const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        ctx.globalAlpha = Math.max(0, alpha);
        drawTileAt(ctx, x, y, tile.value, 1);
        ctx.globalAlpha = 1;
      } else {
        drawTileAt(ctx, x, y, tile.value, 1);
      }
    });

    // the merge-result tile (if any) pops in with a small overshoot once
    // the slide portion of the animation is mostly done
    if (pendingSpawn && t > 0.75) {
      const popT = (t - 0.75) / 0.25;
      const scale = popT < 0.6 ? popT / 0.6 * 1.15 : 1.15 - (popT - 0.6) / 0.4 * 0.15;
      const { x, y } = cellPos(pendingSpawn.r, pendingSpawn.c);
      drawTileAt(ctx, x, y, pendingSpawn.value, Math.min(1.15, Math.max(0, scale)));
    }
  }

  function slideRowTracked(row) {
    const nonZero = [];
    for (let i = 0; i < row.length; i++) if (row[i] !== 0) nonZero.push({ value: row[i], from: i });
    const moves = [];
    const result = new Array(size).fill(0);
    let writeIdx = 0, gained = 0;
    for (let i = 0; i < nonZero.length; i++) {
      if (i < nonZero.length - 1 && nonZero[i].value === nonZero[i + 1].value) {
        const mergedValue = nonZero[i].value * 2;
        result[writeIdx] = mergedValue;
        gained += mergedValue;
        moves.push({ from: nonZero[i].from, to: writeIdx, value: nonZero[i].value, mergedAway: true });
        moves.push({ from: nonZero[i + 1].from, to: writeIdx, value: nonZero[i + 1].value, mergeResult: mergedValue });
        writeIdx++; i++;
      } else {
        result[writeIdx] = nonZero[i].value;
        moves.push({ from: nonZero[i].from, to: writeIdx, value: nonZero[i].value, mergedAway: false });
        writeIdx++;
      }
    }
    return { result, moves, gained };
  }

  // Converts a direction into a function mapping (row-relative-index) pairs
  // back to real (row, col) board coordinates, so the same slideRowTracked
  // logic can serve all four directions without four copies of it.
  function moveInDirection(dir) {
    const newBoard = Array.from({ length: size }, () => new Array(size).fill(0));
    const tiles = []; // { fromR, fromC, toR, toC, value, mergedAway, mergeResult }
    let gained = 0;

    for (let lane = 0; lane < size; lane++) {
      let laneValues, toCoord, fromCoord;
      if (dir === 'left') {
        laneValues = board[lane].slice();
        fromCoord = (i) => ({ r: lane, c: i });
        toCoord = (i) => ({ r: lane, c: i });
      } else if (dir === 'right') {
        laneValues = board[lane].slice().reverse();
        fromCoord = (i) => ({ r: lane, c: size - 1 - i });
        toCoord = (i) => ({ r: lane, c: size - 1 - i });
      } else if (dir === 'up') {
        laneValues = board.map(row => row[lane]);
        fromCoord = (i) => ({ r: i, c: lane });
        toCoord = (i) => ({ r: i, c: lane });
      } else { // down
        laneValues = board.map(row => row[lane]).reverse();
        fromCoord = (i) => ({ r: size - 1 - i, c: lane });
        toCoord = (i) => ({ r: size - 1 - i, c: lane });
      }

      const { result, moves, gained: laneGained } = slideRowTracked(laneValues);
      gained += laneGained;

      moves.forEach(m => {
        const from = fromCoord(m.from), to = toCoord(m.to);
        tiles.push({
          fromR: from.r, fromC: from.c, toR: to.r, toC: to.c,
          value: m.value, mergedAway: !!m.mergedAway, mergeResult: m.mergeResult
        });
      });

      for (let i = 0; i < size; i++) {
        const { r, c } = toCoord(i);
        newBoard[r][c] = result[i];
      }
    }

    return { newBoard, tiles, gained };
  }

  function move(dir) {
    if (animating) return; // ignore input mid-animation so moves can't stack/corrupt state
    const { newBoard, tiles, gained } = moveInDirection(dir);

    const moved = JSON.stringify(newBoard) !== JSON.stringify(board);
    if (!moved) return;

    // one-level undo: snapshot the board exactly as it was before this move
    undoSnapshot = { board: board.map(r => r.slice()), score };

    window.Arcade.Sound.play(gained > 0 ? 'tileMerge' : 'swap');
    score += gained;
    board = newBoard;

    // find where the merge results land, so the pop-in animation knows
    // which cell to spawn the combined tile into
    const mergeResultTile = tiles.find(t => t.mergeResult);
    pendingSpawn = mergeResultTile
      ? { r: mergeResultTile.toR, c: mergeResultTile.toC, value: mergeResultTile.mergeResult }
      : null;

    animTiles = tiles;
    animating = true;
    animStart = performance.now();
    animDurationMs = ANIM_MS;
    requestAnimationFrame(animLoop);
  }

  let pauseStartedAt = null;

  function animLoop() {
    if (!animating) return;
    const shellState = window.Arcade.Shell.getState();
    if (shellState !== window.Arcade.Shell.STATE.PLAYING) {
      if (pauseStartedAt === null) pauseStartedAt = performance.now();
      requestAnimationFrame(animLoop);
      return;
    }
    if (pauseStartedAt !== null) {
      // shift animStart forward by exactly how long the pause lasted, so
      // the animation resumes from where it visually was, instead of the
      // paused wall-clock time counting against its duration
      animStart += performance.now() - pauseStartedAt;
      pauseStartedAt = null;
    }
    const t = (performance.now() - animStart) / animDurationMs;
    draw(ctxRef);
    if (t >= 1) {
      finishMove();
    } else {
      requestAnimationFrame(animLoop);
    }
  }

  function finishMove() {
    animating = false;
    addTile();
    draw(ctxRef);
    onScore('Score ' + score);

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

  function undo() {
    if (!undoSnapshot || animating) return;
    board = undoSnapshot.board;
    score = undoSnapshot.score;
    undoSnapshot = null; // one level only — can't undo an undo
    onScore('Score ' + score);
    window.Arcade.Sound.play('click');
    draw(ctxRef);
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
      else if (e.key === 'u' || e.key === 'U' || e.key === 'z' || e.key === 'Z') { e.preventDefault(); undo(); }
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

  // 2048's board moves are event-driven (keypress/swipe trigger a move),
  // but each move now runs its own short requestAnimationFrame chain for
  // the slide/merge animation — tick() itself stays a no-op since the
  // shell's rAF loop isn't what drives any of this.
  function tick() { return true; }

  window.Arcade.registerGame('2048', {
    title: '2048',
    tagline: 'Slide tiles, combine numbers, reach 2048.',
    icon: '🔢',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Arrow keys, WASD, or swipe to slide all tiles. Press U or Z (or the on-screen button) to undo your last move — one level only.',
    touchControls: [
      { slot: 'undo', icon: '↶', label: 'Undo last move', group: 'action', onDown: () => undo() }
    ],
    init, renderIdleFrame, start, tick
  });
})();
