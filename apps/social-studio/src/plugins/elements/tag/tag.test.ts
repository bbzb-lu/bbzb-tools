import { describe, expect, it, vi } from 'vitest';
import type { EditorContext } from '../../../core/types';
import { project } from '../../../model/fixtures';
import type { Project } from '../../../model/types';
import { memoryAssetStore } from '../../../storage/assets';
import { accentFor, resolveColor } from '../../../model/accent';
import { colors, locationColors, locations as tokenLocations, onAccent, tagBox } from '../../../tokens';
import { tagType } from './index';
import { tagBoxWidth, tagDeptLabel, tagFillOf, tagHeightOf, tagLabel } from './layout';
import { locations, type TagProps } from './schema';
import { libraryLabels, variantNames } from './insert';

// Jedes Zeichen 10 px breit
vi.mock('./measure', async (orig) => ({
  ...(await orig<typeof import('./measure')>()),
  // wie die echte Messung: Länge des angezeigten Textes (tagLabel), 10 px je Zeichen
  measureLabel: (p: TagProps) => tagLabel(p).length * 10,
}));

function ctx(p: Project, currentSlide = 0) {
  const apply = vi.fn((recipe: (d: Project) => void) => recipe(p));
  const c: EditorContext = { project: p, currentSlide, apply, assets: memoryAssetStore(), select: vi.fn(), notify: vi.fn() };
  return { c, apply, p };
}

describe('Tag aus Layoutdaten', () => {
  it('fromLayout misst Breite und Höhe nach Variante', () => {
    const el = { id: 't', type: 'tag', role: 'schulTag', name: 'Schul-Tag', x: 0, y: 0, width: 323, height: 10, rotation: 0, opacity: 1, visible: true, locked: false, props: { variant: 'schul', text: 'Bahnhof' } as TagProps };
    expect(tagType.fromLayout!(el)).toMatchObject({ width: tagBoxWidth(el.props, 120), height: tagBox.schul.height, role: 'schulTag' });
  });

  const schul = { id: 't', type: 'tag', role: 'schulTag', name: 'Schul-Tag', x: 0, y: 0, width: 323, height: 62, rotation: 0, opacity: 1, visible: true, locked: false, props: { variant: 'schul', text: 'Bahnhof' } as TagProps };
  it('frischer Schul-Tag nimmt den zuletzt gewählten Standort (Breite danach gemessen)', () => {
    const p = { ...project(1), lastTagLocation: 'Heimbach' };
    const out = tagType.fromLayout!(schul, p, true);
    expect(out.props.text).toBe('Heimbach');
    expect(out.width).toBe(tagBoxWidth(out.props, 'BBZB Heimbach'.length * 10));
  });

  it('gefüllter Schul-Tag, unbekannter Standort oder anderer Tag: Text bleibt', () => {
    const p = { ...project(1), lastTagLocation: 'Dagmersellen' };
    expect(tagType.fromLayout!(schul, p, false).props.text).toBe('Bahnhof');
    expect(tagType.fromLayout!(schul, { ...p, lastTagLocation: 'Mond' }, true).props.text).toBe('Bahnhof');
    expect(tagType.fromLayout!({ ...schul, props: { variant: 'ort', text: 'Luzern' } }, p, true).props.text).toBe('Luzern');
    expect(tagType.fromLayout!(schul, project(1), true).props.text).toBe('Bahnhof');
  });
});

describe('Tag beim Layoutwechsel', () => {
  const tag = (variant: TagProps['variant'], text: string) => ({ id: variant, type: 'tag', name: 'T', x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, visible: true, locked: false, props: { variant, text } });
  it('Text zieht in einen Tag gleicher Variante, sonst nicht', () => {
    expect(tagType.takeContent!(tag('schul', 'Bahnhof'), tag('schul', 'Heimbach'), {} as never)!.props).toEqual({ variant: 'schul', text: 'Heimbach' });
    expect(tagType.takeContent!(tag('schul', 'Bahnhof'), tag('ort', 'Luzern'), {} as never)).toBeUndefined();
  });
});

