/* ============================================================
   Corner Arcade — achievements.js
   Achievement definitions + the toast notification that fires
   when one unlocks. Games call Arcade.checkAchievement(id) or
   Arcade.evaluateAchievements(context) after key events.
   ============================================================ */

const ACHIEVEMENTS = [
  // --- Onboarding ---
  { id: 'first_boot',      name: 'Coin Inserted',     desc: 'Open Corner Arcade for the first time.',            icon: '🪙' },
  { id: 'first_game',      name: 'Warming Up',        desc: 'Play any game once.',                               icon: '🎮' },
  { id: 'try_five',        name: 'Cabinet Hopper',    desc: 'Try 5 different games.',                            icon: '🕹️' },
  { id: 'try_all',         name: 'Full House',        desc: 'Try every game in the arcade.',                     icon: '🏛️' },

  // --- Flappy Bird ---
  { id: 'flappy_10',       name: 'Bronze Wings',      desc: 'Score 10 in Flappy Bird.',                          icon: '🥉' },
  { id: 'flappy_25',       name: 'Silver Wings',      desc: 'Score 25 in Flappy Bird.',                          icon: '🥈' },
  { id: 'flappy_50',       name: 'Gold Wings',        desc: 'Score 50 in Flappy Bird.',                          icon: '🥇' },
  { id: 'flappy_hard',     name: 'Storm Flyer',       desc: 'Beat Hard difficulty in Flappy Bird.',              icon: '⛈️' },

  // --- Snake ---
  { id: 'snake_10',        name: 'Growing Pains',     desc: 'Reach length 10 in Snake.',                         icon: '🐍' },
  { id: 'snake_25',        name: 'Long Boi',          desc: 'Reach length 25 in Snake.',                         icon: '🐍' },
  { id: 'snake_hard',      name: 'Speed Demon',       desc: 'Beat Hard difficulty in Snake.',                    icon: '💨' },

  // --- Breakout ---
  { id: 'breakout_clear',  name: 'Wall Breaker',      desc: 'Clear a full board in Breakout.',                   icon: '🧱' },
  { id: 'breakout_noloss', name: 'Untouchable',       desc: 'Clear a board without losing a life.',              icon: '🛡️' },
  { id: 'breakout_hard',   name: 'Demolition Crew',   desc: 'Beat Hard difficulty in Breakout.',                 icon: '💥' },

  // --- 2048 ---
  { id: '2048_win',        name: 'Two Thousand Forty-Eight', desc: 'Reach the 2048 tile.',                       icon: '🔢' },
  { id: '2048_4096',       name: 'Overachiever',      desc: 'Reach the 4096 tile.',                              icon: '🔢' },

  // --- Dino Run ---
  { id: 'dino_50',         name: 'Desert Sprinter',   desc: 'Score 50 in Dino Run.',                             icon: '🦖' },
  { id: 'dino_150',        name: 'Extinction Event',  desc: 'Score 150 in Dino Run.',                            icon: '☄️' },
  { id: 'dino_shield',     name: 'Shielded',          desc: 'Survive a hit using a shield in Dino Run.',         icon: '🛡️' },

  // --- Pong ---
  { id: 'pong_win',        name: 'Table Tennis Pro',  desc: 'Win a match of Pong.',                              icon: '🏓' },
  { id: 'pong_shutout',    name: 'Shutout',           desc: 'Win a Pong match without conceding a point.',       icon: '🥇' },
  { id: 'pong_marathon',   name: 'Marathon Match',    desc: 'Play a Pong match to 21.',                          icon: '⏱️' },

  // --- Memory Match ---
  { id: 'memory_win',      name: 'Sharp Memory',      desc: 'Clear a round of Memory Match.',                    icon: '🧠' },
  { id: 'memory_perfect',  name: 'Photographic',      desc: 'Clear Memory Match with no wrong guesses.',         icon: '📸' },

  // --- Whack-a-Mole ---
  { id: 'whack_20',        name: 'Pest Control',      desc: 'Score 20 in Whack-a-Mole.',                         icon: '🔨' },

  // --- Minesweeper ---
  { id: 'mine_clear',      name: 'Bomb Squad',        desc: 'Clear a Minesweeper board.',                        icon: '💣' },
  { id: 'mine_hard',       name: 'Nerves of Steel',   desc: 'Clear a Hard Minesweeper board.',                   icon: '🎖️' },
  { id: 'mine_flagless',   name: 'No Flags Needed',   desc: 'Clear a board without placing a single flag.',      icon: '🚩' },

  // --- Tetris ---
  { id: 'tetris_4lines',   name: 'Tetris!',           desc: 'Clear 4 lines at once.',                            icon: '🟦' },
  { id: 'tetris_10lines',  name: 'Line Cook',         desc: 'Clear 10 lines total in one run.',                  icon: '📏' },
  { id: 'tetris_hard',     name: 'Terminal Velocity', desc: 'Clear 10 lines on Hard difficulty in Tetris.',      icon: '⚡' },
  { id: 'tetris_combo',    name: 'Chain Reaction',   desc: 'Clear lines in 4 consecutive drops (a x4 combo).',   icon: '🔗' },

  // --- Space Invaders ---
  { id: 'invaders_wave1',  name: 'First Contact',     desc: 'Clear the first wave in Space Invaders.',           icon: '👾' },
  { id: 'invaders_wave3',  name: 'Fleet Commander',   desc: 'Clear 3 waves in one run.',                         icon: '🛸' },
  { id: 'invaders_noloss', name: 'Untouched',         desc: 'Clear a wave without losing a life.',               icon: '🛡️' },
  { id: 'invaders_boss',   name: 'Boss Slayer',       desc: 'Defeat a boss wave.',                               icon: '👑' },
  { id: 'invaders_rapidfire', name: 'Locked and Loaded', desc: 'Pick up a Rapid Fire power-up.',                 icon: '🔥' },

  // --- Sudoku ---
  { id: 'sudoku_easy',     name: 'Numbers Game',      desc: 'Complete a Sudoku puzzle.',                         icon: '🔷' },
  { id: 'sudoku_hard',     name: 'Grid Master',       desc: 'Complete a Hard Sudoku puzzle.',                    icon: '🧩' },
  { id: 'sudoku_noerrors', name: 'Flawless Logic',    desc: 'Complete a puzzle without a single wrong entry.',   icon: '✨' },
  { id: 'sudoku_nonotes',  name: 'Mental Math',       desc: 'Complete a puzzle without using notes.',            icon: '🧠' },

  // --- Space Impact ---
  { id: 'impact_level1',   name: 'Cleared for Launch', desc: 'Beat the first level boss in Space Impact.',       icon: '🚀' },
  { id: 'impact_level3',   name: 'Deep Space',         desc: 'Reach level 3 in Space Impact.',                   icon: '🌌' },
  { id: 'impact_special',  name: 'Locked On',          desc: 'Destroy an enemy with a special weapon.',          icon: '🎯' },
  { id: 'impact_noscratch', name: 'Untouchable Pilot', desc: 'Beat a level boss without taking damage.',         icon: '🛡️' },

  // --- Bounce ---
  { id: 'bounce_level1',   name: 'First Bounce',      desc: 'Clear a level in Bounce.',                          icon: '🔴' },
  { id: 'bounce_level3',   name: 'Ring Collector',    desc: 'Clear 3 levels in Bounce.',                         icon: '💍' },
  { id: 'bounce_allrings', name: 'Perfectionist',     desc: 'Collect every ring in a level without missing one.', icon: '✨' },
  { id: 'bounce_noloss',   name: 'Steady Roll',       desc: 'Clear a level without losing a life.',              icon: '🎯' },

  // --- Cross-game / dedication ---
  { id: 'plays_10',        name: 'Regular',           desc: 'Play 10 rounds total, any game.',                   icon: '⭐' },
  { id: 'plays_50',        name: 'Arcade Rat',        desc: 'Play 50 rounds total, any game.',                   icon: '🌟' },
  { id: 'all_hard',        name: 'Hardcore',          desc: 'Beat Hard difficulty in 3 different games.',        icon: '🔥' },
];

