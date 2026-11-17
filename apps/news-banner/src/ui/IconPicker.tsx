import { useId, useMemo, useRef, useState } from 'react';
import { brandLabel, featuredTabler, iconSvg, searchBrands, searchTabler, type IconRef } from '../icons/catalog';
import { ImageError, readImage } from '../icons/raster';
import { Segmented } from '@bbzb/ui';

type Source = 'tabler' | 'brand' | 'image';
const sources: [Source, string][] = [['tabler', 'Icons'], ['brand', 'Apps'], ['image', 'Bild']];

/** Eine Kachel mit Vorschau des Icons (SVG aus dem Bündel, nicht aus Nutzereingaben). */
function Tile({ ref_, label, selected, onPick }: { ref_: Exclude<IconRef, { kind: 'image' }>; label: string; selected: boolean; onPick(): void }) {
  return (
    <li>
      <button type="button" className="icon-tile" aria-label={label} aria-pressed={selected} title={label} onClick={onPick}
        dangerouslySetInnerHTML={{ __html: iconSvg(ref_, 'currentColor', 24) }} />
    </li>
  );
}

export function IconPicker({ value, onPick, onError }: { value: IconRef; onPick(r: IconRef): void; onError(msg: string): void }) {
  const [source, setSource] = useState<Source>(value.kind);
  const [query, setQuery] = useState('');
  const icons = useMemo(() => (source === 'tabler' ? (query.trim() ? searchTabler(query) : featuredTabler()) : []), [source, query]);
  const brands = useMemo(() => (source === 'brand' ? searchBrands(query) : []), [source, query]);
  const file = useRef<HTMLInputElement>(null);
  const id = useId();
  const current = value.kind === 'brand' ? brandLabel(value.name) : value.name;
  const empty = query.trim() && (source === 'tabler' ? icons : brands).length === 0;
  const featured = source === 'tabler' && !query.trim();

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      onPick({ kind: 'image', name: f.name, bitmap: await readImage(f) });
      onError('');
    } catch (e) {
      onError(e instanceof ImageError ? e.message : 'Das Bild liess sich nicht öffnen.');
    }
  }

  return (
    <div className="picker">
      <Segmented legend="Typ" value={source} options={sources} onChange={(v) => { setSource(v); setQuery(''); }} />
      {source !== 'image' && (
        <>
          <label htmlFor={id} className="sr-only">Suche (englisch)</label>
          <input id={id} type="search" value={query} placeholder={source === 'tabler' ? 'Suche, englisch: wifi, printer, key' : 'Suche: teams, google'} onChange={(e) => setQuery(e.target.value)} />
          {empty && <p className="hint muted">Nichts gefunden. Versuche einen anderen Begriff.</p>}
        </>
      )}
      {featured && <p className="hint muted">Häufig gebraucht. Die Suche findet alle Tabler-Icons.</p>}
      {source === 'tabler' && (
        <ul className="icon-grid" aria-label={featured ? 'Häufig gebraucht' : 'Suchergebnisse'}>
          {icons.map((n) => <Tile key={n} ref_={{ kind: 'tabler', name: n }} label={n} selected={value.kind === 'tabler' && value.name === n} onPick={() => onPick({ kind: 'tabler', name: n })} />)}
        </ul>
      )}
      {source === 'brand' && (
        <ul className="icon-grid" aria-label="Apps">
          {brands.map((n) => <Tile key={n} ref_={{ kind: 'brand', name: n }} label={brandLabel(n)} selected={value.kind === 'brand' && value.name === n} onPick={() => onPick({ kind: 'brand', name: n })} />)}
        </ul>
      )}
      {source === 'image' && (
        <>
          <p className="hint muted">Nur für Ausnahmen. Das Bild bleibt im Browser und wird eingepasst.</p>
          <input ref={file} type="file" className="sr-only" tabIndex={-1} accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" onClick={() => file.current?.click()}>Bild wählen</button>
        </>
      )}
      <p className="sr-only" aria-live="polite">Gewählt: {current}</p>
    </div>
  );
}