describe('Tag-Layout', () => {
  it('Schul-Tag zeigt «BBZB Standort» in Versalien, die anderen den Text in Versalien', () => {
    expect(tagLabel({ variant: 'schul', text: 'Bahnhof' })).toBe('BBZB BAHNHOF');
    expect(tagLabel({ variant: 'ort', text: 'Küssnacht am Rigi' })).toBe('KÜSSNACHT AM RIGI');
    expect(tagLabel({ variant: 'cta', text: 'link in bio' })).toBe('LINK IN BIO');
  });

  it('Breite = Polster + Text + Polster, beim Ort-Tag ab textX', () => {
    expect(tagBoxWidth({ variant: 'schul' }, 100)).toBe(100 + tagBox.schul.paddingLeft + tagBox.schul.paddingRight);
    expect(tagBoxWidth({ variant: 'ort' }, 100)).toBe(tagBox.ort.textX + 100 + tagBox.ort.paddingRight);
    expect(tagBoxWidth({ variant: 'cta' }, 100)).toBe(100 + tagBox.cta.paddingLeft + tagBox.cta.paddingRight);
  });
});

describe('tagType', () => {
  it('Schema: Variante und Text, Text nie leer', () => {
    expect(tagType.propsSchema.safeParse({ variant: 'schul', text: 'Bahnhof' }).success).toBe(true);
    expect(tagType.propsSchema.safeParse({ variant: 'rund', text: 'x' }).success).toBe(false);
    expect(tagType.propsSchema.safeParse({ variant: 'ort', text: '' }).success).toBe(false);
  });

  it('Schul-Tag mittig auf die aktuelle Slide, Höhe aus Tokens, Text «BBZB», ein apply, ausgewählt', async () => {
    const { c, apply, p } = ctx(project(2), 1);
    await tagType.insertVariant!('schul', c);
    expect(apply).toHaveBeenCalledTimes(1);
    const [e] = Object.values(p.elements);
    expect(e).toMatchObject({ type: 'tag', name: 'Standort-Tag 1', height: 62, rotation: 0 });
    expect(e!.width).toBe(4 * 10 + 72);
    expect(e!.x + e!.width / 2).toBe(1080 + 540);
    expect(e!.y + e!.height / 2).toBe(675);
    expect(e!.props).toEqual({ variant: 'schul', text: 'BBZB' });
    expect(c.select).toHaveBeenCalledWith(e!.id);
  });

  it('neuer Standort-Tag startet mit «BBZB», auch bei gesetztem lastTagLocation', async () => {
    const { c, p } = ctx({ ...project(1), lastTagLocation: 'Heimbach' });
    await tagType.insertVariant!('schul', c);
    expect((Object.values(p.elements)[0]!.props as TagProps).text).toBe('BBZB');
  });

  it('Fachbereich-Tag und freier Tag starten mit gültigen Props und ihrer Höhe', async () => {
    const { c, p } = ctx(project(1));
    await tagType.insertVariant!('fach', c);
    await tagType.insertVariant!('frei', c);
    const [fach, frei] = Object.values(p.elements);
    expect(fach).toMatchObject({ name: 'Fachbereich-Tag 1', height: 62, props: { variant: 'fach', text: 'Automobiltechnik', color: 'Bahnhof' } });
    expect(frei).toMatchObject({ name: 'Freier Tag 1', height: 62, props: { variant: 'frei', text: 'Text', color: 'blau' } });
    for (const e of [fach!, frei!]) expect(tagType.propsSchema.safeParse(e.props).success).toBe(true);
  });

  it('Ort-Tag und CTA: Vorgabetexte, Höhen aus Tokens, Position an der Ablagestelle', async () => {
    const { c, p } = ctx(project(1));
    await tagType.insertVariant!('cta', c, { x: 200, y: 300 });
    await tagType.insertVariant!('ort', c);
    const [cta, ort] = Object.values(p.elements);
    expect(cta).toMatchObject({ name: 'CTA 1', height: 75 });
    expect((cta!.props as TagProps).text).toBe('LINK IN BIO');
    expect([cta!.x + cta!.width / 2, cta!.y + cta!.height / 2]).toEqual([200, 300]);
    expect(ort).toMatchObject({ name: 'Ort-Tag 1', height: 62 });
  });

  it('skaliert nie', () => {
    const e = { width: 300, height: 62 } as never;
    expect(tagType.afterTransform(e, { x: 1, y: 2, width: 900, height: 10, rotation: 5 })).toEqual({ x: 1, y: 2, width: 300, height: 62, rotation: 5 });
  });
});

