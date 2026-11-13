// A valved brass instrument: tubing with its bends, a flared bell, pistons, a mouthpiece, and the small hardware soldered on. Each draws side on, as round as it really is.
import { arc, capsule, circle, definePart, defineStyles, FOCUS, lathe, MM, mm, offerSeat, poly, press, rect, slide, together, type Part, type Sheet, type SurfaceOptions } from 'device-ui';
import { key } from 'device-ui/controls/key';
import { controlStyles, keyStyles, num, nums } from 'device-ui/controls/shared';
import 'device-ui/materials';

defineStyles(keyStyles('[d-brass~="piston"]', '[d-brass~="waterkey"]') + controlStyles('[d-brass~="mouthpiece"]') + `
[d-brass~="piston"], [d-brass~="waterkey"] { display: block; }
[d-brass~="tube"], [d-brass~="bell"], [d-brass~="ring"], [d-brass~="brace"] { display: block; }
[d-brass~="tube"], [d-brass~="ring"], [d-brass~="brace"] { pointer-events: none; }
.d-gl [d-brass~="mouthpiece"], .d-gl [d-brass~="mouthpiece"] input { cursor: ns-resize; }
`);

const METAL = 'lacquered-brass';
const material = (p: Part, fallback = METAL) => p.el.getAttribute('material') || fallback;
/** Says that a valve went down or came up, for whatever is listening to the air. */
const said = (down: boolean) => (p: Part) => p.el.dispatchEvent(new CustomEvent('valve', { bubbles: true, detail: { down } }));

/** Numbers along a part in threes, mm, as css px. */
const triples = (p: Part, name: string): [number, number, number][] => {
  const n = nums(p, name, []), out: [number, number, number][] = [];
  for (let i = 0; i + 2 < n.length; i += 3) out.push([n[i]! * MM, n[i + 1]! * MM, n[i + 2]! * MM]);
  return out;
};

interface Run { x: number; y: number; a: number; len: number; bend?: [number, number, number, number, number]; draw(o: SurfaceOptions, R: number): void }

