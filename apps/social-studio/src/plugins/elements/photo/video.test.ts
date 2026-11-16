import { describe, expect, it } from 'vitest';
import { video } from '../../../tokens';
import { copyElements } from '../../../model/clipboard';
import { duplicateElement } from '../../../model/elements';
import { el, project } from '../../../model/fixtures';
import type { Element } from '../../../model/types';
import { photoType } from './index';
import type { PhotoProps } from './schema';
import { adjustOf, flipOf, frameOf, imageArea, isVideo, photoPropsSchema, videoOf } from './schema';

const base = { crop: { x: 0, y: 0, scale: 1 } };
const v = { start: 1, end: 5, sound: false, duration: 10 };

describe('photo video', () => {
  it('Rahmen gilt am Video, Spiegeln und Bildregler nicht', () => {
    const extra = { frame: true, flipX: true, adjust: { brightness: 10, contrast: 0, saturation: 0, warmth: 0 } };
    const photo = { ...base, ...extra };
    const vid = { ...photo, video: v };
    expect([frameOf(photo), flipOf(photo), adjustOf(photo).brightness]).toEqual([true, true, 10]);
    expect([frameOf(vid), flipOf(vid), adjustOf(vid).brightness]).toEqual([true, false, 0]);
    expect(imageArea(vid, { width: 100, height: 80 })).toEqual(imageArea(photo, { width: 100, height: 80 }));
  });

  it('Video im Platzhalter mit Rahmen übernimmt den Rahmen (takeContent)', () => {
    const into = el({ type: 'photo', role: 'foto', width: 1080, height: 1350, props: { ...base, frame: true } }) as Element<PhotoProps>;
    const from = el({ id: 'ph', type: 'photo', role: 'foto', props: { ...base, assetId: 'a'.repeat(64), video: v } }) as Element<PhotoProps>;
    const p = project(1, []);
    p.assets['a'.repeat(64)] = { mime: 'video/mp4', width: 320, height: 400, name: 'v.mp4' };
    const r = photoType.takeContent!(into, from, p)!;
    expect(frameOf(r.props)).toBe(true);
  });

  it('akzeptiert Foto ohne und mit video', () => {
    expect(photoPropsSchema.safeParse(base).success).toBe(true);
    expect(photoPropsSchema.safeParse({ ...base, video: v }).success).toBe(true);
  });

  it('lehnt Unsinn ab', () => {
    const bad = (o: object) => photoPropsSchema.safeParse({ ...base, video: { ...v, ...o } }).success;
    expect(bad({ end: 1 })).toBe(false); // end = start
    expect(bad({ start: 1, end: 1 + video.minLength - 0.1 })).toBe(false); // zu kurz
    expect(bad({ end: 11 })).toBe(false); // ausserhalb duration
    expect(bad({ start: -1 })).toBe(false);
    expect(bad({ sound: 'ja' })).toBe(false);
    expect(bad({ duration: 0 })).toBe(false);
    expect(bad({ end: 1 + video.minLength })).toBe(true);
  });

  it('videoOf und isVideo', () => {
    expect(videoOf(base)).toBeUndefined();
    expect(isVideo(base)).toBe(false);
    expect(videoOf({ ...base, video: v })).toEqual(v);
    expect(isVideo({ ...base, video: v })).toBe(true);
  });

  it('Kopieren und Duplizieren behalten video', () => {
    const p = project(1, [el({ id: 'a', type: 'photo', props: { ...base, video: v } })]);
    expect((copyElements(p, ['a'])[0]!.props as { video: unknown }).video).toEqual(v);
    const id = duplicateElement(p, 'a');
    expect((p.elements[id!]!.props as { video: unknown }).video).toEqual(v);
  });
});
