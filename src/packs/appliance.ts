// Machines at home and in buildings: hobs, fridge doors, lifts.
import { arc, circle, definePart, defineStyles, FOCUS, path, rect, spring, text, type Part, type Vec3 } from 'device-ui';
import { lampColours } from 'device-ui/materials';
import { key, legend } from 'device-ui/controls/key';
import { keyStyles, scale } from 'device-ui/controls/shared';

defineStyles(`
${keyStyles('[d-barhandle]')}
[d-hob~="ring"], [d-hob~="plan"], [d-hob~="digit"], [d-lamp~="arrow"], [d-lift~="doors"] { display: block; }
`);

const TAU = Math.PI * 2;
const RED = lampColours.red!;
const GREY: Vec3 = [0.05, 0.05, 0.055];
const AMBER: Vec3 = [5.5, 2.1, 0.25];
const lit = (k: number): Vec3 => [AMBER[0] * k, AMBER[1] * k, AMBER[2] * k];
const brushed = { aniso: 0.7, grain: [0, 1, 1] as [number, number, number] };

// A cooking ring: printed on the glass, with a coil under it that shows through as it heats.
definePart({
  selector: '[d-hob~="ring"]',
  live: ['heat'],
  paint(s, p: Part) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = p.w / 2, t = +(p.el.getAttribute('heat') ?? 0);
    if (t > 0.004) {
      const n = Math.max(4, Math.floor(R / 12));
      for (let i = 0; i < n; i++) {
        const r = R * (0.16 + (0.76 * i) / (n - 1)), k = t * Math.sqrt(t) * (0.012 + 0.04 * Math.sin(((i + 0.5) / n) * Math.PI));
        s.cut(arc(cx, cy, r, 0, TAU, (R * 0.76) / n - 3.5), { ink: scale(RED, 0.02), emit: scale(RED, k) });
      }
      s.glow(circle(cx, cy, R * 0.9), scale(RED, 0.012 * t), 10);
    }
    s.cut(arc(cx, cy, R, 0, TAU, 1.5), { ink: GREY });
    s.cut(arc(cx, cy, R * 0.55, 0, TAU, 1), { ink: GREY });
    for (let i = 0; i < 4; i++) s.cut(arc(cx, cy, R + 7, (i * TAU) / 4 - 0.05, (i * TAU) / 4 + 0.05, 5), { ink: GREY });
  },
});

// Which ring a row of controls belongs to: a small printed plan of the top.
definePart({
  selector: '[d-hob~="plan"]',
  paint(s, p) {
    const at = +(p.el.getAttribute('zone') ?? 0);
    const dots: [number, number, number][] = [[0.28, 0.32, 0.26], [0.28, 0.8, 0.18], [0.72, 0.26, 0.18], [0.72, 0.72, 0.24]];
    dots.forEach(([x, y, r], i) => {
      const cx = p.x + p.w * x, cy = p.y + p.h * y, R = r * p.h;
      if (i === at) s.cut(circle(cx, cy, R), { ink: [0.2, 0.2, 0.2] });
      else s.cut(arc(cx, cy, R, 0, TAU, 1), { ink: [0.07, 0.07, 0.07] });
    });
  },
});

const SEG: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
  H: 'bcefg', L: 'def', '-': 'g',
};

// A digit that is not there until it is lit. Nothing prints on the glass when `value` is empty.
definePart({
  selector: '[d-hob~="digit"]',
  live: ['value'],
  paint(s, p) {
    const lit = SEG[p.el.getAttribute('value') ?? ''];
    if (!lit) return;
    const t = 3, g = 1, w = p.w, h = p.h, x = p.x, y = p.y, mid = y + h / 2 - t / 2;
    const bars: Record<string, [number, number, number, number]> = {
      a: [x + t + g, y, w - 2 * (t + g), t],
      g: [x + t + g, mid, w - 2 * (t + g), t],
      d: [x + t + g, y + h - t, w - 2 * (t + g), t],
      f: [x, y + t / 2 + g, t, h / 2 - t - g],
      b: [x + w - t, y + t / 2 + g, t, h / 2 - t - g],
      e: [x, y + h / 2 + g, t, h / 2 - t - g],
      c: [x + w - t, y + h / 2 + g, t, h / 2 - t - g],
    };
    for (const k of lit) {
      const [a, b, c, d] = bars[k]!;
      s.cut(rect(a, b, c, d, { radius: 1.2 }), { ink: scale(RED, 0.03), emit: scale(RED, 0.15) });
    }
  },
});

// A bar handle on two posts. Pressing it pulls the door out of its seal, and again closes it.
definePart({
  selector: '[d-barhandle]',
  springs: { pull: spring({ mass: 300, return: 0.095, friction: 0.47, material: 'steel-on-steel' }) },
  live: ['aria-pressed'],
  update(p) {
    p.springs.pull!.set(p.el.getAttribute('aria-pressed') === 'true' ? 1 : 0);
  },
  paint(s, p) {
    const pull = p.springs.pull!.value, top = 9 + pull * 5, cy = p.y + p.h / 2, r = p.h * 0.34;
    for (const x of [p.x + 30, p.x + p.w - 30]) {
      s.surface(circle(x, cy, r + 3), { material: 'chrome', bevel: 2, zEdge: 0, zTop: 0.8 });
      s.surface(circle(x, cy, r), { material: 'brushed-steel', bevel: 1, zEdge: 0.6, zTop: top - 2 });
    }
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: p.h / 2 }), { material: 'chrome', profile: 'round', bevel: p.h / 2, zEdge: top - 4, zTop: top });
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: p.h / 2 }), FOCUS);
  },
});

