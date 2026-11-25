import { GRUPPEN, ansicht, preisAus } from './ansicht';
import { Icon, kurzDatum, useDatei } from './App';
import { VEGI } from './icons';

/** Kompakte Tagesansicht für den SharePoint-Webpart «Einbetten» (480 × 350 und 350 × 250). */
export function Embed() {
  const datei = useDatei();
  const preis = preisAus(location.search);
  const a = datei && ansicht(datei === 'fehlt' ? undefined : datei, new Date());
  if (!a) return null;
  const linien = a.zustand === 'offen' ? (a.woche.tage.find((t) => t.datum === a.start)?.linien ?? []) : [];
  const name = GRUPPEN.find((g) => g.preis === preis)!.name;
  return (
    <main className="embed">
      <header className="embed-kopf">
        <h1>
          Mensa Bahnhof{' '}
          {a.zustand === 'offen' && <span>{a.titel === 'Heute' ? 'Heute' : 'Montag'}, {kurzDatum(a.start)}</span>}
        </h1>
        <a href="../" target="_blank" rel="noopener">Ganze Woche</a>
      </header>
      {linien.length === 0 ? (
        <p className="embed-leer">
          {a.zustand === 'fehlt' ? 'Der Menüplan ist noch nicht da.' : a.zustand === 'geschlossen' ? 'Diese Woche kein Mittagsmenü' : 'Heute kein Mittagsmenü'}
        </p>
      ) : (
        <ul className="embed-liste" aria-label={`Preise für ${name}`}>
          {linien.map((l) => {
            const labels = [...(l.labels ?? [])].sort((x, y) => +VEGI.includes(y) - +VEGI.includes(x));
            return (
              <li key={l.linie + l.gericht}>
                <p className="embed-gericht" title={l.gericht}>{l.gericht}</p>
                <p className="embed-preis">{l.preise[preis] && `CHF ${l.preise[preis]}`}</p>
                <p className="embed-zeile">
                  <span className="linie">{l.linie}</span>
                  {labels.map((b) => <span key={b} className={VEGI.includes(b) ? 'badge vegi' : 'badge'}><Icon label={b} />{b}</span>)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
