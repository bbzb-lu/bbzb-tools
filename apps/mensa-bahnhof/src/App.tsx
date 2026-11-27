import { useEffect, useRef, useState, type Ref } from 'react';
import { Header, Segmented } from '@bbzb/ui';
import { GRUPPEN, ansicht, preisAus, tagTitel } from './ansicht';
import { VEGI, iconFuer } from './icons';
import { QUELLE, wochentage, type Linie, type MenuDatei, type Preis } from './menu';

const KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const stand = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' });

/** Lädt menu.json; `undefined` solange es lädt. Auch für Embed und Infoscreen.
 *  Mit `neuLadenMs` periodisch neu (neues Objekt = neues Rendern = neuer Tag); Fehler behalten gültige alte Daten. */
export function useDatei(neuLadenMs?: number) {
  const [datei, setDatei] = useState<MenuDatei | 'fehlt'>();
  useEffect(() => {
    const laden = () =>
      fetch(`${import.meta.env.BASE_URL}menu.json`, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: MenuDatei | null) => {
          if (!d || !Array.isArray(d.wochen)) throw new Error('menu.json ungültig');
          setDatei(d);
        })
        .catch(() => setDatei((alt) => (alt && alt !== 'fehlt' ? alt : 'fehlt')));
    void laden();
    if (!neuLadenMs) return;
    const id = setInterval(laden, neuLadenMs);
    return () => clearInterval(id);
  }, [neuLadenMs]);
  return datei;
}

/** «23.11.» aus «2026-11-23». */
export const kurzDatum = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.`;

export function App() {
  const datei = useDatei();
  const [tag, setTag] = useState<string>();
  const karten = useRef<HTMLElement>(null);
  const preis = preisAus(location.search);

  const a = datei && ansicht(datei === 'fehlt' ? undefined : datei, new Date());

  function waehle(t: string) {
    setTag(t);
    // Tagesleiste klebt unten: nach dem Wechsel den Anfang der Karten zeigen, falls er oberhalb liegt
    if (karten.current && karten.current.getBoundingClientRect().top < 0) karten.current.scrollIntoView();
  }

  return (
    <>
      <Header tool="Mensa Bahnhof" />
      <main className="mensa">
        {a?.zustand === 'offen' ? (
          <>
            <h1 className="nur-sr">{a.titel === 'Heute' ? `Heute, ${tagTitel(a.start)}` : `Am Montag, ${tagTitel(a.start, false)}`}</h1>
            <Tag ref={karten} datum={tag ?? a.start} start={a.start} heute={a.titel === 'Heute'}
              linien={a.woche.tage.find((t) => t.datum === (tag ?? a.start))?.linien ?? []} preis={preis} />
            <div className="tagesleiste">
              <Segmented legend="Tag" value={tag ?? a.start} onChange={waehle}
                options={wochentage(a.woche.montag).map((d, i): [string, string] => [d, `${KURZ[i]}\n${kurzDatum(d)}`])} />
            </div>
          </>
        ) : a ? (
          <>
            <h1>Mensa Bahnhof</h1>
            {a.zustand === 'geschlossen' ? (
              <p className="hinweis">Diese Woche kein Mittagsmenü</p>
            ) : (
              <p className="hinweis">
                Der Menüplan dieser Woche ist noch nicht da. <a href={QUELLE}>Menüplan bei SV Restaurant</a>
              </p>
            )}
          </>
        ) : null}
      </main>
      {a && (
        <footer className="mensa-fuss">
          <p>Quelle: <a href={QUELLE}>SV Restaurant</a></p>
          {datei !== 'fehlt' && datei && <p>Stand: {stand.format(new Date(datei.geholt))}</p>}
        </footer>
      )}
    </>
  );
}

function Tag({ ref, datum, start, heute, linien, preis }: {
  ref: Ref<HTMLElement>; datum: string; start: string; heute: boolean; linien: Linie[]; preis: Preis;
}) {
  return (
    <section ref={ref} className="tag">
      <h2 className="nur-sr">{tagTitel(datum)}</h2>
      {linien.length === 0 ? (
        <p className="hinweis">{heute && datum === start ? 'Heute kein Mittagsmenü' : 'Kein Mittagsmenü'}</p>
      ) : (
        <div className="karten">
          {linien.map((l) => <Karte key={l.linie + l.gericht} linie={l} preis={preis} />)}
        </div>
      )}
    </section>
  );
}

function Karte({ linie, preis }: { linie: Linie; preis: Preis }) {
  const gross = GRUPPEN.find((g) => g.preis === preis)!;
  const andere = GRUPPEN.filter((g) => g.preis !== preis && linie.preise[g.preis]);
  const labels = [...(linie.labels ?? [])].sort((x, y) => +VEGI.includes(y) - +VEGI.includes(x)); // ältere menu.json ohne Feld; Vegi zuerst
  return (
    <article className="karte">
      <div className="karte-kopf">
        <p className="linie">{linie.linie}</p>
        {labels.map((l) => <p key={l} className={VEGI.includes(l) ? 'badge vegi' : 'badge'}><Icon label={l} />{l}</p>)}
      </div>
      <h3 className="gericht">{linie.gericht}</h3>
      {linie.beilagen && <p className="beilagen">{linie.beilagen}</p>}
      <div className="preise">
        {linie.preise[preis] && (
          <p className="preis-gross"><strong>CHF {linie.preise[preis]}</strong> <span>{gross.name}</span></p>
        )}
        {andere.length > 0 && (
          <p className="preise-klein">
            {andere.map((g) => <span key={g.preis}>{g.name} <b>{linie.preise[g.preis]}</b></span>)}
          </p>
        )}
      </div>
    </article>
  );
}

export function Icon({ label }: { label: string }) {
  const pfade = iconFuer(label);
  return pfade && <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{pfade.map((d) => <path key={d} d={d} />)}</svg>;
}
