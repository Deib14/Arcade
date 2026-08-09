# Corner Arcade — Roadmap

A running plan for where this project is and where it's headed. Update this file as things ship or priorities change — treat it as the single source of truth, not the chat history.

---

## Status: v2.8 — in progress (per-game improvement pass, ongoing)

### This pass, continued — Tetris and Flappy Bird (reprioritized high)
- [x] **Tetris**: lock delay (500ms grace window to slide/rotate a landed piece before it locks, capped at 15 resets to prevent infinite stalling), combo scoring (consecutive line clears build a streak bonus, resets on any non-clearing lock — verified the counter logic against the guideline convention with a standalone trace), a subtle flicker on the active piece while lock delay counts down so the new "doesn't lock instantly" behavior reads as intentional rather than broken. Caught and fixed a real bug before shipping: `spawnPiece()` wasn't resetting the lock-delay/reset-count state for a freshly spawned piece, which could have let a new piece inherit a stale reset budget from the previous one.
- [x] **Flappy Bird**: parallax background (clouds → buildings → ground, each layer scrolling at a different fraction of pipe speed), bird skins (bronze/silver/gold) that unlock through the existing medal achievements rather than a separate unlock system, cycled with the S key. Refactored out significant duplicated rendering code in the process — the pipe/bird drawing logic previously existed twice (once for the idle frame, once inline in the tick loop), consolidated into one shared `drawScene()`. Caught a leftover dead parameter from the refactor (`speedFraction`, declared but never used) before it could confuse future edits.

### This pass so far — per-game gameplay improvements
Working through the full game list applying research-backed and requested improvements, one game at a time, each fully verified (syntax + logic simulation + cross-reference sweep) before moving on. AI-opponent work (Pong difficulty tiers) explicitly paused per direction — this pass is scoped to improving existing mechanics, not adding opponents.

