// Wristwatches, down to the cushion one sits on in its box. Each piece holds the next: cushion, case,
// bezel, dial, hands. Nothing needs the piece round it, so a dial sits as well on any surface.
import { circle, contact, definePart, defineStyles, FOCUS, grow, input, intersect, layOf, legendColor, linear, mechanism, MM, offerSeat, path, poly, press, rect, seatOf, slide, spring, text, thread, together, turn, type Part, type Sheet, type Vec3 } from 'device-ui';
import { key, words } from 'device-ui/controls/key';
import { controlStyles, num, nums, polar } from 'device-ui/controls/shared';

defineStyles(`
${controlStyles('[d-wheel~="crown"]')}
[d-watch~="cushion"], [d-watch~="strap"], [d-watch~="band"], [d-watch~="bracelet"], [d-watch~="case"], [d-watch~="bezel"], [d-watch~="turnbezel"], [d-watch~="dial"], [d-watch~="hands"], [d-glass~="cover"], [d-key~="pusher"] { display: block; }
[d-watch~="hands"], [d-glass~="cover"] { pointer-events: none; }
`);

const FONT = '600 8px "Barlow Semi Condensed"', DATE = '600 12px "Barlow Semi Condensed"', SCALE = '500 15px "Barlow Semi Condensed"';
const TAU = Math.PI * 2;
const FELT = -7;
// The cushion is flat under the case and rolls away past the lugs. The strap rides over it.
const CUSHION = 7.5, FLAT = 146, ROLL = 104, FALL = 14.5;
// Radians round a bracelet's fold before it's out of sight.
const GONE = 1.3;
const seated = (p: Part, top: number) => offerSeat(p.el, { top, crown: [0, 0], x: p.x, y: p.y, w: p.w, h: p.h });
// Brushed along the wrist, and not round the shape.
const ALONG = Math.PI / 2;
const BRUSHED = { material: 'satin-steel', over: { tangent: ALONG } };

type Pt = [number, number];
const hand = (cx: number, cy: number, a: number, len: number, tail: number, w: number) => {
  const [x, y] = polar(cx, cy, (len - tail) / 2, a), l = len + tail;
  return rect(x - w / 2, y - l / 2, w, l, { rotate: a, radius: w / 2 });
};
// A long leaf with a ridge down the middle, which a chamfer as wide as the leaf draws by itself.
const leaf = (cx: number, cy: number, a: number, len: number, tail: number, w: number) => {
  const [x, y] = polar(cx, cy, (len - tail) / 2, a), l = len + tail;
  return path(`M${w / 2} 0L${w} ${l * 0.72}L${w / 2} ${l}L0 ${l * 0.72}Z`, x - w / 2, y - l / 2, w, l, { viewBox: [0, 0, w, l], rotate: a, spread: 4 });
};

const line = (a: Pt, b: Pt, n = 16): Pt[] => Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
const curve = (a: Pt, b: Pt, c: Pt, d: Pt, n = 32): Pt[] => Array.from({ length: n }, (_, i) => {
  const t = i / n, u = 1 - t, k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return [k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0], k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1]];
});
const outline = (pts: Pt[]) => `M${pts.map(p => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')}Z`;
// The same curve moved in by a distance, so a pad and its stitching follow the strap's edge.
const inset = (pts: Pt[], by: number, side: number): Pt[] => pts.map((p, i) => {
  const a = pts[Math.max(i - 1, 0)]!, b = pts[Math.min(i + 1, pts.length - 1)]!;
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [p[0] + (side * dy * by) / l, p[1] - (side * dx * by) / l];
});
// Points along a curve, a pitch apart, each with its direction.
const along = (pts: Pt[], pitch: number) => {
  const out: [number, number, number][] = [];
  let left = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (left <= l) {
      out.push([a[0] + ((b[0] - a[0]) * left) / l, a[1] + ((b[1] - a[1]) * left) / l, Math.atan2(b[1] - a[1], b[0] - a[0])]);
      left += pitch;
    }
    left -= l;
  }
  return out;
};

// One flat strap, from under the lug to well past where it goes out of sight.
const LONG = 190;
const STRAP_LINE: Pt[] = [...line([0, 0], [6, LONG]), ...line([6, LONG], [126, LONG]), ...line([126, LONG], [132, 0]), [132, 0]];
// The middle of the case and its lugs are one piece of steel, so one outline: round the barrel from
// 12 to 3, with a lug on the way, then mirrored.
const R = 140, LUG = 68, TIP = 164;
const rim = (from: number, to: number, n = 24): Pt[] => Array.from({ length: n }, (_, i) => {
  const a = from + ((to - from) * i) / n;
  return [Math.sin(a) * R, -Math.cos(a) * R];
});
const SHOULDER = 1.03;
const QUARTER: Pt[] = [
  ...rim(0, Math.asin(LUG / R), 12),
  ...line([LUG, -Math.sqrt(R * R - LUG * LUG)], [LUG, -150], 6),
  ...curve([LUG, -150], [LUG, -160], [74, -TIP], [84, -TIP], 10),
  ...curve([84, -TIP], [95, -TIP], [101, -158], [104, -146], 10),
  ...curve([104, -146], [107, -128], [104.5, -97.7], [Math.sin(SHOULDER) * R, -Math.cos(SHOULDER) * R], 24),
  ...rim(SHOULDER, Math.PI / 2, 16),
];
const SIDE = [...QUARTER, ...QUARTER.slice().reverse().map(([x, y]): Pt => [x, -y])];
const CASE_LINE = [...SIDE, ...SIDE.slice().reverse().map(([x, y]): Pt => [-x, y])];

// A rounded square, or a circle at 2. Higher is squarer, and how far out the edge lies along `a`.
const edge = (a: number, n: number) => (Math.abs(Math.sin(a)) ** n + Math.abs(Math.cos(a)) ** n) ** (-1 / n);
const rounded = (cx: number, cy: number, w: number, h: number, n: number) => {
  if (n === 2 && w === h) return circle(cx, cy, w / 2);
  const pts = Array.from({ length: 144 }, (_, i): Pt => {
    const a = (i / 144) * TAU, r = edge(a, n);
    return [w / 2 + (Math.sin(a) * r * w) / 2, h / 2 - (Math.cos(a) * r * h) / 2];
  });
  return path(outline(pts), cx - w / 2, cy - h / 2, w, h, { viewBox: [0, 0, w, h], spread: 24 });
};

/** Waits for the type a part sets. */
const lettered = (p: Part) => {
  const ready = () => p.el.setAttribute('ready', '');
  document.fonts.load(FONT).then(ready, ready);
};

