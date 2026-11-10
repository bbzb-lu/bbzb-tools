import { describe, expect, it } from 'vitest';
import { parseField } from './NumberField';

describe('parseField', () => {
  it('rundet und begrenzt', () => {
    expect(parseField('12.6', 0, 100)).toBe(13);
    expect(parseField('500', 0, 100)).toBe(100);
    expect(parseField('-5', 0, 100)).toBe(0);
  });
  it('rundet auf den Schritt (Sekunden mit Zehnteln), Komma gilt als Dezimalzeichen', () => {
    expect(parseField('2.46', 0, 10, 0.1)).toBe(2.5);
    expect(parseField('2,34', 0, 10, 0.1)).toBe(2.3);
    expect(parseField('0.3', 0, 10, 0.1)).toBe(0.3);
  });
  it('leer oder ungültig gibt null', () => {
    expect(parseField('', 0, 100)).toBeNull();
    expect(parseField('  ', 0, 100)).toBeNull();
    expect(parseField('abc', 0, 100)).toBeNull();
  });
});
