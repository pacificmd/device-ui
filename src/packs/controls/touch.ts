// Controls for flat glass and soft rubber, most of them lit from behind.
import { arc, circle, contact, definePart, FOCUS, input, legendColor, limits, linear, mask, minus, MM, path, poly, press, rect, resolveMaterial, setValue, slide, stepOf, together, turn, type GroupOptions, type Part, type PartDef, type Vec3 } from 'device-ui';
import { icon } from './icons.js';
import { key, legend, words } from './key.js';
import { font, lamp, num, polar, scale } from './shared.js';

const across = (p: Part) => p.w > p.h;

// Nothing goes down on glass. This is how fast the light under a finger comes up.
const glass = press({ mass: 64, material: 'finger-on-glass', friction: 0.5, contact: false });

// A capacitive key: printed on the glass, lit when held, and left on with `on`.
definePart(key('[d-key~="soft"]', {
  ...glass,
  lit: { stiffness: 220, damping: 26 },
  live: ['on', 'color'],
  draw(s, p, d, k) {
    // `ink` prints its legend in that, so it reads with the light off, `groove` moulds a groove that wide round it, mm, which a round key follows, and `gain` is how hard its lamp is driven: past about 0.2 a lamp burns towards white.
    const c = lamp(p, 'white'), press = k.down, ink = p.el.getAttribute('ink'), lit = p.springs.lit!.value, level = Math.max(lit, ink ? 0 : 0.1, press * 0.8), groove = num(p, 'groove', 0) * MM;
    const shape = rect(p.x, p.y, p.w, p.h, { radius: groove ? Math.min(p.w, p.h) / 2 : Math.min(p.h / 2, 12) });
    if (groove) s.cut(minus(shape, rect(p.x + groove, p.y + groove, p.w - groove * 2, p.h - groove * 2, { radius: Math.min(p.w, p.h) / 2 - groove })), { depth: 0.3, soft: groove });
    // The lamp shines through a printed legend, so its ink stops showing as the lamp comes up.
    legend(s, p, k.cap, { ink: ink ? scale(linear(ink), 1 - lit) : scale(c, 0.03), emit: scale(c, num(p, 'gain', 0.46) * level) });
    // A moulded key lights only through its legend: the plastic round it stays dark, photographed lit (reference/ipod3/10.jpg).
    if (press > 0.01 && !groove) s.glow(shape, scale(c, 0.5 * press), 1);
    k.focus(shape);
  },
}));

const strip = slide({
  input: 0, touch: true, mass: 23, material: 'finger-on-glass', friction: 0.5,
  axis: p => (across(p) ? 'x' : 'y'), travel: p => (across(p) ? p.w : -p.h) / MM,
});

// A strip you touch anywhere along. `segments` lights dots, or 0 for a solid bar.
definePart({
  selector: '[d-slider~="strip"]',
  ...strip,
  paint(s, p) {
    const c = lamp(p, 'white'), t = p.springs.slide!.value, n = num(p, 'segments', 0), wide = across(p);
    const len = wide ? p.w : p.h, th = wide ? p.h : p.w, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    if (n) {
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n, on = Math.max(0, Math.min(1, (t - i / n) * n));
        const x = wide ? p.x + k * len : cx, y = wide ? cy : p.y + p.h - k * len;
        s.cut(circle(x, y, th * 0.2), { ink: scale(c, 0.012 + on * 0.03), emit: scale(c, 0.012 + on * 0.34) });
      }
    } else {
      const bar = 2.5, track = wide ? rect(p.x, cy - bar / 2, len, bar, { radius: bar }) : rect(cx - bar / 2, p.y, bar, len, { radius: bar });
      s.cut(track, { ink: scale(c, 0.012), emit: scale(c, 0.012) });
      const f = t * len;
      if (f > 0.5) s.cut(wide ? rect(p.x, cy - bar / 2, f, bar, { radius: bar }) : rect(cx - bar / 2, p.y + p.h - f, bar, f, { radius: bar }), { ink: scale(c, 0.03), emit: scale(c, 0.34) });
    }
    if (p.focused) s.glow(rect(p.x - 4, p.y - 4, p.w + 8, p.h + 8, { radius: 6 }), FOCUS);
  },
});

