import { useRef, useState } from 'react';
import { Button, Header, Segmented, Switch, reducedMotion } from '@bbzb/ui';
import { Kacheln } from './Kacheln';
import { ladeListe, speichereListe } from './liste';
import { Rad } from './Rad';
import { MAX_OPTIONEN, parseOptionen, ziehe } from './ziehen';

type Modus = 'rad' | 'mehrere';

export function App() {
  const [text, setText] = useState(ladeListe);
  const [modus, setModus] = useState<Modus>('rad');
  const [entfernen, setEntfernen] = useState(false);
  const [anzahl, setAnzahl] = useState(2);
  const [drehung, setDrehung] = useState(0);
  const [dreht, setDreht] = useState(false);
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const [gezogen, setGezogen] = useState<Set<number>>(new Set());
  const [gekuerzt, setGekuerzt] = useState(false);
  const gewinner = useRef(-1);

  const { optionen } = parseOptionen(text);
  const n = optionen.length;
  const k = Math.min(Math.max(1, anzahl || 1), Math.max(n, 1));

  const aendern = (neu: string) => {
    setText(neu);
    speichereListe(neu);
    setErgebnis(null);
    setGezogen(new Set());
  };

  const laden = async (datei?: File) => {
    if (!datei) return;
    const r = parseOptionen(await datei.text());
    setGekuerzt(r.gekuerzt);
    aendern(r.optionen.join('\n'));
  };

  const fertig = (i: number) => {
    setDreht(false);
    const o = optionen[i] ?? null;
    setErgebnis(o);
    if (entfernen && o) aendern(text.split(/\r?\n/).filter((z) => z.trim() !== o).join('\n'));
  };

  const drehen = () => {
    const i = ziehe(n, 1)[0]!;
    const mitte = (i + 0.5 + (Math.random() - 0.5) * 0.6) * (360 / n); // Versatz bleibt im Segment
    gewinner.current = i;
    setErgebnis(null);
    setDrehung((d) => Math.ceil(d / 360) * 360 + 4 * 360 + 360 - mitte);
    if (reducedMotion()) fertig(i);
    else setDreht(true);
  };

  const mehrere = () => setGezogen(new Set(ziehe(n, k)));

  return (
    <>
      <Header tool="Glücksrad" />
      <main className="gr">
        <h1>Glücksrad</h1>
        <section className="gr-liste">
          <label htmlFor="optionen">Optionen</label>
          <textarea id="optionen" value={text} rows={10} placeholder="Eine Option pro Zeile" onChange={(e) => aendern(e.target.value)} />
          <div className="gr-zeile">
            <label className="datei">
              <input type="file" accept=".txt,text/plain" onChange={(e) => { void laden(e.target.files?.[0]); e.target.value = ''; }} />
              <span>Textdatei laden</span>
            </label>
            <span className="muted">{n} von {MAX_OPTIONEN}</span>
          </div>
          {gekuerzt && <p role="status" className="hint">Die Datei hat mehr als {MAX_OPTIONEN} Zeilen, nur die ersten {MAX_OPTIONEN} sind drin.</p>}
          <Segmented legend="Modus" value={modus} options={[['rad', 'Rad'], ['mehrere', 'Mehrere']]} onChange={(m) => { setModus(m); setErgebnis(null); setGezogen(new Set()); }} />
          {modus === 'rad' ? (
            <div className="gr-zeile">
              <span>Gewinner entfernen</span>
              <Switch label="Gewinner entfernen" checked={entfernen} onChange={setEntfernen} />
            </div>
          ) : (
            <div className="gr-zeile">
              <label htmlFor="anzahl">Anzahl</label>
              <input id="anzahl" type="number" min={1} max={Math.max(n, 1)} value={anzahl} onChange={(e) => setAnzahl(Number(e.target.value))} />
            </div>
          )}
        </section>
        <section className="gr-buehne">
          {modus === 'rad' ? (
            <>
              <Rad optionen={optionen} drehung={drehung} onEnde={() => dreht && fertig(gewinner.current)} />
              <Button variant="primary" onClick={drehen} disabled={n === 0 || dreht}>Drehen</Button>
              <p className="ergebnis" aria-live="polite">{ergebnis}</p>
            </>
          ) : (
            <>
              <Kacheln optionen={optionen} gewaehlt={gezogen} />
              <Button variant="primary" onClick={mehrere} disabled={n === 0}>Ziehen</Button>
              <p className="ergebnis" aria-live="polite">{gezogen.size > 0 && optionen.filter((_, i) => gezogen.has(i)).join(', ')}</p>
            </>
          )}
          {n === 0 && <p className="hint">Trag mindestens eine Option ein.</p>}
        </section>
      </main>
    </>
  );
}