// The cushion a watch sits on in a box, rolling away at both ends. `flat` and `roll` are mm from its
// middle, and `fall` is how far it drops. What's nested in it sits on top.
definePart({
  selector: '[d-watch~="cushion"]',
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, flat = num(p, 'flat', FLAT / MM) * MM, roll = num(p, 'roll', ROLL / MM) * MM;
    s.bend({ from: [cx, cy + flat], to: [cx, cy + flat + roll], drop: num(p, 'fall', FALL), mirror: [cx, cy] });
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: p.w / 7 }), { material: 'felt-slate', zEdge: FELT, zTop: CUSHION, bevel: p.w / 7, crown: [2.5, 0] });
    seated(p, seatOf(p) + CUSHION);
  },
});

// A padded strap, drawn flat and rolled over the cushion. The edge is painted, the flange holds the
// stitching, and the pad swells up inside it.
definePart({
  selector: '[d-watch~="strap"]',
  paint(s, p) {
    const tail = p.el.hasAttribute('tail'), side = tail ? 1 : -1, cx = p.x + p.w / 2, cy = p.y + (tail ? -110 : p.h + 110);
    const pts = tail ? STRAP_LINE : STRAP_LINE.map(([x, y]): Pt => [x, LONG - y]);
    const shape = (by: number) => path(outline(by ? inset(pts, by, side) : pts), p.x, p.y, p.w, p.h, { viewBox: [0, 0, p.w, p.h] });
    const leather = { material: 'leather-tan', over: { color: '#5e331a', rough: 0.3, coat: 0.5 } };
    s.bend({ from: [cx, cy + FLAT * side], to: [cx, cy + (FLAT + ROLL) * side], drop: FALL });
    s.surface(shape(0), { material: 'edge-paint', zEdge: 0, zTop: 0.3, bevel: 1.5 });
    s.surface(shape(1.5), { ...leather, zEdge: 0.3, zTop: 0.6, bevel: 1.5 });
    s.surface(shape(10), { ...leather, zEdge: 0.6, zTop: 3.6, bevel: 20, crown: [1.2, 0] });
    for (const [x, y, a] of along(inset(pts, 5.8, side), 8)) {
      const dx = Math.cos(a) * 4, dy = Math.sin(a) * 4, X = p.x + x, Y = p.y + y;
      s.cut(rect(X - 2.7, Y - 0.8, 5.4, 1.6, { radius: 0.8, rotate: a }), { depth: -0.16, ink: [0.58, 0.46, 0.3], rough: 0.8, soft: 0.6 });
      s.cut(circle(X + dx, Y + dy, 0.9), { depth: 0.2, ink: [0.02, 0.014, 0.01] });
    }
    if (tail) for (let y = 104; y < LONG; y += 20) s.cut(circle(cx, p.y + y, 4.6), { depth: 1.4, ink: [0.012, 0.01, 0.008], soft: 1 });
  },
});

// A strap moulded in one piece of resin or rubber, rolled away past `flat` mm from the case over `roll` mm, falling `fall` mm. It runs up the page, or down with `tail`.
// `pitch` is mm between its ribs, `slot` the length and width in mm of the slot across the middle of each. `edge` is the rounded edge in mm, `height` mm.
definePart({
  selector: '[d-watch~="band"]',
  paint(s, p) {
    const far = p.el.hasAttribute('tail') ? 1 : -1, near = far > 0 ? p.y : p.y + p.h, cx = p.x + p.w / 2, material = p.el.getAttribute('material') || 'rubber';
    const flat = num(p, 'flat', 10) * MM, roll = num(p, 'roll', 26) * MM, pitch = num(p, 'pitch', 6) * MM, [sw = 11, sh = 0.8] = nums(p, 'slot', []), edge = num(p, 'edge', 1) * MM;
    s.bend({ from: [cx, near + far * flat], to: [cx, near + far * (flat + roll)], drop: num(p, 'fall', 12) });
    s.surface(rect(p.x, p.y, p.w, p.h), { material, zEdge: -0.4, zTop: num(p, 'height', 2), bevel: edge, crown: [0.3, 0] });
    for (let t = pitch * 0.7; t < p.h; t += pitch) {
      const y = near + far * t;
      s.cut(rect(p.x + edge, y - 0.5, p.w - edge * 2, 1), { depth: 0.12, soft: 1.5 });
      s.cut(rect(cx - (sw * MM) / 2, y - (sh * MM) / 2, sw * MM, sh * MM, { radius: (sh * MM) / 2 }), { depth: 0.7, soft: 1 });
    }
    s.bend();
  },
});

