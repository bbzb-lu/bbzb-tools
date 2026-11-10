import { Header } from '@bbzb/ui';
import { Fuss } from './Fuss';
import { tools } from './tools';

export function Start() {
  return (
    <>
      <Header tool="Übersicht" />
      <main className="seite">
        <h1>Werkzeuge fürs BBZB</h1>
        <ul className="kacheln">
          {tools.map((t) => (
            <li key={t.id}>
              <a className="kachel" href={t.pfad}>
                <img src={`${import.meta.env.BASE_URL}${t.vorschau}`} alt="" width={960} height={540} />
                <span className="kachel-text">
                  <span className="kachel-kopf">
                    <h2>{t.name}</h2>
                    {t.beta && <span className="badge">Beta</span>}
                  </span>
                  <span className="muted">{t.satz}</span>
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
