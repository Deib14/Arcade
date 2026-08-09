/* ============================================================
   Memory Match — Corner Arcade (new game)
   ============================================================ */

(function () {
  const W = 420, H = 460;
  const ICONS = ['🐦', '🐍', '🧱', '🔢', '🦖', '🏓', '🎮', '🕹️', '⭐', '🔥', '💎', '🍀'];
  let cards, cols, rowsN, cardW, cardH, gap, cfg;
  let firstPick, secondPick, lock, matches, wrongGuesses, ctxRef, onScore, onEnd, peekTimer, mismatchTimer;

  function buildDeck(pairs) {
    const chosen = ICONS.slice(0, pairs);
    const deck = chosen.concat(chosen).map((icon, i) => ({ icon, id: i, matched: false, flipped: true }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function layoutGrid(pairs) {
    const total = pairs * 2;
    cols = total <= 12 ? 4 : 5;
    rowsN = Math.ceil(total / cols);
    gap = 8;
    cardW = (W - gap * (cols + 1)) / cols;
    cardH = (H - 60 - gap * (rowsN + 1)) / rowsN;
  }

  function resetState(config) {
    cfg = config;
    layoutGrid(config.pairs);
    cards = buildDeck(config.pairs);
    firstPick = null; secondPick = null; lock = true;
    matches = 0; wrongGuesses = 0;
  }

  function cardPos(i) {
    const r = Math.floor(i / cols), c = i % cols;
    return { x: gap + c * (cardW + gap), y: 40 + gap + r * (cardH + gap) };
  }

  function draw(ctx) {
    ctx.fillStyle = '#120a1a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#c9c0da'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`Pairs found: ${matches}/${cfg.pairs}`, gap, 26);

    cards.forEach((card, i) => {
      const { x, y } = cardPos(i);
      if (card.matched) {
        ctx.fillStyle = '#1f3d2a';
      } else if (card.flipped) {
        ctx.fillStyle = '#2a2140';
      } else {
        ctx.fillStyle = '#251c33';
      }
      roundRect(ctx, x, y, cardW, cardH, 8); ctx.fill();
      ctx.strokeStyle = card.matched ? '#35e0d0' : '#3a3050';
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, cardW, cardH, 8); ctx.stroke();

      if (card.flipped || card.matched) {
        ctx.font = `${Math.min(cardW, cardH) * 0.5}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(card.icon, x + cardW / 2, y + cardH / 2 + 2);
      } else {
        ctx.fillStyle = '#9d7cff44';
        ctx.font = `bold ${Math.min(cardW, cardH) * 0.4}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', x + cardW / 2, y + cardH / 2 + 2);
      }
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function init({ difficulty }) {
    resetState(window.Arcade.getDifficultyConfig('memory', difficulty));
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  function startRound() {
    // brief peek at all cards, then flip face-down and unlock input
    cards.forEach(c => c.flipped = true);
    draw(ctxRef);
    peekTimer = setTimeout(() => {
      cards.forEach(c => c.flipped = false);
      draw(ctxRef);
      lock = false;
    }, cfg.peekMs);
  }

  function handleTap(x, y) {
    if (lock) return;
    const idx = cards.findIndex((c, i) => {
      const { x: cx, y: cy } = cardPos(i);
      return x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH && !c.flipped && !c.matched;
    });
    if (idx === -1) return;

    cards[idx].flipped = true;
    window.Arcade.Sound.play('cardFlip');
    draw(ctxRef);

    if (firstPick === null) {
      firstPick = idx;
      return;
    }
    secondPick = idx;
    lock = true;

    if (cards[firstPick].icon === cards[secondPick].icon) {
      cards[firstPick].matched = true;
      cards[secondPick].matched = true;
      matches++;
      onScore(`Pairs ${matches}/${cfg.pairs}`);
      window.Arcade.Sound.play('cardMatch');
      firstPick = null; secondPick = null; lock = false;
      draw(ctxRef);
      if (matches === cfg.pairs) {
        window.Arcade.unlockAchievement('memory_win');
        if (wrongGuesses === 0) window.Arcade.unlockAchievement('memory_perfect');
        onEnd({ score: matches, won: true, title: 'Cleared!' });
      }
    } else {
      wrongGuesses++;
      window.Arcade.Sound.play('cardMiss');
      mismatchTimer = setTimeout(() => {
        mismatchTimer = null;
        cards[firstPick].flipped = false;
        cards[secondPick].flipped = false;
        firstPick = null; secondPick = null; lock = false;
        draw(ctxRef);
      }, 700);
    }
  }

  function start({ ctx, canvas, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetState(config);
    onScore = os; onEnd = oe;

    addListener(canvas, 'pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width, scaleY = H / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      handleTap(x, y);
    });

    startRound();
  }

  function teardown() {
    if (peekTimer) clearTimeout(peekTimer);
    if (mismatchTimer) clearTimeout(mismatchTimer);
  }

  function tick() { return true; }

  window.Arcade.registerGame('memory', {
    title: 'Memory Match',
    tagline: 'Flip cards, find every pair.',
    icon: '🧠',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Cards flash briefly at the start — memorize, then tap two at a time to find pairs.',
    init, renderIdleFrame, start, tick, teardown
  });
})();
