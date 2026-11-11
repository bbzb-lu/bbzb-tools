const CHARS = [
  { name: 'TOMATE',  src: '../_shared/icons/tomate.png' },
  { name: 'PACMAN',  src: '../_shared/icons/pacman_icon.png' },
  { name: 'CURSOR',  src: '../_shared/icons/cursor_icon.png' },
  { name: 'SANDUHR', src: '../_shared/icons/hourglass_icon.png' },
  { name: 'LAMPE',   src: '../_shared/icons/glühbirne_icon.png' },
  { name: 'GAMEPAD', src: '../_shared/icons/gamepade_icon.png' },
];

const WIN_COMBOS = [
  [0,1,2], [3,4,5], [6,7,8],  // rows
  [0,3,6], [1,4,7], [2,5,8],  // cols
  [0,4,8], [2,4,6],            // diagonals
];

// Yellow win-line position/rotation for each WIN_COMBO.
// The board is fluid (see --board in style.css), so every offset is a
// percentage of the board's inner box. Cell centres sit at 1/6, 1/2, 5/6.
// The line is TH px thick, hence the -TH/2 centring correction.
const TH   = 8;               // line thickness in px
const HALF = TH / 2;
const DIAG = 141.43;          // √2 × 100 % — corner to corner
const OFF  = (100 - DIAG) / 2;

const LINE_STYLES = [
  { top: `calc(16.6667% - ${HALF}px)`, left: '0',   w: '100%',  h: `${TH}px`, rot: 0  }, // row 0
  { top: `calc(50% - ${HALF}px)`,      left: '0',   w: '100%',  h: `${TH}px`, rot: 0  }, // row 1
  { top: `calc(83.3333% - ${HALF}px)`, left: '0',   w: '100%',  h: `${TH}px`, rot: 0  }, // row 2
  { top: '0', left: `calc(16.6667% - ${HALF}px)`,   w: `${TH}px`, h: '100%',  rot: 0  }, // col 0
  { top: '0', left: `calc(50% - ${HALF}px)`,        w: `${TH}px`, h: '100%',  rot: 0  }, // col 1
  { top: '0', left: `calc(83.3333% - ${HALF}px)`,   w: `${TH}px`, h: '100%',  rot: 0  }, // col 2
  { top: `calc(50% - ${HALF}px)`, left: `${OFF}%`, w: `${DIAG}%`, h: `${TH}px`, rot: 45  }, // diag \
  { top: `calc(50% - ${HALF}px)`, left: `${OFF}%`, w: `${DIAG}%`, h: `${TH}px`, rot: -45 }, // diag /
];

// ── State ──────────────────────────────────────────────────────────
let p1Idx       = 0;
let p2Idx       = 1;
let board       = Array(9).fill(null);
let current     = 1;        // whose turn (1 or 2)
let firstPlayer = 1;        // who starts this round (alternates)
let score       = [0, 0];
let gameOver    = false;
let audioCtx    = null;

// ── DOM refs ────────────────────────────────────────────────────────
const elP1Icon    = document.getElementById('p1-icon');
const elP2Icon    = document.getElementById('p2-icon');
const elP1Name    = document.getElementById('p1-name');
const elP2Name    = document.getElementById('p2-name');
const elP1Prev    = document.getElementById('p1-prev');
const elP1Next    = document.getElementById('p1-next');
const elP2Prev    = document.getElementById('p2-prev');
const elP2Next    = document.getElementById('p2-next');
const elStartBtn  = document.getElementById('start-btn');
const elStartScr  = document.getElementById('start-screen');
const elCtaPlay   = document.getElementById('cta-play');
const elSelBack   = document.getElementById('select-back');
const elSelectScr = document.getElementById('select-screen');
const elGameScr   = document.getElementById('game-screen');
const elCells     = document.querySelectorAll('.cell');
const elCurIcon   = document.getElementById('current-icon');
const elStatusTxt = document.getElementById('status-text');
const elWinLine   = document.getElementById('win-line');
const elWinBanner = document.getElementById('win-banner');
const elWinIcon   = document.getElementById('win-icon');
const elWinText   = document.getElementById('win-text');
const elScoreP1   = document.getElementById('score-p1');
const elScoreP2   = document.getElementById('score-p2');
const elScoreI1   = document.getElementById('score-icon-p1');
const elScoreI2   = document.getElementById('score-icon-p2');
const elBackBtn   = document.getElementById('back-btn');

// ── Carousel ────────────────────────────────────────────────────────
function advanceCarousel(player, dir) {
  const n = CHARS.length;
  if (player === 1) {
    let next = (p1Idx + dir + n) % n;
    while (next === p2Idx) next = (next + dir + n) % n;
    p1Idx = next;
  } else {
    let next = (p2Idx + dir + n) % n;
    while (next === p1Idx) next = (next + dir + n) % n;
    p2Idx = next;
  }
  renderCarousel();
}

function renderCarousel() {
  elP1Icon.src      = CHARS[p1Idx].src;
  elP1Name.textContent = CHARS[p1Idx].name;
  elP2Icon.src      = CHARS[p2Idx].src;
  elP2Name.textContent = CHARS[p2Idx].name;
}

