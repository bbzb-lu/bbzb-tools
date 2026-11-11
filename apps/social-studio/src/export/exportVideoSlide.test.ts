import { describe, expect, it } from 'vitest';
import { el, project } from '../model/fixtures';
import { decodeWidth, frameCount, frameTime, isVideoSlide, soundSource, videosOn } from './exportVideoSlide';

const vid = (id: string, o: { x?: number; start?: number; end?: number; sound?: boolean; visible?: boolean; rotation?: number } = {}) =>
  el({
    id,
    type: 'photo',
    x: o.x ?? 0,
    width: 500,
    height: 500,
    rotation: o.rotation ?? 0,
    visible: o.visible ?? true,
    props: { assetId: 'a', crop: { x: 0, y: 0, scale: 1 }, video: { start: o.start ?? 0, end: o.end ?? 4, sound: o.sound ?? false, duration: 120 } },
  });
const photo = el({ id: 'f', type: 'photo', props: { assetId: 'b', crop: { x: 0, y: 0, scale: 1 } } });

describe('Video-Slide', () => {
  it('sichtbares Video, das die Slide schneidet, macht sie zur Video-Slide', () => {
    const p = project(3, [photo, vid('v', { x: 1080 + 100 })]);
    expect([0, 1, 2].map((i) => isVideoSlide(p, i))).toEqual([false, true, false]);
  });

  it('über die Naht: beide Slides; ausgeblendet: keine', () => {
    expect([0, 1].map((i) => isVideoSlide(project(2, [vid('v', { x: 800 })]), i))).toEqual([true, true]);
    expect(isVideoSlide(project(1, [vid('v', { visible: false })]), 0)).toBe(false);
  });

  it('1 px Überlappung zählt, blosses Anstossen und ganz ausserhalb nicht', () => {
    expect(isVideoSlide(project(1, [vid('v', { x: -499 })]), 0)).toBe(true);
    expect(isVideoSlide(project(1, [vid('v', { x: -500 })]), 0)).toBe(false);
    expect(isVideoSlide(project(1, [vid('v', { x: -600 })]), 0)).toBe(false);
    // gedreht: Begrenzungsrechteck ragt in die Slide
    expect(isVideoSlide(project(1, [vid('v', { x: -520, rotation: -45 })]), 0)).toBe(true);
  });

  it('Fotos sind keine Videos', () => {
    expect(isVideoSlide(project(1, [photo]), 0)).toBe(false);
    expect(videosOn(project(1, [photo, vid('v')]), 0).map((e) => e.id)).toEqual(['v']);
  });
});

describe('Dauer und Frame-Zeiten', () => {
  it('längstes gekürztes Video (Ende minus Start, nicht die Dateilänge)', () => {
    expect(frameCount([vid('a', { start: 1, end: 3 }), vid('b', { start: 10, end: 14 })])).toBe(120);
  });

  it('höchstens 60 s', () => {
    expect(frameCount([vid('a', { start: 5, end: 100 })])).toBe(1800);
  });

  it('rundet statt abzuschneiden (9.999999 s ergibt 300 Frames)', () => {
    expect(frameCount([vid('a', { start: 0, end: 9.999999 })])).toBe(300);
  });

  it('Zeiten bei 30 fps ab dem Start des Videos', () => {
    const v = vid('a', { start: 2.5, end: 4.5 });
    expect([0, 1, 30].map((k) => frameTime(v, k))).toEqual([2.5, 2.5 + 1 / 30, 3.5]);
  });

  it('kürzeres Video bleibt auf seinem letzten Bild stehen', () => {
    const v = vid('a', { start: 1, end: 2 });
    expect(frameTime(v, 29)).toBeCloseTo(1 + 29 / 30);
    expect(frameTime(v, 30)).toBe(frameTime(v, 29));
    expect(frameTime(v, 200)).toBe(frameTime(v, 29));
  });

  it('längeres Video als 60 s steht am Schluss der Slide nicht still', () => {
    const v = vid('a', { start: 0, end: 100 });
    expect(frameTime(v, 1799)).toBeCloseTo(1799 / 30);
  });
});

describe('Ton', () => {
  it('erstes sichtbares Video der Slide mit Ton an (Ebenenreihenfolge)', () => {
    const p = project(1, [vid('a'), vid('b', { sound: true }), vid('c', { sound: true })]);
    expect(soundSource(p, 0)?.id).toBe('b');
  });

  it('ausgeblendet oder auf anderer Slide zählt nicht; ohne Ton keiner', () => {
    expect(soundSource(project(2, [vid('a', { sound: true, visible: false }), vid('b', { sound: true, x: 1200 }), vid('c')]), 0)).toBeUndefined();
  });
});

describe('Dekodiergrösse', () => {
  it('Querformat in voller Auflösung (lange Seite höchstens 1920), Hochformat bleibt 1080', () => {
    expect(decodeWidth(1920, 1080)).toBe(1920);
    expect(decodeWidth(1080, 1920)).toBe(1080);
    expect(decodeWidth(3840, 2160)).toBe(1920);
    expect(decodeWidth(2160, 3840)).toBe(1080);
    expect(decodeWidth(640, 360)).toBe(640);
  });
});
