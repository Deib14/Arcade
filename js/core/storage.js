/* ============================================================
   Corner Arcade — storage.js
   Single source of truth for anything persisted to localStorage:
   high scores, achievement unlocks, and user settings.
   ============================================================ */

const STORE_PREFIX = 'arcade_v2_';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    /* storage full or unavailable — fail silently, game still playable */
  }
}

/* ---------- High scores ---------- */
/* stored per game+difficulty: { flappy: { easy: 12, normal: 8, hard: 3 } } */

const Scores = {
  get(game, difficulty) {
    const all = readJSON('scores', {});
    return (all[game] && all[game][difficulty]) || 0;
  },
  getBest(game) {
    const all = readJSON('scores', {});
    const byDiff = all[game] || {};
    return Math.max(0, ...Object.values(byDiff));
  },
  submit(game, difficulty, score) {
    const all = readJSON('scores', {});
    if (!all[game]) all[game] = {};
    const prevBest = all[game][difficulty] || 0;
    const isNewBest = score > prevBest;
    if (isNewBest) all[game][difficulty] = score;
    writeJSON('scores', all);
    return isNewBest;
  },
  all() {
    return readJSON('scores', {});
  }
};

/* ---------- Settings ---------- */

const DEFAULT_SETTINGS = {
  sound: true,
  difficulty: 'normal',   // easy | normal | hard  (default, per-game overrides allowed)
  reducedMotion: false,
  screenShake: true,
  haptics: true
};

const Settings = {
  get() {
    return Object.assign({}, DEFAULT_SETTINGS, readJSON('settings', {}));
  },
  set(patch) {
    const current = Settings.get();
    const next = Object.assign({}, current, patch);
    writeJSON('settings', next);
    return next;
  }
};

/* ---------- Achievements ---------- */
/* Central registry lives in achievements.js — this just tracks unlock state */

const Achievements = {
  unlocked() {
    return readJSON('achievements', {});
  },
  isUnlocked(id) {
    const u = Achievements.unlocked();
    return !!u[id];
  },
  unlock(id) {
    const u = Achievements.unlocked();
    if (u[id]) return false; // already had it
    u[id] = { at: Date.now() };
    writeJSON('achievements', u);
    return true; // newly unlocked
  },
  count() {
    return Object.keys(Achievements.unlocked()).length;
  }
};

/* ---------- Stats (feeds achievement conditions) ---------- */
/* Lightweight counters — total games played, per-game play counts, etc. */

const Stats = {
  get() {
    return readJSON('stats', { totalPlays: 0, byGame: {}, totalScore: 0, winsByGame: {} });
  },
  recordPlay(game) {
    const s = Stats.get();
    s.totalPlays += 1;
    s.byGame[game] = (s.byGame[game] || 0) + 1;
    writeJSON('stats', s);
    return s;
  },
  recordWin(game) {
    const s = Stats.get();
    if (!s.winsByGame) s.winsByGame = {};
    s.winsByGame[game] = (s.winsByGame[game] || 0) + 1;
    writeJSON('stats', s);
    return s;
  },
  addScore(amount) {
    const s = Stats.get();
    s.totalScore += amount;
    writeJSON('stats', s);
    return s;
  }
};

window.Arcade = window.Arcade || {};
window.Arcade.Scores = Scores;
window.Arcade.Settings = Settings;
window.Arcade.Achievements = Achievements;
window.Arcade.Stats = Stats;
