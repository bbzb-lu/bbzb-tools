import { expect, it } from 'vitest';
import { aiTools, assetPacks, elementTypes, exporters } from '../core/registries';
import { registerPlugins } from '.';
import { brandUrls } from './brandPack';
import { textPropsSchema } from './elements/text/schema';

it('Plugins registrieren Foto und Text als Elementtypen, ohne Prototyp-Treffer', () => {
  registerPlugins();
  registerPlugins();
  expect(elementTypes.get('text').propsSchema).toBe(textPropsSchema);
  expect(elementTypes.has('photo')).toBe(true);
  expect(elementTypes.has('toString')).toBe(false);
  expect(elementTypes.has('__proto__')).toBe(false);
  expect(exporters.all().map((e) => [e.id, e.extension])).toEqual([['jpeg', 'jpg'], ['png', 'png']]);
  expect(aiTools.all().map((t) => t.id)).toEqual(['freistellen']);
});

it('Plugins registrieren das BBZB-Markenpaket ohne Fehler, Logo ausgeschlossen', () => {
  registerPlugins();
  const pack = assetPacks.get('bbzb');
  expect(pack.errors).toEqual([]);
  expect(pack.assets).toHaveLength(24);
  expect(pack.assets.every((a) => a.url && !/logo/i.test(a.file))).toBe(true);
  // Alle Bildendungen in allen drei Ordnern, aber kein Logo im Bündel
  expect(Object.keys(brandUrls)).toContain('icons/bike.svg');
  expect(Object.keys(brandUrls).filter((f) => /logo/i.test(f))).toEqual([]);
});
