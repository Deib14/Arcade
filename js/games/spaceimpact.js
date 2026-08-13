/* ============================================================
   Space Impact — Corner Arcade
   Distinct from Space Invaders: free 2D ship movement (not
   locked to a row), continuous auto-scrolling background the
   player can't speed up, varied enemy movement patterns
   (straight-line, sine-wave, homing), and a separate limited
   special-weapon resource (rockets) alongside an unlimited
   basic gun — matching the real Nokia game's actual mechanics,
   not just reusing the Invaders formula with a new coat of paint.
   ============================================================ */

(function () {
  const W = 480, H = 300;
  let ship, bullets, specialBullets, enemies, enemyBullets, powerups, stars;
  let level, lives, score, rockets, cfg, ctxRef, onScore, onEnd;
  let boss, bossSpawned, gameOver, damagedThisLevel;
  let upHeld, downHeld, leftHeld, rightHeld;
  let fireCooldownUntil, enemySpawnTimer, enemiesDefeatedThisLevel;
  const ENEMIES_PER_LEVEL = 8;
  const LEVEL_COUNT_FOR_ACHIEVEMENT = 3;

  function buildStars() {
    return Array.from({ length: 40 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      speed: 0.3 + Math.random() * 1.2, size: Math.random() < 0.2 ? 2 : 1
    }));
  }

  function resetLevel(keepScore) {
    ship = { x: 40, y: H / 2, w: 24, h: 14, invulnUntil: 0 };
    bullets = [];
    specialBullets = [];
    enemies = [];
    enemyBullets = [];
    powerups = [];
    boss = null; bossSpawned = false;
    damagedThisLevel = false;
    enemySpawnTimer = 0;
    enemiesDefeatedThisLevel = 0;
    if (!keepScore) {
      level = 1; lives = cfg.lives; score = 0; rockets = 2;
      stars = buildStars();
    }
    gameOver = false;
  }

  function init({ difficulty }) {
    cfg = window.Arcade.getDifficultyConfig('spaceImpact', difficulty);
    resetLevel(false);
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  /* ---------- Enemy spawning & movement patterns ---------- */

  function spawnEnemy() {
    const patterns = ['straight', 'sine', 'homing'];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    enemies.push({
      x: W + 20, y: 30 + Math.random() * (H - 60),
      w: 20, h: 16, hp: cfg.enemyHp, pattern,
      phase: Math.random() * Math.PI * 2,
      baseY: 30 + Math.random() * (H - 60),
      fireCooldown: 60 + Math.random() * 60
    });
  }

  function stepEnemy(e) {
    e.x -= cfg.scrollSpeed * 1.3;
    if (e.pattern === 'sine') {
      e.phase += 0.06;
      e.y = e.baseY + Math.sin(e.phase) * 40;
    } else if (e.pattern === 'homing') {
      if (e.y < ship.y - 2) e.y += 0.6;
      else if (e.y > ship.y + 2) e.y -= 0.6;
    }

    e.fireCooldown--;
    if (e.fireCooldown <= 0 && e.x < W - 40 && e.x > 30) {
      e.fireCooldown = 90 + Math.random() * 60;
      enemyBullets.push({ x: e.x, y: e.y, vx: -3, vy: 0 });
    }
  }

  /* ---------- Boss ---------- */

  function spawnBoss() {
    const baseHp = 30 + (level - 1) * 12;
    boss = {
      x: W - 80, y: H / 2 - 30, w: 60, h: 60,
      hp: Math.round(baseHp * cfg.bossHpMult), maxHp: Math.round(baseHp * cfg.bossHpMult),
      dir: 1, fireCooldown: 50
    };
    bossSpawned = true;
    window.Arcade.Sound.play('waveClear');
  }

  function stepBoss() {
    if (!boss) return;
    boss.y += boss.dir * 1.4;
    if (boss.y < 20) { boss.y = 20; boss.dir = 1; }
    if (boss.y + boss.h > H - 20) { boss.y = H - 20 - boss.h; boss.dir = -1; }

    boss.fireCooldown--;
    if (boss.fireCooldown <= 0) {
      boss.fireCooldown = 55;
      [-1, 0, 1].forEach(dy => enemyBullets.push({ x: boss.x, y: boss.y + boss.h / 2, vx: -4, vy: dy * 1.6 }));
      window.Arcade.Sound.play('shoot');
    }
  }

  /* ---------- Rendering ---------- */

  function draw(ctx) {
    ctx.fillStyle = '#050815'; ctx.fillRect(0, 0, W, H);

    stars.forEach(s => {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    });

    ctx.fillStyle = '#35e0d0'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`Score ${score}`, 6, 16);
    ctx.textAlign = 'center';
    ctx.fillText(`Level ${level}`, W / 2, 16);
    ctx.textAlign = 'right';
    ctx.fillText(`Lives ${lives}  Rockets ${rockets}`, W - 6, 16);
    ctx.textAlign = 'left';

    powerups.forEach(p => {
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'rocket' ? '🚀' : '❤️', p.x, p.y);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    enemies.forEach(e => {
      ctx.fillStyle = e.pattern === 'homing' ? '#ff3d7f' : e.pattern === 'sine' ? '#ffd93d' : '#8bd450';
      ctx.fillRect(e.x, e.y, e.w, e.h);
    });

    if (boss) {
      ctx.fillStyle = '#c48bff';
      ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
      const barW = 140, barX = W / 2 - barW / 2, barY = 24;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(barX, barY, barW, 6);
      const frac = Math.max(0, boss.hp / boss.maxHp);
      ctx.fillStyle = frac > 0.5 ? '#8bd450' : frac > 0.2 ? '#ffd93d' : '#ff3d7f';
      ctx.fillRect(barX, barY, barW * frac, 6);
    }

    ctx.fillStyle = '#ffd93d';
    bullets.forEach(b => ctx.fillRect(b.x, b.y - 1, 8, 2));
    ctx.fillStyle = '#ff8a3d';
    specialBullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#ff3d7f';
    enemyBullets.forEach(b => ctx.fillRect(b.x - 1, b.y - 1, 4, 3));

    const blinking = Date.now() < ship.invulnUntil && Math.floor(Date.now() / 100) % 2 === 0;
    if (!blinking) {
      ctx.fillStyle = '#5fb0ff';
      ctx.beginPath();
      ctx.moveTo(ship.x + ship.w, ship.y + ship.h / 2);
      ctx.lineTo(ship.x, ship.y);
      ctx.lineTo(ship.x + 6, ship.y + ship.h / 2);
      ctx.lineTo(ship.x, ship.y + ship.h);
      ctx.closePath(); ctx.fill();
    }
  }

  /* ---------- Player actions ---------- */

  function fireBasic() {
    const now = Date.now();
    if (now < fireCooldownUntil) return;
    fireCooldownUntil = now + 180;
    bullets.push({ x: ship.x + ship.w, y: ship.y + ship.h / 2 });
    window.Arcade.Sound.play('shoot');
  }

  function fireSpecial() {
    if (rockets <= 0) return;
    rockets--;
    specialBullets.push({ x: ship.x + ship.w, y: ship.y + ship.h / 2, vx: 6 });
    window.Arcade.Sound.play('drop');
  }

  function rectHit(x, y, w, h, px, py) {
    return px > x && px < x + w && py > y && py < y + h;
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /* ---------- Shell interface ---------- */

  function start({ ctx, canvas, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    cfg = config;
    resetLevel(false);
    onScore = os; onEnd = oe;
    fireCooldownUntil = 0;
    draw(ctx);

    addListener(window, 'keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w') { upHeld = true; e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 's') { downHeld = true; e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'a') { leftHeld = true; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd') { rightHeld = true; e.preventDefault(); }
      if (e.key === ' ') { fireBasic(); e.preventDefault(); }
      if (e.key === 'Shift' || e.key === 'x' || e.key === 'X') { fireSpecial(); e.preventDefault(); }
    });
    addListener(window, 'keyup', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w') upHeld = false;
      if (e.key === 'ArrowDown' || e.key === 's') downHeld = false;
      if (e.key === 'ArrowLeft' || e.key === 'a') leftHeld = false;
      if (e.key === 'ArrowRight' || e.key === 'd') rightHeld = false;
    });

    // Touch: drag directly on the canvas to fly — this is the natural
    // mobile control for a free-movement shooter and covers vertical
    // movement, which the on-screen buttons alone don't (those only
    // give left/right, matching the classic phone d-pad emphasis on
    // horizontal, but a touch player still needs to dodge vertically).
    let dragging = false;
    addListener(canvas, 'pointerdown', (e) => {
      dragging = true;
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width, scaleY = H / rect.height;
      ship.x = (e.clientX - rect.left) * scaleX - ship.w / 2;
      ship.y = (e.clientY - rect.top) * scaleY - ship.h / 2;
      fireBasic();
    });
    addListener(canvas, 'pointermove', (e) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width, scaleY = H / rect.height;
      ship.x = (e.clientX - rect.left) * scaleX - ship.w / 2;
      ship.y = (e.clientY - rect.top) * scaleY - ship.h / 2;
    });
    addListener(canvas, 'pointerup', () => { dragging = false; });
    addListener(canvas, 'pointercancel', () => { dragging = false; });
  }

  function loseLife() {
    lives--;
    damagedThisLevel = true;
    ship.invulnUntil = Date.now() + 1500;
    window.Arcade.Sound.play('playerHit');
    window.Arcade.Shell.shake();
    window.Arcade.Shell.vibrate(lives <= 0 ? [40, 30, 60] : 40);
    if (lives <= 0) {
      gameOver = true;
      window.Arcade.Shell.flash();
      onEnd({ score, won: false, title: 'Game over', meta: { level } });
      return true;
    }
    ship.x = 40; ship.y = H / 2;
    return false;
  }

  function advanceLevel() {
    score += 300;
    window.Arcade.unlockAchievement('impact_level1');
    if (level >= LEVEL_COUNT_FOR_ACHIEVEMENT) window.Arcade.unlockAchievement('impact_level3');
    if (!damagedThisLevel) window.Arcade.unlockAchievement('impact_noscratch');
    level++;
    resetLevel(true);
  }

  function tick() {
    if (gameOver) return true;
    const now = Date.now();

    if (upHeld) ship.y -= 3;
    if (downHeld) ship.y += 3;
    if (leftHeld) ship.x -= 3;
    if (rightHeld) ship.x += 3;
    ship.x = Math.max(4, Math.min(W - ship.w - 4, ship.x));
    ship.y = Math.max(10, Math.min(H - ship.h - 10, ship.y));

    stars.forEach(s => { s.x -= s.speed; if (s.x < 0) { s.x = W; s.y = Math.random() * H; } });

    bullets.forEach(b => b.x += 7);
    bullets = bullets.filter(b => b.x < W);
    specialBullets.forEach(b => b.x += b.vx);
    specialBullets = specialBullets.filter(b => b.x < W);
    enemyBullets.forEach(b => { b.x += b.vx; b.y += b.vy; });
    enemyBullets = enemyBullets.filter(b => b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10);

    // spawn regular enemies until this level's quota is defeated, then
    // spawn the boss once (bossSpawned latches so this only fires once)
    if (!boss && !bossSpawned) {
      enemySpawnTimer -= 16.7;
      const stillToSpawn = ENEMIES_PER_LEVEL - enemiesDefeatedThisLevel - enemies.length;
      if (enemySpawnTimer <= 0 && stillToSpawn > 0) {
        enemySpawnTimer = cfg.enemySpawnMs;
        spawnEnemy();
      }
      if (enemiesDefeatedThisLevel >= ENEMIES_PER_LEVEL && enemies.length === 0) {
        spawnBoss();
      }
    }
    enemies.forEach(stepEnemy);
    enemies = enemies.filter(e => e.x > -30);

    stepBoss();

    // player bullets vs enemies/boss (basic + special, each resolves at
    // most one hit per bullet per frame)
    [bullets, specialBullets].forEach((arr, arrIdx) => {
      const isSpecial = arrIdx === 1;
      const surviving = [];
      arr.forEach(b => {
        const hit = enemies.find(e => rectHit(e.x, e.y, e.w, e.h, b.x, b.y));
        if (hit) {
          hit.hp -= isSpecial ? 3 : 1;
          if (isSpecial) window.Arcade.unlockAchievement('impact_special');
          if (hit.hp <= 0) {
            enemies.splice(enemies.indexOf(hit), 1);
            enemiesDefeatedThisLevel++;
            score += 20;
            window.Arcade.Sound.play('alienHit');
            maybeDropPowerup(hit);
          } else {
            window.Arcade.Sound.play('bounce');
          }
        } else if (boss && rectHit(boss.x, boss.y, boss.w, boss.h, b.x, b.y)) {
          boss.hp -= isSpecial ? 4 : 1;
          window.Arcade.Sound.play('alienHit');
          if (isSpecial) window.Arcade.unlockAchievement('impact_special');
          if (boss.hp <= 0) {
            boss = null;
            advanceLevel();
          }
        } else {
          surviving.push(b);
        }
      });
      if (isSpecial) specialBullets = surviving; else bullets = surviving;
    });

    onScore(`Score ${score} · Level ${level}`);

    powerups.forEach(p => p.x -= cfg.scrollSpeed);
    powerups = powerups.filter(p => {
      if (rectHit(ship.x - 6, ship.y - 6, ship.w + 12, ship.h + 12, p.x, p.y)) {
        applyPowerup(p);
        return false;
      }
      return p.x > -20;
    });

    if (now >= ship.invulnUntil) {
      const hitIdx = enemyBullets.findIndex(b => rectHit(ship.x, ship.y, ship.w, ship.h, b.x, b.y));
      if (hitIdx !== -1) {
        enemyBullets.splice(hitIdx, 1);
        if (loseLife()) { draw(ctxRef); return true; }
      }
      const collidedEnemy = enemies.find(e => rectsOverlap(ship.x, ship.y, ship.w, ship.h, e.x, e.y, e.w, e.h));
      if (collidedEnemy) {
        enemies.splice(enemies.indexOf(collidedEnemy), 1);
        if (loseLife()) { draw(ctxRef); return true; }
      }
      if (boss && rectsOverlap(ship.x, ship.y, ship.w, ship.h, boss.x, boss.y, boss.w, boss.h)) {
        if (loseLife()) { draw(ctxRef); return true; }
      }
    }

    draw(ctxRef);
    return true;
  }

  function maybeDropPowerup(enemy) {
    if (Math.random() < 0.15) {
      powerups.push({ x: enemy.x, y: enemy.y, kind: Math.random() < 0.6 ? 'rocket' : 'life' });
    }
  }

  function applyPowerup(p) {
    window.Arcade.Sound.play('score');
    if (p.kind === 'rocket') rockets = Math.min(9, rockets + 2);
    else lives = Math.min(9, lives + 1);
  }

  window.Arcade.registerGame('spaceImpact', {
    title: 'Space Impact',
    tagline: 'Free-roaming side-scrolling shooter. Clear each level\'s boss to advance.',
    icon: '🛸',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Arrows/WASD to fly freely in any direction, or drag directly on the screen on touch devices. Space to fire your gun (unlimited). Shift or X (or the rocket button) to fire a rocket — limited, pick up more from destroyed enemies. Clear enough enemies to trigger the level boss.',
    touchControls: [
      { slot: 'fire',       icon: '🔫', label: 'Fire',  group: 'action', onDown: () => fireBasic() },
      { slot: 'hard-drop',  icon: '🚀', label: 'Rocket', group: 'action', onDown: () => fireSpecial() },
    ],
    init, renderIdleFrame, start, tick
  });
})();