// There is no spring to measure a finger on a ring by, so every step counts as a brisk one.
const STROKE = 15;
const CLICK = 15;

// The ring: a finger stroking glass, stepping the range with a tick for each step. Nothing on it moves.
const stroke = turn({
  material: 'finger-on-glass', hubless: true, detents: { every: CLICK },
  accepts: (_, e) => !(e.target as Element).closest('button'),
  // Under the ring are four switches, one each way, which a press with no stroke in it closes.
  tap(p, e) {
    const box = p.el.getBoundingClientRect(), x = e.clientX - box.left - box.width / 2, y = e.clientY - box.top - box.height / 2;
    const rim = p.el.querySelector<HTMLElement>(`button[rim="${Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'bottom' : 'top'}"]`);
    if (!rim) return;
    contact(p, 'press', STROKE);
    rim.click();
  },
  track: {
    read: p => +input(p).value,
    write(p, v) {
      const el = input(p), before = el.value;
      setValue(el, v);
      if (el.value !== before) contact(p, 'detent', STROKE);
    },
    reach(p) {
      const el = input(p), [min, max] = limits(el);
      return { min, max, step: stepOf(el) };
    },
    scale: p => limits(input(p))[1] - limits(input(p))[0],
    radians: p => stepOf(input(p)) / ((CLICK * Math.PI) / 180),
  },
});

// Transport legends, in a box 2 wide, as `[x, y]` polygons. Twice as wide as tall, as measured on a nano's wheel.
const bar = (a: number, b: number) => [[a, -0.5], [b, -0.5], [b, 0.5], [a, 0.5]];
const GLYPHS: Record<string, number[][][]> = {
  next: [[[-1, -0.5], [-0.12, 0], [-1, 0.5]], [[-0.12, -0.5], [0.74, 0], [-0.12, 0.5]], bar(0.74, 1)],
  prev: [[[1, -0.5], [0.12, 0], [1, 0.5]], [[0.12, -0.5], [-0.74, 0], [0.12, 0.5]], bar(-1, -0.74)],
  play: [[[-1, -0.5], [0.05, 0], [-1, 0.5]], bar(0.36, 0.6), bar(0.76, 1)],
  up: [[[0, -0.6], [0.8, 0.5], [-0.8, 0.5]]],
  down: [[[0, 0.6], [-0.8, -0.5], [0.8, -0.5]]],
  left: [[[-0.6, 0], [0.5, -0.8], [0.5, 0.8]]],
  right: [[[0.6, 0], [-0.5, 0.8], [-0.5, -0.8]]],
  plus: [[[-0.7, -0.13], [0.7, -0.13], [0.7, 0.13], [-0.7, 0.13]], [[-0.13, -0.7], [0.13, -0.7], [0.13, 0.7], [-0.13, 0.7]]],
  minus: [[[-0.7, -0.13], [0.7, -0.13], [0.7, 0.13], [-0.7, 0.13]]],
};

// The legends of a wheel, one for each way round from the top, on a circle `at` out, or as far out as `out` says for one that wide.
function legends(ctx: OffscreenCanvasRenderingContext2D, p: Part, cx: number, cy: number, R: number, at: number, out?: (half: number) => number) {
  const labels = (p.el.getAttribute('labels') ?? '').split(',').map(t => t.trim());
  const tall = p.el.hasAttribute('legend') ? num(p, 'legend', 1.5) * MM : 0, k = tall || R * 0.1;
  ctx.font = font(p, tall ? tall / 0.72 : R * 0.11);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  labels.forEach((l, i) => {
    const a = (i * Math.PI * 2) / Math.max(labels.length, 1), glyph = GLYPHS[l];
    // Let into a face, each legend's outer edge keeps the same distance in from the rim, whichever way it's wider: measured on a nano.
    const half = glyph ? Math.abs(Math.sin(a)) * k + Math.abs(Math.cos(a)) * k / 2 : Math.abs(Math.sin(a)) * ctx.measureText(l).width / 2 + Math.abs(Math.cos(a)) * k / 2;
    const [x, y] = polar(cx, cy, out ? out(half) : at, a);
    if (glyph) {
      for (const shape of glyph) {
        ctx.beginPath();
        shape.forEach(([a, b]) => ctx.lineTo(x + a! * k, y + b! * k));
        ctx.fill();
      }
    } else if (l) ctx.fillText(l, x, y);
  });
}

