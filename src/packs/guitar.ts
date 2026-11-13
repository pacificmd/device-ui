// An electric guitar's hardware, and the strings that are the point of it. The body and neck are surfaces: their outlines are the object's own.
import { arc, capsule, carried, circle, definePart, defineStyles, FOCUS, linear, MM, pluck, poly, rect, text, turn, type Part, type Sheet, type StringLine } from 'device-ui';
import { controlStyles, num, nums } from 'device-ui/controls/shared';
import 'device-ui/materials';

defineStyles(`
${controlStyles('[d-knob~="hat"]', '[d-switch~="blade"]')}
[d-knob~="hat"], [d-knob~="hat"] input { border-radius: 50%; }
[d-strings] { display: block; }
.d-gl [d-strings] button { position: absolute; left: 0; right: 0; height: 16.6%; opacity: 0; padding: 0; border: 0; pointer-events: none; }
[d-strings] button:nth-of-type(1) { top: 0; } [d-strings] button:nth-of-type(2) { top: 16.6%; } [d-strings] button:nth-of-type(3) { top: 33.3%; }
[d-strings] button:nth-of-type(4) { top: 50%; } [d-strings] button:nth-of-type(5) { top: 66.6%; } [d-strings] button:nth-of-type(6) { top: 83.3%; }
`);

const RAD = Math.PI / 180;

/** Pairs of numbers, mm from the part's top left, as css px from its top left. */
const pairs = (p: Part, name: string): [number, number][] => {
  const n = nums(p, name, []), out: [number, number][] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i]! * MM, n[i + 1]! * MM]);
  return out;
};

// The line of each string between its two ends: `bridge` and `nut`, x y for each, mm from the part's top left.
const speaking = (p: Part): StringLine[] => {
  const a = pairs(p, 'bridge'), b = pairs(p, 'nut');
  return a.map((e, i) => [e[0], e[1], b[i]![0], b[i]![1]] as const);
};
const hand = pluck({ strings: speaking });

// A course of strings over a bridge and a nut. Catch one and let go, or sweep across them: each says so with a `pluck` event, and is a real button for the keyboard.
// `bridge` and `nut` are where each string leaves off, x y in mm from its top left, `heads` where it goes past the nut, and `gauges` how thick each is, mm. The first `wound` of them are wound in `wrap`.
// `material` is the plain wire, and `height` how far they stand off whatever is under them, mm, following it, as a shadow from their true height would lie further off than it reads.
definePart({
  selector: '[d-strings]',
  ...hand,
  paint(s, p, d) {
    const top = num(p, 'height', 2.5), gauges = nums(p, 'gauges', [1.17, 0.91, 0.66, 0.43, 0.33, 0.25]), wound = num(p, 'wound', 3);
    const plain = p.el.getAttribute('material') || 'polished-steel', wrap = p.el.getAttribute('wrap') || 'satin-steel', heads = pairs(p, 'heads'), focus = p.el.querySelector(':focus-visible');
    speaking(p).forEach(([ax, ay, bx, by], i) => {
      const r = Math.max((gauges[i] ?? 0.4) * MM * 0.5, 0.6), o = { material: i < wound ? wrap : plain, follow: true, rise: top, bevel: r, profile: 'round' as const, over: { wear: d.wear * 0.2 } };
      const x0 = p.x + ax, y0 = p.y + ay, x1 = p.x + bx, y1 = p.y + by, { at, by: aside } = hand.shape(p, i);
      if (aside) {
        const len = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
        const kx = x0 + (x1 - x0) * at + nx * aside, ky = y0 + (y1 - y0) * at + ny * aside;
        s.surface(capsule(x0, y0, kx, ky, r, r), o);
        s.surface(capsule(kx, ky, x1, y1, r, r), o);
      } else s.surface(capsule(x0, y0, x1, y1, r, r), o);
      const head = heads[i];
      if (head) s.surface(capsule(x1, y1, p.x + head[0], p.y + head[1], r, r), { ...o, rise: 1 });
      if (focus && p.el.querySelectorAll('button')[i] === focus) s.glow(capsule(x0, y0, x1, y1, r + 1.5, r + 1.5), FOCUS);
    });
  },
});

