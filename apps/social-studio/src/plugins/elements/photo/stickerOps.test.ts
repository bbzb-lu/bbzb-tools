import { beforeEach, describe, expect, it } from 'vitest';
import { el, project } from '../../../model/fixtures';
import { referencedAssetIds } from '../../../model/elements';
import { load, undo, useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { copyAsSticker, copyBehindTitle, titleOf } from './stickerOps';

const ID = 'a'.repeat(64);
const MID = 'b'.repeat(64);
const photoProps = { assetId: ID, mask: MID, crop: { x: 3, y: 4, scale: 1.5 }, flip: true };
const text = (id: string, fontSize: number, o = {}) => el({ id, type: 'text', x: 100, y: 100, props: { text: 't', style: 'titel', color: 'blauschwarz', fontSize, align: 'left' }, ...o });
const photo = (o = {}) => el({ id: 'p', type: 'photo', x: 200, y: 300, width: 500, height: 400, rotation: 12, props: photoProps, ...o });
const set = (els: ReturnType<typeof el>[]) => load({ ...project(2, els), assets: { [ID]: { mime: 'image/png', width: 9, height: 9, name: 'x' }, [MID]: { mime: 'image/png', width: 9, height: 9, name: 'm' } } });
const doc = () => useDoc.getState().project!;
const history = () => useDoc.temporal.getState().pastStates.length;

beforeEach(() => useUi.getState().setNotice(null));

describe('titleOf', () => {
  it('Rolle «titel» gewinnt vor der grössten Schrift', () => {
    set([photo(), text('big', 90), text('t', 40, { role: 'titel' })]);
    expect(titleOf(doc(), 'p')).toBe('t');
  });
  it('ohne Rolle: grösste Schrift, bei Gleichstand das oberste', () => {
    set([photo(), text('a', 40), text('b', 80), text('c', 80)]);
    expect(titleOf(doc(), 'p')).toBe('c');
  });
  it('nur Text auf der Slide des Fotos (Mitte entscheidet); ohne Text: undefined', () => {
    set([photo(), text('far', 80, { x: 1200 })]);
    expect(titleOf(doc(), 'p')).toBeUndefined();
    set([photo({ x: 1200 }), text('far', 80, { x: 1200 })]);
    expect(titleOf(doc(), 'p')).toBe('far');
  });
});

describe('copyAsSticker', () => {
  it('Kopie mit gleicher Maske und gleichem Bild, ganz oben, Original unverändert, ein Undo', () => {
    set([photo(), text('t', 60), el({ id: 'z' })]);
    const before = doc().elements.p;
    const h0 = history();
    const id = copyAsSticker('p')!;
    const c = doc().elements[id]!;
    expect(c.props).toEqual(photoProps);
    expect([c.x, c.y]).toEqual([240, 340]);
    expect(doc().order.at(-1)).toBe(id);
    expect(doc().elements.p).toEqual(before);
    expect(history()).toBe(h0 + 1);
    expect(referencedAssetIds(doc()).has(MID)).toBe(true);
    undo();
    expect(doc().elements[id]).toBeUndefined();
    expect(doc().order).toEqual(['p', 't', 'z']);
  });
  it('ohne Maske oder ohne Foto: undefined, nichts geschieht', () => {
    set([photo({ props: { assetId: ID } })]);
    const h0 = history();
    expect(copyAsSticker('p')).toBeUndefined();
    expect(copyAsSticker('gibtsnicht')).toBeUndefined();
    expect(history()).toBe(h0);
  });
});

describe('copyBehindTitle', () => {
  it('deckungsgleiche Kopie direkt über dem Titel, auch wenn das Original schon darüber liegt; ein Undo', () => {
    set([text('t', 60), el({ id: 'z' }), photo()]);
    const h0 = history();
    const id = copyBehindTitle('p')!;
    const c = doc().elements[id]!;
    const o = doc().elements.p!;
    expect([c.x, c.y, c.width, c.height, c.rotation, c.props]).toEqual([o.x, o.y, o.width, o.height, o.rotation, o.props]);
    expect(doc().order).toEqual(['t', id, 'z', 'p']);
    expect(history()).toBe(h0 + 1);
    undo();
    expect(doc().order).toEqual(['t', 'z', 'p']);
  });
  it('Original unter dem Titel: Kopie trotzdem direkt über dem Titel', () => {
    set([photo(), text('t', 60), el({ id: 'z' })]);
    const id = copyBehindTitle('p')!;
    expect(doc().order).toEqual(['p', 't', id, 'z']);
  });
  it('ohne Maske oder ohne Titel: undefined, nichts geschieht', () => {
    set([photo({ props: { assetId: ID } }), text('t', 60)]);
    expect(copyBehindTitle('p')).toBeUndefined();
    set([photo()]);
    const h0 = history();
    expect(copyBehindTitle('p')).toBeUndefined();
    expect(history()).toBe(h0);
  });
});
