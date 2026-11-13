// Things you turn.
import { capsule, carried, carries, carry, circle, definePart, defineStyles, FOCUS, getEngine, input, legendColor, limits, linear, mask, minus, MM, path, press, rect, text, together, turn, union, type Part, type PartDef, type Sheet, type TurnOptions, type Vec3 } from 'device-ui';
import { controlStyles, font, ground, keyStyles, lamp, num, polar, scale } from './shared.js';
import { words } from './key.js';
import { lampColours } from 'device-ui/materials';

defineStyles(`${controlStyles('[d-wheel~="ring"]', '[d-wheel~="ball"]', '[d-wheel~="roller"]', '[d-wheel~="dial"]') + keyStyles('[d-wheel~="ball"]', '[d-wheel~="roller"]')}
[d-wheel~="dial"], [d-wheel~="dial"] input { border-radius: 50%; }
[d-wheel~="dial"] [d-mark] { pointer-events: none; }
`);

const RAD = Math.PI / 180;

// Turns about the middle of its round body, which sits below the middle of the whole shape.
const CHICKEN_BOX: [number, number, number, number] = [-8, 0, 116, 116], CHICKEN_SIZE = 1.16;
const CHICKEN = 'M50 3 C57 3 60 16 64 30 C80 38 86 58 76 74 C66 92 34 92 24 74 C14 58 20 38 36 30 C40 16 43 3 50 3 Z';

// A wafer switch: a hard detent, so it snaps from one position to the next.
const wafer = turn({ mass: 15, input: true, detents: { strength: 0.9 }, travel: 150, stops: { at: p => [-num(p, 'sweep', 135), num(p, 'sweep', 135)] } });

// A pointer knob clicking between named positions. `labels` are printed around it. `leds` puts an LED at each position in place of
// its printed tick, and while it's `on` they all glow low and the one it points at burns, in `color`.
definePart({
  selector: '[d-knob~="pointer"]',
  ...wafer,
  live: ['style', 'turn', 'on'],
  mask(ctx, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    const el = input(p), [min, max] = limits(el), n = Math.round((max - min) / (+el.step || 1)) + 1;
    const sweep = num(p, 'sweep', 135) * Math.PI / 180;
    const labels = (p.el.getAttribute('labels') ?? '').split(',').map(t => t.trim());
    ctx.font = font(p, 11);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Type stays its size on a small one, so a label can stand past the box.
    let over = 0;
    for (let i = 0; i < n; i++) {
      const a = -sweep + (2 * sweep * i) / Math.max(n - 1, 1);
      const [x0, y0] = polar(cx, cy, R * 0.66, a), [x1, y1] = polar(cx, cy, R * 0.74, a);
      if (!p.el.hasAttribute('leds')) {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      const [tx, ty] = polar(cx, cy, R * 0.88, a);
      if (labels[i]) {
        ctx.fillText(labels[i]!, tx, ty);
        over = Math.max(over, Math.abs(tx - cx) + ctx.measureText(labels[i]!).width / 2 - p.w / 2);
      }
    }
    over = Math.ceil(Math.max(over, 0));
    return { x: p.x - over, y: p.y, w: p.w + over * 2, h: p.h };
  },
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2 * 0.62;
    const name = p.el.getAttribute('material') || 'bakelite';
    const a = p.springs.turn!.value;
    if (p.mask) s.cut(mask(p.mask), { depth: 0.1, ink: legendColor(ground(p, d)), wear: d.wear * 0.3 });
    if (p.el.hasAttribute('leds')) {
      const el = input(p), [min, max] = limits(el), n = Math.round((max - min) / (+el.step || 1)) + 1, sweep = num(p, 'sweep', 135) * RAD;
      const at = ((a + sweep) / (2 * sweep)) * (n - 1), c = lamp(p), lit = p.el.hasAttribute('on'), outer = Math.min(p.w, p.h) / 2, dot = Math.min(1.2 * MM, (outer * 0.7 * sweep * 2) / Math.max(n - 1, 1) * 0.3);
      for (let i = 0; i < n; i++) {
        const [x, y] = polar(cx, cy, outer * 0.7, -sweep + (2 * sweep * i) / Math.max(n - 1, 1)), on = lit ? 0.14 + 0.86 * Math.max(0, 1 - Math.abs(at - i) * 2) : 0;
        s.surface(circle(x, y, dot), { material: 'glass-red', profile: 'dome', zEdge: 0, zTop: 0.5, over: { color: scale(c, 0.006), emit: scale(c, 0.22 * on), rough: 0.3 } });
      }
    }
    s.well(circle(cx, cy, R * 0.74), 0.6, { bevel: 2 });
    const r = R * CHICKEN_SIZE;
    // The knob and its line go round with it, drawn pointing up about its middle.
    s.group(wafer.place(p), () => {
      s.surface(path(CHICKEN, -r, -r, r * 2, r * 2, { viewBox: CHICKEN_BOX, spread: 10 }), {
        material: name, bevel: R * 0.24, zEdge: 0, zTop: 10, over: { rough: 0.24, wear: d.wear * 0.4 },
      });
      s.cut(rect(-1.4, -R * 0.9, 2.8, R * 0.6, { radius: 1 }), { depth: 0.1, ink: [0.8, 0.78, 0.7] });
    });
    if (p.focused) s.glow(circle(cx, cy, R * 0.78), FOCUS);
  },
});