// The frets, dots and nut on a neck, from a fretboard that fills its box: the nut along its right edge and the heel along its left. `scale` is the string's length, `count` how many frets, and `nut` and `heel` how wide the board is at each end, mm.
// `material` is the fretwire, `dot` the colour of the inlays, `at` the frets they mark, with two at the octaves.
definePart({
  selector: '[d-guitar~="frets"]',
  paint(s, p) {
    const scale = num(p, 'scale', 648) * MM, count = num(p, 'count', 21), nut = num(p, 'nut', 43) * MM, heel = num(p, 'heel', 57) * MM;
    const wire = p.el.getAttribute('material') || 'satin-steel', ink = linear(p.el.getAttribute('dot') || '#14100c'), bone = p.el.getAttribute('nut-material') || 'keycap-ivory';
    const end = p.x + p.w, cy = p.y + p.h / 2, wide = (x: number) => nut + ((heel - nut) * (end - x)) / Math.max(p.w, 1), from = (i: number) => end - scale * (1 - 2 ** (-i / 12));
    const marks = nums(p, 'at', [3, 5, 7, 9, 12, 15, 17, 19, 21]), R = num(p, 'dot-size', 6) * 0.5 * MM;
    for (const f of marks) {
      const x = (from(f) + from(f - 1)) / 2;
      if (f % 12) s.print(circle(x, cy, R), ink);
      else for (const k of [-1, 1]) s.print(circle(x, cy + (k * wide(x)) / 4, R), ink);
    }
    for (let i = 1; i <= count; i++) {
      const x = from(i), h = wide(x) - 1;
      s.surface(rect(x - 1.1 * MM, cy - h / 2, 2.2 * MM, h, { radius: 2 }), { material: wire, profile: 'round', bevel: MM, zEdge: 0, zTop: 1 });
    }
    s.surface(rect(end - 3.2 * MM, cy - nut / 2, 3.2 * MM, nut, { radius: 1 }), { material: bone, profile: 'round', bevel: 3, zEdge: 0, zTop: 2 });
  },
});

// A single coil under a moulded cover, its six pole pieces standing through it. `rotate` slants it, degrees. `stagger` is how far each pole stands, mm, `pitch` their spacing, mm.
// `material` is the cover, `pole` the metal, and `height` how far the cover stands, mm.
definePart({
  selector: '[d-guitar~="pickup"]',
  paint(s, p, d) {
    const name = p.el.getAttribute('material') || 'keycap-ivory', top = num(p, 'height', 4), pole = p.el.getAttribute('pole') || 'chrome', pitch = num(p, 'pitch', 10.6) * MM, R = num(p, 'pole-size', 4.8) * 0.5 * MM;
    const heights = nums(p, 'stagger', [0.6, 0.6, 1, 1, 0.7, 0.5]);
    s.group({ at: [p.x + p.w / 2, p.y + p.h / 2], rotate: num(p, 'rotate', 0) * RAD }, () => {
      s.surface(rect(-p.w / 2, -p.h / 2, p.w, p.h, { radius: p.w / 2 }), { material: name, profile: 'round', bevel: 2.4 * MM, zEdge: 0, zTop: top, over: { wear: d.wear * 0.3 } });
      heights.forEach((h, i) => {
        const y = (i - (heights.length - 1) / 2) * pitch;
        s.surface(circle(0, y, R), { material: pole, profile: 'dome', zEdge: top - 0.2, zTop: top + h });
      });
    });
  },
});

