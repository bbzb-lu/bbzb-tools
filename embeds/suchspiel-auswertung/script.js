// Korrekte Antworten — update wenn die echten Zahlen bekannt sind
const CORRECT = {
  cursor: 8,
  tomate: 24,
};

const elStartScr    = document.getElementById('start-screen');
const elInputScr    = document.getElementById('input-screen');
const elResultScr   = document.getElementById('result-screen');

const elStartBtn    = document.getElementById('start-btn');
const elInputBack   = document.getElementById('input-back');
const elCheckBtn    = document.getElementById('check-btn');
const elResultBack  = document.getElementById('result-back');

const elInputCursor = document.getElementById('input-cursor');
const elInputTomate = document.getElementById('input-tomate');
const elInputError  = document.getElementById('input-error');
const elResult      = document.getElementById('result');
const elBootFill    = document.querySelector('#loadbar-boot .loadbar-fill');

let typeTimer = null;

/* ── Bildschirmwechsel ─────────────────────────────────────────────── */

function showStart() {
  stopTyping();
  elResultScr.classList.remove('visible');
  elInputScr.style.display = 'none';
  elStartScr.style.display = 'block';
}

function showInput() {
  stopTyping();
  elResultScr.classList.remove('visible');
  elStartScr.style.display = 'none';
  elInputScr.style.display = 'block';
  elInputError.textContent = '';
  elInputCursor.focus();
}

function showResultScreen() {
  // Ladebalken-Animation neu starten
  elBootFill.style.animation = 'none';
  void elBootFill.offsetWidth;
  elBootFill.style.animation = '';
  elResultScr.classList.add('visible');
}

elStartBtn.addEventListener('click', showInput);
elInputBack.addEventListener('click', showStart);
elResultBack.addEventListener('click', showInput);

/* ── Auswertung ────────────────────────────────────────────────────── */

elCheckBtn.addEventListener('click', validate);
elInputCursor.addEventListener('keydown', e => { if (e.key === 'Enter') validate(); });
elInputTomate.addEventListener('keydown', e => { if (e.key === 'Enter') validate(); });

function validate() {
  const c = parseInt(elInputCursor.value, 10);
  const t = parseInt(elInputTomate.value, 10);

  if (isNaN(c) || isNaN(t)) {
    elInputError.textContent = 'BITTE BEIDE FELDER AUSFÜLLEN';
    return;
  }
  elInputError.textContent = '';

  const lines = [];
  let allCorrect = true;

  if (c === CORRECT.cursor) {
    lines.push('> cursor:  korrekt ✓');
  } else {
    lines.push(`> cursor:  falsch — zu ${c > CORRECT.cursor ? 'hoch ▲' : 'niedrig ▼'}`);
    allCorrect = false;
  }

  if (t === CORRECT.tomate) {
    lines.push('> tomaten: korrekt ✓');
  } else {
    lines.push(`> tomaten: falsch — zu ${t > CORRECT.tomate ? 'hoch ▲' : 'niedrig ▼'}`);
    allCorrect = false;
  }

  lines.push('');
  lines.push(allCorrect
    ? '> auswertung: ALLE KORREKT! :)'
    : '> auswertung: nochmal nachzählen.');

  showResult(lines.join('\n'), allCorrect);
}

function showResult(text, success) {
  showResultScreen();
  elResult.className = 'term-result ' + (success ? 'result--ok' : 'result--error');
  elResult.textContent = '';
  stopTyping();
  typewrite(text, 0);
}

function stopTyping() {
  if (typeTimer) {
    clearTimeout(typeTimer);
    typeTimer = null;
  }
}

function typewrite(text, i) {
  if (i < text.length) {
    elResult.textContent += text[i];
    typeTimer = setTimeout(() => typewrite(text, i + 1), 22);
  } else {
    typeTimer = null;
  }
}
