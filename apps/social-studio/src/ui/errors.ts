import { ExportError } from '../export/exportZip';
import { ProjectFileError } from '../projectFile/projectFile';
import { StorageFullError } from '../storage/assets';

/** Eigene Meldungen zeigen, alles andere nur allgemein (keine technischen Texte für Lernende). */
export const errorText = (e: unknown, fallback: string): string =>
  e instanceof ProjectFileError || e instanceof StorageFullError || e instanceof ExportError ? e.message : fallback;