// A touch ring around a centre button. Stroking it steps the range, with a tick for each step.
// `legend` is how tall its legends stand, words and glyphs alike, mm, and `ink` what colour they're printed in.
definePart({
  selector: '[d-wheel~="click"]',
  ...together(stroke, press({ mass: 11, friction: 0.16, of: 'button:not([rim])' })),
  mask(ctx, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, flush = p.el.hasAttribute('flush');
    legends(ctx, p, cx, cy, R, R * 0.74, flush ? half => R * 0.865 - half : undefined);
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    const name = p.el.getAttribute('material') || 'soft-touch-white';
    const ink = p.el.getAttribute('ink'), printed = ink ? linear(ink) : legendColor(name);
    if (p.el.hasAttribute('flush')) {
      // Let into its face with a hair of a gap, and level with it: on a nano the gap is 0.08mm and the ring's edge barely rounded, measured.
      // The hub is the same, in the middle of the ring, `hub` mm across.
      const hub = Math.min(num(p, 'hub', 0) * MM / 2 || R * 0.355, R * 0.8), gap = 0.35, groove = num(p, 'groove', 0) * MM;
      // `groove` moulds the ring out of its face instead, with a groove that wide round it and the hub, mm, and no gap.
      const seam = (r: number, depth: number) => (groove ? s.cut(minus(circle(cx, cy, r + groove), circle(cx, cy, r)), { depth: 0.3, soft: groove }) : s.well(circle(cx, cy, r + gap), depth, { bevel: 0.3 }));
      seam(R, 0.5);
      s.surface(circle(cx, cy, R), { material: name, bevel: 0.5, zEdge: -0.08, zTop: 0, over: { touch: d.age * 0.6 } });
      if (p.mask) s.cut(mask(p.mask), { ink: printed });
      seam(hub, 0.6);
      s.surface(circle(cx, cy, hub), { material: p.el.getAttribute('center') || name, bevel: 0.7, zEdge: -0.1, zTop: -p.springs.press!.value * 0.3 });
      if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
      return;
    }
    s.surface(circle(cx, cy, R), { material: name, bevel: 2, zEdge: 0, zTop: -0.6, over: { touch: d.age * 0.6 } });
    if (p.mask) s.cut(mask(p.mask), { ink: printed });
    s.surface(circle(cx, cy, R * 0.38), { material: 'well', bevel: 1, zEdge: -0.6, zTop: -1.4 });
    s.surface(circle(cx, cy, R * 0.36), {
      material: p.el.getAttribute('center') || name, bevel: 3, zEdge: -1, zTop: 0.2 - p.springs.press!.value * 0.7,
    });
    if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
  },
});

