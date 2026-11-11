import { z } from 'zod';
import { elementTypes, formats, layouts } from '../../core/registries';
import type { LayoutPreset } from '../../core/types';
import { MAX_SLIDES } from '../../model/slides';
import { colorTokens } from '../../tokens';

const elementSchema = z.object({
  type: z.string().refine((t) => elementTypes.has(t), 'unbekannter Elementtyp'),
  role: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().optional(),
  anchorRight: z.boolean().optional(),
  props: z.record(z.string(), z.unknown()),
});

const presetSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(50),
  family: z.string().min(1).max(50).optional(),
  format: z.string().refine((f) => formats.has(f), 'unbekanntes Format'),
  slides: z.number().int().min(1).max(MAX_SLIDES),
  background: z.enum(colorTokens),
  grain: z.boolean().optional(),
  elements: z.array(elementSchema),
});

/** Prüft eine Layoutdatei; Fehler nennen die Datei (Layouts pflegt man als Daten im Repo, ohne Code). */
export function parseLayout(file: string, data: unknown): LayoutPreset {
  const r = presetSchema.safeParse(data);
  if (!r.success) throw new Error(`Layout ${file} ist ungültig: ${z.prettifyError(r.error)}`);
  return r.data;
}

/** Jede JSON-Datei in presets/ ist ein Layout. Nach Formaten und Elementtypen registrieren. */
export function registerLayouts(): void {
  const files = import.meta.glob<unknown>('./presets/*.json', { eager: true, import: 'default' });
  for (const [file, data] of Object.entries(files)) layouts.register(parseLayout(file, data));
}
