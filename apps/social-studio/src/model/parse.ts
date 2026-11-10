import { z } from 'zod';
import { channels, colorTokens } from '../tokens';
import { scrimsSchema } from './scrim';
import type { Project } from './types';

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFileError';
  }
}

export const MSG = {
  damaged: 'Die Projektdatei ist beschädigt.',
  unknown: 'Die Projektdatei enthält einen unbekannten Inhalt.',
  newer: 'Diese Projektdatei stammt aus einer neueren Version der App.',
} as const;

const color = z.enum(colorTokens);
const id = z.string().min(1).max(100);
const pos = z.number().positive();
const posInt = z.number().int().positive();

const elementSchema = z.object({
  id,
  type: z.string().max(50),
  name: z.string().max(200),
  x: z.number(),
  y: z.number(),
  width: pos,
  height: pos,
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  locked: z.boolean(),
  role: z.string().min(1).max(50).optional(),
  props: z.unknown(),
});

const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  name: z.string().max(200),
  format: z.object({ id: z.string().max(50), width: posInt, height: posInt }),
  createdAt: z.number(),
  updatedAt: z.number(),
  slides: z
    .array(
      z.object({
        id,
        background: color,
        layout: z.string().min(1).max(50).optional(),
        review: z.boolean().optional(),
        link: z.string().min(1).max(50).optional(),
        grain: z.boolean().optional(),
        grainStrength: z.number().int().min(0).max(100).optional(),
        scrims: scrimsSchema.optional(),
      }),
    )
    .min(1)
    .max(20),
  elements: z.record(z.string(), elementSchema),
  order: z.array(z.string()),
  assets: z.record(
    z.string().regex(/^[0-9a-f]{64}$/),
    z.object({
      mime: z.string().max(100),
      width: pos,
      height: pos,
      name: z.string().max(255),
    }),
  ),
  lastTagLocation: z.string().min(1).max(100).optional(),
  channel: z.enum(channels).optional(),
  accentMode: z.enum(['fix', 'standort']).optional(),
  exportQuality: z.enum(['klein', 'standard', 'hoch']).optional(),
});

/** Prüft untrusted JSON; wirft ProjectFileError mit deutscher Meldung. */
export function parseProject(
  json: unknown,
  propsSchemaFor: (type: string) => z.ZodType | undefined,
): Project {
  const v = (json as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof v === 'number' && v > 1) throw new ProjectFileError(MSG.newer);
  const r = projectSchema.safeParse(json);
  if (!r.success) throw new ProjectFileError(MSG.damaged);
  const p = r.data;

  const ids = Object.keys(p.elements);
  if (
    new Set(p.slides.map((s) => s.id)).size !== p.slides.length ||
    new Set(p.order).size !== p.order.length ||
    p.order.length !== ids.length ||
    !p.order.every((id) => Object.hasOwn(p.elements, id)) ||
    ids.some((k) => p.elements[k]!.id !== k)
  )
    throw new ProjectFileError(MSG.damaged);

  for (const e of Object.values(p.elements)) {
    let schema: z.ZodType | undefined;
    try {
      schema = propsSchemaFor(e.type);
    } catch {
      throw new ProjectFileError(MSG.unknown);
    }
    if (!schema) throw new ProjectFileError(MSG.unknown);
    let props: z.ZodSafeParseResult<unknown>;
    try {
      props = schema.safeParse(e.props);
    } catch {
      throw new ProjectFileError(MSG.damaged);
    }
    if (!props.success) throw new ProjectFileError(MSG.damaged);
    e.props = props.data;
    // Leerer Foto-Platzhalter hat kein Bild; ein vorhandenes muss in der Datei liegen.
    const assetId = (props.data as { assetId?: string }).assetId;
    if (e.type === 'photo' && assetId !== undefined && !Object.hasOwn(p.assets, assetId))
      throw new ProjectFileError(MSG.damaged);
  }
  return p as Project;
}