describe('Tag und Kanal (Ruling R4)', () => {
  const cta = (text: string) => ({ id: 't', type: 'tag', name: 'CTA', x: 0, y: 0, width: 1, height: 75, rotation: 0, opacity: 1, visible: true, locked: false, props: { variant: 'cta', text } as TagProps });

  it('onChannel tauscht nur den Standardtext des anderen Kanals und misst neu', () => {
    expect(tagType.onChannel!(cta('LINK IN BIO'), 'linkedin')).toMatchObject({ props: { text: 'BBZB.LU.CH' }, width: tagBoxWidth({ variant: 'cta' }, 100) });
    expect(tagType.onChannel!(cta('bbzb.lu.ch'), 'instagram')?.props.text).toBe('LINK IN BIO');
    expect(tagType.onChannel!(cta('Jetzt anmelden'), 'linkedin')).toBeUndefined();
    expect(tagType.onChannel!(cta('LINK IN BIO'), 'instagram')).toBeUndefined();
    expect(tagType.onChannel!({ ...cta('Bahnhof'), props: { variant: 'schul', text: 'Bahnhof' } }, 'linkedin')).toBeUndefined();
  });

  it('onChannel lässt Fachbereich- und freie Tags unverändert, auch mit CTA-Text', () => {
    for (const variant of ['fach', 'frei']) {
      expect(tagType.onChannel!({ ...cta('LINK IN BIO'), props: { variant, text: 'LINK IN BIO' } as TagProps }, 'linkedin')).toBeUndefined();
    }
  });

  it('neuer CTA und CTA aus Layoutdaten nehmen den Standard des Kanals, Instagram ohne Angabe', async () => {
    const p = project(1);
    const a = ctx(p);
    await tagType.insertVariant!('cta', a.c);
    expect(Object.values(p.elements)[0]!.props).toMatchObject({ text: 'LINK IN BIO' });
    expect(tagType.fromLayout!(cta('LINK IN BIO'), { ...p, channel: 'linkedin' }).props.text).toBe('BBZB.LU.CH');
    expect(tagType.fromLayout!(cta('LINK IN BIO'), p).props.text).toBe('LINK IN BIO');
    const q = project(1);
    q.channel = 'linkedin';
    await tagType.insertVariant!('cta', ctx(q).c);
    expect(Object.values(q.elements)[0]!.props).toMatchObject({ text: 'BBZB.LU.CH' });
  });
});

describe('Akzentfarbe am Tag (Phase 2.5)', () => {
  /** Füllung und Schrift, wie TagNode sie zeichnet. */
  const look = (p: Project, id: string) => {
    const e = p.elements[id]!;
    const b = tagBox[(e.props as TagProps).variant];
    const fill = resolveColor(b.fill, accentFor(p, e));
    return { fill, text: colors[onAccent(fill)] };
  };

  it('Standorte des Tags sind die Standorte der Akzentfarben', () => {
    expect(locations).toEqual(tokenLocations);
  });

  it('eingefügter Schul-Tag und CTA: im Modus fix orange mit warmweisser Schrift wie bisher, standortabhängig in der Farbe des Schul-Tags', async () => {
    const p = project(1);
    await tagType.insertVariant!('schul', ctx(p).c);
    await tagType.insertVariant!('cta', ctx(p).c);
    await tagType.insertVariant!('ort', ctx(p).c);
    const [schul, cta, ort] = p.order;
    (p.elements[schul!]!.props as TagProps).text = 'Heimbach'; // Standort wie im Inspector gewählt
    for (const id of [schul!, cta!]) expect(look(p, id)).toEqual({ fill: colors.orange, text: colors.warmweiss });
    expect(look(p, ort!)).toEqual({ fill: colors.blauschwarz, text: colors.warmweiss });
    p.accentMode = 'standort';
    for (const id of [schul!, cta!]) expect(look(p, id)).toEqual({ fill: locationColors.Heimbach.fill, text: colors.warmweiss });
    // Ort-Tag bleibt blauschwarz, nur der Pin folgt dem Akzent
    expect(look(p, ort!)).toEqual({ fill: colors.blauschwarz, text: colors.warmweiss });
    expect(resolveColor(tagBox.ort.iconColor, accentFor(p, p.elements[ort!]!))).toBe(locationColors.Heimbach.fill);
    (p.elements[schul!]!.props as TagProps).text = 'Dagmersellen';
    expect(look(p, cta!)).toEqual({ fill: locationColors.Dagmersellen.fill, text: colors.warmweiss });
  });
});

