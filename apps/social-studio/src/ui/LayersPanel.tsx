import { IconEye, IconEyeOff, IconLock, IconLockOpen } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { moveInOrder } from '../model/elements';
import { elementsOnSlide } from '../model/geometry';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { patchElement, tryApply } from './actions';
import { blurIntoMenu, openContextMenu } from './ContextMenu';
import { orderIndexFor } from './layerOrder';

/** Ebenen der aktuellen Slide, oberste zuerst. Sperren und Ausblenden je Zeile, der Weg zu gesperrten und ausgeblendeten Elementen. */
export function LayersPanel() {
  const current = useUi((s) => s.currentSlide);
  const selectedIds = useUi((s) => s.selectedIds);
  // order läuft von unten nach oben; die Liste zeigt oben zuerst.
  const ids = useDoc(useShallow((s) => elementsOnSlide(s.project!, current).reverse()));
  const [editing, setEditing] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  // Einfügelinie beim Ziehen: Zeile und Seite, auf der die gezogene Ebene landet
  const [drop, setDrop] = useState<{ at: string; side: 'before' | 'after' } | null>(null);
  const refocus = useRef<string | null>(null);
  const cancelled = useRef(false); // Escape: das folgende Blur darf nicht übernehmen
  const listRef = useRef<HTMLUListElement>(null);
  const anchor = useRef<string | null>(null); // Ankerzeile für Umschalt + Pfeil und Umschalt-Klick

  // Nach Verschieben oder Umbenennen behält die Zeile den Fokus (React setzt verschobene Knoten um).
  useEffect(() => {
    if (!refocus.current || editing) return;
    listRef.current?.querySelector<HTMLElement>(`[data-layer="${refocus.current}"]`)?.focus();
    refocus.current = null;
  }, [ids, editing]);

  const move = (id: string, neighbour: string | undefined, where: 'above' | 'below') => {
    if (!neighbour || neighbour === id) return;
    refocus.current = id;
    tryApply((d) => moveInOrder(d, id, orderIndexFor(d.order, id, neighbour, where)));
  };
  // Auswahl der Zeilen von a bis b (Reihenfolge der Liste), Anker bleibt a.
  const selectRange = (a: string, b: string) => {
    const [i, j] = [ids.indexOf(a), ids.indexOf(b)];
    if (i < 0 || j < 0) return;
    useUi.getState().setSelectedIds(ids.slice(Math.min(i, j), Math.max(i, j) + 1));
  };
  const step = (id: string, dir: -1 | 1, extend: boolean) => {
    const next = ids[ids.indexOf(id) + dir];
    if (!next) return;
    listRef.current?.querySelector<HTMLElement>(`[data-layer="${next}"]`)?.focus();
    if (!extend) return useUi.getState().setSelectedId(next), void (anchor.current = next);
    anchor.current ??= id;
    selectRange(anchor.current, next);
  };
  const endEdit = (id: string, name?: string) => {
    if (cancelled.current) return;
    cancelled.current = name === undefined;
    const trimmed = name?.trim();
    if (trimmed) patchElement(id, { name: trimmed });
    refocus.current = id;
    setEditing(null);
  };

  return (
    <section className="layers" aria-label="Ebenen">
      {ids.length === 0 && <p className="muted layers-empty">Keine Elemente auf dieser Slide.</p>}
      <ul ref={listRef} aria-label="Ebenen" className="layer-list">
        {ids.map((id, i) => (
          <Row
            key={id}
            id={id}
            selected={selectedIds.includes(id)}
            editing={editing === id}
            drop={drop?.at === id ? drop.side : undefined}
            onEdit={() => {
              cancelled.current = false;
              setEditing(id);
            }}
            onEndEdit={(name) => endEdit(id, name)}
            onDragStart={() => (dragId.current = id)}
            onDragOver={() => {
              const from = ids.indexOf(dragId.current ?? '');
              const side = from < 0 || from === i ? null : from > i ? 'before' : 'after';
              setDrop((d) => (d?.at === id && d.side === side ? d : side && { at: id, side }));
            }}
            onDragEnd={() => {
              dragId.current = null;
              setDrop(null);
            }}
            onDrop={() => {
              const from = ids.indexOf(dragId.current ?? '');
              if (from >= 0) move(dragId.current!, id, from > i ? 'above' : 'below');
              dragId.current = null;
              setDrop(null);
            }}
            onMove={(dir) => move(id, ids[i + dir], dir < 0 ? 'above' : 'below')}
            onStep={(dir, extend) => step(id, dir, extend)}
            onRange={() => anchor.current && selectRange(anchor.current, id)}
            onPick={() => (anchor.current = id)}
          />
        ))}
      </ul>
    </section>
  );
}

