// ── Config ──────────────────────────────────────────────────────────
// Clue targets are matched to the API's own bands, measured over ~45 grids:
// Easy 40, Medium 26–39 (median 35), Hard 17–24 (median 20). That keeps a
// locally generated level roughly as hard as an API one of the same name.
const DIFFS = {
  easy:   { key: 'L', label: 'LEICHT', clues: 40 },
  medium: { key: 'M', label: 'MITTEL', clues: 34 },
  hard:   { key: 'S', label: 'SCHWER', clues: 24 },
};

// Maps the API's own rating back onto our levels.
const API_DIFF = { Easy: 'easy', Medium: 'medium', Hard: 'hard' };

const API_URL = 'https://sudoku-api.vercel.app/api/dosuku?query='
  + encodeURIComponent('{newboard(limit:9){grids{value,solution,difficulty}}}');

// Base32 alphabet without 0/1/I/O — those are the characters students mistype.
const A32      = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LEN = 6;                 // 32^6 seeds
const SEED_MAX = 32 ** CODE_LEN;

// ── Seeded RNG ──────────────────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function randomSeed() {
  return Math.floor(Math.random() * SEED_MAX);
}

// ── Share codes: "M-4K7XQ9" = difficulty letter + base32 seed ────────
function encodeCode(diff, seed) {
  let s = seed, out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out = A32[s % 32] + out;
    s = Math.floor(s / 32);
  }
  return DIFFS[diff].key + '-' + out;
}

function parseCode(str) {
  const s = (str || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.length !== CODE_LEN + 1) return null;

  const diff = Object.keys(DIFFS).find(k => DIFFS[k].key === s[0]);
  if (!diff) return null;

  let seed = 0;
  for (let i = 1; i < s.length; i++) {
    const v = A32.indexOf(s[i]);
    if (v < 0) return null;
    seed = seed * 32 + v;
  }
  return { diff, seed };
}

// ── Solver ──────────────────────────────────────────────────────────
// Grids are Int8Array(81), 0 = empty. Candidates live in bits 1..9.
const ALL = 0x3FE;

function boxOf(i) {
  return (((i / 27) | 0) * 3) + (((i % 9) / 3) | 0);
}

function popcount(m) {
  let n = 0;
  for (; m; m &= m - 1) n++;
  return n;
}

// Counts solutions, stopping at `limit`. limit=2 answers "is it unique?".
function countSolutions(grid, limit) {
  const rows = new Int32Array(9), cols = new Int32Array(9), boxes = new Int32Array(9);
  const work = Int8Array.from(grid);

  for (let i = 0; i < 81; i++) {
    const v = work[i];
    if (!v) continue;
    const bit = 1 << v;
    rows[(i / 9) | 0] |= bit;
    cols[i % 9]       |= bit;
    boxes[boxOf(i)]   |= bit;
  }

  let count = 0;

  function rec() {
    // Pick the empty cell with the fewest candidates.
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (work[i]) continue;
      const mask = ~(rows[(i / 9) | 0] | cols[i % 9] | boxes[boxOf(i)]) & ALL;
      const n    = popcount(mask);
      if (n === 0) return;                       // dead end
      if (n < bestCount) {
        bestCount = n; best = i; bestMask = mask;
        if (n === 1) break;
      }
    }
    if (best === -1) { count++; return; }        // grid full

    const r = (best / 9) | 0, c = best % 9, b = boxOf(best);
    for (let m = bestMask; m; m &= m - 1) {
      const bit = m & -m;
      work[best] = 31 - Math.clz32(bit);
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      rec();
      work[best] = 0;
      rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      if (count >= limit) return;
    }
  }

  rec();
  return count;
}

