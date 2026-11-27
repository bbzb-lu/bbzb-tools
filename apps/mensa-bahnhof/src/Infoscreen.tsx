import { GRUPPEN, ansicht, tagTitel } from './ansicht';
import { Icon, useDatei } from './App';
import { VEGI } from './icons';
import type { Preis } from './menu';

const name = (p: Preis) => GRUPPEN.find((g) => g.preis === p)!.name;

/** enlogic-Infoscreen beim Eingang (1920 × 1080): nur heute, Lernende gross. Läuft tagelang, darum Neuladen. */
export function Infoscreen() {
  const datei = useDatei(30 * 60_000);
  const a = datei && ansicht(datei === 'fehlt' ? undefined : datei, new Date());
  if (!a) return null;
  const linien = a.zustand === 'offen' ? (a.woche.tage.find((t) => t.datum === a.start)?.linien ?? []) : [];
  return (
    <main className="info">
      <h1 className="info-kopf">
        Mensa Bahnhof
        {a.zustand === 'offen' && <span>{a.titel === 'Heute' ? `Heute, ${tagTitel(a.start)}` : `Am Montag, ${tagTitel(a.start, false)}`}</span>}
      </h1>
      {linien.length === 0 ? (
        <p className="info-leer">
          {a.zustand === 'fehlt' ? 'Der Menüplan ist noch nicht da.' : a.zustand === 'geschlossen' ? 'Diese Woche kein Mittagsmenü' : 'Heute kein Mittagsmenü'}
        </p>
      ) : (
        <div className="info-karten">
          {linien.map((l) => {
            const labels = [...(l.labels ?? [])].sort((x, y) => +VEGI.includes(y) - +VEGI.includes(x));
            return (
              <article key={l.linie + l.gericht} className="info-karte">
                <div className="karte-kopf">
                  <p className="linie">{l.linie}</p>
                  {labels.map((b) => <p key={b} className={VEGI.includes(b) ? 'badge vegi' : 'badge'}><Icon label={b} />{b}</p>)}
                </div>
                <h2 className="info-gericht">{l.gericht}</h2>
                {l.beilagen && <p className="info-beilagen">{l.beilagen}</p>}
                <div className="preise">
                  {l.preise.SCHU && <p className="preis-schu"><strong>CHF {l.preise.SCHU}</strong> <span>{name('SCHU')}</span></p>}
                  {(['MA', 'EXT'] as const).map((p) => l.preise[p] && (
                    <p key={p} className={`preis-${p.toLowerCase()}`}>{name(p)} <b>{l.preise[p]}</b></p>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
