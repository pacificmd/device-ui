// The knob: one part built from its anatomy. A form is the body, its section from the side, and everything else is
// an option every form takes: how its side grips, what its top is, what shows where it points, and how it turns.
import { arc, capsule, circle, definePart, defineStyles, FOCUS, legendColor, linear, mask, MM, path, rect, resolveMaterial, ring, turn, type DeviceInfo, type Part, type PartDef, type Profile, type Sheet, type TurnOptions, type Vec3 } from 'device-ui';
import { gripped, GRIPS, indicator, isGrip, isIndicator, overhang, printRing, seat, type Grip, type Indicator } from './anatomy.js';
import { controlStyles, font, ground, lamp, num, polar, scale } from './shared.js';

/** What a knob's top is. `spun` is a disc of metal let in and spun in circles; `cap` a coloured cap pressed on. */
type Top = 'flat' | 'spun' | 'cap' | 'dished' | 'domed';
const TOPS: Top[] = ['flat', 'spun', 'cap', 'dished', 'domed'];

/** A body, and what it comes with unless the markup says. Sizes are mm, or a share of the knob's diameter where it says. */
interface Body {
  material: string;
  grip: Grip;
  top: Top;
  mark: Indicator | 'skirt';
  /** Mm, base to top. */
  height: number;
  /** Its skirt: none, a flat disc, or a cone rising to the body. */
  skirt: 'none' | 'flat' | 'cone';
  /** The body's diameter where it meets the skirt, as a share of the whole knob's. */
  body: number;
  /** Degrees its side leans in, as the draft of a moulded one does. */
  taper: number;
  /** Mm of the top edge's round or chamfer, and which. */
  edge: number;
  profile: Profile;
  /** How many ticks it prints round itself, and over what. */
  ticks: number;
  sweep: number;
  /** Ribs in place of what its grip's pitch gives. */
  ribs?: number;
  /** What the top's disc or cap is. */
  cap?: string;
}

const BASE: Body = {
  material: 'plastic-black', grip: 'smooth', top: 'flat', mark: 'line', height: 12, skirt: 'none', body: 1, taper: 0, edge: 0.6, profile: 'round',  ticks: 0, sweep: 135,
};

// Each body from photos of catalogue knobs, with what it comes with. Every size is a guess unless it says.
// A plain straight-sided moulded knob with a chamfered top, as on a deck or a radio.
const CAP: Body = { ...BASE, material: 'keycap-grey', mark: 'none', height: 6, edge: 1.5, profile: 'chamfer' };
// An instrument knob over a thin flat skirt, with a top let in.
const SKIRT: Body = { ...BASE, grip: 'fluted', top: 'spun', mark: 'skirt', height: 14, skirt: 'flat', body: 0.72, taper: 2, edge: 0.5, sweep: 150 };
// The plain knob is that, turned from aluminium and over its own scale.
const PLAIN: Body = { ...SKIRT, material: 'brushed-aluminium', grip: 'ribbed', mark: 'line', height: 13, body: 0.84, ticks: 11, sweep: 135 };
// A tapered soft-touch body with a coloured cap pressed on, held to its shaft by a collet.
const COLLET: Body = { ...BASE, grip: 'ribbed', top: 'cap', cap: 'keycap-grey', height: 15, taper: 6, edge: 0.8 };
// A fluted body flaring into a cone at its foot, as on a drum machine.
const FLARED: Body = { ...BASE, grip: 'fluted', height: 8, skirt: 'cone', body: 0.84, edge: 0.8, profile: 'chamfer', sweep: 150, ticks: 11 };
// A slim ribbed stem with a domed top and a slot across it, on an endless encoder.
const STEM: Body = { ...BASE, material: 'plastic-white', grip: 'ribbed', ribs: 20, top: 'domed', mark: 'slot', height: 9, body: 0.44, edge: 1.4 };
// A bar across a round foot, to point with and turn by its ends.
const BAR: Body = { ...BASE, height: 12, skirt: 'flat', body: 0.34, edge: 1.2, sweep: 150 };

// How each shaft turns.
const POT: TurnOptions = { mass: 15, material: 'metal-on-grease', input: true, travel: 220 };
const ENDLESS: TurnOptions = { mass: 5, material: 'plastic-on-plastic', input: true, wrap: true, detents: true, stops: { at: [0, 360] }, travel: 300 };

const words = (p: Part) => (p.el.getAttribute('d-knob') ?? '').trim().split(/\s+/);
const attr = (p: Part, name: string) => p.el.getAttribute(name);
const labelsOf = (p: Part) => attr(p, 'labels')?.split(',').map(t => t.trim()) ?? [];