// A metal bracelet, drawn flat and rolled over the cushion as a strap is. It runs from the case along
// its box, up the page, or down with `tail`, and narrows to `end` mm wide. `links` is `rows`, three pieces
// a row with the middle one half a link out of step, or `bars`, wide bars with a polished link across
// each joint. `pitch` is a link in mm, and `flat`, `roll` and `fall` are mm from the case end to the bend.
// `rise` is how high in mm the end link stands where it meets the case, curving down to the rest over its length.
// `fold` is a radius in mm: past `flat` it goes over that curve and away, its links shortening as they turn.
definePart({
  selector: '[d-watch~="bracelet"]',
  paint(s, p) {
    const far = p.el.hasAttribute('tail') ? 1 : -1, near = far > 0 ? p.y : p.y + p.h, cx = p.x + p.w / 2;
    const end = num(p, 'end', p.w / MM) * MM, pitch = num(p, 'pitch', 8) * MM, flat = num(p, 'flat', 8) * MM, fold = num(p, 'fold', 0) * MM;
    const roll = fold || num(p, 'roll', 26) * MM, long = fold ? flat + fold * GONE : p.h;
    // The end link fills the gap between the lugs, so it narrows only after its first link.
    const half = (t: number) => (p.w + ((end - p.w) * Math.max(t - pitch, 0)) / Math.max(long - pitch, 1)) / 2;
    // Where a point this far along the links lands on the page.
    const seen = (t: number) => near + far * (!fold || t < flat ? t : flat + fold * Math.sin((t - flat) / fold));
    // Between two distances from the case, and two places across it from -1 to 1.
    const piece = (t0: number, t1: number, a = -1, b = 1, r = 0.8) => poly([
      [cx + a * half(t0), seen(t0), r], [cx + b * half(t0), seen(t0), r], [cx + b * half(t1), seen(t1), r], [cx + a * half(t1), seen(t1), r],
    ], { spread: 8 });
    // A link is cut square down its sides and rolled over at the joints, so the roll goes along it and not round it.
    const satin = { ...BRUSHED, crown: [0, 0.45] as [number, number] };
    const away = { from: [cx, near + far * flat], to: [cx, near + far * (flat + roll)], drop: num(p, 'fall', fold ? fold / MM : FALL), rigid: !!fold } as const;
    // Up to `flat` it lies along the wrist, and with `rise` the end link curves up over its first link to meet the case,
    // as the start of an arc that would stand straight up a little way under it.
    const up = Math.max(num(p, 'rise', 0) - 2.1, 0), lift = Math.min(pitch, flat), over = lift / 0.7;
    const bed = up ? { from: [cx, near + far * lift], to: [cx, near + far * (lift - over)], drop: -up / (1 - Math.sqrt(1 - 0.49)), past: true } as const : undefined;
    // Whatever lies on the wrist takes the rise, and whatever reaches the bend goes over it.
    const lay = (t1: number) => s.bend(t1 <= flat ? bed : away);
    lay(flat);
    s.surface(piece(0, flat), { material: 'well', zEdge: -0.1, zTop: 0.5, bevel: 1 });
    s.bend(away);
    s.surface(piece(flat, long), { material: 'well', zEdge: -0.1, zTop: 0.5, bevel: 1 });
    const count = Math.ceil(long / pitch) + 1;
    if (p.el.getAttribute('links') === 'bars') {
      for (let i = 0; i < count; i++) {
        const t = i * pitch;
        if (t < long) s.surface(piece(t, Math.min(t + pitch - 1, long)), { ...satin, zEdge: 0.5, zTop: 1.7, bevel: 0.6 });
      }
      for (let i = 0; i < count; i++) {
        const t = i * pitch, tall = pitch * 0.6, y = seen(t), w = half(t), h = Math.abs(seen(t + tall / 2) - seen(t - tall / 2));
        if (t + tall / 2 > long) break;
        s.surface(rect(cx - w / 2 - 0.7, y - h / 2 - 0.7, w + 1.4, h + 1.4, { radius: 3 }), { material: 'well', bevel: 0.6, zEdge: 1.7, zTop: 0.9 });
        s.surface(rect(cx - w / 2, y - h / 2, w, h, { radius: 2.6 }), { material: 'polished-steel', bevel: 1.6, zEdge: 0.9, zTop: 2, crown: [0, 0.5] });
      }
      return;
    }
    // The end link is solid, but cut to carry the rows' three pieces right up to the case, so they start there.
    const band = MM * 1.1;
    for (let i = 0; i < count; i++) {
      const t = i * pitch;
      for (const [a, b] of [[-1, -0.47], [0.47, 1]] as const) {
        const to = Math.min(t + pitch - 0.8, long);
        if (t < long) lay(to).surface(piece(t, to, a, b, 0.4), { ...satin, zEdge: 0.5, zTop: 1.7, bevel: 0.5 });
      }
      const c = t + pitch / 2 - pitch;
      if (c >= long) continue;
      const from = Math.max(c, 0), to = Math.min(c + pitch - 0.8, long);
      lay(to).surface(piece(from, to, -0.44, 0.44, 0.4), { ...satin, zEdge: 0.5, zTop: 2.1, bevel: 0.5 });
      if (to - band > from) s.surface(piece(to - band, to, -0.44, 0.44, 0.4), { material: 'polished-steel', zEdge: 2.1, zTop: 2.1, bevel: 0.8 });
    }
  },
});

// One piece of steel: the barrel and whatever holds the strap. `path` and `viewbox` give its outline,
// or it's a round barrel with curved lugs. `height` is mm over what it sits on, `camber` how far the lugs
// fall along the wrist, and `polished` a bright edge in mm. `lugs` is the gap between them in mm, for a strap running up and
// down the page: the sides facing it are cut sharp and brushed to the edge. It's brushed round the dial, unless `lay` says otherwise.
definePart({
  selector: '[d-watch~="case"]',
  paint(s, p) {
    const k = p.w / (R * 2), cx = p.x + p.w / 2, cy = p.y + p.h / 2, d = p.el.getAttribute('path'), box = nums(p, 'viewbox', []) as [number, number, number, number];
    const rise = num(p, 'height', 6), edging = num(p, 'polished', 0) * MM, lay = layOf(p.el.getAttribute('lay'));
    const shape = d ? path(d, p.x, p.y, p.w, p.h, { viewBox: box, spread: 28 })
      : path(outline(CASE_LINE), cx - R * k, cy - TIP * k, R * 2 * k, TIP * 2 * k, { viewBox: [-R, -TIP, R * 2, TIP * 2], spread: 28 });
    const form = { zEdge: -0.4, zTop: rise, crown: [0, num(p, 'camber', 5)] as [number, number] };
    const steel = { material: 'satin-steel', radial: lay.tangent === undefined, over: lay };
    if (edging) {
      // The polish is a band along the top. Its edge turns over sharply and the sides drop sheer, so whatever butts up to them sits flush.
      s.surface(shape, { ...form, material: 'polished-steel', bevel: Math.min(edging, MM * 0.3) });
      const top = { ...steel, zEdge: rise, zTop: rise, profile: 'flat', crown: form.crown } as const, gap = num(p, 'lugs', 0) * MM / 2 + edging;
      s.surface(grow(shape, -edging * 0.8), top);
      if (gap > edging) s.surface(intersect(shape, rect(cx - gap, p.y, gap * 2, p.h)), top);
    } else s.surface(shape, { ...form, ...steel, bevel: R * 0.2 * k });
    seated(p, seatOf(p) + rise);
  },
});

/** The wall down from a bezel to the dial in its `opening`, and the floor it offers what's nested in it. */
const wall = (s: Sheet, p: Part, top: number) => {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, [ow = 0, oh = ow] = nums(p, 'opening', [p.w / MM * 0.8]), n = num(p, 'inner', 2), by = num(p, 'wall', 1) * MM, floor = num(p, 'floor', -2.9);
  s.surface(rounded(cx, cy, ow * MM + by * 2, oh * MM + by * 2, n), {
    material: p.el.getAttribute('wall-material') || 'satin-steel', radial: !p.el.hasAttribute('wall-material'), profile: 'chamfer', bevel: by, zEdge: top, zTop: floor,
  });
  seated(p, seatOf(p) + floor);
};

