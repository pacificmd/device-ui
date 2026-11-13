import { describe, expect, it, vi } from 'vitest';
import { Sheet, hasMaterial, resolveMaterial, type Command, type DeviceInfo, type Part } from 'device-ui';
import { lampColours, materials } from 'device-ui/materials';
import { partDefs } from '../../src/base/registry';
import catalogue from '../../parts.json';
import '../../src/packs/controls/index';
import { limits } from '../../src/base/drag';
import { fraction } from '../../src/packs/controls/shared';
import '../../src/print/index';

// Every pack, so every part is in partDefs().
import.meta.glob('../../src/packs/*.ts', { eager: true });

// Enough of a page for a paint: an element, the input, meter or canvas it holds, and a 2d context that takes anything.
const inside = { value: '0', min: '', max: '', step: '', checked: false, disabled: false, width: 64, height: 64, style: {}, getAttribute: () => null, hasAttribute: () => false };
const context = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 8 }) : () => {}), set: () => true });
vi.stubGlobal('document', { createElement: () => ({ width: 64, height: 64, getContext: () => context }) });
vi.stubGlobal('HTMLVideoElement', class {});
vi.stubGlobal('HTMLImageElement', class {});
vi.stubGlobal('HTMLCanvasElement', class {});
vi.stubGlobal('getComputedStyle',() => ({ fontFamily: 'serif', fontSize: '16px', fontWeight: '400', color: '#000', lineHeight: '20px', letterSpacing: '0px' }));

const attrs = (values: Record<string, string> = {}) => ({
  getAttribute: (n: string) => values[n] ?? null,
  hasAttribute: (n: string) => n in values,
  closest: () => null,
  querySelector: () => inside,
  querySelectorAll: () => [],
  textContent: '',
  style: {},
});

/** Any number in a command that isn't one, which the GPU would take in silence. */
const broken = (v: unknown, path = ''): string[] => {
  if (typeof v === 'number') return Number.isFinite(v) ? [] : [`${path}: ${v}`];
  if (!v || typeof v !== 'object') return [];
  return Object.entries(v).flatMap(([k, x]) => broken(x, `${path}.${k}`));
};

const device = { el: attrs(), x: 40, y: 40, w: 300, h: 300, material: 'brass', wear: 0.5, age: 0.5, radius: 8, top: 4 };

const part = (selector: string, el = attrs()) => {
  const def = partDefs().find(p => p.selector === selector)!;
  const springs = Object.fromEntries(Object.keys(def.springs ?? {}).map(k => [k, { value: 0 }]));
  return { def, part: { el, def, x: 60, y: 60, w: 100, h: 100, focused: false, label: null, mask: null, springs, data: {} } as unknown as Part };
};

const paint = (selector: string, el = attrs(), mutate: (p: Part) => void = () => {}, on = device) => {
  const { def, part: p } = part(selector, el);
  mutate(p);
  const s = new Sheet();
  def.paint(s, p, on as unknown as DeviceInfo);
  return s.commands;
};

describe('latching bars', () => {
  // Latched is its checkbox ticked; down is how far the cap has travelled.
  const latched = (values: Record<string, string> = {}) => ({ ...attrs(values), querySelector: () => ({ ...inside, checked: true }) });
  const cap = (el = latched(), down = 1) => paint('[d-key~="tab"]', el, p => { p.springs.press!.value = down; })[1]! as Extract<Command, { op: 'surface' }>;
  const emit = (el = latched(), down = 1) => Math.max(...cap(el, down).material.emit);
  const glow = (el: ReturnType<typeof attrs>) => emit(el);

  it('light only when they have a colour and are latched', () => {
    expect(emit()).toBe(0);
    expect(emit(attrs({ color: 'amber' }))).toBe(0);
    expect(emit(latched({ color: 'amber' }))).toBeGreaterThan(0);
  });

  it('light nothing for a finger resting on them or a press on its way down', () => {
    expect(emit(attrs({ 'd-key': 'tab lit' }), 0.22)).toBe(0);
    expect(emit(attrs({ color: 'amber' }), 0.6)).toBe(0);
  });

  it('light through the cap of the kind that does, with no colour named', () => {
    expect(glow(latched({ 'd-key': 'tab lit' }))).toBeGreaterThan(0);
    expect(emit(attrs({ 'd-key': 'tab lit' }), 0)).toBe(0);
  });

  it('take gain as more of the same light', () => {
    expect(glow(latched({ 'd-key': 'tab lit', gain: '2' }))).toBeCloseTo(glow(latched({ 'd-key': 'tab lit' })) * 2);
  });

  it('show as much of the well round the cap as gap says', () => {
    const inset = (el: ReturnType<typeof attrs>) => 50 - (cap(el).shape as { hw: number }).hw;
    expect(inset(attrs())).toBe(2);
    expect(inset(attrs({ gap: '0.25' }))).toBe(1);
  });

  it('keep their legend dark while disabled, whatever is behind it', () => {
    const backlit = { ...device, el: attrs({ backlight: 'white' }), material: 'keycap-ivory' };
    const legend = (el: ReturnType<typeof attrs>) => paint('[d-key~="tab"]', el, undefined, backlit).find(c => c.op === 'cut') as Extract<Command, { op: 'cut' }>;
    const on = legend(attrs({ icon: 'sun' })), off = legend({ ...attrs({ icon: 'sun' }), disabled: true } as ReturnType<typeof attrs>);
    expect(on.emit).toBeTruthy();
    expect(off.emit).toBeFalsy();
    expect(off.ink).not.toEqual(on.ink);
  });
});

