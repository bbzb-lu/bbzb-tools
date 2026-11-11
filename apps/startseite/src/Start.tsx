import { Header, Zeilen, zeilen, zuletzt } from '@bbzb/ui';
import { IconExternalLink } from '@tabler/icons-react';
import { Fuss } from './Fuss';
import { Illustration } from './Illustration';
import { geplant, tools } from './tools';

const rel = new Intl.RelativeTimeFormat('de-CH', { numeric: 'auto' });

/** «vor 5 Minuten», «gestern», sonst das Datum. */
export function wann(t: number, jetzt = Date.now()): string {
  const min = Math.round((t - jetzt) / 60_000);
  if (min > -60) return rel.format(Math.min(min, 0), 'minute');
  if (min > -24 * 60) return rel.format(Math.round(min / 60), 'hour');
  if (min > -2 * 24 * 60) return rel.format(-1, 'day');
  return new Date(t).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}


/** Schild mit dem Namen, ragt unten rechts über die Kachel. Lange Namen etwas kleiner. */
const Schild = ({ name }: { name: string }) => (
  <span className={`schild${name.length > 13 ? ' lang' : ''}`} aria-hidden="true">
    <span>
      <Zeilen name={name} />
    </span>
  </span>
);

export function Start() {
  const letzte = zuletzt().flatMap((e) => {
    const t = tools.find((t) => t.id === e.tool);
    return t ? [{ ...e, t }] : [];
  });
  return (
    <>
      <Header feedback="Startseite" />
      <main className="seite">
        <h1 className="titel">
          Tools
          <br />
          fürs BBZB
        </h1>
        <p className="versprechen">
          Alles bleibt in deinem Browser: kein Upload, kein Tracking, keine Cookies. <a href="/datenschutz/">Mehr zum Datenschutz</a>
        </p>

        {letzte.length > 0 && (
          <section className="zuletzt" aria-labelledby="zuletzt-titel">
            <h2 id="zuletzt-titel" className="abschnitt">
              Zuletzt bearbeitet
            </h2>
            <ul>
              {letzte.map((e) => (
                <li key={`${e.tool}/${e.id}`}>
                  <a href={`${e.t.pfad}?projekt=${encodeURIComponent(e.id)}`}>
                    <span className="zuletzt-name">{e.name}</span>
                    <span className="muted">
                      <span className="sr-only">{e.t.name}, </span>
                      {wann(e.geaendert)}
                    </span>
                    <span className={`mini-schild${Math.max(...zeilen(e.t.name).map((z) => z.length)) > 6 ? ' lang' : ''}`} aria-hidden="true">
                      <span>
                        <Zeilen name={e.t.name} />
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="abschnitt">Tools</h2>
        <ul className="kacheln">
          {tools.map((t, i) => (
            <li key={t.id} style={{ '--i': i } as React.CSSProperties}>
              <a className="kachel" href={t.pfad}>
                <span className="kachel-bild">
                  <Illustration tool={t.id} />
                  <Schild name={t.name} />
                </span>
                <span className="kachel-text">
                  <span className="kachel-name">{t.name}</span>
                  <span className="muted">
                    {t.satz} {t.beta && <span className="badge">Beta</span>}
                  </span>
                </span>
              </a>
            </li>
          ))}
          {geplant.map((g, i) => (
            <li key={g.id} style={{ '--i': tools.length + i } as React.CSSProperties}>
              <a className="kachel" href={g.link} target="_blank" rel="noopener noreferrer">
                <span className="kachel-bild">
                  <Illustration tool={g.id} />
                  <Schild name={g.name} />
                </span>
                <span className="kachel-text">
                  <span className="kachel-name">
                    {g.name} <IconExternalLink className="extern" aria-label="(GitHub, neuer Tab)" />
                  </span>
                  <span className="muted">
                    {g.satz} <span className="badge">Bald</span>
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </main>
      <Fuss />
    </>
  );
}
