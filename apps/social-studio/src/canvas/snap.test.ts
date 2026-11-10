import { describe, expect, it } from 'vitest';
import { elementBounds } from '../model/geometry';
import { el, project } from '../model/fixtures';
import { SNAP_PX, snapAnchor, snapLines, snapMove, snapSources } from './snap';

const p = project(2, [el({ id: 'a', x: 300, y: 400, width: 200, height: 100 }), el({ id: 'b', x: 900, y: 900, width: 50, height: 50 })]);
const lines = snapLines(p, ['b']);

describe('snapLines', () => {
  it('Ränder 72 px, Slide-Mitten, Nähte und Kanten', () => {
    for (const x of [0, 72, 540, 1008, 1080, 1152, 1620, 2088, 2160]) expect(lines.x).toContain(x);
    for (const y of [0, 72, 675, 1278, 1350]) expect(lines.y).toContain(y);
  });
  it('Kanten und Mitte anderer Elemente, nicht des gezogenen', () => {
    for (const x of [300, 400, 500]) expect(lines.x).toContain(x);
    for (const y of [400, 450, 500]) expect(lines.y).toContain(y);
    expect(lines.x).not.toContain(925);
  });
  it('mehrere bewegte Elemente: keine eigenen Linien als Ziel', () => {
    const q = project(1, [el({ id: 'a', x: 300, y: 400, width: 200, height: 100 }), el({ id: 'b', x: 900, y: 900, width: 50, height: 50 }), el({ id: 'c', x: 610, y: 610 })]);
    const l = snapLines(q, ['a', 'b']);
    for (const x of [300, 400, 500, 900, 925, 950]) expect(l.x).not.toContain(x);
    for (const y of [400, 450, 500, 900, 925, 950]) expect(l.y).not.toContain(y);
    expect(l.x).toContain(610);
  });
  it('ausgeblendete Elemente zählen nicht', () => {
    const q = project(1, [el({ id: 'a', x: 333, visible: false }), el({ id: 'b' })]);
    expect(snapLines(q, ['b']).x).not.toContain(333);
  });
  it('weitere Quellen lassen sich anhängen', () => {
    snapSources.push(() => ({ x: [777], y: [] }));
    try {
      expect(snapLines(p, ['b']).x).toContain(777);
    } finally {
      snapSources.pop();
    }
  });
});

describe('Sicherheitszonen', () => {
  const story = { ...project(2), format: { id: 'story', width: 1080, height: 1920 } };
  it('Story: oben 250 und unten 340 pro Format, nur wenn eingeblendet', () => {
    expect(snapLines(story, ['x']).y).not.toContain(250);
    const l = snapLines(story, ['x'], { zones: true });
    expect(l.y).toContain(250);
    expect(l.y).toContain(1580);
  });
  it('Post: Profilraster 33.75 px links und rechts jeder Slide', () => {
    const l = snapLines(p, ['b'], { zones: true });
    for (const x of [33.75, 1046.25, 1113.75, 2126.25]) expect(l.x).toContain(x);
    expect(snapLines(p, ['b']).x).not.toContain(33.75);
  });
});

