import { describe, expect, it, vi } from 'vitest';
import type { EditorContext } from '../../../core/types';
import { el, project } from '../../../model/fixtures';
import { memoryAssetStore } from '../../../storage/assets';
import { load, useDoc } from '../../../store/document';
import { photoFromFile, photoType } from './index';
import { adjustOf, flipOf, flipYOf, frameOf, imageArea, lookOf, photoPropsSchema, canAddScrim, scrimsOf, type PhotoProps, type Scrim } from './schema';
import type { Element } from '../../../model/types';
import { effects } from '../../../core/registries';
import { registerPlugins } from '../..';
import { scrimSteps } from '../../effects/scrim';
import { toggleFrame } from './frame';
import { setProps } from './setProps';
import { photoSteps } from './steps';
import { filmkorn } from '../../../tokens';

const ID = 'a'.repeat(64);

describe('photoType', () => {
  it('afterTransform übernimmt die Box und hält den Ausschnitt deckend', () => {
    load({ ...project(1), assets: { [ID]: { mime: 'image/png', width: 1000, height: 1000, name: 'x.png' } } });
    const photo = el({ type: 'photo', props: { assetId: ID, crop: { x: 0, y: 0, scale: 1 } } }) as never;
    const patch = photoType.afterTransform(photo, { x: 5, y: 6, width: 2000, height: 500, rotation: 30 });
    expect(patch).toMatchObject({ x: 5, y: 6, width: 2000, height: 500, rotation: 30 });
    // 2000 px breit braucht Skalierung 2, damit kein Rand entsteht; frei skaliert wird zentriert
    expect((patch.props as PhotoProps).crop).toEqual({ x: 0, y: -750, scale: 2 });
  });

  it('afterTransform mit Projekt (Format-Kopie auf der Startseite): Bildmasse aus diesem Projekt', () => {
    load(project(1)); // offenes Projekt kennt das Bild nicht
    const p = { ...project(1), assets: { [ID]: { mime: 'image/png', width: 1000, height: 1000, name: 'x.png' } } };
    const photo = el({ type: 'photo', props: { assetId: ID, crop: { x: 0, y: 0, scale: 1 } } }) as never;
    const patch = photoType.afterTransform(photo, { x: 0, y: 0, width: 2000, height: 500, rotation: 0 }, p);
    expect((patch.props as PhotoProps).crop).toEqual({ x: 0, y: -750, scale: 2 });
  });

  it('nicht dekodierbare Datei: Meldung, kein apply, nichts gespeichert', async () => {
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new DOMException('bad', 'InvalidStateError')));
    const assets = memoryAssetStore();
    const ctx: EditorContext = {
      project: project(1),
      currentSlide: 0,
      apply: vi.fn(),
      assets,
      select: vi.fn(),
      notify: vi.fn(),
    };
    await photoFromFile(new File([new Uint8Array(8)], 'foto.heic'), ctx);
    expect(ctx.apply).not.toHaveBeenCalled();
    expect(ctx.notify).toHaveBeenCalledWith('error', expect.stringContaining('Dieses Bild kann Edge nicht öffnen.'));
    expect(await assets.list()).toEqual([]);
    vi.unstubAllGlobals();
    expect(useDoc.getState().project).not.toBeNull();
  });

  it('nimmt Bilder und HEIC an, sonst nichts', () => {
    expect(photoType.acceptsFile!(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(photoType.acceptsFile!(new File([], 'IMG_1.HEIC'))).toBe(true);
    expect(photoType.acceptsFile!(new File([], 'ohne-endung', { type: 'image/heic' }))).toBe(true);
    expect(photoType.acceptsFile!(new File([], 'a.txt', { type: 'text/plain' }))).toBe(false);
  });

  it('Look, Regler und Spiegeln sind optional (alte Projekte: aus, neutral), Regler nur ganzzahlig −50..+50', () => {
    const old = { assetId: ID, crop: { x: 0, y: 0, scale: 1 } };
    expect(photoType.propsSchema.safeParse(old).success).toBe(true);
    expect([lookOf(old), flipOf(old), adjustOf(old)]).toEqual([false, false, { brightness: 0, contrast: 0, saturation: 0, warmth: 0 }]);
    const adjust = (warmth: number) => ({ ...old, adjust: { brightness: 0, contrast: 0, saturation: 0, warmth } });
    expect(photoType.propsSchema.safeParse(adjust(-50)).success).toBe(true);
    expect(photoType.propsSchema.safeParse(adjust(51)).success).toBe(false);
    expect(photoType.propsSchema.safeParse(adjust(1.5)).success).toBe(false);
  });

  it('Korn-Stärke (4c.1): fehlt = 14 % wie bisher, 0 bis 100 ganzzahlig, wirkt nur bei Korn an', () => {
    const old = { assetId: ID, crop: { x: 0, y: 0, scale: 1 } };
    const grainStep = (p: PhotoProps) => photoSteps(p).find((s) => s.id === 'grain')!.params;
    expect(grainStep({ ...old, grain: true })).toEqual({ opacity: filmkorn.opacityFoto });
    expect(grainStep({ ...old, grain: true, grainStrength: 14 })).toEqual({ opacity: filmkorn.opacityFoto });
    expect(grainStep({ ...old, grain: true, grainStrength: 60 })).toEqual({ opacity: 0.6 });
    expect(grainStep({ ...old, grain: false, grainStrength: 60 })).toEqual({ opacity: 0 });
    expect(photoType.propsSchema.safeParse({ ...old, grain: true, grainStrength: 100 }).success).toBe(true);
    for (const bad of [-1, 101, 2.5]) expect(photoType.propsSchema.safeParse({ ...old, grain: true, grainStrength: bad }).success).toBe(false);
  });

  it('Senkrecht spiegeln (Phase 4c): fehlt = aus (altes Projekt lädt unverändert), am Video nie; ein Undo-Schritt', () => {
    const old = { assetId: ID, crop: { x: 0, y: 0, scale: 1 } };
    expect(photoType.propsSchema.parse(old)).toEqual(old);
    expect(flipYOf(old)).toBe(false);
    expect(flipYOf({ ...old, flipY: true })).toBe(true);
    expect(flipYOf({ ...old, flipY: true, video: { start: 0, end: 2, sound: false, duration: 2 } })).toBe(false);
    expect(photoType.propsSchema.safeParse({ ...old, flipY: 'ja' }).success).toBe(false);
    load({ ...project(1, [el({ id: 'v', type: 'photo', props: old })]), assets: { [ID]: { mime: 'image/png', width: 10, height: 10, name: 'x.png' } } });
    const undos = () => useDoc.temporal.getState().pastStates.length;
    const before = undos();
    setProps('v', { flipY: true });
    expect((useDoc.getState().project!.elements.v as Element<PhotoProps>).props.flipY).toBe(true);
    expect(undos()).toBe(before + 1);
  });

  it('Rahmen ist optional (fehlt = aus); mit Rahmen liegt der Bildbereich um die Ränder (24) eingerückt in der Box', () => {
    const old = { assetId: ID, crop: { x: 0, y: 0, scale: 1 } };
    expect(frameOf(old)).toBe(false);
    expect(imageArea(old, { width: 882, height: 1034 })).toEqual({ x: 0, y: 0, width: 882, height: 1034 });
    expect(imageArea({ ...old, frame: true }, { width: 882, height: 1034 })).toEqual({ x: 24, y: 24, width: 834, height: 986 });
    // kleiner als die Ränder: Bildbereich bleibt mindestens 1 px
    expect(imageArea({ ...old, frame: true }, { width: 20, height: 20 })).toMatchObject({ width: 1, height: 1 });
  });

  it('Rahmen aussen (frameOutside): Bildbereich ist die ganze Box; ohne frameOutside (Altprojekt) bleibt er eingerückt', () => {
    const old = { assetId: ID, crop: { x: 0, y: 0, scale: 1 } };
    expect(imageArea({ ...old, frame: true, frameOutside: true }, { width: 882, height: 1034 })).toEqual({ x: 0, y: 0, width: 882, height: 1034 });
    expect(imageArea({ ...old, frame: true }, { width: 882, height: 1034 })).toEqual({ x: 24, y: 24, width: 834, height: 986 });
    expect(photoType.propsSchema.safeParse({ ...old, frame: true, frameOutside: true }).success).toBe(true);
  });

  it('toggleFrame: Altprojekt-Rahmen aus löscht frame und frameOutside, erneut an schreibt frameOutside; je ein Undo-Schritt', () => {
    const photo = el({ id: 'f', type: 'photo', width: 882, height: 1034, props: { assetId: ID, crop: { x: -24, y: -24, scale: 1 }, frame: true } });
    load({ ...project(1, [photo]), assets: { [ID]: { mime: 'image/png', width: 1000, height: 1000, name: 'x.png' } } });
    const props = () => (useDoc.getState().project!.elements.f as Element<PhotoProps>).props;
    const undos = () => useDoc.temporal.getState().pastStates.length;
    const before = undos();
    toggleFrame('f');
    expect(props()).not.toHaveProperty('frame');
    expect(props()).not.toHaveProperty('frameOutside');
    // Bildbereich wächst von 834 × 986 auf die Box: Ausschnitt bleibt deckend
    expect(props().crop.x + 1000 * props().crop.scale).toBeGreaterThanOrEqual(882 - 1e-6);
    expect(undos()).toBe(before + 1);
    const crop = props().crop;
    toggleFrame('f');
    expect(props()).toMatchObject({ frame: true, frameOutside: true, crop }); // Bildbereich bleibt die Box, Ausschnitt unverändert
    expect(undos()).toBe(before + 2);
  });

  it('takeContent übernimmt frame und frameOutside vom Platzhalter', () => {
    load({ ...project(1), assets: { [ID]: { mime: 'image/png', width: 1000, height: 1000, name: 'x.png' } } });
    const ph = (props: Partial<PhotoProps>) => el({ type: 'photo', width: 500, height: 600, props: { crop: { x: 0, y: 0, scale: 1 }, ...props } }) as Element<PhotoProps>;
    const take = (into: Partial<PhotoProps>, from: Partial<PhotoProps>) => photoType.takeContent!(ph(into), ph({ assetId: ID, ...from }), useDoc.getState().project!)!.props;
    expect(take({ frame: true, frameOutside: true }, {})).toMatchObject({ frame: true, frameOutside: true, crop: { scale: 0.6 } });
    const plain = take({}, { frame: true, frameOutside: true });
    expect(plain.frame).toBeUndefined();
    expect(plain.frameOutside).toBeUndefined();
    expect(take({ frame: true }, { frame: true, frameOutside: true }).frameOutside).toBeUndefined();
    expect(take({}, { grain: true, grainStrength: 60 })).toMatchObject({ grain: true, grainStrength: 60 }); // Korn gehört zum Bild
  });

  it('afterTransform mit Rahmen: Ausschnitt deckt den Bildbereich, nicht die ganze Box', () => {
    load({ ...project(1), assets: { [ID]: { mime: 'image/png', width: 1000, height: 1000, name: 'x.png' } } });
    const photo = el({ type: 'photo', width: 882, height: 1034, props: { assetId: ID, crop: { x: 0, y: 0, scale: 1 }, frame: true } }) as never;
    const patch = photoType.afterTransform(photo, { x: 0, y: 0, width: 1048, height: 548, rotation: 0 });
    // Bildbereich 1000 × 500: Skalierung 1, zentriert
    expect((patch.props as PhotoProps).crop).toEqual({ x: 0, y: -250, scale: 1 });
  });

  it('afterTransform, Box proportional um k: derselbe sichtbare Bildausschnitt, auch mit Rahmen (aussen und alter Innenrahmen)', () => {
    load({ ...project(1), assets: { [ID]: { mime: 'image/png', width: 1000, height: 1000, name: 'x.png' } } });
    const crop = { x: -150, y: -100, scale: 0.8 };
    for (const frame of [{}, { frame: true, frameOutside: true }, { frame: true }]) {
      for (const k of [1.32, 0.68]) {
        const photo = el({ type: 'photo', width: 500, height: 600, props: { assetId: ID, crop, ...frame } }) as Element<PhotoProps>;
        const box = { x: 0, y: 0, width: 500 * k, height: 600 * k, rotation: 0 };
        const next = (photoType.afterTransform(photo, box).props as PhotoProps).crop;
        // Bildpunkt oben links im Bildbereich bleibt derselbe; der Zoom wächst mit dem Bildbereich
        const [a, b] = [imageArea(photo.props, photo), imageArea(photo.props, box)];
        expect(-next.x / next.scale, JSON.stringify(frame)).toBeCloseTo(-crop.x / crop.scale, 6);
        expect(-next.y / next.scale, JSON.stringify(frame)).toBeCloseTo(-crop.y / crop.scale, 6);
        expect(next.scale, JSON.stringify(frame)).toBeCloseTo((crop.scale * b.width) / a.width, 6);
      }
    }
  });

  it('Verlauf ist optional (fehlt = kein Verlauf, kein Effekt); nur gültige Seiten, Stärken und Reichweiten 30..100', () => {
    registerPlugins();
    const old = { assetId: ID, crop: { x: 0, y: 0, scale: 1 } };
    expect(scrimsOf(old)).toEqual([]);
    expect(scrimSteps(old)).toEqual([]);
    const ok = (scrim: object) => photoType.propsSchema.safeParse({ ...old, scrim }).success && photoType.propsSchema.safeParse({ ...old, scrims: [scrim] }).success;
    expect(ok({ side: 'unten', strength: 'stark' })).toBe(true);
    expect(ok({ side: 'links', strength: 'leicht', reach: 30, light: true })).toBe(true);
    expect(ok({ side: 'rechts', strength: 'mittel', reach: 100 })).toBe(true);
    expect(ok({ side: 'mitte', strength: 'stark' })).toBe(false);
    expect(ok({ side: 'oben', strength: 'extrem' })).toBe(false);
    expect(ok({ side: 'oben' })).toBe(false);
    expect(ok({ side: 'oben', strength: 'stark', reach: 29 })).toBe(false);
    expect(ok({ side: 'oben', strength: 'stark', reach: 101 })).toBe(false);
    expect(ok({ side: 'oben', strength: 'stark', reach: 50.5 })).toBe(false);
    expect(effects.get('scrim').active(scrimSteps({ ...old, scrim: { side: 'oben', strength: 'leicht' } })[0])).toBe(true);
    // Ecken gültig; höchstens scrim.max (4) Verläufe
    expect(ok({ side: 'untenRechts', strength: 'mittel' })).toBe(true);
    const four = Array.from({ length: 4 }, () => ({ side: 'oben', strength: 'leicht' }));
    expect(photoType.propsSchema.safeParse({ ...old, scrims: four }).success).toBe(true);
    expect(photoType.propsSchema.safeParse({ ...old, scrims: [...four, four[0]] }).success).toBe(false);
  });

  it('altes Einzelfeld scrim rendert dieselben Schritte wie vorher, als scrims geschrieben ebenso', () => {
    const old = { assetId: ID, crop: { x: 0, y: 0, scale: 1 }, scrim: { side: 'links', strength: 'leicht', reach: 40 } } as const;
    const want = [{ side: 'links', strength: 'leicht', reach: 40, light: false }];
    expect(scrimSteps(old)).toEqual(want);
    expect(scrimSteps({ assetId: ID, crop: old.crop, scrims: [old.scrim] })).toEqual(want);
  });

  it('Verlauf: Standard-Reichweite 56, abdunkeln; gespiegelt bleibt die gewählte Seite der Box (Canvas ist ungespiegelt)', () => {
    const p = (side: 'oben' | 'unten' | 'links' | 'rechts', flipX = false) =>
      ({ assetId: ID, crop: { x: 0, y: 0, scale: 1 }, flipX, scrim: { side, strength: 'stark' as const } });
    expect(scrimSteps(p('unten'))).toEqual([{ side: 'unten', strength: 'stark', reach: 56, light: false }]);
    expect(scrimSteps(p('links', true))[0]?.side).toBe('rechts');
    expect(scrimSteps(p('rechts', true))[0]?.side).toBe('links');
    expect(scrimSteps(p('oben', true))[0]?.side).toBe('oben');
    expect(scrimSteps(p('unten', true))[0]?.side).toBe('unten');
  });

  it('Verlauf senkrecht gespiegelt: oben und unten tauschen, Ecken auch, links/rechts bleiben', () => {
    const p = (side: Scrim['side'], flipX = false) => ({ assetId: ID, crop: { x: 0, y: 0, scale: 1 }, flipX, flipY: true, scrims: [{ side, strength: 'stark' as const }] });
    expect(scrimSteps(p('oben'))[0]?.side).toBe('unten');
    expect(scrimSteps(p('unten'))[0]?.side).toBe('oben');
    expect(scrimSteps(p('links'))[0]?.side).toBe('links');
    expect(scrimSteps(p('obenLinks'))[0]?.side).toBe('untenLinks');
    expect(scrimSteps(p('obenLinks', true))[0]?.side).toBe('untenRechts');
  });

  it('Layoutwechsel (R8): Verlauf wie im bisherigen Platzhalter folgt dem neuen Layout, selbst gewählter bleibt', () => {
    load({ ...project(1), assets: { [ID]: { mime: 'image/png', width: 1000, height: 1000, name: 'x.png' } } });
    const leicht = { side: 'oben', strength: 'leicht' } as const;
    const stark = { side: 'unten', strength: 'stark' } as const;
    // Platzhalter der Layouts tragen das alte `scrim`, Fotos des Nutzers `scrims`
    const ph = (list: Scrim[] | undefined, assetId?: string, legacy = false) =>
      el({ type: 'photo', props: { assetId, ...(legacy ? { scrim: list?.[0] } : { scrims: list }) } }) as Element<PhotoProps>;
    const take = (into: Scrim[] | undefined, from: Scrim[] | undefined, base?: Element<PhotoProps>, legacy = true) => {
      const props = photoType.takeContent!(ph(into, undefined, legacy), ph(from, ID, legacy), useDoc.getState().project!, base)!.props;
      expect(props.scrim).toBeUndefined(); // das alte Feld wird nie mehr geschrieben
      return scrimsOf(props);
    };
    const b = ph([leicht], undefined, true);
    expect(take([stark], [leicht], b)).toEqual([stark]); // Titel → Vollbild
    expect(take([stark], [{ ...leicht, reach: 56 }], b)).toEqual([stark]); // Standard-Reichweite ausgeschrieben
    expect(take([], [leicht], b)).toEqual([]); // Titel → Collage
    expect(take([stark], [{ ...leicht, strength: 'mittel' }], b)).toEqual([{ ...leicht, strength: 'mittel' }]);
    expect(take([stark], [{ ...leicht, light: true }], b)).toEqual([{ ...leicht, light: true }]);
    expect(take([stark], [], b)).toEqual([]); // «Aus» gewählt bleibt aus
    expect(take([stark], [])).toEqual([stark]); // freies Foto ohne Verlauf
    expect(take([stark], [leicht])).toEqual([leicht]); // freies Foto mit eigenem Verlauf
    // Listen: gleiche Liste wie im Platzhalter folgt dem Layout, geänderte Reihenfolge, Länge oder Ecke bleibt
    const lb = ph([leicht, stark], undefined, false);
    expect(take([stark], [leicht, stark], lb, false)).toEqual([stark]);
    expect(take([stark], [stark, leicht], lb, false)).toEqual([stark, leicht]);
    expect(take([stark], [leicht], lb, false)).toEqual([leicht]);
    expect(take([], [leicht, { ...stark, side: 'untenLinks' }], lb, false)).toEqual([leicht, { ...stark, side: 'untenLinks' }]);
    // Layout mit altem scrim, Foto mit gleichem Wert als scrims: gleich
    expect(take([stark], [leicht], b, false)).toEqual([stark]);
  });
});

describe('canAddScrim', () => {
  const base = { assetId: ID, crop: { x: 0, y: 0, scale: 1 } };
  const s = (side: Scrim['side']): Scrim => ({ side, strength: 'mittel' });
  it('erlaubt bis zu vier Verläufe, den fünften nicht (auch aus dem alten Einzelfeld gezählt)', () => {
    expect(canAddScrim(base)).toBe(true);
    expect(canAddScrim({ ...base, scrim: s('oben') })).toBe(true);
    expect(canAddScrim({ ...base, scrims: [s('oben'), s('unten'), s('links')] })).toBe(true);
    expect(canAddScrim({ ...base, scrims: [s('oben'), s('unten'), s('links'), s('rechts')] })).toBe(false);
  });
});

describe('Maske am Foto', () => {
  const crop = { x: 0, y: 0, scale: 1 };
  it('mask ist optional und muss ein Hash sein', () => {
    expect(photoPropsSchema.safeParse({ crop }).success).toBe(true);
    expect(photoPropsSchema.safeParse({ crop, mask: 'a'.repeat(64) }).success).toBe(true);
    expect(photoPropsSchema.safeParse({ crop, mask: 'nope' }).success).toBe(false);
  });
});
