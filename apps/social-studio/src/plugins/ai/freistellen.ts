import { segmentClient } from '../../ai/segmentClient';
import type { AiTool } from '../../core/types';

/** KI-Freistellen (Phase 4b): ISNet im Web Worker, siehe `src/ai/segmentClient.ts`. */
export const freistellenTool: AiTool = { id: 'freistellen', name: 'Freistellen', run: (image, opts) => segmentClient.run(image, opts) };
