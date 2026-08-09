/* ============================================================
   Pong — Corner Arcade (local 2-player)
   ============================================================ */

(function () {
  const W = 440, H = 300;
  let p1, p2, ball, score1, score2, ctxRef, onScore, onEnd;
  let up1, down1, up2, down2;

  function resetState() {
    p1 = { x: 14, y: H / 2 - 30, w: 10, h: 60, speed: 6 };
    p2 = { x: W - 24, y: H / 2 - 30, w: 10, h: 60, speed: 6 };
    ball = { x: W / 2, y: H / 2, r: 7, vx: 4, vy: 3 };
    score1 = 0; score2 = 0;
    up1 = down1 = up2 = down2 = false;
  }

  function draw(ctx) {
    ctx.fillStyle = '#060f1a'; ctx.fillRect(0, 0, W, H);
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = '#1c3450'; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#5fb0ff';
    ctx.fillRect(p1.x, p1.y, p1.w, p1.h);
    ctx.fillRect(p2.x, p2.y, p2.w, p2.h);
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
  }

  function init() { resetState(); }
  function renderIdleFrame({ ctx }) { draw(ctx); }

  function start({ ctx, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetState();
    onScore = os; onEnd = oe;

    addListener(window, 'keydown', (e) => {
      if (e.key === 'w') up1 = true; if (e.key === 's') down1 = true;
      if (e.key === 'ArrowUp') { up2 = true; e.preventDefault(); }
      if (e.key === 'ArrowDown') { down2 = true; e.preventDefault(); }
    });
    addListener(window, 'keyup', (e) => {
      if (e.key === 'w') up1 = false; if (e.key === 's') down1 = false;
      if (e.key === 'ArrowUp') up2 = false; if (e.key === 'ArrowDown') down2 = false;
    });
  }

  function resetBall(dir) {
    ball.x = W / 2; ball.y = H / 2; ball.vx = 4 * dir; ball.vy = (Math.random() - 0.5) * 4;
  }

  function tick() {
    const ctx = ctxRef;
    ctx.fillStyle = '#060f1a'; ctx.fillRect(0, 0, W, H);
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = '#1c3450'; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);

    if (up1) p1.y -= p1.speed; if (down1) p1.y += p1.speed;
    if (up2) p2.y -= p2.speed; if (down2) p2.y += p2.speed;
    p1.y = Math.max(0, Math.min(H - p1.h, p1.y));
    p2.y = Math.max(0, Math.min(H - p2.h, p2.y));

    ball.x += ball.vx; ball.y += ball.vy;
    if (ball.y - ball.r < 0 || ball.y + ball.r > H) { ball.vy *= -1; window.Arcade.Sound.play('bounce'); }

    if (ball.x - ball.r < p1.x + p1.w && ball.y > p1.y && ball.y < p1.y + p1.h && ball.vx < 0) {
      ball.vx *= -1.05;
      ball.vy += (ball.y - (p1.y + p1.h / 2)) * 0.1;
      window.Arcade.Sound.play('bounce');
    }
    if (ball.x + ball.r > p2.x && ball.y > p2.y && ball.y < p2.y + p2.h && ball.vx > 0) {
      ball.vx *= -1.05;
      ball.vy += (ball.y - (p2.y + p2.h / 2)) * 0.1;
      window.Arcade.Sound.play('bounce');
    }

    if (ball.x < 0) { score2++; window.Arcade.Sound.play('score'); resetBall(1); }
    if (ball.x > W) { score1++; window.Arcade.Sound.play('score'); resetBall(-1); }

    onScore(`${score1} — ${score2}`);

    ctx.fillStyle = '#5fb0ff';
    ctx.fillRect(p1.x, p1.y, p1.w, p1.h);
    ctx.fillRect(p2.x, p2.y, p2.w, p2.h);
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();

    if (score1 >= 5 || score2 >= 5) {
      const p1Won = score1 > score2;
      window.Arcade.unlockAchievement('pong_win');
      if ((p1Won && score2 === 0) || (!p1Won && score1 === 0)) window.Arcade.unlockAchievement('pong_shutout');
      onEnd({ score: p1Won ? score1 : score2, won: true, title: (p1Won ? 'Player 1' : 'Player 2') + ' wins' });
      return false;
    }
    return true;
  }

  window.Arcade.registerGame('pong', {
    title: 'Pong',
    tagline: 'Local 2-player. First to 5 wins.',
    icon: '🏓',
    width: W, height: H,
    supportsDifficulty: false,
    instructions: 'Player 1: W / S. Player 2: Up / Down arrows.',
    init, renderIdleFrame, start, tick
  });
})();
