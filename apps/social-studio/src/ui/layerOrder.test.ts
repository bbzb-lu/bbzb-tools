import { describe, expect, it } from 'vitest';
import { moveInOrder } from '../model/elements';
import { el, project } from '../model/fixtures';
import { orderIndexFor } from './layerOrder';

const run = (id: string, nb: string, where: 'above' | 'below') => {
  const p = project(1, ['a', 'b', 'c', 'd'].map((x) => el({ id: x })));
  moveInOrder(p, id, orderIndexFor(p.order, id, nb, where));
  return p.order.join('');
};

describe('orderIndexFor', () => {
  it('über einem Nachbarn weiter oben im Stapel', () => expect(run('a', 'c', 'above')).toBe('bcad'));
  it('über einem Nachbarn weiter unten im Stapel', () => expect(run('d', 'b', 'above')).toBe('abdc'));
  it('unter einem Nachbarn weiter oben im Stapel', () => expect(run('a', 'c', 'below')).toBe('bacd'));
  it('unter einem Nachbarn weiter unten im Stapel', () => expect(run('d', 'b', 'below')).toBe('adbc'));
  it('unter dem untersten, über dem obersten', () => {
    expect(run('c', 'a', 'below')).toBe('cabd');
    expect(run('a', 'd', 'above')).toBe('bcda');
  });
});
