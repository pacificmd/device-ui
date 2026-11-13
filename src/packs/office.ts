// Desk machines: typewriters, telephones and telegraph keys.
import { capsule, circle, contact, definePart, defineStyles, FOCUS, hinge, intersect, linear, mechanism, minus, MM, partOf, path, poly, press, rect, ring, spring, text, turn, type FieldShape, type Part, type Point, type Sheet, type SurfaceOptions } from 'device-ui';
import { key, legend } from 'device-ui/controls/key';
import { controlStyles, keyStyles, num, nums, PUNCHED, TAPE_THICK, upright } from 'device-ui/controls/shared';

defineStyles(`[d-embosser~="rim"], [d-embosser~="tape"] { display: block; }
${controlStyles('[d-embosser~="wheel"]')}
${keyStyles('[d-embosser~="lever"]', '[d-embosser~="cutter"]')}
.d-gl [d-embosser~="wheel"], .d-gl [d-embosser~="wheel"] input { border-radius: 50%; }
[d-typewriter~="carriage"], [d-typewriter~="typebars"], [d-typewriter~="bell"], [d-telephone=""], [d-telephone~="handset"], [d-telegraph] { display: block; }
${keyStyles('[d-telegraph~="lever"]', '[d-telegraph~="short"] button')}
.d-gl [d-telegraph~="lever"] { border-radius: 50%; }
[d-telegraph~="short"] button { display: block; width: 100%; height: 100%; }
.d-gl [d-telegraph~="short"] button { border-radius: 0; }`);

const PAPER = 340, MARGIN = 20, PRINT = 178, PLATEN = 402;
const FACE = '700 16px "Courier New", Courier, monospace';
const INK: [number, number, number] = [0.03, 0.03, 0.035];
const HALF = 168;

/** One typed line. Each letter lands a hair off true, as it does on a real machine. */
const typed = (cells: string[], x: number, y: number, ADV: number, LH: number, COLS: number): FieldShape => ({
  type: 'field', cx: x + (COLS * ADV) / 2, cy: y, hw: (COLS * ADV) / 2, hh: LH / 2, rotate: 0, spread: 2,
  key: `typed|${cells.join('\u0001')}`,
  draw(ctx, _, h) {
    ctx.font = FACE;
    ctx.textBaseline = 'middle';
    cells.forEach((group, i) => {
      for (const ch of group ?? '') ctx.fillText(ch, i * ADV + 0.4, h / 2 + (((i * 7 + ch.charCodeAt(0) * 13) % 11) - 5) * 0.08);
    });
  },
});

// The moving top of a typewriter: platen, paper, lever and knobs. `col` and `row` drive it.
// `pitch` and `leading` are the mm a letter and a line move, `cols` how many letters fit, and the element's `lines` what's typed.
definePart({
  selector: '[d-typewriter~="carriage"]',
  springs: { col: spring({ mass: 2000, return: 9.7, friction: 0.41, material: 'steel-on-steel', sound: 'carriage' }), row: spring({ mass: 2000, return: 1.3, friction: 0.64, material: 'steel-on-steel', contact: false }) },
  live: ['col', 'row', 'rev'],
  update(p) {
    p.springs.col!.set(+(p.el.getAttribute('col') ?? 0));
    p.springs.row!.set(+(p.el.getAttribute('row') ?? 0));
  },
  paint(s, p) {
    const ADV = num(p, 'pitch', 2.5) * MM, LH = num(p, 'leading', 4.5) * MM, COLS = num(p, 'cols', 30);
    const middle = p.x + p.w / 2, printY = p.y + PRINT, col = p.springs.col!.value, row = p.springs.row!.value;
    const paperX = middle - MARGIN - col * ADV, platenX = paperX + PAPER / 2 - PLATEN / 2, top = printY - 34;
    // The rail stays where it is, and everything else rides along it.
    s.surface(rect(p.x + 8, top - 13, p.w - 16, 9, { radius: 4.5 }), { material: 'chrome', bevel: 4.5, zEdge: 0, zTop: 3, over: { rough: 0.2 } });
    s.surface(rect(paperX - 16, top - 112, PAPER + 32, 130, { radius: 18 }), { material: 'brushed-steel', bevel: 4, zEdge: 0, zTop: 3, over: { wear: 0, age: 0.05 } });
    s.surface(rect(platenX - 34, top, PLATEN + 68, 60, { radius: 5 }), { material: 'rubber', bevel: 30, zEdge: 2, zTop: 11, over: { rough: 0.5 } });
    for (const [x, knob] of [[platenX - 34, -30], [platenX + PLATEN, 38]] as const) {
      s.surface(rect(x, top - 8, 34, 76, { radius: 5 }), { material: 'lacquer-black', bevel: 3, zEdge: 0, zTop: 13 });
      s.surface(rect(x + (knob > 0 ? 30 : 0) , top + 22, 8, 16), { material: 'chrome', bevel: 4, zEdge: 2, zTop: 7 });
      s.surface(rect(x + knob - (knob > 0 ? 0 : 0), top + 3, 28, 54, { radius: 7 }), { material: 'knurled', bevel: 8, zEdge: 2, zTop: 12 });
    }
    const height = 62 + row * LH, sheet = rect(paperX, printY + 26 - height, PAPER, height, { radius: 1 });
    s.surface(sheet, { material: 'paper', bevel: 0.8, zEdge: 9, zTop: 11.2, profile: 'flat', over: { wear: 0, age: 0.06 } });
    const lines = (p.el as HTMLElement & { lines?: string[][] }).lines ?? [];
    lines.forEach((cells, i) => {
      s.cut(typed(cells, paperX + MARGIN, printY + (i - row) * LH, ADV, LH, COLS), { ink: INK, rough: 0.8 });
    });
    s.surface(rect(platenX + 10, printY + 13, PLATEN - 20, 11, { radius: 2 }), { material: 'chrome', bevel: 3, zEdge: 10, zTop: 12, over: { rough: 0.26 } });
    for (let i = 0; i <= 36; i++) s.cut(rect(platenX + 20 + i * ADV, printY + 14, 1, i % 5 ? 3.5 : 6), { depth: 0.1, ink: [0.02, 0.02, 0.02] });
    // The bail holds the paper down, in the gap between two lines.
    s.surface(rect(platenX + 4, printY - 28, PLATEN - 8, 4, { radius: 2 }), { material: 'chrome', bevel: 2, zEdge: 11, zTop: 13, over: { rough: 0.2 } });
    for (const x of [paperX + 2, paperX + PAPER - 16]) s.surface(rect(x, printY - 33, 14, 14, { radius: 4 }), { material: 'rubber', bevel: 5, zEdge: 11, zTop: 14 });
    // The return lever, on the left end of the carriage.
    const lx = platenX - 20, ly = top - 2;
    s.surface(capsule(lx, ly, lx - 26, ly - 42, 5, 3.4), { material: 'chrome', zEdge: 8, zTop: 14, over: { rough: 0.16 } });
    s.surface(circle(lx - 26, ly - 44, 11), { material: 'lacquer-black', profile: 'dome', zEdge: 10, zTop: 15 });
  },
});

