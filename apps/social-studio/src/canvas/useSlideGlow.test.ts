import { describe, expect, it } from 'vitest';
import { glowAt } from './useSlideGlow';

describe('glowAt', () => {
  it('über und unter einer Slide voll, auf ihr zurückgezogen, neben allen Slides keiner', () => {
    expect(glowAt(150, -5, 100, 200, 3)).toEqual({ slide: 1, state: 'on' });
    expect(glowAt(150, 205, 100, 200, 3)).toEqual({ slide: 1, state: 'on' });
    expect(glowAt(150, 100, 100, 200, 3)).toEqual({ slide: 1, state: 'near' });
    expect(glowAt(299, 250, 100, 200, 3)).toEqual({ slide: 2, state: 'on' });
    expect(glowAt(-1, -5, 100, 200, 3)).toBeNull();
    expect(glowAt(300, -5, 100, 200, 3)).toBeNull();
  });
});