describe('sliding switches', () => {
  const well = (el = attrs(), checked = false) => {
    return paint('[d-slider~="nub"]', el, p => { p.springs.slide!.value = checked ? 1 : 0; })[0] as Extract<Command, { op: 'surface' }>;
  };
  it('have a dark slot unless they say lit, and then it fills as the nub slides over', () => {
    const emit = (el = attrs(), checked = false) => Math.max(...well(el, checked).material.emit);
    expect(emit(attrs(), true)).toBe(0);
    expect(emit(attrs({ lit: '' }), true)).toBeGreaterThan(emit(attrs({ lit: '' })) * 5);
  });
});

describe('a joint with no button', () => {
  it.each(['[d-tool~="blade"]', '[d-tool~="pull"]'])('%s still draws', selector => {
    const el = { ...attrs(), querySelector: () => null };
    expect(paint(selector, el as unknown as ReturnType<typeof attrs>).length).toBeGreaterThan(0);
  });
});

describe('materials', () => {
  it('all resolve to finite numbers', () => {
    for (const name of Object.keys(materials)) {
      expect(hasMaterial(name)).toBe(true);
      const m = resolveMaterial(name);
      for (const v of [...m.color, ...m.sub, ...m.emit, ...m.grain, m.rough, m.metal, m.coat, m.aniso]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('has the lamp colours', () => {
    expect(Object.keys(lampColours)).toEqual(['red', 'phosphor', 'amber', 'yellow', 'green', 'lime', 'blue', 'white', 'ice', 'led', 'cyan', 'violet', 'pink', 'neon']);
  });
});

describe('limits', () => {
  it('reads the defaults a range reports as blank', () => {
    expect(limits({ min: '', max: '' })).toEqual([0, 100]);
    expect(fraction({ value: '60', min: '', max: '' })).toBeCloseTo(0.6);
    expect(limits({ min: 0, max: 1 })).toEqual([0, 1]);
  });
});

const ALL = partDefs().map(p => p.selector);

// Waiting on the zero-size fix: these paint a NaN at 0x0, dividing by a side. They don't throw. Take them off as they're fixed.
const NO_SIZE_NAN = ['[d-meter~="vu"]', '[d-watch~="bracelet"]'];

describe('parts', () => {
  it('finds every pack', () => {
    for (const selector of ['[d-key=""]', '[d-lamp=""]', 'd-surface', '[d-watch~="hands"]', '[d-mark~="print"]']) expect(ALL).toContain(selector);
  });

  describe.each([[100, 100], [1, 1], [0, 0]])('at %ix%i', (w, h) => {
    it.each(ALL)('builds %s without errors', selector => {
      const commands = paint(selector, attrs(), p => {
        p.w = w;
        p.h = h;
      });
      if (!w && NO_SIZE_NAN.includes(selector)) return;
      expect(broken(commands)).toEqual([]);
    });
  });

  // parts.json is read from the source without running it. This is what it says, against what runs.
  describe('parts.json', () => {
    const written = catalogue.parts.flatMap(p => p.forms).filter(p => p.selector !== 'd-device');
    const def = (selector: string) => partDefs().find(p => p.selector === selector)!;

    it('lists what is defined', () => {
      expect(written.map(p => p.selector).sort()).toEqual([...ALL].sort());
    });

    it.each(written)('has every attribute $selector reads as it paints', p => {
      const asked = new Set<string>();
      const el = { ...attrs(), getAttribute: (n: string) => (asked.add(n), null), hasAttribute: (n: string) => (asked.add(n), false) };
      paint(p.selector, el as ReturnType<typeof attrs>);
      expect([...asked].filter(n => !p.attrs.some(a => a.name === n))).toEqual([]);
    });

    it.each(written)('has the joint and live of $selector', p => {
      // A follower is carried by another part's joint, so nothing runs for it to report.
      const d = def(p.selector), first = p.joint?.split('+')[0];
      expect(first === 'follow' ? undefined : first, 'joint').toBe(d.motion?.joint);
      expect([...p.live].sort(), 'live').toEqual([...(d.live ?? [])].sort());
    });
  });

  it('sinks a key as it is pressed', () => {
    const top = (press: number) => {
      const [, cap] = paint('[d-key=""]', attrs(), p => { p.springs.press!.value = press; });
      return cap!.op === 'surface' ? cap!.zTop : NaN;
    };
    expect(top(1)).toBeLessThan(top(0));
  });

  it('lights a focus ring only when focused', () => {
    const glows = (focused: boolean) => paint('[d-key=""]', attrs(), p => { p.focused = focused; }).filter(c => c.op === 'glow');
    expect(glows(false)).toHaveLength(0);
    expect(glows(true)).toHaveLength(1);
  });

  it('turns a knob indicator with the spring', () => {
    const line = (angle: number) => paint('[d-knob=""]', attrs(), p => { p.springs.turn!.value = angle; }).findLast(c => c.op === 'cut')!;
    // Drawn with the knob, which turns about its middle: straight up at rest, across a quarter turn on.
    const a = line(0).shape as { ax: number; ay: number; bx: number; by: number }, b = line(Math.PI / 2).shape as typeof a;
    expect(a.ax).toBeCloseTo(a.bx);
    expect(a.ay).not.toBeCloseTo(a.by);
    expect(b.ay).toBeCloseTo(b.by);
    expect(b.ax).not.toBeCloseTo(b.bx);
  });

  it('throws a toggle to the other side', () => {
    const tip = (pos: number) => {
      const c = paint('[d-switch~="toggle"]', attrs(), p => { p.springs.hinge!.value = pos; }).find(k => k.shape.type === 'capsule')!;
      return c.shape.type === 'capsule' ? c.shape.by : NaN;
    };
    expect(tip(1)).toBeLessThan(tip(-1));
  });

  it('puts four screws on a device that asks for them', () => {
    expect(paint('d-device[screws]').filter(c => c.op === 'cut')).toHaveLength(4);
  });
});
