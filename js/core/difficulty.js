/* ============================================================
   Corner Arcade — difficulty.js
   Per-game difficulty presets. Every game reads its own block;
   values are the only thing that changes between games sharing
   the same underlying loop.
   ============================================================ */

const DIFFICULTY_PRESETS = {
  flappy: {
    easy:   { gravity: 0.38, flapVel: -7.6, gap: 190, pipeSpeed: 2.4, spawnGapPx: 260 },
    normal: { gravity: 0.48, flapVel: -8.4, gap: 158, pipeSpeed: 3.0, spawnGapPx: 230 },
    hard:   { gravity: 0.58, flapVel: -9.0, gap: 132, pipeSpeed: 3.8, spawnGapPx: 205 }
  },
  snake: {
    easy:   { startSpeed: 140, minSpeed: 90,  speedStep: 2 },
    normal: { startSpeed: 110, minSpeed: 60,  speedStep: 3 },
    hard:   { startSpeed: 85,  minSpeed: 42,  speedStep: 4 }
  },
  breakout: {
    easy:   { ballSpeed: 3.4, paddleWidth: 110, lives: 4 },
    normal: { ballSpeed: 4.2, paddleWidth: 90,  lives: 3 },
    hard:   { ballSpeed: 5.2, paddleWidth: 72,  lives: 2 }
  },
  dino: {
    easy:   { startSpeed: 5,   gravity: 0.5, spawnEvery: 85, speedRamp: 0.4 },
    normal: { startSpeed: 6,   gravity: 0.6, spawnEvery: 65, speedRamp: 0.6 },
    hard:   { startSpeed: 7.5, gravity: 0.72, spawnEvery: 50, speedRamp: 0.9 }
  },
  '2048': {
    easy:   { target: 2048, fourChance: 0.05 },
    normal: { target: 2048, fourChance: 0.1 },
    hard:   { target: 2048, fourChance: 0.2 }
  },
  memory: {
    easy:   { pairs: 6,  peekMs: 900 },
    normal: { pairs: 8,  peekMs: 650 },
    hard:   { pairs: 10, peekMs: 450 }
  },
  whack: {
    easy:   { roundMs: 40000, moleUpMs: 1100, spawnEvery: 900 },
    normal: { roundMs: 35000, moleUpMs: 800,  spawnEvery: 700 },
    hard:   { roundMs: 30000, moleUpMs: 550,  spawnEvery: 520 }
  },
  minesweeper: {
    easy:   { cols: 9,  rows: 9,  mines: 10 },
    normal: { cols: 12, rows: 12, mines: 24 },
    hard:   { cols: 14, rows: 16, mines: 44 }
  },
  tetris: {
    easy:   { startDropMs: 900, minDropMs: 300, speedupPerLine: 12, softDropMs: 45 },
    normal: { startDropMs: 700, minDropMs: 150, speedupPerLine: 18, softDropMs: 35 },
    hard:   { startDropMs: 500, minDropMs: 80,  speedupPerLine: 24, softDropMs: 25 }
  },
  invaders: {
    easy:   { lives: 4, alienSpeed: 0.6, alienFireMs: 1400, bulletSpeed: 5, stepDown: 14 },
    normal: { lives: 3, alienSpeed: 0.9, alienFireMs: 1000, bulletSpeed: 6, stepDown: 18 },
    hard:   { lives: 2, alienSpeed: 1.3, alienFireMs: 700,  bulletSpeed: 7, stepDown: 22 }
  },
  sudoku: {
    easy:   { clues: 42 },
    normal: { clues: 32 },
    hard:   { clues: 26 }
  }
};

function getDifficultyConfig(gameId, difficulty) {
  const table = DIFFICULTY_PRESETS[gameId];
  if (!table) return {};
  return table[difficulty] || table.normal;
}

window.Arcade = window.Arcade || {};
window.Arcade.getDifficultyConfig = getDifficultyConfig;
window.Arcade.DIFFICULTY_PRESETS = DIFFICULTY_PRESETS;
