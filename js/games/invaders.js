/* ============================================================
   Space Invaders — Corner Arcade
   Classic grid-march alien AI: whole formation moves as one
   unit, reverses and steps down when any alien hits a wall.
   ============================================================ */

(function () {
  const W = 420, H = 560;
  const ALIEN_ROWS = 4, ALIEN_COLS = 8;
  const ALIEN_W = 28, ALIEN_H = 20, ALIEN_GAP_X = 12, ALIEN_GAP_Y = 16;
  const FORMATION_W = ALIEN_COLS * (ALIEN_W + ALIEN_GAP_X) - ALIEN_GAP_X;

  let player, aliens, playerBullet, alienBullets, shields;
  let formationDir, formationSpeedMult, wave, lives, score, livesLostThisWave;
  let gameOver, cfg, ctxRef, onScore, onEnd;
  let moveLeftHeld, moveRightHeld, alienFireTimer;

  const ALIEN_COLORS = ['#ff3d7f', '#ff8a3d', '#ffd93d', '#8bd450'];

  function buildAliens() {
    const list = [];
    const startX = (W - FORMATION_W) / 2;
    for (let r = 0; r < ALIEN_ROWS; r++) {
      for (let c = 0; c < ALIEN_COLS; c++) {
        list.push({
          x: startX + c * (ALIEN_W + ALIEN_GAP_X),
          y: 50 + r * (ALIEN_H + ALIEN_GAP_Y),
          alive: true,
          row: r
        });
      }
    }
    return list;
  }

  function buildShields() {
    // three simple block shields partway up the screen, each with hit points per segment
    const shieldW = 50, shieldH = 24, count = 3;
    const spacing = (W - shieldW * count) / (count + 1);
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        x: spacing + i * (shieldW + spacing),
        y: H - 150,
        w: shieldW,
        h: shieldH,
        hp: 6
      });
    }
    return list;
  }

  function resetWaveState(config, keepScore) {
    cfg = config;
    aliens = buildAliens();
    shields = buildShields();
    player = { x: W / 2 - 16, y: H - 40, w: 32, h: 16, speed: 5 };
    playerBullet = null;
    alienBullets = [];
    formationDir = 1;
    formationSpeedMult = 1;
    livesLostThisWave = 0;
    if (!keepScore) { score = 0; wave = 1; lives = cfg.lives; }
    gameOver = false;
    moveLeftHeld = false; moveRightHeld = false;
  }

  function init({ difficulty }) {
    resetWaveState(window.Arcade.getDifficultyConfig('invaders', difficulty), false);
  }

  function draw(ctx) {
    ctx.fillStyle = '#050912'; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#35e0d0'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`Score ${score}`, 8, 20);
    ctx.textAlign = 'center';
    ctx.fillText(`Wave ${wave}`, W / 2, 20);
    ctx.textAlign = 'right';
    ctx.fillText(`Lives ${lives}`, W - 8, 20);
    ctx.textAlign = 'left';

    // shields
    shields.forEach(s => {
      if (s.hp <= 0) return;
      const alpha = 0.3 + 0.7 * (s.hp / 6);
      ctx.fillStyle = `rgba(139,212,80,${alpha.toFixed(2)})`;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    });

    // aliens
    aliens.forEach(a => {
      if (!a.alive) return;
      ctx.fillStyle = ALIEN_COLORS[a.row % ALIEN_COLORS.length];
      ctx.fillRect(a.x, a.y, ALIEN_W, ALIEN_H);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(a.x + 4, a.y + ALIEN_H - 5, ALIEN_W - 8, 3);
    });

    // player
    ctx.fillStyle = '#5fb0ff';
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillRect(player.x + player.w / 2 - 3, player.y - 6, 6, 6);

    // bullets
    if (playerBullet) {
      ctx.fillStyle = '#ffd93d';
      ctx.fillRect(playerBullet.x - 2, playerBullet.y, 4, 10);
    }
    ctx.fillStyle = '#ff3d7f';
    alienBullets.forEach(b => ctx.fillRect(b.x - 2, b.y, 4, 10));

    if (gameOver) return;
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  function moveLeft() { player.x = Math.max(4, player.x - player.speed); }
  function moveRight() { player.x = Math.min(W - player.w - 4, player.x + player.speed); }
  function fire() {
    if (playerBullet || gameOver) return;
    playerBullet = { x: player.x + player.w / 2, y: player.y - 10 };
    window.Arcade.Sound.play('shoot');
  }

  function aliveAliens() { return aliens.filter(a => a.alive); }

  function stepFormation() {
    const alive = aliveAliens();
    if (alive.length === 0) return;

    const speed = cfg.alienSpeed * formationSpeedMult;
    const minX = Math.min(...alive.map(a => a.x));
    const maxX = Math.max(...alive.map(a => a.x + ALIEN_W));

    let hitWall = false;
    if (formationDir > 0 && maxX + speed > W - 8) hitWall = true;
    if (formationDir < 0 && minX - speed < 8) hitWall = true;

    if (hitWall) {
      aliens.forEach(a => { a.y += cfg.stepDown; });
      formationDir *= -1;
      // formation speeds up slightly with every drop, ramping pressure as a wave wears on
      formationSpeedMult += 0.04;
    } else {
      aliens.forEach(a => { a.x += speed * formationDir; });
    }

    // reaching the player's row is an instant loss condition
    const lowest = Math.max(...alive.map(a => a.y + ALIEN_H));
    if (lowest >= player.y) {
      loseLife(true);
    }
  }

  function maybeAlienFire() {
    const alive = aliveAliens();
    if (alive.length === 0) return;
    // fire from a random alien that's the lowest in its column, so shots
    // always look like they originate from the front of the formation.
    // Bucket by column index rather than raw x, since the whole formation
    // drifts by fractional pixels each tick and raw-x rounding could
    // otherwise split one visual column into two buckets.
    const byColumn = {};
    alive.forEach(a => {
      const key = Math.round(a.x / (ALIEN_W + ALIEN_GAP_X));
      if (!byColumn[key] || a.y > byColumn[key].y) byColumn[key] = a;
    });
    const shooters = Object.values(byColumn);
    const shooter = shooters[Math.floor(Math.random() * shooters.length)];
    alienBullets.push({ x: shooter.x + ALIEN_W / 2, y: shooter.y + ALIEN_H });
  }

  function rectHit(bx, by, rx, ry, rw, rh) {
    return bx > rx && bx < rx + rw && by > ry && by < ry + rh;
  }

  function loseLife(fromFormation) {
    lives--;
    livesLostThisWave++;
    alienBullets = [];
    playerBullet = null;
    window.Arcade.Sound.play('playerHit');
    window.Arcade.Shell.shake();
    if (lives <= 0) {
      gameOver = true;
      window.Arcade.Shell.flash();
      window.Arcade.Shell.vibrate([40, 30, 60]);
      draw(ctxRef);
      onEnd({ score, won: false, title: fromFormation ? 'Overrun!' : 'Game over', meta: { wave } });
      return;
    }
    window.Arcade.Shell.vibrate(40);
    // Reset player position. If the formation itself reached the player's
    // row, it also needs to pull back — otherwise it would immediately
    // trigger another instant loss next frame before the player can react.
    player.x = W / 2 - 16;
    if (fromFormation) {
      aliens.forEach(a => { a.y -= cfg.stepDown * 2; });
      formationSpeedMult = Math.max(1, formationSpeedMult - 0.2);
    }
  }

  function nextWave() {
    wave++;
    onScore(`Score ${score} · Wave ${wave}`);
    window.Arcade.Sound.play('waveClear');
    if (wave === 2) window.Arcade.unlockAchievement('invaders_wave1');
    if (livesLostThisWave === 0) window.Arcade.unlockAchievement('invaders_noloss');
    if (wave >= 4) window.Arcade.unlockAchievement('invaders_wave3');
    resetWaveState(cfg, true);
  }

  function start({ ctx, canvas, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetWaveState(config, false);
    onScore = os; onEnd = oe;
    draw(ctx);

    const onKeyDown = (e) => {
      if (gameOver) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') { moveLeftHeld = true; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd') { moveRightHeld = true; e.preventDefault(); }
      if (e.key === ' ' || e.key === 'ArrowUp') { fire(); e.preventDefault(); }
    };
    const onKeyUp = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') moveLeftHeld = false;
      if (e.key === 'ArrowRight' || e.key === 'd') moveRightHeld = false;
    };
    addListener(window, 'keydown', onKeyDown);
    addListener(window, 'keyup', onKeyUp);

    alienFireTimer = setInterval(() => { if (!gameOver) maybeAlienFire(); }, cfg.alienFireMs);
  }

  function tick() {
    if (gameOver) return true;

    if (moveLeftHeld) moveLeft();
    if (moveRightHeld) moveRight();

    stepFormation();
    if (gameOver) return true; // loseLife() may have ended the game inside stepFormation

    if (playerBullet) {
      playerBullet.y -= 8;
      if (playerBullet.y < 0) playerBullet = null;
    }
    alienBullets.forEach(b => b.y += cfg.bulletSpeed);
    alienBullets = alienBullets.filter(b => b.y < H);

    // player bullet vs aliens
    if (playerBullet) {
      const hit = aliens.find(a => a.alive && rectHit(playerBullet.x, playerBullet.y, a.x, a.y, ALIEN_W, ALIEN_H));
      if (hit) {
        hit.alive = false;
        playerBullet = null;
        score += (ALIEN_ROWS - hit.row) * 10;
        onScore(`Score ${score} · Wave ${wave}`);
        window.Arcade.Sound.play('alienHit');
        if (aliveAliens().length === 0) {
          nextWave();
          draw(ctxRef);
          return true;
        }
      }
    }

    // player bullet vs shields
    if (playerBullet) {
      const s = shields.find(s => s.hp > 0 && rectHit(playerBullet.x, playerBullet.y, s.x, s.y, s.w, s.h));
      if (s) { s.hp--; playerBullet = null; }
    }

    // alien bullets vs shields
    alienBullets = alienBullets.filter(b => {
      const s = shields.find(s => s.hp > 0 && rectHit(b.x, b.y, s.x, s.y, s.w, s.h));
      if (s) { s.hp--; return false; }
      return true;
    });

    // alien bullets vs player
    const playerHitIdx = alienBullets.findIndex(b => rectHit(b.x, b.y, player.x, player.y, player.w, player.h));
    if (playerHitIdx !== -1) {
      alienBullets.splice(playerHitIdx, 1);
      loseLife(false);
      if (gameOver) return true;
    }

    draw(ctxRef);
    return true;
  }

  function teardown() {
    if (alienFireTimer) { clearInterval(alienFireTimer); alienFireTimer = null; }
  }

  window.Arcade.registerGame('invaders', {
    title: 'Space Invaders',
    tagline: 'Clear the wave before they reach you.',
    icon: '👾',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Arrows/A-D to move, Space to fire. One shot on screen at a time — make it count.',
    touchControls: [
      { slot: 'move-left',  icon: '◀', label: 'Move left',  group: 'move',   onDown: () => { moveLeftHeld = true; }, onUp: () => { moveLeftHeld = false; } },
      { slot: 'move-right', icon: '▶', label: 'Move right', group: 'move',   onDown: () => { moveRightHeld = true; }, onUp: () => { moveRightHeld = false; } },
      { slot: 'fire',       icon: '🔫', label: 'Fire',       group: 'action', onDown: () => fire() },
    ],
    init, renderIdleFrame, start, tick, teardown
  });
})();
