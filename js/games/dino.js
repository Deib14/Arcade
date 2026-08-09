/* ============================================================
   Dino Run — Corner Arcade
   Flying obstacles require ducking (Down arrow / swipe down / hold),
   which shrinks the dino's hitbox height rather than moving it, so
   a duck only helps against things at head height — jumping still
   the only way past ground-level cacti.
   ============================================================ */

(function () {
  const W = 480, H = 280;
  let dino, obstacles, score, gameSpeed, groundY, frame, nextSpawnFrame;
  let cfg, onScore, onEnd;
  let shieldActive, shieldFlashUntil, dayNightPhase;
  const GRACE_FRAMES = 90; // ~1.5s before the first obstacle spawns
  const STAND_H = 40, DUCK_H = 22;

  function resetState(config) {
    groundY = H - 40;
    dino = { x: 50, y: groundY - STAND_H, w: 34, h: STAND_H, vy: 0, jumping: false, ducking: false };
    obstacles = [];
    score = 0;
    frame = 0;
    gameSpeed = config.startSpeed;
    cfg = config;
    nextSpawnFrame = GRACE_FRAMES + spawnInterval();
    shieldActive = false;
    shieldFlashUntil = 0;
    dayNightPhase = 0;
  }

  function spawnInterval() {
    return Math.max(35, cfg.spawnEvery - Math.floor(gameSpeed));
  }

  function init({ difficulty }) {
    resetState(window.Arcade.getDifficultyConfig('dino', difficulty));
  }

  function drawStatic(ctx) {
    ctx.fillStyle = '#0a150a';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#2a4a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();
    ctx.fillStyle = '#8bd450';
    ctx.fillRect(dino.x, dino.y, dino.w, dino.h);
  }

  function renderIdleFrame({ ctx }) { drawStatic(ctx); }

  function jump() {
    if (!dino.jumping && !dino.ducking) { dino.vy = -11; dino.jumping = true; window.Arcade.Sound.play('jump'); }
  }

  function setDucking(on) {
    if (dino.jumping) return; // can't duck mid-air — ducking only matters as a ground defense
    dino.ducking = on;
    dino.h = on ? DUCK_H : STAND_H;
    dino.y = groundY - dino.h;
  }

  let ctxRef;

  function start({ ctx, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetState(config);
    onScore = os; onEnd = oe;

    addListener(window, 'keydown', (e) => {
      if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); jump(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setDucking(true); }
    });
    addListener(window, 'keyup', (e) => {
      if (e.key === 'ArrowDown') setDucking(false);
    });

    const canvas = window.Arcade.Shell.getCanvas();
    let touchStartY = 0;
    addListener(canvas, 'pointerdown', (e) => { e.preventDefault(); touchStartY = e.clientY; jump(); });
    addListener(canvas, 'pointermove', (e) => {
      // A downward drag while grounded ducks; this is on top of the tap-to-jump
      // above, so a quick tap still jumps and a held drag-down still ducks.
      if (!dino.jumping && e.clientY - touchStartY > 25) setDucking(true);
    });
    addListener(canvas, 'pointerup', () => setDucking(false));
    addListener(canvas, 'pointercancel', () => setDucking(false));
  }

  function tick() {
    const ctx = ctxRef;
    frame++;

    drawBackground(ctx);

    dino.vy += cfg.gravity;
    dino.y += dino.vy;
    if (dino.y > groundY - dino.h) { dino.y = groundY - dino.h; dino.vy = 0; dino.jumping = false; }

    if (frame > GRACE_FRAMES && frame >= nextSpawnFrame) {
      spawnObstacle();
      nextSpawnFrame = frame + spawnInterval();
    }
    obstacles.forEach(o => o.x -= gameSpeed);
    obstacles = obstacles.filter(o => o.x > -30);

    let hitObstacleIdx = -1;
    obstacles.forEach((o, i) => {
      ctx.fillStyle = o.flying ? '#e0a53d' : '#e05d3d';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      if (dino.x < o.x + o.w && dino.x + dino.w > o.x && dino.y < o.y + o.h && dino.y + dino.h > o.y) {
        hitObstacleIdx = i;
      }
    });

    ctx.fillStyle = '#8bd450';
    ctx.fillRect(dino.x, dino.y, dino.w, dino.h);
    if (shieldActive) {
      ctx.strokeStyle = 'rgba(93,176,255,0.7)'; ctx.lineWidth = 2;
      ctx.strokeRect(dino.x - 3, dino.y - 3, dino.w + 6, dino.h + 6);
    }

    if (frame % 6 === 0 && frame > GRACE_FRAMES) {
      score++;
      onScore('Score ' + score);
      // small chance per score-tick to award a shield if not already carrying one
      if (!shieldActive && score % 40 === 0) grantShield();
    }
    if (frame % 300 === 0) gameSpeed += cfg.speedRamp;

    if (hitObstacleIdx !== -1) {
      if (shieldActive) {
        // shield absorbs exactly one hit: consume it, clear the obstacle
        // that was hit so the dino doesn't immediately re-collide with
        // the same obstacle next frame, and give clear feedback.
        shieldActive = false;
        shieldFlashUntil = frame + 20;
        obstacles.splice(hitObstacleIdx, 1);
        window.Arcade.Sound.play('bounce');
        window.Arcade.Shell.vibrate(30);
        window.Arcade.unlockAchievement('dino_shield');
      } else {
        window.Arcade.Sound.play('hit');
        window.Arcade.Shell.shake();
        window.Arcade.Shell.flash();
        window.Arcade.Shell.vibrate([40, 30, 60]);
        if (score >= 50) window.Arcade.unlockAchievement('dino_50');
        if (score >= 150) window.Arcade.unlockAchievement('dino_150');
        onEnd({ score, won: false });
        return false;
      }
    }
    return true;
  }

  function spawnObstacle() {
    // Flying obstacles become more common as the run goes on, giving the
    // player a reason to keep using duck rather than only ever jumping.
    const flyChance = Math.min(0.35, 0.1 + score / 400);
    if (Math.random() < flyChance) {
      // positioned so a standing dino must duck under it; a jump would
      // carry the dino's head straight into it instead of clearing it
      const flyH = 20;
      obstacles.push({ x: W, y: groundY - STAND_H - 6, w: 30, h: flyH, flying: true });
    } else {
      const sizeRoll = Math.random();
      const h = sizeRoll < 0.4 ? 26 : sizeRoll < 0.8 ? 38 : 50; // small / medium / tall cactus clusters
      obstacles.push({ x: W, y: groundY - h, w: 16 + h * 0.15, h, flying: false });
    }
  }

  function grantShield() {
    shieldActive = true;
    window.Arcade.Sound.play('achievement');
  }

  function drawBackground(ctx) {
    // Day/night cycle: background gradually shifts as score climbs, then
    // loops. Purely cosmetic — obstacle colors stay legible at every phase.
    dayNightPhase = (score / 120) % 1; // one full day/night cycle per ~120 score
    const nightness = Math.sin(dayNightPhase * Math.PI * 2) * 0.5 + 0.5; // 0..1..0
    const skyDay = [10, 21, 10], skyNight = [4, 6, 12];
    const r = Math.round(skyDay[0] + (skyNight[0] - skyDay[0]) * nightness);
    const g = Math.round(skyDay[1] + (skyNight[1] - skyDay[1]) * nightness);
    const b = Math.round(skyDay[2] + (skyNight[2] - skyDay[2]) * nightness);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, W, H);

    if (nightness > 0.5) {
      // faint stars once it's dark enough to actually see them
      ctx.fillStyle = `rgba(255,255,255,${(nightness - 0.5) * 0.6})`;
      for (let i = 0; i < 12; i++) {
        const sx = (i * 53 + frame * 0.02) % W;
        const sy = (i * 37) % (groundY - 20);
        ctx.fillRect(sx, sy, 2, 2);
      }
    }

    ctx.strokeStyle = '#2a4a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

    if (shieldActive || frame < shieldFlashUntil) {
      // subtle border tint while shield is active/just consumed, so its
      // presence and loss are both readable without staring at the dino
      ctx.strokeStyle = frame < shieldFlashUntil ? 'rgba(255,61,127,0.4)' : 'rgba(93,176,255,0.25)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
    }
  }

  window.Arcade.registerGame('dino', {
    title: 'Dino Run',
    tagline: 'Jump the cacti. Survive as long as you can.',
    icon: '🦖',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Space, Up arrow, or tap to jump. Down arrow or drag down to duck under flying obstacles. First obstacle waits about a second and a half after go.',
    init, renderIdleFrame, start, tick
  });
})();
