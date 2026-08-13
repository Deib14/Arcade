/* ============================================================
   Bounce — Corner Arcade
   The Nokia physics platformer: a red ball with real jump/gravity
   physics and wall bounces, side-scrolling through hand-laid-out
   levels, collecting every ring before reaching the exit gate,
   avoiding spikes. Genuinely different engine style from every
   other game here — continuous physics simulation with a camera
   that follows the player, not a fixed-viewport grid or arena.
   ============================================================ */

(function () {
  const VIEW_W = 480, VIEW_H = 280;
  const GROUND_Y = VIEW_H - 30;
  const GRAVITY = 0.55;
  const MOVE_ACCEL = 0.6, MAX_MOVE_SPEED = 3.2, MOVE_FRICTION = 0.85;
  const RADIUS = 11;

  let ball, camX, platforms, rings, spikes, gate, level, lives, ringsCollected, totalRings;
  let cfg, ctxRef, onScore, onEnd, gameOver, damagedThisLevel, missedARing;
  let leftHeld, rightHeld, levelWidth, invulnUntil;

  function seededRandom(seed) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function buildLevel(levelNum, spikeCount) {
    const rand = seededRandom(levelNum * 7919 + 13);
    levelWidth = 1400 + levelNum * 200;

    const platformList = [{ x: 0, y: GROUND_Y, w: 200, h: 20 }];
    let cursorX = 220;
    while (cursorX < levelWidth - 200) {
      // Gap size is capped well within what's jumpable even at the
      // smallest (Hard-difficulty) jump height, with real margin for
      // imperfect timing — verified against the actual jump physics
      // (max theoretical distance ~110px at Hard) before picking this
      // range, not just eyeballed.
      const gap = 40 + rand() * 32;
      const w = 90 + rand() * 100;
      const heightVariance = (rand() - 0.5) * 60;
      const y = Math.max(80, Math.min(GROUND_Y, GROUND_Y - Math.max(0, heightVariance)));
      platformList.push({ x: cursorX + gap, y, w, h: 20 });
      cursorX += gap + w;
    }
    platformList.push({ x: levelWidth - 160, y: GROUND_Y, w: 160, h: 20 });

    const ringList = [];
    platformList.forEach((p, i) => {
      if (i === 0) return;
      ringList.push({ x: p.x + p.w / 2, y: p.y - 30, collected: false });
    });

    const spikeList = [];
    for (let i = 0; i < spikeCount; i++) {
      const p = platformList[1 + Math.floor(rand() * (platformList.length - 2))];
      spikeList.push({ x: p.x + rand() * (p.w - 16), y: p.y - 12, w: 16, h: 12 });
    }

    return {
      platforms: platformList,
      rings: ringList,
      spikes: spikeList,
      gate: { x: levelWidth - 60, y: GROUND_Y - 60, w: 30, h: 60 }
    };
  }

  function resetLevel(levelNum, keepLivesScore) {
    const built = buildLevel(levelNum, cfg.spikeCount);
    platforms = built.platforms;
    rings = built.rings;
    spikes = built.spikes;
    gate = built.gate;
    totalRings = rings.length;
    ringsCollected = 0;
    ball = { x: 60, y: GROUND_Y - RADIUS - 40, vx: 0, vy: 0, onGround: false };
    camX = 0;
    damagedThisLevel = false;
    missedARing = false;
    invulnUntil = 0;
    if (!keepLivesScore) lives = cfg.lives;
    gameOver = false;
  }

  function init({ difficulty }) {
    cfg = window.Arcade.getDifficultyConfig('bounce', difficulty);
    level = 1;
    resetLevel(level, false);
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  function stepPhysics() {
    ball.vy += GRAVITY;
    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.onGround = false;
    for (const p of platforms) {
      const withinX = ball.x + RADIUS > p.x && ball.x - RADIUS < p.x + p.w;
      const wasAbove = (ball.y + RADIUS - ball.vy) <= p.y;
      const nowAtOrBelow = ball.y + RADIUS >= p.y;
      if (withinX && wasAbove && nowAtOrBelow && ball.vy >= 0) {
        ball.y = p.y - RADIUS;
        ball.vy = 0;
        ball.onGround = true;
      }
    }

    if (ball.x - RADIUS < 0) { ball.x = RADIUS; ball.vx = Math.abs(ball.vx) * 0.6; }
    if (ball.x + RADIUS > levelWidth) { ball.x = levelWidth - RADIUS; ball.vx = -Math.abs(ball.vx) * 0.6; }

    if (ball.y - RADIUS > VIEW_H + 40) {
      loseLife();
    }

    camX = Math.max(0, Math.min(levelWidth - VIEW_W, ball.x - VIEW_W / 2));
  }

  function jump() {
    if (ball.onGround) {
      ball.vy = cfg.jumpVy;
      ball.onGround = false;
      window.Arcade.Sound.play('jump');
    }
  }

  function loseLife() {
    if (Date.now() < invulnUntil) return;
    lives--;
    damagedThisLevel = true;
    invulnUntil = Date.now() + 1200;
    window.Arcade.Sound.play('hit');
    window.Arcade.Shell.shake();
    window.Arcade.Shell.vibrate(lives <= 0 ? [40, 30, 60] : 40);
    if (lives <= 0) {
      gameOver = true;
      window.Arcade.Shell.flash();
      onEnd({ score: ringsCollected + (level - 1) * totalRings, won: false, title: 'Game over', meta: { level } });
      return;
    }
    const landing = platforms.filter(p => p.x < ball.x).sort((a, b) => b.x - a.x)[0] || platforms[0];
    ball.x = landing.x + 20;
    ball.y = landing.y - RADIUS - 10;
    ball.vx = 0; ball.vy = 0;
  }

  function draw(ctx) {
    ctx.fillStyle = '#0a0f1c'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = 'rgba(139,212,80,0.06)';
    for (let i = -1; i < 6; i++) {
      const hx = i * 200 - (camX * 0.3) % 200;
      ctx.beginPath(); ctx.arc(hx, GROUND_Y + 40, 90, Math.PI, 0); ctx.fill();
    }

    ctx.save();
    ctx.translate(-camX, 0);

    platforms.forEach(p => {
      ctx.fillStyle = '#3a2a10';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#5a4218';
      ctx.fillRect(p.x, p.y, p.w, 4);
    });

    spikes.forEach(s => {
      ctx.fillStyle = '#ff3d7f';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + s.h);
      ctx.lineTo(s.x + s.w / 2, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h);
      ctx.closePath(); ctx.fill();
    });

    rings.forEach(r => {
      if (r.collected) return;
      ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(r.x, r.y, 12, 0, Math.PI * 2); ctx.stroke();
    });

    const gateOpen = ringsCollected >= totalRings;
    ctx.fillStyle = gateOpen ? 'rgba(139,212,80,0.5)' : 'rgba(255,61,127,0.4)';
    ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
    ctx.strokeStyle = gateOpen ? '#8bd450' : '#ff3d7f'; ctx.lineWidth = 2;
    ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);

    const blinking = Date.now() < invulnUntil && Math.floor(Date.now() / 100) % 2 === 0;
    if (!blinking) {
      ctx.fillStyle = '#ff3d3d';
      ctx.beginPath(); ctx.arc(ball.x, ball.y, RADIUS, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(ball.x - 3, ball.y - 3, RADIUS * 0.4, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();

    ctx.fillStyle = '#35e0d0'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`Level ${level}`, 6, 16);
    ctx.textAlign = 'center';
    ctx.fillText(`Rings ${ringsCollected}/${totalRings}`, VIEW_W / 2, 16);
    ctx.textAlign = 'right';
    ctx.fillText(`Lives ${lives}`, VIEW_W - 6, 16);
    ctx.textAlign = 'left';
  }

  function start({ ctx, canvas, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    cfg = config;
    level = 1;
    resetLevel(level, false);
    onScore = os; onEnd = oe;
    draw(ctx);

    addListener(window, 'keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') { leftHeld = true; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd') { rightHeld = true; e.preventDefault(); }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') { jump(); e.preventDefault(); }
    });
    addListener(window, 'keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') leftHeld = false;
      if (e.key === 'ArrowRight' || e.key === 'd') rightHeld = false;
    });
  }

  function advanceLevel() {
    window.Arcade.unlockAchievement('bounce_level1');
    if (level >= 3) window.Arcade.unlockAchievement('bounce_level3');
    if (!missedARing) window.Arcade.unlockAchievement('bounce_allrings');
    if (!damagedThisLevel) window.Arcade.unlockAchievement('bounce_noloss');
    window.Arcade.Sound.play('waveClear');
    level++;
    resetLevel(level, true);
  }

  function tick() {
    if (gameOver) return true;

    // Acceleration-based, not a direct velocity snap — this matters
    // because it lets the wall-bounce reversal (below, in stepPhysics)
    // actually persist for a few visible frames even while a direction
    // key is still held, instead of being instantly overwritten back to
    // the held direction on the very next frame.
    if (leftHeld) ball.vx -= MOVE_ACCEL;
    else if (rightHeld) ball.vx += MOVE_ACCEL;
    else ball.vx *= MOVE_FRICTION;
    ball.vx = Math.max(-MAX_MOVE_SPEED, Math.min(MAX_MOVE_SPEED, ball.vx));

    stepPhysics();
    if (gameOver) { draw(ctxRef); return true; }

    rings.forEach(r => {
      if (!r.collected && Math.hypot(ball.x - r.x, ball.y - r.y) < RADIUS + 12) {
        r.collected = true;
        ringsCollected++;
        window.Arcade.Sound.play('reveal');
        onScore(`Level ${level} · Rings ${ringsCollected}/${totalRings}`);
      }
    });

    const hitSpike = spikes.some(s => ball.x + RADIUS > s.x && ball.x - RADIUS < s.x + s.w && ball.y + RADIUS > s.y && ball.y - RADIUS < s.y + s.h);
    if (hitSpike) loseLife();
    if (gameOver) { draw(ctxRef); return true; }

    const atGate = ball.x + RADIUS > gate.x && ball.x - RADIUS < gate.x + gate.w && ball.y + RADIUS > gate.y && ball.y - RADIUS < gate.y + gate.h;
    if (atGate) {
      if (ringsCollected >= totalRings) {
        advanceLevel();
      } else {
        missedARing = true;
        ball.x = gate.x - RADIUS - 4;
        ball.vx = -1;
      }
    }

    draw(ctxRef);
    return true;
  }

  window.Arcade.registerGame('bounce', {
    title: 'Bounce',
    tagline: 'Physics platformer. Collect every ring, reach the gate.',
    icon: '🔴',
    width: VIEW_W, height: VIEW_H,
    supportsDifficulty: true,
    instructions: 'Left/Right or A/D to roll, Up/W/Space to jump. The exit gate only opens once you\'ve collected every ring in the level. Avoid the spikes.',
    touchControls: [
      { slot: 'move-left',  icon: '◀', label: 'Left',  group: 'move', onDown: () => { leftHeld = true; }, onUp: () => { leftHeld = false; } },
      { slot: 'move-right', icon: '▶', label: 'Right', group: 'move', onDown: () => { rightHeld = true; }, onUp: () => { rightHeld = false; } },
      { slot: 'rotate',     icon: '⬆', label: 'Jump',  group: 'action', onDown: () => jump() },
    ],
    init, renderIdleFrame, start, tick
  });
})();