// A vintage tremolo bridge, seen from above: a steel plate with six bent saddles on it, a row of pivot screws and the socket for the arm. Its box is the plate, stepped back at one corner.
// `material` is the steel, `pitch` the distance between strings, `at` how far along the plate the saddles sit, and `screws` how far along their row of screws, mm. `height` is how far the saddles stand, mm.
definePart({
  selector: '[d-guitar~="bridge"]',
  paint(s, p, d) {
    const name = p.el.getAttribute('material') || 'satin-chrome', pitch = num(p, 'pitch', 11.2) * MM, top = num(p, 'height', 8), cx = p.x + num(p, 'at', 15.5) * MM, rows = p.x + num(p, 'screws', 34.4) * MM;
    const first = p.y + num(p, 'first', 8.9) * MM, step = p.h * 0.887, notch = p.w * 0.62;
    const corner = 1.4 * MM;
    s.surface(poly([[p.x, p.y, corner], [p.x + p.w, p.y, corner], [p.x + p.w, p.y + step, corner], [p.x + notch, p.y + step, corner], [p.x + notch, p.y + p.h, corner], [p.x, p.y + p.h, corner]]), { material: name, profile: 'round', bevel: 0.8 * MM, zEdge: 0, zTop: 1.6, over: { wear: d.wear * 0.4 } });
    for (let i = 0; i < 6; i++) {
      const y = first + i * pitch, sad = pitch - 1.6;
      // The screw that sets the string's length, through the back of the saddle and its spring.
      s.surface(capsule(p.x + 0.5 * MM, y, cx + 6 * MM, y, 1.1 * MM, 1.1 * MM), { material: 'chrome', zEdge: 2, zTop: 4.4 });
      s.surface(rect(cx - 11 * MM, y - sad / 2, 22 * MM, sad, { radius: 1.5 }), { material: 'brushed-chrome', profile: 'chamfer', bevel: 3, zEdge: 1.6, zTop: 3.6, over: { wear: d.wear * 0.5 } });
      // Bent up at the back into a ridge the string breaks over.
      s.surface(rect(cx - 2.6 * MM, y - sad / 2, 5.2 * MM, sad, { radius: 1.5 }), { material: 'polished-steel', profile: 'round', bevel: 5, zEdge: 3.6, zTop: top });
      s.cut(rect(cx - 2.6 * MM, y - 0.8, 5.2 * MM, 1.6), { depth: 0.2, soft: 1 });
      for (const k of [-1, 1]) s.surface(circle(cx + 7.4 * MM, y + k * 2.3 * MM, 1.25 * MM), { material: 'black-oxide', profile: 'chamfer', bevel: 1.2, zEdge: 3.6, zTop: 4.4 });
      s.surface(circle(rows, y, 2.6 * MM), { material: 'chrome', profile: 'dome', zEdge: 1.6, zTop: 3.2 });
      s.cut(rect(rows - 2.1 * MM, y - 0.8, 4.2 * MM, 1.6), { depth: 0.35, soft: 0.6 });
    }
    const sx = p.x + num(p, 'socket-x', 10.6) * MM, sy = p.y + num(p, 'socket-y', 77.8) * MM;
    s.surface(circle(sx, sy, 5.2 * MM), { material: 'chrome', radial: true, profile: 'round', bevel: 5, zEdge: 1.6, zTop: 3 });
    s.surface(circle(sx, sy, 2.8 * MM), { material: 'well', bevel: 1.5, zEdge: 3, zTop: 0 });
  },
});

// A bent rod with a tip, out of a tremolo's socket and across the guitar. `points` is its path, x y in mm from its top left, with the tip on the last stretch of it.
// `material` is the rod, `tip` its end, `height` how far it stands, mm.
definePart({
  selector: '[d-guitar~="arm"]',
  paint(s, p) {
    const pts = pairs(p, 'points'), name = p.el.getAttribute('material') || 'chrome', tip = p.el.getAttribute('tip') || 'keycap-ivory', top = num(p, 'height', 13), R = 1.5 * MM;
    pts.slice(1).forEach((b, i) => {
      const a = pts[i]!, last = i === pts.length - 2, z = (k: number) => 2 + (top - 2) * Math.min((k + 1) / 2, 1);
      s.surface(capsule(p.x + a[0], p.y + a[1], p.x + b[0], p.y + b[1], R, R), { material: name, zEdge: Math.max(z(i - 1), 2), zTop: z(i) + 1 });
      if (last) {
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1 - (26 * MM) / l, 0), mx = a[0] + (b[0] - a[0]) * k, my = a[1] + (b[1] - a[1]) * k;
        s.surface(capsule(p.x + mx, p.y + my, p.x + b[0], p.y + b[1], R * 1.35, R * 1.2), { material: tip, zEdge: top, zTop: top + 2 });
      }
    });
  },
});

// A machine head from the front: the post a string winds on, in its bushing, on a box centred on the post. `button` is where the turning button shows past the edge of the headstock, x y in mm from the post, and `button-size` its width, mm.
// `material` is the metal, `height` how far the post stands, mm.
definePart({
  selector: '[d-guitar~="tuner"]',
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, name = p.el.getAttribute('material') || 'chrome', top = num(p, 'height', 9), [bx, by] = nums(p, 'button', []);
    if (bx !== undefined && by !== undefined) {
      const x = cx + bx * MM, y = cy + by * MM, w = num(p, 'button-size', 11) * MM;
      s.surface(capsule(x, y + 7 * MM, x, y, 1.6 * MM, 1.6 * MM), { material: name, zEdge: 0, zTop: 3 });
      s.surface(rect(x - w / 2, y - 3 * MM, w, 6 * MM, { radius: 2.4 * MM }), { material: name, profile: 'round', bevel: 2 * MM, zEdge: 0, zTop: 6 });
    }
    s.surface(circle(cx, cy, R), { material: name, radial: true, profile: 'round', bevel: R * 0.3, zEdge: 0, zTop: 1.2 });
    s.surface(circle(cx, cy, R * 0.74), { material: 'satin-steel', radial: true, profile: 'dome', zEdge: 1.2, zTop: 2 });
    s.surface(circle(cx, cy, R * 0.5), { material: name, profile: 'round', bevel: R * 0.1, zEdge: 2, zTop: top });
    s.cut(rect(cx - R * 0.5, cy - R * 0.08, R, R * 0.16), { depth: 0.6, soft: 0.6 });
  },
});

