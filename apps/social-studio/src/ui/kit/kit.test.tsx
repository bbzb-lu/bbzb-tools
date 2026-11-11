import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUi } from '../../store/ui';
import { Section } from '../Section';

const html = (id: string, collapsible = true) =>
  renderToStaticMarkup(
    <Section heading={id} id={id} collapsible={collapsible}>
      <input aria-label={`feld-${id}`} />
    </Section>,
  );
const body = (markup: string) => /<div[^>]*section-body[^>]*>/.exec(markup)![0];

describe('Section einklappbar', () => {
  // renderToStaticMarkup liest den Store-Anfangszustand (getServerSnapshot): den stellen wir direkt ein.
  const preset = (o: Record<string, boolean>) => {
    const init = useUi.getInitialState().openSections;
    for (const k of Object.keys(init)) delete init[k];
    Object.assign(init, o);
  };
  beforeEach(() => {
    useUi.setState({ openSections: {} });
    preset({});
  });

  it('offen: aria-expanded true, aria-controls zeigt auf den Inhalt ohne hidden', () => {
    preset({ a: true });
    const m = html('a');
    expect(m).toContain('aria-expanded="true"');
    expect(body(m)).not.toContain('hidden');
    const ctl = /aria-controls="([^"]+)"/.exec(m)![1];
    expect(body(m)).toContain(`id="${ctl}"`);
    preset({ a: true });
    expect(body(html('b'))).toContain('hidden'); // unabhängig
  });


  it('startet zu: aria-expanded false, Inhalt hidden (nicht tabbar)', () => {
    const m = html('a');
    expect(m).toContain('aria-expanded="false"');
    expect(body(m)).toContain('hidden');
  });
  it('öffnet unabhängig und bleibt über Remount offen (Zustand im Store, nicht in der Komponente)', () => {
    useUi.getState().toggleSection('a');
    expect(useUi.getState().openSections).toEqual({ a: true });
    useUi.getState().toggleSection('b');
    useUi.getState().toggleSection('a');
    expect(useUi.getState().openSections).toEqual({ a: false, b: true });
    expect(useUi.getState().openSections.c).toBeUndefined(); // Standard zu
  });
  it('defaultOpen: startet offen, bis man zuklappt; der Zustand gilt danach wie bei den anderen', () => {
    const open = () => renderToStaticMarkup(<Section heading="Ebene" id="d" collapsible defaultOpen><input aria-label="x" /></Section>);
    expect(body(open())).not.toContain('hidden');
    useUi.getState().toggleSection('d', true);
    expect(useUi.getState().openSections).toEqual({ d: false });
    preset({ d: false });
    expect(body(open())).toContain('hidden');
    useUi.getState().toggleSection('d', true);
    expect(useUi.getState().openSections).toEqual({ d: true });
  });
  it('ohne collapsible immer offen, ohne Inhalt nichts', () => {
    expect(body(html('c', false))).not.toContain('hidden');
    expect(renderToStaticMarkup(<Section heading="x">{false}</Section>)).toBe('');
  });
});