/** The straights and bends of a path whose corners are rounded off, in order. Draw the bends first: a straight runs a little way over the end of each, because a bend's round section falls away at its cut end. */
function runs(s: Sheet, x: number, y: number, points: [number, number, number][]): Run[] {
  const out: Run[] = [], at = points.map(([px, py]) => [x + px, y + py] as const);
  if (at.length < 2) return out;
  let from: readonly [number, number] = at[0]!;
  const line = (a: readonly [number, number], b: readonly [number, number], head: boolean, tail: boolean) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len <= 0.01) return;
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    // Turned, not a capsule: a tube's end is cut off square, and meets its bend or sleeve as one.
    out.push({ x: a[0], y: a[1], a: angle, len, draw: (o, R) => s.group({ at: [a[0], a[1]], rotate: angle }, () => {
      const shape = lathe(0, 0, [[head ? -R * 0.5 : 0, R], [tail ? len + R * 0.5 : len, R]]);
      s.surface(shape, { ...o, bevel: shape.bevel, zTop: o.zEdge! + shape.radius });
    }) });
  };
  const bend = (x0: number, y0: number, a: number, cx: number, cy: number, r: number, a0: number, turn: number) => {
    // Two corners that close a U with nothing between are one bend, or their ends would show.
    const was = out.at(-1)?.bend, near = (m: number, n: number) => Math.abs(m - n) < 0.6;
    if (was && near(was[0], cx) && near(was[1], cy) && near(was[2], r)) {
      const [, , , w0, wt] = was, later = Math.abs(((a0 - (w0 + wt) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.1;
      out.pop();
      a0 = later ? w0 : a0;
      turn += wt;
    }
    out.push({ x: x0, y: y0, a, len: r * turn, bend: [cx, cy, r, a0, turn], draw: (o, R) => s.surface(arc(cx, cy, r, a0, a0 + turn, R * 2), { ...o, zTop: o.zEdge! + R * MM_TO, bevel: R, profile: 'round' }) });
  };
  for (let i = 1; i < at.length - 1; i++) {
    const a = from, b = at[i]!, c = at[i + 1]!, r = points[i]![2];
    const ul = Math.hypot(b[0] - a[0], b[1] - a[1]), vl = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const u = [(b[0] - a[0]) / ul, (b[1] - a[1]) / ul] as const, v = [(c[0] - b[0]) / vl, (c[1] - b[1]) / vl] as const;
    const turn = Math.acos(Math.min(Math.max(u[0] * v[0] + u[1] * v[1], -1), 1)), cw = u[0] * v[1] - u[1] * v[0] > 0;
    if (!r || turn < 0.001) {
      line(a, b, i > 1, false);
      from = b;
      continue;
    }
    const t = r * Math.tan(turn / 2), s0 = [b[0] - u[0] * t, b[1] - u[1] * t] as const, s1 = [b[0] + v[0] * t, b[1] + v[1] * t] as const;
    const n = cw ? [-u[1], u[0]] : [u[1], -u[0]], cx = s0[0] + n[0]! * r, cy = s0[1] + n[1]! * r;
    line(a, s0, i > 1, true);
    // Clockwise from up, as an arc takes it.
    const from0 = Math.atan2(s0[0] - cx, cy - s0[1]), to0 = Math.atan2(s1[0] - cx, cy - s1[1]);
    bend(s0[0], s0[1], Math.atan2(u[1], u[0]), cx, cy, r, cw ? from0 : to0, turn);
    from = s1;
  }
  line(from, at[at.length - 1]!, at.length > 2, false);
  return out;
}
/** Css px as mm. */
const MM_TO = 1 / MM;

/** A short band round a tube or a body, standing `proud` of radius `R`, at `at` with its axis along `angle`. */
const band = (s: Sheet, x: number, y: number, angle: number, width: number, R: number, proud: number, axis: number, name: string) => s.group({ at: [x, y], rotate: angle }, () => {
  const w = width / 2, shape = lathe(0, 0, [[-w, R], [-w + width * 0.25, R + proud * 0.9], [0, R + proud], [w - width * 0.25, R + proud * 0.9], [w, R]]);
  s.surface(shape, { material: name, profile: 'round', bevel: shape.bevel, zEdge: axis, zTop: axis + shape.radius });
});

// Drawn tubing, round all the way, along a path. `points` is x y r for each corner, mm from its top left, r being the radius of the bend there; `size` is its outside diameter, mm.
// `rings` are the ferrules round it, each a distance along the path, mm, in `ring` (`width proud`, mm, and `ring-material`). `material` is the tube, and `height` how far its top stands, mm.
definePart({
  selector: '[d-brass~="tube"]',
  paint(s, p) {
    const size = num(p, 'size', 11) * MM, R = size / 2, axis = num(p, 'height', 12) - R / MM, name = material(p), o: SurfaceOptions = { material: name, profile: 'round', zEdge: axis, zTop: axis };
    const all = runs(s, p.x, p.y, triples(p, 'points'));
    for (const r of all) if (r.bend) r.draw(o, R);
    for (const r of all) if (!r.bend) r.draw(o, R);
    const rings = nums(p, 'rings', []);
    if (!rings.length) return;
    const [w = 2.5, proud = 0.5] = nums(p, 'ring', []), ring = p.el.getAttribute('ring-material') || name;
    for (const d of rings) {
      let left = d * MM;
      for (const r of all) {
        if (left <= r.len) {
          band(s, r.x + Math.cos(r.a) * left, r.y + Math.sin(r.a) * left, r.a, w * MM, R, proud * MM, axis, ring);
          break;
        }
        left -= r.len;
      }
    }
  },
});

// The flare of a horn, as a body turned on an axis along the middle of its box. `profile` is its radius at each distance along from the box's left edge, in pairs, mm: `distance radius`.
// What's nested in it sits on its curve. `material` is the metal, and `height` how far its widest stands, mm.
definePart({
  selector: '[d-brass~="bell"]',
  paint(s, p) {
    const n = nums(p, 'profile', [0, 5, 100, 30]), profile: [number, number][] = [];
    for (let i = 0; i + 1 < n.length; i += 2) profile.push([n[i]! * MM, n[i + 1]! * MM]);
    const name = material(p), most = Math.max(...profile.map(q => q[1])), axis = num(p, 'height', most / MM) - most / MM, y = p.y + p.h / 2;
    const shape = lathe(p.x, y, profile);
    s.surface(shape, { material: name, profile: 'round', bevel: shape.bevel, zEdge: axis, zTop: axis + shape.radius });
    offerSeat(p.el, { top: axis + most / MM, crown: [0, 0], x: p.x, y: p.y, w: p.w, h: p.h });
  },
});

// A piston in its casing, seen side on with the button at the top of its box: a button on a stem, a domed top cap, the casing and its band, and a knurled bottom cap. Pressing runs the button and stem down the casing.
// It says so with a `valve` event, with `down`. `size` is the casing's outside diameter, `travel` how far it goes, and `stem`, `cap`, `band` and `foot` where each starts down the box, mm.
// `material` is the casing and top cap, `foot-material` the bottom cap, `button` the rim of the finger button, `pearl` the inlay on it, `rod` the stem, and `height` how far the casing's top stands, mm.
definePart(key('[d-brass~="piston"]', {
  own: true,
  label: false,
  feel: { mass: 8, material: 'brass-on-steel', return: 1, down: said(true), up: said(false) },
  draw(s, p, _d, k) {
    const R = num(p, 'size', 17.7) * 0.5 * MM, axis = num(p, 'height', 26) - R / MM, name = material(p), rim = p.el.getAttribute('button') || name, pearl = p.el.getAttribute('pearl') || 'mother-of-pearl', rod = p.el.getAttribute('rod') || 'nickel-silver';
    const travel = num(p, 'travel', 10) * MM * Math.min(k.down, 1.02), wide = num(p, 'button-size', 15) * 0.5 * MM, capAt = num(p, 'cap', 16) * MM, bandAt = num(p, 'band', 57) * MM, footAt = p.h - num(p, 'foot', 7) * MM, stemR = num(p, 'stem', 4.4) * 0.5 * MM;
    const cx = p.x + p.w / 2, solid = (shape: ReturnType<typeof lathe>, m: string, z = axis) => s.surface(shape, { material: m, profile: 'round', bevel: shape.bevel, zEdge: z, zTop: z + shape.radius });
    // Everything runs along its axis, downwards from the top of the box.
    s.group({ at: [cx, p.y], rotate: Math.PI / 2 }, () => {
      s.group({ at: [travel, 0] }, () => {
        solid(lathe(0, 0, [[5 * MM, stemR], [capAt + 4 * MM, stemR]]), rod);
        // The inlay is set in the top of the button, so side on it's only a low lens of it above the rim.
        solid(lathe(0, 0, [[0, wide * 0.5], [0.5 * MM, wide * 0.76], [1.4 * MM, wide * 0.84]]), pearl);
        const crown = lathe(0, 0, [[1.3 * MM, wide * 0.94], [1.8 * MM, wide], [4.6 * MM, wide], [5.6 * MM, wide * 0.7]]);
        solid(crown, rim);
        knurl(s, 1.8 * MM, 4.6 * MM, wide, 36);
      });
      // A dome, its skirt and the shoulder down to the casing.
      const K = R / (8.85 * MM);
      solid(lathe(0, 0, [[capAt - 0.4 * MM, 2.8 * MM * K], [capAt + 1.2 * MM, 7.2 * MM * K], [capAt + 3.4 * MM, 9.9 * MM * K], [capAt + 6 * MM, 10.3 * MM * K], [capAt + 8 * MM, 9.8 * MM * K], [capAt + 8.6 * MM, 10.2 * MM * K], [capAt + 10.2 * MM, 10.1 * MM * K], [capAt + 11.2 * MM, 9.2 * MM * K]]), name);
      solid(lathe(0, 0, [[capAt + 10.6 * MM, R], [footAt + 1.2 * MM, R]]), name);
      for (const at of [bandAt, bandAt + 3.6 * MM]) band(s, at, 0, 0, 2.6 * MM, R, 0.7 * MM, axis, name);
      solid(lathe(0, 0, [[footAt, R + 0.2 * MM], [footAt + 0.8 * MM, R + 1.2 * MM], [footAt + 4.2 * MM, R + 1.3 * MM], [footAt + 5.4 * MM, R + 0.2 * MM], [footAt + 6.6 * MM, R * 0.8], [footAt + 7 * MM, R * 0.5]]), p.el.getAttribute('foot-material') || name);
      knurl(s, footAt + 0.8 * MM, footAt + 4.2 * MM, R + 1.3 * MM, 56);
    });
    k.focus(rect(cx - wide - 2, p.y + travel - 2, wide * 2 + 4, 6 * MM + 4, { radius: 4 }), 2);
  },
}));

/** Knurling round a band of a body along x, seen side on: fine grooves along it, closing up as they turn away. */
function knurl(s: Sheet, x0: number, x1: number, R: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.5) / count) * Math.PI, y = Math.cos(a) * R, w = Math.max(Math.sin(a) * ((Math.PI * R) / count) * 0.45, 0.25);
    s.cut(rect(x0, y - w / 2, x1 - x0, w), { depth: 0.14, soft: 0.5 });
  }
}

