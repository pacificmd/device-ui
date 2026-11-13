import { describe, expect, it } from 'vitest';
import { FOCUS, MM, Sheet, bendPoint, bounds, circle, defineMaterial, grow, intersect, minus, poly, polyline, rect, ring, union, type Command, type FieldShape } from '../../src/base/index';
import { bentBox, resolveBend } from '../../src/base/bend';

const surface = (c: Command) => {
  if (c.op !== 'surface') throw new Error(`expected a surface, got ${c.op}`);
  return c;
};

describe('Sheet', () => {
  it('keeps commands in paint order', () => {
    const s = new Sheet().surface(rect(0, 0, 9, 9)).cut(circle(1, 1, 1)).glow(rect(0, 0, 9, 9), [1, 0, 0]).surface(rect(1, 1, 2, 2));
    expect(s.commands.map(c => c.op)).toEqual(['surface', 'cut', 'glow', 'surface']);
  });

  it('applies overrides on top of the named material', () => {
    defineMaterial('sheet-test', { rough: 0.2, metal: 1 });
    const { material } = surface(new Sheet().surface(rect(0, 0, 9, 9), { material: 'sheet-test', over: { rough: 0.8 } }).commands[0]!);
    expect(material).toMatchObject({ rough: 0.8, metal: 1 });
  });

  it('cuts downward with a positive depth', () => {
    const [c] = new Sheet().cut(rect(0, 0, 9, 9), { depth: 0.2 }).commands;
    expect(c).toMatchObject({ op: 'cut', depth: 0.2, ink: null });
  });

  it('gives every command its own noise seed', () => {
    const seeds = new Sheet(3).surface(rect(0, 0, 9, 9)).surface(rect(0, 0, 9, 9)).commands.map(c => surface(c).seed.join());
    expect(new Set(seeds).size).toBe(2);
  });

  it('ages every surface with the device, unless one says otherwise', () => {
    const s = new Sheet(1, 0.7).surface(rect(0, 0, 9, 9)).surface(rect(0, 0, 9, 9), { over: { age: 0 } });
    expect(s.commands.map(c => surface(c).material.age)).toEqual([0.7, 0]);
  });

  it('varies noise between devices', () => {
    const one = surface(new Sheet(1).surface(rect(0, 0, 9, 9)).commands[0]!);
    const two = surface(new Sheet(2).surface(rect(0, 0, 9, 9)).commands[0]!);
    expect(one.seed).not.toEqual(two.seed);
  });
});

describe('groups', () => {
  const at = (s: Sheet, i = 0) => s.commands[i]!.shape as { cx: number; cy: number; rotate: number };

  it('moves, turns and nests', () => {
    const s = new Sheet();
    s.group({ at: [100, 50], rotate: Math.PI / 2 }, () => {
      s.surface(rect(9, -1, 2, 2));
      s.group({ at: [10, 0] }, () => s.surface(rect(-1, -1, 2, 2)));
    });
    s.surface(rect(0, 0, 2, 2));
    expect(at(s).cx).toBeCloseTo(100);
    expect(at(s).cy).toBeCloseTo(60);
    expect(at(s).rotate).toBeCloseTo(Math.PI / 2);
    expect(at(s, 1).cy).toBeCloseTo(60);
    expect(at(s, 2).cx).toBe(1);
  });

  it('mirrors a shape and its turn', () => {
    const s = new Sheet();
    s.group({ at: [100, 0], mirror: true }, () => s.surface(rect(9, -1, 2, 2, { rotate: 0.3 })));
    expect(at(s).cx).toBeCloseTo(90);
    expect(at(s).rotate).toBeCloseTo(-0.3);
  });

  it('counts rise from what a surface sits on', () => {
    const s = new Sheet();
    const z = (i: number) => s.commands[i] as unknown as { zEdge: number; zTop: number };
    s.group({ z: 1 }, () => {
      s.surface(rect(0, 0, 9, 9), { rise: 2 }, () => s.surface(rect(0, 0, 9, 9), { rise: -1 }));
      s.surface(rect(0, 0, 9, 9), { rise: 1 });
    });
    expect([z(0).zEdge, z(0).zTop]).toEqual([5, 7]);
    expect([z(1).zEdge, z(1).zTop]).toEqual([7, 6]);
    expect([z(2).zEdge, z(2).zTop]).toEqual([5, 6]);
  });

  it('turns brushing with the group', () => {
    const s = new Sheet();
    s.group({ rotate: 1 }, () => s.surface(rect(0, 0, 9, 9)));
    expect((s.commands[0] as unknown as { material: { tangent: number } }).material.tangent).toBeCloseTo(1);
  });
});

