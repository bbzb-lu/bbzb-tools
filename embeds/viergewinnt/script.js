// ════════════════════════════════════════════════════════════════════
// BBZB Vier gewinnt
//
// 7×6-Brett, zwei Spieler am gleichen Gerät oder gegen den Computer
// (Minimax mit Alpha-Beta-Schnitt). Kein Build, keine Module.
// ════════════════════════════════════════════════════════════════════

const COLS = 7;
const ROWS = 6;

// Figuren — dieselbe Auswahl wie in bbzb-hub-tictactoe. Sie werden als
// weisse Silhouette in den Stein gelegt, deshalb zählt nur die Form.
const CHARS = [
  { name: 'TOMATE',  src: '../_shared/icons/tomate.png' },
  { name: 'PACMAN',  src: '../_shared/icons/pacman_icon.png' },
  { name: 'CURSOR',  src: '../_shared/icons/cursor_icon.png' },
  { name: 'SANDUHR', src: '../_shared/icons/hourglass_icon.png' },
  { name: 'LAMPE',   src: '../_shared/icons/glühbirne_icon.png' },
  { name: 'GAMEPAD', src: '../_shared/icons/gamepade_icon.png' },
];

// ── Zustand ─────────────────────────────────────────────────────────
let mode        = 'duo';               // 'duo' | 'cpu'
let p1Idx       = 0;
let p2Idx       = 1;
let board       = new Array(COLS * ROWS).fill(0);  // 0 leer, 1, 2
let current     = 1;
let firstPlayer = 1;                   // wechselt nach jeder Runde
let score       = [0, 0];
let gameOver    = true;
let busy        = false;               // Stein fällt / Computer denkt
let audioCtx    = null;

const idx = (r, c) => r * COLS + c;

// ── DOM ─────────────────────────────────────────────────────────────
const elStartScr = document.getElementById('start-screen');
const elSetupScr = document.getElementById('setup-screen');
const elGameScr  = document.getElementById('game-screen');
const elModeDuo  = document.getElementById('mode-duo');
const elModeCpu  = document.getElementById('mode-cpu');
const elSetupBk  = document.getElementById('setup-back');
const elStartBtn = document.getElementById('start-btn');
const elSetupTtl = document.getElementById('setup-title');
const elP1Cap    = document.getElementById('p1-cap');
const elP2Cap    = document.getElementById('p2-cap');
const elP1Icon   = document.getElementById('p1-icon');
const elP2Icon   = document.getElementById('p2-icon');
const elP1Name   = document.getElementById('p1-name');
const elP2Name   = document.getElementById('p2-name');
const elBoard    = document.getElementById('board');
const elColHl    = document.getElementById('col-hl');
const elWinLine  = document.getElementById('win-line');
const elCurIcon  = document.getElementById('current-icon');
const elStatus   = document.getElementById('status-text');
const elScoreP1  = document.getElementById('score-p1');
const elScoreP2  = document.getElementById('score-p2');
const elScoreI1  = document.getElementById('score-icon-p1');
const elScoreI2  = document.getElementById('score-icon-p2');
const elBackBtn  = document.getElementById('back-btn');
const elBanner   = document.getElementById('win-banner');
const elWinIcon  = document.getElementById('win-icon');
const elWinText  = document.getElementById('win-text');

// ── Brett aufbauen ──────────────────────────────────────────────────
// 42 Zellen, die Gewinnlinie liegt darüber und bleibt das letzte Kind.
const cells = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.r = r;
    cell.dataset.c = c;
    elBoard.insertBefore(cell, elWinLine);
    cells.push(cell);
  }
}

// ── Figurenauswahl ──────────────────────────────────────────────────
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
  elP1Icon.src = CHARS[p1Idx].src;
  elP2Icon.src = CHARS[p2Idx].src;
  elP1Name.textContent = CHARS[p1Idx].name;
  elP2Name.textContent = CHARS[p2Idx].name;
  elP1Cap.textContent = mode === 'cpu' ? 'DU'       : 'SPIELER 1';
  elP2Cap.textContent = mode === 'cpu' ? 'COMPUTER' : 'SPIELER 2';
}

