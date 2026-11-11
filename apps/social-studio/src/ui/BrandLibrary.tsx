import { IconMapPin } from '@tabler/icons-react';
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { assetPacks, elementTypes } from '../core/registries';
import { DOODLE_PACK } from '../brand/doodles';
import { TABLER_PACK } from '../brand/tabler';
import { tagPreviewFill } from '../model/accent';
import { colors, onAccent } from '../tokens';
import { DoodleSearch } from './DoodleSearch';
import { IconSearch } from './IconSearch';
import { SlideHighlight, useSlidingHighlight } from '@bbzb/ui';
import { Item, Thumb } from './LibraryTile';

type TabId = 'scribble' | 'icon' | 'tag' | 'doodle';
// Hintergrund, Korn und Verläufe stellt man an der Slide ein (Inspector), nicht in der Bibliothek.
const tabs: { id: TabId; label: string }[] = [
  { id: 'scribble', label: 'Scribbles' },
  { id: 'icon', label: 'Icons' },
  { id: 'tag', label: 'Tags' },
  { id: 'doodle', label: 'Doodles' },
];

/** Brand Library: Klick oder Enter setzt mittig auf die aktuelle Slide, Ziehen auf die Leinwand an den Ablagepunkt. */
export function BrandLibrary() {
  const [active, setActive] = useState<TabId>('scribble');
  const id = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  useSlidingHighlight(tabsRef, "[role='tab'][aria-selected='true']", 2);
  const refs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const errors = assetPacks.all().flatMap((p) => p.errors);

  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    // zweispaltiges Raster: auf und ab gehen wie links und rechts der Reihe nach
    const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length]!.id;
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <aside className="library" aria-label="Bibliothek">
      {errors.length > 0 && (
        <div className="library-errors" role="status">
          <p>Nicht alle Scribbles und Icons sind da.</p>
          <ul>
            {errors.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="library-tabs" ref={tabsRef} role="tablist" aria-label="Kategorien" onKeyDown={onKey}>
        <SlideHighlight />
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(b) => void (refs.current[t.id] = b)}
            type="button"
            role="tab"
            id={`${id}-${t.id}`}
            aria-selected={t.id === active}
            aria-controls={`${id}-panel`}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="library-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${active}`}>
        {active === 'tag' ? <TagList /> : active === 'doodle' ? <DoodleSearch /> : active === 'icon' ? <IconSearch><AssetGrid category="icon" /></IconSearch> : <AssetGrid category={active} />}
      </div>
    </aside>
  );
}

function AssetGrid({ category }: { category: 'scribble' | 'icon' }) {
  const assets = assetPacks.all().filter((p) => p.id !== TABLER_PACK && p.id !== DOODLE_PACK).flatMap((p) => p.assets).filter((a) => a.category === category);
  if (assets.length === 0) return <p className="muted">{category === 'icon' ? 'Keine Icons vorhanden.' : 'Keine Scribbles vorhanden.'}</p>;
  return (
    <ul className={`library-grid library-${category}`}>
      {assets.map((a) => (
        <Item key={a.id} item={{ kind: 'asset', id: a.id }} label={a.name} className="library-tile">
          <Thumb asset={a} />
        </Item>
      ))}
    </ul>
  );
}

function TagList() {
  const variants = elementTypes.has('tag') ? (elementTypes.get('tag').variants ?? []) : [];
  return (
    <ul className="library-list">
      {variants.map((v) => (
        <Item key={v.id} item={{ kind: 'variant', type: 'tag', variant: v.id }} label={v.label} className="library-row">
          <span className="library-chip" style={chipStyle(v.id)}>
            {v.id === 'ort' && <IconMapPin aria-hidden="true" />}
            {v.label}
          </span>
        </Item>
      ))}
    </ul>
  );
}

function chipStyle(variant: string): CSSProperties {
  // Wie die Layoutkachel: «akzent» in Orange (Vorgabe «Fixe Akzentfarbe»), fach/frei in ihrem Einfüge-Standard
  const fill = tagPreviewFill(variant, colors.orange);
  return fill ? { background: fill, color: colors[onAccent(fill)] } : {};
}