// ── Generation ──────────────────────────────────────────────────────
function generateSolution(rng) {
  const grid = new Int8Array(81);
  const rows = new Int32Array(9), cols = new Int32Array(9), boxes = new Int32Array(9);

  function fill(i) {
    if (i === 81) return true;
    const r = (i / 9) | 0, c = i % 9, b = boxOf(i);
    const mask  = ~(rows[r] | cols[c] | boxes[b]) & ALL;
    const cands = [];
    for (let m = mask; m; m &= m - 1) cands.push(31 - Math.clz32(m & -m));
    shuffle(cands, rng);

    for (const v of cands) {
      const bit = 1 << v;
      grid[i] = v;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (fill(i + 1)) return true;
      grid[i] = 0;
      rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    return false;
  }

  fill(0);
  return grid;
}

// Removes cells while the puzzle keeps exactly one solution.
function dig(solution, targetClues, rng) {
  const grid  = Int8Array.from(solution);
  const order = shuffle([...Array(81).keys()], rng);
  let clues = 81;

  for (const i of order) {
    if (clues <= targetClues) break;
    const v = grid[i];
    grid[i] = 0;
    if (countSolutions(grid, 2) === 1) clues--;
    else grid[i] = v;
  }
  return grid;
}

function flatten(rows) {
  const g = new Int8Array(81);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) g[r * 9 + c] = rows[r][c];
  return g;
}

// ── Puzzle sources ──────────────────────────────────────────────────
// Race games: fully deterministic from the seed, so the same code
// produces the same board on every machine.
function seededPuzzle(diff, seed) {
  const rng      = mulberry32(seed);
  const solution = generateSolution(rng);
  return {
    puzzle:   dig(solution, DIFFS[diff].clues, rng),
    solution: solution,
    diff:     diff,
    code:     encodeCode(diff, seed),
  };
}

