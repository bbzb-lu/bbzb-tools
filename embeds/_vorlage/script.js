// ════════════════════════════════════════════════════════════════════
// BBZB Embed — Grundgerüst
//
// Was hier schon fertig ist: die Navigation zwischen den drei
// Bildschirmen und das Overlay. Die eigentliche Logik kommt in die
// markierten Abschnitte.
//
// Kein Build, keine Module — die Datei wird direkt eingebunden und
// muss auch über file:// laufen.
// ════════════════════════════════════════════════════════════════════

// ── Zustand ─────────────────────────────────────────────────────────
let option   = 'a';        // aktuell gewählte Option (Bildschirm 2)
let audioCtx = null;

// ── DOM ─────────────────────────────────────────────────────────────
const elStartScr = document.getElementById('start-screen');
const elSetupScr = document.getElementById('setup-screen');
const elAppScr   = document.getElementById('app-screen');
const elCtaMain  = document.getElementById('cta-primary');
const elCtaScnd  = document.getElementById('cta-second');   // optional
const elSetupBk  = document.getElementById('setup-back');
const elOptBtns  = document.querySelectorAll('.ts-seg-btn');
const elStartBtn = document.getElementById('start-btn');
const elBackBtn  = document.getElementById('back-btn');
const elNote     = document.getElementById('note');
const elLoading  = document.getElementById('loading');
const elStage    = document.getElementById('stage');
const elOverlay  = document.getElementById('overlay');
const elOvTitle  = document.getElementById('overlay-title');
const elOvSub    = document.getElementById('overlay-sub');
const elOvBtn    = document.getElementById('overlay-btn');

// ── Bildschirmwechsel ───────────────────────────────────────────────
// .ts-Bildschirme sind display:block, der App-Bildschirm ist flex.
function show(screen) {
  elStartScr.style.display = screen === 'start' ? 'block' : 'none';
  elSetupScr.style.display = screen === 'setup' ? 'block' : 'none';
  elAppScr.style.display   = screen === 'app'   ? 'flex'  : 'none';
  if (screen !== 'app') hideOverlay();
}

function setNote(msg, isError) {
  elNote.textContent = msg || '';
  elNote.classList.toggle('ok', !!msg && !isError);
}

// ── Overlay ─────────────────────────────────────────────────────────
function showOverlay(title, sub) {
  elOvTitle.textContent = title;
  elOvSub.innerHTML     = sub || '';
  elOverlay.classList.add('visible');
}

function hideOverlay() {
  elOverlay.classList.remove('visible');
}

// ── Pixel-Chime (Rechteckwelle) ─────────────────────────────────────
// Wird beim Gewinn/Abschluss gespielt. Läuft nur nach einer
// Nutzerinteraktion — deshalb nie beim Laden aufrufen.
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

// ── Navigation ──────────────────────────────────────────────────────
elCtaMain.addEventListener('click', () => {
  // Gibt es nichts zu wählen: hier direkt startApp() aufrufen.
  setNote('');
  show('setup');
});

if (elCtaScnd) {
  elCtaScnd.addEventListener('click', () => {
    setNote('');
    show('setup');
  });
}

elSetupBk.addEventListener('click', () => show('start'));

elOptBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    option = btn.dataset.opt;
    elOptBtns.forEach(b => b.classList.toggle('is-active', b === btn));
  });
});

elStartBtn.addEventListener('click', () => {
  startApp();
});

elBackBtn.addEventListener('click', () => show('setup'));

elOvBtn.addEventListener('click', () => {
  hideOverlay();
  show('setup');
});

// ════════════════════════════════════════════════════════════════════
// AB HIER: die eigentliche Logik des Embeds
// ════════════════════════════════════════════════════════════════════

function startApp() {
  show('app');

  // Falls der Fokus noch in einem Eingabefeld sitzt, greifen
  // Tastatur-Shortcuts nicht — deshalb hier ausdrücklich lösen.
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }

  // TODO: Inhalt aufbauen und in #stage rendern.
  elStage.textContent = 'Option ' + option.toUpperCase();
}

// Beispiel: Abschluss zeigen.
// showOverlay('FERTIG!', 'ZEIT 01:23');
// playChime();

// ── Start ───────────────────────────────────────────────────────────
// Ausgangszustand ausdrücklich setzen, statt ihn dem Markup zu
// überlassen — sonst hängt er von der Reihenfolge der style-Attribute ab.
show('start');
