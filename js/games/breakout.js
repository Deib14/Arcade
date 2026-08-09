/* ============================================================
   Breakout — Corner Arcade
   Brick types: normal (1 hit), reinforced (2 hits, cracks visibly
   after the first), and unbreakable (never clears, just a wall to
   play around). A small chance of a falling power-up drop from any
   breakable brick — currently just a temporary wider paddle, kept
   deliberately simple rather than stacking untested multi-ball logic.
   ============================================================ */

(function () {
  const W = 440, H = 560;
  const rows = 6, cols = 8;
  let paddle, ball, bricks, score, lives, cfg, brickW, brickH;
  let onScore, onEnd, ctxRef, leftDown, rightDown, livesLost;
  let powerups, paddleBoostUntil, basePaddleWidth;

  const TYPE_NORMAL = 'normal', TYPE_TOUGH = 'tough', TYPE_UNBREAKABLE = 'unbreakable';

  function pickBrickLayout(r) {
    // Top rows skew tougher/more valuable, matching the classic Arkanoid
    // convention that harder-to-reach bricks are worth more and hardier.
    const roll = Math.random();
    if (r === 0 && roll < 0.12) return TYPE_UNBREAKABLE;
    if (r <= 1 && roll < 0.30) return TYPE_TOUGH;
    if (roll < 0.12) return TYPE_TOUGH;
    return TYPE_NORMAL;
  }

  function resetState(config) {
    cfg = config;
    basePaddleWidth = config.paddleWidth;
    paddle = { x: W / 2 - config.paddleWidth / 2, y: H - 30, w: config.paddleWidth, h: 12, speed: 7 };
    ball = { x: W / 2, y: H - 50, r: 8, vx: config.ballSpeed * 0.7, vy: -config.ballSpeed };
    brickW = (W - 40) / cols; brickH = 22;
    bricks = [];
    const colors = ['#ff3d7f', '#ff8a3d', '#ffd93d', '#8bd450', '#35e0d0', '#5fb0ff'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = pickBrickLayout(r);
        bricks.push({
          x: 20 + c * brickW, y: 50 + r * brickH, w: brickW - 4, h: brickH - 4,
          alive: true, color: colors[r % colors.length], type,
          hp: type === TYPE_TOUGH ? 2 : 1
        });
      }
    }
    score = 0; lives = config.lives; livesLost = 0;
    leftDown = false; rightDown = false;
    powerups = [];
    paddleBoostUntil = 0;
  }

  function drawBrick(ctx, b) {
    if (b.type === TYPE_UNBREAKABLE) {
      ctx.fillStyle = '#3a3a44';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#5a5a68'; ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      // diagonal hatch pattern reads clearly as "can't break this" even at small size
      ctx.strokeStyle = '#55555f'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y); ctx.stroke();
      return;
    }
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.type === TYPE_TOUGH && b.hp === 2) {
      // full-strength reinforced brick gets a darker inset border, no crack yet
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    } else if (b.type === TYPE_TOUGH && b.hp === 1) {
      // cracked: visibly damaged after one hit, one more will break it
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.3, b.y);
      ctx.lineTo(b.x + b.w * 0.5, b.y + b.h * 0.5);
      ctx.lineTo(b.x + b.w * 0.35, b.y + b.h);
      ctx.stroke();
    }
  }

  function drawBricks(ctx) {
    bricks.forEach(b => { if (b.alive) drawBrick(ctx, b); });
  }

  function drawPowerups(ctx) {
    powerups.forEach(p => {
      ctx.fillStyle = '#5fb0ff';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('↔️', p.x, p.y);
    });
  }

  function draw(ctx) {
    ctx.fillStyle = '#1a0612'; ctx.fillRect(0, 0, W, H);
    drawBricks(ctx);
    drawPowerups(ctx);
    ctx.fillStyle = paddleBoostUntil > Date.now() ? '#5fb0ff' : '#ff3d7f';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3d7f88'; ctx.font = '14px monospace';
    ctx.fillText('Lives ' + lives, W - 90, 22);
  }

  function init({ difficulty }) {
    resetState(window.Arcade.getDifficultyConfig('breakout', difficulty));
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  function start({ ctx, canvas, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetState(config);
    onScore = os; onEnd = oe;

    addListener(window, 'keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') leftDown = true;
      if (e.key === 'ArrowRight' || e.key === 'd') rightDown = true;
    });
    addListener(window, 'keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') leftDown = false;
      if (e.key === 'ArrowRight' || e.key === 'd') rightDown = false;
    });
    addListener(canvas, 'pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scale = W / rect.width;
      const x = (e.clientX - rect.left) * scale;
      paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
    });
  }

  function tick() {
    const ctx = ctxRef;

    if (leftDown) paddle.x -= paddle.speed;
    if (rightDown) paddle.x += paddle.speed;
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));

    ball.x += ball.vx; ball.y += ball.vy;
    if (ball.x - ball.r < 0 || ball.x + ball.r > W) { ball.vx *= -1; window.Arcade.Sound.play('bounce'); }
    if (ball.y - ball.r < 0) { ball.vy *= -1; window.Arcade.Sound.play('bounce'); }

    if (ball.y + ball.r > paddle.y && ball.y - ball.r < paddle.y + paddle.h && ball.x > paddle.x && ball.x < paddle.x + paddle.w) {
      ball.vy *= -1;
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      ball.vx = hit * cfg.ballSpeed;
      window.Arcade.Sound.play('bounce');
    }

    if (ball.y > H) {
      lives--; livesLost++;
      window.Arcade.Sound.play('hit');
      window.Arcade.Shell.shake();
      window.Arcade.Shell.vibrate(40);
      if (lives <= 0) {
        onEnd({ score, won: false, title: 'Game over' });
        return false;
      }
      ball.x = W / 2; ball.y = H - 50; ball.vx = cfg.ballSpeed * 0.7; ball.vy = -cfg.ballSpeed;
      paddle.x = W / 2 - paddle.w / 2;
    }

    // Only resolve the first brick the ball overlaps this frame — without
    // this, a ball touching two adjacent bricks at once (easily possible
    // given the gap between them) destroys both and double-reverses vy,
    // which cancels back to the original direction instead of bouncing.
    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        ball.vy *= -1;
        if (b.type === TYPE_UNBREAKABLE) {
          window.Arcade.Sound.play('bounce');
        } else {
          b.hp--;
          if (b.hp <= 0) {
            b.alive = false;
            score += b.type === TYPE_TOUGH ? 20 : 10;
            window.Arcade.Sound.play('brickBreak');
            maybeDropPowerup(b);
          } else {
            score += 5; // partial credit for cracking a reinforced brick
            window.Arcade.Sound.play('bounce');
          }
          onScore('Score ' + score);
        }
        break;
      }
    }

    // falling power-ups
    powerups.forEach(p => p.y += 2.4);
    powerups = powerups.filter(p => {
      if (p.y > paddle.y && p.y < paddle.y + paddle.h && p.x > paddle.x && p.x < paddle.x + paddle.w) {
        applyPowerup(p);
        return false;
      }
      return p.y < H;
    });

    if (paddleBoostUntil && paddleBoostUntil <= Date.now()) {
      paddleBoostUntil = 0;
      paddle.w = basePaddleWidth;
      paddle.x = Math.min(paddle.x, W - paddle.w);
    }

    const clearableBricks = bricks.filter(b => b.type !== TYPE_UNBREAKABLE);
    if (clearableBricks.every(b => !b.alive)) {
      window.Arcade.unlockAchievement('breakout_clear');
      if (livesLost === 0) window.Arcade.unlockAchievement('breakout_noloss');
      onEnd({ score, won: true, title: 'Board cleared!' });
      return false;
    }

    draw(ctx);
    return true;
  }

  function maybeDropPowerup(brick) {
    if (Math.random() < 0.12) {
      powerups.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, kind: 'widePaddle' });
    }
  }

  function applyPowerup(p) {
    window.Arcade.Sound.play('score');
    if (p.kind === 'widePaddle') {
      paddle.w = basePaddleWidth * 1.5;
      paddle.x = Math.min(paddle.x, W - paddle.w);
      paddleBoostUntil = Date.now() + 10000;
    }
  }

  function onGameEnd(result, { difficulty }) {
    if (difficulty === 'hard' && result.won) {
      window.Arcade.unlockAchievement('breakout_hard');
      window.Arcade.recordDifficultyClear('breakout', 'hard');
    }
  }

  window.Arcade.registerGame('breakout', {
    title: 'Breakout',
    tagline: 'Bounce, break every brick.',
    icon: '🧱',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Arrow keys, A/D, or drag to move the paddle.',
    init, renderIdleFrame, start, tick, onGameEnd
  });
})();