// Single games: a real puzzle from the public API. The API cannot be
// asked for a difficulty, so if the batch has no match we re-mask one
// of its solution grids to our clue count.
async function fetchGrids() {
  const ctrl    = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(API_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const grids = (await res.json()).newboard.grids;
    if (!grids || !grids.length) throw new Error('empty response');
    return grids;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPuzzle(diff) {
  let grids;
  // The API 504s now and then; one retry turns most of those into a hit.
  try {
    grids = await fetchGrids();
  } catch (_) {
    grids = await fetchGrids();
  }

  const match = grids.find(g => API_DIFF[g.difficulty] === diff);
  if (match) {
    return {
      puzzle:   flatten(match.value),
      solution: flatten(match.solution),
      diff:     diff,
      code:     null,
    };
  }

  const solution = flatten(grids[0].solution);
  return {
    puzzle:   dig(solution, DIFFS[diff].clues, mulberry32(randomSeed())),
    solution: solution,
    diff:     diff,
    code:     null,
  };
}

// ── State ───────────────────────────────────────────────────────────
let difficulty = 'easy';
let puzzle     = null;   // Int8Array, 0 = empty (the givens)
let solution   = null;   // Int8Array
let board      = null;   // Int8Array, what the player sees
let code       = null;
let selected   = -1;
let showErrors = false;
let startTime  = 0;
let timerId    = null;
let won        = false;
let raceMode   = false;
let audioCtx   = null;

// ── DOM refs ────────────────────────────────────────────────────────
const elStartScr  = document.getElementById('start-screen');
const elSetupScr  = document.getElementById('setup-screen');
const elGameScr   = document.getElementById('game-screen');
const elModeSolo  = document.getElementById('mode-single');
const elModeRace  = document.getElementById('mode-race');
const elSetupBack = document.getElementById('setup-back');
const elSetupTtl  = document.getElementById('setup-title');
const elRacePanel = document.getElementById('race-panel');
const elDiffBtns  = document.querySelectorAll('.ts-seg-btn');
const elPlayBtn   = document.getElementById('play-btn');
const elMakeBtn   = document.getElementById('code-make-btn');
const elCodeInput = document.getElementById('code-input');
const elCodeStart = document.getElementById('code-start-btn');
const elCodeError = document.getElementById('code-error');
const elLoading   = document.getElementById('loading');
const elBoard     = document.getElementById('board');
const elPad       = document.getElementById('pad');
const elPadDel    = document.getElementById('pad-del');
const elStatusDif = document.getElementById('status-diff');
const elCodeLabel = document.getElementById('code-label');
const elTimer     = document.getElementById('timer');
const elErrToggle = document.getElementById('err-toggle');
const elErrBox    = document.getElementById('err-box');
const elNewBtn    = document.getElementById('new-btn');
const elWinBanner = document.getElementById('win-banner');
const elWinSub    = document.getElementById('win-sub');
const elWinAgain  = document.getElementById('win-again-btn');

const cells = [];

// ── Board construction ──────────────────────────────────────────────
(function buildBoard() {
  for (let i = 0; i < 81; i++) {
    const r = (i / 9) | 0, c = i % 9;
    const el = document.createElement('div');
    el.className = 'cell';
    el.dataset.i = i;
    if (c % 3 === 2) el.classList.add(c === 8 ? 'bx-r-last' : 'bx-r');
    if (r % 3 === 2) el.classList.add(r === 8 ? 'bx-b-last' : 'bx-b');
    elBoard.appendChild(el);
    cells.push(el);
  }
})();

function renderBoard() {
  for (let i = 0; i < 81; i++) {
    const el    = cells[i];
    const given = puzzle[i] !== 0;
    const v     = board[i];

    el.textContent = v ? String(v) : '';
    el.classList.toggle('given', given);
    el.classList.toggle('sel', i === selected);
    el.classList.toggle('wrong', showErrors && !given && v !== 0 && v !== solution[i]);
  }
  renderPad();
}

// Grey out digits that are already placed nine times.
function renderPad() {
  const used = new Array(10).fill(0);
  for (let i = 0; i < 81; i++) if (board[i]) used[board[i]]++;
  elPad.querySelectorAll('.pad-key[data-n]').forEach(key => {
    key.classList.toggle('done', used[+key.dataset.n] >= 9);
  });
}

// ── Game flow ───────────────────────────────────────────────────────
function startGame(game) {
  puzzle     = game.puzzle;
  solution   = game.solution;
  board      = Int8Array.from(game.puzzle);
  difficulty = game.diff;
  code       = game.code;
  selected   = -1;
  won        = false;

  elStatusDif.textContent = DIFFS[difficulty].label;
  elCodeLabel.textContent = code ? code : 'ZUFALLSPUZZLE';
  elCodeLabel.classList.toggle('copyable', !!code);
  elCodeLabel.title = code ? 'Code kopieren' : '';

  cells.forEach(el => el.classList.remove('solved'));
  elWinBanner.classList.remove('visible');
  elStartScr.style.display = 'none';
  elSetupScr.style.display = 'none';
  elGameScr.style.display  = 'flex';
  // Focus may still sit in the code box — keyboard input is ignored there.
  elCodeInput.blur();

  renderBoard();
  startTimer();
}

function startTimer() {
  clearInterval(timerId);
  startTime = Date.now();
  elTimer.textContent = '00:00';
  timerId = setInterval(() => {
    elTimer.textContent = fmtTime(Date.now() - startTime);
  }, 1000);
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function setValue(i, v) {
  if (won || i < 0 || puzzle[i] !== 0) return;
  board[i] = v;
  renderBoard();
  checkWin();
}

function checkWin() {
  for (let i = 0; i < 81; i++) if (board[i] !== solution[i]) return;

  won = true;
  clearInterval(timerId);
  const elapsed = Date.now() - startTime;

  // Diagonal sweep across the board, then the banner.
  for (let i = 0; i < 81; i++) {
    const wave = ((i / 9) | 0) + (i % 9);
    setTimeout(() => cells[i].classList.add('solved'), wave * 45);
  }

  elWinSub.innerHTML = 'ZEIT ' + fmtTime(elapsed)
    + (code ? '<br><span class="win-code">' + code + '</span>' : '');

  setTimeout(() => {
    elWinBanner.classList.add('visible');
    playChime();
  }, 1100);
}

// ── Pixel chime (square wave) ───────────────────────────────────────
function playChime() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = audioCtx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  } catch (_) {}
}

// ── Start screen ────────────────────────────────────────────────────
elDiffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    difficulty = btn.dataset.diff;
    elDiffBtns.forEach(b => b.classList.toggle('is-active', b === btn));
    // A stale code carries its own difficulty letter — drop it so the
    // picker and the code box can never disagree.
    elCodeInput.value = '';
    setHint('');
  });
});

elPlayBtn.addEventListener('click', async () => {
  setHint('');
  elLoading.textContent = 'SUDOKU WIRD GELADEN…';
  elLoading.classList.add('visible');
  elPlayBtn.disabled = true;

  try {
    startGame(await fetchPuzzle(difficulty));
    elLoading.classList.remove('visible');
  } catch (_) {
    // API unreachable — fall back to a locally generated puzzle.
    elLoading.textContent = 'OFFLINE-MODUS';
    startGame(seededPuzzle(difficulty, randomSeed()));
  } finally {
    elPlayBtn.disabled = false;
  }
});