// A bezel that stays put. `square` rounds it off a square, 2 being a circle, and `inner` does the same for
// the `opening` in it, in mm. `height`, `floor` for how far the dial lies below what it sits on, `wall` for the
// slope down to it, `edge` for a polished edge in mm, `flat` to cut that edge straight and not round it, and `top`
// for a flat band of some material inside that. `material` is the bezel itself, polished steel unless it says.
definePart({
  selector: '[d-watch~="bezel"]',
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, rise = num(p, 'height', 2.5), by = num(p, 'edge', 2.55) * MM, band = p.el.getAttribute('top');
    const shape = rounded(cx, cy, p.w, p.h, num(p, 'square', 2));
    s.surface(shape, { material: p.el.getAttribute('material') || 'polished-steel', profile: p.el.hasAttribute('flat') ? 'chamfer' : 'round', bevel: by, zEdge: -0.2, zTop: rise });
    if (band) s.surface(grow(shape, -by), { material: band, profile: 'flat', zEdge: rise, zTop: rise, over: BRUSHED.over });
    wall(s, p, rise);
  },
});

/** A timing bezel goes back only: knock it and it can only show more time gone. */
const timing = turn({
  mass: 9, material: 'steel-on-steel', hubless: true, ratchet: -1, sound: 'bezel',
  detents: { every: p => 360 / num(p, 'clicks', 120), strength: 0.7 },
  accepts(p, e) {
    const r = p.el.getBoundingClientRect(), k = r.width / p.w || 1, [ow = 0] = nums(p, 'opening', [p.w / MM * 0.8]);
    return Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) / k > (ow * MM) / 2;
  },
});

// How far a timing bezel's insert falls from its rim to the glass, mm. Guess.
const SLOPE = 0.55;

// A bezel with a coin edge and a printed insert of minutes, that clicks round one way only. `clicks` is
// how many times to the turn, `teeth` how many scoops are cut round its edge, `material` the insert, and the rest
// as for `d-watch="bezel"`. Drawn at 41mm and scaled.
definePart({
  selector: '[d-watch~="turnbezel"]',
  ...timing,
  live: [...timing.live, 'ready'],
  connect(p) {
    lettered(p);
    return timing.connect(p);
  },
  paint(s, p) {
    const rise = num(p, 'height', 2.2), teeth = num(p, 'teeth', 60), font = p.el.hasAttribute('ready') ? SCALE : '500 15px sans-serif';
    const metal = { depth: 0.08, ink: [0.6, 0.6, 0.58] as Vec3, metal: 1, rough: 0.34 };
    s.group({ ...timing.place(p), scale: p.w / 164 }, () => {
      // The scoops are round cups cut into the slope of a rounded rim, with a flat land left between each, so the floor
      // of each cup is still polished steel, a little lower down.
      s.surface(circle(0, 0, 81.3), { material: 'polished-steel', bevel: 3, zEdge: -0.2, zTop: rise - 0.7 });
      s.surface(circle(0, 0, 82, { scoop: [teeth, 3] }), { material: 'polished-steel', bevel: 1.4, zEdge: rise - 0.7, zTop: rise });
      // The insert is a shallow cone, falling toward the glass. A dish falls a third of its depth across the insert, so this one falls SLOPE.
      s.surface(circle(0, 0, 78.4), { material: p.el.getAttribute('material') || 'ceramic-black', over: { coat: 0.3 }, bevel: 4, zEdge: rise - 0.1, zTop: rise + 0.3, dish: SLOPE * 2.9 });
      for (let i = 1; i < 60; i++) {
        const a = (i / 60) * TAU, big = i % 5 === 0;
        if (i % 10 === 0) {
          const [x, y] = polar(0, 0, 70, a);
          s.cut(text(String(i), x - 14, y - 9, 28, 18, { font, rotate: a }), metal);
        } else if (big || i < 15) {
          const l = big ? 11 : 7, w = big ? 3.2 : 1.3, [x, y] = polar(0, 0, big ? 70 : 71.5, a);
          s.cut(rect(x - w / 2, y - l / 2, w, l, { rotate: a, radius: 0.3 }), metal);
        }
      }
      s.cut(poly([[-7, -76.4, 0.6], [7, -76.4, 0.6], [0, -63.6, 0.6]]), metal);
      s.surface(circle(0, -72, 3.6), { material: 'polished-steel', bevel: 1, zEdge: rise + 0.3, zTop: rise + 0.5 });
      s.surface(circle(0, -72, 2.8), { material: 'lume', profile: 'dome', zEdge: rise + 0.35, zTop: rise + 0.6 });
    });
    wall(s, p, rise - SLOPE);
    if (p.focused) s.glow(circle(p.x + p.w / 2, p.y + p.h / 2, p.w / 2 + 2), FOCUS);
  },
});

// How many units a dial is across, whatever its size.
const DIAL = 206, D = DIAL / 2;
const silver: Vec3 = [0.75, 0.75, 0.72];

// A hour marker standing on the dial: a bar of metal, with lume let into it if `lume` is set.
const baton = (s: Sheet, x: number, y: number, a: number, w: number, l: number, lume: boolean) => {
  s.surface(rect(x - w / 2, y - l / 2, w, l, { rotate: a, radius: 0.6 }), { material: 'polished-steel', profile: 'chamfer', bevel: lume ? 1.2 : w / 2, zEdge: 0, zTop: 0.5 });
  if (lume) s.surface(rect(x - w / 2 + 1.5, y - l / 2 + 1.5, w - 3, l - 3, { rotate: a, radius: 0.5 }), { material: 'lume', profile: 'flat', zEdge: 0.3, zTop: 0.3 });
};

