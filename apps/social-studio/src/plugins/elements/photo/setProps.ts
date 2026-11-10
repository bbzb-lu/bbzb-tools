import type { Element } from '../../../model/types';
import { apply } from '../../../store/document';
import type { PhotoProps } from './schema';

/** Jede Änderung ein apply; Regler fassen ihre Geste zu einem Undo-Schritt zusammen. */
export const setProps = (id: string, patch: Partial<PhotoProps>) =>
  apply((d) => void Object.assign((d.elements[id] as Element<PhotoProps>).props, patch));
