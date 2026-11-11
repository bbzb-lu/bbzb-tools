import { describe, expect, it } from 'vitest';
import { fillPercent } from './Slider';

describe('fillPercent', () => {
  it('maps min to 0 and max to 100', () => {
    expect(fillPercent(0, 0, 100)).toBe(0);
    expect(fillPercent(100, 0, 100)).toBe(100);
    expect(fillPercent(-50, -50, 50)).toBe(0);
    expect(fillPercent(0, -50, 50)).toBe(50);
  });
  it('clamps values outside the range', () => {
    expect(fillPercent(150, 0, 100)).toBe(100);
    expect(fillPercent(-5, 0, 100)).toBe(0);
  });
  it('is 0 for an empty range (min = max)', () => {
    expect(fillPercent(5, 5, 5)).toBe(0);
  });
  it('is 0 for NaN (an empty or broken value never yields an invalid CSS value)', () => {
    expect(fillPercent(NaN, 0, 100)).toBe(0);
    expect(fillPercent(5, NaN, 100)).toBe(0);
  });
});
