import { merkeZuletzt, vergissZuletzt } from '@bbzb/ui';
import Dexie, { type EntityTable } from 'dexie';
import type { Project } from '../model/types';

export interface ProjectSummary {
  id: string;
  name: string;
  formatId: string;
  updatedAt: number;
}

interface ProjectRow extends ProjectSummary {
  data: Project;
  /** Dateien, die Undo/Redo noch erreicht, aber nicht mehr in `data.assets` stehen (alte Masken): die GC lässt sie stehen. */
  keep?: string[];
}

export const db = new Dexie('social-studio') as Dexie & {
  projects: EntityTable<ProjectRow, 'id'>;
};
db.version(1).stores({ projects: '&id, updatedAt' });

/**
 * Startet die Transaktion synchron und schliesst sie mit commit(): Edge verwirft beim Entladen (pagehide)
 * sonst den offenen Schreibvorgang, auch ohne Dexie dazwischen (per e2e geprüft).
 */
export async function saveProject(p: Project, keep?: string[]): Promise<void> {
  if (!db.isOpen()) await db.open();
  const row: ProjectRow = { id: p.id, name: p.name, formatId: p.format.id, updatedAt: p.updatedAt, data: p, ...(keep?.length && { keep }) };
  const t = db.backendDB().transaction('projects', 'readwrite');
  t.objectStore('projects').put(row);
  t.commit();
  merkeZuletzt({ tool: 'social-studio', id: p.id, name: p.name, geaendert: p.updatedAt }); // für «Zuletzt» auf der Startseite
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onabort = () => reject(t.error ?? new DOMException('Speichern abgebrochen', 'AbortError'));
  });
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return (await db.projects.get(id))?.data;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const rows = await db.projects.orderBy('updatedAt').reverse().toArray();
  return rows.map(({ id, name, formatId, updatedAt }) => ({ id, name, formatId, updatedAt }));
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
  vergissZuletzt('social-studio', id);
}
