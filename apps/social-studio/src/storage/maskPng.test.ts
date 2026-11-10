import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { newMask } from '../model/mask';
import { encodeMaskPng } from './maskAsset';

describe('encodeMaskPng', () => {
  it('liefert ein gültiges Graustufen-PNG mit den Maskenwerten', async () => {
    const m = newMask(5, 3);
    m.data.forEach((_, i) => (m.data[i] = (i * 17) % 256));
    const png = PNG.sync.read(Buffer.from(await encodeMaskPng(m).arrayBuffer()));
    expect([png.width, png.height]).toEqual([5, 3]);
    for (let i = 0; i < m.data.length; i++) expect([...png.data.slice(i * 4, i * 4 + 4)]).toEqual([m.data[i], m.data[i], m.data[i], 255]);
  });

  it('gleiche Maske, gleiche Bytes', async () => {
    const m = newMask(40, 30);
    m.data[7] = 3;
    const bytes = async () => Buffer.from(await encodeMaskPng(m).arrayBuffer());
    expect(await bytes()).toEqual(await bytes());
  });
});