const RIBS = 26;
// How far out the ribs are, of the height of the slot. A rib stays under the pointer, as under a thumb.
const ROLL = 0.46;

// A ribbed wheel showing through a slot, turned with a thumb. Each rib ticks past. `ribs` is how many go round it, `turns` how far it goes,
// and `height` how far it stands out of the slot, mm. `crown` is the height in mm of a big wheel standing out of a long slot and narrowing to each end, as a keyboard's bend wheel does, and `notch` cuts its middle position in it.
definePart({
  selector: '[d-wheel~="thumb"]',
  ...turn({
    mass: 3, material: 'rubber-on-plastic', input: true, rolled: true, ticks: p => 360 / num(p, 'ribs', RIBS),
    stops: { at: p => [0, num(p, 'turns', 3) * 360] },
    travel: p => num(p, 'turns', 3) * Math.PI * 2 * p.h * ROLL,
  }),
  paint(s, p, d) {
    const name = p.el.getAttribute('material') || 'rubber';
    const R = p.h * 0.62, cy = p.y + p.h / 2, phase = p.springs.turn!.value, ribs = num(p, 'ribs', RIBS), crown = num(p, 'crown', 0);
    if (crown) {
      const cx = p.x + p.w / 2, hw = p.w / 2 - 2, end = hw * 0.6, reach = p.h / 2 - 2 - end, lens = union(capsule(cx, cy - reach, cx, cy, end, hw), capsule(cx, cy, cx, cy + reach, hw, end));
      const middle = phase - num(p, 'turns', 3) * Math.PI, span = p.h * 0.5;
      s.well(rect(p.x, p.y, p.w, p.h, { radius: 2 }), 2, { bevel: 1 });
      s.surface(lens, { material: name, bevel: hw * 0.7, profile: 'round', zEdge: -2, zTop: crown, over: { wear: d.wear * 0.3 } });
      for (let i = 0; i < ribs; i++) {
        const t = (((i / ribs) * Math.PI * 2 + middle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        if (Math.abs(t) > Math.PI * 0.42) continue;
        s.cut(rect(cx - hw, cy + Math.sin(t) * span - 0.9, hw * 2, 1.8), { depth: 0.5, soft: 0.8 });
      }
      if (p.el.hasAttribute('notch') && Math.abs(middle) < 1.2) s.cut(rect(cx - hw * 0.9, cy + Math.sin(middle) * span - 5, hw * 1.8, 10, { radius: 2 }), { depth: 1.2, soft: 1 });
      if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: 2 }), FOCUS);
      return;
    }
    s.well(rect(p.x, p.y, p.w, p.h, { radius: 4 }), 1.5, { bevel: 2 });
    s.surface(rect(p.x + 3, p.y + 2, p.w - 6, p.h - 4, { radius: 2 }), {
      material: name, bevel: p.h * 0.42, zEdge: -1.5, zTop: num(p, 'height', 3.2), over: { wear: d.wear * 0.3 },
    });
    for (let i = 0; i < ribs; i++) {
      const t = ((i / ribs) * Math.PI * 2 + phase) % (Math.PI * 2);
      if (t > Math.PI * 0.5 && t < Math.PI * 1.5) continue;
      const y = cy + Math.sin(t) * R * 0.74;
      s.cut(rect(p.x + 4, y - 0.7, p.w - 8, 1.4), { depth: 0.5, ink: [0.01, 0.01, 0.01] });
    }
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: 4 }), FOCUS);
  },
});