elP1Prev.addEventListener('click', () => advanceCarousel(1, -1));
elP1Next.addEventListener('click', () => advanceCarousel(1, +1));
elP2Prev.addEventListener('click', () => advanceCarousel(2, -1));
elP2Next.addEventListener('click', () => advanceCarousel(2, +1));

// ── Titelbildschirm → Figurenwahl ────────────────────────────────────
elCtaPlay.addEventListener('click', () => {
  elStartScr.style.display  = 'none';
  elSelectScr.style.display = 'block';
});

elSelBack.addEventListener('click', () => {
  elSelectScr.style.display = 'none';
  elStartScr.style.display  = 'block';
});

// ── Game start ───────────────────────────────────────────────────────
elStartBtn.addEventListener('click', () => {
  elSelectScr.style.display = 'none';
  elGameScr.style.display   = 'flex';
  elScoreI1.src = CHARS[p1Idx].src;
  elScoreI2.src = CHARS[p2Idx].src;
  score = [0, 0];
  updateScore();
  firstPlayer = 1;
  resetBoard();
});

// ── Board reset ───────────────────────────────────────────────────────
function resetBoard() {
  board.fill(null);
  gameOver = false;
  current  = firstPlayer;
  elCells.forEach(cell => {
    cell.innerHTML = '';
    cell.className = 'cell';
  });
  elWinLine.classList.remove('visible');
  elWinLine.style.display = 'none';
  elWinBanner.classList.remove('visible');
  updateStatus();
}

function updateStatus() {
  const char    = current === 1 ? CHARS[p1Idx] : CHARS[p2Idx];
  elCurIcon.src = char.src;
  elStatusTxt.textContent = `SPIELER ${current}`;
}

function updateScore() {
  elScoreP1.textContent = score[0];
  elScoreP2.textContent = score[1];
}

// ── Cell clicks ───────────────────────────────────────────────────────
elCells.forEach(cell => {
  cell.addEventListener('click', () => {
    const i = parseInt(cell.dataset.i, 10);
    if (gameOver || board[i] !== null) return;

    board[i] = current;
    const img = document.createElement('img');
    img.src = current === 1 ? CHARS[p1Idx].src : CHARS[p2Idx].src;
    img.alt = '';
    cell.appendChild(img);
    cell.classList.add('filled');

    const winIdx = checkWin();
    if (winIdx !== -1) {
      showWin(current, winIdx);
    } else if (board.every(v => v !== null)) {
      showDraw();
    } else {
      current = current === 1 ? 2 : 1;
      updateStatus();
    }
  });
});

// ── Win / draw checks ─────────────────────────────────────────────────
function checkWin() {
  for (let i = 0; i < WIN_COMBOS.length; i++) {
    const [a, b, c] = WIN_COMBOS[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return i;
  }
  return -1;
}

function showWin(player, comboIdx) {
  gameOver = true;

  // Flash winning cells
  WIN_COMBOS[comboIdx].forEach(i => elCells[i].classList.add('win-cell'));

  // Show win line
  const s = LINE_STYLES[comboIdx];
  elWinLine.style.top             = s.top;
  elWinLine.style.left            = s.left;
  elWinLine.style.width           = s.w;
  elWinLine.style.height          = s.h;
  elWinLine.style.transform       = s.rot ? `rotate(${s.rot}deg)` : 'none';
  elWinLine.style.transformOrigin = s.rot ? 'center center' : '';
  elWinLine.style.display         = 'block';
  requestAnimationFrame(() => elWinLine.classList.add('visible'));

  // Update score
  score[player - 1]++;
  updateScore();

  // Show banner after short delay
  const char = player === 1 ? CHARS[p1Idx] : CHARS[p2Idx];
  elWinIcon.src         = char.src;
  elWinText.textContent = `SPIELER ${player}\nGEWINNT!`;

  setTimeout(() => {
    elWinBanner.classList.add('visible');
    playChime();
  }, 700);

  // Auto-reset: swap starting player
  setTimeout(() => {
    elWinBanner.classList.remove('visible');
    firstPlayer = firstPlayer === 1 ? 2 : 1;
    setTimeout(resetBoard, 250);
  }, 2800);
}

function showDraw() {
  gameOver = true;
  elWinIcon.src         = '../_shared/icons/hourglass_icon.png';
  elWinText.textContent = 'UNENTSCHIEDEN!';

  setTimeout(() => {
    elWinBanner.classList.add('visible');
    playChime();
  }, 400);

  setTimeout(() => {
    elWinBanner.classList.remove('visible');
    firstPlayer = firstPlayer === 1 ? 2 : 1;
    setTimeout(resetBoard, 250);
  }, 2400);
}

// ── Pixel chime (square wave) ─────────────────────────────────────────
function playChime() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((freq, i) => {
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

// ── Back to character selection ───────────────────────────────────────
elBackBtn.addEventListener('click', () => {
  elWinBanner.classList.remove('visible');
  elGameScr.style.display   = 'none';
  elSelectScr.style.display = 'block';
});

// ── Init ──────────────────────────────────────────────────────────────
renderCarousel();