const QUARTERS = ['top', 'right', 'bottom', 'left'] as const;
// Where a button of a ring is: quarter `i` of it, clockwise from the top, between the rim and `out` percent of the way across. Only there, so what's between can still be taken hold of.
const quarter = (el: HTMLElement, i: number, out: number) => {
  const round = (r: number, from: number, to: number) => Array.from({ length: 13 }, (_, k) => {
    const a = (i * Math.PI) / 2 + from + ((to - from) * k) / 12;
    return `${(50 + Math.sin(a) * r).toFixed(2)}% ${(50 - Math.cos(a) * r).toFixed(2)}%`;
  });
  el.style.clipPath = `polygon(${[...round(50, -Math.PI / 4, Math.PI / 4), ...round(out / 2, Math.PI / 4, -Math.PI / 4)].join(',')})`;
};
// The disc: a real one on a bearing, free to run on after a flick. Nothing holds it at a step, and each one it passes is a `detent` event for whatever it scrolls.
const onDisc = (p: Part, e: PointerEvent) => {
  const r = p.el.getBoundingClientRect();
  return !(e.target as Element).closest('button') && Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) <= r.width / 2;
};
const disc = turn({ mass: 30, material: 'ball-bearing', hubless: true, ticks: p => num(p, 'step', CLICK), accepts: onDisc });
// The same disc for a finger: nothing on it moves or runs on, and a step is still a `detent` event.
const pad = turn({ material: 'finger-on-glass', hubless: true, ticks: p => num(p, 'step', CLICK), accepts: onDisc });
const ringed = (joint: typeof disc) => together(joint, press({ mass: 3, material: 'plastic-on-rubber', of: 'button:not([rim])' }), ...QUARTERS.map(q => press({ name: q, mass: 3, material: 'plastic-on-rubber', of: `button[rim="${q}"]` })));
// A disc in a ring of four buttons, with one more in the middle, each its own moulding. The disc fires `detent` each `step` degrees it passes, with the steps in `detail`.
// `disc` and `hub` are how wide those are, mm, `legend` how tall the ring's legends stand, and `height` how far the ring stands, mm. The buttons are `[rim]` ones, top, right, bottom and left, and one without for the middle.
const ringedPart = (selector: string, joint: typeof disc, place?: (p: Part) => GroupOptions): PartDef => {
  const mechanism = ringed(joint);
  return {
    selector,
    ...mechanism,
    connect(p) {
      // Not placed yet, so its size comes from its box.
      const done = mechanism.connect?.(p), w = p.el.offsetWidth, out = p.el.hasAttribute('disc') ? (100 * num(p, 'disc', 0) * MM) / w : 78, hub = p.el.hasAttribute('hub') ? (100 * num(p, 'hub', 0) * MM) / w : 27.5;
      // Each button is only where it is on the ring, so the disc between them can still be taken hold of.
      p.el.querySelectorAll<HTMLElement>('button').forEach(el => {
        const i = QUARTERS.indexOf(el.getAttribute('rim') as typeof QUARTERS[number]);
        if (i < 0) return void (el.style.inset = `${50 - hub / 2}%`);
        quarter(el, i, out);
      });
      return done;
    },
    mask(ctx, p) {
      const R = Math.min(p.w, p.h) / 2, inner = num(p, 'disc', (R * 1.56) / MM) * MM / 2;
      legends(ctx, p, p.x + p.w / 2, p.y + p.h / 2, R, (R + inner) / 2);
      return { x: p.x, y: p.y, w: p.w, h: p.h };
    },
    paint(s, p, d) {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, name = p.el.getAttribute('material') || 'gloss-white';
      const inner = num(p, 'disc', (R * 1.56) / MM) * MM / 2, hub = num(p, 'hub', (R * 0.55) / MM) * MM / 2, tall = num(p, 'height', 0.9), gap = 0.2 * MM, over = { touch: d.age * 0.6 };
      // The ring reads as one moulding with hairlines across it: only the quarter under the finger dips.
      s.surface(minus(circle(cx, cy, R), circle(cx, cy, inner + gap)), { material: name, profile: 'round', bevel: (R - inner) * 0.45, zEdge: 0, zTop: tall, over });
      QUARTERS.forEach((q, i) => {
        const [x, y] = polar(cx, cy, (R + inner) / 2, (i * Math.PI) / 2), [lx, ly] = polar(cx, cy, (R + inner) / 2, ((i + 0.5) * Math.PI) / 2), down = p.springs[q]!.value;
        s.engrave(rect(lx - (R - inner) / 2, ly - gap / 2, R - inner, gap, { rotate: ((i + 0.5) * Math.PI) / 2 + Math.PI / 2 }), 0.4);
        if (down > 0.01) s.cut(circle(x, y, (R - inner) * 0.9), { depth: 0.4 * down, soft: (R - inner) * 0.5 });
      });
      if (p.mask) s.cut(mask(p.mask), { ink: p.el.hasAttribute('ink') ? linear(p.el.getAttribute('ink')!) : legendColor(name) });
      s.well(circle(cx, cy, inner + gap), 1, { bevel: 0.3 });
      const face = (x: number, y: number) => s.surface(circle(x, y, inner), { material: name, bevel: 0.25 * MM, zEdge: 0.2, zTop: tall * 0.6, over });
      if (place) s.group(place(p), () => face(0, 0));
      else face(cx, cy);
      s.well(circle(cx, cy, hub + gap / 2), 0.5, { bevel: 0.3 });
      s.surface(circle(cx, cy, hub), { material: p.el.getAttribute('center') || name, profile: 'dome', zEdge: tall * 0.5, zTop: tall * 0.75 - p.springs.press!.value * 0.4, over });
      if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
    },
  };
};

