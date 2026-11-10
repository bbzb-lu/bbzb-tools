import { produce } from 'immer';
import { describe, expect, it, vi } from 'vitest';
import type { EditorContext } from '../../../core/types';
import { coverCrop } from '../../../model/crop';
import { el, project } from '../../../model/fixtures';
import type { Element, Project } from '../../../model/types';
import { memoryAssetStore } from '../../../storage/assets';
import { photoType } from './index';
import type { PhotoProps } from './schema';

vi.mock('./importImage', async (orig) => ({
  ...(await orig<typeof import('./importImage')>()),
  importImage: vi.fn(async () => ({ blob: new Blob(['x']), width: 2000, height: 1000, mime: 'image/jpeg' })),
}));

const placeholder = (props: Partial<PhotoProps> = {}) =>
  el({ id: 'ph', type: 'photo', role: 'foto', x: 1080, y: 100, width: 780, height: 380, props: { crop: { x: 0, y: 0, scale: 1 }, ...props } }) as Element<PhotoProps>;

function ctxFor(p: Project) {
  const state = { p };
  const ctx: EditorContext = {
    project: p,
    currentSlide: 0,
    apply: vi.fn((recipe) => void (state.p = produce(state.p, recipe))),
    assets: memoryAssetStore(),
    select: vi.fn(),
    notify: vi.fn(),
  };
  return { ctx, state };
}

describe('Foto-Platzhalter', () => {
  it('fromLayout: leerer Platzhalter mit Korn und Look ausdrücklich an (Ruling R10)', () => {
    const out = photoType.fromLayout!(el({ type: 'photo', role: 'foto', props: { grain: false } }) as Element<PhotoProps>);
    expect(out.props).toEqual({ crop: { x: 0, y: 0, scale: 1 }, grain: true, look: true });
    expect(photoType.propsSchema.safeParse(out.props).success).toBe(true);
  });

  it('Datei füllt den Platzhalter deckend, Look an und Korn aus, Rahmen und Rolle bleiben, ein apply', async () => {
    const { ctx, state } = ctxFor(project(2, [placeholder({ grain: false, look: false, flipX: true })]));
    await photoType.fillFromFile!(state.p.elements.ph as Element<PhotoProps>, new File(['x'], 'neu.jpg', { type: 'image/jpeg' }), ctx);
    expect(ctx.apply).toHaveBeenCalledTimes(1);
    const ph = state.p.elements.ph as Element<PhotoProps>;
    const assetId = (await ctx.assets.list())[0]!.id;
    expect(ph.props).toEqual({ assetId, crop: coverCrop(ph, { width: 2000, height: 1000 }), grain: false, look: true, flipX: true });
    expect(ph).toMatchObject({ role: 'foto', x: 1080, y: 100, width: 780, height: 380 });
    expect(state.p.assets[assetId]).toMatchObject({ width: 2000, height: 1000, name: 'neu.jpg' });
    expect(ctx.select).toHaveBeenCalledWith('ph');
  });

  it('Platzhalter mit Rahmen: Ausschnitt deckt den Bildbereich, Rahmen bleibt an', async () => {
    const { ctx, state } = ctxFor(project(2, [placeholder({ frame: true })]));
    await photoType.fillFromFile!(state.p.elements.ph as Element<PhotoProps>, new File(['x'], 'neu.jpg', { type: 'image/jpeg' }), ctx);
    const ph = state.p.elements.ph as Element<PhotoProps>;
    expect(ph.props.frame).toBe(true);
    expect(ph.props.crop).toEqual(coverCrop({ width: 780 - 48, height: 380 - 48 }, { width: 2000, height: 1000 }));
  });

  it('Platzhalter inzwischen gelöscht: kein Element entsteht', async () => {
    const { ctx, state } = ctxFor(project(1));
    await photoType.fillFromFile!(placeholder(), new File(['x'], 'neu.jpg', { type: 'image/jpeg' }), ctx);
    expect(state.p.elements).toEqual({});
    expect(ctx.select).not.toHaveBeenCalled();
  });
});

describe('Inhalt beim Layoutwechsel', () => {
  const H = 'b'.repeat(64);
  const p = { ...project(1), assets: { [H]: { mime: 'image/jpeg', width: 2000, height: 1000, name: 'a.jpg' } } };
  const into = el({ type: 'photo', role: 'foto', width: 1080, height: 1350, props: {} }) as Element<PhotoProps>;

  it('nur ein Foto mit Bild trägt Inhalt', () => {
    expect(photoType.hasContent!(placeholder())).toBe(false);
    expect(photoType.hasContent!(placeholder({ assetId: H }))).toBe(true);
  });

  it('Bild, Look, Korn und Regler ziehen mit; Ausschnitt deckt den neuen Rahmen', () => {
    const from = placeholder({ assetId: H, look: false, grain: false, flipX: true, crop: { x: -5, y: 0, scale: 2 } });
    const r = photoType.takeContent!(into, from, p)!;
    expect(r.props).toEqual({ assetId: H, look: false, grain: false, flipX: true, crop: coverCrop(into, { width: 2000, height: 1000 }) });
    expect(photoType.fromLayout!(r).props).toMatchObject({ look: false, grain: false }); // Wahl bleibt
    expect(photoType.takeContent!(into, placeholder(), p)).toBeUndefined();
  });

  it('Rahmen bestimmt der neue Platzhalter (Layout), der Ausschnitt deckt dessen Bildbereich', () => {
    const framed = photoType.takeContent!({ ...into, props: { ...into.props, frame: true } }, placeholder({ assetId: H }), p)!;
    expect(framed.props).toMatchObject({ frame: true, crop: coverCrop({ width: 1080 - 48, height: 1350 - 48 }, { width: 2000, height: 1000 }) });
    expect(photoType.takeContent!(into, placeholder({ assetId: H, frame: true }), p)!.props.frame).toBeUndefined();
  });

  it('Foto aus altem Projekt (ohne Korn und Look) bekommt im Layout beides ausdrücklich', () => {
    const r = photoType.takeContent!(into, placeholder({ assetId: H }), p)!;
    expect(photoType.fromLayout!(r).props).toMatchObject({ grain: true, look: true });
  });
});

describe('Maske beim Layoutwechsel', () => {
  it('Maske zieht mit dem Foto um', () => {
    const H = 'b'.repeat(64);
    const M = 'c'.repeat(64);
    const p = { ...project(1), assets: { [H]: { mime: 'image/jpeg', width: 2000, height: 1000, name: 'a.jpg' } } };
    const into = el({ type: 'photo', role: 'foto', width: 1080, height: 1350, props: {} }) as Element<PhotoProps>;
    const r = photoType.takeContent!(into, placeholder({ assetId: H, mask: M }), p)!;
    expect(r.props.mask).toBe(M);
  });
});
