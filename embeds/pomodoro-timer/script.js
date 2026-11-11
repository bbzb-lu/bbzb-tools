const PHASES = [
  { label: 'WORK',        duration: 25 * 60, icon: '../_shared/icons/tomate.png'         },
  { label: 'SHORT BREAK', duration:  5 * 60, icon: '../_shared/icons/hourglass_icon.png' },
  { label: 'WORK',        duration: 25 * 60, icon: '../_shared/icons/tomate.png'         },
  { label: 'SHORT BREAK', duration:  5 * 60, icon: '../_shared/icons/hourglass_icon.png' },
  { label: 'WORK',        duration: 25 * 60, icon: '../_shared/icons/tomate.png'         },
  { label: 'SHORT BREAK', duration:  5 * 60, icon: '../_shared/icons/hourglass_icon.png' },
  { label: 'WORK',        duration: 25 * 60, icon: '../_shared/icons/tomate.png'         },
  { label: 'LONG BREAK',  duration: 15 * 60, icon: '../_shared/icons/hourglass_icon.png' },
];

let phaseIndex = 0;
let timeLeft   = PHASES[0].duration;
let intervalId = null;
let paused     = false;
let audioCtx   = null;

const elLabel       = document.getElementById('phase-label');
const elProgress    = document.getElementById('phase-progress');
const elIdle        = document.getElementById('idle-view');
const elRunning     = document.getElementById('running-view');
const elTimer       = document.getElementById('timer-display');
const elPause       = document.getElementById('pause-btn');
const elSkip        = document.getElementById('skip-btn');
const elStart       = document.getElementById('start-btn');
const elHeroIdle    = document.getElementById('hero-icon');
const elHeroRunning = document.getElementById('running-icon');

function fmt(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function renderProgress() {
  elProgress.innerHTML = '';
  PHASES.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'pdot' + (i < phaseIndex ? ' done' : i === phaseIndex ? ' active' : '');
    elProgress.appendChild(d);
  });
}

function syncUI() {
  const phase = PHASES[phaseIndex];
  elLabel.textContent    = phase.label;
  elTimer.textContent    = fmt(timeLeft);
  elHeroIdle.src         = phase.icon;
  elHeroRunning.src      = phase.icon;
  renderProgress();
}

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

function startTicking() {
  clearInterval(intervalId);
  intervalId = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      phaseIndex = (phaseIndex + 1) % PHASES.length;
      timeLeft   = PHASES[phaseIndex].duration;
      playChime();
    }
    syncUI();
  }, 1000);
}

elStart.addEventListener('click', () => {
  elIdle.style.display = 'none';
  elRunning.classList.add('visible');
  syncUI();
  startTicking();
});

elPause.addEventListener('click', () => {
  if (paused) {
    startTicking();
    paused = false;
    elPause.textContent = 'II';
  } else {
    clearInterval(intervalId);
    paused = true;
    elPause.textContent = '>';
  }
});

elSkip.addEventListener('click', () => {
  phaseIndex = (phaseIndex + 1) % PHASES.length;
  timeLeft   = PHASES[phaseIndex].duration;
  paused     = false;
  elPause.textContent = 'II';
  syncUI();
  startTicking();
});

syncUI();