describe('bends', () => {
  const roll = { from: [0, 100], to: [0, 160], drop: 15 } as { from: [number, number]; to: [number, number]; drop: number };

  it('leaves the flat part where it was', () => {
    expect(bendPoint(10, 90, resolveBend(roll))).toEqual([10, 90]);
  });

  it('pulls what is past the start back towards it, and no further than the end', () => {
    const b = resolveBend(roll);
    const [, near] = bendPoint(0, 120, b), [, far] = bendPoint(0, 400, b);
    expect(near).toBeGreaterThan(100);
    expect(near).toBeLessThan(120);
    expect(far).toBeCloseTo(160, 1);
  });

  it('fits a true circle by default', () => {
    const { k, drop } = resolveBend({ from: [0, 0], to: [0, 40] });
    expect(k).toBeCloseTo(1);
    expect(drop).toBeCloseTo(10);
    // A quarter turn holds a quarter of the circle.
    expect(bendPoint(0, (40 * Math.PI) / 2 - 0.01, resolveBend({ from: [0, 0], to: [0, 40] }))[1]).toBeCloseTo(40, 0);
  });

  it('moves a small box past the start to where it lands', () => {
    const b = resolveBend(roll), box = bentBox({ x: -2, y: 150, w: 4, h: 4 }, b), [, y] = bendPoint(0, 152, b);
    expect(box.y).toBeLessThan(y);
    expect(box.y + box.h).toBeGreaterThan(y);
    expect(box.y + box.h).toBeLessThan(150);
  });

  it('mirrors both ways', () => {
    const b = resolveBend({ from: [0, 0], to: [0, 40], mirror: [0, 0] });
    expect(bendPoint(0, -20, b)[1]).toBeCloseTo(-bendPoint(0, 20, b)[1]);
  });

  it('applies to what follows and stops at the next part', () => {
    const s = new Sheet();
    s.surface(rect(0, 0, 4, 4));
    s.bend(roll).surface(rect(0, 0, 4, 4)).cut(rect(0, 0, 4, 4));
    s.part(1);
    s.surface(rect(0, 0, 4, 4));
    expect(s.commands.map(c => !!c.bend)).toEqual([false, true, true, false]);
  });
});

describe('shape operations', () => {
  it('grows a rect, with its corners', () => {
    expect(grow(rect(0, 0, 10, 10, { radius: 2 }), 1)).toMatchObject({ hw: 6, hh: 6, radius: 3, cx: 5 });
  });

  it('grows a drawn shape with room around it', () => {
    const s = grow(poly([[0, 0], [9, 0], [9, 9]]), 20);
    expect(s.grow).toBe(20);
    expect(s.spread).toBeGreaterThan(20);
  });

  it('counts a ring in what a shape can touch', () => {
    expect(bounds(ring(rect(0, 0, 10, 10), 4), 0).x).toBe(-4);
  });

  it('combines into one shape around all of them', () => {
    expect(union(rect(0, 0, 10, 10), rect(20, 5, 10, 10))).toMatchObject({ cx: 15, cy: 7.5, hw: 15, hh: 7.5 });
  });

  it('keeps the first shape\'s box when taking away or trimming', () => {
    expect(minus(rect(0, 0, 10, 10), rect(5, 5, 50, 50))).toMatchObject({ hw: 5, hh: 5 });
    expect(intersect(rect(0, 0, 10, 10), rect(5, 5, 50, 50))).toMatchObject({ hw: 5, hh: 5 });
  });

  it('caches a combination wherever it sits', () => {
    const at = (x: number) => union(rect(x, 0, 10, 10), circle(x + 20, 5, 5)).key;
    expect(at(0)).toBe(at(40));
    expect(at(0)).not.toBe(union(rect(0, 0, 10, 10), circle(21, 5, 5)).key);
  });

  it('refuses to combine what is already grown', () => {
    const shape = union(grow(poly([[0, 0], [9, 0], [9, 9]]), 1), rect(0, 0, 4, 4));
    const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {} } as unknown as CanvasRenderingContext2D;
    expect(() => shape.draw(ctx, 9, 9)).toThrow(/grow/);
  });
});

