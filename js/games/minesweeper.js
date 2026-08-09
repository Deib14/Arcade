/* ============================================================
   Minesweeper — Corner Arcade (new game)
   Left click / tap = reveal. Right click / long-press = flag.
   ============================================================ */

(function () {
  const W = 420, H = 520; // fixed canvas size across all difficulties — cellSize scales to fit
  let cols, rows, mineCount, cellSize, gap, boardTop, boardLeft;
  let cells, revealedCount, flagCount, gameOver, firstClickDone, placedFlag;
  let ctxRef, onScore, onEnd, longPressTimer, cfg;

  function resetState(config) {
    cfg = config;
    cols = config.cols; rows = config.rows; mineCount = config.mines;
    gap = 1;
    boardTop = 40;
    const availW = W - gap * (cols + 1);
    const availH = H - boardTop - gap * (rows + 1);
    cellSize = Math.min(availW / cols, availH / rows, 34);
    boardLeft = Math.max(gap, (W - (cols * (cellSize + gap) - gap)) / 2);
    boardTop = 40 + Math.max(0, (H - 40 - (rows * (cellSize + gap) - gap)) / 2 - 10);

    cells = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({ mine: false, revealed: false, flagged: false, adjacent: 0 });
      }
      cells.push(row);
    }
    revealedCount = 0;
    flagCount = 0;
    gameOver = false;
    firstClickDone = false;
    placedFlag = false;
  }

  // Mines are placed only after the first click, and never on/adjacent to
  // it, so the opening move is never an instant loss.
  function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < mineCount) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      const tooClose = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;
      if (tooClose || cells[r][c].mine) continue;
      cells[r][c].mine = true;
      placed++;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (cells[r][c].mine) continue;
        cells[r][c].adjacent = countAdjacentMines(r, c);
      }
    }
  }

  function countAdjacentMines(r, c) {
    let count = 0;
    forEachNeighbor(r, c, (nr, nc) => { if (cells[nr][nc].mine) count++; });
    return count;
  }

  function forEachNeighbor(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) fn(nr, nc);
      }
    }
  }

  function revealCell(r, c) {
    const cell = cells[r][c];
    if (cell.revealed || cell.flagged) return;
    cell.revealed = true;
    revealedCount++;
    if (cell.adjacent === 0 && !cell.mine) {
      forEachNeighbor(r, c, (nr, nc) => revealCell(nr, nc));
    }
  }

  function revealAllMines() {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (cells[r][c].mine) cells[r][c].revealed = true;
    }
  }

  const NUM_COLORS = ['', '#5fb0ff', '#8bd450', '#ff6b6b', '#c48bff', '#ffb000', '#35e0d0', '#ff3d7f', '#c9c0da'];

  function draw(ctx) {
    ctx.fillStyle = '#0a1420'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffb000'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
    const remaining = mineCount - flagCount;
    ctx.fillText(`Mines ${Math.max(0, remaining)}`, gap, 24);
    ctx.textAlign = 'right';
    ctx.fillText(`${cols}×${rows}`, W - gap, 24);
    ctx.textAlign = 'left';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r][c];
        const x = boardLeft + c * (cellSize + gap);
        const y = boardTop + r * (cellSize + gap);

        if (cell.revealed) {
          ctx.fillStyle = cell.mine ? '#ff3d7f' : '#1c2433';
          ctx.fillRect(x, y, cellSize, cellSize);
          if (cell.mine) {
            ctx.font = `${cellSize * 0.6}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('💣', x + cellSize / 2, y + cellSize / 2 + 1);
          } else if (cell.adjacent > 0) {
            ctx.fillStyle = NUM_COLORS[cell.adjacent];
            ctx.font = `bold ${cellSize * 0.55}px monospace`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(cell.adjacent, x + cellSize / 2, y + cellSize / 2 + 1);
          }
        } else {
          ctx.fillStyle = '#2a3548';
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.strokeStyle = '#3a4760'; ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
          if (cell.flagged) {
            ctx.font = `${cellSize * 0.55}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🚩', x + cellSize / 2, y + cellSize / 2 + 1);
          }
        }
      }
    }
  }

  function init({ difficulty }) {
    resetState(window.Arcade.getDifficultyConfig('minesweeper', difficulty));
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  function cellAt(x, y) {
    const c = Math.floor((x - boardLeft) / (cellSize + gap));
    const r = Math.floor((y - boardTop) / (cellSize + gap));
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    return { r, c };
  }

  function checkWin() {
    const totalSafe = rows * cols - mineCount;
    return revealedCount >= totalSafe;
  }

  function handleReveal(r, c) {
    if (gameOver) return;
    const cell = cells[r][c];

    // Chording: tapping an already-revealed numbered cell that already has
    // the correct count of adjacent flags auto-reveals its remaining
    // unflagged neighbors. This is standard Minesweeper play — without it,
    // clearing a board means individually tapping every safe cell one at a
    // time, which every real implementation avoids.
    if (cell.revealed) {
      attemptChord(r, c);
      return;
    }
    if (cell.flagged) return;

    if (!firstClickDone) {
      placeMines(r, c);
      firstClickDone = true;
    }

    revealCell(r, c);
    draw(ctxRef);

    if (cell.mine) {
      triggerMineExplosion();
      return;
    }

    window.Arcade.Sound.play('reveal');
    onScore(`Revealed ${revealedCount}`);
    checkForWin();
  }

  function attemptChord(r, c) {
    const cell = cells[r][c];
    if (cell.mine || cell.adjacent === 0) return; // nothing to chord on an empty-number or already-exploded cell

    let flaggedNeighbors = 0;
    const neighbors = [];
    forEachNeighbor(r, c, (nr, nc) => {
      const n = cells[nr][nc];
      if (n.flagged) flaggedNeighbors++;
      else if (!n.revealed) neighbors.push([nr, nc]);
    });

    if (flaggedNeighbors !== cell.adjacent) {
      // Not enough (or too many) flags placed yet — a wrong chord attempt
      // is a common accidental action, so just give a soft no-op cue
      // rather than punishing it like a real mistake.
      window.Arcade.Sound.play('click');
      return;
    }

    window.Arcade.Sound.play('reveal');
    let hitMine = false;
    neighbors.forEach(([nr, nc]) => {
      if (cells[nr][nc].mine) hitMine = true;
      else revealCell(nr, nc);
    });
    draw(ctxRef);

    if (hitMine) {
      triggerMineExplosion();
      return;
    }

    onScore(`Revealed ${revealedCount}`);
    checkForWin();
  }

  function triggerMineExplosion() {
    gameOver = true;
    window.Arcade.Sound.play('mineBoom');
    window.Arcade.Shell.shake();
    window.Arcade.Shell.flash();
    window.Arcade.Shell.vibrate([60, 40, 60, 40, 100]);
    revealAllMines();
    draw(ctxRef);
    onEnd({ score: flagCount, won: false, title: 'Boom.' });
  }

  function checkForWin() {
    if (checkWin()) {
      gameOver = true;
      window.Arcade.unlockAchievement('mine_clear');
      if (window.Arcade.Shell.getDifficulty() === 'hard') {
        window.Arcade.unlockAchievement('mine_hard');
        window.Arcade.recordDifficultyClear('minesweeper', 'hard');
      }
      if (!placedFlag) window.Arcade.unlockAchievement('mine_flagless');
      draw(ctxRef);
      onEnd({ score: revealedCount, won: true, title: 'Cleared!' });
    }
  }

  function handleFlag(r, c) {
    if (gameOver) return;
    const cell = cells[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    flagCount += cell.flagged ? 1 : -1;
    if (cell.flagged) placedFlag = true;
    window.Arcade.Sound.play('flag');
    draw(ctxRef);
  }

  function start({ ctx, canvas, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetState(config);
    onScore = os; onEnd = oe;
    draw(ctx);

    function toBoardCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width, scaleY = H / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }

    addListener(canvas, 'contextmenu', (e) => e.preventDefault());

    addListener(canvas, 'pointerdown', (e) => {
      if (e.button === 2) return; // handled by contextmenu-free right click below
      const { x, y } = toBoardCoords(e);
      const hit = cellAt(x, y);
      if (!hit) return;

      // Long-press (touch) flags instead of reveals.
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        handleFlag(hit.r, hit.c);
      }, 450);
    });

    addListener(canvas, 'pointerup', (e) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        const { x, y } = toBoardCoords(e);
        const hit = cellAt(x, y);
        if (hit) handleReveal(hit.r, hit.c);
      }
    });

    addListener(canvas, 'pointercancel', () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });

    // Desktop right-click flags immediately, no long-press needed.
    addListener(canvas, 'mousedown', (e) => {
      if (e.button !== 2) return;
      e.preventDefault();
      const { x, y } = toBoardCoords(e);
      const hit = cellAt(x, y);
      if (hit) {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        handleFlag(hit.r, hit.c);
      }
    });
  }

  function teardown() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }

  function tick() { return true; }

  window.Arcade.registerGame('minesweeper', {
    title: 'Minesweeper',
    tagline: 'Clear the board without hitting a mine.',
    icon: '💣',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Tap to reveal a tile. Right-click (or press and hold on touch) to flag a suspected mine. Tap a revealed number once it has the right number of flags around it to auto-clear its other neighbors. The first tile you reveal is always safe.',
    init, renderIdleFrame, start, tick, teardown
  });
})();
