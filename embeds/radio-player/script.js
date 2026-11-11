const STREAM_URL = 'https://stream.streambase.ch/radiopilatus/mp3-192';

const audio        = document.getElementById('radio-audio');
const btnPlay      = document.getElementById('btn-play');
const btnLike      = document.getElementById('btn-like');
const btnRepeat    = document.getElementById('btn-repeat');
const btnPrev      = document.getElementById('btn-prev');
const iconPlay     = btnPlay.querySelector('.icon-play');
const iconPause    = btnPlay.querySelector('.icon-pause');
const progressTrack  = document.querySelector('.progress-track');
const elNowPlaying   = document.getElementById('now-playing');

let playing = false;
let liked   = false;

function startStream() {
  audio.src = STREAM_URL;
  audio.load();
  audio.play().catch(() => {});
}

function stopStream() {
  audio.pause();
  audio.src = '';
}

function setPlaying(state) {
  playing = state;
  iconPlay.style.display  = state ? 'none' : '';
  iconPause.style.display = state ? ''     : 'none';
  progressTrack.classList.toggle('playing', state);
  btnPlay.setAttribute('aria-label', state ? 'Pause' : 'Abspielen');
  elNowPlaying.textContent = state
    ? '● Jetzt live: Radio Pilatus'
    : '○ Gestoppt';
}

btnPlay.addEventListener('click', () => {
  if (!playing) {
    startStream();
  } else {
    stopStream();
  }
});

audio.addEventListener('playing', () => setPlaying(true));
audio.addEventListener('pause',   () => setPlaying(false));
audio.addEventListener('error',   () => setPlaying(false));
audio.addEventListener('waiting', () => progressTrack.classList.add('playing'));

btnLike.addEventListener('click', () => {
  liked = !liked;
  btnLike.setAttribute('aria-pressed', String(liked));
});

btnRepeat.addEventListener('click', () => {
  const pressed = btnRepeat.getAttribute('aria-pressed') === 'true';
  btnRepeat.setAttribute('aria-pressed', String(!pressed));
});

btnPrev.addEventListener('click', () => {
  stopStream();
  setPlaying(false);
  setTimeout(startStream, 80);
});