// A dial, the shape of the opening it lies in. `square` as for a bezel. `markers` is `batons`, with `index`
// their length and width as units of 206 across and `skip` the hours left out, `round`, with a triangle at 12 and
// bars at 6 and 9, or `none`. `track` is `ticks`, `beads` or `none`, for a dial whose scales are printed on it by `d-mark="scale"`. `date` is the hour a date window sits at, `date-at` how
// far out from 0 to 1, `date-size` how big it's cut. `ribs` is the pitch in mm of embossed lines across it, `bright` a colour shading out from
// the middle over a `material` that's darker, and `registers` adds two small dials. What's nested in it sits on it.
definePart({
  selector: '[d-watch~="dial"]',
  live: ['ready'],
  connect: lettered,
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, n = num(p, 'square', 2), material = p.el.getAttribute('material') || 'dial-silver';
    const ink = legendColor(material), kind = p.el.getAttribute('markers') || 'batons', lume = p.el.hasAttribute('lume'), bright = p.el.getAttribute('bright');
    const rim = (a: number) => D * edge(a, n), skip = nums(p, 'skip', []), ribs = num(p, 'ribs', 0), date = num(p, 'date', 0), [l = 22, w = 5.6] = nums(p, 'index', []);
    s.surface(rounded(cx, cy, p.w, p.h, n), { material, radial: p.el.hasAttribute('radial'), profile: 'flat', zEdge: 0, zTop: 0 });
    seated(p, seatOf(p));
    s.group({ at: [cx, cy], scale: p.w / DIAL }, () => {
      if (bright) s.cut(rounded(0, 0, DIAL * 1.12, DIAL * 1.12, n), { ink: linear(bright), feather: D * 1.04, metal: 0.8, rough: 0.36 });
      if (ribs) {
        const pitch = (ribs * MM * DIAL) / p.w;
        for (let y = pitch / 2 - D; y < D; y += pitch) {
          const half = D * (1 - Math.abs(y / D) ** n) ** (1 / n);
          s.cut(rect(-half, y - pitch * 0.09, half * 2, pitch * 0.18), { depth: 0.05, soft: 0.8 });
        }
      }
      const track = p.el.getAttribute('track'), beads = track === 'beads';
      if (track !== 'none') for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU, big = i % 5 === 0, t = big ? 6 : 3.6, [x, y] = polar(0, 0, rim(a) - 3 - t / 2, a);
        if (beads) s.cut(circle(x, y, 0.8), { ink });
        else s.cut(rect(x - (big ? 0.8 : 0.4), y - t / 2, big ? 1.6 : 0.8, t, { rotate: a }), { ink });
      }
      if (kind !== 'none') for (let i = 0; i < 12; i++) {
        if (skip.includes(i || 12)) continue;
        const a = (i / 12) * TAU;
        if (kind === 'round') {
          const [x, y] = polar(0, 0, 79, a), metal = { material: 'polished-steel', bevel: 0.8, zEdge: 0, zTop: 0.4 }, paint = { material: 'lume', profile: 'dome' as const, zEdge: 0.2, zTop: 0.55 };
          if (!i) {
            s.surface(poly([[-11, -86, 1], [11, -86, 1], [0, -59, 1]]), metal);
            s.surface(poly([[-8.8, -84.6, 0.6], [8.8, -84.6, 0.6], [0, -63, 0.6]]), { ...paint, profile: 'flat', zTop: 0.3, zEdge: 0.3 });
          } else if (i % 3 === 0) {
            baton(s, x, y, a, 8, 24, true);
          } else {
            s.surface(circle(x, y, 6.6), metal);
            s.surface(circle(x, y, 5.4), paint);
          }
          continue;
        }
        const [x, y] = polar(0, 0, rim(a) - 11 - l / 2, a);
        for (const off of i ? [0] : [-w * 0.78, w * 0.78]) baton(s, x + Math.cos(a) * off, y + Math.sin(a) * off, a, w, l, lume);
      }
      if (p.el.hasAttribute('registers')) for (const sx of [-1, 1]) {
        const x = sx * 50, r = 30, steps = sx < 0 ? 60 : 30;
        s.surface(circle(x, 0, r + 2.6), { material: 'polished-steel', bevel: 2.4, zEdge: -0.1, zTop: 0.3 });
        s.surface(circle(x, 0, r), { material: 'dial-lacquer', profile: 'chamfer', bevel: 1.6, zEdge: 0.3, zTop: -0.5 });
        for (let e = 8; e < r - 6; e += 2.2) {
          s.cut(circle(x, 0, e + 0.35), { depth: 0.03, ink: [0.05, 0.05, 0.055], rough: 0.4 });
          s.cut(circle(x, 0, e - 0.35), { ink: [0.008, 0.008, 0.009], rough: 0.25 });
        }
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * TAU, big = i % 5 === 0, t = big ? 4.4 : 2.4, [tx, ty] = polar(x, 0, r - 2 - t / 2, a);
          s.cut(rect(tx - (big ? 0.6 : 0.3), ty - t / 2, big ? 1.2 : 0.6, t, { rotate: a }), { ink: silver });
        }
      }
      if (date) {
        const [x, y] = polar(0, 0, num(p, 'date-at', 0.61) * D, (date / 12) * TAU), font = p.el.hasAttribute('ready') ? DATE : '600 12px sans-serif';
        s.group({ at: [x, y], scale: num(p, 'date-size', 1) }, () => {
          s.surface(rect(-12, -9, 24, 18, { radius: 1 }), { material: 'dial-ivory', profile: 'chamfer', bevel: 1, zEdge: 0, zTop: -0.9 });
          s.cut(text(String(new Date().getDate()), -12, -8, 24, 18, { font }), { ink: [0.02, 0.02, 0.022] });
        });
      }
    });
  },
});

const needle = { material: 'polished-steel', bevel: 0.7 };

// Hands for telling the time: `spoke`, with a lume-filled wheel on the hour hand and a tapered minute hand,
// or `baton`, both bars with lume down them. A tenth of `w` is one unit of a hand's width.
const TELLING = {
  spoke(s: Sheet) {
    const steel = { material: 'polished-steel', bevel: 0.8, zEdge: 0.5, zTop: 1 };
    s.surface(poly([[-1.6, 9, 0.4], [1.6, 9, 0.4], [1.4, -22, 0.2], [3.8, -25, 0.2], [0, -33, 0.2], [-3.8, -25, 0.2], [-1.4, -22, 0.2]]), steel);
    s.surface(circle(0, -20, 7.2), steel);
    s.surface(circle(0, -20, 5.8), { material: 'lume', profile: 'flat', zEdge: 0.9, zTop: 0.9 });
    for (const a of [0, TAU / 3, (2 * TAU) / 3]) {
      const [x, y] = polar(0, -20, 3, a);
      s.surface(rect(x - 0.6, y - 3.2, 1.2, 6.4, { rotate: a }), { ...steel, zEdge: 0.95, zTop: 1 });
    }
    s.surface(rect(-1, -12, 2, 8), { material: 'lume', profile: 'flat', zEdge: 0.9, zTop: 0.9 });
  },
  spokeMinute(s: Sheet) {
    s.surface(poly([[-1.5, 9, 0.3], [1.5, 9, 0.3], [2.3, -38, 0.2], [0, -47, 0.2], [-2.3, -38, 0.2]]), { material: 'polished-steel', bevel: 0.8, zEdge: 1.1, zTop: 1.5 });
    s.surface(poly([[-0.9, -7, 0.2], [0.9, -7, 0.2], [1.4, -38, 0.2], [-1.4, -38, 0.2]]), { material: 'lume', profile: 'flat', zEdge: 1.45, zTop: 1.45 });
  },
  baton(s: Sheet, len: number, z: number) {
    s.surface(rect(-2.4, -len, 4.8, len + 7, { radius: 2.2 }), { material: 'polished-steel', bevel: 0.8, zEdge: z, zTop: z + 0.4 });
    s.surface(rect(-1.4, -len + 1.4, 2.8, len - 9, { radius: 1.2 }), { material: 'lume', profile: 'flat', zEdge: z + 0.35, zTop: z + 0.35 });
  },
};