// A steel push button with a lit ring round its cap. `on` lights the ring.
definePart(key('[d-key~="ring"]', {
  feel: { mass: 3, material: 'steel-on-steel' },
  cap: 'brushed-steel',
  own: true,
  lit: { stiffness: 180, damping: 24 },
  live: ['on'],
  draw(s, p, d, k) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, glow = p.springs.lit!.value;
    const cap = k.cap, metal = cap === 'brushed-steel';
    s.surface(circle(cx, cy, R), { material: 'black-oxide', bevel: 2, zEdge: 0, zTop: 0.9, over: { wear: 0 } });
    s.cut(arc(cx, cy, R * 0.84, -Math.PI, Math.PI, R * 0.08), { ink: lit(0.006), emit: lit(0.3 * glow) });
    if (glow > 0.02) s.glow(circle(cx, cy, R * 0.86), lit(0.1 * glow), R * 0.12);
    s.surface(circle(cx, cy, R * 0.72), { material: 'well', bevel: 1, zEdge: 0.9, zTop: 0 });
    s.surface(circle(cx, cy, R * 0.69), {
      material: cap, radial: metal, bevel: R * 0.1, zEdge: 0, zTop: 2.8 - 1.5 * k.down, dish: 0.16,
      over: { ...(metal ? brushed : {}), touch: d.age * 0.5, wear: 0 },
    });
    k.focus(circle(cx, cy, R + 1.5));
    legend(s, p, cap, { depth: 0.14, ink: [0.015, 0.015, 0.017] });
  },
}));

// One lit arrow for each way the car can go.
definePart({
  selector: '[d-lamp~="arrow"]',
  live: ['on'],
  paint(s, p) {
    const on = p.el.hasAttribute('on'), d = p.el.hasAttribute('down') ? 'M0 12 H100 L50 88 Z' : 'M50 12 L100 88 H0 Z';
    s.cut(path(d, p.x, p.y, p.w, p.h, { spread: 3 }), { ink: lit(on ? 0.05 : 0.006), emit: on ? lit(0.62) : undefined });
  },
});

// The doors, with the landing behind them. `open` slides them apart, `floor` names the landing.
definePart({
  selector: '[d-lift~="doors"]',
  springs: { open: spring({ mass: 40000, return: 0.047, friction: 1.0, material: 'steel-on-steel' }) },
  live: ['open', 'floor'],
  update(p) {
    p.springs.open!.set(p.el.hasAttribute('open') ? 1 : 0);
  },
  paint(s, p) {
    const g = 18, x = p.x + g, y = p.y + g, w = p.w - g * 2, h = p.h - g - 12, t = Math.max(0, Math.min(1, p.springs.open!.value));
    const name = p.el.getAttribute('floor') ?? '', font = '500 190px "Barlow Semi Condensed", sans-serif';
    if (t > 0.01) {
      s.surface(rect(x, y, w, h), { material: 'enamel-cream', bevel: 0.5, zEdge: 0, zTop: -3, over: { wear: 0, emit: [0.05, 0.043, 0.03] } });
      s.surface(rect(x, y + h * 0.8, w, h * 0.2), { material: 'terrazzo', bevel: 0.5, zEdge: -3, zTop: -2.8, over: { wear: 0 } });
      s.cut(rect(x, y + h * 0.8, w, 3), { ink: [0.02, 0.02, 0.02] });
      s.cut(text(name, x, y + h * 0.17, w, h * 0.5, { font, spread: 6 }), { ink: [0.03, 0.05, 0.09] });
    }
    const leaf = Math.max(w / 2 - (w / 2 - 7) * t, 7), rail = [[x, 1], [x + w - leaf, -1]] as const;
    for (const [left, side] of rail) {
      s.surface(rect(left, y, leaf, h), { material: 'brushed-aluminium', bevel: 1.5, zEdge: -1.4, zTop: 0.6, over: { wear: 0, age: 0, tangent: Math.PI / 2 } });
      s.surface(rect(side > 0 ? left + leaf - 3 : left, y, 3, h), { material: 'rubber', bevel: 1, zEdge: -1.4, zTop: 0.8 });
    }
    const steel = { material: 'brushed-steel', bevel: 3, zEdge: 0, zTop: 2.6, over: { wear: 0 } };
    s.surface(rect(p.x, p.y, g, p.h, { radius: 2 }), steel);
    s.surface(rect(p.x + p.w - g, p.y, g, p.h, { radius: 2 }), steel);
    s.surface(rect(p.x, p.y, p.w, g, { radius: 2 }), steel);
    s.surface(rect(p.x + g, p.y + p.h - 12, p.w - g * 2, 12), { material: 'diamond-plate', bevel: 1, zEdge: -1, zTop: 0.2, over: { wear: 0 } });
  },
});
