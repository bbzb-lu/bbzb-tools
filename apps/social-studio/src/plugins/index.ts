import { aiTools, contextBars, effects, elementTypes, exporters, videoExporters } from '../core/registries';
import { freistellenTool } from './ai/freistellen';
import { photoType } from './elements/photo';
import { aiBar, videoBar } from './elements/photo/photoBars';
import { textType } from './elements/text';
import { brandType } from './elements/brand';
import { tagType } from './elements/tag';
import { registerBrandPack } from './brandPack';
import { grainEffect } from './effects/grain';
import { adjustEffect, lookEffect } from './effects/look';
import { scrimEffect } from './effects/scrim';
import { mp4Exporter } from './exporters/mp4';
import { jpegExporter, pngExporter } from './exporters/raster';
import { registerFormats } from './formats';
import { registerLayouts } from './layouts';

let done = false;

export function registerPlugins(): void {
  if (done) return;
  done = true;
  registerFormats();
  registerBrandPack();
  effects.register(lookEffect);
  effects.register(adjustEffect);
  effects.register(scrimEffect);
  effects.register(grainEffect);
  elementTypes.register(photoType);
  elementTypes.register(textType);
  elementTypes.register(brandType);
  elementTypes.register(tagType);
  exporters.register(jpegExporter);
  exporters.register(pngExporter);
  videoExporters.register(mp4Exporter);
  registerLayouts();
  aiTools.register(freistellenTool);
  contextBars.register(aiBar);
  contextBars.register(videoBar);
}