const kindOf = (p: Part) => words(p, 'd-watch')[1];

// A stopwatch's balance: 18,000 beats an hour, and each is one click of the escapement.
const BEATS = 5;
const ESCAPEMENT = mechanism({ mass: 0.5, material: 'brass-on-steel' }, 'turn');
// How hard one beat lands, in detents a second, which is how sound reads it. Guess, by ear off the crown's own clip.
const TICK = 12;
const stopping = (p: Part) => kindOf(p) === 'stop';

// Hands on real heights above the dial, which follow the clock. `d-watch="hands spoke"` or `hands baton` tell the time, and the
// seconds sweep at eight beats a second. Without one they're a chronograph's: blued, with a red hand and
// two small registers, driven by `since` and `spent`. `offset` is minutes ahead of the clock.
// `hands stop` are a stopwatch's, also driven by `since` and `spent`: no time of day, just a long hand that beats five times a second, ticking as it
// goes, and a small one on a register. `lap` is seconds for the long hand's turn, `minutes` minutes for the small hand's, and `register` where that one's
// centre is, `x y` in mm from the long hand's. The box is the sweep of the long hand's tip, and `reach` the small hand in mm. With neither `since` nor `spent` they fly back by the short way, as a heart cam sends them.
definePart({
  selector: '[d-watch~="hands"]',
  options: ['spoke', 'baton', 'stop'],
  live: ['offset', 'since', 'spent'],
  springs: {
    h: spring({ mass: 1, return: 0.011, friction: 0.63 }), m: spring({ mass: 1, return: 0.011, friction: 0.63 }), s: spring({ mass: 0.1, return: 0.033, friction: 0.04 }),
    c: spring({ mass: 0.1, return: 0.022, friction: 0.15 }), r: spring({ mass: 0.1, return: 0.022, friction: 0.15 }),
  },
  update(p) {
    if (stopping(p)) {
      const since = +(p.el.getAttribute('since') ?? 0), spent = +(p.el.getAttribute('spent') ?? 0) + (since ? Date.now() - since : 0);
      // The train only moves on a beat, so that's all the hands can show.
      const beat = Math.floor((spent / 1000) * BEATS), { c, r } = p.springs;
      if (since && beat !== p.data.beat && p.data.beat !== undefined) contact(p, 'detent', TICK, { motion: ESCAPEMENT });
      if (!beat && p.data.beat) for (const hand of [c!, r!]) hand.snap(((((hand.value + Math.PI) % TAU) + TAU) % TAU) - Math.PI);
      p.data.beat = beat;
      c!.set((beat / BEATS / num(p, 'lap', 60)) * TAU);
      r!.set((beat / BEATS / (num(p, 'minutes', 30) * 60)) * TAU);
      return;
    }
    const now = new Date(Date.now() + +(p.el.getAttribute('offset') ?? 0) * 60000);
    const sec = now.getSeconds(), min = now.getMinutes() + sec / 60, hour = (now.getHours() % 12) + min / 60;
    const last = (p.data.s ?? -1) as number, beat = kindOf(p) ? Math.floor(now.getMilliseconds() / 125) / 8 : 0;
    p.data.laps = ((p.data.laps ?? 0) as number) + (sec < last ? 1 : 0);
    p.data.s = sec;
    p.springs.h!.set((hour / 12) * TAU);
    p.springs.m!.set((min / 60) * TAU);
    p.springs.s!.set(((sec + beat + 60 * (p.data.laps as number)) / 60) * TAU);
    const since = +(p.el.getAttribute('since') ?? 0), spent = +(p.el.getAttribute('spent') ?? 0) + (since ? Date.now() - since : 0);
    p.springs.c!.set((spent / 60000) * TAU);
    p.springs.r!.set((spent / 1800000) * TAU);
  },
  connect(p) {
    // A running hand beats eight times a second, and the rest of the time once is enough.
    let beat = 0;
    // A stopwatch's hands are only as late as this on a beat. They ask often, and only move when one has passed.
    if (stopping(p)) {
      const id = setInterval(() => {
        if (p.el.hasAttribute('since')) p.def.update!(p);
      }, 20);
      return () => clearInterval(id);
    }
    const id = setInterval(() => {
      beat = (beat + 1) % 8;
      if (!beat || p.el.hasAttribute('since') || kindOf(p)) p.def.update!(p);
    }, 125);
    return () => clearInterval(id);
  },
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, kind = kindOf(p);
    const { h, m, s: sec, c, r } = p.springs;
    if (kind === 'stop') {
      const paint = { material: p.el.getAttribute('material') || 'black-oxide', bevel: 0.5, profile: 'chamfer' as const }, [rx = 0, ry = 0] = nums(p, 'register', []);
      // Wide at the hub and running out to a needle. Mm, from the pin.
      const blade = (len: number, wide: number, narrow: number, tail: number) => poly([[-wide / 2, tail, 0.2], [wide / 2, tail, 0.2], [narrow * 0.6, -len * 0.22, 0], [narrow / 2, -len, 0], [-narrow / 2, -len, 0], [-narrow * 0.6, -len * 0.22, 0]].map(([x, y, q]) => [x! * MM, y! * MM, q!] as [number, number, number]), { spread: 3 });
      const hub = (d: number, top: number) => {
        s.surface(circle(0, 0, (d / 2) * MM), { ...paint, profile: 'dome', zEdge: top - 0.5, zTop: top });
        s.surface(circle(0, 0, 0.4 * MM), { material: 'polished-steel', profile: 'dome', bevel: 0.6, zEdge: top, zTop: top + 0.25 });
      };
      if (rx || ry) s.group({ at: [cx + rx * MM, cy + ry * MM], rotate: r!.value }, () => {
        s.surface(blade(num(p, 'reach', 6.6), 0.8, 0.25, 0.8), { ...paint, zEdge: 0.5, zTop: 0.8 });
        hub(2.6, 1.1);
      });
      s.group({ at: [cx, cy], rotate: c!.value }, () => {
        s.surface(blade(p.w / 2 / MM, 1.1, 0.25, 1), { ...paint, zEdge: 1.2, zTop: 1.5 });
        hub(3.4, 1.9);
      });
      return;
    }
    if (kind) {
      const at = (rotate: number, draw: () => void) => s.group({ at: [cx, cy], rotate, scale: p.w / 100 }, draw);
      at(h!.value, () => (kind === 'spoke' ? TELLING.spoke(s) : TELLING.baton(s, 33, 0.5)));
      at(m!.value, () => (kind === 'spoke' ? TELLING.spokeMinute(s) : TELLING.baton(s, 46, 1.1)));
      at(sec!.value, () => {
        s.surface(rect(-0.45, -47, 0.9, 62, { radius: 0.4 }), { ...needle, bevel: 0.4, zEdge: 1.6, zTop: 1.8 });
        if (kind === 'spoke') {
          s.surface(circle(0, -31, 3.2), { ...needle, zEdge: 1.6, zTop: 1.85 });
          s.surface(circle(0, -31, 2.2), { material: 'lume', profile: 'flat', zEdge: 1.85, zTop: 1.85 });
        }
      });
      at(0, () => s.surface(circle(0, 0, 2.6), { ...needle, profile: 'dome', zEdge: 1.7, zTop: 2.1 }));
      return;
    }
    const R = 112, D = R - 9, blued = { material: 'blued-steel', profile: 'chamfer' as const };
    s.group({ at: [cx, cy], scale: p.w / (R * 2) }, () => {
      s.surface(hand(-50, 0, sec!.value, 23, 6, 1.8), { ...needle, zEdge: 0, zTop: 0.5 });
      s.surface(circle(-50, 0, 2.6), { ...needle, profile: 'dome', zEdge: 0.4, zTop: 0.9 });
      s.surface(hand(50, 0, r!.value, 23, 6, 1.8), { ...needle, zEdge: 0, zTop: 0.5 });
      s.surface(circle(50, 0, 2.6), { ...needle, profile: 'dome', zEdge: 0.4, zTop: 0.9 });
      s.surface(leaf(0, 0, h!.value, 58, 12, 12), { ...blued, bevel: 6, zEdge: 0.9, zTop: 1.7 });
      s.surface(leaf(0, 0, m!.value, 90, 14, 9.6), { ...blued, bevel: 4.8, zEdge: 1.8, zTop: 2.5 });
      s.surface(circle(0, 0, 6.5), { material: 'blued-steel', profile: 'dome', zEdge: 2.5, zTop: 3.1 });
      s.surface(hand(0, 0, c!.value, D - 5, 26, 1.5), { material: 'needle', bevel: 0.6, zEdge: 3.1, zTop: 3.4, over: { color: '#c23a1c', rough: 0.3 } });
      s.surface(circle(0, 0, 3), { material: 'polished-steel', profile: 'dome', zEdge: 3.3, zTop: 3.8 });
    });
  },
});

