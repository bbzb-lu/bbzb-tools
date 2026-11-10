import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Header } from './Header';

describe('Header', () => {
  it('zeigt Wortmarke und Tool-Namen, verlinkt zur Startseite', () => {
    const m = renderToStaticMarkup(<Header tool="News-Banner" />);
    expect(m).toContain('href="/"');
    expect(m).toContain('BBZB Tools');
    expect(m).toContain('News-Banner');
    expect(m).toContain('aria-label="BBZB Tools, News-Banner, zur Startseite"');
  });
  it('hängt eine Tool-Klasse an', () => {
    expect(renderToStaticMarkup(<Header tool="X" className="editor-header" />)).toContain('class="bbzb-header editor-header"');
    expect(renderToStaticMarkup(<Header tool="X" />)).toContain('class="bbzb-header"');
  });
  it('rendert Kinder rechts im Kopf', () => {
    expect(renderToStaticMarkup(<Header tool="X"><button>Hilfe</button></Header>)).toContain('<button>Hilfe</button>');
  });
});