document.getElementById('p1-prev').addEventListener('click', () => advanceCarousel(1, -1));
document.getElementById('p1-next').addEventListener('click', () => advanceCarousel(1, +1));
document.getElementById('p2-prev').addEventListener('click', () => advanceCarousel(2, -1));
document.getElementById('p2-next').addEventListener('click', () => advanceCarousel(2, +1));

// ── Navigation ──────────────────────────────────────────────────────
// Ab Bildschirm 2 schaltet das Embed auf das Nachtblau-Schema um; der
// Titelbildschirm bleibt hell wie in allen anderen BBZB-Embeds.
const elCardBody = document.querySelector('.card-body');
const setDark = (on) => elCardBody.classList.toggle('is-dark', on);

// Der Gegner wird schon auf dem Titelbildschirm gewählt — zwei CTAs
// wie in bbzb-hub-sudoku. Bildschirm 2 trägt dann nur noch die
// Figurenwahl und nennt im Kopf den gewählten Modus.
function chooseMode(m) {
  mode = m;
  elSetupTtl.textContent = m === 'cpu' ? 'GEGEN COMPUTER' : 'DUELL';
  renderCarousel();
  elStartScr.style.display = 'none';
  elSetupScr.style.display = 'block';
  setDark(true);
}

elModeDuo.addEventListener('click', () => chooseMode('duo'));
elModeCpu.addEventListener('click', () => chooseMode('cpu'));

elSetupBk.addEventListener('click', () => {
  elSetupScr.style.display = 'none';
  elStartScr.style.display = 'block';
  setDark(false);
});

elStartBtn.addEventListener('click', () => {
  elSetupScr.style.display = 'none';
  elGameScr.style.display  = 'flex';
  elScoreI1.src = CHARS[p1Idx].src;
  elScoreI2.src = CHARS[p2Idx].src;
  score = [0, 0];
  updateScore();
  firstPlayer = 1;
  resetBoard();
});

elBackBtn.addEventListener('click', () => {
  elBanner.classList.remove('visible');
  elGameScr.style.display  = 'none';
  elSetupScr.style.display = 'block';
  gameOver = true;
  busy     = false;
});

// ── Runde zurücksetzen ──────────────────────────────────────────────
function resetBoard() {
  // Der Auto-Reset nach einem Gewinn läuft in einem Timeout. Wenn in
  // der Zwischenzeit "ZURÜCK" gedrückt wurde, darf hier keine neue
  // Runde auf einem unsichtbaren Brett starten.
  if (elGameScr.style.display === 'none') return;

  board.fill(0);
  gameOver = false;
  busy     = false;
  current  = firstPlayer;

  cells.forEach(cell => {
    cell.innerHTML = '';
    cell.className = 'cell';
  });
  elBoard.classList.remove('is-locked');
  elColHl.classList.remove('visible');
  elWinLine.classList.remove('visible');
  elWinLine.style.display = 'none';
  elBanner.classList.remove('visible');

  updateStatus();
  maybeCpuMove();
}

function updateStatus() {
  const char = current === 1 ? CHARS[p1Idx] : CHARS[p2Idx];
  elCurIcon.src = char.src;
  if (mode === 'cpu') {
    elStatus.textContent = current === 1 ? 'DU' : 'COMPUTER';
  } else {
    elStatus.textContent = `SPIELER ${current}`;
  }
}

function updateScore() {
  elScoreP1.textContent = score[0];
  elScoreP2.textContent = score[1];
}

// ── Eingabe ─────────────────────────────────────────────────────────
// Geklickt wird die Spalte, nicht die Zelle — wo der Stein landet,
// entscheidet die Schwerkraft.
elBoard.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  if (gameOver || busy) return;
  if (mode === 'cpu' && current === 2) return;
  playColumn(parseInt(cell.dataset.c, 10));
});