describe('Tag Phase 2.6', () => {
  it('Beschriftung: BBZB allein, BBZB BM, fach und frei nur der Text', () => {
    expect(tagLabel({ variant: 'schul', text: 'BBZB' })).toBe('BBZB');
    expect(tagLabel({ variant: 'schul', text: 'BM' })).toBe('BBZB BM');
    expect(tagLabel({ variant: 'fach', text: 'Maler' })).toBe('MALER');
    expect(tagLabel({ variant: 'frei', text: 'Neu' })).toBe('NEU');
  });

  it('Höhe: 62 ohne, schulDept.height mit Fachbereich', () => {
    expect(tagHeightOf({ variant: 'schul', text: 'Bahnhof' })).toBe(62);
    expect(tagHeightOf({ variant: 'schul', text: 'Bahnhof', dept: 'Zimmerleute' })).toBe(tagBox.schulDept.height);
    expect(tagHeightOf({ variant: 'fach', text: 'Maler' })).toBe(62);
  });

  it('Fachbereich nur beim Schul-Tag und nur, wenn der Standort ihn führt', () => {
    expect(tagDeptLabel({ variant: 'schul', text: 'Bahnhof', dept: 'Zimmerleute' })).toBe('ZIMMERLEUTE');
    expect(tagDeptLabel({ variant: 'schul', text: 'Heimbach', dept: 'Zimmerleute' })).toBeUndefined();
    expect(tagDeptLabel({ variant: 'schul', text: 'BBZB', dept: 'Zimmerleute' })).toBeUndefined();
    expect(tagDeptLabel({ variant: 'ort', text: 'Bahnhof', dept: 'Zimmerleute' })).toBeUndefined();
    expect(tagHeightOf({ variant: 'schul', text: 'Heimbach', dept: 'Zimmerleute' })).toBe(62);
  });

  it('Füllung: fach nach Standort, frei nach color, Altprops', () => {
    expect(tagFillOf({ variant: 'fach', color: 'Weggismatt' }, '#111111')).toBe('#FF4E00');
    expect(tagFillOf({ variant: 'fach', color: 'Dagmersellen' }, '#111111')).toBe(locationColors.Dagmersellen.fill);
    expect(tagFillOf({ variant: 'fach', color: 'Heimbach' }, '#111111')).toBe(locationColors.Heimbach.fill);
    expect(tagFillOf({ variant: 'fach' }, '#111111')).toBe(colors.orange);
    expect(tagFillOf({ variant: 'fach', color: 'BBZB' as never }, '#111111')).toBe(colors.orange);
    expect(tagFillOf({ variant: 'frei', color: 'BM' }, '#111111')).toBe('#D84FC3');
    expect(tagFillOf({ variant: 'frei', color: 'akzent' }, '#111111')).toBe('#111111');
    expect(tagFillOf({ variant: 'frei', color: 'orange' }, '#111111')).toBe(colors.orange);
    expect(tagFillOf({ variant: 'frei' }, '#111111')).toBe(colors.blau);
    expect(tagFillOf({ variant: 'schul' }, '#111111')).toBe('#111111');
    expect(tagFillOf({ variant: 'ort' }, '#111111')).toBe(colors.blauschwarz);
  });

  it('Schema: Altprops ohne dept/color gültig, neue Felder geprüft', () => {
    expect(tagType.propsSchema.safeParse({ variant: 'schul', text: 'Heimbach' }).success).toBe(true);
    expect(tagType.propsSchema.safeParse({ variant: 'frei', text: 'x', color: 'BM' }).success).toBe(true);
    expect(tagType.propsSchema.safeParse({ variant: 'frei', text: 'x', color: 'BBZB' }).success).toBe(false);
    expect(tagType.propsSchema.safeParse({ variant: 'schul', text: 'x', dept: 'y'.repeat(61) }).success).toBe(false);
  });

  it('takeContent übernimmt Text, Fachbereich und Farbe samt Höhe', () => {
    const tag = (props: TagProps) => ({ id: 't', type: 'tag', name: 'T', x: 0, y: 0, width: 10, height: 62, rotation: 0, opacity: 1, visible: true, locked: false, props });
    const out = tagType.takeContent!(tag({ variant: 'schul', text: 'Bahnhof' }), tag({ variant: 'schul', text: 'Bahnhof', dept: 'Zimmerleute' }), {} as never)!;
    expect(out.props).toEqual({ variant: 'schul', text: 'Bahnhof', dept: 'Zimmerleute', color: undefined });
    expect(out.height).toBe(tagBox.schulDept.height);
    const frei = tagType.takeContent!(tag({ variant: 'frei', text: 'A' }), tag({ variant: 'frei', text: 'Neu', color: 'BM' }), {} as never)!;
    expect(frei.props).toMatchObject({ text: 'Neu', color: 'BM' });
  });
});

describe('libraryLabels', () => {
  it('kurze Bibliotheksnamen, Ebenennamen bleiben', () => {
    expect(Object.values(libraryLabels)).toEqual(['Standort', 'Fachbereich', 'Frei', 'Ort', 'CTA']);
    expect(variantNames.schul).toBe('Standort-Tag');
  });
});