const jog = turn({
  mass: 150, material: 'ball-bearing', input: true, wrap: p => p.el.hasAttribute('wrap'),
  stops: { at: p => [0, num(p, 'turns', 1) * 360] },
  travel: p => num(p, 'turns', 1) * Math.PI * Math.min(p.w, p.h),
});
// A big free-spinning wheel with a finger dimple, turned in circles.
definePart({
  selector: '[d-knob~="jog"]',
  ...jog,
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2 - 2;
    const name = p.el.getAttribute('material') || 'brushed-aluminium';
    s.well(circle(cx, cy, R + 2), 1, { bevel: 2 });
    s.surface(circle(cx, cy, R, { ripple: [64, 0.8] }), {
      material: 'rubber', bevel: 3, zEdge: -1, zTop: 5, over: { wear: d.wear * 0.2 },
    });
    s.surface(circle(cx, cy, R * 0.86), {
      material: name, radial: true, profile: 'chamfer', bevel: R * 0.05, zEdge: 5, zTop: 5.6,
      over: { aniso: 0.8, grain: [0, 1, 1], wear: d.wear * 0.3 },
    });
    // The wheel is round, so only the dimple shows it going round.
    s.group(jog.place(p), () => s.surface(circle(0, -R * 0.62, R * 0.14), { material: 'black-oxide', bevel: R * 0.13, zEdge: 5.6, zTop: 3.6 }));
    if (p.focused) s.glow(circle(cx, cy, R + 3), FOCUS);
  },
});

const STOP = Math.PI * 0.58;
const HOLES = 10;
const holeAngle = (i: number) => STOP - (Math.PI * 1.52 * (i + 1)) / (HOLES + 0.2);
const digitAt = (i: number) => String((i + 1) % 10);
const HOLE_GAP = (Math.PI * 1.52) / (HOLES + 0.2);
// Let go this short of the stop and it counts. Going round with a mouse is harder than with a finger in a hole.
const SHORT = 0.25;
const hole = (p: Part) => (p.data.hole as number | undefined) ?? -1;
const fingerStop = (i: number) => STOP - holeAngle(i);
const dialled = (p: Part, i: number) => {
  const el = input(p);
  el.value += digitAt(i);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

// Pulled round by a finger in a hole, against a spring, and let run home at the pace of its governor.
const dial = turn({
  mass: 60, material: 'governor', return: 0.01, contact: 'press', hubless: true, ticks: (HOLE_GAP * 180) / Math.PI,
  // Kept past the ends, so the hole waits for the finger to come back to it.
  past: Infinity,
  track: {
    read: p => p.springs.turn!.value,
    write: (p, v) => p.springs.turn!.snap(v),
    reach: p => ({ min: 0, max: fingerStop(hole(p)), step: 0 }),
    scale: () => 1,
    radians: () => 1,
  },
  accepts(p, e) {
    const r = p.el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, spring = p.springs.turn!;
    const a = Math.atan2(e.clientX - x, y - e.clientY), out = Math.hypot(e.clientX - x, e.clientY - y) / (r.width / 2);
    let best = -1, gap = 0.3;
    // The holes are where the dial has got to, which is not home if it's still running back.
    // Out to the rim, because the numbers are printed there.
    if (out > 0.33 && out < 1) for (let i = 0; i < HOLES; i++) {
      let diff = Math.abs(a - holeAngle(i) - spring.value) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < gap) {
        gap = diff;
        best = i;
      }
    }
    p.data.hole = best;
    if (best >= 0) spring.snap(spring.value);
    return best >= 0;
  },
  letGo(p) {
    const i = hole(p), travel = fingerStop(i), spring = p.springs.turn!;
    if (spring.value > travel - Math.max(0.35, travel * SHORT)) dialled(p, i);
    spring.set(0);
  },
});