// A brass mouthpiece, side on with its cup at the left of its box and its shank running off to the right: where the player's breath goes in.
// Hold it and it says so with `blow` events, with `on`, and dragging up and down moves the range `<input>` inside it, which is how tight the lips are. Space or Enter blows from the keyboard, and the arrows move the input.
// `profile` is its radius along it, pairs of `distance radius` in mm. `material` is the plating, `height` how far its widest stands, mm.
const blow = (on: boolean) => (p: Part) => p.el.dispatchEvent(new CustomEvent('blow', { bubbles: true, detail: { on } }));
definePart({
  selector: '[d-brass~="mouthpiece"]',
  ...together(press({ mass: 1, material: 'plastic-on-rubber', return: 1, down: blow(true), up: blow(false) }), slide({ input: 0, axis: 'y', travel: -60, mass: 1, return: 0 })),
  paint(s, p) {
    const n = nums(p, 'profile', [0, 12, 4, 13, 20, 9, 28, 4.5, 80, 5]), profile: [number, number][] = [];
    for (let i = 0; i + 1 < n.length; i += 2) profile.push([n[i]! * MM, n[i + 1]! * MM]);
    const shape = lathe(p.x, p.y + p.h / 2, profile), axis = num(p, 'height', shape.radius) - shape.radius;
    s.surface(shape, { material: material(p, 'silver-plate'), profile: 'round', bevel: shape.bevel, zEdge: axis, zTop: axis + shape.radius });
    if (p.focused) s.glow(rect(p.x - 2, p.y - 2, p.w + 4, p.h + 4, { radius: 6 }), FOCUS);
  },
});
// A sprung lever that holds a cork against a hole in the tube, to let the water out. Its pivot is `pin`, x y mm from its top left. `points` is its bent arm, x y r for each corner, mm from its top left, and pressing lifts it round the pin by `swing` degrees.
// It says so with a `valve` event. `material` is the lever and `height` how far it stands, mm.
definePart(key('[d-brass~="waterkey"]', {
  own: true,
  label: false,
  feel: { mass: 2, material: 'brass-on-steel', return: 1.2, down: said(true), up: said(false) },
  draw(s, p, _d, k) {
    const [px = 0, py = 0] = nums(p, 'pin', []), name = material(p), top = num(p, 'height', 16), pts = triples(p, 'points'), size = num(p, 'size', 1.8) * 0.5 * MM;
    const axis = top - size / MM, x = p.x + px * MM, y = p.y + py * MM, turnBy = num(p, 'swing', 14) * (Math.PI / 180) * k.down;
    // The post it turns in, and the nipple the cork shuts.
    s.surface(circle(x, y, 1.6 * MM), { material: name, profile: 'dome', zEdge: axis - 2, zTop: top + 0.4 });
    s.group({ at: [x, y], rotate: turnBy }, () => {
      const arm = runs(s, -px * MM, -py * MM, pts);
      for (const bends of [true, false]) for (const r of arm) if (!!r.bend === bends) r.draw({ material: name, profile: 'round', zEdge: axis, zTop: axis }, size);
      const [cx = 0, cy = 0] = nums(p, 'cork', []);
      s.surface(circle((cx - px) * MM, (cy - py) * MM, 2.6 * MM), { material: name, profile: 'dome', zEdge: axis, zTop: top + 1 });
    });
    s.surface(circle(x, y, 0.9 * MM), { material: 'nickel-silver', profile: 'dome', zEdge: top, zTop: top + 0.8 });
    k.focus(rect(p.x, p.y, p.w, p.h, { radius: 6 }));
  },
}));

