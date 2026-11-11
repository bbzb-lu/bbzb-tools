import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Header, zeilen } from './Header';

describe('Header', () => {
  it('zeigt Wortmarke und Tool-Namen, verlinkt zur Startseite', () => {
    const m = renderToStaticMarkup(<Header tool="IT-News-Banner" />);
    expect(m).toContain('href="/"');
    expect(m.replace(/<[^>]+>/g, '')).toContain('IT-News-BannerBBZB Tools');
    expect(m).toContain('aria-label="BBZB Tools, IT-News-Banner, zur Startseite"');
  });
  it('ohne Tool (Startseite): nur «BBZB Tools», fest, eigener Name', () => {
    const m = renderToStaticMarkup(<Header />);
    expect(m).toContain('class="bbzb-wordmark fest"');
    expect(m).toContain('aria-label="BBZB Tools, Startseite"');
    expect(m).not.toContain('bbzb-logo-tool');
  });
  it('zeilen: vor dem letzten Wort, sonst nach dem letzten Bindestrich', () => {
    expect(zeilen('Social Studio')).toEqual(['Social', 'Studio']);
    expect(zeilen('IT-News-Banner')).toEqual(['IT-News-', 'Banner']);
    expect(zeilen('LegicCard Creator')).toEqual(['LegicCard', 'Creator']);
    expect(zeilen('Datenschutz')).toEqual(['Datenschutz']);
  });
  it('hängt eine Tool-Klasse an', () => {
    expect(renderToStaticMarkup(<Header tool="X" className="editor-header" />)).toContain('class="bbzb-header editor-header"');
    expect(renderToStaticMarkup(<Header tool="X" />)).toContain('class="bbzb-header"');
  });
  it('rendert Kinder rechts im Kopf', () => {
    expect(renderToStaticMarkup(<Header tool="X"><button>Hilfe</button></Header>)).toContain('<button>Hilfe</button>');
  });
  it('Feedback-Link nur mit `feedback`, Tool im Formular vorausgewählt, neuer Tab', () => {
    expect(renderToStaticMarkup(<Header tool="X" />)).not.toContain('Feedback');
    const m = renderToStaticMarkup(<Header tool="Social Studio" feedback="Social Studio" />);
    expect(m).toContain('https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=');
    expect(m).toContain('r4648ddf3572d4c20af02bd380f4486a1=%22Social%20Studio%22');
    expect(m).toContain('target="_blank"');
    expect(m).toContain('rel="noopener noreferrer"');
  });
});