// A rotary telephone dial. The input collects the digits. Going home it pulses once a digit, as the line did.
definePart({
  selector: '[d-wheel~="rotary"]',
  ...dial,
  connect(p) {
    const ac = new AbortController(), off = dial.connect(p), spring = p.springs.turn!;
    p.el.addEventListener('keydown', e => {
      const n = '1234567890'.indexOf(e.key);
      if (n < 0) return;
      e.preventDefault();
      spring.snap(fingerStop(n));
      dialled(p, n);
      spring.set(0);
      getEngine().schedule();
    }, { signal: ac.signal });
    return () => {
      ac.abort();
      off();
    };
  },
  mask(ctx, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    ctx.font = font(p, R * 0.13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < HOLES; i++) {
      const [x, y] = polar(cx, cy, R * 0.92, holeAngle(i));
      ctx.fillText(digitAt(i), x, y);
    }
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    const name = p.el.getAttribute('material') || 'chrome';
    if (p.mask) s.cut(mask(p.mask), { depth: 0.1, ink: legendColor(ground(p, d)), wear: d.wear * 0.3 });
    s.surface(circle(cx, cy, R * 0.8), { material: 'lacquer-black', bevel: 2, zEdge: 0, zTop: 0.6 });
    s.surface(circle(cx, cy, R * 0.78), {
      material: name, bevel: R * 0.05, zEdge: 0.6, zTop: 3.4, over: { wear: d.wear * 0.5 },
    });
    // The finger wheel is round, so only its holes show it going round, drawn about its middle as at home.
    s.group(dial.place(p), () => {
      for (let i = 0; i < HOLES; i++) {
        const [x, y] = polar(0, 0, R * 0.6, holeAngle(i));
        s.surface(circle(x, y, R * 0.105), { material: 'lacquer-black', bevel: R * 0.05, zEdge: 3.4, zTop: 0.6 });
      }
    });
    s.surface(circle(cx, cy, R * 0.33), {
      material: 'paper', bevel: 2, zEdge: 3.4, zTop: 3.9,
    });
    s.glass(circle(cx, cy, R * 0.33), { height: 0.6, bevel: R * 0.2 });
    const [fx, fy] = polar(cx, cy, R * 0.76, STOP), [tx, ty] = polar(cx, cy, R * 0.6, STOP);
    s.surface(capsule(fx, fy, tx, ty, 3, 2.2), { material: 'chrome', zEdge: 3, zTop: 5 });
    if (p.focused) s.glow(circle(cx, cy, R * 0.8), FOCUS);
  },
});

// A ring with nothing of its own to see: the bezel or face of something round. `from` and `to` are its ends, in degrees.
definePart({
  selector: '[d-wheel~="ring"]',
  ...turn({ mass: 30, input: true, detents: true, stops: { at: p => [num(p, 'from', -135), num(p, 'to', 135)] } }),
  paint() {},
});