const hatTurn = turn({ mass: 6, material: 'metal-on-grease', input: true, travel: 220, stops: { at: p => [-num(p, 'sweep', 150), num(p, 'sweep', 150)] } });

const digits = (s: Sheet, R: number, sweep: number, count: number, ink: [number, number, number]) => {
  const size = R * 0.2, font = `600 ${size}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
  for (let i = 0; i <= count; i++) {
    // The number that's at the top when the knob is turned to it.
    const a = (sweep - (i * 2 * sweep) / count) * RAD, r = R * 0.76, x = Math.sin(a) * r, y = -Math.cos(a) * r, w = size * 1.8;
    s.cut(text(String(i), x - w / 2, y - w / 2, w, w, { font, rotate: a }), { ink });
  }
};

// A top-hat knob as on a guitar: a fine-ribbed barrel with a low domed top, its numbers round the edge of the top and turning with it. `legend` is printed across the middle.
// `count` is the highest number, `sweep` the degrees either side of straight up, `mark` the colour of the print, `material` the moulding, and `height` is mm.
definePart({
  selector: '[d-knob~="hat"]',
  ...hatTurn,
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, name = p.el.getAttribute('material') || 'keycap-ivory', top = num(p, 'height', 9), sweep = num(p, 'sweep', 150), mark = linear(p.el.getAttribute('mark') || '#6b5a3c'), word = p.el.getAttribute('legend');
    if (carried(p)) return;
    s.group({ ...hatTurn.place(p) }, () => {
      s.surface(circle(0, 0, R, { ripple: [60, R * 0.012] }), { material: name, bevel: R * 0.05, zEdge: 0, zTop: top - 1.4, over: { wear: d.wear * 0.3 } });
      s.surface(circle(0, 0, R * 0.92), { material: name, profile: 'dome', zEdge: top - 1.4, zTop: top });
      digits(s, R, sweep, num(p, 'count', 10), mark);
      if (word) {
        const size = R * 0.19;
        s.cut(text(word, -R * 0.55, -size, R * 1.1, size * 2, { font: `600 ${size}px 'Helvetica Neue', Helvetica, Arial, sans-serif`, letterSpacing: `${size * 0.1}px` }), { ink: mark });
      }
    });
    if (p.focused) s.glow(circle(cx, cy, R + 1.5), FOCUS);
  },
});

// Its pin sits under the guard, out of its box. Where that is, mm from the box's top left, is `pin`.
const pinOf = (p: Part): [number, number] => {
  const [x = 0, y = 0] = nums(p, 'pin', []);
  return [x * MM, y * MM];
};
const lever = turn({ mass: 3, material: 'metal-on-grease', input: true, detents: { strength: 0.8 }, travel: 120, at: pinOf, stops: { at: p => [num(p, 'from', -20), num(p, 'to', 20)] } });

// A blade switch: a lever through a slot, clicking through each step of its input, with its pin out of sight under the panel. `pin` is where it turns, x y in mm from its top left, and `from` and `to` are the ends of its swing, degrees from straight up round that pin.
// `material` is the tip and `height` how far it stands, mm.
definePart({
  selector: '[d-switch~="blade"]',
  ...lever,
  paint(s, p) {
    const [px, py] = pinOf(p), cx = p.w / 2, cy = p.h / 2, R = Math.hypot(cx - px, cy - py), name = p.el.getAttribute('material') || 'keycap-ivory', top = num(p, 'height', 9);
    const a0 = num(p, 'from', -20) * RAD, a1 = num(p, 'to', 20) * RAD, wide = 2.4 * MM;
    s.surface(arc(p.x + px, p.y + py, R, a0 - 0.03, a1 + 0.03, wide), { material: 'well', bevel: 1, zEdge: 0, zTop: -1.5 });
    s.group(lever.place(p), () => {
      s.surface(rect(-0.6 * MM, -R - 1.1 * MM, 1.2 * MM, 2.2 * MM), { material: 'satin-steel', zEdge: -1, zTop: top - 2 });
      s.surface(rect(-5.5 * MM, -R - 3 * MM, 11 * MM, 6 * MM, { radius: 2.6 * MM }), { material: name, profile: 'round', bevel: 2.2 * MM, zEdge: top - 3, zTop: top });
    });
    if (p.focused) s.glow(arc(p.x + px, p.y + py, R, a0, a1, wide + 2), FOCUS);
  },
});
