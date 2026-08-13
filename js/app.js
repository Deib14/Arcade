/* ============================================================
   Corner Arcade — app.js
   Landing page + view switching + achievements panel + settings.
   Runs after all core/*.js and games/*.js have registered.
   ============================================================ */

(function () {
  const CATALOG = [
    { id: 'flappy',   accent: '#ffb000', bg: '#1a1206', tag: 'Arcade' },
    { id: 'snake',    accent: '#35e0d0', bg: '#06181a', tag: 'Classic' },
    { id: 'breakout', accent: '#ff3d7f', bg: '#1a0612', tag: 'Arcade' },
    { id: '2048',     accent: '#9d7cff', bg: '#120a1a', tag: 'Puzzle' },
    { id: 'dino',     accent: '#8bd450', bg: '#0a150a', tag: 'Runner' },
    { id: 'pong',     accent: '#5fb0ff', bg: '#060f1a', tag: '2 Player' },
    { id: 'memory',   accent: '#c48bff', bg: '#150a1e', tag: 'Puzzle' },
    { id: 'whack',    accent: '#ff8a3d', bg: '#1a1006', tag: 'Reflex' },
    { id: 'minesweeper', accent: '#5fb0ff', bg: '#0a1420', tag: 'Puzzle' },
    { id: 'tetris',   accent: '#c48bff', bg: '#0d0a16', tag: 'Puzzle' },
    { id: 'invaders', accent: '#ff3d7f', bg: '#050912', tag: 'Arcade' },
    { id: 'sudoku',   accent: '#5db0ff', bg: '#0c0a16', tag: 'Puzzle' },
    { id: 'spaceImpact', accent: '#5fb0ff', bg: '#050815', tag: 'Arcade' },
    { id: 'bounce',   accent: '#ff3d3d', bg: '#0a0f1c', tag: 'Platformer' },
  ];

  function el(id) { return document.getElementById(id); }

  function renderGrid() {
    const grid = el('grid');
    grid.innerHTML = '';
    CATALOG.forEach(entry => {
      const game = window.Arcade.GAMES[entry.id];
      if (!game) return;
      const card = document.createElement('button');
      card.className = 'cab';
      card.style.setProperty('--accent', entry.accent);
      card.style.setProperty('--screen-bg', entry.bg);
      card.setAttribute('data-game', entry.id);

      const best = window.Arcade.Scores.getBest(entry.id);
      const bestLine = best > 0 ? `Best ${best.toLocaleString()}` : 'Not played yet';

      card.innerHTML = `
        <span class="cab-tag">${entry.tag}</span>
        <div class="cab-screen">${game.icon}</div>
        <div class="cab-title">${game.title}</div>
        <div class="cab-sub">${game.tagline}</div>
        <div class="cab-best">${bestLine}</div>
      `;
      card.addEventListener('click', () => openGame(entry.id));
      grid.appendChild(card);
    });
  }

  function openGame(gameId) {
    el('landing').classList.add('hidden');
    el('gameView').classList.remove('hidden');
    document.body.classList.add('is-playing');
    window.Arcade.Shell.mount(gameId);
    history.replaceState(null, '', '#' + gameId);
  }

  function closeGame() {
    window.Arcade.Shell.unmount();
    el('gameView').classList.add('hidden');
    el('landing').classList.remove('hidden');
    document.body.classList.remove('is-playing');
    history.replaceState(null, '', '#');
    renderGrid(); // refresh best-score lines
    renderHeroStats();
  }

  /* ---------- Achievements panel ---------- */

  function renderAchievements() {
    const list = el('achievementsList');
    list.innerHTML = '';
    const unlocked = window.Arcade.Achievements.unlocked();
    const count = Object.keys(unlocked).length;
    el('achievementsCount').textContent = `${count} / ${window.Arcade.ACHIEVEMENTS.length}`;

    window.Arcade.ACHIEVEMENTS.forEach(a => {
      const isUnlocked = !!unlocked[a.id];
      const row = document.createElement('div');
      row.className = 'achievement-row' + (isUnlocked ? ' is-unlocked' : '');
      row.innerHTML = `
        <div class="achievement-row__icon">${isUnlocked ? a.icon : '🔒'}</div>
        <div class="achievement-row__body">
          <div class="achievement-row__name">${a.name}</div>
          <div class="achievement-row__desc">${a.desc}</div>
        </div>
      `;
      list.appendChild(row);
    });
  }

  function toggleAchievementsPanel(show) {
    el('achievementsPanel').classList.toggle('hidden', !show);
    el('achievementsBackdrop').classList.toggle('hidden', !show);
    if (show) renderAchievements();
  }

  /* ---------- Settings panel ---------- */

  function renderSettings() {
    const s = window.Arcade.Settings.get();
    el('soundToggle').checked = s.sound;
    el('motionToggle').checked = !s.reducedMotion;
    el('shakeToggle').checked = s.screenShake;
    el('hapticsToggle').checked = s.haptics;
    el('hapticsRow').classList.toggle('hidden', !('vibrate' in navigator));
  }

  function toggleSettingsPanel(show) {
    el('settingsPanel').classList.toggle('hidden', !show);
    el('settingsBackdrop').classList.toggle('hidden', !show);
    if (show) renderSettings();
  }

  /* ---------- Wire up ---------- */

  function bindEvents() {
    el('backBtn').addEventListener('click', closeGame);
    el('brandBtn').addEventListener('click', () => {
      if (!el('gameView').classList.contains('hidden')) closeGame();
    });
    el('pauseBtn').addEventListener('click', () => window.Arcade.Shell.togglePause());
    el('restartBtn').addEventListener('click', () => window.Arcade.Shell.restart());

    el('achievementsBtn').addEventListener('click', () => toggleAchievementsPanel(true));
    el('achievementsCloseBtn').addEventListener('click', () => toggleAchievementsPanel(false));

    el('settingsBtn').addEventListener('click', () => toggleSettingsPanel(true));
    el('settingsCloseBtn').addEventListener('click', () => toggleSettingsPanel(false));

    el('soundToggle').addEventListener('change', (e) => window.Arcade.Settings.set({ sound: e.target.checked }));
    el('motionToggle').addEventListener('change', (e) => {
      window.Arcade.Settings.set({ reducedMotion: !e.target.checked });
      applyReducedMotion();
    });

    el('shakeToggle').addEventListener('change', (e) => {
      window.Arcade.Settings.set({ screenShake: e.target.checked });
    });

    el('hapticsToggle').addEventListener('change', (e) => {
      window.Arcade.Settings.set({ haptics: e.target.checked });
    });

    document.querySelectorAll('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', () => {
        toggleAchievementsPanel(false);
        toggleSettingsPanel(false);
      });
    });
  }

  function applyReducedMotion() {
    const s = window.Arcade.Settings.get();
    document.documentElement.classList.toggle('reduced-motion', !!s.reducedMotion);
  }

  function renderHeroStats() {
    el('statGames').textContent = CATALOG.length;
    el('statAchievements').textContent = `${window.Arcade.Achievements.count()}/${window.Arcade.ACHIEVEMENTS.length}`;
    const allScores = window.Arcade.Scores.all();
    let topEntry = null;
    Object.keys(allScores).forEach(gameId => {
      Object.values(allScores[gameId]).forEach(v => {
        if (topEntry === null || v > topEntry) topEntry = v;
      });
    });
    el('statBest').textContent = topEntry === null ? '—' : topEntry.toLocaleString();
  }

  window.Arcade.onRoundEnd = function () {
    // achievement panel badge + hero stats can change mid-session
    el('statAchievements').textContent = `${window.Arcade.Achievements.count()}/${window.Arcade.ACHIEVEMENTS.length}`;
  };

  function boot() {
    window.Arcade.Shell.init();
    renderGrid();
    renderHeroStats();
    bindEvents();
    applyReducedMotion();

    const hash = location.hash.replace('#', '');
    if (hash && window.Arcade.GAMES[hash]) openGame(hash);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
