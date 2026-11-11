import { describe, expect, it } from 'vitest';
import { video } from '../../../tokens';
import { sliderMax, thumbTimes, trim } from './trim';

const v = { start: 1, end: 5, sound: false, duration: 9.9999 };

describe('Video kürzen', () => {
  it('Start bleibt zwischen 0 und Ende − Mindestlänge', () => {
    expect(trim(v, 'start', 2.5)).toEqual({ ...v, start: 2.5 });
    expect(trim(v, 'start', -3)).toEqual({ ...v, start: 0 });
    expect(trim(v, 'start', 4.6)).toEqual({ ...v, start: 5 - video.minLength });
  });

  it('Ende bleibt zwischen Start + Mindestlänge und Dauer', () => {
    expect(trim(v, 'end', 7)).toEqual({ ...v, end: 7 });
    expect(trim(v, 'end', 10)).toEqual({ ...v, end: 9.9999 });
    expect(trim(v, 'end', 1.2)).toEqual({ ...v, end: 1 + video.minLength });
  });

  it('Regler reicht bis zur Dauer, auf eine Zehntelsekunde aufgerundet', () => {
    expect(sliderMax(9.9999)).toBe(10);
    expect(sliderMax(4)).toBe(4);
    expect(sliderMax(4.01)).toBe(4.1);
  });

  it('Vorschaubilder: erstes Bild bei Start, letztes ein Bild vor Ende', () => {
    expect(thumbTimes(v)).toEqual([1, 5 - 1 / video.fps]);
  });
});