// A calculator disc: a flat disc with a toothed edge, turned by that edge, whose scales are the marks nested in it, which go round with it.
// `from` and `to` are its ends in degrees, its input's range between them. `height` is how far it stands in mm, `teeth` how many, `tooth` how deep in mm, and `rim` how much of the edge is left bare in mm.
const calculator = turn({ mass: 24, material: 'metal-on-grease', input: true, hubless: true, stops: { at: p => [num(p, 'from', -135), num(p, 'to', 135)] } });
definePart({
  selector: '[d-wheel~="dial"]',
  ...calculator,
  connect(p) {
    carries(p);
    return calculator.connect(p);
  },
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, material = p.el.getAttribute('material') || 'dial-black', rise = num(p, 'height', 3);
    const rim = num(p, 'rim', 1.2) * MM;
    s.group(calculator.place(p), () => {
      s.surface(circle(0, 0, R, { scoop: [num(p, 'teeth', 60), num(p, 'tooth', 0.5) * MM] }), { material: p.el.getAttribute('edge') || 'plastic-black', bevel: 0.5 * MM, zEdge: 0, zTop: rise, over: { wear: d.wear * 0.4 } });
      s.surface(circle(0, 0, R - rim), { material, profile: 'flat', zEdge: rise, zTop: rise + 0.05, over: { wear: 0 } });
      s.group({ at: [-cx, -cy] }, () => carry(s, p, d));
    });
    if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
  },
});

// A scale printed round a centre: `labels` is angle:text pairs, degrees clockwise from the top. Each label turns
// with its angle, with its feet to the middle, or its head with `inward`, unless it's `upright`. `marks` is more ticks with no words, a list of angles, `tick-width` mm wide, round if they're no longer than that. `ticks` marks that many even divisions, every `major`th one longer. `sweep` lays them over
// that many degrees each side of the top instead of the whole way round, ends included, `tick-radius` is how far out they end, mm, and `tick-length` how long they run, mm.
// `d-mark="scale straight"` runs along its box instead, down one taller than it's wide. `labels` is then position:text pairs in mm from its start, each with a tick of `tick-length`, and
// `marks` is more ticks with no words, a list of positions, or `ticks` that many even ones. `tick-at` is how far across the box they start and `text-at` the same for the words, both mm, and `legend` how big the words are, mm.
const straightScale = (s: Sheet, p: Part, ink: Vec3) => {
  const down = p.h > p.w, length = num(p, 'tick-length', 2) * MM, at = num(p, 'tick-at', 0) * MM, size = num(p, 'legend', 2.2) * MM, major = num(p, 'major', 5);
  const face = font(p, size, num(p, 'weight', 500)), thick = num(p, 'tick-width', 0.2) * MM, past = at + length + size * 0.35, out = num(p, 'text-at', past / MM) * MM;
  const tick = (pos: number, l = length) => s.cut(down ? rect(p.x + at, p.y + pos - thick / 2, l, thick) : rect(p.x + pos - thick / 2, p.y + at, thick, l), { ink });
  for (const pair of (p.el.getAttribute('labels') ?? '').split(',').filter(Boolean)) {
    const split = pair.indexOf(':'), pos = +pair.slice(0, split) * MM, label = pair.slice(split + 1);
    if (length) tick(pos);
    if (down) s.cut(text(label, p.x + out, p.y + pos - size, p.w - out, size * 2, { font: face, align: 'left' }), { ink });
    else s.cut(text(label, p.x + pos - size * (label.length + 1) / 2, p.y + out, size * (label.length + 1), size * 1.4, { font: face, align: 'center' }), { ink });
  }
  for (const m of (p.el.getAttribute('marks') ?? '').trim().split(/[\s,]+/).filter(Boolean)) tick(+m * MM);
  const ticks = num(p, 'ticks', 0), run = down ? p.h : p.w;
  for (let i = 0; i < ticks; i++) tick((i * run) / Math.max(ticks - 1, 1), i % major === 0 ? length : length * 0.6);
};

