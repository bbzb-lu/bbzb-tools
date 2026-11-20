// Alle Töne entstehen live im Browser (Web Audio), keine Dateien. Jeder Aufruf ist in try/catch: ohne Audio läuft das Rad einfach stumm.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ein(): { c: AudioContext; out: GainNode } | null {
  try {
    ctx ??= new AudioContext();
    if (!master) {
      // Begrenzer und niedrige Gesamtlautstärke: der Beamer im Klassenzimmer soll nicht erschrecken
      const komp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(komp).connect(ctx.destination);
    }
    return { c: ctx, out: master };
  } catch {
    return null;
  }
}

const sicher = (f: (c: AudioContext, out: GainNode) => void) => {
  try {
    const a = ein();
    if (a) f(a.c, a.out);
  } catch { /* stumm */ }
};

/** Hüllkurve: schnell hoch, exponentiell runter. */
function huelle(c: AudioContext, out: AudioNode, t0: number, dauer: number, spitze: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(spitze, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer);
  g.connect(out);
  return g;
}

function osc(c: AudioContext, typ: OscillatorType, f0: number, f1: number, t0: number, dauer: number, ziel: AudioNode) {
  const o = c.createOscillator();
  o.type = typ;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dauer);
  o.connect(ziel);
  o.start(t0);
  o.stop(t0 + dauer + 0.05);
}

function rauschen(c: AudioContext, dauer: number): AudioBufferSourceNode {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dauer), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = buf;
  return s;
}

export const ton = {
  /** Im Klick aufrufen, sonst bleibt der Browser stumm. */
  frei() {
    sicher((c) => void c.resume());
  },
  tick(i: number) {
    sicher((c, out) => {
      const t = c.currentTime;
      osc(c, 'square', 700 + (i % 5) * 120, 400 + (i % 5) * 60, t, 0.04, huelle(c, out, t, 0.04, 0.5));
    });
  },
  sweep() {
    sicher((c, out) => {
      const t = c.currentTime;
      osc(c, 'sawtooth', 120, 1400, t, 0.6, huelle(c, out, t, 0.6, 0.5));
    });
  },
  airhorn() {
    sicher((c, out) => {
      const t = c.currentTime;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      filter.connect(huelle(c, out, t, 1.1, 0.9));
      for (const f of [466, 587, 698]) {
        // drei leicht verstimmte Sägezähne mit Vibrato ergeben den Hupenklang
        const o = c.createOscillator();
        const lfo = c.createOscillator();
        const lg = c.createGain();
        o.type = 'sawtooth';
        o.frequency.value = f;
        lfo.frequency.value = 9;
        lg.gain.value = 6;
        lfo.connect(lg).connect(o.frequency);
        o.connect(filter);
        o.start(t); lfo.start(t);
        o.stop(t + 1.15); lfo.stop(t + 1.15);
      }
    });
  },
  explosion() {
    sicher((c, out) => {
      const t = c.currentTime;
      const n = rauschen(c, 1.4);
      const tief = c.createBiquadFilter();
      tief.type = 'lowpass';
      tief.frequency.setValueAtTime(3000, t);
      tief.frequency.exponentialRampToValueAtTime(80, t + 1.3);
      n.connect(tief).connect(huelle(c, out, t, 1.3, 1));
      n.start(t);
      osc(c, 'sine', 140, 28, t, 1, huelle(c, out, t, 1, 1)); // Bass-Absturz
    });
  },
  fanfare() {
    sicher((c, out) => {
      [523, 659, 784, 1047].forEach((f, i) => {
        const t = c.currentTime + i * 0.11;
        osc(c, 'triangle', f, f, t, 0.35, huelle(c, out, t, 0.35, 0.5));
      });
    });
  },
};