/** The knob as this element asks for it. */
function look(p: Part, b: Body) {
  const top = attr(p, 'top') as Top | null, mark = attr(p, 'mark'), grip = attr(p, 'grip');
  const cap = attr(p, 'cap') ?? b.cap ?? null;
  return {
    material: attr(p, 'material') || b.material,
    grip: isGrip(grip) ? grip : b.grip,
    ribs: num(p, 'ribs', b.ribs ?? 0),
    top: top && TOPS.includes(top) ? top : cap && !b.cap && b.top !== 'spun' ? 'cap' as Top : b.top,
    cap,
    face: attr(p, 'face'),
    mark: isIndicator(mark) || mark === 'skirt' ? mark as Indicator | 'skirt' : b.mark,
    ink: attr(p, 'mark-color'),
    height: num(p, 'height', b.height),
    skirt: b.skirt,
    body: num(p, 'body', b.body),
    taper: num(p, 'taper', b.taper),
    edge: num(p, 'edge', b.edge),
    profile: b.profile,
    pointer: p.el.hasAttribute('pointer'),
  };
}
type Look = ReturnType<typeof look>;

const SPUN = { aniso: 0.78, rough: 0.32, grain: [0, 1, 1] as Vec3 };

/** The knob itself, `d` mm across, round its own middle and pointing up. */
function draw(s: Sheet, k: Look, d: number, dev: DeviceInfo, lit?: Vec3): void {
  const r = d / 2, over = { wear: dev.wear * 0.3 }, { material, height } = k;
  let z = 0, rb = r;
  if (k.skirt !== 'none') {
    rb = r * k.body;
    // A flat skirt is a disc 1.5mm thick; a cone rises from 1mm at its rim to meet the body 3mm up.
    // `pointer` moulds a wedge on a flat skirt out to the edge, as on a range switch, and the skirt shrinks to give it room.
    if (k.skirt === 'flat' && k.pointer) {
      s.surface(path('M50 1L74 40H26Z', -r, -r, r * 2, r * 2, { viewBox: [0, 0, 100, 100] }), { material, profile: 'chamfer', bevel: r * 0.05, zEdge: 0, zTop: 1.5, over });
      s.surface(circle(0, 0, r * 0.7), { material, bevel: 0.5, zEdge: 0, zTop: 1.5, over });
    } else if (k.skirt === 'flat') s.surface(circle(0, 0, r), { material, bevel: 0.5, zEdge: 0, zTop: 1.5, over });
    else s.surface(circle(0, 0, r), { material, profile: 'chamfer', bevel: r - rb, zEdge: 1, zTop: 3, over });
    z = k.skirt === 'flat' ? 1.5 : 3;
    if (k.mark === 'skirt' && !k.pointer) s.cut(rect(-0.35, -r + 0.6, 0.7, r - rb - 0.6), { depth: 0.06, ink: k.ink ? linear(k.ink) : legendColor(material), wear: dev.wear * 0.3 });
  }
  const g = GRIPS[k.grip], depth = g.share ? rb * g.share : g.depth;
  const rt = Math.max(rb - Math.tan((k.taper * Math.PI) / 180) * (height - z), rb * 0.5), edge = Math.min(k.edge, rt * 0.4, (height - z) * 0.5);
  s.surface(gripped(rb, k.grip, k.ribs), { material, profile: 'chamfer', bevel: Math.max(rb - rt, 0.15), zEdge: z, zTop: height - edge, over });
  // A metal knob is spun in its own metal; anything else has an aluminium disc let in.
  const face = k.face || (k.top === 'spun' && resolveMaterial(material).metal < 0.5 ? 'brushed-aluminium' : material), plain = k.top !== 'spun' && k.top !== 'cap';
  s.surface(circle(0, 0, rt - depth), {
    material: plain ? face : material, profile: k.profile, bevel: edge, zEdge: height - edge, zTop: height,
    dish: k.top === 'dished' ? Math.min(0.8, rt * 0.08) : 0, crown: k.top === 'domed' ? Math.min(1.6, rt * 0.25) : 0, over: { ...over, touch: dev.age * 0.3 },
  });
  // A spun disc or a cap sits in a rim 0.8mm wide.
  const inset = rt - depth - 0.8;
  let ground = plain ? face : material;
  if (k.top === 'spun') {
    s.surface(circle(0, 0, inset), { material: face, profile: 'flat', radial: true, zEdge: height, zTop: height, over: SPUN });
    ground = face;
  } else if (k.top === 'cap') {
    ground = k.cap || 'keycap-grey';
    s.surface(circle(0, 0, inset), { material: ground, profile: 'dome', bevel: inset * 0.3, zEdge: height - 0.1, zTop: height + 0.5, over });
  }
  if (k.mark !== 'skirt' && k.mark !== 'none') {
    const at = k.top === 'spun' || k.top === 'cap' ? inset : rt - depth;
    indicator(s, k.mark, at, k.ink ? linear(k.ink) : lit ?? legendColor(ground), { emit: lit, wear: dev.wear * 0.3 });
  }
}