const REACH = 118, FOOT = 54, BEHIND = 34;
const barAt = (BARS: number, ox: number, oy: number, i: number, r: number): [number, number] => {
  const a = Math.PI + ((i - (BARS - 1) / 2) / ((BARS - 1) / 2)) * 1.16;
  return [ox + Math.sin(a) * r, oy - Math.cos(a) * r];
};

// The basket of type bars. `bar` says which one is flying up to the paper.
definePart({
  selector: '[d-typewriter~="typebars"]',
  springs: { hit: spring({ mass: 10, return: 1.3, friction: 0.061, material: 'steel-on-steel', sound: 'strike' }) },
  live: ['bar', 'strike'],
  update(p) {
    p.springs.hit!.set(p.el.hasAttribute('strike') ? 1 : 0);
  },
  paint(s, p) {
    const BARS = num(p, 'bars', 41), ox = p.x + p.w / 2, oy = p.y - BEHIND, hit = p.springs.hit!.value, which = +(p.el.getAttribute('bar') ?? 0);
    s.surface(path('M0 0 H100 V8 A50 92 0 0 1 0 8 Z', p.x, p.y, p.w, p.h, { spread: 4 }), { material: 'well', bevel: 3, zEdge: 0, zTop: -2.6 });
    for (let i = 0; i < BARS; i++) {
      const [x0, y0] = barAt(BARS, ox, oy, i, REACH), [x1, y1] = barAt(BARS, ox, oy, i, FOOT);
      if (i === which && hit > 0.01) continue;
      s.surface(capsule(x0, y0, x1, y1, 1.9, 1.5), { material: 'brushed-steel', zEdge: -2.6, zTop: -0.8, over: { aniso: 0, rough: 0.3 } });
    }
    if (hit <= 0.01) return;
    const [x0, y0] = barAt(BARS, ox, oy, which, REACH), [x1, y1] = barAt(BARS, ox, oy, which, FOOT);
    const x = x1 + (ox - x1) * hit, y = y1 + (oy + 4 - y1) * hit;
    s.surface(capsule(x0, y0, x, y, 2.2, 3), { material: 'chrome', zEdge: -1, zTop: 15 });
  },
});

const CLAPPER = { mass: 15, return: 0.49, friction: 0, sound: 'bell' };

// A small bell with a hammer. `ring` swings it, and `lit` is there for when motion is off.
definePart({
  selector: '[d-typewriter~="bell"]',
  springs: { swing: spring(CLAPPER) },
  live: ['ring', 'lit'],
  update(p) {
    if (p.el.getAttribute('ring') !== p.data.ring) {
      // Nothing was hit when the page set it up.
      if (p.data.ring !== undefined) contact(p, 'press', 10, { motion: mechanism(CLAPPER) });
      p.data.ring = p.el.getAttribute('ring');
      p.springs.swing!.velocity = 34;
    }
  },
  paint(s, p) {
    const R = p.h / 2, cx = p.x + R, cy = p.y + R, a = p.springs.swing!.value;
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: R }), { material: 'well', bevel: 1.5, zEdge: 0, zTop: -0.5 });
    s.surface(circle(cx, cy, R * 0.88), { material: 'brass', profile: 'dome', zEdge: -0.4, zTop: 5, over: { rough: 0.2, wear: 0 } });
    s.surface(circle(cx, cy, R * 0.16), { material: 'chrome', profile: 'dome', zEdge: 5, zTop: 6 });
    const hit = p.x + p.w - 7 - (R * 0.72 + Math.abs(a) * R * 0.5);
    s.surface(capsule(p.x + p.w - 8, cy, hit, cy, 1.8, 1.8), { material: 'chrome', zEdge: -0.4, zTop: 2 });
    s.surface(circle(hit, cy, 4.4), { material: 'brushed-steel', profile: 'dome', zEdge: -0.2, zTop: 3.4 });
    if (p.el.hasAttribute('lit')) s.glow(circle(cx, cy, R * 0.9), [5, 3.2, 1], 1.4);
  },
});

const OUTLINE = 'M92 8 H368 Q392 8 398 32 L456 544 Q462 612 412 614 H48 Q-2 612 4 544 L62 32 Q68 8 92 8 Z';

const BONE = 'M52 4 C92 4 122 26 170 30 Q220 33 270 30 C318 26 348 4 388 4 C420 4 438 28 438 52 C438 76 420 100 388 100 C348 100 318 78 270 74 Q220 71 170 74 C122 78 92 100 52 100 C20 100 2 76 2 52 C2 28 20 4 52 4 Z';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lifted = (p: Part) => (p.el.hasAttribute('lifted') ? 1 : 0);

