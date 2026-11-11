import { z } from 'zod';
import { colorTokenSchema } from '../text/schema';

export const brandPropsSchema = z.object({
  /** id im AssetPack (Manifest), nicht im Bildspeicher: Markenbilder sind gebündelt und gehören nicht in die Projektdatei. */
  brandId: z.string().min(1).max(100),
  color: colorTokenSchema,
  /** Waagrecht gespiegelt; fehlt = nicht gespiegelt (Ruling R8). Senkrecht = spiegeln + 180° drehen. */
  flipX: z.boolean().optional(),
});
export type BrandProps = z.infer<typeof brandPropsSchema>;