describe('poly', () => {
  it('rounds a corner on the way round, clockwise', () => {
    expect(polyline([[0, 0, 2], [10, 0], [10, 10], [0, 10]])).toBe('M0 2A2 2 0 0 1 2 0L10 0L10 10L0 10Z');
  });

  it('takes no more radius than its edges have', () => {
    expect(polyline([[0, 0, 50], [10, 0], [10, 10], [0, 10]])).toContain('A5 5');
  });

  it('fits its box to its points', () => {
    expect(poly([[10, 20], [30, 20], [30, 60]])).toMatchObject({ cx: 20, cy: 40, hw: 10, hh: 20 });
  });
});

describe('units', () => {
  it('draws in mm, leaving heights alone', () => {
    const s = new Sheet();
    s.group({ at: [100, 50], scale: MM }, () => s.surface(rect(1, 2, 3, 4, { radius: 1 }), { zTop: 2, bevel: 1 }));
    const c = surface(s.commands[0]!);
    expect(c.shape).toMatchObject({ cx: 110, cy: 66, hw: 6, hh: 8, radius: 4 });
    expect(c).toMatchObject({ zTop: 6, bevel: 4 });
  });

  it('scales a drawn shape, not the css px its edge needs, and caches it apart', () => {
    const s = new Sheet();
    const shape = poly([[0, 0], [8, 0], [8, 8]]);
    s.group({ scale: 2 }, () => s.surface(shape));
    const f = s.commands[0]!.shape as FieldShape;
    expect(f).toMatchObject({ hw: 8, hh: 8, spread: shape.spread });
    expect(f.key).not.toBe(shape.key);
  });

  it('nests', () => {
    const s = new Sheet();
    s.group({ at: [10, 0], scale: 2 }, () => s.group({ at: [5, 0], scale: 3 }, () => s.surface(rect(1, 0, 2, 2))));
    expect(s.commands[0]!.shape).toMatchObject({ cx: 10 + 10 + 12, hw: 6 });
  });
});

