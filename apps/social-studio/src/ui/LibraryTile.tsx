import { useEffect, useState, type ReactNode } from 'react';
import type { BrandAsset } from '../brand/manifest';
import { akzent } from '../tokens';
import { insertLibraryItem, LIBRARY_MIME, type LibraryItem } from './libraryItem';
import { thumbnail } from './thumbnail';

/** Button, der beim Klick einfügt und sich auf die Leinwand ziehen lässt. */
export function Item({ item, label, className, children }: { item: LibraryItem; label: string; className: string; children: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        className={className}
        aria-label={label}
        data-tip={label}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(LIBRARY_MIME, JSON.stringify(item));
          e.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={() => void insertLibraryItem(item)}
      >
        {children}
      </button>
    </li>
  );
}

/** Vorschau in der Standardfarbe, erst wenn der Tab offen ist. */
export function Thumb({ asset }: { asset: BrandAsset }) {
  const [src, setSrc] = useState<string | null>();
  useEffect(() => {
    let live = true;
    thumbnail(asset.url, asset.defaultColor ?? akzent).then(
      (u) => live && setSrc(u),
      () => live && setSrc(null),
    );
    return () => {
      live = false;
    };
  }, [asset]);
  if (src === null) return <span className="library-missing">{asset.name}</span>;
  return src ? <img src={src} alt="" draggable={false} /> : null;
}
