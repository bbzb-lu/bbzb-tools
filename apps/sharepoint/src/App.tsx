import { Button, Header, Segmented } from '@bbzb/ui';
import { useState } from 'react';
import { code, datum, liste, nachName, type Embed } from './embeds';

type Groesse = 'desktop' | 'mobil';
const MASSE: Record<Groesse, [number, number]> = { desktop: [480, 350], mobil: [350, 250] };

function Karte({ e, groesse }: { e: Embed; groesse: Groesse }) {
  const [kopiert, setKopiert] = useState(false);
  const [w, h] = MASSE[groesse];
  const kopieren = async () => {
    await navigator.clipboard.writeText(code(e, location.origin));
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2000);
  };
  return (
    <li className="embed">
      <div className="embed-text">
        <h2>{e.name}</h2>
        <p className="muted">{e.satz}</p>
        <p className="embed-meta">
          <span>Seit {datum(e.datum)}</span>
          {e.extern && <span>Lädt Daten von {e.extern}</span>}
        </p>
        <div className="embed-aktionen">
          <Button variant="primary" onClick={kopieren}>
            Einbettungscode kopieren
          </Button>
          <a href={`${e.id}/`} target="_blank" rel="noopener">
            Allein öffnen
          </a>
          <span role="status" className="kopiert">
            {kopiert ? 'Kopiert' : ''}
          </span>
        </div>
      </div>
      <iframe className="vorschau" src={`${e.id}/`} width={w} height={h} title={`Vorschau ${e.name}`} loading="lazy" />
    </li>
  );
}

export function App() {
  const [sortierung, setSortierung] = useState<'neu' | 'name'>('neu');
  const [groesse, setGroesse] = useState<Groesse>('desktop');
  const embeds = sortierung === 'name' ? nachName(liste) : liste;
  return (
    <>
      <Header tool="SharePoint Embeds" feedback="SharePoint Embeds" />
      <main>
        <h1>SharePoint Embeds</h1>
        <p className="einleitung">
          Kleine Spiele und Tools für SharePoint-Seiten. In SharePoint den Webpart «Einbetten» wählen und den kopierten Code einfügen.
        </p>
        <div className="steuerung">
          <Segmented<'neu' | 'name'> legend="Sortieren" value={sortierung} options={[['neu', 'Neueste zuerst'], ['name', 'Name']]} onChange={setSortierung} />
          <Segmented<Groesse> legend="Vorschau" value={groesse} options={[['desktop', 'Desktop 480 × 350'], ['mobil', 'Mobil 350 × 250']]} onChange={setGroesse} />
        </div>
        <ul className="embeds">
          {embeds.map((e) => (
            <Karte key={e.id} e={e} groesse={groesse} />
          ))}
        </ul>
      </main>
    </>
  );
}