// The moulded case, dished around the dial, with the cradle and its two hook plungers.
// `dial` and `cord` are where those sit, mm from the case's corner.
definePart({
  selector: '[d-telephone=""]',
  springs: { hook: spring({ mass: 40, return: 0.099, friction: 0.096, contact: 'press', sound: 'hook' }) },
  live: ['lifted'],
  update(p) {
    p.springs.hook!.set(lifted(p));
  },
  paint(s, p) {
    const ox = p.x, oy = p.y, [dx, dy] = nums(p, 'dial', [57.5, 81.5]).map(v => v * MM) as [number, number], [ax, ay] = nums(p, 'cord', [3.75, 119]).map(v => v * MM) as [number, number], cx = ox + dx, cy = oy + dy;
    const up = p.springs.hook!.value, body = { material: 'bakelite', over: { wear: 0, rough: 0.2 } };
    s.surface(path(OUTLINE, ox, oy, p.w, p.h, { viewBox: [0, 0, 460, 620], spread: 34 }), {
      ...body, zEdge: 0, zTop: 9, bevel: 30, profile: 'round',
    });
    s.surface(circle(cx, cy, 172), { ...body, zEdge: 9, zTop: 3.1, bevel: 22, profile: 'round' });
    s.surface(rect(ox + 112, oy + 522, 236, 60, { radius: 12 }), { ...body, zEdge: 9, zTop: 3.1, bevel: 14, profile: 'round' });

    s.surface(rect(ox + 92, oy + 34, 276, 90, { radius: 34 }), { ...body, zEdge: 9, zTop: 11.5, bevel: 20, profile: 'round' });
    for (const side of [-1, 1]) {
      const x = ox + 230 + side * 96;
      s.surface(rect(x - 22, oy + 18, 44, 112, { radius: 15 }), { ...body, zEdge: 11.5, zTop: 15, bevel: 11, profile: 'round' });
      s.surface(rect(x - 24, oy + 57, 48, 30, { radius: 8 }), { ...body, zEdge: 15, zTop: 11.5, bevel: 8, profile: 'round' });
      s.surface(circle(x, oy + 72, 9), { material: 'chrome', profile: 'dome', zEdge: 11.5, zTop: 12 + up * 2.2 });
    }
    s.surface(circle(ox + ax, oy + ay, 10), { material: 'rubber', profile: 'dome', zEdge: 2, zTop: 5 });
  },
});

// The handset and its coiled cord. Drawn from circles and rotated bars, so swinging it costs no fields.
// It covers the whole desk. `cradle`, `rest` and `cord` are the points it hangs on, lies at and runs back to, mm from the part's corner.
definePart({
  selector: '[d-telephone~="handset"]',
  springs: { lift: spring({ mass: 400, return: 0.043, friction: 0.57 }) },
  live: ['lifted'],
  update(p) {
    p.springs.lift!.set(lifted(p));
  },
  paint(s, p) {
    const [cradleX, cradleY] = nums(p, 'cradle', [122.5, 24]).map(v => v * MM) as [number, number], [restX, restY] = nums(p, 'rest', [31, 67.5]).map(v => v * MM) as [number, number], [ax, ay] = nums(p, 'cord', [68.75, 125]).map(v => v * MM) as [number, number];
    const u = p.springs.lift!.value, clamped = Math.max(0, Math.min(1, u));
    const a = lerp(0, -Math.PI / 2, u), ca = Math.cos(a), sa = Math.sin(a);
    const hx = p.x + lerp(cradleX, restX, u), hy = p.y + lerp(cradleY, restY, u);
    const at = (d: number) => [hx + ca * d, hy + sa * d] as const;
    const [mx, my] = at(-HALF), [ex, ey] = at(HALF);
    const zRest = lerp(12, 2, clamped) + Math.sin(clamped * Math.PI) * 9;

    // The cord leaves the mouthpiece end and comes back to the case in a long sag.
    const c1x = p.x + lerp(150, 206, clamped), c1y = p.y + lerp(340, 510, clamped);
    const bx = p.x + ax, by = p.y + ay, N = 66;
    for (let i = 0; i <= N; i++) {
      const t = i / N, q = 1 - t;
      const x = q * q * mx + 2 * q * t * c1x + t * t * bx, y = q * q * my + 2 * q * t * c1y + t * t * by;
      const tx = 2 * q * (c1x - mx) + 2 * t * (bx - c1x), ty = 2 * q * (c1y - my) + 2 * t * (by - c1y);
      const base = t < 0.22 ? lerp(zRest, 0, t / 0.22) : 0;
      s.surface(rect(x - 6.5, y - 1.7, 13, 3.4, { radius: 1.7, rotate: Math.atan2(ty, tx) + Math.PI / 2 + 0.34 }), {
        material: 'bakelite', zEdge: base, zTop: base + 1.5, bevel: 1.6, profile: 'round', over: { rough: 0.3, wear: 0 },
      });
    }

    const body = { material: 'bakelite', zEdge: zRest, over: { wear: 0, rough: 0.18 } };
    s.surface(path(BONE, hx - 220, hy - 52, 440, 104, { viewBox: [0, 0, 440, 104], rotate: a, spread: 32 }), {
      ...body, zTop: zRest + 6, bevel: 30, profile: 'round',
    });
    if (p.focused) {
      s.glow(circle(mx, my, 52), [1, 0.72, 0.2], 6);
      s.glow(circle(ex, ey, 52), [1, 0.72, 0.2], 6);
    }
  },
});

// A typewriter key: a paper disc under glass, in a metal ring, on a long throw.
definePart(key('[d-key~="type"]', {
  feel: { mass: 11, material: 'steel-on-steel' },
  cap: 'lacquer-black',
  own: true,
  draw(s, p, d, k) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    const up = 9 - 5.5 * k.down, name = k.cap;
    s.well(circle(cx + 1, cy + 2, R * 0.5), 0.6, { bevel: 3 });
    s.surface(circle(cx, cy, R), { material: 'chrome', bevel: R * 0.2, zEdge: up - 1.6, zTop: up, over: { rough: 0.16 } });
    s.surface(circle(cx, cy, R * 0.8), {
      material: name, bevel: 1.5, zEdge: up, zTop: up - 0.5,
      over: { touch: d.age * 0.5 },
    });
    legend(s, p, name, { depth: 0, wear: d.wear * 0.3 });
    s.glass(circle(cx, cy, R * 0.8), { height: 0.5, bevel: R * 0.5 });
    k.focus(circle(cx, cy, R + 1.5));
  },
}));

