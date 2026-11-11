import { IconAdjustmentsHorizontal, IconCrop, IconFlipHorizontal, IconFlipVertical, IconPalette, IconPhotoUp, IconRestore } from '@tabler/icons-react';
import { editorContext } from '../../../canvas/editorContext';
import type { Element } from '../../../model/types';
import { apply } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { imageAdjust } from '../../../tokens';
import { Section } from '../../../ui/Section';
import { Slider } from '../../../ui/Slider';
import type { Adjust } from '../../effects/look';
import { fillPhoto, pickImage } from './fromFile';
import { adjustOf, flipOf, flipYOf, isVideo, lookOf, type PhotoProps } from './schema';
import { setProps } from './setProps';

const SLIDERS: [keyof Adjust, string, { low: string; high: string }][] = [
  ['brightness', 'Helligkeit', { low: 'dunkel', high: 'hell' }],
  ['contrast', 'Kontrast', { low: 'weich', high: 'hart' }],
  ['saturation', 'Sättigung', { low: 'blass', high: 'kräftig' }],
  ['warmth', 'Wärme', { low: 'kühl', high: 'warm' }],
];

const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');

/** Alle Regler auf 0: das Feld fällt weg wie bei einem Foto, das nie verändert wurde (ein Undo-Schritt). */
const resetAdjust = (id: string) => apply((d) => void delete (d.elements[id] as Element<PhotoProps>).props.adjust);

/** «Erweitert» im Abschnitt «Bild»: die vier Bildregler mit Nullstelle in der Mitte, Zurücksetzen in der Kopfzeile. */
function Advanced({ el }: { el: Element<PhotoProps> }) {
  const adjust = adjustOf(el.props);
  const neutral = SLIDERS.every(([k]) => adjust[k] === 0);
  return (
    <Section
      nested
      collapsible
      id="bild-erweitert"
      heading="Erweitert"
      icon={<IconAdjustmentsHorizontal aria-hidden="true" />}
      actions={
        <button type="button" className="icon-btn" aria-label="Bildregler zurücksetzen" aria-disabled={neutral} data-tip={neutral ? 'Alle Regler stehen auf 0' : 'Alle Regler auf 0'} onClick={() => !neutral && resetAdjust(el.id)}>
          <IconRestore aria-hidden="true" />
        </button>
      }
    >
      {SLIDERS.map(([key, label, center]) => (
        <Slider
          key={key}
          label={label}
          value={adjust[key]}
          format={signed}
          min={imageAdjust.min}
          max={imageAdjust.max}
          defaultValue={0}
          center={center}
          onChange={(v) => v !== adjust[key] && setProps(el.id, { adjust: { ...adjust, [key]: v } })}
        />
      ))}
    </Section>
  );
}

/**
 * Abschnitt «Bild»: Ersetzen und Ausschnitt, BBZB-Look mit Spiegeln, darunter «Erweitert» (am Video nur Ausschnitt und Look).
 * `nested`: eingerückt im Abschnitt «Video», mit eigenem Auf/Zu (Schlüssel «video-bild»).
 */
export function ImageSection({ el, nested }: { el: Element<PhotoProps>; nested?: boolean }) {
  const editing = useUi((s) => s.cropEditId === el.id);
  const look = lookOf(el.props);
  const flipX = flipOf(el.props);
  const flipY = flipYOf(el.props);
  const vid = isVideo(el.props);
  const empty = el.props.assetId === undefined;
  // Ohne Maus: Datei wählen statt ziehen
  const replace = (
    <button type="button" aria-label={empty ? 'Foto wählen' : 'Foto ersetzen'} data-tip={empty ? 'Foto wählen' : 'Foto ersetzen'} onClick={() => pickImage((file) => void fillPhoto(el, file, editorContext()))}>
      <IconPhotoUp aria-hidden="true" />
      {empty ? 'Foto wählen' : 'Ersetzen'}
    </button>
  );
  if (empty)
    return (
      <Section heading="Bild" collapsible>
        <p className="muted hint">Zieh ein Foto hierher oder wähl eines aus.</p>
        <div className="tool-grid">{replace}</div>
      </Section>
    );
  return (
    <Section heading="Bild" collapsible nested={nested} id={nested ? 'video-bild' : undefined}>
      <div className="tool-grid">
        {replace}
        <button type="button" aria-label="Ausschnitt bearbeiten" data-tip="Ausschnitt bearbeiten" aria-pressed={editing} onClick={() => useUi.getState().setCropEditId(editing ? null : el.id)}>
          <IconCrop aria-hidden="true" />
          Ausschnitt
        </button>
      </div>
      <div className="tool-row">
        <button type="button" aria-pressed={look} onClick={() => setProps(el.id, { look: !look })}>
          <IconPalette aria-hidden="true" />
          BBZB-Look
        </button>
        {!vid && (
          <>
            <button type="button" className="icon-btn" aria-label="Waagrecht spiegeln" data-tip="Waagrecht spiegeln" aria-pressed={flipX} onClick={() => setProps(el.id, { flipX: !flipX })}>
              <IconFlipHorizontal aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn" aria-label="Senkrecht spiegeln" data-tip="Senkrecht spiegeln" aria-pressed={flipY} onClick={() => setProps(el.id, { flipY: !flipY })}>
              <IconFlipVertical aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {!vid && <Advanced el={el} />}
    </Section>
  );
}