const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

function unlockAchievement(id) {
  const def = ACHIEVEMENT_MAP[id];
  if (!def) return;
  const isNew = window.Arcade.Achievements.unlock(id);
  if (isNew) showAchievementToast(def);
  return isNew;
}

function showAchievementToast(def) {
  if (window.Arcade.Sound) window.Arcade.Sound.play('achievement');
  if (window.Arcade.Shell) window.Arcade.Shell.vibrate([20, 40, 20]);
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <div class="achievement-toast__icon">${def.icon}</div>
    <div class="achievement-toast__body">
      <div class="achievement-toast__label">Achievement unlocked</div>
      <div class="achievement-toast__name">${def.name}</div>
      <div class="achievement-toast__desc">${def.desc}</div>
    </div>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 400);
  }, 4200);
}

function getToastContainer() {
  let el = document.getElementById('achievementToasts');
  if (!el) {
    el = document.createElement('div');
    el.id = 'achievementToasts';
    el.className = 'achievement-toast-stack';
    document.body.appendChild(el);
  }
  return el;
}

/* Generic helpers games call after relevant events */

function recordGamePlayed(gameId) {
  const stats = window.Arcade.Stats.recordPlay(gameId);
  unlockAchievement('first_boot');
  unlockAchievement('first_game');
  const triedCount = Object.keys(stats.byGame).length;
  if (triedCount >= 5) unlockAchievement('try_five');
  if (triedCount >= window.Arcade.GAME_COUNT) unlockAchievement('try_all');
  if (stats.totalPlays >= 10) unlockAchievement('plays_10');
  if (stats.totalPlays >= 50) unlockAchievement('plays_50');
}

function recordDifficultyClear(gameId, difficulty) {
  if (difficulty !== 'hard') return;
  const key = 'arcade_v2_hardclears';
  let list = [];
  try { list = JSON.parse(localStorage.getItem(key)) || []; } catch (e) {}
  if (!list.includes(gameId)) list.push(gameId);
  localStorage.setItem(key, JSON.stringify(list));
  if (list.length >= 3) unlockAchievement('all_hard');
}

window.Arcade = window.Arcade || {};
window.Arcade.ACHIEVEMENTS = ACHIEVEMENTS;
window.Arcade.unlockAchievement = unlockAchievement;
window.Arcade.recordGamePlayed = recordGamePlayed;
window.Arcade.recordDifficultyClear = recordDifficultyClear;