// Die ganze Spalte hervorheben, solange die Maus darüber steht.
elBoard.addEventListener('mouseover', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  highlightColumn(gameOver || busy ? -1 : parseInt(cell.dataset.c, 10));
});
elBoard.addEventListener('mouseleave', () => highlightColumn(-1));

// Ein hohes Rechteck hinter der Brettplatte. Weil die Löcher im
// Brettbild transparent sind, leuchtet es nur durch sie hindurch.
// c < 0 blendet aus; volle Spalten werden nicht hervorgehoben, weil
// dort kein Zug mehr möglich ist.
function highlightColumn(c) {
  if (c < 0 || dropRow(board, c) < 0) {
    elColHl.classList.remove('visible');
    return;
  }
  // + --edge, weil das Brett ein Polster in Schattenbreite hat.
  elColHl.style.left = `calc(var(--edge) + var(--cell) * ${c})`;
  elColHl.classList.add('visible');
}

// ── Zug ausführen ───────────────────────────────────────────────────
function dropRow(b, c) {
  for (let r = ROWS - 1; r >= 0; r--) if (b[idx(r, c)] === 0) return r;
  return -1;                                     // Spalte ist voll
}

function playColumn(c) {
  const r = dropRow(board, c);
  if (r < 0) return;

  board[idx(r, c)] = current;
  busy = true;
  highlightColumn(-1);

  const disc = document.createElement('div');
  disc.className = 'disc';

  const ring = document.createElement('img');
  ring.className = 'disc-ring';
  ring.src = current === 1 ? '../_shared/icons/ring-blue.png' : '../_shared/icons/ring-pink.png';
  ring.alt = '';

  const fig = document.createElement('img');
  fig.className = 'disc-fig';
  fig.src = current === 1 ? CHARS[p1Idx].src : CHARS[p2Idx].src;
  fig.alt = '';

  disc.appendChild(ring);
  disc.appendChild(fig);
  cells[idx(r, c)].appendChild(disc);

  // Fallweg in Zellen: von oberhalb des Bretts bis zur Zielzeile.
  const fall = r + 1;

  // Aus s ∝ t² folgt t ∝ √s — ein langer Fall dauert länger, aber
  // nicht proportional länger. Der Fall ist Phase A und füllt die
  // ersten 55 % der Animation, der Rest ist der Aufprall.
  const fallTime = 0.075 * Math.sqrt(fall) + 0.10;
  const total    = fallTime / 0.55;

  disc.style.setProperty('--drop', `calc(var(--cell) * ${fall})`);
  disc.style.animation = `discDrop ${total.toFixed(3)}s steps(1, end) forwards`;

  // Der Ton gehört auf den Aufprall, nicht auf das Loslassen.
  setTimeout(() => {
    playThud();
    elBoard.classList.remove('thud');
    void elBoard.offsetWidth;          // Neustart der Animation erzwingen
    elBoard.classList.add('thud');
  }, fallTime * 1000);

  // Zweiter, leiserer Aufprall — er sitzt bei 80 % der Gesamtdauer.
  setTimeout(playBounce, total * 800);

  cells[idx(r, c)].classList.add('filled');

  const done = () => {
    const win = findWin(board, current);
    if (win) {
      showWin(current, win);
    } else if (board.every(v => v !== 0)) {
      showDraw();
    } else {
      current = current === 1 ? 2 : 1;
      busy = false;
      updateStatus();
      maybeCpuMove();
    }
  };

  // Der Zug ist beim AUFSETZEN fertig, nicht wenn der Stein ausgewippt
  // hat. Würde hier auf animationend gewartet, wäre die Eingabe eine
  // halbe Sekunde gesperrt und das Spiel fühlte sich zäh an — der
  // Abprall läuft einfach weiter, während schon geklickt werden kann.
  setTimeout(done, fallTime * 1000 + 20);
}

