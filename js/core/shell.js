/* ============================================================
   Corner Arcade — shell.js
   The runtime shell every game mounts into. Owns:
     - canvas + resize/scaling
     - the READY -> COUNTDOWN -> PLAYING -> PAUSED -> OVER state machine
     - difficulty selection UI
     - mobile on-screen controls
     - the game registry (GAMES) games register themselves into

   Fixes the "starts instantly, no time to react" bug from v1:
   every game now enters a 3-2-1 countdown before input is live,
   and the game's own logic doesn't start ticking until COUNTDOWN
   finishes. Pointerdown during countdown no longer skips it.
   ============================================================ */

window.Arcade = window.Arcade || {};

const GAMES = {};          // gameId -> game definition (registered by each game file)
window.Arcade.GAMES = GAMES;
window.Arcade.registerGame = (id, def) => { GAMES[id] = def; };

const STATE = { IDLE: 'idle', COUNTDOWN: 'countdown', PLAYING: 'playing', PAUSED: 'paused', OVER: 'over' };

const Shell = (() => {
  let canvas, ctx;
  let currentGameId = null;
  let currentGame = null;
  let state = STATE.IDLE;
  let rafId = null;
  let countdownValue = 3;
  let countdownTimer = null;
  let activeDifficulty = 'normal';
  let touchLayerEl = null;
  let listeners = []; // cleanup registry: [{target, type, fn}]

  function el(id) { return document.getElementById(id); }

  function init() {
    canvas = el('gameCanvas');
    ctx = canvas.getContext('2d');
    window.Arcade.GAME_COUNT = Object.keys(GAMES).length;
  }

  function addListener(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push({ target, type, fn, opts });
  }

  function clearListeners() {
    listeners.forEach(({ target, type, fn, opts }) => target.removeEventListener(type, fn, opts));
    listeners = [];
  }

  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (shakeTimeout) { clearTimeout(shakeTimeout); shakeTimeout = null; }
    if (flashTimeout) { clearTimeout(flashTimeout); flashTimeout = null; }
    if (currentGame && currentGame.teardown) currentGame.teardown();
    clearListeners();
  }

  function getCanvas() { return canvas; }
  function getCtx() { return ctx; }
  function getState() { return state; }
  function getDifficulty() { return activeDifficulty; }

  /* ---------- Mount / unmount ---------- */

  function mount(gameId, difficulty) {
    stopLoop();
    currentGameId = gameId;
    currentGame = GAMES[gameId];
    activeDifficulty = difficulty || window.Arcade.Settings.get().difficulty || 'normal';
    state = STATE.IDLE;

    if (!currentGame) return;

    canvas.width = currentGame.width || 480;
    canvas.height = currentGame.height || 640;
    fitCanvasToStage();

    document.getElementById('gameTitle').textContent = currentGame.title;
    document.getElementById('gameSubtitle').textContent = currentGame.tagline || '';
    updateBestScoreLine(gameId);

    renderDifficultyPicker();
    renderTouchControls();
    showReadyOverlay();

    if (currentGame.init) currentGame.init({ ctx, canvas, difficulty: activeDifficulty });
  }

  function unmount() {
    stopLoop();
    currentGameId = null;
    currentGame = null;
    ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function fitCanvasToStage() {
    // CSS handles visual scaling (width:100%); internal resolution stays fixed
    // for crisp, consistent physics across devices.
  }

  /* ---------- State machine ---------- */

  function showReadyOverlay() {
    state = STATE.IDLE;
    const overlay = el('overlay');
    overlay.classList.remove('hidden');
    overlay.classList.remove('overlay--over');
    el('overlayIcon').textContent = currentGame.icon || '🎮';
    el('overlayTitle').textContent = 'Ready?';
    el('overlaySub').textContent = currentGame.instructions || 'Tap play when you are ready.';
    el('overlayPrimaryBtn').textContent = '▶  Play';
    el('overlayPrimaryBtn').onclick = beginCountdown;
    el('overlaySecondaryBtn').classList.add('hidden');
    renderStatsLine();
  }

  function renderStatsLine() {
    const statsEl = el('overlayStats');
    const stats = window.Arcade.Stats.get();
    const plays = stats.byGame[currentGameId] || 0;
    if (plays === 0) {
      statsEl.classList.add('hidden');
      return;
    }
    const wins = (stats.winsByGame && stats.winsByGame[currentGameId]) || 0;
    let text = `Played ${plays} time${plays === 1 ? '' : 's'}`;
    if (wins > 0) {
      const rate = Math.round((wins / plays) * 100);
      text += ` · Won ${wins} (${rate}%)`;
    }
    statsEl.textContent = text;
    statsEl.classList.remove('hidden');
  }

  function beginCountdown() {
    state = STATE.COUNTDOWN;
    el('overlay').classList.add('hidden');
    countdownValue = 3;
    drawCountdownFrame();
    playCountdownBeep();
    countdownTimer = setInterval(() => {
      countdownValue -= 1;
      if (countdownValue <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        if (window.Arcade.Sound) window.Arcade.Sound.play('go');
        startPlaying();
      } else {
        drawCountdownFrame();
        playCountdownBeep();
      }
    }, 700);
  }

  function playCountdownBeep() {
    if (window.Arcade.Sound) window.Arcade.Sound.play('countdown');
  }

  function drawCountdownFrame() {
    // let the game draw its static/idle frame underneath, then overlay the number
    if (currentGame.renderIdleFrame) currentGame.renderIdleFrame({ ctx, canvas });
    ctx.save();
    ctx.fillStyle = 'rgba(6,9,15,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffb000';
    ctx.font = 'bold 96px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,176,0,0.7)';
    ctx.shadowBlur = 24;
    ctx.fillText(String(countdownValue), canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  function startPlaying() {
    state = STATE.PLAYING;
    document.getElementById('pauseBtn').classList.remove('hidden');
    document.getElementById('restartBtn').classList.remove('hidden');
    window.Arcade.recordGamePlayed(currentGameId);
    const config = window.Arcade.getDifficultyConfig(currentGameId, activeDifficulty);
    if (currentGame.start) currentGame.start({ ctx, canvas, config, difficulty: activeDifficulty, addListener, onScore: handleScore, onEnd: handleEnd, canvasEl: canvas });
    loop();
  }

  function loop() {
    if (state !== STATE.PLAYING) return;
    if (currentGame.tick) {
      const alive = currentGame.tick();
      if (alive === false) return; // game called onEnd itself
    }
    rafId = requestAnimationFrame(loop);
  }

  let shakeTimeout = null, flashTimeout = null;

  function shake() {
    if (!window.Arcade.Settings.get().screenShake) return;
    const stage = el('stage');
    stage.classList.remove('is-shaking');
    void stage.offsetWidth; // force reflow so re-adding the class restarts the animation
    stage.classList.add('is-shaking');
    if (shakeTimeout) clearTimeout(shakeTimeout);
    shakeTimeout = setTimeout(() => stage.classList.remove('is-shaking'), 300);
  }

  function flash() {
    const stage = el('stage');
    stage.classList.remove('is-flashing');
    void stage.offsetWidth;
    stage.classList.add('is-flashing');
    if (flashTimeout) clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => stage.classList.remove('is-flashing'), 320);
  }

  function vibrate(pattern) {
    if (!window.Arcade.Settings.get().haptics) return;
    if (!('vibrate' in navigator)) return; // desktop browsers and iOS Safari don't support it — silently no-op
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // some browsers throw if called outside a user-gesture context;
      // haptics are a nice-to-have, never worth breaking the game over
    }
  }

  function restart() {
    if (state === STATE.PLAYING || state === STATE.PAUSED || state === STATE.OVER) {
      mount(currentGameId, activeDifficulty);
    }
  }

  function togglePause() {
    if (state === STATE.PLAYING) {
      state = STATE.PAUSED;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      el('overlay').classList.remove('hidden');
      el('overlayIcon').textContent = '⏸';
      el('overlayTitle').textContent = 'Paused';
      el('overlaySub').textContent = 'Take a breath. Resume when ready.';
      el('overlayPrimaryBtn').textContent = '▶  Resume';
      el('overlayPrimaryBtn').onclick = resumePlaying;
      el('overlaySecondaryBtn').classList.remove('hidden');
      el('overlaySecondaryBtn').textContent = '↻ Restart';
      el('overlaySecondaryBtn').onclick = () => mount(currentGameId, activeDifficulty);
    } else if (state === STATE.PAUSED) {
      resumePlaying();
    }
  }

  function resumePlaying() {
    state = STATE.PLAYING;
    el('overlay').classList.add('hidden');
    loop();
  }

  function handleScore(scoreText) {
    document.getElementById('liveScoreLine').textContent = scoreText;
  }

  function handleEnd(result) {
    // result: { score, won, meta, scoreKey }
    // scoreKey lets a game record its score under a different bucket than
    // its own gameId — e.g. Snake's Xenzia mode uses 'snake-xenzia' so it
    // tracks a separate high score from regular Snake, since it's a mode
    // toggle rather than a difficulty level and shouldn't share one.
    const scoreGameId = result.scoreKey || currentGameId;
    state = STATE.OVER;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    document.getElementById('pauseBtn').classList.add('hidden');
    document.getElementById('restartBtn').classList.add('hidden');

    const isNewBest = window.Arcade.Scores.submit(scoreGameId, activeDifficulty, result.score || 0);
    if (result.won) window.Arcade.Stats.recordWin(currentGameId);
    if (currentGame.onGameEnd) currentGame.onGameEnd(result, { difficulty: activeDifficulty });
    if (window.Arcade.Sound) window.Arcade.Sound.play(result.won ? 'win' : 'gameOver');

    const overlay = el('overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('overlay--over');
    el('overlayIcon').textContent = isNewBest ? '🎉' : (result.won ? '🏆' : '💀');
    el('overlayTitle').textContent = isNewBest ? 'New Best!' : (result.title || (result.won ? 'You win!' : 'Game over'));
    el('overlayTitle').classList.toggle('overlay-title--celebrate', !!isNewBest);
    let sub = `Score ${formatScore(result.score || 0)}`;
    if (!isNewBest) sub += `  ·  Best ${formatScore(window.Arcade.Scores.get(scoreGameId, activeDifficulty))}`;
    else if (result.title) sub = `${result.title}  ·  ${sub}`;
    el('overlaySub').textContent = sub;
    el('overlayPrimaryBtn').textContent = '↻  Play again';
    el('overlayPrimaryBtn').onclick = beginCountdown;
    el('overlaySecondaryBtn').classList.remove('hidden');
    el('overlaySecondaryBtn').textContent = '⇄ Change difficulty';
    el('overlaySecondaryBtn').onclick = showReadyOverlay;
    if (isNewBest && window.Arcade.Sound) window.Arcade.Sound.play('achievement');

    updateBestScoreLine(currentGameId, scoreGameId);

    if (window.Arcade.onRoundEnd) window.Arcade.onRoundEnd();
  }

  function updateBestScoreLine(gameId, scoreKey) {
    const key = scoreKey || gameId;
    const game = GAMES[gameId];
    const label = (game && game.supportsDifficulty)
      ? `Best (${activeDifficulty}): ${formatScore(window.Arcade.Scores.get(key, activeDifficulty))}`
      : `Best: ${formatScore(window.Arcade.Scores.getBest(key))}`;
    document.getElementById('bestScoreLine').textContent = label;
  }

  function formatScore(n) {
    return typeof n === 'number' ? n.toLocaleString() : n;
  }

  /* ---------- Difficulty picker ---------- */

  function renderDifficultyPicker() {
    const wrap = el('difficultyPicker');
    if (!currentGame.supportsDifficulty) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    wrap.innerHTML = '';
    ['easy', 'normal', 'hard'].forEach(level => {
      const btn = document.createElement('button');
      btn.className = 'diff-btn' + (level === activeDifficulty ? ' is-active' : '');
      btn.textContent = level;
      btn.addEventListener('click', () => {
        if (window.Arcade.Sound) window.Arcade.Sound.play('click');
        activeDifficulty = level;
        window.Arcade.Settings.set({ difficulty: level });
        mount(currentGameId, level);
      });
      wrap.appendChild(btn);
    });
  }

  /* ---------- Mobile touch controls ---------- */

  function renderTouchControls() {
    const layer = el('touchControls');
    layer.innerHTML = '';
    layer.classList.toggle('hidden', !currentGame.touchControls);
    if (!currentGame.touchControls) return;

    const usesGrid = currentGame.touchControls.some(c => c.group === 'grid' || c.group === 'grid-action');
    const usesGroups = !usesGrid && currentGame.touchControls.some(c => c.group);
    layer.classList.toggle('touch-controls--padded', usesGroups);
    layer.classList.toggle('touch-controls--grid-layout', usesGrid);

    let moveCluster = null, actionCluster = null, numGrid = null, gridActions = null;
    if (usesGroups) {
      moveCluster = document.createElement('div');
      moveCluster.className = 'dpad-cluster';
      actionCluster = document.createElement('div');
      actionCluster.className = 'action-cluster';
      layer.appendChild(moveCluster);
      layer.appendChild(actionCluster);
    } else if (usesGrid) {
      numGrid = document.createElement('div');
      numGrid.className = 'numpad-grid';
      gridActions = document.createElement('div');
      gridActions.className = 'numpad-actions';
      layer.appendChild(numGrid);
      layer.appendChild(gridActions);
    }

    currentGame.touchControls.forEach(ctrl => {
      const btn = document.createElement('button');
      btn.className = 'touch-btn touch-btn--' + ctrl.slot;
      btn.setAttribute('aria-label', ctrl.label);
      btn.textContent = ctrl.icon;
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); ctrl.onDown && ctrl.onDown(); });
      btn.addEventListener('pointerup', (e) => { e.preventDefault(); ctrl.onUp && ctrl.onUp(); });
      btn.addEventListener('pointerleave', (e) => { ctrl.onUp && ctrl.onUp(); });

      if (ctrl.group === 'move') moveCluster.appendChild(btn);
      else if (ctrl.group === 'action') actionCluster.appendChild(btn);
      else if (ctrl.group === 'grid') numGrid.appendChild(btn);
      else if (ctrl.group === 'grid-action') gridActions.appendChild(btn);
      else layer.appendChild(btn);
    });
  }

  return { init, mount, unmount, togglePause, restart, getCanvas, getCtx, getState, getDifficulty, shake, flash, vibrate, STATE };
})();

window.Arcade.Shell = Shell;