// A telegraph key, lever and all in the open. All mm, with the trunnion's axis as the origin: x along the lever, away from the knob, and y across it. Measured off a straight-on photo, heights off three-quarter ones.
const AXLE = 12, PLATE = 2.4, LEVER_TOP = 14.5, ARM = 3.2;
const CONTACT = -26, SPRING = -16.5, STOP = 24, GAP = 1; // the contact's stud and the spring's nut ahead of the axis, the back stop's behind it, and what the contact travels
/** Where a point in the mechanism lands, css px. */
type At = (x: number, y: number) => [number, number];
const hex = (x: number, y: number, r: number, turned = 0) => poly(Array.from({ length: 6 }, (_, i): Point => [x + r * Math.cos(turned + (i * Math.PI) / 3), y + r * Math.sin(turned + (i * Math.PI) / 3), r * 0.1]), { spread: 4 });

/** A knurled nut on an upright stud, from above, and `high` mm of it over `z`. */
function nut(s: Sheet, x: number, y: number, d: number, z: number, high: number, material: string): void {
  const r = d / 2;
  s.surface(circle(x, y, r * MM, { ripple: [Math.round(d * 6), 0.6] }), { material, zEdge: z, zTop: z + high, bevel: 1.5 });
  s.surface(circle(x, y, (r - 0.7) * MM), { material, zEdge: z + high, zTop: z + high + 0.15, bevel: 1, radial: true });
}

/** A step of turned brass on the axis, its ridges running round it, from `from` to `to` out along it. */
function step(s: Sheet, x: number, y: number, d: number, from: number, to: number, o: SurfaceOptions, knurl = false): void {
  const r = (d / 2) * MM, a = y + Math.min(from, to) * MM, h = Math.abs(to - from) * MM, top = AXLE - d / 2 + 0.01;
  upright(s, x, r, a, h, { bevel: 1, ...o }, top, knurl ? () => {
    for (let i = -6; i <= 6; i++) s.cut(rect(x + r * Math.sin((i * Math.PI) / 14) - 0.5, a, 1, h), { depth: 0.2, soft: 0.5 });
  } : undefined);
}

// What the lever stands in: a brass plate with the middle out of it, screwed down, two posts, the leaf that carries the fixed contact, and the trunnion screws either side with their lock nuts.
// The box is the plate. `material` is its brass.
definePart({
  selector: '[d-telegraph~="frame"]',
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'brass', ox = p.x + p.w / 2 + num(p, 'axis', 6) * MM, oy = p.y + p.h / 2;
    const at: At = (x, y) => [ox + x * MM, oy + y * MM];
    const P = (x: number, y: number, r = 0): Point => [...at(x, y), r * MM] as Point;
    const hole = poly([P(-18, 0, 5), P(-14, -6, 5), P(-2, -9, 6), P(6, -7, 5), P(9, 0, 5), P(6, 7, 5), P(-2, 9, 6), P(-14, 6, 5)], { spread: 8 });
    s.surface(minus(rect(p.x, p.y, p.w, p.h, { radius: p.h / 2 - 1 }), hole), { material, rise: PLATE, bevel: 3, profile: 'round' });
    for (const side of [-1, 1]) {
      const [x, y] = at(-9, side * 15.2);
      s.surface(circle(x, y, 2.5 * MM), { material, zEdge: PLATE, zTop: PLATE + 0.8, bevel: 3, radial: true });
      s.cut(rect(x - 2.3 * MM, y - 0.35 * MM, 4.6 * MM, 0.7 * MM, { rotate: side * 0.4 }), { depth: 0.5, soft: 0.5, ink: [0.03, 0.03, 0.03] });
    }
    // The leaf runs round the inside of the plate from its post to a fan, and the contact's stud goes through that.
    s.surface(poly([P(16, -14, 2), P(14, -8.5, 2), P(-2, -8, 14), P(-14, -6.5, 8), P(-16.5, -1, 3), P(-19, 3, 3), P(-15, 7.5, 2), P(-21, 15, 2), P(-31, 13, 6), P(-33, 0, 8), P(-28, -8, 10), P(-14, -13.5, 14), P(2, -14, 10)], { spread: 10 }), { material: 'satin-steel', zEdge: PLATE - 0.2, zTop: PLATE + 0.6, bevel: 1.5 });
    const [cx, cy] = at(CONTACT, 0);
    s.surface(hex(cx, cy, 3.9 * MM), { material, zEdge: PLATE + 0.6, zTop: PLATE + 3, bevel: 1.5 });
    s.surface(circle(cx, cy, 1.5 * MM), { material, zEdge: PLATE + 3, zTop: 7.4, bevel: 1.5 });
    s.surface(circle(cx, cy, 0.9 * MM), { material: 'polished-steel', profile: 'dome', zEdge: 7.4, zTop: 7.9 });
    for (const side of [-1, 1]) {
      const [x, y] = at(13.6, side * 11.2);
      s.surface(circle(x, y, 3.6 * MM), { material, zEdge: PLATE, zTop: 14, bevel: 2 });
      // The trunnion: a block on the plate, the screw through it to a point on the lever's pin, a lock nut, and a thumb nut on the end.
      const [tx, ty] = at(0, 0), r = (a: number, b: number) => [side > 0 ? a : -b, side > 0 ? b : -a] as const;
      const on = (d: number, a: number, b: number, knurl = false) => {
        const [f, t] = r(a, b);
        step(s, tx, ty, d, f, t, { material }, knurl);
      };
      on(2.6, 11.3, 26);
      on(8.8, 13.6, 20);
      on(9.4, 20.3, 22.6, true);
      on(7.6, 24.6, 26.8, true);
    }
  },
});

