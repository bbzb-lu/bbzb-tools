import { describe, expect, it } from 'vitest';
import { brandLabel, brandNames, featuredLucide, hasIcon, iconSvg, searchBrands, searchLucide } from './catalog';

describe('iconSvg', () => {
  it('zeichnet Lucide mit Strich 1.5 und runden Enden', () => {
    const s = iconSvg({ kind: 'lucide', name: 'gauge' }, '#fff');
    expect(s).toContain('stroke-width="1.5"');
    expect(s).toContain('stroke-linecap="round"');
    expect(s).toContain('stroke-linejoin="round"');
    expect(s).toContain('M3.34 19a10 10 0 1 1 17.32 0');
  });
  it('setzt auch Tabler-Marken auf Strich 1.5 und entfernt den unsichtbaren Rahmenpfad', () => {
    const s = iconSvg({ kind: 'brand', name: 'teams' }, '#fff');
    expect(s).toContain('stroke-width="1.5"');
    expect(s).not.toContain('stroke="none"');
    expect(s).not.toContain('M0 0h24v24H0z');
    expect(s).toContain('M6 10h4');
  });
  it('kennt die ausgewählten Tabler-Marken, alle zeichenbar', () => {
    const n = brandNames();
    expect(n.length).toBeGreaterThan(100);
    for (const must of ['teams', 'onedrive', 'windows', 'chrome', 'slack', 'zoom', 'github', 'google-drive']) expect(n).toContain(must);
    for (const b of n) expect(iconSvg({ kind: 'brand', name: b }, '#fff')).toContain('<path');
  });
});

describe('searchLucide', () => {
  it('Name zuerst, dann Stichwörter', () => {
    const r = searchLucide('wifi');
    expect(r[0]).toBe('wifi');
    expect(r).toContain('wifi-off');
  });
  it('findet über Stichwörter, die nicht im Namen stehen', () => {
    expect(searchLucide('wireless')).toContain('wifi');
    expect(searchLucide('security')).toContain('shield');
    expect(searchLucide('password').length).toBeGreaterThan(3);
  });
  it('findet umbenannte Icons über den alten Namen', () => {
    expect(searchLucide('alert-circle')).toContain('circle-exclamation-point');
  });
  it('liefert deutlich mehr Treffer als eine reine Namenssuche', () => {
    expect(searchLucide('network').length).toBeGreaterThan(searchLucide('network').filter((n) => n.includes('network')).length);
  });
  it('verlangt alle Wörter', () => {
    const r = searchLucide('arrow left');
    expect(r).toContain('arrow-left');
    expect(r.every((n) => !n.includes('qq'))).toBe(true);
    expect(searchLucide('wifi qqqqzz')).toEqual([]);
  });
  it('kennt Icons mit Ziffern im Namen', () => {
    expect(hasIcon({ kind: 'lucide', name: 'arrow-down-0-1' })).toBe(true);
  });
  it('leere und unbekannte Suche ergibt nichts', () => {
    expect(searchLucide('  ')).toEqual([]);
    expect(searchLucide('qqqqzzzz')).toEqual([]);
  });
});

describe('Marken', () => {
  it('suchen nach Name oder Anzeigename, sortiert', () => {
    expect(searchBrands('drive')).toContain('google-drive');
    expect(searchBrands('GitHub')).toContain('github');
    expect(searchBrands('')).toEqual(searchBrands('').slice().sort((a, b) => brandLabel(a).localeCompare(brandLabel(b))));
  });
  it('Anzeigenamen', () => {
    expect(brandLabel('onedrive')).toBe('OneDrive');
    expect(brandLabel('google-drive')).toBe('Google Drive');
    expect(brandLabel('slack')).toBe('Slack');
  });
});

describe('featuredLucide', () => {
  it('liefert die Startauswahl, alle Namen sind echte Icons', () => {
    const f = featuredLucide();
    expect(f.length).toBe(30);
    for (const n of f) expect(hasIcon({ kind: 'lucide', name: n })).toBe(true);
  });
});