interface RowProps {
  id: string;
  selected: boolean;
  editing: boolean;
  drop: 'before' | 'after' | undefined;
  onEdit(): void;
  onEndEdit(name?: string): void;
  onDragStart(): void;
  onDragOver(): void;
  onDragEnd(): void;
  onDrop(): void;
  onMove(dir: -1 | 1): void;
  onStep(dir: -1 | 1, extend: boolean): void;
  onRange(): void;
  onPick(): void;
}

function Row({ id, selected, editing, drop, onEdit, onEndEdit, onDragStart, onDragOver, onDragEnd, onDrop, onMove, onStep, onRange, onPick }: RowProps) {
  const el = useDoc((s) => s.project?.elements[id]);
  if (!el) return null;
  return (
    <li
      className="layer"
      data-hidden={!el.visible || undefined}
      data-drop={drop}
      onContextMenu={(e) => {
        if (e.target instanceof HTMLInputElement) return; // im Namensfeld bleibt das Menü des Browsers
        e.preventDefault();
        openContextMenu({ x: e.clientX, y: e.clientY }, id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => (e.preventDefault(), onDrop())}
    >
      {editing ? (
        <input
          aria-label="Name der Ebene"
          defaultValue={el.name}
          maxLength={200}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEndEdit(e.currentTarget.value);
            else if (e.key === 'Escape') onEndEdit();
          }}
          onBlur={(e) => !blurIntoMenu(e) && onEndEdit(e.currentTarget.value)}
        />
      ) : (
        <button
          type="button"
          className="layer-name"
          data-layer={id}
          aria-pressed={selected}
          aria-description="Doppelklick, Enter oder F2 benennt um. Alt + Pfeiltaste verschiebt."
          data-tip="Doppelklick, Enter oder F2 benennt um."
          data-tip-text="Alt + Pfeiltaste verschiebt."
          draggable
          onClick={(e) => {
            const ui = useUi.getState();
            if (e.shiftKey && !e.ctrlKey && !e.metaKey) return onRange();
            onPick();
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey) return ui.setSelectedId(id);
            ui.setSelectedIds(ui.selectedIds.includes(id) ? ui.selectedIds.filter((x) => x !== id) : [...ui.selectedIds, id]);
          }}
          onDoubleClick={onEdit}
          onDragEnd={onDragEnd}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', el.name);
            onDragStart();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'F2') {
              e.preventDefault();
              onEdit();
            } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault();
              onMove(e.key === 'ArrowUp' ? -1 : 1);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              onStep(e.key === 'ArrowUp' ? -1 : 1, e.shiftKey);
            }
          }}
        >
          {el.name}
        </button>
      )}
      <button type="button" className="icon-btn" aria-pressed={!el.visible} aria-label={el.visible ? 'Ausblenden' : 'Einblenden'} data-tip={el.visible ? 'Ausblenden' : 'Einblenden'} onClick={() => patchElement(id, { visible: !el.visible })}>
        {el.visible ? <IconEye aria-hidden="true" /> : <IconEyeOff aria-hidden="true" />}
      </button>
      <button type="button" className="icon-btn" aria-pressed={el.locked} aria-label={el.locked ? 'Entsperren' : 'Sperren'} data-tip={el.locked ? 'Entsperren' : 'Sperren'} onClick={() => patchElement(id, { locked: !el.locked })}>
        {el.locked ? <IconLock aria-hidden="true" /> : <IconLockOpen aria-hidden="true" />}
      </button>
    </li>
  );
}