// A flat black knob on an open lever, which rocks on the trunnion's points and comes back on its spring. Press it and the lever's contact comes down on the stud. The box is the knob, and the lever runs off it to the right.
// `reach` is how far the axis is from the knob's middle, mm, and `arm` what the lever's made of.
definePart(key('[d-telegraph~="lever"]', {
  feel: { mass: 14, material: 'brass-on-steel', contact: 'press', return: 0.5 },
  cap: 'gloss-black',
  own: true,
  label: false,
  draw(s, p, _, k) {
    const metal = p.el.getAttribute('arm') || 'brass', cy = p.y + p.h / 2, kx = p.x + p.w / 2, kr = p.w / 2, L = num(p, 'reach', 68);
    const ax = kx + L * MM, down = Math.max(Math.min(k.down, 1.1), 0);
    const X = (x: number) => ax + x * MM, half = (ARM / 2) * MM, o = { material: metal };
    // The spring under its nut, gone shorter as the lever comes down. Only ever seen from the side.
    const sx = X(SPRING), squeezed = 1 - down * 0.15;
    for (let i = 0; i < 4; i++) s.surface(ring(circle(sx, cy, 2.4 * MM), 0.5 * MM), { material: 'polished-steel', zEdge: PLATE + i * 2.1 * squeezed, zTop: PLATE + 0.8 + i * 2.1 * squeezed, bevel: 0.6 });
    // A rigid lever turning through this little only changes height, so each side is rolled off the axis, the knob's way down and the stop's way up.
    const tilt = (GAP / -CONTACT) * down, knobDrop = tilt * (L + kr / MM);
    if (down > 0.002) s.bend({ from: [ax, cy], to: [kx - kr - 2, cy], rigid: true, drop: knobDrop * 2 });
    s.surface(rect(kx, cy - half, (L - 28) * MM, half * 2), { ...o, zEdge: 8.5, zTop: 11, bevel: 1.5 });
    s.surface(rect(X(-34), cy - half, 33 * MM, half * 2), { ...o, zEdge: 11, zTop: LEVER_TOP, bevel: 5, profile: 'round' });
    s.surface(circle(X(SPRING), cy, 3.2 * MM), { ...o, zEdge: 11, zTop: LEVER_TOP, bevel: 2 });
    nut(s, X(SPRING), cy, 10.4, LEVER_TOP, 3, metal);
    nut(s, X(SPRING), cy, 7.6, LEVER_TOP + 3.2, 3, metal);
    s.surface(circle(kx, cy, kr), { material: k.cap, zEdge: 10, zTop: 14.5, bevel: 10, profile: 'round', crown: 0.5 });
    if (down > 0.002) s.bend({ from: [ax, cy], to: [X(STOP + 7), cy], rigid: true, drop: -tilt * (STOP + 7) * 1.5 });
    s.surface(rect(X(1), cy - half, (STOP - 1) * MM, half * 2), { ...o, zEdge: 11, zTop: LEVER_TOP, bevel: 1.5 });
    s.surface(circle(X(STOP), cy, 3.2 * MM), { ...o, zEdge: 11, zTop: LEVER_TOP, bevel: 2 });
    nut(s, X(STOP), cy, 10.8, LEVER_TOP, 3, metal);
    nut(s, X(STOP), cy, 8, LEVER_TOP + 3.2, 3, metal);
    s.bend();
    // The cross stays level, being on the axis: its block, and the pins the screws' points go into.
    const P = (x: number, y: number, r = 0): Point => [X(x), cy + y * MM, r * MM];
    s.surface(poly([P(-8, -1.6, 1), P(-3, -1.6, 2.4), P(-1.6, -2.5, 0.8), P(-1.6, -8.3, 0.3), P(1.6, -8.3, 0.3), P(1.6, -2.5, 0.8), P(3, -1.6, 2.4), P(8, -1.6, 1), P(8, 1.6, 1), P(3, 1.6, 2.4), P(1.6, 2.5, 0.8), P(1.6, 8.3, 0.3), P(-1.6, 8.3, 0.3), P(-1.6, 2.5, 0.8), P(-3, 1.6, 2.4), P(-8, 1.6, 1)], { spread: 6 }), { ...o, zEdge: 11, zTop: LEVER_TOP, bevel: 2 });
    s.surface(rect(X(-0.85), cy - 11.3 * MM, 1.7 * MM, 22.6 * MM), { ...o, zEdge: 11, zTop: 13.6, bevel: 1.5 });
    k.focus(circle(kx, cy, kr + 2));
  },
}));

/** The closer's strip from its pin, mm: where it runs, and how wide either side of that. */
const CLOSER: [number, number][] = [[0, 0], [-5, 3.5], [-14, 5.5], [-24, 9], [-34, 14], [-44, 21.5], [-54, 31]];
const closerEdge = () => {
  const left: [number, number][] = [], right: [number, number][] = [];
  CLOSER.forEach(([x, y], i) => {
    const [ax, ay] = CLOSER[Math.max(i - 1, 0)]!, [bx, by] = CLOSER[Math.min(i + 1, CLOSER.length - 1)]!, l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / l, ny = (bx - ax) / l;
    const w = i === 0 ? 3.2 : 2.5 - (i / CLOSER.length) * 0.7;
    left.push([x + nx * w, y + ny * w]);
    right.unshift([x - nx * w, y - ny * w]);
  });
  return [...left, ...right];
};
/** How far the pin is from the top right of the closer's box, which runs from the ball to just past the pin: mm. */
const PIN_IN = 5, BALL = 4.7;
const closerPin = (p: Part): [number, number] => [p.w - PIN_IN * MM, PIN_IN * MM];

const short = hinge({
  at: closerPin,
  stops: { at: p => [0, num(p, 'throw', 11)] }, mass: 6, material: 'brass-on-steel', friction: 0.5, travel: 8,
});

