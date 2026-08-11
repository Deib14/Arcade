/* ============================================================
   Snake — Corner Arcade
   Logic runs on a fixed-cadence tick (setTimeout), completely
   unchanged from before — this is what fairness and difficulty
   timing depend on. Rendering runs on its own requestAnimationFrame
   loop that interpolates each segment's drawn position toward its
   target grid cell, so movement reads as smooth without touching
   collision timing at all. This split (logic tick vs render loop)
   is the standard, low-risk way to add smooth movement to a
   grid-based snake without changing how the game actually plays.
   ============================================================ */

(function () {
  const cols = 22, rows = 22, cell = 20;
  const W = cols * cell, H = rows * cell;
  let snake, dir, nextDir, food, score, speed, cfg;
  let onScore, onEnd, ctxRef, tickTimeout, running, renderRaf;
  let prevSnake; // segment positions at the start of the current tick interval, for interpolation
  let tickStartTime, tickDurationMs;

  const FOOD_NORMAL = 'normal', FOOD_BONUS = 'bonus', FOOD_SPEED = 'speed';
  let foodType;

  function resetState(config) {
    snake = [{ x: 11, y: 11 }, { x: 10, y: 11 }, { x: 9, y: 11 }];
    prevSnake = snake.map(s => ({ ...s }));
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    speed = config.startSpeed;
    cfg = config;
    tickDurationMs = speed;
    tickStartTime = performance.now();
    placeFood();
  }

  function placeFood() {
    let ok = false, fx, fy;
    while (!ok) {
      fx = Math.floor(Math.random() * cols);
      fy = Math.floor(Math.random() * rows);
      ok = !snake.some(s => s.x === fx && s.y === fy);
    }
    food = { x: fx, y: fy };
    // Occasional special food: bonus (+5) or speed (temporary boost).
    // Weighted so normal food is still the common case. Xenzia mode
    // (the classic 1997 Nokia presentation) skips this entirely — only
    // plain food, matching the original game it's paying homage to.
    if (getXenziaMode()) {
      foodType = FOOD_NORMAL;
      return;
    }
    const roll = Math.random();
    foodType = roll < 0.12 ? FOOD_BONUS : roll < 0.20 ? FOOD_SPEED : FOOD_NORMAL;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function draw(ctx, interpT) {
    const xenzia = getXenziaMode();

    if (xenzia) {
      drawXenzia(ctx);
      return;
    }

    ctx.fillStyle = '#06181a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(53,224,208,0.06)';
    for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, H); ctx.stroke(); }
    for (let j = 0; j <= rows; j++) { ctx.beginPath(); ctx.moveTo(0, j * cell); ctx.lineTo(W, j * cell); ctx.stroke(); }

    const foodColors = { [FOOD_NORMAL]: '#ff3d7f', [FOOD_BONUS]: '#ffd93d', [FOOD_SPEED]: '#5fb0ff' };
    const pulse = 1 + Math.sin(performance.now() / 180) * 0.08; // gentle pulse so food reads as "alive"
    const fSize = (cell - 4) * pulse;
    const fOffset = (cell - fSize) / 2;
    ctx.fillStyle = foodColors[foodType] || foodColors[FOOD_NORMAL];
    ctx.fillRect(food.x * cell + fOffset, food.y * cell + fOffset, fSize, fSize);
    if (foodType !== FOOD_NORMAL) {
      ctx.font = `${cell * 0.55}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(foodType === FOOD_BONUS ? '⭐' : '⚡', food.x * cell + cell / 2, food.y * cell + cell / 2);
    }

    const t = interpT === undefined ? 1 : interpT;
    snake.forEach((s, i) => {
      // Interpolate from where this segment was at the start of the tick
      // (prevSnake[i]) to where it is now (s), across the tick's duration.
      // prevSnake can be shorter than snake right after growing, so a
      // freshly-added tail segment just holds at its current cell.
      const p = prevSnake[i] || s;
      // A jump of more than 1 cell in either axis only happens when this
      // segment just crossed a wraparound edge — interpolating that would
      // draw a long streak across the board, so snap instead of lerping.
      const jumped = Math.abs(s.x - p.x) > 1 || Math.abs(s.y - p.y) > 1;
      const dx = jumped ? s.x : lerp(p.x, s.x, t);
      const dy = jumped ? s.y : lerp(p.y, s.y, t);
      ctx.fillStyle = i === 0 ? '#35e0d0' : '#1f9e92';
      ctx.fillRect(dx * cell + 1, dy * cell + 1, cell - 2, cell - 2);
    });
  }

  // Xenzia mode: the classic 1997 Nokia presentation — monochrome LCD
  // green-on-black, blocky grid-snapped movement (no smooth interpolation,
  // no food pulse, no special food types), solid walls only. A deliberate
  // visual and mechanical throwback, not just a recolor.
  function drawXenzia(ctx) {
    ctx.fillStyle = '#0d1f0a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,200,90,0.05)';
    for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, H); ctx.stroke(); }
    for (let j = 0; j <= rows; j++) { ctx.beginPath(); ctx.moveTo(0, j * cell); ctx.lineTo(W, j * cell); ctx.stroke(); }

    ctx.fillStyle = '#8fd45a';
    ctx.fillRect(food.x * cell + 3, food.y * cell + 3, cell - 6, cell - 6);

    snake.forEach(s => {
      ctx.fillStyle = '#78c848';
      ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2);
    });
  }

  function wrapKey() { return 'arcade_v2_snake_wrap'; }
  function getWrapMode() { return localStorage.getItem(wrapKey()) === '1'; }
  function setWrapMode(on) { localStorage.setItem(wrapKey(), on ? '1' : '0'); }

  function xenziaKey() { return 'arcade_v2_snake_xenzia'; }
  function getXenziaMode() { return localStorage.getItem(xenziaKey()) === '1'; }
  function setXenziaMode(on) { localStorage.setItem(xenziaKey(), on ? '1' : '0'); }

  function init({ difficulty }) {
    resetState(window.Arcade.getDifficultyConfig('snake', difficulty));
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  function start({ ctx, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetState(config);
    onScore = os; onEnd = oe;
    running = true;

    const onKey = (e) => {
      const k = e.key;
      if (k === 'm' || k === 'M') {
        // Deliberately toggleable mid-round, not locked like difficulty is —
        // it only changes wall behavior, not scoring or difficulty, so
        // there's no exploit in switching it mid-game.
        setWrapMode(!getWrapMode());
        window.Arcade.Sound.play('click');
        e.preventDefault();
        return;
      }
      if (k === 'x' || k === 'X') {
        setXenziaMode(!getXenziaMode());
        window.Arcade.Sound.play('click');
        draw(ctxRef);
        e.preventDefault();
        return;
      }
      // Validate against nextDir (the pending direction), not dir (the
      // currently-applied one) — otherwise two rapid keypresses between
      // ticks can queue a full reversal that reads as legal because the
      // second press still sees the stale, not-yet-applied direction.
      if ((k === 'ArrowUp' || k === 'w') && nextDir.y === 0) nextDir = { x: 0, y: -1 };
      else if ((k === 'ArrowDown' || k === 's') && nextDir.y === 0) nextDir = { x: 0, y: 1 };
      else if ((k === 'ArrowLeft' || k === 'a') && nextDir.x === 0) nextDir = { x: -1, y: 0 };
      else if ((k === 'ArrowRight' || k === 'd') && nextDir.x === 0) nextDir = { x: 1, y: 0 };
      else return;
      e.preventDefault();
    };
    addListener(window, 'keydown', onKey);

    let sx = 0, sy = 0;
    const canvas = window.Arcade.Shell.getCanvas();
    addListener(canvas, 'pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    addListener(canvas, 'pointerup', (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 20 && nextDir.x === 0) nextDir = { x: 1, y: 0 };
        else if (dx < -20 && nextDir.x === 0) nextDir = { x: -1, y: 0 };
      } else {
        if (dy > 20 && nextDir.y === 0) nextDir = { x: 0, y: 1 };
        else if (dy < -20 && nextDir.y === 0) nextDir = { x: 0, y: -1 };
      }
    });

    scheduleTick();
    renderRaf = requestAnimationFrame(renderLoop);
  }

  function scheduleTick() {
    tickStartTime = performance.now();
    const es = effectiveSpeed();
    tickDurationMs = es;
    tickTimeout = setTimeout(gameTick, es);
  }

  function gameTick() {
    if (!running) return;
    prevSnake = snake.map(s => ({ ...s }));
    dir = nextDir;
    let head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // Xenzia mode always uses solid walls, matching the original —
    // wraparound is a modern-mode-only option, not available here.
    const wrap = !getXenziaMode() && getWrapMode();
    if (wrap) {
      // wraparound mode: leaving one edge brings you in from the other,
      // so out-of-bounds is never itself a death condition here
      if (head.x < 0) head.x = cols - 1;
      else if (head.x >= cols) head.x = 0;
      if (head.y < 0) head.y = rows - 1;
      else if (head.y >= rows) head.y = 0;
    } else if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
      finish();
      return;
    }

    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      finish();
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      const eatenType = foodType;
      score += eatenType === FOOD_BONUS ? 5 : 1;
      onScore('Length ' + snake.length + (eatenType === FOOD_BONUS ? '  +5!' : ''));
      window.Arcade.Sound.play('eat');
      placeFood();
      if (eatenType === FOOD_BONUS) {
        // bonus food doesn't add a body segment beyond the normal growth,
        // it's a pure score reward — still pop the tail like normal food
        snake.pop();
      } else if (eatenType === FOOD_SPEED) {
        snake.pop();
        applyTemporarySpeedBoost();
      }
      // normal food: fall through, tail NOT popped, so the snake grows by one
      if (speed > cfg.minSpeed) speed -= cfg.speedStep;
    } else {
      snake.pop();
    }
    scheduleTick();
  }

  let speedBoostTimeout = null, boostActive = false;
  const BOOST_RATIO = 0.55;

  function effectiveSpeed() {
    return boostActive ? Math.max(20, speed * BOOST_RATIO) : speed;
  }

  function applyTemporarySpeedBoost() {
    window.Arcade.Sound.play('score');
    boostActive = true;
    if (speedBoostTimeout) clearTimeout(speedBoostTimeout);
    speedBoostTimeout = setTimeout(() => {
      boostActive = false;
      speedBoostTimeout = null;
    }, 4000);
  }

  function renderLoop() {
    if (!running) return;
    const elapsed = performance.now() - tickStartTime;
    const t = tickDurationMs > 0 ? Math.min(1, elapsed / tickDurationMs) : 1;
    draw(ctxRef, t);
    renderRaf = requestAnimationFrame(renderLoop);
  }

  function finish() {
    running = false;
    window.Arcade.Sound.play('hit');
    window.Arcade.Shell.shake();
    window.Arcade.Shell.flash();
    window.Arcade.Shell.vibrate([40, 30, 60]);
    if (snake.length >= 10) window.Arcade.unlockAchievement('snake_10');
    if (snake.length >= 25) window.Arcade.unlockAchievement('snake_25');
    onEnd({ score: snake.length, won: false, title: 'Game over', scoreKey: getXenziaMode() ? 'snake-xenzia' : undefined });
  }

  function teardown() {
    running = false;
    if (tickTimeout) clearTimeout(tickTimeout);
    if (renderRaf) { cancelAnimationFrame(renderRaf); renderRaf = null; }
    if (speedBoostTimeout) { clearTimeout(speedBoostTimeout); speedBoostTimeout = null; }
  }

  // Snake drives its own timing loop (setTimeout, variable speed) rather
  // than the shell's rAF loop, so `tick` is a no-op for the shell's sake.
  function tick() { return true; }

  function onGameEnd(result, { difficulty }) {
    if (difficulty === 'hard' && result.score >= 8) {
      window.Arcade.unlockAchievement('snake_hard');
      window.Arcade.recordDifficultyClear('snake', 'hard');
    }
  }

  window.Arcade.registerGame('snake', {
    title: 'Snake',
    tagline: 'Eat, grow, don\'t bite yourself.',
    icon: '🐍',
    width: W, height: H,
    supportsDifficulty: true,
    touchControls: [
      { slot: 'wrap-toggle', icon: '🔁', label: 'Toggle wrap mode', group: 'action', onDown: () => { setWrapMode(!getWrapMode()); window.Arcade.Sound.play('click'); } },
      { slot: 'xenzia-toggle', icon: '📟', label: 'Toggle Xenzia mode', group: 'action', onDown: () => { setXenziaMode(!getXenziaMode()); window.Arcade.Sound.play('click'); } }
    ],
    instructions: 'Arrow keys, WASD, or swipe to steer. Press M (or a toggle button) to switch between Classic walls and Wraparound. Press X to switch into Xenzia mode — the classic 1997 monochrome presentation, plain food only, solid walls.',
    init, renderIdleFrame, start, tick, teardown, onGameEnd
  });
})();