// Its disc is a real one on a bearing that you spin and that runs on after a flick. Its angle is in `turn`.
definePart(ringedPart('[d-wheel~="scroll"]', disc, p => disc.place(p)));
// Its disc is fixed and feels a finger going round it, as `d-wheel="scroll"` does a hand.
definePart(ringedPart('[d-wheel~="pad"]', pad));

const rocker = press({ mass: 4.6, material: 'plastic-on-rubber', of: 'button', rocks: [[0, -1], [-1, 0], [1, 0], [0, 1], [0, 0, 1]] });
const CROSS = cross(16);
// A cross on a 100 box with arms `a` either side of its middle, cornered by 4, or with every arm ending in a half round.
function cross(a: number, round = false): string {
  const lo = 50 - a, hi = 50 + a, e = 100 - a;
  return round
    ? `M${lo} ${a} A${a} ${a} 0 0 1 ${hi} ${a} V${lo - 2} Q${hi} ${lo} ${hi + 2} ${lo} H${e} A${a} ${a} 0 0 1 ${e} ${hi} H${hi + 2} Q${hi} ${hi} ${hi} ${hi + 2} V${e} A${a} ${a} 0 0 1 ${lo} ${e} V${hi + 2} Q${lo} ${hi} ${lo - 2} ${hi} H${a} A${a} ${a} 0 0 1 ${a} ${lo} H${lo - 2} Q${lo} ${lo} ${lo} ${lo - 2} Z`
    : `M${lo} 4 Q${lo} 0 ${lo + 4} 0 H${hi - 4} Q${hi} 0 ${hi} 4 V${lo} H96 Q100 ${lo} 100 ${lo + 4} V${hi - 4} Q100 ${hi} 96 ${hi} H${hi} V96 Q${hi} 100 ${hi - 4} 100 H${lo + 4} Q${lo} 100 ${lo} 96 V${hi} H4 Q0 ${hi} 0 ${hi - 4} V${lo + 4} Q0 ${lo} 4 ${lo} H${lo} Z`;
}
const ARROWS = 'M50 10 L57 22 H43 Z M50 90 L43 78 H57 Z M10 50 L22 43 V57 Z M90 50 L78 57 V43 Z';

// A cross you rock with a thumb. Four real buttons, up, left, right, down, sit on its arms. The word after `dpad` says how it's moulded:
// A rocker's tilt for its surface: as far as `fall`, mm, from one edge to the other, toward the button held.
const tilted = (p: Part, fall: number): [number, number] => [p.springs.x!.value * fall, p.springs.y!.value * fall];

