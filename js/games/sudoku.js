/* ============================================================
   Sudoku — Corner Arcade
   Generator: randomized backtracking fill, then remove cells one
   at a time while a counting solver confirms the puzzle still has
   exactly one solution — never ships an ambiguous puzzle.
   Notes (pencil marks) are a first-class feature, not an afterthought:
   research on how people actually play sudoku treats them as essential
   from medium difficulty up, so they're available from square one here.
   ============================================================ */

(function () {
  const W = 414, H = 414, pad = 6;
  const cellSize = (W - pad * 2) / 9;

  let puzzle, solution, given; // given[r][c] = true if it was a starting clue (not editable)
  let notes; // notes[r][c] = Set of candidate digits, only relevant on empty/wrong cells
  let selected; // {r, c} or null
  let noteMode;
  let mistakes, usedNotes, cfg;
  let ctxRef, onScore, onEnd;

  /* ---------- Generator (verified standalone before integration) ---------- */

  function isValid(grid, row, col, num) {
    for (let c = 0; c < 9; c++) if (grid[row][c] === num) return false;
    for (let r = 0; r < 9; r++) if (grid[r][col] === num) return false;
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        if (grid[r][c] === num) return false;
      }
    }
    return true;
  }

  function shuffledDigits() {
    const d = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function fillGrid(grid) {
    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9), col = i % 9;
      if (grid[row][col] !== 0) continue;
      for (const num of shuffledDigits()) {
        if (isValid(grid, row, col, num)) {
          grid[row][col] = num;
          if (fillGrid(grid)) return true;
          grid[row][col] = 0;
        }
      }
      return false;
    }
    return true;
  }

  function countSolutions(grid, limit) {
    let count = 0;
    function solve(g) {
      if (count >= limit) return;
      for (let i = 0; i < 81; i++) {
        const row = Math.floor(i / 9), col = i % 9;
        if (g[row][col] !== 0) continue;
        for (let num = 1; num <= 9; num++) {
          if (isValid(g, row, col, num)) {
            g[row][col] = num;
            solve(g);
            g[row][col] = 0;
            if (count >= limit) return;
          }
        }
        return;
      }
      count++;
    }
    solve(grid.map(r => r.slice()));
    return count;
  }

  function generatePuzzle(clueCount) {
    const full = Array.from({ length: 9 }, () => new Array(9).fill(0));
    fillGrid(full);

    const p = full.map(r => r.slice());
    const cells = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) cells.push([r, c]);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    let removed = 0;
    const targetRemoved = 81 - clueCount;
    for (const [r, c] of cells) {
      if (removed >= targetRemoved) break;
      const backup = p[r][c];
      p[r][c] = 0;
      if (countSolutions(p, 2) !== 1) {
        p[r][c] = backup;
      } else {
        removed++;
      }
    }
    return { puzzle: p, solution: full };
  }

  /* ---------- Game state ---------- */

  function resetState(config) {
    cfg = config;
    const { puzzle: p, solution: s } = generatePuzzle(config.clues);
    puzzle = p.map(r => r.slice());
    solution = s;
    given = p.map(row => row.map(v => v !== 0));
    notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    selected = null;
    noteMode = false;
    mistakes = 0;
    usedNotes = false;
  }

  function init({ difficulty }) {
    resetState(window.Arcade.getDifficultyConfig('sudoku', difficulty));
  }

  /* ---------- Rendering ---------- */

  function cellRect(r, c) {
    return { x: pad + c * cellSize, y: pad + r * cellSize, w: cellSize, h: cellSize };
  }

  function isConflict(r, c, val) {
    if (!val) return false;
    for (let cc = 0; cc < 9; cc++) if (cc !== c && puzzle[r][cc] === val) return true;
    for (let rr = 0; rr < 9; rr++) if (rr !== r && puzzle[rr][c] === val) return true;
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let rr = br; rr < br + 3; rr++) {
      for (let cc = bc; cc < bc + 3; cc++) {
        if ((rr !== r || cc !== c) && puzzle[rr][cc] === val) return true;
      }
    }
    return false;
  }

  function draw(ctx) {
    ctx.fillStyle = '#0c0a16';
    ctx.fillRect(0, 0, W, H);

    // highlight selected row/col/box
    if (selected) {
      const { r, c } = selected;
      ctx.fillStyle = 'rgba(93,176,255,0.08)';
      ctx.fillRect(pad, pad + r * cellSize, W - pad * 2, cellSize);
      ctx.fillRect(pad + c * cellSize, pad, cellSize, H - pad * 2);
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      ctx.fillRect(pad + bc * cellSize, pad + br * cellSize, cellSize * 3, cellSize * 3);
    }

    // cells
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const { x, y, w, h } = cellRect(r, c);
        const val = puzzle[r][c];
        const isGiven = given[r][c];
        const isSelected = selected && selected.r === r && selected.c === c;
        const conflict = isConflict(r, c, val);

        if (isSelected) {
          ctx.fillStyle = 'rgba(93,176,255,0.22)';
          ctx.fillRect(x, y, w, h);
        } else if (selected && val && val === puzzle[selected.r][selected.c] && val !== 0) {
          // soft-highlight same-value cells to help the player scan for conflicts
          ctx.fillStyle = 'rgba(93,176,255,0.10)';
          ctx.fillRect(x, y, w, h);
        }

        if (val) {
          ctx.font = `${isGiven ? 'bold ' : ''}${cellSize * 0.52}px monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = conflict ? '#ff3d7f' : (isGiven ? '#e8e4f0' : '#5db0ff');
          ctx.fillText(val, x + w / 2, y + h / 2 + 1);
        } else if (notes[r][c].size > 0) {
          ctx.fillStyle = '#8b86a0';
          ctx.font = `${cellSize * 0.2}px monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          [...notes[r][c]].sort().forEach(n => {
            const nr = Math.floor((n - 1) / 3), nc = (n - 1) % 3;
            ctx.fillText(n, x + nc * (w / 3) + w / 6, y + nr * (h / 3) + h / 6);
          });
        }
      }
    }

    // grid lines — thick every 3 cells, thin otherwise
    for (let i = 0; i <= 9; i++) {
      ctx.strokeStyle = i % 3 === 0 ? '#5a5270' : '#2a2540';
      ctx.lineWidth = i % 3 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(pad + i * cellSize, pad); ctx.lineTo(pad + i * cellSize, H - pad); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, pad + i * cellSize); ctx.lineTo(W - pad, pad + i * cellSize); ctx.stroke();
    }
  }

  function renderIdleFrame({ ctx }) { draw(ctx); }

  /* ---------- Interaction ---------- */

  function isBoardComplete() {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puzzle[r][c] === 0) return false;
    return true;
  }

  function isBoardCorrect() {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puzzle[r][c] !== solution[r][c]) return false;
    return true;
  }

  function placeDigit(digit) {
    if (!selected || given[selected.r][selected.c]) return;
    const { r, c } = selected;

    if (noteMode) {
      usedNotes = true;
      if (notes[r][c].has(digit)) notes[r][c].delete(digit);
      else notes[r][c].add(digit);
      window.Arcade.Sound.play('cardFlip');
      draw(ctxRef);
      return;
    }

    puzzle[r][c] = digit;
    notes[r][c].clear();

    if (digit !== solution[r][c]) {
      mistakes++;
      window.Arcade.Sound.play('cardMiss');
      window.Arcade.Shell.shake();
    } else {
      window.Arcade.Sound.play('reveal');
      // clear this digit from notes in the same row/col/box, like most sudoku apps do
      clearNotesAfterPlacement(r, c, digit);
    }

    onScore(`Filled ${countFilled()}/81 · ${mistakes} mistake${mistakes === 1 ? '' : 's'}`);
    draw(ctxRef);

    if (isBoardComplete()) {
      if (isBoardCorrect()) {
        window.Arcade.unlockAchievement('sudoku_easy');
        if (window.Arcade.Shell.getDifficulty() === 'hard') {
          window.Arcade.unlockAchievement('sudoku_hard');
          window.Arcade.recordDifficultyClear('sudoku', 'hard');
        }
        if (mistakes === 0) window.Arcade.unlockAchievement('sudoku_noerrors');
        if (!usedNotes) window.Arcade.unlockAchievement('sudoku_nonotes');
        onEnd({ score: 81 - mistakes, won: true, title: 'Solved!' });
      }
      // if complete but not correct, the player has filled every cell with
      // at least one wrong digit somewhere — let them keep correcting rather
      // than forcing a loss, since conflicts are already highlighted in red
    }
  }

  function clearNotesAfterPlacement(r, c, digit) {
    for (let cc = 0; cc < 9; cc++) notes[r][cc].delete(digit);
    for (let rr = 0; rr < 9; rr++) notes[rr][c].delete(digit);
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) notes[rr][cc].delete(digit);
  }

  function countFilled() {
    let n = 0;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puzzle[r][c]) n++;
    return n;
  }

  function eraseSelected() {
    if (!selected || given[selected.r][selected.c]) return;
    const { r, c } = selected;
    puzzle[r][c] = 0;
    notes[r][c].clear();
    window.Arcade.Sound.play('click');
    draw(ctxRef);
  }

  function selectCell(r, c) {
    selected = { r, c };
    window.Arcade.Sound.play('click');
    draw(ctxRef);
  }

  /* ---------- Shell interface ---------- */

  function start({ ctx, canvas, config, addListener, onScore: os, onEnd: oe }) {
    ctxRef = ctx;
    resetState(config);
    onScore = os; onEnd = oe;
    onScore(`Filled ${countFilled()}/81 · 0 mistakes`);
    draw(ctx);

    addListener(canvas, 'pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width, scaleY = H / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const c = Math.floor((x - pad) / cellSize);
      const r = Math.floor((y - pad) / cellSize);
      if (r >= 0 && r < 9 && c >= 0 && c < 9) selectCell(r, c);
    });

    addListener(window, 'keydown', (e) => {
      if (e.key >= '1' && e.key <= '9') { placeDigit(parseInt(e.key, 10)); e.preventDefault(); }
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { eraseSelected(); e.preventDefault(); }
      else if (e.key === 'n' || e.key === 'N') { toggleNoteMode(); e.preventDefault(); }
      else if (selected) {
        const { r, c } = selected;
        if (e.key === 'ArrowUp' && r > 0) { selectCell(r - 1, c); e.preventDefault(); }
        else if (e.key === 'ArrowDown' && r < 8) { selectCell(r + 1, c); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' && c > 0) { selectCell(r, c - 1); e.preventDefault(); }
        else if (e.key === 'ArrowRight' && c < 8) { selectCell(r, c + 1); e.preventDefault(); }
      }
    });
  }

  function toggleNoteMode() {
    noteMode = !noteMode;
    window.Arcade.Sound.play('flag');
    updateNoteButtonVisual();
  }

  function updateNoteButtonVisual() {
    const btn = document.querySelector('.touch-btn--notes');
    if (btn) btn.classList.toggle('is-active', noteMode);
  }

  function tick() { return true; }

  window.Arcade.registerGame('sudoku', {
    title: 'Sudoku',
    tagline: 'Classic logic puzzle. Fill every row, column, and box.',
    icon: '🔷',
    width: W, height: H,
    supportsDifficulty: true,
    instructions: 'Tap a cell, then a number to fill it. Toggle Notes to pencil in candidates. Every puzzle has exactly one solution — no guessing required.',
    touchControls: buildTouchControls(),
    init, renderIdleFrame, start, tick
  });

  function buildTouchControls() {
    const controls = [];
    for (let d = 1; d <= 9; d++) {
      controls.push({
        slot: 'digit-' + d, icon: String(d), label: 'Enter ' + d, group: 'grid',
        onDown: () => placeDigit(d)
      });
    }
    controls.push({ slot: 'notes', icon: '✎', label: 'Toggle notes', group: 'grid-action', onDown: () => toggleNoteMode() });
    controls.push({ slot: 'erase', icon: '⌫', label: 'Erase', group: 'grid-action', onDown: () => eraseSelected() });
    return controls;
  }
})();
