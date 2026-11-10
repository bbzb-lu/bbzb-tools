import { describe, expect, it, vi } from 'vitest';
import type { EditorContext } from '../../../core/types';
import { el, project } from '../../../model/fixtures';
import type { Element, Project } from '../../../model/types';
import { fillPhoto, photoFromFile } from './fromFile';
import { VideoImportError } from './importVideo';
import type { PhotoProps } from './schema';

const V = { start: 0, end: 8, sound: false, duration: 8 };
const importVideoMock = vi.hoisted(() => vi.fn());
vi.mock('./importVideo', async (orig) => ({ ...(await orig<typeof import('./importVideo')>()), importVideo: importVideoMock }));
const okVideo = () => importVideoMock.mockResolvedValue({ blob: new Blob(['v']), mime: 'video/mp4', width: 1080, height: 1920, video: V });

vi.mock('./importImage', () => ({
  ImportError: class extends Error {},
  importImage: () => Promise.resolve({ blob: new Blob(['x']), mime: 'image/png', width: 100, height: 100 }),
}));

const setup = (p: Project) => {
  const ctx: EditorContext = {
    project: p,
    currentSlide: 0,
    apply: (fn) => fn(p),
    assets: { put: () => Promise.resolve('b'.repeat(64)) } as never,
    select: vi.fn(),
    notify: vi.fn(),
  };
  return ctx;
};

describe('neue Fotos', () => {
  it('photoFromFile: ohne Korn, mit Look', async () => {
    const p = project(1);
    await photoFromFile(new File(['x'], 'a.png'), setup(p));
    const photo = Object.values(p.elements).find((e) => e.type === 'photo') as Element<PhotoProps>;
    expect(photo.props.grain).toBe(false);
    expect(photo.props.look).toBe(true);
  });

  it('fillPhoto in einen leeren Platzhalter: ohne Korn, mit Look', async () => {
    const p = project(1, [el({ id: 'ph', type: 'photo', props: { crop: { x: 0, y: 0, scale: 1 }, grain: true } })]);
    await fillPhoto(p.elements['ph'] as Element<PhotoProps>, new File(['x'], 'a.png'), setup(p));
    expect((p.elements['ph'] as Element<PhotoProps>).props).toMatchObject({ grain: false, look: true });
  });

  it('Foto ersetzen behält die Wahl beim Korn (an und aus)', async () => {
    const A = 'a'.repeat(64);
    for (const grain of [true, false]) {
      const p = project(1, [el({ id: 'ph', type: 'photo', props: { assetId: A, crop: { x: 0, y: 0, scale: 1 }, grain } })]);
      await fillPhoto(p.elements['ph'] as Element<PhotoProps>, new File(['x'], 'a.png'), setup(p));
      expect((p.elements['ph'] as Element<PhotoProps>).props).toMatchObject({ assetId: 'b'.repeat(64), grain, look: true });
    }
  });

  it('Foto ersetzen ohne gesetztes Korn: aus', async () => {
    const p = project(1, [el({ id: 'ph', type: 'photo', props: { assetId: 'a'.repeat(64), crop: { x: 0, y: 0, scale: 1 } } })]);
    await fillPhoto(p.elements['ph'] as Element<PhotoProps>, new File(['x'], 'a.png'), setup(p));
    expect((p.elements['ph'] as Element<PhotoProps>).props.grain).toBe(false);
  });
});

