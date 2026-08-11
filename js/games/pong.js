/* ============================================================
   Pong — Corner Arcade (local 2-player)
   Ball trail, paddle impact flashes, and a selectable win target
   (5 / 10 / 21) persisted per-device, similar in spirit to how
   Snake's wraparound toggle works — a lightweight game-owned
   setting rather than routing through the difficulty system,
   since Pong doesn't otherwise support difficulty levels.
   ============================================================ */

(function () {
  const W = 440, H = 300;
  let p1, p2, ball, score1, score2, ctxRef, onScore, onEnd;
  let up1, down1, up2, down2;
  let ballTrail, p1FlashUntil, p2FlashUntil, scorePopUntil, scorePopSide;

  function targetKey() { return 'arcade_v2_pong_target'; }
  function getWinTarget() {
    const v = parseInt(localStorage.getItem(targetKey()), 10);
    return [5, 10, 21].includes(v) ? v : 5;
  }
  function setWinTarget(v) { localStorage.setItem(targetKey(), String(v)); }
  function cycleWinTarget() {
    const options = [5, 10, 21];
    const idx = options.indexOf(getWinTarget());
    setWinTarget(options[(idx + 1) % options.length]);
    window.Arcade.Sound.play('click');
  }

  function resetState() {
    p1 = { x: 14, y: H / 2 - 30, w: 10, h: 60, speed: 6 };
    p2 = { x: W - 24, y: H / 2 - 30, w: 10, h: 60, speed: 6 };
    ball = { x: W / 2, y: H / 2, r: 7, vx: 4, vy: 3 };
    score1 = 0; score2 = 0;
    up1 = down1 = up2 = down2 = false;
    ballTrail = [];
    p1FlashUntil = 0; p2FlashUntil = 0;
    scorePopUntil = 0; scorePopSide = null;
  }

  function draw(ctx) {
    ctx.fillStyle = '#060f1a'; ctx.fillRect(0, 0, W, H);
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = '#1c3450'; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);

    // ball trail — a short fading tail behind the ball's recent positions
    ballTrail.forEach((p, i) => {
      const alpha = (i / ballTrail.length) * 0.35;
      ctx.fillStyle = `rgba(95,176,255,${alpha.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, ball.r * (0.5 + 0.5 * i / ballTrail.length), 0, Math.PI * 2); ctx.fill();
    });

    const now = Date.now();
    ctx.fillStyle = now < p1FlashUntil ? '#ffffff' : '#5fb0ff';
    ctx.fillRect(p1.x, p1.y, p1.w, p1.h);
    ctx.fillStyle = now < p2FlashUntil ? '#ffffff' : '#5fb0ff';
    ctx.fillRect(p2.x, p2.y, p2.w, p2.h);

    ctx.fillStyle = '#5fb0ff';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();

    // score-pop: brief scale/glow on the side that just scored
    if (now < scorePopUntil) {
      const t = 1 - (scorePopUntil - now) / 400;
      const scale = 1 + Math.sin(t * Math.PI) * 0.6;
      ctx.save();
      ctx.font = `bold ${Math.round(28 * scale)}px monospace`;
      ctx.fillStyle = 'rgba(255,217,61,0.9)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const x = scorePopSide === 'p1' ? W * 0.25 : W * 0.75;
      ctx.fillText('+1', x, H / 2 - 40);
      ctx.restore();
    }

    ctx.fillStyle = '#5a6a80'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`First to ${getWinTarget()}`, W / 2, H - 8);
    ctx.textAlign = 'left';
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
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); cycleWinTarget(); }
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
    if (up1) p1.y -= p1.speed; if (down1) p1.y += p1.speed;
    if (up2) p2.y -= p2.speed; if (down2) p2.y += p2.speed;
    p1.y = Math.max(0, Math.min(H - p1.h, p1.y));
    p2.y = Math.max(0, Math.min(H - p2.h, p2.y));

    ballTrail.push({ x: ball.x, y: ball.y });
    if (ballTrail.length > 8) ballTrail.shift();

    ball.x += ball.vx; ball.y += ball.vy;
    if (ball.y - ball.r < 0 || ball.y + ball.r > H) { ball.vy *= -1; window.Arcade.Sound.play('bounce'); }

    if (ball.x - ball.r < p1.x + p1.w && ball.y > p1.y && ball.y < p1.y + p1.h && ball.vx < 0) {
      ball.vx *= -1.05;
      ball.vy += (ball.y - (p1.y + p1.h / 2)) * 0.1;
      window.Arcade.Sound.play('bounce');
      p1FlashUntil = Date.now() + 100;
    }
    if (ball.x + ball.r > p2.x && ball.y > p2.y && ball.y < p2.y + p2.h && ball.vx > 0) {
      ball.vx *= -1.05;
      ball.vy += (ball.y - (p2.y + p2.h / 2)) * 0.1;
      window.Arcade.Sound.play('bounce');
      p2FlashUntil = Date.now() + 100;
    }

    if (ball.x < 0) {
      score2++; window.Arcade.Sound.play('score'); resetBall(1);
      scorePopUntil = Date.now() + 400; scorePopSide = 'p2';
      ballTrail = [];
    }
    if (ball.x > W) {
      score1++; window.Arcade.Sound.play('score'); resetBall(-1);
      scorePopUntil = Date.now() + 400; scorePopSide = 'p1';
      ballTrail = [];
    }

    onScore(`${score1} — ${score2}`);
    draw(ctxRef);

    const target = getWinTarget();
    if (score1 >= target || score2 >= target) {
      const p1Won = score1 > score2;
      window.Arcade.unlockAchievement('pong_win');
      if ((p1Won && score2 === 0) || (!p1Won && score1 === 0)) window.Arcade.unlockAchievement('pong_shutout');
      if (target === 21) window.Arcade.unlockAchievement('pong_marathon');
      onEnd({ score: p1Won ? score1 : score2, won: true, title: (p1Won ? 'Player 1' : 'Player 2') + ' wins' });
      return false;
    }
    return true;
  }

  window.Arcade.registerGame('pong', {
    title: 'Pong',
    tagline: 'Local 2-player. Choose first to 5, 10, or 21.',
    icon: '🏓',
    width: W, height: H,
    supportsDifficulty: false,
    instructions: 'Player 1: W / S. Player 2: Up / Down arrows. Press T (or the on-screen button) to cycle the win target between 5, 10, and 21.',
    touchControls: [
      { slot: 'target', icon: '🎯', label: 'Change win target', group: 'action', onDown: () => cycleWinTarget() }
    ],
    init, renderIdleFrame, start, tick
  });
})();
