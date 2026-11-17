import { describe, expect, it } from 'vitest';
import { brandLabel, brandNames, featuredTabler, hasIcon, iconSvg, searchBrands, searchTabler } from './catalog';

describe('iconSvg', () => {
  it('zeichnet Tabler mit Strich 1.5, runden Enden und ohne Rahmenpfad', () => {
    const s = iconSvg({ kind: 'tabler', name: 'wifi' }, '#fff');
    expect(s).toContain('stroke-width="1.5"');
    expect(s).toContain('stroke-linecap="round"');
    expect(s).toContain('stroke-linejoin="round"');
    expect(s).toContain('<path d="M12 18l.01 0"/>');
    expect(s).not.toContain('M0 0h24v24H0z');
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

describe('searchTabler', () => {
  it('Name zuerst, dann Stichwörter', () => {
    const r = searchTabler('wifi');
    expect(r[0]).toBe('wifi');
    expect(r).toContain('wifi-off');
  });
  it('findet über Stichwörter und Kategorie wie auf tabler.io', () => {
    expect(searchTabler('wireless')).toContain('wifi');
    expect(searchTabler('password').length).toBeGreaterThan(3);
    expect(searchTabler('notebook')).toContain('device-laptop');
  });
  it('Leerzeichen gelten als Bindestrich, sonst müssen alle Wörter vorkommen', () => {
    expect(searchTabler('arrow left')[0]).toBe('arrow-left');
    expect(searchTabler('wifi qqqqzz')).toEqual([]);
  });
  it('leere und unbekannte Suche ergibt nichts, Limit gilt', () => {
    expect(searchTabler('  ')).toEqual([]);
    expect(searchTabler('qqqqzzzz')).toEqual([]);
    expect(searchTabler('a')).toHaveLength(120);
  });
  it('jedes Icon ist zeichenbar', () => {
    for (const n of searchTabler('a', 10000)) expect(iconSvg({ kind: 'tabler', name: n }, '#fff')).toContain('<path d="');
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

describe('featuredTabler', () => {
  it('liefert die Startauswahl, alle Namen sind echte Icons', () => {
    const f = featuredTabler();
    expect(f.length).toBe(30);
    for (const n of f) expect(hasIcon({ kind: 'tabler', name: n })).toBe(true);
  });
});