describe('Video', () => {
  const crop = { x: 0, y: 0, scale: 1 };
  const mp4 = () => new File(['x'], 'a.mp4', { type: 'video/mp4' });

  it('photoFromFile: Element mit video, Asset mit Videomime, Hash über Kopf und Ende', async () => {
    okVideo();
    const p = project(1);
    const put = vi.fn().mockResolvedValue('c'.repeat(64));
    await photoFromFile(mp4(), { ...setup(p), assets: { put } as never });
    const photo = Object.values(p.elements).find((e) => e.type === 'photo') as Element<PhotoProps>;
    expect(photo.props).toMatchObject({ assetId: 'c'.repeat(64), video: V });
    expect(p.assets['c'.repeat(64)]).toMatchObject({ mime: 'video/mp4', width: 1080, height: 1920 });
    expect(put).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^[0-9a-f]{64}$/));
  });

  it('Warnung: Import klappt, Meldung als info', async () => {
    importVideoMock.mockResolvedValue({ blob: new Blob(['v']), mime: 'video/mp4', width: 10, height: 10, video: V, warning: 'langsam' });
    const p = project(1);
    const ctx = setup(p);
    await photoFromFile(mp4(), ctx);
    expect(ctx.notify).toHaveBeenCalledWith('info', 'langsam');
    expect(Object.values(p.elements)).toHaveLength(1);
  });

  it('Video ersetzt Foto und umgekehrt (Foto löscht video)', async () => {
    okVideo();
    const p = project(1, [el({ id: 'ph', type: 'photo', props: { assetId: 'a'.repeat(64), crop } })]);
    await fillPhoto(p.elements['ph'] as Element<PhotoProps>, mp4(), setup(p));
    expect((p.elements['ph'] as Element<PhotoProps>).props.video).toEqual(V);
    await fillPhoto(p.elements['ph'] as Element<PhotoProps>, new File(['x'], 'a.png'), setup(p));
    expect('video' in (p.elements['ph'] as Element<PhotoProps>).props).toBe(false);
  });

  it('Video ersetzt Foto: Rahmen, Spiegeln, Bildregler fallen weg', async () => {
    okVideo();
    const adjust = { brightness: 5, contrast: 0, saturation: 0, warmth: 0 };
    const p = project(1, [el({ id: 'ph', type: 'photo', props: { assetId: 'a'.repeat(64), crop, frame: true, frameOutside: true, flipX: true, flipY: true, adjust } })]);
    await fillPhoto(p.elements['ph'] as Element<PhotoProps>, mp4(), setup(p));
    const props = (p.elements['ph'] as Element<PhotoProps>).props;
    expect(['frame', 'frameOutside', 'flipX', 'flipY', 'adjust'].filter((k) => k in props)).toEqual([]);
  });

  it('Video ersetzt Video: Ausschnitt startet neu', async () => {
    importVideoMock.mockResolvedValue({ blob: new Blob(['v']), mime: 'video/mp4', width: 10, height: 10, video: { ...V, end: 3, duration: 3 } });
    const old = { start: 2, end: 6, sound: true, duration: 8 };
    const p = project(1, [el({ id: 'ph', type: 'photo', props: { assetId: 'a'.repeat(64), crop, video: old } })]);
    await fillPhoto(p.elements['ph'] as Element<PhotoProps>, mp4(), setup(p));
    expect((p.elements['ph'] as Element<PhotoProps>).props.video).toEqual({ start: 0, end: 3, sound: false, duration: 3 });
  });

  it('nicht abspielbar: Meldung, kein Element, nichts gespeichert', async () => {
    importVideoMock.mockRejectedValue(new VideoImportError());
    const p = project(1);
    const ctx = setup(p);
    const put = vi.fn();
    await photoFromFile(mp4(), { ...ctx, assets: { put } as never });
    expect(ctx.notify).toHaveBeenCalledWith('error', expect.stringContaining('Edge kann dieses Video nicht abspielen'));
    expect(Object.values(p.elements)).toHaveLength(0);
    expect(put).not.toHaveBeenCalled();
  });
});

describe('Maske beim Ersetzen', () => {
  it('Foto ersetzen verwirft die Maske', async () => {
    const props = { assetId: 'a'.repeat(64), mask: 'c'.repeat(64), crop: { x: 0, y: 0, scale: 1 } };
    const p = project(1, [el({ id: 'ph', type: 'photo', props })]);
    await fillPhoto(p.elements['ph'] as Element<PhotoProps>, new File(['x'], 'a.png'), setup(p));
    expect((p.elements['ph'] as Element<PhotoProps>).props).not.toHaveProperty('mask');
    expect((p.elements['ph'] as Element<PhotoProps>).props.assetId).toBe('b'.repeat(64));
  });
});