// `disc` for a dished disc on a pivot, `ring` for a round moulding with raised arrows and a hole for a centre key, `cross` for one moulding with a dimple and ribbed arms.
// On a cross, `arm` is how wide each arm is, mm, `smooth` leaves the ribs off and keeps the dimple, and `plain` leaves both off.
// `flat` is a flat ring let into its face with a hub of its own in the middle, as on a music player with no wheel. `hub` is how wide that is, mm, `center` its material, `labels` the ring's legends clockwise from the top, `legend` how tall they stand, mm, and `ink` their colour. `mark` prints one on the hub, `mark-size` tall, mm, in `mark-ink`.
definePart({
  selector: '[d-stick~="dpad"]',
  options: ['disc', 'ring', 'cross', 'flat'],
  // A fifth button, where there is one, is the middle: it pushes the whole moulding straight in.
  ...rocker,
  connect(p) {
    const done = rocker.connect?.(p);
    if (words(p, 'd-stick')[1] === 'flat') {
      // Clockwise from the top, the order the buttons aren't in: up, left, right, down, middle.
      const hub = (100 * num(p, 'hub', (p.el.offsetWidth * 0.6) / MM) * MM) / p.el.offsetWidth;
      p.el.querySelectorAll<HTMLElement>('button').forEach((el, n) => {
        Object.assign(el.style, { position: 'absolute', inset: '0', gridArea: 'auto' });
        if (n < 4) quarter(el, [0, 3, 1, 2][n]!, hub);
        else {
          el.style.inset = `${50 - hub / 2}%`;
          el.style.borderRadius = '50%';
        }
      });
    }
    return done;
  },
  mask(ctx, p) {
    if (words(p, 'd-stick')[1] !== 'flat') return;
    const R = Math.min(p.w, p.h) / 2;
    legends(ctx, p, p.x + p.w / 2, p.y + p.h / 2, R, (R + num(p, 'hub', (R * 1.2) / MM) * MM / 2) / 2);
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p, d) {
    const name = p.el.getAttribute('material') || 'plastic-black', moulding = words(p, 'd-stick')[1];
    if (moulding === 'flat') {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, hub = num(p, 'hub', (R * 1.2) / MM) * MM / 2, gap = 0.35, z = p.springs.z!.value;
      const ink = p.el.getAttribute('ink'), hubName = p.el.getAttribute('center') || name, tall = num(p, 'height', 0);
      s.well(circle(cx, cy, R + gap), 0.5, { bevel: 0.3 });
      s.surface(circle(cx, cy, R), { material: name, bevel: 0.5, zEdge: -0.1, zTop: tall, over: { touch: d.age * 0.6 } });
      if (p.mask) s.cut(mask(p.mask), { ink: ink ? linear(ink) : legendColor(name) });
      // Under it are four switches, and the side under the thumb dips.
      for (const [ax, ay, t] of [[0, -1, -p.springs.y!.value], [-1, 0, -p.springs.x!.value], [1, 0, p.springs.x!.value], [0, 1, p.springs.y!.value]] as const) {
        if (t > 0) s.cut(circle(cx + ax * (R + hub) / 2, cy + ay * (R + hub) / 2, (R - hub) * 0.8), { depth: 0.35 * t, soft: (R - hub) * 0.6 });
      }
      s.well(circle(cx, cy, hub + gap), 0.6, { bevel: 0.3 });
      s.surface(circle(cx, cy, hub), { material: hubName, bevel: 0.7, zEdge: tall - 0.1, zTop: tall - z * 0.3 });
      const glyph = GLYPHS[p.el.getAttribute('mark') ?? ''], k = (num(p, 'mark-size', 2) * MM) / 2, onHub = p.el.getAttribute('mark-ink');
      if (glyph) for (const shape of glyph) s.cut(poly(shape.map(([a, b]) => [cx + a! * k, cy + b! * k] as const)), { ink: onHub ? linear(onHub) : legendColor(hubName) });
      if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
      return;
    }
    if (moulding === 'disc' && p.el.hasAttribute('plain')) {
      // A bare disc with a dished middle, as on a music player: no cross, the side under the thumb dips, and a press in the middle sinks all of it.
      const R = Math.min(p.w, p.h) / 2, cx = p.x + p.w / 2, cy = p.y + p.h / 2, z = p.springs.z!.value;
      s.well(circle(cx, cy, R), 0.9, { bevel: R * 0.05 });
      s.surface(circle(cx, cy, R * 0.95), { material: name, zEdge: 0.4 - z * 0.4, zTop: num(p, 'height', 1.2) - z * 0.4, bevel: R * 0.2, dish: R * 0.04, tilt: tilted(p, 1) });
      if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
      return;
    }
    if (moulding === 'disc') {
      // A dished disc on a pivot: the cross stands proud of it, and an arm dips as it's pressed.
      const R = Math.min(p.w, p.h) / 2, cx = p.x + p.w / 2, cy = p.y + p.h / 2, arm = R * 0.35, inner = R * 0.82;
      const tile = { ink: [0.02, 0.02, 0.023] as Vec3, rough: 0.2, soft: 0.4 };
      s.well(circle(cx, cy, R), 0.9, { bevel: R * 0.06 });
      s.surface(circle(cx, cy, R * 0.94), { material: name, follow: true, zEdge: 0.7, zTop: 1.6, bevel: R * 0.16, dish: 1.5, tilt: tilted(p, 1.4) });
      for (const [x, y, w, h] of [
        [cx - arm, cy - inner, arm * 2, inner - arm], [cx - arm, cy + arm, arm * 2, inner - arm],
        [cx - inner, cy - arm, inner - arm, arm * 2], [cx + arm, cy - arm, inner - arm, arm * 2],
      ] as const) s.cut(rect(x, y, w, h), { ...tile, depth: -0.14 });
      s.cut(rect(cx - arm, cy - arm, arm * 2, arm * 2), { ...tile, depth: -0.14 });
      for (const at of [-arm, arm]) for (const from of [-inner, arm]) {
        s.engrave(rect(cx + at - 1.5, cy + from, 3, inner - arm), 0.25);
        s.engrave(rect(cx + from, cy + at - 1.5, inner - arm, 3), 0.25);
      }
      if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
      return;
    }
    if (moulding === 'ring') {
      // A round moulding with a hole for a centre key, which is its own part, and raised arrows. It rocks: the side under the thumb dips.
      // `square` moulds it as a rounded square, as round a five-way on an e-reader.
      const R = Math.min(p.w, p.h) / 2, cx = p.x + p.w / 2, cy = p.y + p.h / 2, side = R * 2;
      const ring = p.el.hasAttribute('square') ? (r: number) => rect(cx - r, cy - r, r * 2, r * 2, { radius: Math.max(r - R * 0.7, 0) }) : (r: number) => circle(cx, cy, r);
      s.cut(ring(R + 2.4), { depth: 0.3, soft: 3.2 });
      s.well(ring(R), 1.2, { bevel: 0.8 });
      s.surface(ring(R - 0.4), { material: name, zEdge: -1.2, zTop: num(p, 'height', 1.6), bevel: R * 0.13, dish: R * 0.05, tilt: tilted(p, 1.4) });
      // `plain` leaves the arrows off, for a ring with its marks printed on.
      if (!p.el.hasAttribute('plain')) s.surface(path(ARROWS, cx - R, cy - R, side, side, { spread: 4 }), { material: name, follow: true, bevel: 1, rise: 0.3 });
      if (p.focused) s.glow(ring(R), FOCUS);
      return;
    }
    if (moulding === 'cross') {
      // One moulding on a pivot: nothing shifts, the arm under the thumb dips and the whole cross rocks round the dimple.
      const k = p.w / 100, cx = p.x + p.w / 2, cy = p.y + p.h / 2, reach = 50 * k;
      const round = p.el.hasAttribute('round'), half = p.el.hasAttribute('arm') ? (num(p, 'arm', 8) * MM) / 2 / k : round ? 14 : 16, arm = p.el.hasAttribute('arm') ? half * k : 16 * k;
      const line = cross(half, round), plain = p.el.hasAttribute('plain'), ribbed = !plain && !p.el.hasAttribute('smooth');
      s.well(path(line, p.x, p.y, p.w, p.h, { spread: 6 }), 1.6, { bevel: 1 });
      const gap = num(p, 'gap', 0.3) * MM;
      s.surface(path(line, p.x + gap, p.y + gap, p.w - gap * 2, p.h - gap * 2, { spread: 6 }), { material: name, profile: num(p, 'bevel', 0) ? 'round' : 'chamfer', bevel: num(p, 'bevel', 0.875) * MM, zEdge: -1.4, zTop: num(p, 'height', 2.6), tilt: tilted(p, 1.6) });
      if (!plain) s.cut(circle(cx, cy, 13 * k), { depth: 0.5, soft: 11 * k });
      if (ribbed) for (const [ax, ay] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
        const box = (at: number, w: number, l: number) => rect(cx + ax * at - (ax ? l : w) / 2, cy + ay * at - (ax ? w : l) / 2, ax ? l : w, ax ? w : l);
        for (const at of [0.62, 0.72, 0.82]) s.engrave(box(at * reach, arm * 1.3, 2.4), 0.06, { soft: 1 });
      }
      if (p.focused) s.glow(path(line, p.x, p.y, p.w, p.h, { spread: 6 }), FOCUS);
      return;
    }
    s.well(path(CROSS, p.x, p.y, p.w, p.h, { spread: 6 }), 1.2, { bevel: 2 });
    s.surface(path(CROSS, p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3, { spread: 6 }), {
      material: name, bevel: 3.5, zEdge: -0.6, zTop: 3.2, tilt: tilted(p, 1.6),
    });
    s.cut(path(ARROWS, p.x, p.y, p.w, p.h, { spread: 4 }), { depth: 0.2, ink: legendColor(name) });
    if (p.focused) s.glow(path(CROSS, p.x, p.y, p.w, p.h, { spread: 6 }), FOCUS);
  },
});

