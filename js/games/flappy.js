/* ============================================================
   Flappy Bird — Corner Arcade
   Parallax background (clouds -> buildings -> ground, each
   scrolling at a different fraction of pipe speed) plus bird
   skins unlocked through the existing medal achievements.
   ============================================================ */

(function () {
  const W = 400, H = 600;
  let bird, pipes, score, gravity, flapVel, gap, pipeSpeed, spawnGapPx, baseSpeed;
  let onScore, onEnd, elapsedFrames, lastPipeCenter;
  let clouds, buildings, groundScrollX;
  const GRACE_FRAMES = 45; // ~0.75s at 60fps before first pipe can reach the bird
  const SPEEDUP_PER_SCORE = 0.035; // pipes get very slightly faster with each successful pass
  const MAX_SPEED_MULT = 1.6; // cap how much the ramp can compound, so late-game isn't unplayable

  // Skins unlock via the same medal thresholds already tracked as
  // achievements, so no separate unlock system is needed — just check
  // whether the achievement is already unlocked.
  const SKINS = [
    { id: 'default',  requires: null,        body: '#ffdd57', wing: '#ff8800' },
    { id: 'bronze',   requires: 'flappy_10',  body: '#e0a35c', wing: '#a8642a' },
    { id: 'silver',   requires: 'flappy_25',  body: '#d8dce2', wing: '#8a92a0' },
    { id: 'gold',     requires: 'flappy_50',  body: '#ffd93d', wing: '#e0a300' },
  ];

  function unlockedSkins() {
    return SKINS.filter(s => !s.requires || window.Arcade.Achievements.isUnlocked(s.requires));
  }

  function selectedSkinId() {
    return localStorage.getItem('arcade_v2_flappy_skin') || 'default';
  }

  function setSelectedSkin(id) {
    localStorage.setItem('arcade_v2_flappy_skin', id);
  }

  function currentSkin() {
    const unlocked = unlockedSkins();
    const wantedId = selectedSkinId();
    return unlocked.find(s => s.id === wantedId) || unlocked[unlocked.length - 1] || SKINS[0];
  }

  function initParallax() {
    clouds = Array.from({ length: 5 }, (_, i) => ({
      x: (i / 5) * (W + 120), y: 40 + (i % 3) * 60, r: 18 + (i % 3) * 8
    }));
    buildings = Array.from({ length: 6 }, (_, i) => ({
      x: (i / 6) * (W + 150), w: 50 + (i % 3) * 20, h: 80 + (i % 4) * 40
    }));
    groundScrollX = 0;
  }

  function resetState(config) {
    bird = { x: 100, y: H / 2, r: 14, vy: 0 };
    pipes = [];
    score = 0;
    elapsedFrames = 0;
    gravity = config.gravity;
    flapVel = config.flapVel;
    gap = config.gap;
    baseSpeed = config.pipeSpeed;
    pipeSpeed = config.pipeSpeed;
    spawnGapPx = config.spawnGapPx;
    lastPipeCenter = null;
    initParallax();
  }

  function init({ ctx, canvas, difficulty }) {
    const config = window.Arcade.getDifficultyConfig('flappy', difficulty);
    resetState(config);
  }

  function renderIdleFrame({ ctx, canvas }) {
    drawScene(ctx);
  }

  function drawParallax(ctx) {
    // sky base
    ctx.fillStyle = '#1a1206';
    ctx.fillRect(0, 0, W, H);

    // clouds — slowest layer, furthest back
    ctx.fillStyle = 'rgba(255,220,150,0.12)';
    clouds.forEach(c => {
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(c.x + c.r * 0.8, c.y + 4, c.r * 0.7, 0, Math.PI * 2); ctx.fill();
    });

    // buildings — middle layer
    ctx.fillStyle = 'rgba(122,84,0,0.25)';
    buildings.forEach(b => {
      ctx.fillRect(b.x, H - 30 - b.h, b.w, b.h);
    });
  }

  function drawScene(ctx) {
    drawParallax(ctx);

    pipes.forEach(p => {
      ctx.fillStyle = '#ffb000';
      ctx.fillRect(p.x, 0, p.w, p.top);
      ctx.fillRect(p.x, p.top + p.gap, p.w, H - p.top - p.gap - 30);
      ctx.strokeStyle = '#7a5400'; ctx.lineWidth = 3;
      ctx.strokeRect(p.x, 0, p.w, p.top);
      ctx.strokeRect(p.x, p.top + p.gap, p.w, H - p.top - p.gap - 30);
    });

    drawGround(ctx);
    drawBird(ctx);
  }

  function drawGround(ctx) {
    ctx.fillStyle = '#241a08';
    ctx.fillRect(0, H - 30, W, 30);
    ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, H - 30); ctx.lineTo(W, H - 30); ctx.stroke();
    // scrolling tick marks so the ground reads as moving, closest/fastest layer
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let x = -((groundScrollX) % 20); x < W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, H - 30); ctx.lineTo(x - 8, H); ctx.stroke();
    }
  }

  function drawBird(ctx) {
    const skin = currentSkin();
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(Math.max(-0.5, Math.min(1, bird.vy / 12)));
    ctx.fillStyle = skin.body;
    ctx.beginPath(); ctx.arc(0, 0, bird.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(5, -4, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin.wing; ctx.beginPath(); ctx.moveTo(bird.r, 0); ctx.lineTo(bird.r + 10, -3); ctx.lineTo(bird.r + 10, 3); ctx.fill();
    ctx.restore();
  }

  function spawnPipe() {
    const margin = 50, minCenter = margin + gap / 2, maxCenter = H - 30 - margin - gap / 2;
    let center;
    if (lastPipeCenter === null) {
      center = H / 2;
    } else {
      // Cap the vertical swing between consecutive pipes so the gap
      // never jumps further than the bird can plausibly reach at the
      // current fall/flap physics — prevents "impossible" combinations
      // where back-to-back pipes would require an unreachable line.
      const maxSwing = Math.max(90, gap * 1.3);
      const low = Math.max(minCenter, lastPipeCenter - maxSwing);
      const high = Math.min(maxCenter, lastPipeCenter + maxSwing);
      center = low + Math.random() * (high - low);
    }
    lastPipeCenter = center;
    const top = center - gap / 2;
    pipes.push({ x: W + 20, top, gap, w: 56, passed: false });
  }

  let ctxRef, canvasRef;

  function start({ ctx, canvas, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx; canvasRef = canvas;
    resetState(config);
    onScore = os; onEnd = oe;

    const flap = () => { if (bird) { bird.vy = flapVel; window.Arcade.Sound.play('flap'); } };
    addListener(canvas, 'pointerdown', (e) => { e.preventDefault(); flap(); });
    addListener(window, 'keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); flap(); }
      else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        const unlocked = unlockedSkins();
        const idx = unlocked.findIndex(sk => sk.id === selectedSkinId());
        const next = unlocked[(idx + 1) % unlocked.length];
        setSelectedSkin(next.id);
        window.Arcade.Sound.play('click');
      }
    });
  }

  function tick() {
    const ctx = ctxRef;
    elapsedFrames++;

    bird.vy += gravity;
    bird.y += bird.vy;

    // grace period: don't even spawn the first pipe until player has had
    // a moment to get oriented, and spawn it further out than usual
    if (pipes.length === 0) {
      if (elapsedFrames > GRACE_FRAMES) spawnPipe();
    } else if (pipes[pipes.length - 1].x < W - spawnGapPx) {
      spawnPipe();
    }

    pipes.forEach(p => p.x -= pipeSpeed);
    pipes = pipes.filter(p => p.x > -80);

    // parallax layers scroll slower the further back they are, each as a
    // fraction of the current pipe speed, then wrap around once fully
    // offscreen so the background loops seamlessly
    clouds.forEach(c => { c.x -= pipeSpeed * 0.25; if (c.x < -40) c.x = W + 40; });
    buildings.forEach(b => { b.x -= pipeSpeed * 0.5; if (b.x < -80) b.x = W + 80; });
    groundScrollX += pipeSpeed;

    let died = false;
    pipes.forEach(p => {
      if (!p.passed && p.x + p.w < bird.x) {
        p.passed = true; score++;
        onScore('Score ' + score);
        window.Arcade.Sound.play('score');
        const speedMult = Math.min(MAX_SPEED_MULT, 1 + score * SPEEDUP_PER_SCORE);
        pipeSpeed = baseSpeed * speedMult;
      }

      const collideX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + p.w;
      const collideY = bird.y - bird.r < p.top || bird.y + bird.r > p.top + p.gap;
      if (collideX && collideY) died = true;
    });

    if (bird.y + bird.r > H - 30 || bird.y - bird.r < 0) died = true;

    drawScene(ctx);

    if (died) {
      window.Arcade.Sound.play('hit');
      window.Arcade.Shell.shake();
      window.Arcade.Shell.flash();
      window.Arcade.Shell.vibrate([40, 30, 60]);
      const difficulty = window.Arcade.Shell.getDifficulty();
      if (score >= 10) window.Arcade.unlockAchievement('flappy_10');
      if (score >= 25) window.Arcade.unlockAchievement('flappy_25');
      if (score >= 50) window.Arcade.unlockAchievement('flappy_50');
      onEnd({ score, won: false });
      return false;
    }
    return true;
  }

  function onGameEnd(result, { difficulty }) {
    if (difficulty === 'hard' && result.score >= 5) {
      window.Arcade.unlockAchievement('flappy_hard');
      window.Arcade.recordDifficultyClear('flappy', 'hard');
    }
  }

  window.Arcade.registerGame('flappy', {
    title: 'Flappy Bird',
    tagline: 'Tap or press Space to flap. Don\'t hit the pipes.',
    icon: '🐦',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Tap, click, or press Space to flap. Press S to cycle unlocked bird skins. You get a 3-count before pipes appear — use it.',
    // No dedicated on-screen button: tapping anywhere on the canvas flaps,
    // which already works on touch devices and doesn't crowd the play area.
    init, renderIdleFrame, start, tick, onGameEnd
  });
})();
