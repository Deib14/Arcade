/* ============================================================
   Whack-a-Mole — Corner Arcade (new game)
   ============================================================ */

(function () {
  const W = 420, H = 460;
  const gridCols = 3, gridRows = 3;
  let holes, score, cfg, timeLeftMs, ctxRef, onScore, onEnd;
  let spawnInterval, tickInterval, holeW, holeH, gap;

  function layoutHoles() {
    gap = 16;
    holeW = (W - gap * (gridCols + 1)) / gridCols;
    holeH = (H - 70 - gap * (gridRows + 1)) / gridRows;
    holes = [];
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        holes.push({
          x: gap + c * (holeW + gap),
          y: 70 + gap + r * (holeH + gap),
          up: false, hit: false, isBomb: false, upSince: 0
        });
      }
    }
  }

  function resetState(config) {
    cfg = config;
    layoutHoles();
    score = 0;
    timeLeftMs = config.roundMs;
  }

  function draw(ctx) {
    ctx.fillStyle = '#1a1006'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffb000'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`Score ${score}`, gap, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(timeLeftMs / 1000)}s`, W - gap, 30);
    ctx.textAlign = 'left';

    holes.forEach(h => {
      ctx.fillStyle = '#3a2a10';
      ellipse(ctx, h.x + holeW / 2, h.y + holeH * 0.85, holeW / 2, holeH * 0.22);
      ctx.fill();

      if (h.up) {
        ctx.font = `${Math.min(holeW, holeH) * 0.6}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(h.isBomb ? '💣' : '🐹', h.x + holeW / 2, h.y + holeH * 0.5);
      }
    });
  }

  function ellipse(ctx, cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  }

  function init({ difficulty }) {
    resetState(window.Arcade.getDifficultyConfig('whack', difficulty));
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  function popRandomHole() {
    const downHoles = holes.filter(h => !h.up);
    if (downHoles.length === 0) return;
    const h = downHoles[Math.floor(Math.random() * downHoles.length)];
    h.up = true;
    h.isBomb = Math.random() < 0.15;
    h.upSince = Date.now();
    setTimeout(() => { if (h.up) h.up = false; }, cfg.moleUpMs);
  }

  function handleTap(x, y) {
    const h = holes.find(h => h.up && x >= h.x && x <= h.x + holeW && y >= h.y - 20 && y <= h.y + holeH);
    if (!h) return;
    h.up = false;
    if (h.isBomb) {
      score = Math.max(0, score - 5);
      window.Arcade.Sound.play('moleBomb');
      window.Arcade.Shell.shake();
      window.Arcade.Shell.vibrate(50);
    } else {
      score += 1;
      onScore('Score ' + score);
      window.Arcade.Sound.play('moleWhack');
    }
  }

  function start({ ctx, canvas, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetState(config);
    onScore = os; onEnd = oe;

    addListener(canvas, 'pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width, scaleY = H / rect.height;
      handleTap((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    });

    spawnInterval = setInterval(popRandomHole, cfg.spawnEvery);
    tickInterval = setInterval(() => {
      timeLeftMs -= 100;
      if (timeLeftMs <= 0) {
        clearInterval(spawnInterval);
        clearInterval(tickInterval);
        if (score >= 20) window.Arcade.unlockAchievement('whack_20');
        onEnd({ score, won: true, title: 'Time!' });
      }
    }, 100);
  }

  function loop() {
    draw(ctxRef);
    return true;
  }

  function teardown() {
    if (spawnInterval) clearInterval(spawnInterval);
    if (tickInterval) clearInterval(tickInterval);
  }

  window.Arcade.registerGame('whack', {
    title: 'Whack-a-Mole',
    tagline: 'Tap the moles. Skip the bombs.',
    icon: '🔨',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Tap moles as they pop up. Bombs cost you points — leave them be.',
    init, renderIdleFrame, start, tick: loop, teardown
  });
})();
