import { describe, expect, it } from 'vitest';
import { dragValue, keyValue, knobAngle, moveHandle, snap } from './sliderMath';

describe('snap', () => {
  it('rounds to the step and clamps', () => {
    expect(snap(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
    expect(snap(120, 0, 100)).toBe(100);
    expect(snap(-3, 0, 100)).toBe(0);
  });
});
describe('keyValue', () => {
  it('maps arrows, pages, Home and End; ignores other keys', () => {
    expect(keyValue('ArrowRight', 5, 0, 10)).toBe(6);
    expect(keyValue('ArrowDown', 5, 0, 10)).toBe(4);
    expect(keyValue('PageUp', 5, 0, 100)).toBe(15);
    expect(keyValue('Home', 5, 0, 10)).toBe(0);
    expect(keyValue('End', 5, 0, 10)).toBe(10);
    expect(keyValue('ArrowUp', 10, 0, 10)).toBe(10);
    expect(keyValue('Tab', 5, 0, 10)).toBeNull();
  });
});
describe('dragValue', () => {
  it('moves up = larger, clamps at the ends', () => {
    expect(dragValue(50, -75, 0, 100)).toBe(100);
    expect(dragValue(50, 15, 0, 100)).toBe(40);
    expect(dragValue(50, 1000, 0, 100)).toBe(0);
    expect(dragValue(50, -1000, 0, 100)).toBe(100);
  });
});
describe('knobAngle', () => {
  it('runs from −135 to +135 degrees', () => {
    expect(knobAngle(0, 0, 100)).toBe(-135);
    expect(knobAngle(50, 0, 100)).toBe(0);
    expect(knobAngle(100, 0, 100)).toBe(135);
    expect(knobAngle(500, 0, 100)).toBe(135);
    expect(knobAngle(5, 5, 5)).toBe(-135);
  });
});
describe('moveHandle', () => {
  it('start never passes end, end never passes start (gap = step)', () => {
    expect(moveHandle('start', 90, 10, 50, 0, 100)).toEqual([49, 50]);
    expect(moveHandle('end', 2, 10, 50, 0, 100)).toEqual([10, 11]);
    expect(moveHandle('start', -5, 10, 50, 0, 100)).toEqual([0, 50]);
    expect(moveHandle('end', 5, 1, 2, 0, 100, 0.1)).toEqual([1, 5]);
    expect(moveHandle('start', 3, 1, 2, 0, 100, 0.1)).toEqual([1.9, 2]);
  });
});
