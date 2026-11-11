import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { z } from 'zod';
import { maskIdOf, withReferencedAssets } from '../model/elements';
import { maskIdsOf } from '../model/mask';
import { MSG, parseProject, ProjectFileError } from '../model/parse';
import type { AssetMeta, Project } from '../model/types';

export { ProjectFileError };

const MAX_JSON = 10 * 1024 * 1024;
const MAX_ASSET = 100 * 1024 * 1024;
const MAX_TOTAL = 1024 * 1024 * 1024;
const TOO_BIG = 'Die Projektdatei ist zu gross.';
const NOT_PROJECT = 'Diese Datei ist keine BBZB-Projektdatei.';

export async function sha256Hex(data: Uint8Array | Blob): Promise<string> {
  const bytes =
    data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
  const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** Videos liegen nur im Browser-Speicher, nicht in der Projektdatei (Entscheid Phase 3). */
export const packsAsset = (meta: AssetMeta): boolean => !meta.mime.startsWith('video/');

export async function packProject(
  project: Project,
  readAsset: (id: string) => Promise<Blob>,
): Promise<Uint8Array> {
  const p = withReferencedAssets(project);
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    'project.json': strToU8(JSON.stringify({ schemaVersion: 1, project: p })),
  };
  for (const [id, meta] of Object.entries(p.assets))
    if (packsAsset(meta)) files[`assets/${id}`] = [
      new Uint8Array(await (await readAsset(id)).arrayBuffer()),
      { level: 0 },
    ];
  return zipSync(files);
}

export async function unpackProject(
  bytes: Uint8Array,
  propsSchemaFor: (type: string) => z.ZodType | undefined,
): Promise<{ project: Project; assets: Map<string, Uint8Array>; droppedMasks: number }> {
  let envelope: { schemaVersion?: unknown; project?: unknown };
  try {
    const json = unzipSync(bytes, {
      filter: (f) => f.name === 'project.json' && f.originalSize <= MAX_JSON,
    })['project.json'];
    if (!json) {
      // Entweder fehlt project.json oder es ist zu gross.
      let declared = -1;
      unzipSync(bytes, {
        filter: (f) => (
          f.name === 'project.json' && (declared = f.originalSize),
          false
        ),
      });
      if (declared > MAX_JSON) throw new ProjectFileError(TOO_BIG);
      throw new Error('no project.json');
    }
    envelope = JSON.parse(strFromU8(json));
  } catch (e) {
    if (e instanceof ProjectFileError) throw e;
    throw new ProjectFileError(NOT_PROJECT);
  }
  const v = envelope?.schemaVersion;
  if (typeof v === 'number' && v > 1) throw new ProjectFileError(MSG.newer);
  if (v !== 1) throw new ProjectFileError(MSG.damaged);

  const project = parseProject(envelope.project, propsSchemaFor);
  const wanted = new Set(
    Object.entries(project.assets).filter(([, m]) => packsAsset(m)).map(([id]) => `assets/${id}`),
  );
  let total = 0;
  let tooBig = false;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        if (!wanted.has(f.name)) return false;
        total += f.originalSize;
        if (f.originalSize > MAX_ASSET || total > MAX_TOTAL) tooBig = true;
        return !tooBig;
      },
    });
  } catch {
    throw new ProjectFileError(NOT_PROJECT);
  }
  if (tooBig) throw new ProjectFileError(TOO_BIG);
  const assets = new Map<string, Uint8Array>();
  const masks = maskIdsOf(project);
  // Maske ohne Eintrag in assets, mit fehlender oder defekter Datei: Foto ohne Maske und Meldung, kein Abbruch.
  const badMasks = new Set([...masks].filter((id) => !Object.hasOwn(project.assets, id)));
  for (const [id, meta] of Object.entries(project.assets)) {
    if (!packsAsset(meta)) continue; // fehlendes Video: der Editor zeigt einen Platzhalter
    const data = files[`assets/${id}`];
    // Maske fehlt oder ist defekt: Foto ohne Maske (unten), kein Abbruch. Der Hash gilt zugleich für Bilder, die Foto und Maske sind.
    if (masks.has(id) && (!data || (await sha256Hex(data)) !== id)) {
      badMasks.add(id);
      continue;
    }
    if (!data)
      throw new ProjectFileError('In der Projektdatei fehlt ein Bild.');
    if ((await sha256Hex(data)) !== id)
      throw new ProjectFileError(
        'Ein Bild in der Projektdatei ist beschädigt.',
      );
    assets.set(id, data);
  }
  let droppedMasks = 0;
  for (const e of Object.values(project.elements)) {
    const m = maskIdOf(e);
    if (m === undefined || !badMasks.has(m)) continue;
    delete (e.props as { mask?: string }).mask;
    droppedMasks++;
  }
  for (const id of badMasks) delete project.assets[id]; // (ohne Eintrag: nichts zu löschen)
  return { project: { ...project, id: crypto.randomUUID() }, assets, droppedMasks };
}
