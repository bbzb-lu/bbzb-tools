import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { removeElement } from '../model/elements';
import { el, project } from '../model/fixtures';
import type { Project } from '../model/types';
import { photoPropsSchema } from '../plugins/elements/photo/schema';
import { tagType } from '../plugins/elements/tag';
import { textPropsSchema } from '../plugins/elements/text/schema';
import {
  packProject,
  packsAsset,
  ProjectFileError,
  sha256Hex,
  unpackProject,
} from './projectFile';

const lookup = (t: string): z.ZodType | undefined =>
  t === 'photo' ? photoPropsSchema : t === 'text' ? textPropsSchema : undefined;
const data = new Uint8Array([1, 2, 3, 4]);
const textProps = {
  text: 'Hi',
  style: 'titel',
  color: 'blau',
  fontSize: 100,
  align: 'left',
};

async function sample(): Promise<Project> {
  const id = await sha256Hex(data);
  return {
    ...project(2, [
      el({ id: 't', type: 'text', props: textProps }),
      el({
        id: 'f',
        type: 'photo',
        props: { assetId: id, crop: { x: 0, y: 0, scale: 1 } },
      }),
    ]),
    assets: {
      [id]: { mime: 'image/jpeg', width: 4, height: 4, name: 'a.jpg' },
    },
  };
}
const read = async () => new Blob([data]);
const zipOf = (
  project: unknown,
  files: Record<string, Uint8Array> = {},
  schemaVersion = 1,
) =>
  zipSync({
    'project.json': strToU8(JSON.stringify({ schemaVersion, project })),
    ...files,
  });

