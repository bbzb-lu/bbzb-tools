import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadTabler, searchTabler, tablerAsset, tablerFailed, type TablerPack } from '../brand/tabler';
import tablerLogo from '../../brand/ui/tabler-icons.png';
import { Item, Thumb } from './LibraryTile';

/** Suche in den Tabler-Icons. Ohne Suchtext zeigt sie `children` (die Markenicons). Die Icon-Datei lädt erst beim Fokus oder Tippen. */
export function IconSearch({ children }: { children: ReactNode }) {
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');
  const [pack, setPack] = useState<TablerPack>();
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  const loading = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const start = () => {
    if (pack || loading.current) return;
    loading.current = true;
    loadTabler()
      .then(
        (p) => alive.current && (setFailed(false), setPack(p)),
        () => alive.current && setFailed(tablerFailed()),
      )
      .finally(() => (loading.current = false));
  };
  const type = (v: string) => {
    setValue(v);
    start();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setQuery(v), 150);
  };

  const hits = useMemo(() => (pack && query.trim() ? searchTabler(pack, query) : []), [pack, query]);
  const assets = useMemo(() => hits.flatMap((n) => tablerAsset(n, pack!) ?? []), [hits, pack]);
  const searching = query.trim() !== '';
  const message = !searching
    ? ''
    : failed
      ? 'Die Icons konnten nicht geladen werden. Lade die Seite neu.'
      : !pack
        ? 'Icons werden geladen…'
        : assets.length === 0
          ? 'Keine Icons gefunden. Suche auf Englisch.'
          : `${assets.length} Treffer`;

  return (
    <>
      <div className="icon-search">
        <input
          type="search"
          aria-label="Icons suchen"
          placeholder="Icon suchen…"
          value={value}
          onFocus={start}
          onChange={(e) => type(e.target.value)}
        />
        <p className="muted">Suche auf Englisch, z. B. home, arrow, camera.</p>
        <p className="icon-search-status muted" role="status">
          {message}
        </p>
      </div>
      {searching && assets.length > 0 ? (
        <ul className="library-grid library-icon">
          {assets.map((a) => (
            <Item key={a.id} item={{ kind: 'asset', id: a.id }} label={a.name} className="library-tile">
              <Thumb asset={a} />
            </Item>
          ))}
        </ul>
      ) : (
        !searching && children
      )}
      <p className="icon-credit muted">
        <a href="https://tabler.io/icons" target="_blank" rel="noopener noreferrer">
          Icons von Tabler <span className="sr-only">(öffnet in neuem Tab)</span> <img src={tablerLogo} alt="" />
        </a>
      </p>
    </>
  );
}