/** A bar knob: the bar across its foot, `d` mm across. */
function drawBar(s: Sheet, k: Look, d: number, dev: DeviceInfo): void {
  const r = d / 2, w = r * k.body, over = { wear: dev.wear * 0.3, touch: dev.age * 0.3 }, ink = k.ink ? linear(k.ink) : legendColor(k.material);
  s.surface(circle(0, 0, r), { material: k.material, bevel: 0.5, zEdge: 0, zTop: 1.5, over });
  s.surface(capsule(0, -r * 0.92 + w, 0, r * 0.92 - w, w, w), { material: k.material, profile: k.profile, bevel: k.edge, zEdge: 1.5, zTop: k.height, over });
  if (k.mark !== 'none') s.cut(capsule(0, -r * 0.92 + w * 0.6, 0, -r * 0.2, 0.4, 0.4), { depth: 0.08, ink, wear: dev.wear * 0.3 });
}

/** Mm of panel round a knob its print takes up: ticks, LEDs, then labels in the panel's type. */
const band = (p: Part, b: Body, size: number) => {
  const ticks = num(p, 'ticks', b.ticks), leds = p.el.hasAttribute('leds'), labels = labelsOf(p).length;
  return (ticks ? 3.75 : 0) + (leds ? 3.25 : 0) + (labels ? (size * 1.7) / MM : 0);
};

function knob(selector: string, b: Body, mount: TurnOptions): PartDef {
  const counted = (p: Part) => num(p, 'detents', 0) || labelsOf(p).length || num(p, 'ticks', b.ticks);
  const sweep = (p: Part) => num(p, 'sweep', b.sweep);
  const joint = turn({
    ...mount,
    // `from` and `to` put the stops where they are, degrees from straight up, for positions that aren't either side of the top.
    ...(mount === POT && { stops: { at: (p: Part) => [num(p, 'from', -sweep(p)), num(p, 'to', sweep(p))] as [number, number] } }),
    ...(mount === POT && selector.includes('[detents]') && { detents: { count: counted } }),
  });
  // Where the knob is and how big, css px. `size` is the knob's diameter in mm, inside its box.
  const sized = (p: Part) => {
    const R = Math.min(p.w, p.h) / 2, size = 11, share = attr(p, 'size');
    return { cx: p.x + p.w / 2, cy: p.y + p.h / 2, R, r: share ? (+share * MM) / 2 : Math.max(R - band(p, b, size) * MM, R * 0.4), size };
  };
  return {
    selector,
    ...joint,
    mask(ctx, p) {
      const { cx, cy, R, r, size } = sized(p), ticks = num(p, 'ticks', b.ticks), labels = labelsOf(p);
      if (!ticks && !labels.length) return;
      const leds = p.el.hasAttribute('leds') ? 3.25 * MM : 0;
      const over = overhang(printRing(ctx, cx, cy, {
        inner: r + leds + 1 * MM, outer: ticks ? Math.min(R - 0.5 * MM, r + leds + 3.25 * MM) : r + leds + 0.5 * MM, ticks, sweep: sweep(p),
        major: num(p, 'major', 5), labels, gap: 0, font: font(p, size),
      }), p.w, p.h);
      return { x: p.x - over, y: p.y - over, w: p.w + over * 2, h: p.h + over * 2 };
    },
    paint(s, p, d) {
      const { cx, cy, r } = sized(p), k = look(p, b), leds = p.el.hasAttribute('leds');
      // `ring`: a low boss in the panel round it, with a groove round that. It's moulded first, so its scale and lamps are on it.
      if (p.el.hasAttribute('ring')) {
        const R = Math.min(p.w, p.h) / 2;
        s.cut(ring(circle(cx, cy, R - 0.6), 1.5), { depth: 0.5, ink: [0.012, 0.012, 0.012], soft: 0.3 });
        s.surface(circle(cx, cy, R - 2), { material: ground(p, d), bevel: R * 0.5, zEdge: 0, zTop: 1.6, profile: 'round' });
      }
      if (p.mask) s.cut(mask(p.mask), { depth: 0.1, ink: legendColor(ground(p, d)), wear: d.wear * 0.3 });
      let lit: Vec3 | undefined;
      if (leds) lit = lamps(s, p, cx, cy, r + 1.6 * MM, sweep(p));
      s.group({ at: [cx, cy], scale: MM }, () => seat(s, (r * 2) / MM));
      s.group({ ...joint.place(p), scale: MM }, () => (words(p)[0] === 'bar' ? drawBar : draw)(s, k, (r * 2) / MM, d, lit));
      if (p.focused) s.glow(circle(cx, cy, r + 1.5), FOCUS);
    },
  };
}