describe('projectFile', () => {
  it('sha256Hex kennt den Testvektor', async () => {
    expect(await sha256Hex(strToU8('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(await sha256Hex(new Blob([strToU8('abc')]))).toBe(
      await sha256Hex(strToU8('abc')),
    );
  });

  it('Roundtrip: packen und entpacken ergibt dasselbe Projekt mit neuer ID', async () => {
    const p = await sample();
    const out = await unpackProject(await packProject(p, read), lookup);
    expect(out.project).toEqual({ ...p, id: out.project.id });
    expect(out.project.id).not.toBe(p.id);
    expect([...out.assets.get(Object.keys(p.assets)[0]!)!]).toEqual([...data]);
  });

  it('Roundtrip behält den zuletzt gewählten Tag-Standort', async () => {
    const p = { ...(await sample()), lastTagLocation: 'Heimbach' };
    const out = await unpackProject(await packProject(p, read), lookup);
    expect(out.project.lastTagLocation).toBe('Heimbach');
  });

  it('Altprojekt mit Schul-Tag «Heimbach» (ohne neue Felder) lädt unverändert', async () => {
    const tag = el({ id: 'h', type: 'tag', width: 300, height: 62, props: { variant: 'schul', text: 'Heimbach' } });
    const p = { ...(await sample()), elements: { h: tag }, order: ['h'] };
    const out = await unpackProject(await packProject(p, read), (t) => (t === 'tag' ? tagType.propsSchema : lookup(t)));
    expect(out.project.elements.h).toMatchObject({ props: { variant: 'schul', text: 'Heimbach' } });
  });

  it('Roundtrip behält den Akzentmodus; ohne Modus bleibt das Feld weg', async () => {
    const p = { ...(await sample()), accentMode: 'standort' as const };
    expect((await unpackProject(await packProject(p, read), lookup)).project.accentMode).toBe('standort');
    expect((await unpackProject(await packProject(await sample(), read), lookup)).project).not.toHaveProperty('accentMode');
  });

  it('packt gelöschte Fotos nicht mehr ein', async () => {
    const p = await sample();
    removeElement(p, 'f');
    const zip = unzipSync(await packProject(p, read));
    expect(Object.keys(zip)).toEqual(['project.json']);
    expect(JSON.parse(strFromU8(zip['project.json']!)).project.assets).toEqual({});
    const out = await unpackProject(await packProject(p, read), lookup);
    expect(out.project).toEqual({ ...p, assets: {}, id: out.project.id });
  });

  it('ignoriert nicht referenzierte Assets', async () => {
    const p = await sample();
    const id = Object.keys(p.assets)[0]!;
    const out = await unpackProject(
      zipOf(p, { [`assets/${id}`]: data, 'assets/zz': data }),
      lookup,
    );
    expect([...out.assets.keys()]).toEqual([id]);
  });

  it.each([
    [
      'kein ZIP',
      async () => new Uint8Array([1, 2, 3]),
      'Diese Datei ist keine BBZB-Projektdatei.',
    ],
    [
      'ZIP ohne project.json',
      async () => zipSync({ 'a.txt': data }),
      'Diese Datei ist keine BBZB-Projektdatei.',
    ],
    [
      'project.json kein JSON',
      async () => zipSync({ 'project.json': data }),
      'Diese Datei ist keine BBZB-Projektdatei.',
    ],
    [
      'neuere Schema-Version',
      async () => zipOf({}, {}, 2),
      'Diese Projektdatei stammt aus einer neueren Version der App.',
    ],
    [
      'Hülle ohne Version',
      async () => zipOf({}, {}, undefined as never),
      'Die Projektdatei ist beschädigt.',
    ],
    [
      'Asset fehlt',
      async () => zipOf(await sample()),
      'In der Projektdatei fehlt ein Bild.',
    ],
    [
      'Asset verändert',
      async () => {
        const p = await sample();
        return zipOf(p, {
          [`assets/${Object.keys(p.assets)[0]}`]: new Uint8Array([9]),
        });
      },
      'Ein Bild in der Projektdatei ist beschädigt.',
    ],
    [
      'unbekannter Element-Typ',
      async () => {
        const p = await sample();
        p.elements.t!.type = 'video';
        return zipOf(p);
      },
      'Die Projektdatei enthält einen unbekannten Inhalt.',
    ],
    [
      'order passt nicht zu elements',
      async () => {
        const p = await sample();
        p.order.pop();
        return zipOf(p);
      },
      'Die Projektdatei ist beschädigt.',
    ],
  ])('%s → ProjectFileError', async (_n, make, msg) => {
    const err = await unpackProject(await make(), lookup).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ProjectFileError);
    expect((err as Error).message).toBe(msg);
  });

  describe('Grössenlimits', () => {
    const big = () => new Uint8Array(101 * 1024 * 1024);
    it('referenziertes Asset über 100 MB → zu gross', async () => {
      const p = await sample();
      const id = Object.keys(p.assets)[0]!;
      const err = await unpackProject(
        zipOf(p, { [`assets/${id}`]: big() }),
        lookup,
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ProjectFileError);
      expect((err as Error).message).toBe('Die Projektdatei ist zu gross.');
    }, 20000);
    it('grosser, nicht referenzierter Eintrag wird ignoriert', async () => {
      const p = await sample();
      const id = Object.keys(p.assets)[0]!;
      const out = await unpackProject(
        zipOf(p, { [`assets/${id}`]: data, 'assets/junk': big() }),
        lookup,
      );
      expect([...out.assets.keys()]).toEqual([id]);
    }, 20000);
    it('project.json über 10 MB → zu gross', async () => {
      const err = await unpackProject(
        zipSync({ 'project.json': new Uint8Array(11 * 1024 * 1024) }),
        lookup,
      ).catch((e: unknown) => e);
      expect((err as Error).message).toBe('Die Projektdatei ist zu gross.');
    });
  });

  describe('Videos', () => {
    async function withVideo(): Promise<Project> {
      const p = await sample();
      const id = 'a'.repeat(64);
      p.elements.v = el({
        id: 'v',
        type: 'photo',
        props: { assetId: id, crop: { x: 0, y: 0, scale: 1 }, video: { start: 0, end: 2, sound: true, duration: 3 } },
      });
      p.order.push('v');
      p.assets[id] = { mime: 'video/mp4', width: 4, height: 4, name: 'v.mp4' };
      return p;
    }

    it('packsAsset: Videos nicht, Bilder ja', () => {
      expect(packsAsset({ mime: 'video/mp4', width: 1, height: 1, name: 'v' })).toBe(false);
      expect(packsAsset({ mime: 'image/png', width: 1, height: 1, name: 'v' })).toBe(true);
    });

    it('packProject lässt Video-Assets weg, führt sie in project.json und liest sie nicht', async () => {
      const p = await withVideo();
      const zip = unzipSync(await packProject(p, async (id) => (id === 'a'.repeat(64) ? Promise.reject(new Error('gelesen')) : read())));
      expect(Object.keys(zip).sort()).toEqual([`assets/${Object.keys(p.assets)[0]}`, 'project.json'].sort());
      expect(JSON.parse(strFromU8(zip['project.json']!)).project.assets['a'.repeat(64)].mime).toBe('video/mp4');
    });

    it('unpackProject akzeptiert fehlendes Video-Asset, fehlendes Foto-Asset bleibt Fehler', async () => {
      const p = await withVideo();
      const out = await unpackProject(await packProject(p, read), lookup);
      expect(out.project.assets['a'.repeat(64)]!.mime).toBe('video/mp4');
      expect(out.assets.has('a'.repeat(64))).toBe(false);
      await expect(unpackProject(zipOf(p), lookup)).rejects.toThrow(ProjectFileError);
    });
  });
});

describe('Maske in der Projektdatei', () => {
  const mdata = new Uint8Array([9, 8, 7]);
  const withMask = async (): Promise<{ p: Project; mid: string }> => {
    const p = await sample();
    const mid = await sha256Hex(mdata);
    (p.elements.f!.props as { mask?: string }).mask = mid;
    p.assets[mid] = { mime: 'image/png', width: 2, height: 2, name: 'Maske' };
    return { p, mid };
  };
  const readAll = async (id: string) => new Blob([id === Object.keys((await sample()).assets)[0] ? data : mdata]);

  it('Roundtrip: Maske wird mitgepackt und kommt gleich zurück', async () => {
    const { p, mid } = await withMask();
    const out = await unpackProject(await packProject(p, readAll), lookup);
    expect(out.project).toEqual({ ...p, id: out.project.id });
    expect([...out.assets.get(mid)!]).toEqual([...mdata]);
    expect(out.droppedMasks).toBe(0);
  });

  it('fehlende Maskendatei: Foto ohne Maske, Meldung statt Fehler', async () => {
    const { p, mid } = await withMask();
    const zip = unzipSync(await packProject(p, readAll));
    delete zip[`assets/${mid}`];
    const out = await unpackProject(zipSync(zip), lookup);
    expect(out.droppedMasks).toBe(1);
    expect(out.project.elements.f!.props).not.toHaveProperty('mask');
    expect(out.project.assets).not.toHaveProperty(mid);
    expect(out.assets.has(mid)).toBe(false);
  });

  it('defekte Maskendatei (falscher Hash): Foto ohne Maske, das Foto selbst bleibt', async () => {
    const { p, mid } = await withMask();
    const zip = unzipSync(await packProject(p, readAll));
    zip[`assets/${mid}`] = new Uint8Array([1]);
    const out = await unpackProject(zipSync(zip), lookup);
    expect(out.droppedMasks).toBe(1);
    expect(out.project.elements.f!.props).not.toHaveProperty('mask');
    expect(out.assets.size).toBe(1);
  });

  it('Maske ohne Eintrag in assets: Foto ohne Maske, mit Meldung', async () => {
    const { p, mid } = await withMask();
    delete p.assets[mid];
    const out = await unpackProject(zipOf(p, { [`assets/${await sha256Hex(data)}`]: data }), lookup);
    expect(out.project.elements.f!.props).not.toHaveProperty('mask');
    expect(out.droppedMasks).toBe(1); // auch dieser Fall meldet sich
  });

  it('Projekt ohne Maske: droppedMasks 0', async () => {
    expect((await unpackProject(await packProject(await sample(), read), lookup)).droppedMasks).toBe(0);
  });
});
