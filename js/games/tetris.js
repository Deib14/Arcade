/* ============================================================
   Tetris — Corner Arcade
   Standard 10x20 well, 7-bag randomizer, basic wall-kick on
   rotation, hold piece, next-piece preview, soft/hard drop.
   ============================================================ */

(function () {
  const COLS = 10, ROWS = 20;
  const CELL = 24;
  const BOARD_W = COLS * CELL, BOARD_H = ROWS * CELL;
  const SIDE_W = 90;
  const W = BOARD_W + SIDE_W * 2, H = BOARD_H + 20;
  const BOARD_X = SIDE_W, BOARD_Y = 20;

  // Each shape defined in a single rotation; rotation is computed at
  // runtime by matrix transform rather than hand-authored per state.
  const SHAPES = {
    I: { cells: [[0,1],[1,1],[2,1],[3,1]], color: '#35e0d0' },
    O: { cells: [[1,0],[2,0],[1,1],[2,1]], color: '#ffd93d' },
    T: { cells: [[1,0],[0,1],[1,1],[2,1]], color: '#c48bff' },
    S: { cells: [[1,0],[2,0],[0,1],[1,1]], color: '#8bd450' },
    Z: { cells: [[0,0],[1,0],[1,1],[2,1]], color: '#ff3d7f' },
    J: { cells: [[0,0],[0,1],[1,1],[2,1]], color: '#5fb0ff' },
    L: { cells: [[2,0],[0,1],[1,1],[2,1]], color: '#ff8a3d' }
  };
  const PIECE_KEYS = Object.keys(SHAPES);
  const GRID_SIZE = 4; // bounding box each piece rotates within

  let board;            // ROWS x COLS, each cell null or color string
  let bag, bagIndex;
  let current, currentRotation, currentX, currentY;
  let holdPiece, holdUsedThisTurn;
  let nextQueue;
  let score, linesCleared, level, gameOver;
  let dropAccumMs, softDropping, cfg;
  let ctxRef, onScore, onEnd;
  let keyLeftDown, keyRightDown, dasTimer, dasIntervalTimer;
  let lockDelayMs, lockResetsUsed, comboCount;
  const LOCK_DELAY_MS = 500;
  const MAX_LOCK_RESETS = 15; // caps "infinite spin" stalling — guideline games use a move-count cap too

  function newBag() {
    const b = PIECE_KEYS.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }

  function drawFromQueue() {
    if (bagIndex >= bag.length) { bag = newBag(); bagIndex = 0; }
    return bag[bagIndex++];
  }

  function refillNextQueue() {
    while (nextQueue.length < 3) nextQueue.push(drawFromQueue());
  }

  function rotateCells(cells, rotation) {
    // rotate around the center of a 4x4 box, 90deg per step
    let pts = cells.map(([x, y]) => [x, y]);
    for (let r = 0; r < rotation; r++) {
      pts = pts.map(([x, y]) => [GRID_SIZE - 1 - y, x]);
    }
    return pts;
  }

  function spawnPiece(key) {
    current = key;
    currentRotation = 0;
    currentX = 3;
    currentY = key === 'I' ? -1 : 0;
    holdUsedThisTurn = false;
    lockDelayMs = 0;
    lockResetsUsed = 0;
    if (collides(current, currentRotation, currentX, currentY)) {
      endGame();
    }
  }

  function collides(key, rotation, ox, oy) {
    const cells = rotateCells(SHAPES[key].cells, rotation);
    for (const [cx, cy] of cells) {
      const x = ox + cx, y = oy + cy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
    return false;
  }

  function tryMove(dx, dy) {
    if (!collides(current, currentRotation, currentX + dx, currentY + dy)) {
      currentX += dx; currentY += dy;
      resetLockDelayIfGrounded();
      return true;
    }
    return false;
  }

  function resetLockDelayIfGrounded() {
    if (lockResetsUsed >= MAX_LOCK_RESETS) return; // cap reached — let it lock on schedule now
    if (collides(current, currentRotation, currentX, currentY + 1)) {
      lockDelayMs = 0;
      lockResetsUsed++;
    }
  }

  function tryRotate() {
    if (current === 'O') return true; // square is rotationally symmetric — no-op, avoids visual drift
    const nextRot = (currentRotation + 1) % 4;
    // simple wall-kick: try in place, then nudge left/right/up by 1-2 cells
    const kicks = [[0,0], [-1,0], [1,0], [-2,0], [2,0], [0,-1]];
    for (const [kx, ky] of kicks) {
      if (!collides(current, nextRot, currentX + kx, currentY + ky)) {
        currentRotation = nextRot;
        currentX += kx; currentY += ky;
        window.Arcade.Sound.play('rotate');
        resetLockDelayIfGrounded();
        return true;
      }
    }
    return false;
  }

  function lockPiece() {
    const cells = rotateCells(SHAPES[current].cells, currentRotation);
    for (const [cx, cy] of cells) {
      const x = currentX + cx, y = currentY + cy;
      if (y >= 0) board[y][x] = SHAPES[current].color;
    }
    const clearedBefore = linesCleared;
    clearLines();
    if (linesCleared === clearedBefore) window.Arcade.Sound.play('bounce'); // plain lock, no lines cleared
    if (!gameOver) spawnNext();
  }

  function clearLines() {
    const survivors = board.filter(row => !row.every(cell => cell));
    const cleared = ROWS - survivors.length;
    if (cleared > 0) {
      const emptyRows = Array.from({ length: cleared }, () => new Array(COLS).fill(null));
      board = emptyRows.concat(survivors);

      comboCount++; // -1 -> 0 on the first clear of a streak, then 1, 2, ...
      const basePoints = [0, 100, 300, 500, 800][cleared] * level;
      const comboBonus = comboCount > 0 ? comboCount * 50 * level : 0;
      const points = basePoints + comboBonus;
      score += points;
      linesCleared += cleared;
      level = 1 + Math.floor(linesCleared / 10);
      const comboText = comboCount > 0 ? ` · Combo x${comboCount + 1}` : '';
      onScore(`Score ${score} · Lines ${linesCleared}${comboText}`);
      window.Arcade.Sound.play(cleared === 4 ? 'tetrisClear' : 'lineClear');
      if (cleared === 4) { window.Arcade.unlockAchievement('tetris_4lines'); window.Arcade.Shell.shake(); window.Arcade.Shell.vibrate([30, 20, 30, 20, 30]); }
      if (linesCleared >= 10) window.Arcade.unlockAchievement('tetris_10lines');
      if (comboCount >= 3) window.Arcade.unlockAchievement('tetris_combo');
    } else {
      comboCount = -1; // a lock with no clear breaks the streak
    }
  }

  function spawnNext() {
    refillNextQueue();
    const key = nextQueue.shift();
    refillNextQueue();
    spawnPiece(key);
  }

  function hardDrop() {
    let dist = 0;
    while (tryMove(0, 1)) dist++;
    score += dist * 2;
    window.Arcade.Sound.play('drop');
    lockPiece();
    dropAccumMs = 0;
  }

  function holdSwap() {
    if (holdUsedThisTurn) return;
    window.Arcade.Sound.play('swap');
    if (holdPiece === null) {
      holdPiece = current;
      spawnNext();               // spawnPiece() resets holdUsedThisTurn to false — must set true after, not before
      holdUsedThisTurn = true;
    } else {
      const temp = holdPiece;
      holdPiece = current;
      current = temp;
      currentRotation = 0;
      currentX = 3;
      currentY = current === 'I' ? -1 : 0;
      holdUsedThisTurn = true;
      if (collides(current, currentRotation, currentX, currentY)) endGame();
    }
  }

  function endGame() {
    gameOver = true;
    window.Arcade.Sound.play('hit');
    window.Arcade.Shell.shake();
    window.Arcade.Shell.vibrate([40, 30, 60]);
    onEnd({ score, won: false, title: 'Topped out', meta: { lines: linesCleared } });
  }

  function onGameEnd(result, { difficulty }) {
    if (difficulty === 'hard' && linesCleared >= 10) {
      window.Arcade.unlockAchievement('tetris_hard');
      window.Arcade.recordDifficultyClear('tetris', 'hard');
    }
  }

  function resetState(config) {
    cfg = config;
    board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    bag = newBag(); bagIndex = 0;
    nextQueue = [];
    refillNextQueue();
    holdPiece = null; holdUsedThisTurn = false;
    score = 0; linesCleared = 0; level = 1; gameOver = false;
    dropAccumMs = 0; softDropping = false;
    lockDelayMs = 0; lockResetsUsed = 0; comboCount = -1;
    keyLeftDown = false; keyRightDown = false;
    spawnNext();
  }

  function currentDropMs() {
    const speedup = Math.min(cfg.startDropMs - cfg.minDropMs, level * cfg.speedupPerLine * 4);
    return Math.max(cfg.minDropMs, cfg.startDropMs - speedup);
  }

  /* ---------- Rendering ---------- */

  function drawCell(ctx, px, py, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(px + 1, py + 1, size - 2, 3);
  }

  function drawMiniPiece(ctx, key, cx, cy, size) {
    if (!key) return;
    const shape = SHAPES[key];
    const cells = shape.cells;
    const minX = Math.min(...cells.map(c => c[0]));
    const maxX = Math.max(...cells.map(c => c[0]));
    const minY = Math.min(...cells.map(c => c[1]));
    const maxY = Math.max(...cells.map(c => c[1]));
    const w = (maxX - minX + 1) * size, h = (maxY - minY + 1) * size;
    const ox = cx - w / 2, oy = cy - h / 2;
    cells.forEach(([x, y]) => {
      drawCell(ctx, ox + (x - minX) * size, oy + (y - minY) * size, size, shape.color);
    });
  }

  function draw(ctx) {
    ctx.fillStyle = '#0d0a16';
    ctx.fillRect(0, 0, W, H);

    // side panels
    ctx.fillStyle = '#150f22';
    ctx.fillRect(0, 0, SIDE_W, H);
    ctx.fillRect(BOARD_X + BOARD_W, 0, SIDE_W, H);

    ctx.fillStyle = '#9d7cff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('HOLD', SIDE_W / 2, 24);
    drawMiniPiece(ctx, holdPiece, SIDE_W / 2, 60, 14);

    ctx.fillText('NEXT', BOARD_X + BOARD_W + SIDE_W / 2, 24);
    nextQueue.slice(0, 3).forEach((key, i) => {
      drawMiniPiece(ctx, key, BOARD_X + BOARD_W + SIDE_W / 2, 60 + i * 56, 12);
    });

    ctx.fillStyle = '#c9c0da'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('SCORE', SIDE_W / 2, H - 70);
    ctx.fillStyle = '#ffb000'; ctx.font = 'bold 13px monospace';
    ctx.fillText(String(score), SIDE_W / 2, H - 52);
    ctx.fillStyle = '#c9c0da'; ctx.font = 'bold 11px monospace';
    ctx.fillText('LEVEL', SIDE_W / 2, H - 30);
    ctx.fillStyle = '#35e0d0'; ctx.font = 'bold 13px monospace';
    ctx.fillText(String(level), SIDE_W / 2, H - 12);

    // board background + border
    ctx.fillStyle = '#080614';
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.strokeStyle = '#2a2140';
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(BOARD_X + c * CELL, BOARD_Y); ctx.lineTo(BOARD_X + c * CELL, BOARD_Y + BOARD_H); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(BOARD_X, BOARD_Y + r * CELL); ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + r * CELL); ctx.stroke();
    }

    // locked cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) drawCell(ctx, BOARD_X + c * CELL, BOARD_Y + r * CELL, CELL, board[r][c]);
      }
    }

    // ghost piece (landing preview)
    if (!gameOver) {
      let ghostY = currentY;
      while (!collides(current, currentRotation, currentX, ghostY + 1)) ghostY++;
      const ghostCells = rotateCells(SHAPES[current].cells, currentRotation);
      ctx.globalAlpha = 0.25;
      ghostCells.forEach(([cx, cy]) => {
        const y = ghostY + cy;
        if (y >= 0) drawCell(ctx, BOARD_X + (currentX + cx) * CELL, BOARD_Y + y * CELL, CELL, SHAPES[current].color);
      });
      ctx.globalAlpha = 1;

      // active piece — flickers subtly while lock delay is counting down,
      // so a piece that "isn't locking yet" reads as a deliberate grace
      // window rather than looking broken. Respects reduced-motion since
      // this is drawn directly on canvas, outside the CSS-based toggle.
      const reduceMotion = window.Arcade.Settings.get().reducedMotion;
      const isLocking = lockDelayMs > 0 && !reduceMotion;
      const flicker = isLocking && Math.floor(lockDelayMs / 80) % 2 === 0;
      ctx.globalAlpha = flicker ? 0.6 : 1;
      const cells = rotateCells(SHAPES[current].cells, currentRotation);
      cells.forEach(([cx, cy]) => {
        const y = currentY + cy;
        if (y >= 0) drawCell(ctx, BOARD_X + (currentX + cx) * CELL, BOARD_Y + y * CELL, CELL, SHAPES[current].color);
      });
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- Shell interface ---------- */

  function init({ difficulty }) {
    resetState(window.Arcade.getDifficultyConfig('tetris', difficulty));
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  function moveLeft() { if (!gameOver) tryMove(-1, 0); }
  function moveRight() { if (!gameOver) tryMove(1, 0); }
  function rotate() { if (!gameOver) tryRotate(); }
  function setSoftDrop(on) { softDropping = on; }
  function doHardDrop() { if (!gameOver) hardDrop(); }
  function doHold() { if (!gameOver) holdSwap(); }

  function start({ ctx, canvas, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetState(config);
    onScore = os; onEnd = oe;
    draw(ctx);

    const onKeyDown = (e) => {
      if (gameOver) return;
      switch (e.key) {
        case 'ArrowLeft': case 'a': moveLeft(); e.preventDefault(); break;
        case 'ArrowRight': case 'd': moveRight(); e.preventDefault(); break;
        case 'ArrowUp': case 'w': rotate(); e.preventDefault(); break;
        case 'ArrowDown': case 's': setSoftDrop(true); e.preventDefault(); break;
        case ' ': doHardDrop(); e.preventDefault(); break;
        case 'Shift': case 'c': doHold(); e.preventDefault(); break;
      }
    };
    const onKeyUp = (e) => {
      if (e.key === 'ArrowDown' || e.key === 's') setSoftDrop(false);
    };
    addListener(window, 'keydown', onKeyDown);
    addListener(window, 'keyup', onKeyUp);
  }

  function tick() {
    // The shell's loop calls tick() with no delta-time argument, so we
    // assume a fixed ~60fps frame budget for gravity timing. Good enough
    // for this game; a real delta-time based clock would be more precise
    // but isn't worth the shell-wide change for one game.
    const frameMs = 16.7;
    if (gameOver) { draw(ctxRef); return true; }

    const grounded = collides(current, currentRotation, currentX, currentY + 1);

    if (grounded) {
      // Lock delay: give the player a brief window to slide/rotate the
      // piece after it lands, rather than locking the instant it touches
      // down — this is standard guideline Tetris behavior and it's the
      // difference between "any touch is final" (harsh) and "you have a
      // moment to adjust" (fair). Capped resets prevent infinite stalling
      // by endlessly nudging the piece to keep resetting the timer.
      lockDelayMs += frameMs;
      if (lockDelayMs >= LOCK_DELAY_MS) {
        lockDelayMs = 0;
        lockPiece();
      }
    } else {
      lockDelayMs = 0;
      lockResetsUsed = 0;
      dropAccumMs += frameMs;
      const threshold = softDropping ? cfg.softDropMs : currentDropMs();
      if (dropAccumMs >= threshold) {
        dropAccumMs = 0;
        tryMove(0, 1);
      }
    }

    draw(ctxRef);
    return true;
  }

  function teardown() {
    stopDAS();
  }

  window.Arcade.registerGame('tetris', {
    title: 'Tetris',
    tagline: 'Clear lines before the stack tops out.',
    icon: '🟦',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Arrows/WASD to move and rotate, Space to hard-drop, Shift/C to hold. A landed piece flickers briefly before locking — you can still slide or rotate it in that window. Clear lines back-to-back for a combo bonus.',
    touchControls: [
      { slot: 'move-left',  icon: '◀', label: 'Move left',  group: 'move',   onDown: () => { moveLeft(); startDAS(-1); }, onUp: () => stopDAS() },
      { slot: 'move-right', icon: '▶', label: 'Move right', group: 'move',   onDown: () => { moveRight(); startDAS(1); }, onUp: () => stopDAS() },
      { slot: 'soft-drop',  icon: '▼', label: 'Soft drop',  group: 'action', onDown: () => setSoftDrop(true), onUp: () => setSoftDrop(false) },
      { slot: 'rotate',     icon: '⟳', label: 'Rotate',     group: 'action', onDown: () => rotate() },
      { slot: 'hard-drop',  icon: '⤓', label: 'Hard drop',  group: 'action', onDown: () => doHardDrop() },
    ],
    init, renderIdleFrame, start, tick, teardown, onGameEnd
  });

  // Delayed Auto Shift: holding the on-screen left/right button repeats
  // the move instead of requiring repeated taps, mirroring how held
  // arrow keys would feel if the browser's own key-repeat were relied on.
  function startDAS(dir) {
    stopDAS();
    dasTimer = setTimeout(() => {
      dasIntervalTimer = setInterval(() => { if (!gameOver) tryMove(dir, 0); }, 60);
    }, 200);
  }
  function stopDAS() {
    if (dasTimer) { clearTimeout(dasTimer); dasTimer = null; }
    if (dasIntervalTimer) { clearInterval(dasIntervalTimer); dasIntervalTimer = null; }
  }
})();