- [x] **Sudoku** — new 12th game. Verified backtracking generator + solution-counting solver (confirmed every puzzle has exactly one solution before shipping), pencil marks/notes as a first-class feature, conflict highlighting, dedicated numpad touch layout (needed a real shell extension — the existing two-cluster D-pad couldn't fit 9 digit buttons on a phone screen).
- [x] **Cross-game UI/UX**: quick restart button in the toolbar (previously restart needed pause→restart, two steps), redesigned "New Best!" celebration with a pulsing glow shown at the shell level so all 12 games get it free, measured and fixed a real mobile overflow issue (~144px on a small phone for Sudoku's numpad, cut to ~66px), and a general "Played N times · Won N (X%)" stats line on every game's ready screen.
- [x] **Minesweeper** — added chording (tap a revealed number with the correct flag count to auto-clear its neighbors), confirmed via research as essential, not optional. Traced the flood-fill interaction to confirm chording can never accidentally cascade into a mine.
- [x] **Breakout** — brick types (normal / reinforced 2-hit with a visible crack / unbreakable), a wider-paddle power-up drop (~12% chance per breakable brick destroyed). Verified via simulation that the board can never soft-lock even if every top-row brick unluckily rolls unbreakable.
- [x] **Snake** — smooth interpolated movement (game logic tick completely unchanged, only rendering interpolates between ticks — the standard low-risk approach), special food (bonus +5, temporary speed boost), wraparound mode toggle (M key or on-screen button) alongside classic walls. Caught and fixed three real bugs during this one game alone: a self-inflicted syntax error from a botched edit, a backwards speed-restore calculation that would have silently undone legitimate progression, and a wrap-teleport visual bug that my first fix only solved for the head segment, not trailing body segments.
- [x] **Dino Run** — flying obstacles requiring duck (Down arrow / drag-down / hold), cactus size variety (small/medium/tall), day/night cycle tied to score, and a shield power-up that absorbs one hit. Traced the jump-vs-duck physics frame-by-frame to confirm a *reactive* jump can't reliably clear a flying obstacle (duck is the real answer), while an anticipatory early jump can — same skill ceiling as the real Chrome Dino game, confirmed deliberately rather than left as an unexamined edge case.
- [ ] **Next up:** Space Invaders (last of the three reprioritized-high items). Then: 2048, Pong, Memory Match, Whack-a-Mole.

### v2.5 — shipped
- [x] **Haptics** — `Shell.vibrate(pattern)`, gated by its own settings toggle and `navigator.vibrate` feature detection (silently no-ops on desktop/iOS Safari, which don't support it). Wired into every impact moment that already had screen shake: death/hit in Flappy, Dino, Snake, Tetris, Invaders; explosions in Minesweeper and Whack-a-Mole; a 4-line Tetris clear; and a light confirming buzz on achievement unlock, distinct from the damage patterns.
- [x] **Screen shake made independently optional** — new "Screen shake" toggle in Settings, separate from the existing "Animations" toggle. `Shell.shake()` now checks its own setting before firing; `Shell.flash()` (the red damage flash) intentionally stays under the broader "Animations" toggle instead, since a shaking screen is the classic vestibular-sensitivity trigger and a color flash is a different kind of effect — someone can turn off shake specifically while keeping other motion, or vice versa.
- [x] The "Vibration" row in Settings only renders when `navigator.vibrate` actually exists on the device, rather than showing a dead toggle on unsupported platforms.
- [x] Fixed a stale settings description left over from before sound shipped ("Reserved for a future update — no sounds yet" on the sound toggle, which had been sitting there inaccurately since v2.4).
- [x] Full cross-reference sweep extended to cover the new `Shell.vibrate` export and every `Settings` key referenced anywhere in the codebase (both `.set()` calls and direct `.get().X` access) against `DEFAULT_SETTINGS` — confirmed no dangling references before shipping.

### v2.4 — shipped
- [x] **Sound** — every game now has synthesized SFX via the Web Audio API (`js/core/sound.js`), no audio files shipped or fetched. ~25 named sounds covering flap/jump/hit/score/eat/bounce/rotate/drop/shoot/explosions/etc, plus shell-level countdown beeps, a "go" cue, win/game-over chords, and an achievement-unlock chime. Respects the sound toggle in Settings, which had existed since v2.0 but never actually did anything until now.
- [x] **Screen shake + red flash** — `Shell.shake()` / `Shell.flash()`, triggered on death/hit/mine-explosion moments across Flappy, Dino, Snake, Breakout, Minesweeper, Tetris, Space Invaders, and Whack-a-Mole. Shared at the shell level so any future game gets it for free by calling the same two functions.
- [x] **5 real bugs found and fixed**, each verified with a standalone simulation before trusting the fix rather than just reading the code and assuming it was right:
  - Dino Run: obstacle spawn timing used `frame % (a divisor that changes over time)`, which produced a visible pacing hiccup — a sudden short gap — every time game speed crossed a threshold. Replaced with an explicit countdown-to-next-spawn.
  - Snake: the classic reversal exploit. Direction changes were validated against the *already-applied* direction instead of the *pending* one, so two rapid keypresses between ticks could queue an illegal 180° turn that read as legal, causing random unfair deaths. Fixed in both the keyboard and swipe-gesture handlers.
  - Breakout: the ball's hitbox can genuinely overlap two adjacent bricks in the same frame (confirmed with a geometry check, not assumed) — the old collision loop destroyed both and double-reversed the ball's vertical direction, which cancels back to no bounce at all. Fixed by resolving only the first brick hit per frame. Also deleted dead, unreachable achievement-check code that was left behind from an earlier version.
  - Memory Match: the mismatch-recovery timer (the 700ms delay before flipping wrong guesses back down) was never tracked or cleared on teardown, unlike its sibling peek-timer. A player backing out mid-mismatch could leave it running past the game's lifetime. Fixed by tracking and clearing it the same way.
  - Service worker precache gap: `sound.js` — a genuine runtime dependency for every game as of this release — wasn't in the offline precache list. Caught during the routine validation sweep, not before; fixed and cache version bumped so it doesn't ship broken to PWA users specifically, who are the exact audience that would have hit it.
- [x] Audited every game's `setTimeout`/`setInterval` usage against its `teardown()` coverage as a full sweep, not just spot-checking the one bug found — confirmed one additional stale-timer case in Whack-a-Mole is provably harmless (closure references a discarded object that can't affect new-game state) rather than assuming it away.

### v2.3 — shipped
- [x] **Space Invaders** added — 11th game. Classic grid-march alien AI (whole formation moves as one unit, reverses and steps down on hitting a wall, speeds up slightly with every drop), destructible shields, single-shot-at-a-time player fire, wave progression that resets the board but keeps score and lives
- [x] Reused Tetris's grouped touch-control layout (move left/right + fire), validating that the shell's two-cluster pattern generalizes to a second game as intended
- [x] 3 new Space Invaders achievements (clear the first wave, clear 3 waves in one run, clear any wave without losing a life) — registry is now 34 achievements total
- [x] Difficulty maps to alien speed, alien fire rate, bullet speed, formation step-down distance, and starting lives
- [x] Caught and fixed two real bugs before shipping: an instant-chain-death bug where a formation that reached the player's row and cost a life would immediately trigger the same loss condition again on the very next frame (fixed by pulling the formation back when a life is lost, not just resetting the player); and an achievement-scoping bug where "clear a wave without losing a life" only ever checked on the first wave instead of every wave, which didn't match its own description

### v2.2 — shipped
- [x] **Tetris** added — 10th game, most complex build yet. 7-bag randomizer, hold piece, 3-deep next-piece preview, ghost/landing preview, soft drop, hard drop, wall-kick rotation
- [x] Two-cluster on-screen touch controls (movement + rotate on the left, soft/hard drop on the right) — first game needing more than a single tap zone, so the shell's touch-control renderer was extended to support grouped layouts without affecting any existing game
- [x] 3 new Tetris achievements (Tetris via a 4-line clear, 10 lines in one run, 10 lines on Hard difficulty) — registry was 31 achievements at this point
- [x] Difficulty maps to drop speed: start speed, minimum speed, speed ramp per line, and soft-drop speed all scale by level (Easy 900ms→300ms, Normal 700ms→150ms, Hard 500ms→80ms)
- [x] Caught and fixed three real bugs during build before shipping: a line-clear counting bug that mis-tallied cleared rows depending on which rows were full (verified and fixed via standalone simulation, not just read-through), the square piece visually drifting on rotation instead of staying fixed, and a hold-piece loophole that let the first hold of a game chain into a second hold in the same turn

### v2.1 — shipped
- [x] PWA: `sw.js` service worker with cache-first strategy, versioned cache (`corner-arcade-v2.3.0`), auto-eviction of old cache versions on activate
- [x] `js/pwa.js` — registration + "new version ready" update banner instead of a silent swap mid-session
- [x] `manifest.json` scope tightened to `/` to match root-scoped service worker
- [x] **Minesweeper** added — first new solo game since the v2.0 rebuild. Flood-fill reveal, flag via right-click or long-press, first click is always guaranteed safe (mines placed after the opening move, never on or adjacent to it), difficulty maps to grid size and mine density (9×9/10 mines → 12×12/24 → 14×16/44)
- [x] 3 new Minesweeper achievements (clear a board, clear on Hard, clear without ever placing a flag) — registry was 28 achievements at this point

### v2.0 — shipped
- [x] Rebuilt from a single HTML file into a proper multi-file static site
- [x] 8 games: Flappy Bird, Snake, Breakout, 2048, Dino Run, Pong, Memory Match, Whack-a-Mole
- [x] Difficulty levels (Easy / Normal / Hard) on every single-player game, saved per-game
- [x] 24 achievements across onboarding, per-game milestones, and cross-game dedication
- [x] Mobile support: touch/tap/swipe input, responsive layout, safe-area insets for notches, `manifest.json` for "Add to Home Screen"
- [x] Landing page: hero, live stats strip (games played, achievements unlocked, top score), game grid with best-score preview per cabinet
- [x] Settings panel (reduced-motion toggle; sound toggle reserved for when audio ships)
- [x] **Bug fix:** games no longer start the instant you tap Play. A 3-2-1 countdown now plays before any input is live, and Flappy Bird / Dino Run additionally hold off spawning the first pipe/obstacle for about a second past that.

**Structure:**
```
/index.html
/manifest.json
/vercel.json
/sw.js                     — service worker: cache-first, versioned cache, precache list
/css/style.css
/js/core/storage.js        — localStorage wrapper (scores, settings, achievements, stats)
/js/core/sound.js          — synthesized SFX via Web Audio API, no audio files
/js/core/achievements.js   — achievement definitions + unlock/toast logic
/js/core/difficulty.js     — per-game easy/normal/hard presets
/js/core/shell.js          — game runtime: mount/unmount, state machine, countdown, pause, difficulty picker, touch-control layout
/js/games/*.js             — one file per game (11 so far), each self-registers via Arcade.registerGame()
/js/app.js                 — landing page, view switching, achievements/settings panels
/js/pwa.js                 — service worker registration + update-available banner
```

Adding a new game means writing one file in `js/games/` and adding one `<script>` tag — the shell, difficulty system, and achievements hook in automatically as long as the game implements the small interface `shell.js` expects (`init`, `start`, `tick`, optionally `renderIdleFrame`/`teardown`/`onGameEnd`). Games needing more than a simple tap-anywhere or single-button control (see Tetris) can supply a `touchControls` array with an optional `group: 'move' | 'action'` on each button to get the two-cluster D-pad layout instead of a flat row.

New game files also need adding to `sw.js`'s precache list (with the cache version bumped) so they're available offline immediately rather than only after the user has been online once post-update.

---

## Deploying to Vercel

This is a static site — no build step.

1. Push this folder to a GitHub repo (or `vercel --prod` directly from the folder with the Vercel CLI).
2. In Vercel: **New Project → Import** the repo. Framework preset: **Other** (or "Static"). No build command needed, output directory is the project root.
3. Done. `vercel.json` is already set up with basic cache headers for JS/CSS.

Custom domain, if you want one: add it under Project Settings → Domains once the first deploy is live.

---

## Next up

### Solo games to add next
Everything below is single-player — no shared-keyboard or pass-and-play games, since the ask is for things one person can pick up and play alone. Each is a self-contained file in `js/games/`, low risk to add without touching the shell. Minesweeper, Tetris, and Space Invaders are the templates to follow for the rest — Space Invaders in particular is now the second confirmation that the grouped touch-control pattern generalizes cleanly to a new game, not just a one-off for Tetris.

- [ ] **Simon Says** — reflex + memory, similar shape to Memory Match, no partner needed. Next logical pick — smallest scope of what's left, good palate-cleanser after two complex builds in a row.
- [ ] **2048-style "Threes"-clone variant** or a second puzzle like **Sudoku** — optional stretch if 2048 + Minesweeper alone feel thin in the puzzle category.
- [ ] **Endless runner variant** (e.g. a side-scrolling jetpack/flappy hybrid) — reuses a lot of the Flappy/Dino scaffolding, cheap to build once those two exist as reference.

Pong stays as the one exception — it's already shipped and works fine as a local 2-player game, just not being expanded further with more multiplayer titles for now.

### Near-term polish
- [ ] **Share score** — "I scored 42 in Flappy Bird" via the Web Share API on mobile, clipboard copy on desktop.
- [ ] **Keyboard focus states** — audit tab order through the grid, overlay buttons, and panels for visible focus rings (partly done via `:focus-visible` on `.cab`, needs extending to buttons/toggles).
- [ ] **Per-game animation polish beyond the shared shake/flash** — e.g. brick-break particle burst in Breakout, a tile-merge pop/scale in 2048, a card-flip 3D rotation in Memory Match rather than an instant swap. The shared shake/flash covers impact moments; these would be per-game delight moments, lower priority than new games.

### Systems work
- [ ] **Stages/levels for existing games** — right now difficulty is a flat easy/normal/hard multiplier. A "stages" mode (e.g. Breakout with hand-designed brick layouts per level, Dino Run with distinct biomes/backgrounds at score thresholds) would need:
  - A `stages.js` config file (parallel to `difficulty.js`) defining stage data per game
  - Shell changes to advance stage on a per-game "stage complete" signal rather than only ending the run
  - This is the single biggest scope item on this list — worth scoping as its own mini-project per game rather than one big pass
- [ ] **Global leaderboard** — currently all scores are `localStorage`, single-device only. Would need a backend (Vercel KV, Supabase, or similar) plus a lightweight name/handle system. Bigger decision: do we want accounts at all, or anonymous device-tagged high scores?
- [ ] **Achievement categories/filtering** — the registry started at 24 and is now at 34 across 11 games; once it grows past ~45-50, the panel should group by game or add a "locked/unlocked" filter rather than staying one long scrolling list.

### Nice-to-haves / later
- [ ] Daily challenge (seeded run, same board for everyone that day)
- [ ] Theming — a second visual skin (e.g. light "diner" theme) toggleable in Settings, to prove the CSS variables are actually decoupled from game logic
- [ ] Analytics-free usage insight — a simple "games played this week" personal stat, computed client-side from existing `Stats`, no tracking involved

---

## Known limitations (by design, not bugs)
- Scores and achievements are per-browser/per-device (`localStorage`). Clearing site data resets everything. This is intentional for now — a backend is a deliberate later step, not an oversight.
- Sound is synthesized (Web Audio oscillators/noise), not sampled — it's deliberately simple 8-bit-style SFX, not music or recorded sound effects. That's a design choice for zero asset weight, not a limitation to fix.
- Pong is local 2-player only (shared keyboard); no online multiplayer planned, and no further multiplayer titles are planned while the focus is on solo games.
- Offline caching is live as of v2.1, but only for what's precached in `sw.js`. Any brand-new game file added later needs to be added to that precache list (and the cache version bumped) or it won't be available offline until the user's been online once since the update.
