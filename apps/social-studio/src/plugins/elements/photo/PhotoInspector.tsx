import type { Element } from '../../../model/types';
import { OpacitySlider } from '../../../ui/OpacitySlider';
import { Section } from '../../../ui/Section';
import { ImageSection } from './ImageSection';
import { MaskSection } from './MaskSection';
import { PhotoEffects } from './PhotoEffects';
import { isVideo, type PhotoProps } from './schema';
import { VideoSection } from './VideoSection';

/**
 * Abschnitte nach «Ebene», alle einklappbar, nur Darstellung (Deckkraft) offen: Darstellung, Bild (Ersetzen, Ausschnitt, Look,
 * Spiegeln, Erweitert; am Video eingerückt in «Video»), Maske (nur am Foto), Effekte (Rahmen, Korn, Verläufe).
 */
export function PhotoInspector({ el }: { el: Element<PhotoProps> }) {
  const empty = el.props.assetId === undefined;
  const vid = isVideo(el.props);
  return (
    <>
      <Section heading="Darstellung" collapsible defaultOpen><OpacitySlider el={el} /></Section>
      {vid && !empty ? <VideoSection el={el} /> : <ImageSection el={el} />}
      {!vid && !empty && <MaskSection el={el} />}
      <PhotoEffects el={el} empty={empty} />
    </>
  );
}
