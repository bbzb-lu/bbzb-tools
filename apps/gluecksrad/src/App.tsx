import { useState } from 'react';
import { Button, Header, Segmented, Switch, reducedMotion } from '@bbzb/ui';
import { Gewinner } from './Gewinner';
import { Kacheln } from './Kacheln';
import { ladeListe, speichereListe } from './liste';
import { presets } from './presets';
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
  const [offen, setOffen] = useState<string | null>(null); // Gewinner, der beim nächsten Drehen aus der Liste fliegt
  const [gewinnerIdx, setGewinnerIdx] = useState(-1);

  const { optionen } = parseOptionen(text);
  const n = optionen.length;
  const rest = n - (offen ? 1 : 0);
  const k = Math.min(Math.max(1, anzahl || 1), Math.max(n, 1));

  const aendern = (neu: string) => {
    setText(neu);
    speichereListe(neu);
    setErgebnis(null);
    setOffen(null);
    setGezogen(new Set());
  };

  const laden = async (datei?: File) => {
    if (!datei) return;
    const r = parseOptionen(await datei.text());
    setGekuerzt(r.gekuerzt);
    aendern(r.optionen.join('\n'));
  };

  const fertig = (liste: string[], i: number) => {
    setDreht(false);
    const o = liste[i] ?? null;
    setErgebnis(o);
    setOffen(entfernen ? o : null);
  };

  const drehen = () => {
    // Der letzte Gewinner geht erst jetzt, damit Rad und Ergebnis nach dem Stillstand zusammenpassen
    const neu = offen ? text.split(/\r?\n/).filter((z) => z.trim() !== offen).join('\n') : text;
    const liste = parseOptionen(neu).optionen;
    if (liste.length === 0) return;
    if (offen) {
      setText(neu);
      speichereListe(neu);
      setOffen(null);
    }
    const i = ziehe(liste.length, 1)[0]!;
    const mitte = (i + 0.5 + (Math.random() - 0.5) * 0.6) * (360 / liste.length); // Versatz bleibt im Segment
    setGewinnerIdx(i);
    setErgebnis(null);
    setDrehung((d) => Math.ceil(d / 360) * 360 + 4 * 360 + 360 - mitte);
    if (reducedMotion()) fertig(liste, i);
    else setDreht(true);
  };

  const speichern = () => {
    const url = URL.createObjectURL(new Blob([`${optionen.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: 'gluecksrad-optionen.txt' }).click();
    URL.revokeObjectURL(url);
  };

  const mehrere = () => setGezogen(new Set(ziehe(n, k)));

  return (
    <>
      <Header tool="Glücksrad" />
      <main className="gr">
        <h1>Glücksrad</h1>
        <section className="gr-liste">
          <div className="gr-vorlagen" role="group" aria-label="Vorlagen">
            {presets.map((p) => (
              <button key={p.name} type="button" className="vorlage" disabled={dreht} aria-pressed={parseOptionen(p.text).optionen.join('\n') === optionen.join('\n')} onClick={() => { setGekuerzt(false); aendern(p.text.trim()); }}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="gr-zeile">
            <label htmlFor="optionen">Optionen</label>
            <span className="muted">{n} von {MAX_OPTIONEN}</span>
          </div>
          <textarea id="optionen" value={text} rows={10} disabled={dreht} placeholder="Eine Option pro Zeile" onChange={(e) => aendern(e.target.value)} />
          <div className="gr-zeile">
            <label className="datei">
              <input type="file" accept=".txt,text/plain" disabled={dreht} onChange={(e) => { void laden(e.target.files?.[0]); e.target.value = ''; }} />
              <span>Textdatei laden</span>
            </label>
            <Button onClick={speichern} disabled={n === 0}>Als Textdatei speichern</Button>
          </div>
          {gekuerzt && <p role="status" className="hint">Die Datei hat mehr als {MAX_OPTIONEN} Zeilen, nur die ersten {MAX_OPTIONEN} sind drin.</p>}
          <Segmented legend="Modus" value={modus} options={[['rad', 'Rad'], ['mehrere', 'Mehrere']]} disabled={dreht} onChange={(m) => { setModus(m); setErgebnis(null); setGezogen(new Set()); }} />
          {modus === 'rad' ? (
            <div className="gr-zeile">
              <span>Gewinner entfernen</span>
              <Switch label="Gewinner entfernen" checked={entfernen} disabled={dreht} onChange={setEntfernen} />
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
              <div className="rad-box">
                <Rad optionen={optionen} drehung={drehung} hervor={ergebnis ? gewinnerIdx : null} onEnde={() => dreht && fertig(optionen, gewinnerIdx)} />
                {ergebnis && <Gewinner key={drehung} name={ergebnis} onClose={() => setErgebnis(null)} />}
              </div>
              <Button variant="primary" onClick={drehen} disabled={rest === 0 || dreht}>Drehen</Button>
            </>
          ) : (
            <>
              <Kacheln optionen={optionen} gewaehlt={gezogen} />
              <Button variant="primary" onClick={mehrere} disabled={n === 0}>Ziehen</Button>
              <p className="ergebnis" aria-live="polite">{gezogen.size > 0 && optionen.filter((_, i) => gezogen.has(i)).join(', ')}</p>
            </>
          )}
          {n === 0 && modus === 'mehrere' && <p className="hint">Trag mindestens eine Option ein.</p>}
        </section>
      </main>
    </>
  );
}