definePart({
  selector: '[d-mark~="scale"]',
  options: ['straight'],
  paint(s, p, d) {
    if (carried(p)) return;
    if (words(p).includes('straight')) {
      const color = p.el.getAttribute('color');
      return straightScale(s, p, color ? linear(color) : legendColor(ground(p, d)));
    }
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, rim = Math.min(p.w, p.h) / 2, R = p.el.hasAttribute('radius') ? num(p, 'radius', 0) * MM : rim - 8, size = num(p, 'size', 3) * MM;
    const color = p.el.getAttribute('color'), ink = color ? linear(color) : legendColor(ground(p, d));
    const upright = p.el.hasAttribute('upright'), inward = p.el.hasAttribute('inward'), ticks = num(p, 'ticks', 0), major = num(p, 'major', 5), style = font(p, size, num(p, 'weight', 500));
    for (const pair of (p.el.getAttribute('labels') ?? '').split(',').filter(Boolean)) {
      const [deg, label] = pair.split(':'), a = +deg! * RAD, [x, y] = polar(cx, cy, R, a), w = size * (label!.length + 1);
      s.cut(text(label!, x - w / 2, y - size, w, size * 2, { font: style, align: 'center', rotate: upright ? 0 : inward ? a + Math.PI : a }), { ink });
    }
    const sweep = num(p, 'sweep', 0) * RAD, end = num(p, 'tick-radius', rim / MM) * MM, length = num(p, 'tick-length', 0) * MM;
    // The short ticks can be a shape of their own, as a timer's square dots are: all in mm, and where they end if it isn't where the long ones do.
    const tickWidth = num(p, 'tick-width', 0) * MM, minorLength = num(p, 'minor-length', 0) * MM, minorWidth = num(p, 'minor-width', 0) * MM, minorEnd = num(p, 'minor-radius', end / MM) * MM;
    for (let i = 0; i < ticks; i++) {
      const long = i % major === 0, a = sweep ? -sweep + (2 * sweep * i) / Math.max(ticks - 1, 1) : (i / ticks) * Math.PI * 2;
      const l = long ? length || rim * 0.075 : minorLength || (length ? length * 0.6 : rim * 0.04), w = long ? tickWidth || (length ? 1.6 : rim * 0.016) : minorWidth || (length ? 1 : rim * 0.009);
      const [x, y] = polar(cx, cy, (long ? end : minorEnd) - l / 2, a);
      s.cut(rect(x - w / 2, y - l / 2, w, l, { rotate: a }), { ink });
    }
    const dotAt = num(p, 'dot-radius', rim / MM) * MM, dot = (num(p, 'dot-size', 1) * MM) / 2;
    for (const deg of (p.el.getAttribute('dots') ?? '').trim().split(/[\s,]+/).filter(Boolean)) {
      const [x, y] = polar(cx, cy, dotAt, +deg * RAD);
      s.cut(circle(x, y, dot), { ink });
    }
    const wide = num(p, 'tick-width', 0.2) * MM, long = length || wide;
    for (const m of (p.el.getAttribute('marks') ?? '').trim().split(/[\s,]+/).filter(Boolean)) {
      const [x, y] = polar(cx, cy, end - long / 2, +m * RAD);
      s.cut(rect(x - wide / 2, y - long / 2, wide, long, { rotate: +m * RAD, radius: long <= wide ? wide / 2 : 0 }), { ink });
    }
  },
});

const grip = turn({ mass: 10, material: 'metal-on-grease', input: true, hubless: true, stops: { at: p => [num(p, 'from', 0), num(p, 'to', 360)] } });

