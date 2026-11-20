import { expect, it } from 'vitest';
import { MAX, explosion, hinzufuegen, konfetti, schritt, type Partikel } from './partikel';

const p = (o: Partial<Partikel> = {}): Partikel => ({ x: 0, y: 0, vx: 0, vy: 0, g: 0, reibung: 1, leben: 1, alter: 0, art: 'kreis', farbe: 'red', groesse: 2, wachs: 0, rot: 0, vrot: 0, ...o });

it('hinzufuegen hält höchstens MAX und wirft die ältesten raus', () => {
  const alt = Array.from({ length: MAX }, (_, i) => p({ x: i }));
  const r = hinzufuegen(alt, [p({ x: -1 }), p({ x: -2 })]);
  expect(r).toHaveLength(MAX);
  expect(r.at(-1)!.x).toBe(-2);
  expect(r[0]!.x).toBe(2);
});

it('schritt bewegt mit Schwerkraft nach unten und entfernt Abgelaufene', () => {
  const r = schritt([p({ g: 100 }), p({ alter: 0.95, leben: 1 })], 0.1);
  expect(r).toHaveLength(1);
  expect(r[0]!.y).toBeGreaterThan(0);
});

it('explosion hat einen Ring und viele Teile, konfetti die gewünschte Zahl', () => {
  const e = explosion(0, 0, ['red', 'blue']);
  expect(e.some((t) => t.art === 'ring')).toBe(true);
  expect(e.length).toBeGreaterThan(30);
  expect(konfetti(0, 0, 90, ['red'], Math.random, 40)).toHaveLength(40);
});
