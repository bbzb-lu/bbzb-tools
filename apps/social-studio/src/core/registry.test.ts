import { expect, it } from 'vitest';
import { createRegistry } from './registry';

it('wirft bei doppelter und unbekannter ID', () => {
  const r = createRegistry<{ id: string }>('Format');
  r.register({ id: 'post' });
  expect(() => r.register({ id: 'post' })).toThrow(/Format.*post/);
  expect(() => r.get('x')).toThrow(/Format.*x/);
  expect(r.has('post')).toBe(true);
  expect(r.all()).toEqual([{ id: 'post' }]);
});
