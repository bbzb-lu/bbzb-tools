import { describe, expect, it, vi } from 'vitest';
import type { BrandAsset } from '../../../brand/manifest';
import type { EditorContext } from '../../../core/types';
import { el, project } from '../../../model/fixtures';
import type { Project } from '../../../model/types';
import { memoryAssetStore } from '../../../storage/assets';
import { brandType } from './index';
import type { BrandProps } from './schema';

// Seitenverhältnis 2 : 1 (Höhe : Breite), wie ein hohes Scribble
vi.mock('../../../canvas/images', () => ({ loadUrlImage: () => Promise.resolve({ naturalWidth: 100, naturalHeight: 200 }) }));

const scribble: BrandAsset = { id: 'scribble-01', file: 'scribbles/a.png', name: 'Scribble 1', category: 'scribble', defaultColor: 'akzent', url: '/a.png' };

function ctx(p: Project, currentSlide = 0) {
  const apply = vi.fn((recipe: (d: Project) => void) => recipe(p));
  const c: EditorContext = { project: p, currentSlide, apply, assets: memoryAssetStore(), select: vi.fn(), notify: vi.fn() };
  return { c, apply, p };
}

describe('brandType', () => {
  it('nimmt Scribbles und Icons an, keine Texturen', () => {
    expect(brandType.acceptsAsset!(scribble)).toBe(true);
    expect(brandType.acceptsAsset!({ ...scribble, category: 'icon' })).toBe(true);
    expect(brandType.acceptsAsset!({ ...scribble, category: 'textur' })).toBe(false);
  });

  it('fügt mittig auf die aktuelle Slide ein, Standardfarbe aus dem Manifest, ein apply, ausgewählt', async () => {
    const { c, apply, p } = ctx(project(2), 1);
    await brandType.fromAsset!(scribble, c);
    expect(apply).toHaveBeenCalledTimes(1);
    const [e] = Object.values(p.elements);
    expect(e).toMatchObject({ type: 'brand', name: 'Scribble 1', width: 229, height: 458, rotation: 0 });
    expect(e!.x + e!.width / 2).toBe(1080 + 540);
    expect(e!.y + e!.height / 2).toBe(675);
    expect(e!.props).toEqual({ brandId: 'scribble-01', color: 'akzent' });
    expect(brandType.propsSchema.safeParse(e!.props).success).toBe(true);
    expect(c.select).toHaveBeenCalledWith(e!.id);
  });

  it('mit Position: Mitte an der Ablagestelle; ohne Standardfarbe «akzent» (Phase 2.5)', async () => {
    const { c, p } = ctx(project(1));
    await brandType.fromAsset!({ ...scribble, category: 'icon', defaultColor: undefined }, c, { x: 200, y: 300 });
    const [e] = Object.values(p.elements);
    expect([e!.x + e!.width / 2, e!.y + e!.height / 2]).toEqual([200, 300]);
    expect(e!.width).toBe(115); // 1:2-Bild, gleiche Fläche wie ein Quadrat von 162 px
    expect((e!.props as BrandProps).color).toBe('akzent');
    expect(e!.name).toBe('Icon 1');
  });

  it('Datei lädt nicht: Meldung, kein Element', async () => {
    const images = await import('../../../canvas/images');
    vi.spyOn(images, 'loadUrlImage').mockRejectedValueOnce(new Error('x'));
    const { c, apply } = ctx(project(1));
    await brandType.fromAsset!(scribble, c);
    expect(apply).not.toHaveBeenCalled();
    expect(c.notify).toHaveBeenCalledWith('error', expect.stringContaining('Scribble 1'));
  });

  it('skaliert nur proportional', () => {
    const e = el({ type: 'brand', width: 100, height: 200, props: { brandId: 'x', color: 'blau' } }) as never;
    expect(brandType.afterTransform(e, { x: 1, y: 2, width: 300, height: 100, rotation: 45 })).toEqual({ x: 1, y: 2, width: 300, height: 600, rotation: 45 });
  });

  it('Spiegeln ist optional (ältere Projekte), Farbe nur aus den Tokens', () => {
    expect(brandType.propsSchema.safeParse({ brandId: 'x', color: 'orange' }).success).toBe(true);
    expect(brandType.propsSchema.safeParse({ brandId: 'x', color: 'orange', flipX: true }).success).toBe(true);
    expect(brandType.propsSchema.safeParse({ brandId: 'x', color: '#FF4E00' }).success).toBe(false);
    expect(brandType.propsSchema.safeParse({ brandId: 'x', color: 'akzent' }).success).toBe(true);
  });
});