// A round knob with a knurled skirt and a smooth cap, turned by going round it. Its input runs from `from` to `to` degrees clockwise of straight up, which can be many turns, as a timer's is.
// `pitch` is the mm between teeth and `height` how far it stands, in mm. `cap` is how much of it the cap fills. `rings` cuts that many grooves round the cap.
// `legend` prints on the cap and turns with it, a slash starting a new line a step to the right, `size` mm tall and in `color`. `pointer` prints a white dot at the cap's edge.
definePart({
  selector: '[d-knob~="knurled"]',
  ...grip,
  paint(s, p, d) {
    const R = Math.min(p.w, p.h) / 2, name = p.el.getAttribute('material') || 'plastic-black', top = num(p, 'height', 10), shoulder = top * 0.86, over = { wear: d.wear * 0.3 };
    const teeth = Math.round((Math.PI * 2 * R) / (num(p, 'pitch', 1.3) * MM)), C = R * num(p, 'cap', 0.8), ink = linear(p.el.getAttribute('color') || '#e6e6dc');
    const rings = num(p, 'rings', 0), legend = p.el.getAttribute('legend'), size = num(p, 'size', 5) * MM;
    s.group(grip.place(p), () => {
      s.surface(circle(0, 0, R, { ripple: [teeth, 0.28 * MM] }), { material: name, bevel: 0.5 * MM, zEdge: 0, zTop: shoulder, over });
      s.surface(circle(0, 0, C), { material: name, profile: 'round', bevel: 0.8 * MM, zEdge: shoulder, zTop: top, over: { rough: 0.3, ...over } });
      for (let i = 0; i < rings; i++) {
        const r = (C * (rings - i)) / (rings + 1);
        s.cut(minus(circle(0, 0, r), circle(0, 0, r - 0.45 * MM)), { depth: 0.25 });
      }
      if (legend) {
        const lines = legend.split('/'), style = `italic 800 ${size}px ${getComputedStyle(p.el).fontFamily}`, w = C * 2;
        lines.forEach((line, i) => {
          const k = i - (lines.length - 1) / 2;
          s.cut(text(line, -w / 2 + k * size * 1.5, k * size * 0.62 - size, w, size * 2, { font: style, align: 'center' }), { depth: 0.04, ink });
        });
      }
      if (p.el.hasAttribute('pointer')) s.cut(rect(-0.8 * MM, -C + 0.5 * MM, 1.6 * MM, 1.6 * MM), { depth: 0.04, ink });
    });
    if (p.focused) s.glow(circle(p.x + R, p.y + R, R + 2), FOCUS);
  },
});

// A trackball: a ball in a cup, free to roll any way and counted as it goes by a sensor on each axis, and a switch under the cup that a press clicks.
// Each count passed fires a bubbling `roll-x` (right is up) or `roll-y` (up is up) event with the steps in `detail`, and its angle each way is in the `roll-x` and `roll-y` attributes.
// A press that rolled it is not a click. `steps` is how many counts go round it, `ring` the bezel's material, and `on` with `color` lights it from under.
const BALL_STEPS = 16;
/** How soon after a roll a click still belongs to the drag, ms. */
const ROLLED = 250;
const axis = (name: string, rolled: true | 'x', keys: Record<string, number>) => turn({
  name, event: name, rolled, keys, mass: 0.6, material: 'ball-bearing', ticks: p => 360 / num(p, 'steps', BALL_STEPS),
});
const ball = together(axis('roll-x', 'x', { ArrowRight: 1, ArrowLeft: -1 }), axis('roll-y', true, { ArrowUp: 1, ArrowDown: -1 }), press({ mass: 2, material: 'plastic-on-plastic', sound: 'dome' }));
// Points on the ball, spread evenly, that show it turning.
const SPECKS = Array.from({ length: 22 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 22, r = Math.sqrt(1 - y * y), a = i * 2.39996;
  return [Math.cos(a) * r, y, Math.sin(a) * r] as const;
});
/** A click that comes right after a roll ended a drag across it, and isn't one. */
const unclicked = (p: Part, axes: string[]) => {
  let rolled = -Infinity;
  const ac = new AbortController(), { signal } = ac;
  for (const n of axes) p.el.addEventListener(n, e => (rolled = e.timeStamp), { signal });
  p.el.addEventListener('click', e => {
    if (e.detail && e.timeStamp - rolled < ROLLED) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, { signal, capture: true });
  return () => ac.abort();
};
definePart({
  selector: '[d-wheel~="ball"]',
  ...ball,
  connect(p: Part) {
    const off = ball.connect(p), clicks = unclicked(p, ['roll-x', 'roll-y']);
    return () => {
      off();
      clicks();
    };
  },
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, r = R * 0.7;
    const ring = p.el.getAttribute('ring') || 'satin-chrome', name = p.el.getAttribute('material') || 'polished-frosted-glass';
    const down = Math.max(0, Math.min(1, p.springs.press!.value)), lit = p.el.hasAttribute('on'), light = scale(lamp(p, 'white'), num(p, 'gain', 0.5));
    s.surface(circle(cx, cy, R), { material: ring, profile: 'round', bevel: R * 0.22, zEdge: 0, zTop: 0.5, over: { wear: d.wear * 0.3 } });
    s.well(circle(cx, cy, R * 0.78), 1.2, { bevel: R * 0.06 });
    if (lit) s.cut(minus(circle(cx, cy, R * 0.78), circle(cx, cy, r)), { ink: scale(light, 0.2), emit: light });
    s.surface(circle(cx, cy, r), { material: name, profile: 'dome', bevel: r, zEdge: -1, zTop: 0.9 - down * 0.3, over: { touch: d.age * 0.5 } });
    if (lit) s.cut(circle(cx, cy, r * 0.9), { ink: scale(light, 0.3), emit: scale(light, 0.35), feather: r * 0.5 });
    // Turned right by the one and up by the other, seen from above: what faces the viewer shows.
    const ax = p.springs['roll-x']!.value, ay = p.springs['roll-y']!.value, [ca, sa, cb, sb] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay)];
    for (const [x0, y0, z0] of SPECKS) {
      const x1 = x0 * ca + z0 * sa, z1 = -x0 * sa + z0 * ca, y2 = y0 * cb + z1 * sb, z2 = -y0 * sb + z1 * cb;
      if (z2 < 0.25) continue;
      s.cut(circle(cx + x1 * r * 0.92, cy - y2 * r * 0.92, r * 0.07 * z2), { ink: scale(lamp(p, 'white'), 0.04), depth: 0.02, soft: r * 0.05 });
    }
    if (p.focused) s.glow(circle(cx, cy, R + 2), FOCUS);
  },
});

