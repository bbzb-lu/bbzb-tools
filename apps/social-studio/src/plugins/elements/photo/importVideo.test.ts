import { describe, expect, it } from 'vitest';
import { video } from '../../../tokens';
import { importVideo, isVideoFile, VideoImportError, type VideoProbe } from './importVideo';

const probe = (p: Partial<VideoProbe> = {}) => () => Promise.resolve({ duration: 10, width: 1080, height: 1920, canDecode: true, ...p });
const file = (name = 'a.mp4', type = 'video/mp4', size = 8) => new File([new Uint8Array(size)], name, { type });

describe('isVideoFile', () => {
  it('Typ oder Endung', () => {
    expect(isVideoFile(file())).toBe(true);
    expect(isVideoFile(file('IMG_1.MOV', ''))).toBe(true);
    expect(isVideoFile(file('a.webm', 'video/webm'))).toBe(false);
    expect(isVideoFile(file('a.png', 'image/png'))).toBe(false);
  });
});

describe('importVideo', () => {
  it('baut Mime, Masse und Ausschnitt', async () => {
    const r = await importVideo(file('IMG.MOV', ''), probe({ duration: 12.5 }));
    expect(r).toMatchObject({ mime: 'video/quicktime', width: 1080, height: 1920, video: { start: 0, end: 12.5, sound: false, duration: 12.5 } });
    expect(r.warning).toBeUndefined();
  });

  it('kürzt auf die Slide-Höchstdauer und warnt bei langem Video', async () => {
    const r = await importVideo(file(), probe({ duration: video.warnSeconds + 5 }));
    expect(r.video).toMatchObject({ end: video.maxSlideSeconds, duration: video.warnSeconds + 5 });
    expect(r.warning).toContain('langsam');
  });

  it('warnt bei grosser Datei', async () => {
    const f = file();
    Object.defineProperty(f, 'size', { value: video.warnBytes + 1 });
    expect((await importVideo(f, probe())).warning).toContain('langsam');
  });

  it('nicht dekodierbar, nicht lesbar, zu kurz: Fehler mit Text', async () => {
    await expect(importVideo(file(), probe({ canDecode: false }))).rejects.toThrow(/Edge kann dieses Video nicht abspielen/);
    await expect(importVideo(file(), () => Promise.reject(new Error('bad')))).rejects.toBeInstanceOf(VideoImportError);
    await expect(importVideo(file(), probe({ duration: 0.5 }))).rejects.toThrow(/kürzer/);
  });
});