// The circuit closer: a curved strip of brass on a pin, with a ball on its end, thrown across to short the contacts and hold the line closed. Open is at the ball's furthest from the lever.
// The box runs from the ball at its bottom left to just past the pin at its top right, and the strip and ball are what take the hand. `material` is the strip.
definePart({
  selector: '[d-telegraph~="short"]',
  ...short,
  update(p) {
    short.update?.(p);
    const [px, py] = closerPin(p), [bx, by] = CLOSER.at(-1)!, b = (BALL + 0.5) * MM, edge = closerEdge().map(([x, y]) => `${px + x * MM} ${py + y * MM}`);
    // Round the strip, then a square round the ball, which the strip's end runs into.
    p.el.querySelector('button')!.style.clipPath = `path('M${edge.join('L')}Z M${px + bx * MM - b} ${py + by * MM - b}v${b * 2}h${b * 2}v${-b * 2}Z')`;
  },
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'brass', ball = p.el.getAttribute('ball') || 'gloss-black', [bx, by] = CLOSER.at(-1)!;
    s.group(short.place(p), () => {
      const edge = closerEdge(), last = edge.length / 2 - 1;
      s.surface(poly(edge.map(([x, y], i): Point => [x * MM, y * MM, (i === 0 || i === edge.length - 1 || i === last || i === last + 1 ? 1 : 14) * MM]), { spread: 8 }), { material, zEdge: PLATE, zTop: 5, bevel: 2, profile: 'round' });
      s.surface(hex(0, 0, 3.2 * MM, 0.3), { material, zEdge: 5, zTop: 7, bevel: 1.5 });
      s.surface(circle(bx * MM, by * MM, BALL * MM), { material: ball, profile: 'dome', zEdge: 3, zTop: 12 });
    });
    if (p.focused) s.glow(circle(p.x + PIN_IN * MM, p.y + p.h - PIN_IN * MM, BALL * MM + 2), FOCUS);
  },
});