// A roller: a ribbed wheel lying across a slot, rolled up and down with a thumb for ever, clicking at each rib, and pressed in to select, as under a phone's screen.
// Each rib passed fires a bubbling `roll-y` event, up positive, with the steps in `detail`. A press that rolled it is not a click.
// `ribs` is how many go round it and `height` how far it stands out of the slot, mm. Its box is the slot.
const RIBS_ROLLER = 18;
const roller = together(turn({
  name: 'roll-y', event: 'roll-y', rolled: true, keys: { ArrowUp: 1, ArrowDown: -1 }, mass: 1.5, material: 'rubber-on-plastic', ticks: p => 360 / num(p, 'ribs', RIBS_ROLLER),
}), press({ mass: 3, material: 'plastic-on-plastic', sound: 'dome' }));
definePart({
  selector: '[d-wheel~="roller"]',
  ...roller,
  connect(p: Part) {
    const off = roller.connect(p), clicks = unclicked(p, ['roll-y']);
    return () => {
      off();
      clicks();
    };
  },
  paint(s, p, d) {
    const name = p.el.getAttribute('material') || 'plastic-black', cy = p.y + p.h / 2, ribs = num(p, 'ribs', RIBS_ROLLER);
    const down = Math.max(0, Math.min(1, p.springs.press!.value)), top = num(p, 'height', 1.6) - down * 0.5, phase = p.springs['roll-y']!.value;
    const inset = Math.min(p.w, p.h) * 0.12, span = (p.h - inset * 2) / 2;
    s.well(rect(p.x, p.y, p.w, p.h, { radius: inset * 1.5 }), 1.5, { bevel: inset * 0.6 });
    s.surface(rect(p.x + inset, p.y + inset, p.w - inset * 2, p.h - inset * 2, { radius: inset }), {
      material: name, profile: 'round', bevel: span * 0.9, zEdge: -1.2, zTop: top, over: { wear: d.wear * 0.3, touch: d.age * 0.4 },
    });
    // The ribs on the half that faces out, closer together toward each edge as they turn away.
    for (let i = 0; i < ribs; i++) {
      const t = ((((i / ribs) * Math.PI * 2 - phase) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      if (Math.abs(t) > Math.PI * 0.42) continue;
      const y = cy + Math.sin(t) * span * 0.92, w = Math.max(0.5, Math.cos(t) * span * 0.16);
      s.cut(rect(p.x + inset * 1.6, y - w / 2, p.w - inset * 3.2, w), { depth: 0.35, soft: 0.4 });
    }
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: inset * 1.5 }), FOCUS);
  },
});