// A crystal over everything so far, the shape of its box, or `path` in `viewbox`. `square` as for a bezel. `material` is what it's made of, `mineral-glass` unless
// it's `sapphire` or `acrylic`, which sets how much it reflects. `coat` is how much less it shines if it's bloomed. `chamfer` is the cut round its top edge,
// `width angle` in mm and degrees, which is what shows a flat crystal is there. `lens` is a small magnifier on it, as `x y w h` in mm from its middle, and `zoom` how strong that is.
definePart({
  selector: '[d-glass~="cover"]',
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, [x, y, w = 0, h = 0] = nums(p, 'lens', []);
    const flat = p.el.hasAttribute('flat'), d = p.el.getAttribute('path'), box = nums(p, 'viewbox', []) as [number, number, number, number];
    s.glass(d ? path(d, p.x, p.y, p.w, p.h, { viewBox: box, spread: 8 }) : rounded(cx, cy, p.w, p.h, num(p, 'square', 2)), { height: 1, bevel: flat ? MM * 0.5 : R * 0.9, curve: flat ? 0 : 0.46, rim: flat ? 0.4 : 0.9, coat: num(p, 'coat', 1),
      chamfer: nums(p, 'chamfer', [0, 0]) as [number, number], material: p.el.getAttribute('material') || 'mineral-glass' });
    if (w) s.frost(rect(cx + (x! - w / 2) * MM, cy + (y! - h / 2) * MM, w * MM, h * MM, { radius: MM * 1.4 }), {
      blur: 0, opacity: 0, zoom: num(p, 'zoom', 2.5), zEdge: 1, zTop: 1.9, bevel: MM * 1.5, rough: 0.1, coat: 1,
    });
  },
});

// How far a crown turns across its range, in degrees.
const CROWN = 120 * 180 / Math.PI;

// Mm a crown comes out from one position to the next, as from winding to setting the time. A guess.
const PULL = 1.2;
// How many positions a crown pulls out to, counting pushed in, from its second input.
const positions = (p: Part) => {
  const pos = p.el.querySelectorAll('input')[1];
  return pos ? Math.round((+pos.max - +pos.min) / (+pos.step || 1)) + 1 : 1;
};
const pulled = slide({ input: 1, name: 'pull', axis: 'x', travel: p => PULL * (positions(p) - 1), mass: 2, material: 'steel-on-steel', detents: true, stops: { landing: 'hard' } });
// A screw-down crown's checkbox, which is ticked while it's screwed to the case.
const screwBox = (p: Part) => [...p.el.querySelectorAll('input')].findIndex(el => el.type === 'checkbox');
// Mm a crown's tube thread goes in a turn, and the turns from catching it to screwed home. Both guesses.
const PITCH = 0.35, SCREW_TURNS = 2;
const screwed = thread({
  pitch: PITCH, turns: SCREW_TURNS, input: screwBox, mass: 2, material: 'steel-on-steel',
  locks: p => (positions(p) > 1 ? [1] : []),
  // Only pushed in against its spring, at the first position, as a hand screws one down. Turned without that, it winds.
  catches: p => positions(p) > 1 && +p.el.querySelectorAll('input')[1]!.value === 0 && ((p.data['pull:pull'] as number | undefined) ?? 0) < 0,
});
const screws = (p: Part) => screwBox(p) >= 0;
const crowned = turn({
  mass: 2, material: 'brass-on-steel', sound: 'crown', input: true, rolled: true, stops: { at: [0, CROWN] },
  // Rolled under a finger, so its flutes stay under it: a radian is a radius of hand.
  travel: p => CROWN * (Math.PI / 180) * (p.h / 2),
  hold: (p, radians) => screws(p) && screwed.hold(p, radians),
});