// ── Gewinnprüfung ───────────────────────────────────────────────────
// Liefert die vier Felder des ersten gefundenen Vierers, sonst null.
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function findWin(b, player) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b[idx(r, c)] !== player) continue;
      for (const [dr, dc] of DIRS) {
        const endR = r + dr * 3;
        const endC = c + dc * 3;
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
        if (b[idx(r + dr, c + dc)] === player &&
            b[idx(r + dr * 2, c + dc * 2)] === player &&
            b[idx(endR, endC)] === player) {
          return { r, c, dr, dc };
        }
      }
    }
  }
  return null;
}

// ── Gewinn ──────────────────────────────────────────────────────────
function showWin(player, win) {
  gameOver = true;
  busy     = true;
  elBoard.classList.add('is-locked');

  for (let i = 0; i < 4; i++) {
    cells[idx(win.r + win.dr * i, win.c + win.dc * i)].classList.add('win-cell');
  }
  drawWinLine(win);

  score[player - 1]++;
  updateScore();

  const char = player === 1 ? CHARS[p1Idx] : CHARS[p2Idx];
  elWinIcon.src = char.src;
  if (mode === 'cpu') {
    elWinText.textContent = player === 1 ? 'DU\nGEWINNST!' : 'COMPUTER\nGEWINNT!';
  } else {
    elWinText.textContent = `SPIELER ${player}\nGEWINNT!`;
  }

  setTimeout(() => {
    elBanner.classList.add('visible');
    playChime();
  }, 900);

  setTimeout(() => {
    elBanner.classList.remove('visible');
    firstPlayer = firstPlayer === 1 ? 2 : 1;
    setTimeout(resetBoard, 250);
  }, 3200);
}

function showDraw() {
  gameOver = true;
  busy     = true;
  elBoard.classList.add('is-locked');
  elWinIcon.src = '../_shared/icons/hourglass_icon.png';
  elWinText.textContent = 'UNENTSCHIEDEN!';

  setTimeout(() => {
    elBanner.classList.add('visible');
    playBuzz();
  }, 400);

  setTimeout(() => {
    elBanner.classList.remove('visible');
    firstPlayer = firstPlayer === 1 ? 2 : 1;
    setTimeout(resetBoard, 250);
  }, 2600);
}

// Die Linie wird in Vielfachen von --cell gesetzt, nicht in Pixeln.
// Dadurch sitzt sie bei jeder Fenstergrösse richtig, ohne dass hier
// irgendetwas gemessen werden müsste — auch nach einem Resize.
function drawWinLine(win) {
  const TH   = 8;                                    // Dicke in px
  const dx   = win.dc * 3;
  const dy   = win.dr * 3;
  const len  = Math.hypot(dx, dy);                   // in Zellen
  const ang  = Math.atan2(dy, dx) * 180 / Math.PI;

  elWinLine.style.left      = `calc(var(--cell) * ${(win.c + 0.5).toFixed(4)})`;
  elWinLine.style.top       = `calc(var(--cell) * ${(win.r + 0.5).toFixed(4)} - ${TH / 2}px)`;
  elWinLine.style.width     = `calc(var(--cell) * ${len.toFixed(4)})`;
  elWinLine.style.height    = `${TH}px`;
  elWinLine.style.transform = `rotate(${ang.toFixed(2)}deg)`;
  elWinLine.style.display   = 'block';
  requestAnimationFrame(() => elWinLine.classList.add('visible'));
}

// ════════════════════════════════════════════════════════════════════
// Computergegner — Minimax mit Alpha-Beta-Schnitt
// 7×6 ist klein genug, dass Tiefe 5 in wenigen Millisekunden fertig
// ist. Mehr Tiefe würde das Embed nur schwerer schlagbar machen, was
// für einen Pausenfüller in der Schule nicht das Ziel ist.
// ════════════════════════════════════════════════════════════════════

const DEPTH = 5;
const ORDER = [3, 2, 4, 1, 5, 0, 6];       // Mitte zuerst — bessere Schnitte

function maybeCpuMove() {
  if (mode !== 'cpu' || gameOver || current !== 2) return;
  busy = true;
  // Kurze Pause, sonst wirkt der Zug wie ein Fehler statt wie ein Gegner.
  setTimeout(() => {
    if (gameOver) return;
    const c = bestMove();
    busy = false;
    if (c >= 0) playColumn(c);
  }, 450);
}