describe('verbs', () => {
  it('prints with no depth', () => {
    expect(new Sheet().print(rect(0, 0, 9, 9), [1, 1, 1]).commands[0]).toMatchObject({ op: 'cut', depth: 0, ink: [1, 1, 1] });
  });

  it('sinks a well below what it sits on, and draws on its floor', () => {
    defineMaterial('well', {});
    const s = new Sheet();
    s.well(rect(0, 0, 9, 9), 2, {}, () => s.surface(rect(1, 1, 2, 2), { rise: 0.5 }));
    expect(surface(s.commands[0]!)).toMatchObject({ zEdge: 0, zTop: -2, follow: true });
    expect(surface(s.commands[1]!)).toMatchObject({ zEdge: 2, zTop: 2.5, follow: false });
  });

  it('cuts a well into the last surface, and the next one into the same surface', () => {
    defineMaterial('well', {});
    const s = new Sheet();
    s.surface(rect(0, 0, 9, 9), { zTop: 18 }).well(rect(1, 1, 2, 2), 3).well(rect(4, 4, 2, 2), 1);
    expect(surface(s.commands[1]!)).toMatchObject({ zEdge: 0, zTop: -3, follow: true });
    expect(surface(s.commands[2]!)).toMatchObject({ zEdge: 0, zTop: -1, follow: true });
  });

  it('sets a surface on what it overlaps, and knows how tall that can make it', () => {
    const s = new Sheet();
    s.surface(rect(0, 0, 9, 9), { zTop: 6 });
    s.surface(rect(20, 0, 9, 9), { zTop: 16 });
    s.surface(rect(1, 1, 2, 2), { follow: true, rise: 2 });
    expect(surface(s.commands[2]!)).toMatchObject({ zEdge: 0, zTop: 2, reach: 12 });
  });

  it('lifts a part to the surface it sits on, so a cap rises and a well still cuts from the top', () => {
    defineMaterial('well', {});
    const s = new Sheet();
    s.part(0, 10);
    s.surface(rect(0, 0, 9, 9), { zEdge: -1, zTop: 1 });
    s.well(rect(1, 1, 2, 2), 1);
    expect(surface(s.commands[0]!)).toMatchObject({ zEdge: 9, zTop: 11 });
    expect(surface(s.commands[1]!)).toMatchObject({ zEdge: 0, zTop: -1, follow: true });
  });

  it('lands height 0 on the seat, wherever the seat is', () => {
    const s = new Sheet();
    s.part(0, 10);
    s.surface(rect(0, 0, 9, 9), { zEdge: 0, zTop: 0 });
    s.frost(rect(0, 0, 9, 9), { zEdge: 0, zTop: 0 });
    s.screen(rect(0, 0, 9, 9), {} as TexImageSource, { zTop: 0 });
    expect(s.commands[0]).toMatchObject({ zEdge: 10, zTop: 10 });
    expect(s.commands[1]).toMatchObject({ zEdge: 10, zTop: 10 });
    expect(s.commands[2]).toMatchObject({ zTop: 10 });
  });

  it('gives a tube colour stripes unless it is monochrome, and carries how far it bulges', () => {
    const s = new Sheet();
    s.screen(rect(0, 0, 9, 9), {} as TexImageSource);
    s.screen(rect(0, 0, 9, 9), {} as TexImageSource, { mono: true, bulge: 0.1 });
    s.screen(rect(0, 0, 9, 9), {} as TexImageSource, { kind: 'lcd', ink: [1, 2, 3] });
    expect(s.commands[0]).toMatchObject({ ink: [0.22, 0.24, 0] });
    expect(s.commands[1]).toMatchObject({ ink: [0, 0.1, 0] });
    expect(s.commands[2]).toMatchObject({ ink: [1, 2, 3] });
  });

  it('draws a surface with no heights from a device\'s depth below the seat up to it', () => {
    const s = new Sheet();
    s.surface(rect(0, 0, 9, 9));
    s.part(0, 10);
    s.surface(rect(0, 0, 9, 9));
    expect(surface(s.commands[0]!)).toMatchObject({ zEdge: 0, zTop: 4 });
    expect(surface(s.commands[1]!)).toMatchObject({ zEdge: 6, zTop: 10 });
  });

  it('keeps a well at a height it was given', () => {
    defineMaterial('well', {});
    const s = new Sheet();
    s.well(rect(0, 0, 9, 9), 2, { zEdge: 2 });
    expect(surface(s.commands[0]!)).toMatchObject({ zEdge: 6, zTop: 4, follow: false });
  });

  it('runs a seam along an outline', () => {
    const [c] = new Sheet().seam(rect(0, 0, 9, 9)).commands;
    expect(c!.shape).toMatchObject({ ring: 0.8 });
  });

  it('brings a lamp up with its level', () => {
    const [off] = new Sheet().lamp(rect(0, 0, 9, 9), [1, 0, 0], 0).commands, [on] = new Sheet().lamp(rect(0, 0, 9, 9), [1, 0, 0], 1).commands;
    expect(off).toMatchObject({ emit: [0.02, 0, 0] });
    expect(on).toMatchObject({ emit: [0.62, 0, 0] });
  });

  it('puts a legend where the page put it, whatever the frame', () => {
    const s = new Sheet(), label = { x: 40, y: 50, w: 9, h: 9, text: '', font: '', letterSpacing: '', lines: [] };
    s.group({ at: [100, 100], scale: MM }, () => s.legend({ label }, [1, 1, 1]));
    expect(s.commands[0]!.shape).toMatchObject({ box: { x: 40, y: 50 } });
  });

  it('exports the focus colour', () => {
    expect(FOCUS).toHaveLength(3);
  });
});

describe('what a part is built round', () => {
  const middle = (s: Sheet) => (s.commands.at(-1) as { mid: number }).mid;
  const box = rect(0, 0, 8, 8);

  it('is the ground unless it says otherwise, so it stays solid down to the page', () => {
    const s = new Sheet();
    s.part(0, 19);
    s.surface(box);
    expect(middle(s)).toBe(0);
  });

  it('stays with what it sits on, so what is on a clear part is as deep as that part', () => {
    const s = new Sheet();
    s.part(0, 39, true, 31);
    s.surface(box);
    expect(middle(s)).toBe(31);
  });

  it('is its own seat when it stands clear, whatever the body does', () => {
    const s = new Sheet();
    s.roll({ from: [0, 0], to: [4, 0], past: true, drop: 19 }, 19);
    s.part(0, 25, true);
    s.surface(box);
    expect(middle(s)).toBe(25);
    expect(s.commands.at(-1)).not.toHaveProperty('bend');
  });

  it('is the body\'s when the body is round both ways', () => {
    const s = new Sheet();
    s.roll({ from: [0, 0], to: [4, 0], past: true, drop: 19 }, 19);
    s.part(0, 38);
    s.surface(box);
    expect(middle(s)).toBe(19);
  });
});