const HOLD = 0.9;

// A fingerprint pad. Hold it until the ring closes and it fires a `hold` event, by finger or Space.
definePart(key('[d-key~="sensor"]', {
  ...glass,
  label: false,
  cap: 'titanium',
  own: true,
  tick(p) {
    // By the clock, not the frame step, because the step is capped and a slow GPU would stretch the hold.
    const now = performance.now(), dt = Math.min((now - ((p.data.at ?? now) as number)) / 1000, 0.25);
    const was = (p.data.t ?? 0) as number, t = Math.min(1, Math.max(0, was + (p.springs.press!.target > 0 ? dt / HOLD : -dt * 3)));
    p.data.at = now;
    if (t === was && p.springs.press!.target === 0) {
      delete p.data.at;
      return false;
    }
    p.data.t = t;
    if (t === 1 && !p.data.fired) {
      p.data.fired = true;
      p.el.dispatchEvent(new CustomEvent('hold', { bubbles: true }));
    }
    if (t === 0) p.data.fired = false;
    return true;
  },
  draw(s, p, d, k) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, c = lamp(p, 'white'), t = (p.data.t ?? 0) as number;
    s.surface(circle(cx, cy, R), { material: k.cap, bevel: R * 0.1, zEdge: 0, zTop: 0.8 });
    s.surface(circle(cx, cy, R * 0.84), { material: 'glass-black', bevel: 1.5, zEdge: 0.8, zTop: -0.3 });
    const size = R * 1.1, press = k.down;
    s.cut(icon('fingerprint', cx - size / 2, cy - size / 2, size, { weight: 1.5 }), { ink: scale(c, 0.02), emit: scale(c, 0.05 + 0.3 * press) });
    if (t > 0.002) s.cut(arc(cx, cy, R * 0.92, 0, t * Math.PI * 2, 2.2), { ink: scale(c, 0.03), emit: scale(c, 0.4) });
    k.focus(circle(cx, cy, R + 1));
  },
}));