/** A ring of LEDs round the knob, `segments` of them or one lit arc, lighting up to where it points. Returns the light, for its mark. */
function lamps(s: Sheet, p: Part, cx: number, cy: number, R: number, sweepDeg: number): Vec3 {
  const c = lamp(p, 'white'), sweep = (sweepDeg * Math.PI) / 180, n = num(p, 'leds', 0), a = p.springs.turn!.value, t = (a + sweep) / (2 * sweep);
  if (n) {
    for (let i = 0; i < n; i++) {
      const k = i / Math.max(n - 1, 1), [x, y] = polar(cx, cy, R, -sweep + 2 * sweep * k), on = t >= k - 0.001 ? 1 : 0;
      s.cut(circle(x, y, 0.4 * MM), { ink: scale(c, 0.012 + on * 0.03), emit: scale(c, 0.012 + on * 0.4) });
    }
  } else {
    s.cut(arc(cx, cy, R, -sweep, sweep, 0.75 * MM), { ink: scale(c, 0.012), emit: scale(c, 0.01) });
    if (t > 0.002) s.cut(arc(cx, cy, R, -sweep, a, 0.75 * MM), { ink: scale(c, 0.03), emit: scale(c, 0.34) });
  }
  return scale(c, 0.5);
}

defineStyles(controlStyles('[d-knob=""]', '[d-knob~="skirt"]', '[d-knob~="cap"]', '[d-knob~="collet"]', '[d-knob~="flared"]', '[d-knob~="stem"]', '[d-knob~="bar"]'));

// The plain knob: turned aluminium over a thin skirt, with a spun top, a line to point with and its scale printed round it.
// Every form takes `grip` (smooth, knurled, ribbed, fluted, lobed) and `ribs` for how many, `top` (flat, spun, cap, dished, domed),
// `cap` and `face` for what the top is made of, `mark` (line, dot, arrow, slot, skirt, none) and `mark-color`, `pointer` for a wedge on a flat skirt, `from` and `to` for its stops in degrees, `height`, `taper`
// and `edge` in mm, `body` for the body's share of a skirted knob, `ticks`, `major`, `labels`, `sweep` and `size` for what's printed round it,
// `leds`, with `color`, for a ring of lamps that light up to where it points, and `ring` for a low boss moulded into the panel round it, with a groove round that and its scale printed on it.
definePart(knob('[d-knob=""]', PLAIN, POT));
// The same on a click-stop switch: one click for each of `detents`, or each label, or each tick.
definePart(knob('[d-knob=""][detents]', PLAIN, POT));
// A moulded instrument knob: fluted body over a flat skirt with a line across it, and an aluminium disc let into the top.
definePart(knob('[d-knob~="skirt"]', SKIRT, POT));
// The same on a click-stop switch.
definePart(knob('[d-knob~="skirt"][detents]', SKIRT, POT));
// A plain straight-sided moulded knob with a chamfered top.
definePart(knob('[d-knob~="cap"]', CAP, POT));
// The same on a click-stop switch, as a mode dial or a stepped encoder is.
definePart(knob('[d-knob~="cap"][detents]', CAP, POT));
// The same on a shaft with no ends and no input: its `turn` attribute holds the angle, radians, for whatever it drives to read.
definePart(knob('[d-knob~="cap"][free]', CAP, { mass: 8, material: 'plastic-on-plastic', hubless: true }));
// A tapered soft-touch knob with a coloured cap pressed on its top, held by a collet.
definePart(knob('[d-knob~="collet"]', COLLET, POT));
// The same on a click-stop switch.
definePart(knob('[d-knob~="collet"][detents]', COLLET, POT));
// A fluted knob flaring into a cone at its foot, with a ray of ticks printed round it.
definePart(knob('[d-knob~="flared"]', FLARED, POT));
// A slim ribbed stem with a domed top and a slot across it, on an endless encoder clicking at each step of its input.
definePart(knob('[d-knob~="stem"]', STEM, ENDLESS));
// A bar across a round foot, with a line along it to point with.
definePart(knob('[d-knob~="bar"]', BAR, POT));
// The same on a click-stop switch, as a selector is.
definePart(knob('[d-knob~="bar"][detents]', BAR, POT));