// A knurled crown seen from above, standing out of the case at three o'clock. Drag it up or down to turn it, and out or in to pull it to its positions.
// The first input is what turning it sets, and the second where it's pulled to, from 0 pushed in: `max="2"` for a crown that winds, sets the date and sets the time.
// A checkbox after them makes it screw down: ticked, it's screwed to the case and can't be pulled. Turn it back to unscrew it, and it springs out
// to winding. To screw it down again, push it in as you turn it on.
definePart({
  selector: '[d-wheel~="crown"]',
  ...together(crowned, pulled, screwed),
  live: crowned.live,
  // Without a second input it only turns.
  update(p) {
    crowned.update(p);
    if (positions(p) > 1) pulled.update(p);
    if (screws(p)) screwed.update(p);
  },
  connect(p) {
    const off = [crowned.connect(p), positions(p) > 1 ? pulled.connect(p) : undefined, screws(p) ? screwed.connect(p) : undefined];
    return () => off.forEach(f => f?.());
  },
  paint(s, p) {
    const deep = screws(p) ? screwed.depth(p) : 0, roll = p.springs.turn!.value + (screws(p) ? screwed.angle(p) : 0);
    const out = (PULL * (positions(p) - 1) * pulled.value(p) - deep) * MM, x = p.x + out, cy = p.y + p.h / 2, hh = p.h / 2, k = p.h / 52;
    // The stem stays in the case, so it shows between the case and the crown as it comes out.
    s.surface(rect(p.x - 14 * k, cy - 8 * k, 18 * k + out, 16 * k), { material: 'satin-steel', profile: 'flat', zEdge: 0.6 * k, zTop: 5 * k, crown: [0, 4.2 * k] });
    // A barrel is a flat sheet rolled up. The flutes are evenly spaced on it, and the bend does the rest.
    const cx = x + p.w / 2, round = hh * Math.PI;
    s.bend({ from: [cx, cy], to: [cx, cy + hh], mirror: [cx, cy] });
    s.surface(rect(x, cy - round / 2 - 3, p.w, round + 6, { radius: 3 }), { material: 'satin-steel', bevel: 2.4 * k, zEdge: -0.2, zTop: 7.4 * k, over: { tangent: 0 } });
    const n = num(p, 'flutes', 26);
    for (let i = 0; i < n; i++) {
      const y = (((((i / n) * TAU + roll) % TAU) + TAU * 1.5) % TAU - Math.PI) * hh;
      if (Math.abs(y) < round / 2) s.cut(rect(x + 3 * k, cy + y - 0.9 * k, p.w - 6 * k, 1.8 * k), { depth: 0.55 * k, soft: 0.8 * k });
    }
    s.bend();
    if (p.focused) s.glow(rect(x - 2, p.y - 2, p.w + 4, p.h + 4, { radius: 6 }), FOCUS);
  },
});

// A short round pusher in the side of the case, pointing along `rot` from its box's left edge and middle, or for a pin from the edge it leaves by. Set `size`, its width in mm, and `out`, how far it stands in mm, for a plain pin.
// Or a stem with a head on it, lying along `rot` through the middle of its box: `stem` and `head` are each `across long` in mm, `band` is `long colour` round the head's waist and `at` how far
// up the head it starts in mm, `flutes` how many are cut round the head, `travel` how far it goes in, in mm. `material` is what it's made of.
definePart(key('[d-key~="pusher"]', {
  feel: { mass: 4.6, material: 'brass-on-steel' },
  label: false,
  draw(s, p, _d, k) {
    const rot = +(p.el.getAttribute('rot') ?? 0) * (Math.PI / 180), size = num(p, 'size', 0) * MM, stands = num(p, 'out', 0) * MM;
    const dx = Math.cos(rot), dy = Math.sin(rot), cx = size && dx < 0 ? p.x + p.w : p.x, cy = p.y + p.h / 2;
    const bar = (at: number, w: number, h: number, r = 2) => rect(cx + dx * at - w / 2, cy + dy * at - h / 2, w, h, { rotate: rot, radius: r });
    const stem = nums(p, 'stem', []);
    if (stem.length) {
      const [sd = 3, sl = 3] = stem, [hd = sd * 1.5, hl = sd] = nums(p, 'head', []), [bl, ink] = (p.el.getAttribute('band') ?? '').trim().split(/\s+/);
      const material = p.el.getAttribute('material') || 'chrome', band = +(bl || 0), at = num(p, 'at', (hl - band) / 2), flutes = num(p, 'flutes', 0);
      const box = Math.hypot(p.w, p.h);
      // A round bar lying on what it stands from, as far up as it is wide.
      const bar = (x: number, len: number, d: number, m: string, over?: { color: string }) => s.surface(rect(x * MM, (-d / 2) * MM, len * MM, d * MM, { radius: (d / 8) * MM }), { material: m, over, bevel: 0.7, zEdge: 0, zTop: d, crown: [0, d * 0.75] });
      const start = -(sl + hl) / 2 - num(p, 'travel', 1) * k.down;
      s.group({ at: [p.x + p.w / 2, cy], rotate: rot }, () => {
        bar(start - 2, sl + 2.4, sd, material);
        const head = start + sl, knurl = (x: number, len: number) => {
          bar(x, len, hd, material);
          for (let i = 0; i < flutes; i++) {
            const y = Math.cos(((i + 0.5) / flutes) * TAU) * (hd / 2), w = Math.max(Math.abs(Math.sin(((i + 0.5) / flutes) * TAU)) * 0.28, 0.06);
            if (Math.sin(((i + 0.5) / flutes) * TAU) > 0) s.cut(rect((x + 0.1) * MM, (y - w / 2) * MM, (len - 0.2) * MM, w * MM), { depth: 0.12, soft: 0.5 });
          }
        };
        if (band) bar(head + at - 0.1, band + 0.2, hd * 0.82, 'plastic-black', ink ? { color: ink } : undefined);
        if (at > 0) knurl(head, at);
        knurl(head + at + band, hl - at - band);
      });
      k.focus(circle(p.x + p.w / 2, cy, box / 2 + 1));
      return;
    }
    if (size) {
      const pin = stands * (1 - 0.5 * k.down);
      s.surface(bar(pin / 2 - size * 0.5, pin + size, size, size * 0.14), { material: 'satin-steel', profile: 'flat', zEdge: 0.6, zTop: 2.4, crown: [0, 1.6], over: { tangent: 0 } });
      s.cut(bar(pin * 0.42, 0.5, size), { depth: 0.2, soft: 0.6 });
      k.focus(rect(p.x - 2, p.y - 2, p.w + 4, p.h + 4, { radius: 6 }));
      return;
    }
    const out = 20 - 6 * k.down;
    s.surface(bar(out / 2, out + 4, 10), { material: 'polished-steel', profile: 'flat', zEdge: 0.6, zTop: 5.4, crown: [0, 4.4] });
    s.surface(bar(out + 2, 14, 19), { material: 'satin-steel', bevel: 2, zEdge: 0, zTop: 6.2, crown: [0, 5.6], over: { tangent: 0 } });
    k.focus(rect(p.x - 2, p.y - 2, p.w + 4, p.h + 4, { radius: 6 }));
  },
}));
