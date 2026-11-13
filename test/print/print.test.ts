import { describe, expect, it } from 'vitest';
import { Sheet, hasMaterial, path, type Command, type DeviceInfo, type Part } from 'device-ui';
import { partDefs } from '../../src/base/registry';
import { crownHeight, printKinds } from '../../src/print/index';

const STAR = 'M50 4L97 38L79 93L21 93L3 38Z';

const attrs = (values: Record<string, string> = {}) => ({
  getAttribute: (n: string) => values[n] ?? null,
  hasAttribute: (n: string) => n in values,
  closest: () => null,
  parentElement: null,
});

const device = { el: attrs(), x: 0, y: 0, w: 300, h: 300, material: 'keycap-black', wear: 0.4, radius: 8, top: 4 };

const paint = (selector: string, values: Record<string, string>): Command[] => {
  const def = partDefs().find(p => p.selector === selector)!;
  const part = { el: attrs(values), def, x: 60, y: 60, w: 100, h: 40, focused: false, label: null, mask: null, springs: {}, data: {} } as unknown as Part;
  const s = new Sheet();
  def.paint(s, part, device as unknown as DeviceInfo);
  return s.commands;
};

const print = (kind: string, more: Record<string, string> = {}) => paint('[d-mark~="print"]', { 'd-mark': `print ${kind}`, path: STAR, ...more });

describe('[d-mark~="print"]', () => {
  it('draws nothing with nothing to print', () => {
    expect(paint('[d-mark~="print"]', { 'd-mark': 'print pad' })).toEqual([]);
  });

  it('adds ink only for the processes that have any', () => {
    for (const kind of ['pad', 'silk']) expect((print(kind)[0] as { ink: unknown }).ink).not.toBeNull();
    for (const kind of ['emboss', 'deboss']) expect((print(kind)[0] as { ink: unknown }).ink).toBeNull();
  });

  it('leaves a pad print at the height of what it is on, and stands a silk screen on it', () => {
    expect(print('pad')[0]).toMatchObject({ op: 'cut', depth: 0 });
    expect((print('silk')[0] as { depth: number }).depth).toBeLessThan(0);
  });

  it('softens a pad print and not a silk screen', () => {
    expect((print('pad')[0] as { feather: number }).feather).toBeGreaterThan(0);
    expect((print('silk')[0] as { feather: number }).feather).toBe(0);
  });

  it('etches into what is under the finish, gone matte', () => {
    expect(print('etch')[0]).toMatchObject({ op: 'cut', rough: 0.72 });
    // A laser goes microns in, no edge to catch a light, unless it's asked for a cut with walls.
    expect((print('etch')[0] as { depth?: number }).depth ?? 0).toBe(0);
    expect((print('etch', { depth: '0.2' })[0] as { depth: number }).depth).toBeGreaterThan(0);
  });

  it('moulds up in the body\'s own material, following what is under it', () => {
    expect(print('mould')[0]).toMatchObject({ op: 'surface', name: 'keycap-black', follow: true });
    expect(print('mould', { depth: '0.3' })[0]).toMatchObject({ op: 'cut', depth: 0.3 });
  });

  it('makes foil of foil, and follows', () => {
    expect(print('foil')[0]).toMatchObject({ op: 'surface', name: 'foil-gold', follow: true });
    expect(print('foil', { material: 'foil-silver' })[0]).toMatchObject({ name: 'foil-silver' });
  });

  it('turns about the middle of the part', () => {
    const [flat] = print('silk'), [turned] = print('silk', { rotate: '90' });
    expect(flat!.shape).toMatchObject({ cx: 110, cy: 80, rotate: 0 });
    expect((turned!.shape as { rotate: number }).rotate).toBeCloseTo(Math.PI / 2);
  });

  it('knows every kind', () => {
    for (const kind of printKinds) expect(print(kind).length).toBeGreaterThan(0);
  });

  it('wears each process differently, and none past all of it', () => {
    const wear = (kind: string, value: string) => (print(kind, { wear: value })[0] as { wear: number }).wear;
    expect(wear('pad', '0.4')).toBeGreaterThan(wear('silk', '0.4'));
    expect(wear('pad', '1')).toBe(1);
  });
});

describe('[d-mark~="sticker"]', () => {
  it('is a thin sheet on whatever is under it', () => {
    expect(paint('[d-mark~="sticker"]', {})).toMatchObject([{ op: 'surface', name: 'sticker-paper', follow: true, zEdge: 0 }]);
    expect(hasMaterial('sticker-vinyl')).toBe(true);
  });

  it('comes away at a corner', () => {
    const [sheet, corner] = paint('[d-mark~="sticker"]', { lift: '0.5', corner: 'bl' }) as [Command & { shape: { key: string } }, Command & { crown: [number, number] }];
    expect(sheet.shape.key.startsWith('minus')).toBe(true);
    expect(corner.crown[1]).toBeLessThan(0);
  });

  it('die-cuts to a path', () => {
    expect(paint('[d-mark~="sticker"]', { path: STAR })[0]!.shape).toMatchObject({ key: path(STAR, 0, 0, 100, 40).key });
  });
});

describe('crownHeight', () => {
  const box = { x: 0, y: 0, w: 100, h: 100 };

  it('is all top on something flat', () => {
    expect(crownHeight(0, 0, box, [0, 0])).toBe(1);
  });

  it('falls from the middle to the rim', () => {
    expect(crownHeight(50, 50, box, [1, 1])).toBe(1);
    expect(crownHeight(100, 50, box, [1, 0])).toBe(0);
    expect(crownHeight(75, 50, box, [1, 0])).toBeCloseTo(0.75);
  });
});