describe('snapMove', () => {
  it('linke Kante rastet am Rand 72 ein', () => {
    const r = snapMove({ x: 75, y: 200, width: 50, height: 50 }, lines, 1);
    expect(r.dx).toBe(-3);
    expect(r.guides.x).toBe(72);
  });
  it('Mitte rastet an der Slide-Mitte ein', () => {
    const r = snapMove({ x: 512, y: 200, width: 50, height: 50 }, lines, 1);
    expect(r.dx).toBe(3);
    expect(r.guides.x).toBe(540);
  });
  it('rechte Kante rastet an der Naht ein, unten am Rand', () => {
    const r = snapMove({ x: 1025, y: 1225, width: 50, height: 50 }, lines, 1);
    expect(r).toEqual({ dx: 5, dy: 3, guides: { x: 1080, y: 1278 } });
  });
  it('weiter als 6 px: nichts', () => {
    const r = snapMove({ x: 79, y: 200, width: 50, height: 50 }, lines, 1);
    expect(r).toEqual({ dx: 0, dy: 0, guides: { x: null, y: null } });
  });
  it('die nächste Linie gewinnt', () => {
    expect(snapMove({ x: 70, y: 200, width: 1009, height: 50 }, lines, 1).guides.x).toBe(1080); // rechts 1 px, links 2 px
  });
  it('Schwelle in Bildschirm-px: bei Zoom 0.5 rasten 12 Welt-px ein, bei Zoom 2 nur 3', () => {
    expect(snapMove({ x: 72 + 11, y: 200, width: 50, height: 50 }, lines, 0.5).dx).toBe(-11);
    expect(snapMove({ x: 72 + 4, y: 200, width: 50, height: 50 }, lines, 2).dx).toBe(0);
    expect(snapMove({ x: 72 + 2.9, y: 200, width: 50, height: 50 }, lines, 2).dx).toBeCloseTo(-2.9);
    expect(SNAP_PX).toBe(6);
  });
  it('oben und unten rasten die 72-px-Ränder auch bei Zoom 2 ein', () => {
    expect(snapMove({ x: 200, y: 72 - 2.9, width: 50, height: 50 }, lines, 2).guides.y).toBe(72);
    expect(snapMove({ x: 200, y: 1350 - 72 - 50 + 2.9, width: 50, height: 50 }, lines, 2).guides.y).toBe(1278);
  });
  it('gedreht: die gedrehte Hülle rastet ein', () => {
    // 200×100 um 90° gedreht bei x = 175: Hülle x 75..175
    const box = elementBounds(el({ x: 175, y: 200, width: 200, height: 100, rotation: 90 }));
    const r = snapMove(box, lines, 1);
    expect(r.dx).toBeCloseTo(-3);
    expect(r.guides.x).toBe(72);
  });
});

describe('snapAnchor', () => {
  const bbox = { x: 100, y: 100, width: 200, height: 100 };
  it('freie Ecke rastet in beiden Achsen ein', () => {
    const r = snapAnchor({ x: 300, y: 200 }, { x: 1006, y: 1275 }, bbox, null, lines, 1);
    expect(r.point).toEqual({ x: 1008, y: 1278 });
    expect(r.guides).toEqual({ x: 1008, y: 1278 });
  });
  it('Seiten-Anfasser rastet nur auf seiner Kante ein', () => {
    const r = snapAnchor({ x: 300, y: 150 }, { x: 1004, y: 674 }, bbox, null, lines, 1);
    expect(r.point).toEqual({ x: 1008, y: 674 });
    expect(r.guides).toEqual({ x: 1008, y: null });
  });
  it('mit Seitenverhältnis: bleibt auf der Diagonale', () => {
    // fester Punkt (100, 100), Diagonale 2:1; x = 1004 → 1008, y folgt
    const r = snapAnchor({ x: 300, y: 200 }, { x: 1004, y: 552 }, bbox, { x: 100, y: 100 }, lines, 1);
    expect(r.point.x).toBeCloseTo(1008);
    expect(r.point.y).toBeCloseTo(554);
    expect(r.guides).toEqual({ x: 1008, y: null });
  });
  it('gedreht: Anfasser, der nicht auf der Hülle liegt, rastet nicht ein', () => {
    const r = snapAnchor({ x: 200, y: 150 }, { x: 1006, y: 1275 }, bbox, null, lines, 1);
    expect(r.point).toEqual({ x: 1006, y: 1275 });
  });
  it('Schwelle hängt vom Zoom ab', () => {
    expect(snapAnchor({ x: 300, y: 150 }, { x: 1000, y: 674 }, bbox, null, lines, 0.5).point.x).toBe(1008);
    expect(snapAnchor({ x: 300, y: 150 }, { x: 1000, y: 674 }, bbox, null, lines, 1).point.x).toBe(1000);
  });
});