// Only fills the box — everyone (host included) starts by pressing START,
// so nobody gains a head start while the code is being passed around.
elMakeBtn.addEventListener('click', () => {
  elCodeError.textContent = '';
  const fresh = encodeCode(difficulty, randomSeed());
  elCodeInput.value = fresh;
  elCodeInput.focus();
  elCodeInput.select();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(fresh)
      .then(() => setHint('KOPIERT – TEILEN, DANN ALLE START'), () => setHint('CODE TEILEN, DANN ALLE START'));
  } else {
    setHint('CODE TEILEN, DANN ALLE START');
  }
});

function setHint(msg, isError) {
  elCodeError.textContent = msg;
  elCodeError.classList.toggle('ok', !isError);
}

elCodeStart.addEventListener('click', () => {
  const parsed = parseCode(elCodeInput.value);
  if (!parsed) {
    setHint('CODE UNGÜLTIG', true);
    return;
  }
  setHint('');
  elCodeInput.value = '';
  startGame(seededPuzzle(parsed.diff, parsed.seed));
});

elCodeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') elCodeStart.click();
});

// ── Landing page → setup step ───────────────────────────────────────
// The title screen carries only the two CTAs; everything that needs a
// choice lives one step in.
function showSetup(mode) {
  raceMode = mode === 'race';
  elSetupTtl.textContent    = raceMode ? 'RENNEN' : 'EINZELSPIEL';
  elRacePanel.style.display = raceMode ? 'flex' : 'none';
  elPlayBtn.style.display   = raceMode ? 'none' : 'block';
  setHint(raceMode ? 'CODE TEILEN, DANN ALLE START' : '');
  elCodeInput.value = '';
  elLoading.classList.remove('visible');
  elStartScr.style.display = 'none';
  elSetupScr.style.display = 'block';
}

function showTitle() {
  elSetupScr.style.display = 'none';
  elGameScr.style.display  = 'none';
  elStartScr.style.display = 'block';
}

elModeSolo.addEventListener('click', () => showSetup('single'));
elModeRace.addEventListener('click', () => showSetup('race'));
elSetupBack.addEventListener('click', showTitle);

// ── Game screen ─────────────────────────────────────────────────────
elBoard.addEventListener('click', e => {
  const el = e.target.closest('.cell');
  if (!el || won) return;
  selected = +el.dataset.i;
  renderBoard();
});

elPad.addEventListener('click', e => {
  const key = e.target.closest('.pad-key');
  if (!key) return;
  setValue(selected, key === elPadDel ? 0 : +key.dataset.n);
});

document.addEventListener('keydown', e => {
  if (elGameScr.style.display === 'none') return;
  if (document.activeElement === elCodeInput) return;

  if (e.key >= '1' && e.key <= '9') {
    setValue(selected, +e.key);
  } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    setValue(selected, 0);
  } else if (e.key.startsWith('Arrow')) {
    if (won) return;
    const r = selected < 0 ? 0 : (selected / 9) | 0;
    const c = selected < 0 ? 0 : selected % 9;
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (!d) return;
    selected = selected < 0
      ? 0
      : Math.min(8, Math.max(0, r + d[0])) * 9 + Math.min(8, Math.max(0, c + d[1]));
    renderBoard();
  } else {
    return;
  }
  e.preventDefault();
});

// Clicking the code copies it, so it can be pasted into a chat.
elCodeLabel.addEventListener('click', () => {
  if (!code) return;
  const done = () => {
    elCodeLabel.textContent = 'KOPIERT!';
    setTimeout(() => { elCodeLabel.textContent = code; }, 1200);
  };
  if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => {});
});

elErrToggle.addEventListener('click', () => {
  showErrors = !showErrors;
  elErrBox.classList.toggle('on', showErrors);
  renderBoard();
});

function backToStart() {
  clearInterval(timerId);
  elWinBanner.classList.remove('visible');
  elGameScr.style.display  = 'none';
  elLoading.classList.remove('visible');
  // Back to the same step the player came from, not the landing page —
  // one click to replay, and a race keeps its code box in reach.
  showSetup(raceMode ? 'race' : 'single');
  // A code game may have changed the level — keep the picker honest, so
  // the next ERSTELLEN cannot mint a code for a level nobody selected.
  elDiffBtns.forEach(b => b.classList.toggle('is-active', b.dataset.diff === difficulty));
}

elNewBtn.addEventListener('click', backToStart);
elWinAgain.addEventListener('click', backToStart);
