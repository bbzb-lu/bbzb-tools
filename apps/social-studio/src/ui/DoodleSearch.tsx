import { useEffect, useMemo, useRef, useState } from 'react';
import { doodleAsset, doodleCategories, doodlesFailed, loadDoodles, searchDoodles, type DoodlePack } from '../brand/doodles';
import { Item, Thumb } from './LibraryTile';

const LIMIT = 120;
const NAMES: Record<string, string> = {
  arrows: 'Pfeile',
  currency: 'Währungen',
  'e-commerce': 'Onlinehandel',
  emojis: 'Emojis',
  finance: 'Finanzen',
  food: 'Essen',
  'gender-symbols': 'Geschlechtersymbole',
  'hand-gestures': 'Handgesten',
  health: 'Gesundheit',
  interface: 'Oberfläche',
  logos: 'Logos',
  misc: 'Verschiedenes',
  objects: 'Gegenstände',
  weather: 'Wetter',
};
const label = (c: string) => NAMES[c] ?? c.charAt(0).toUpperCase() + c.slice(1).replace(/-/g, ' ');

/** Tab «Doodles»: Suche und Kategorie. Die Datei lädt beim ersten Öffnen des Tabs. */
export function DoodleSearch() {
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [pack, setPack] = useState<DoodlePack>();
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadDoodles().then(
      (p) => alive && setPack(p),
      () => alive && setFailed(doodlesFailed()),
    );
    return () => {
      alive = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const type = (v: string) => {
    setValue(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setQuery(v), 150);
  };

  const categories = useMemo(() => (pack ? doodleCategories(pack) : []), [pack]);
  const { assets, total } = useMemo(() => {
    if (!pack) return { assets: [], total: 0 };
    const r = searchDoodles(pack, query, category || undefined, category ? Infinity : LIMIT) // eine gewählte Kategorie zeigt alles;
    return { assets: r.names.flatMap((n) => doodleAsset(n, pack) ?? []), total: r.total };
  }, [pack, query, category]);
  const message = failed
    ? 'Die Doodles konnten nicht geladen werden. Lade die Seite neu.'
    : !pack
      ? 'Doodles werden geladen…'
      : total === 0
        ? category
          ? 'Keine Doodles in dieser Kategorie gefunden.'
          : 'Keine Doodles gefunden. Suche auf Englisch.'
        : total > assets.length
          ? `Zeigt ${assets.length} von ${total}. Grenze die Suche ein.`
          : `${total} Treffer`;

  return (
    <>
      <div className="icon-search">
        <input type="search" aria-label="Doodles suchen" placeholder="Doodle suchen…" value={value} onChange={(e) => type(e.target.value)} />
        <select aria-label="Kategorie" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
        </select>
        <p className="muted">Suche auf Englisch, z. B. bell, heart, arrow.</p>
        <p className="icon-search-status muted" role="status">
          {message}
        </p>
      </div>
      {assets.length > 0 && (
        <ul className="library-grid library-icon">
          {assets.map((a) => (
            <Item key={a.id} item={{ kind: 'asset', id: a.id }} label={a.name} className="library-tile">
              <Thumb asset={a} />
            </Item>
          ))}
        </ul>
      )}
      <p className="icon-credit muted">
        <a href="https://khushmeen.com/" target="_blank" rel="noopener noreferrer">
          Doodles von Khushmeen <span className="sr-only">(öffnet in neuem Tab)</span>
        </a>
      </p>
    </>
  );
}
