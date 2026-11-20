import { useEffect, useRef, useState } from 'react';
import { explosion, feuerwerk, hinzufuegen, konfetti, schritt, zeichne, type Partikel } from './partikel';
import { ton } from './ton';
import { indexUnterZeiger, winkelAusMatrix } from './zeiger';
import './fx.css';

const WORTE = ['WOW', 'EPIC', 'OMG', 'GG', 'MEGA', 'BOOM', 'CRAZY', 'LEGENDE'];
const FARBEN = ['fx-rot', 'fx-orange', 'fx-gelb', 'fx-gruen', 'fx-cyan', 'fx-magenta'];

const farbenAusTheme = () => {
  const s = getComputedStyle(document.documentElement);
  return FARBEN.map((k) => s.getPropertyValue(`--${k}`).trim());
};

/** Canvas mit Partikelschleife: läuft nur, solange es Partikel gibt, Pixeldichte höchstens 1,5. */
function baueMotor(c: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const gross = () => {
    c.width = Math.round(window.innerWidth * dpr);
    c.height = Math.round(window.innerHeight * dpr);
  };
  gross();
  window.addEventListener('resize', gross);
  let teile: Partikel[] = [];
  let raf = 0;
  const frame = (() => {
    let zuletzt = performance.now();
    const f = (jetzt: number) => {
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const dt = Math.min(0.05, (jetzt - zuletzt) / 1000);
      zuletzt = jetzt;
      teile = schritt(teile, dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      zeichne(ctx, teile);
      raf = teile.length ? requestAnimationFrame(f) : 0;
    };
    return f;
  })();
  return {
    spritz(neue: Partikel[]) {
      teile = hinzufuegen(teile, neue);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stopp() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', gross);
    },
  };
}

/** Letzte gefeierte Runde über alle Einhängungen von Fx hinweg: schützt die Grenze «ein Blitz je Gewinn». */
let zuletztGefeiert = -1;

type Wort = { id: number; w: string; x: number; y: number; r: number; c: number };

/**
 * Ebene des Wahnsinn-Modus. Alles `position: fixed` ausserhalb von `main`, weil `main` wackelt.
 * `phase` 'dreht': Hitmarker, Ticks, Schriftzüge. 'sieg': Explosion, Kanonen, Feuerwerk, ein Blitz (je `runde` einmal).
 */
export function Fx({ phase, mitTon, box, n, runde }: { phase: 'dreht' | 'sieg'; mitTon: boolean; box: HTMLElement | null; n: number; runde: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const motor = useRef<ReturnType<typeof baueMotor> | null>(null);
  const tonAn = useRef(mitTon);
  const [worte, setWorte] = useState<Wort[]>([]);
  const [marker, setMarker] = useState<{ id: number; x: number; y: number } | null>(null);
  const [blitz, setBlitz] = useState(0);

  useEffect(() => { tonAn.current = mitTon; }, [mitTon]);

  useEffect(() => {
    if (!canvas.current) return;
    const m = baueMotor(canvas.current);
    motor.current = m;
    return () => { m.stopp(); motor.current = null; };
  }, []);

  // Drehen: Segment am Zeiger lesen, tickern, Hitmarker (höchstens 3 pro Sekunde), Schriftzüge
  useEffect(() => {
    if (phase !== 'dreht' || !box) return;
    const g = box.querySelector('.rad-dreh');
    if (!g) return;
    if (tonAn.current) ton.sweep();
    const farben = farbenAusTheme();
    const timer = new Set<number>();
    let letzter = -1;
    let tTick = 0;
    let tMarker = 0;
    let raf = 0;
    const lauf = (jetzt: number) => {
      const i = indexUnterZeiger(winkelAusMatrix(getComputedStyle(g).transform), Math.max(n, 1));
      if (i !== letzter) {
        if (letzter !== -1 && tonAn.current && jetzt - tTick > 45) { tTick = jetzt; ton.tick(i); }
        if (letzter !== -1 && jetzt - tMarker > 350) {
          tMarker = jetzt;
          const r = box.getBoundingClientRect();
          const x = r.left + (r.width * 104) / 216;
          const y = r.top + (r.height * 28) / 216;
          setMarker({ id: jetzt, x, y });
          motor.current?.spritz(konfetti(x, y, 0, farben, Math.random, 8));
        }
        letzter = i;
      }
      raf = requestAnimationFrame(lauf);
    };
    raf = requestAnimationFrame(lauf);
    const iv = window.setInterval(() => {
      const r = box.getBoundingClientRect();
      const wort: Wort = { id: performance.now(), w: WORTE[Math.floor(Math.random() * WORTE.length)]!, x: r.left + Math.random() * r.width, y: r.top + Math.random() * r.height, r: (Math.random() - 0.5) * 40, c: Math.floor(Math.random() * FARBEN.length) };
      setWorte((l) => [...l.slice(-4), wort]);
      const t = window.setTimeout(() => setWorte((l) => l.filter((x) => x.id !== wort.id)), 1000);
      timer.add(t);
    }, 600);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      timer.forEach(clearTimeout);
    };
  }, [phase, box, n]);

  // Gewinn: je Runde einmal alles auf einmal
  useEffect(() => {
    if (phase !== 'sieg' || !box || zuletztGefeiert === runde) return;
    zuletztGefeiert = runde; // je Gewinn einmal, auch wenn die Ebene neu eingehängt wird
    const farben = farbenAusTheme();
    const r = box.getBoundingClientRect();
    const [w, h] = [window.innerWidth, window.innerHeight];
    const timer: number[] = [];
    const nach = (ms: number, f: () => void) => timer.push(window.setTimeout(f, ms));
    motor.current?.spritz(explosion(r.left + r.width / 2, r.top + r.height / 2, [farben[0]!, farben[1]!, farben[2]!]));
    nach(0, () => { setBlitz((b) => b + 1); setWorte([]); });
    if (tonAn.current) {
      ton.explosion();
      nach(150, () => ton.airhorn());
      nach(700, () => ton.fanfare());
    }
    nach(120, () => motor.current?.spritz([...konfetti(0, h, 40, farben, Math.random, 90), ...konfetti(w, h, -40, farben, Math.random, 90)]));
    [250, 500, 750].forEach((ms, i) => nach(ms, () => motor.current?.spritz(feuerwerk(w * (0.2 + 0.3 * i), h * (0.2 + 0.15 * (i % 2)), farben[(i * 2 + 1) % farben.length]!))));
    return () => timer.forEach(clearTimeout);
  }, [phase, runde, box]);

  return (
    <div className="fx" data-phase={phase} aria-hidden="true">
      <canvas ref={canvas} className="fx-canvas" />
      <div className="fx-vignette" />
      <div className="fx-scan" />
      <div className="fx-flare" />
      {blitz > 0 && <div key={blitz} className="fx-blitz" />}
      {marker && (
        <svg key={marker.id} className="fx-hit" style={{ left: marker.x, top: marker.y }} viewBox="-12 -12 24 24">
          {[[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, b]) => (
            <path key={`${a}${b}`} d={`M${a! * 4} ${b! * 4} L${a! * 10} ${b! * 10}`} />
          ))}
        </svg>
      )}
      {worte.map((x) => (
        <span key={x.id} className={`fx-wort c${x.c}`} style={{ left: x.x, top: x.y, '--r': `${x.r}deg` } as React.CSSProperties}>{x.w}</span>
      ))}
    </div>
  );
}