// A ring soldered on for a finger to pull a slide by, filling its box. `size` is the rod, mm. `material` is the metal and `height` how far it stands, mm.
definePart({
  selector: '[d-brass~="ring"]',
  paint(s, p) {
    const w = num(p, 'size', 2) * MM, R = Math.min(p.w, p.h) / 2 - w / 2, axis = num(p, 'height', 12) - w / 2 / MM;
    s.surface(arc(p.x + p.w / 2, p.y + p.h / 2, R, 0, Math.PI * 2, w), { material: material(p), profile: 'round', bevel: w / 2, zEdge: axis, zTop: axis + (w / 2) / MM });
  },
});

// A stay between two tubes: a rod through its box from top to bottom, ending in a pointed foot at each end where it's soldered on. `size` is the rod and `foot` the width of the feet, mm.
// `material` is the metal and `height` how far it stands, mm.
definePart({
  selector: '[d-brass~="brace"]',
  paint(s, p) {
    const R = num(p, 'size', 2.6) * 0.5 * MM, name = material(p), top = num(p, 'height', 14), axis = top - R / MM, cx = p.x + p.w / 2, hw = num(p, 'foot', 6.4) * 0.5 * MM, leaf = 6 * MM;
    const o: SurfaceOptions = { material: name, profile: 'round', zEdge: axis, zTop: axis };
    s.surface(capsule(cx, p.y + leaf * 0.6, cx, p.y + p.h - leaf * 0.6, R, R), o);
    for (const [y, dir] of [[p.y, 1], [p.y + p.h, -1]] as const) {
      s.surface(poly([[cx, y, 0], [cx + hw, y + dir * leaf * 0.55, 1], [cx + R * 1.5, y + dir * leaf, 2], [cx - R * 1.5, y + dir * leaf, 2], [cx - hw, y + dir * leaf * 0.55, 1]]), { material: name, profile: 'round', bevel: 2, zEdge: axis - 1, zTop: top + 0.3 });
      const at = y + dir * leaf * 1.25;
      band(s, cx, at, Math.PI / 2, 2.4 * MM, R, 0.6 * MM, axis, name);
    }
  },
});