function bestMove() {
  let best = -Infinity;
  let choice = -1;
  for (const c of ORDER) {
    const r = dropRow(board, c);
    if (r < 0) continue;
    board[idx(r, c)] = 2;
    const v = minimax(board, DEPTH - 1, -Infinity, Infinity, false);
    board[idx(r, c)] = 0;
    if (v > best) { best = v; choice = c; }
  }
  return choice;
}

function minimax(b, depth, alpha, beta, maximizing) {
  if (findWin(b, 2)) return  1000000 - (DEPTH - depth);
  if (findWin(b, 1)) return -1000000 + (DEPTH - depth);
  if (depth === 0 || b.every(v => v !== 0)) return evaluate(b);

  if (maximizing) {
    let best = -Infinity;
    for (const c of ORDER) {
      const r = dropRow(b, c);
      if (r < 0) continue;
      b[idx(r, c)] = 2;
      best = Math.max(best, minimax(b, depth - 1, alpha, beta, false));
      b[idx(r, c)] = 0;
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = Infinity;
  for (const c of ORDER) {
    const r = dropRow(b, c);
    if (r < 0) continue;
    b[idx(r, c)] = 1;
    best = Math.min(best, minimax(b, depth - 1, alpha, beta, true));
    b[idx(r, c)] = 0;
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

// Bewertung: jedes Vierer-Fenster zählt, plus ein Bonus für die Mitte.
function evaluate(b) {
  let s = 0;

  for (let r = 0; r < ROWS; r++) {
    if (b[idx(r, 3)] === 2) s += 3;
    else if (b[idx(r, 3)] === 1) s -= 3;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of DIRS) {
        const endR = r + dr * 3;
        const endC = c + dc * 3;
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
        let me = 0, you = 0;
        for (let i = 0; i < 4; i++) {
          const v = b[idx(r + dr * i, c + dc * i)];
          if (v === 2) me++;
          else if (v === 1) you++;
        }
        if (me && you) continue;               // blockiertes Fenster
        if (me === 3) s += 50;
        else if (me === 2) s += 8;
        else if (me === 1) s += 1;
        if (you === 3) s -= 60;                // eigene Gefahr höher werten
        else if (you === 2) s -= 8;
        else if (you === 1) s -= 1;
      }
    }
  }
  return s;
}

// ════════════════════════════════════════════════════════════════════
// Töne — WebAudio-Rechteckwellen, keine Audiodateien.
// Gleiches Verfahren wie in Sudoku und TicTacToe.
// ════════════════════════════════════════════════════════════════════

function tone(freq, start, dur, vol, type) {
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start);
  osc.stop(start + dur);
  return osc;
}

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Aufprall: tiefer, schnell abfallender Ton — der Stein schlägt auf.
function playThud() {
  try {
    ensureAudio();
    const t   = audioCtx.currentTime;
    const osc = tone(200, t, 0.12, 0.11);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
  } catch (_) {}
}

// Zweiter Abprall: kürzer, höher, leiser — der Stein wippt aus.
function playBounce() {
  try {
    ensureAudio();
    const t   = audioCtx.currentTime;
    const osc = tone(320, t, 0.06, 0.045);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);
  } catch (_) {}
}

// Gewinn: aufsteigendes Arpeggio wie in Sudoku.
function playChime() {
  try {
    ensureAudio();
    [523, 659, 784, 1047].forEach((freq, i) => {
      tone(freq, audioCtx.currentTime + i * 0.12, 0.18, 0.12);
    });
  } catch (_) {}
}

// Unentschieden: zwei tiefe Töne abwärts.
function playBuzz() {
  try {
    ensureAudio();
    const t = audioCtx.currentTime;
    tone(330, t,        0.16, 0.1);
    tone(247, t + 0.16, 0.24, 0.1);
  } catch (_) {}
}

// ── Init ────────────────────────────────────────────────────────────
renderCarousel();