const RAD = Math.PI / 180;
const WHEEL_CHARS = '\u00a3$0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const EMBOSSER = 'd-device';
const charsOf = (p: Part) => p.el.getAttribute('chars') ?? WHEEL_CHARS;
/** The character at the wheel's index. Its input counts the clicks clockwise, and the characters run clockwise, so turning on brings the one before. */
const chosen = (p: Part) => {
  const all = charsOf(p), input = p.el.querySelector('input')!, n = all.length;
  return all[(n - (Math.round(+input.value) % n)) % n]!;
};
const ringFont = (size: number) => `600 ${size}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
/** The characters round a wheel, from inside its turn. `show` picks which to draw. */
const charRing = (s: Sheet, all: string, index: number, r: number, size: number, ink: [number, number, number], show: (a: number) => boolean = () => true) => {
  [...all].forEach((ch, i) => {
    const a = index + (i / all.length) * Math.PI * 2, x = Math.sin(a) * r, y = -Math.cos(a) * r, w = size * 1.6;
    if (!show(a)) return;
    if (ch === ' ') s.cut(circle(x, y, size * 0.09), { ink });
    else s.cut(text(ch, x - w / 2, y - w / 2, w, w, { font: ringFont(size), rotate: a }), { ink });
  });
};

const wheelTurn = turn({ mass: 16, material: 'plastic-on-plastic', input: true, wrap: true, hubless: true, detents: { strength: 0.7 }, stops: { at: [0, 360] }, travel: 400 });

// The wheel of an embosser: a ribbed disc with its characters round a printed face, clicking from each to the next and round past the end. The input runs from 0 to as many characters as there are, whose ends are the same place.
// `chars` runs clockwise, a space being the blank that spaces words and shown as a dot. `index` is where the chosen one sits, degrees clockwise from the top. `material` is the disc and `face` what's printed on, `face-size` how wide it is and `ring` how far out its characters sit, `legend` how tall they are, all mm. `height` is mm.
definePart({
  selector: '[d-embosser~="wheel"]',
  ...wheelTurn,
  spreads: true,
  connect(p) {
    p.el.querySelector('input')!.max = String(charsOf(p).length);
    return wheelTurn.connect(p);
  },
  update(p) {
    wheelTurn.update(p);
    const c = chosen(p);
    p.el.querySelector('input')!.setAttribute('aria-valuetext', c === ' ' ? 'space' : c);
  },
  paint(s, p, d) {
    const R = Math.min(p.w, p.h) / 2, cx = p.x + p.w / 2, cy = p.y + p.h / 2, all = charsOf(p), rise = num(p, 'height', 3), face = p.el.getAttribute('face') || 'paint-silver';
    const faceR = (num(p, 'face-size', 60) / 2) * MM, ring = num(p, 'ring', 26.5) * MM, size = num(p, 'legend', 4.4) * MM, ink = linear(p.el.getAttribute('ink') || '#111114');
    s.group(wheelTurn.place(p), () => {
      s.surface(circle(0, 0, R, { scoop: [num(p, 'ribs', all.length), num(p, 'rib', 1) * MM] }), { material: p.el.getAttribute('material') || 'plastic-black-stippled', bevel: 2.5 * MM, zEdge: 0, zTop: rise, over: { wear: d.wear * 0.4 } });
      s.surface(circle(0, 0, faceR), { material: face, profile: 'flat', bevel: 1, zEdge: rise - 0.3, zTop: rise - 0.2, over: { wear: 0 } });
      charRing(s, all, num(p, 'index', 278) * RAD, ring, size, ink);
    });
    if (p.focused) s.glow(circle(cx, cy, R + 1.5), FOCUS);
  },
});

// The same wheel's edge where it comes up through a slot in the top of the case, seen from above, so it fills the slot as a shallow arch and goes round with the wheel. `of` picks the wheel in its device. It draws its slot too.
// `material` and `face` are the disc and the printed face, `height` how far it stands, mm.
definePart({
  selector: '[d-embosser~="rim"]',
  paint(s, p) {
    const lead = p.el.getAttribute('of'), el = lead ? p.el.closest(EMBOSSER)?.querySelector(lead) : null, wheel = el ? partOf(el) : null;
    const angle = wheel ? (wheel.springs.turn?.value ?? 0) : 0, all = wheel ? charsOf(wheel) : WHEEL_CHARS, top = num(p, 'height', 1.5), cx = p.x + p.w / 2, sag = Math.max(p.h, 1), R = (p.w * p.w) / 4 / (2 * sag) + sag / 2, cy = p.y + R;
    s.well(rect(p.x - MM, p.y + p.h - 3.2 * MM, p.w + 2 * MM, 3.6 * MM, { radius: MM }), 2.5);
    // The part of the disc above the chord, which stays put while the disc goes round inside it.
    const clip = (r: number) => {
      const c = Math.cos(-angle), n = Math.sin(-angle), at = (x: number, y: number): Point => [x * c - y * n, x * n + y * c, 0];
      return intersect(circle(0, 0, r, r === R ? { scoop: [num(p, 'ribs', all.length), MM] } : {}), poly([at(-p.w, -R), at(p.w, -R), at(p.w, p.h - R), at(-p.w, p.h - R)]));
    };
    s.group({ at: [cx, cy], rotate: angle }, () => {
      s.surface(clip(R), { material: p.el.getAttribute('material') || 'plastic-black-stippled', bevel: 1.8 * MM, zEdge: -1, zTop: top });
      const faceR = R * 0.78;
      s.surface(clip(faceR), { material: p.el.getAttribute('face') || 'paint-silver', profile: 'flat', bevel: 1, zEdge: top - 0.1, zTop: top });
      const size = 3 * MM, reach = Math.acos(Math.min((R - p.h + size * 0.7) / (faceR - size * 0.6), 1));
      charRing(s, all, 0, faceR - size * 0.6, size, linear('#111114'), a => Math.abs(Math.atan2(Math.sin(a + angle), Math.cos(a + angle))) < reach);
    });
  },
});

const STRUCK = 0.8, BACK = 0.25;
/** A press reaching the end of its stroke says so with `name`, and again with `name`-back on the way home. */
const stroke = (p: Part, value: number, name: string) => {
  if (value > STRUCK && !p.data.struck) {
    p.data.struck = true;
    p.el.dispatchEvent(new CustomEvent(name, { bubbles: true }));
  } else if (value < BACK && p.data.struck) {
    p.data.struck = false;
    p.el.dispatchEvent(new CustomEvent(`${name}-back`, { bubbles: true }));
  }
};

const handle = press({ mass: 30, material: 'plastic-on-plastic', return: 3, contact: 'press', sound: 'hook' });
const STAMP = mechanism({ mass: 12, material: 'steel-on-steel', sound: 'strike' });

// The squeeze handle of an embosser, swinging on a pin at its far end towards the grip: all the way in and it strikes, which fires a bubbling `squeeze`, and on the way home it's `squeeze-back`, which feeds the tape. Short of that nothing happens, as with the real thing.
// Its box is where you get hold of it. `path` is its outline, in mm from that box's corner, and it can run far outside it, with `extent` the x y w h it fills, and `nose` is a narrower piece of it with a tighter edge. `pin` is where it turns and `swing` how many degrees it goes, `material` what it's made of, `height` mm, `crown` how much it swells, mm.
definePart({
  selector: '[d-embosser~="lever"]',
  ...handle,
  tick(p) {
    const was = p.data.struck;
    stroke(p, handle.value(p), 'squeeze');
    if (!was && p.data.struck) contact(p, 'press', 12, { motion: STAMP });
    return false;
  },
  paint(s, p) {
    const [px = 0, py = 0] = nums(p, 'pin', []).map(n => n * MM), [ex = 0, ey = 0, ew = p.w / MM, eh = p.h / MM] = nums(p, 'extent', []), d = p.el.getAttribute('path') ?? '';
    const name = p.el.getAttribute('material') || 'plastic-black-gloss', top = num(p, 'height', 8), bevel = num(p, 'bevel', 3) * MM;
    s.group({ at: [p.x + px, p.y + py], rotate: -num(p, 'swing', 3.5) * RAD * handle.value(p) }, () => {
      const outline = (o: string, spread: number) => path(o, ex * MM - px, ey * MM - py, ew * MM, eh * MM, { viewBox: [ex, ey, ew, eh], spread });
      const shape = outline(d, 30), nose = p.el.getAttribute('nose');
      if (nose) s.surface(outline(nose, 8), { material: name, bevel: bevel * 0.2, profile: 'round', zEdge: 0, zTop: top - 2 });
      s.surface(shape, { material: name, bevel, profile: 'round', zEdge: 0, zTop: top, crown: num(p, 'crown', 0.8) });
      if (p.focused) s.glow(shape, FOCUS);
    });
  },
});

const chop = press({ mass: 5, material: 'plastic-on-plastic', return: 1.2, contact: 'press', sound: 'guard' });

// The cutter of an embosser: a tab you push in, and a blade it drives across the tape at the end of its stroke, which fires a bubbling `cut`. The tab fills its box.
// `blade` is where the blade runs, x and then the y it starts and ends at, mm from the box's corner, `travel` how far the tab goes, mm, `material` the tab, `height` mm.
definePart({
  selector: '[d-embosser~="cutter"]',
  ...chop,
  tick(p) {
    stroke(p, chop.value(p), 'cut');
    return false;
  },
  paint(s, p) {
    const v = chop.value(p), [bx = 0, y0 = 0, y1 = 0] = nums(p, 'blade', []).map(n => n * MM), dy = v * num(p, 'travel', 2) * MM;
    // It comes up out of the far rail, so at rest there's nothing of it to see.
    if (v > 0.02) s.surface(rect(p.x + bx - 0.5 * MM, p.y + y1 + (y0 - y1) * v, MM, (y1 - y0) * v, { radius: 1 }), { material: 'polished-steel', rest: true, rise: 0.3, bevel: 0.5 });
    const shape = rect(p.x, p.y - dy, p.w, p.h, { radius: 1.2 * MM });
    s.surface(shape, { material: p.el.getAttribute('material') || 'plastic-black-gloss', profile: 'round', bevel: 0.8 * MM, zEdge: 0, zTop: num(p, 'height', 7) });
    if (p.focused) s.glow(shape, FOCUS);
  },
});

interface Piece {
  letters: string;
  /** Px from the piece's left end to its first letter's centre. */
  first: number;
  w: number;
  from: [number, number];
}
const MAX_PIECES = 3;

const tapeGlyph = (s: Sheet, ch: string, x: number, cy: number, size: number, pitch: number, i: number) => {
  if (ch === ' ') return;
  // Each letter lands a hair off true, and in a sans whose strokes the die keeps thin.
  const off = (((i * 7 + ch.charCodeAt(0) * 13) % 9) - 4) * 0.05;
  s.surface(text(ch, x - pitch / 2, cy - size * 0.7 + off, pitch, size * 1.4, { font: `400 ${size}px 'Helvetica Neue', Arial, sans-serif`, spread: 3 }), { ...PUNCHED, rest: true, rise: 0.25 });
};

// The tape of an embosser, in the run from where it's punched to the air outside: its box runs along the tape, as wide as the tape, ending on the right at the punch. It lies on whatever's under it and can hang past the device.
// It's what wires the embosser up: on a `squeeze` in its device it takes the character at the wheel's index, on the way back it feeds on, and on a `cut` it parts at the blade and the end falls away to the tray.
// `letters` is what's on it so far, `lead` the mm of blank before them, `pitch` the mm a letter takes, `cap` how tall a letter is, mm. `blade` is how far along its box the cutter is, `tray` where the first piece lands, x y mm from its corner, and `leading` the mm between pieces. `material` is the tape.
definePart({
  selector: '[d-embosser~="tape"]',
  springs: {
    feed: spring({ mass: 12, return: 1.6, friction: 0.5 }),
    drop: spring({ mass: 6, return: 0.8, friction: 0.45 }),
  },
  live: ['letters'],
  update(p) {
    const letters = p.el.getAttribute('letters') ?? '';
    if (p.data.fed === undefined) {
      p.data.fed = letters.length;
      p.data.end = -num(p, 'lead', 6) / num(p, 'pitch', 5);
      p.springs.feed!.snap(letters.length);
    }
    p.el.setAttribute('aria-label', `Tape reading ${letters.trim() || 'nothing yet'}`);
  },
  connect(p) {
    const device = p.el.closest(EMBOSSER);
    if (!device) return;
    const ac = new AbortController(), { signal } = ac;
    p.el.setAttribute('role', 'img');
    device.addEventListener('squeeze', () => {
      const wheel = device.querySelector('[d-embosser~="wheel"]'), part = wheel ? partOf(wheel) : null;
      if (part) p.el.setAttribute('letters', (p.el.getAttribute('letters') ?? '').slice(0, p.data.fed as number) + chosen(part));
    }, { signal });
    device.addEventListener('squeeze-back', () => {
      p.data.fed = (p.el.getAttribute('letters') ?? '').length;
      p.springs.feed!.set(p.data.fed as number);
    }, { signal });
    device.addEventListener('cut', () => {
      const pitch = num(p, 'pitch', 5) * MM, feed = p.springs.feed!.value, right = p.x + p.w, blade = p.x + num(p, 'blade', 20) * MM;
      const at = (i: number) => right - (feed - i) * pitch, end = at(p.data.end as number), letters = p.el.getAttribute('letters') ?? '';
      if (end >= blade - pitch) return;
      let k = 0;
      while (k < letters.length && at(k) < blade) k++;
      // It parts at the gap nearest the blade, since a letter is drawn whole or not at all.
      const gap = at(k) - pitch / 2;
      const pieces = ((p.data.pieces ?? []) as Piece[]).concat({ letters: letters.slice(0, k), first: at(0) - end, w: gap - end, from: [end - p.x, 0] });
      p.data.pieces = pieces.slice(-MAX_PIECES);
      p.data.fed = (p.data.fed as number) - k;
      p.data.end = feed - k - (right - gap) / pitch;
      p.springs.feed!.snap(feed - k);
      p.springs.feed!.set(p.data.fed as number);
      p.springs.drop!.snap(0);
      p.springs.drop!.set(1);
      p.el.setAttribute('letters', letters.slice(k));
    }, { signal });
    return () => ac.abort();
  },
  paint(s, p, d) {
    const pitch = num(p, 'pitch', 5) * MM, cap = num(p, 'cap', 6.4) * MM, tail = 12 * MM, name = p.el.getAttribute('material') || 'dymo-red', right = p.x + p.w, cy = p.y + p.h / 2;
    const feed = p.springs.feed!.value, letters = p.el.getAttribute('letters') ?? '', end = Math.max(right - (feed - ((p.data.end as number | undefined) ?? 0)) * pitch, p.x), over = { wear: d.wear * 0.3, rough: 0.34 };
    s.surface(rect(end, p.y, right + tail - end, p.h, { radius: 0.3 * MM }), { material: name, rest: true, rise: TAPE_THICK, bevel: 1, over });
    [...letters].forEach((ch, i) => {
      const x = right - (feed - i) * pitch;
      if (x - pitch / 2 >= end) tapeGlyph(s, ch, x, cy, cap, pitch, i);
    });
    const pieces = (p.data.pieces ?? []) as Piece[], [tx = 0, ty = 40] = nums(p, 'tray', []).map(n => n * MM), lead = num(p, 'leading', 16) * MM, drop = p.springs.drop!.value;
    pieces.forEach((c, i) => {
      const k = i === pieces.length - 1 ? Math.min(drop, 1) : 1, slot = pieces.length - 1 - i;
      const x = p.x + c.from[0] + (tx - c.from[0]) * k, y = p.y + (ty + slot * lead) * k;
      s.surface(rect(x, y, c.w, p.h, { radius: 0.3 * MM }), { material: name, rest: true, rise: TAPE_THICK, bevel: 1, over });
      [...c.letters].forEach((ch, n) => tapeGlyph(s, ch, x + c.first + n * pitch, y + p.h / 2, cap, pitch, n));
    });
  },
});
