// Things carried in a pocket: a lid that flips open on its corner, and what strikes a flame.
import { capsule, circle, definePart, defineStyles, FOCUS, follow, hinge, linear, MM, outline, path, poly, press, rect, text, together, turn, type Part, type Point } from 'device-ui';
import { controlStyles, keyStyles, num, nums, turned } from 'device-ui/controls/shared';

defineStyles('[d-cover~="lid"], [d-lighter~="chimney"], [d-lighter~="flintwheel"], [d-lighter~="camlever"], [d-fixing~="rivet"], [d-fixing~="staple"], [d-match~="tooth"], [d-match~="loose"], [d-match~="striker"], [d-chip~="contacts"], [d-clip~="spring"] { display: block; }\n[d-clip~="spring"] button { position: absolute; inset: 0; appearance: none; background: none; border: 0; padding: 0; color: transparent; cursor: pointer; }');
defineStyles(`
${controlStyles('[d-pen~="barrel"]')}
${keyStyles('[d-pen~="clicker"] button')}
[d-pen] { display: block; pointer-events: none; }
[d-pen] input, [d-pen] button { pointer-events: auto; }
.d-gl [d-pen~="clicker"] button { position: absolute; inset: 0; width: 100%; height: 100%; }
`);

/** Seen from the front a lid turns in the plane of its face: the pin runs front to back, through its bottom left corner. */
const lid = hinge({ at: p => [0, p.h], stops: { at: [0, -97] }, mass: 30, material: 'steel-on-steel' });

// A sprung clip on the back of a thing, filling its box: one sheet standing off the back, pinned across at one end, which a thumb on that end lifts at the other. A press on its button opens it.
// `hinge` says which end, top or bottom, `radius` rounds its corners and `height` is how far it stands, mm. `mark` engraves a path across its middle, `mark-size` wide, mm, in a square `viewbox` of that path's.
definePart({
  selector: '[d-clip~="spring"]',
  ...press({ mass: 8, material: 'steel-on-steel', of: 'button' }),
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'polished-steel', r = num(p, 'radius', 1) * MM, tall = num(p, 'height', 2), open = p.springs.press!.value, top = p.el.getAttribute('hinge') !== 'bottom';
    const pin = 2.4 * MM, y = top ? p.y : p.y + p.h - pin;
    // What pins it to the back, shorter than the sheet and showing past it only in the gap under the sheet.
    s.surface(rect(p.x + p.w * 0.12, y, p.w * 0.76, pin, { radius: 2 }), { material, rise: tall - 0.3, bevel: 1 });
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: r }), { material, rise: tall + open * 0.8, bevel: 0.6 * MM });
    const line = p.el.getAttribute('mark');
    if (line) {
      const size = num(p, 'mark-size', 6) * MM, box = (p.el.getAttribute('viewbox') ?? '0 0 24 24').split(/\s+/).map(Number) as [number, number, number, number];
      s.engrave(path(line, p.x + (p.w - size) / 2, p.y + (p.h - size) / 2, size, size, { viewBox: box }), 0.06);
    }
  },
});

// A cap that fits the top of a case, square where they meet, on a pin at its bottom left corner.
definePart({
  selector: '[d-cover~="lid"]',
  ...lid,
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'satin-steel', r = num(p, 'radius', 3) * MM, rise = num(p, 'height', 2);
    s.group(lid.place(p), () => s.surface(outline(0, -p.h, p.w, p.h, [r, r, 0, 0]), { material, rise, bevel: 5 }));
    // The end of the hinge barrel, which is all of it that shows from here.
    s.surface(circle(p.x, p.y + p.h, 5.5), { material, rise: rise + 0.05, bevel: 2 });
    s.surface(circle(p.x, p.y + p.h, 1.6), { material: 'black-oxide', rise: rise + 0.05, bevel: 0.6 });
  },
});

// The holes of a wind guard, pressed through whatever it's on, and the two folds down its sides. `rows` is how many holes in each row, and the rows sit half a pitch out of step.
definePart({
  selector: '[d-lighter~="chimney"]',
  paint(s, p) {
    const r = num(p, 'hole', 0.95) * MM, rows = (p.el.getAttribute('rows') || '3,2,3').split(',').map(Number), pitch = p.w * 0.3, cx = p.x + p.w / 2;
    for (const x of [p.x, p.x + p.w - 3]) s.cut(rect(x, p.y, 3, p.h), { depth: 0.08, soft: 1.6 });
    rows.forEach((n, row) => {
      const y = p.y + ((row + 0.5) * p.h) / rows.length;
      for (let i = 0; i < n; i++) s.well(circle(cx + (i - (n - 1) / 2) * pitch, y, r), 1, { bevel: 1 });
    });
  },
});

// A knurled wheel, filling its box. It turns on an axle held by whatever passes in front of it.
definePart({
  selector: '[d-lighter~="flintwheel"]',
  paint(s, p) {
    const R = p.w / 2;
    s.surface(circle(p.x + R, p.y + R, R, { ripple: [52, 0.9] }), { material: p.el.getAttribute('material') || 'black-oxide', zEdge: num(p, 'height', 2) - 2, zTop: num(p, 'height', 2), bevel: 2 });
  },
});

// The domed head of a rivet, filling its box.
definePart({
  selector: '[d-fixing~="rivet"]',
  paint(s, p) {
    s.surface(circle(p.x + p.w / 2, p.y + p.h / 2, p.w / 2), { material: p.el.getAttribute('material') || 'chrome', profile: 'dome', rise: num(p, 'height', 0.5) });
  },
});

const leaf = (l: number, r: number) => poly([[-l, -r * 0.55, r * 0.5], [l * 0.2, -r, r], [l, -r * 0.45, r * 0.4], [l, r * 0.45, r * 0.4], [l * 0.2, r, r], [-l, r * 0.55, r * 0.5]]);
const cam = follow({ mass: 2, material: 'steel-on-steel', return: 0.0029, friction: 0.13, sound: 'cam' });

// A leaf of sprung steel riveted through the middle of its box. It rides the joint named by `of`, and tips over as that opens.
definePart({
  selector: '[d-lighter~="camlever"]',
  ...cam,
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'brushed-steel', rise = num(p, 'height', 1), R = p.h / 2, l = p.w / 2;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, rotate = 1.05 - 0.78 * cam.value(p);
    s.group({ at: [cx, cy], rotate }, () => s.surface(leaf(l, R), { material, rise, bevel: 2.5 }));
    s.surface(circle(cx, cy, R * 0.5), { material: 'chrome', profile: 'dome', rise: rise + 0.4 });
  },
});

// A retractable ballpoint, lying with its tip to the left. Twisting the barrel runs it off the thread and then off the refill, and the halves part evenly about the middle of the box, so the whole length of the thing stays in it.
const RAD = Math.PI / 180;
/** How far the barrel turns from shut to off, of which it's on the thread for the first `ON_THREAD`. */
const ON_THREAD = 0.5;
const stations = (p: Part, name: string) => (p.el.getAttribute(name) ?? '').split(',').filter(Boolean).map(s => s.trim().split(/\s+/).map(Number) as [number, number]);
const sprung = (p: Part, name: string) => Math.min(Math.max(p.springs[name]!.value, 0), 1);
/** How far apart the halves are, mm, at `v` of the twist. `thread` is how far the thread carries it, and `off` how far it has to go to clear what's in it. */
const parted = (barrel: Element | null | undefined, v: number) => {
  const thread = +(barrel?.getAttribute('thread') ?? 5), off = +(barrel?.getAttribute('off') ?? 76);
  return v < ON_THREAD ? (v / ON_THREAD) * thread : thread + ((v - ON_THREAD) / (1 - ON_THREAD)) * (off - thread);
};
const leadOf = (p: Part) => {
  const of = p.el.getAttribute('of');
  return of ? p.el.closest('d-device')?.querySelector(of) : null;
};
const steady = { mass: 1, material: 'steel-on-steel', friction: 1 } as const;
const halves = follow({ ...steady, name: 'open' });
/** How far this half has moved along, css px, away from the other. */
const apart = (p: Part) => (parted(leadOf(p), sprung(p, 'open')) / 2) * MM;
/** What's moved with a half stays under the hand. Only when it changes, since the page watches its parts. */
const carryHit = (el: Element | null, dx: number) => {
  const to = dx ? `translateX(${dx.toFixed(2)}px)` : '', style = (el as HTMLElement | null)?.style;
  if (style && style.transform !== to) style.transform = to;
};

/** A joint a follower can read, which is anything with a `value`. */
const led = <J extends object>(joint: J, value: (p: Part) => number) => ({ ...joint, value }) as J;
const twist = turn({ mass: 14, material: 'brass-on-steel', input: true, rolled: true, stops: { at: p => [0, num(p, 'sweep', 2520)] }, travel: p => num(p, 'travel', 65) * MM });

const twisted = (p: Part) => Math.min(Math.max(twist.angle(p) / (num(p, 'sweep', 2520) * RAD), 0), 1);

// The barrel that twists off: drag up or down across it. `profile` is its section, stations of `x r` in mm from its left. `thread` and `off` are how far the thread carries it, and how far off it has to go, mm. `lay` is how its brushing runs, degrees from along it.
// `material` is the steel.
definePart({
  selector: '[d-pen~="barrel"]',
  ...led(twist, twisted),
  paint(s, p, d) {
    const dx = -(parted(p.el, twisted(p)) / 2) * MM;
    carryHit(p.el.querySelector('input'), dx);
    turned(s, p.x + dx, p.y + p.h / 2, stations(p, 'profile'), { material: p.el.getAttribute('material') || 'satin-steel', over: { wear: d.wear * 0.5, tangent: num(p, 'lay', 90) * RAD } });
    if (p.focused) s.glow(rect(p.x + dx, p.y, p.w, p.h, { radius: 8 }), FOCUS);
  },
});

const stroke = press({ mass: 3, material: 'steel-on-steel', contact: 'press', return: 0.9, sound: 'cam', of: 'button', catches: 0.7 });
const clicker = together(stroke, halves);

// The button on the end that works the cam: press it, and it stays in, and press it again. `aria-pressed` on its button says it's in. `profile` is its section, `travel` how far it goes to the bottom, mm.
// `material` is the steel.
definePart({
  selector: '[d-pen~="clicker"]',
  ...led(clicker, stroke.value),
  paint(s, p) {
    const dx = apart(p), down = stroke.value(p) * num(p, 'travel', 3.5) * MM;
    carryHit(p.el.querySelector('button'), dx);
    turned(s, p.x + dx - down, p.y + p.h / 2, stations(p, 'profile'), { material: p.el.getAttribute('material') || 'satin-steel', ends: [0, 0.7], over: { tangent: num(p, 'lay', 90) * RAD } });
    if (p.focused) s.glow(rect(p.x + dx, p.y, p.w, p.h, { radius: 6 }), FOCUS);
  },
});

// The fixed half of the barrel, with the ring at its end that holds the clip. `profile` is its section and `collar` the ring's, as stations from its left. `legend` is cut round it at `legend-at`, mm from its left, `legend-size` high.
// `material` is the steel, `ring` the metal of the collar.
definePart({
  selector: '[d-pen~="cap"]',
  ...halves,
  paint(s, p, d) {
    const dx = apart(p), x = p.x + dx, cy = p.y + p.h / 2, material = p.el.getAttribute('material') || 'satin-steel', tangent = num(p, 'lay', 90) * RAD, body = stations(p, 'profile'), ring = stations(p, 'collar'), word = p.el.getAttribute('legend');
    turned(s, x, cy, ring, { material: p.el.getAttribute('ring') || 'chrome', ends: [0.1, 0.3] });
    turned(s, x, cy, body, { material, ends: [0.2, 0.7], over: { wear: d.wear * 0.5, tangent } });
    if (word) {
      const R = body[0]![1], size = num(p, 'legend-size', 1.7) * MM, at = x + num(p, 'legend-at', 2) * MM, long = R * 1.7 * MM;
      s.bend({ from: [at, cy], to: [at, cy + R * MM], mirror: [at, cy], rigid: true, drop: R });
      s.cut(text(word, at - long / 2, cy - size, long, size * 2, { font: `500 ${size}px Georgia, 'Times New Roman', serif`, letterSpacing: `${size * 0.12}px`, rotate: Math.PI / 2 }), { depth: 0.02, soft: 0.2, ink: linear('#1c1b1a') });
      s.bend();
    }
  },
});

// A sprung clip, seen from the front, standing off whatever's under it. `path` is its outline in mm on its box. `feathers` are where a slanted groove crosses it, x and half width in mm from its left, and `spine` where the groove along it runs, x to x.
// `material` is the metal, `height` how far it stands, mm.
definePart({
  selector: '[d-pen~="clip"]',
  ...halves,
  paint(s, p) {
    const dx = apart(p), x = p.x + dx, cy = p.y + p.h / 2, material = p.el.getAttribute('material') || 'chrome', top = num(p, 'height', 6);
    s.surface(path(p.el.getAttribute('path') ?? '', x, p.y, p.w, p.h, { viewBox: [0, 0, p.w / MM, p.h / MM], spread: 8 }), { material, profile: 'round', bevel: 0.55 * MM, zEdge: top - 0.7, zTop: top });
    const [a = 0, b = 0] = nums(p, 'spine', []);
    if (b) s.cut(rect(x + a * MM, cy - 0.12 * MM, (b - a) * MM, 0.24 * MM), { depth: 0.3, soft: 0.4, ink: linear('#15161a') });
    const feathers = nums(p, 'feathers', []);
    for (let i = 0; i + 1 < feathers.length; i += 2) for (const side of [-1, 1]) {
      const fx = x + feathers[i]! * MM, half = feathers[i + 1]! * MM;
      s.cut(capsule(fx, cy + side * 0.35 * MM, fx - half * 0.9, cy + side * half, 0.14 * MM, 0.14 * MM), { depth: 0.2, soft: 0.4, ink: linear('#3a3a3c') });
    }
  },
});

const clicked = follow({ ...steady, name: 'click', attr: 'clicker' });

// What the barrel hides: the refill and its spring, and the thread the barrel runs on, which stays with the other half. `clicker` names the button that pushes it, `travel` how far that moves it at the bottom, mm.
// `nose` and `tube` are the refill's section as stations from its left. `thread` is where the thread is, `x x r`. `spring` is `seat free radius`: the barrel's seat for it, its free length and its radius, mm, and it sits on the refill's shoulder where the nose meets the tube.
// `material` is the tube, `tip` the nose.
definePart({
  selector: '[d-pen~="refill"]',
  ...together(halves, clicked),
  paint(s, p) {
    const half = apart(p), cy = p.y + p.h / 2, x = p.x + half - sprung(p, 'click') * num(p, 'travel', 3.5) * MM, tube = p.el.getAttribute('material') || 'satin-steel', tip = p.el.getAttribute('tip') || 'brass';
    const nose = stations(p, 'nose'), body = stations(p, 'tube'), [t0 = 0, t1 = 0, tr = 0] = nums(p, 'thread', []), [seat = 0, free = 0, coil = 0] = nums(p, 'spring', []);
    turned(s, x, cy, body, { material: tube, ends: [0.3, 0.1], over: { tangent: 0 } });
    turned(s, x, cy, nose, { material: tip, ends: [0.3, 0] });
    if (nose[0]) s.surface(circle(x + nose[0][0] * MM, cy, 0.3 * MM), { material: 'chrome', profile: 'dome', zEdge: 0, zTop: 0.4 });
    // The thread, on the half that doesn't move, as rings too fine to tell from a helix at this size.
    const PITCH = 0.75;
    if (t1) for (let u = t0; u < t1 - PITCH / 2; u += PITCH) turned(s, p.x + half, cy, [[u, tr - 0.22], [u + PITCH / 2, tr - 0.22]], { material: 'black-oxide', ends: [0, 0] });
    if (t1) for (let u = t0 + PITCH / 2; u < t1; u += PITCH) turned(s, p.x + half, cy, [[u, tr], [u + PITCH / 2, tr]], { material: 'black-oxide', ends: [0.06, 0.06] });
    // Between the refill's shoulder and the barrel's seat, as long as it's on, and free once it's gone.
    const shoulder = x + (body[0]?.[0] ?? 0) * MM, lead = leadOf(p), gone = lead ? (parted(lead, sprung(p, 'open')) / 2) * MM : 0, end = Math.max(shoulder - free * MM, p.x + seat * MM - gone);
    if (coil && gone > 0.5 * MM) {
      const turns = 11, pitch = (shoulder - end) / turns, r = coil * MM, wire = 0.22 * MM;
      for (let i = 0; i < turns; i++) {
        const a = end + i * pitch;
        s.surface(capsule(a, cy - r, a + pitch / 2, cy, wire, wire), { material: 'polished-steel', profile: 'round', zEdge: 0, zTop: coil });
        s.surface(capsule(a + pitch / 2, cy, a + pitch, cy + r, wire, wire), { material: 'polished-steel', profile: 'round', zEdge: coil, zTop: 0 });
      }
    }
  },
});

// A staple through a stack of card, seen from its crown: flat wire, and the dent it pulls in the card round it. It runs along its box.
definePart({
  selector: '[d-fixing~="staple"]',
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'satin-steel', rise = num(p, 'height', 0.28), r = p.h / 2;
    s.cut(rect(p.x - r, p.y - r * 1.2, p.w + r * 2, p.h + r * 2.4, { radius: r * 2 }), { depth: 0.12, soft: r * 2.4 });
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: r * 0.6 }), { material, rise, bevel: r, profile: 'round' });
  },
});

const STRIKE_INK = linear('#7d6a58');
// A strip of grit on what it's glued to. `struck` is where it's been struck so far, as x y x y in mm from its top left, four to a stroke: each scrapes the grit pale.
definePart({
  selector: '[d-match~="striker"]',
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'striker', m = (p.el.getAttribute('struck') ?? '').trim().split(/\s+/).filter(Boolean).map(Number);
    s.surface(rect(p.x, p.y, p.w, p.h), { material, rise: num(p, 'height', 0.06), bevel: 0.6, profile: 'flat' }, () => {
      for (let i = 0; i + 3 < m.length; i += 4) {
        s.cut(capsule(p.x + m[i]! * MM, p.y + m[i + 1]! * MM, p.x + m[i + 2]! * MM, p.y + m[i + 3]! * MM, 0.55 * MM, 0.3 * MM), { ink: STRIKE_INK, feather: 0.8, rough: 0.9 });
      }
    });
  },
});

// Numbers below all in mm, read off a straight-on photo of a comb of ten at 3.7 pitch.
const HEAD = 3.5, NECK = 0.56, SHOULDER = 2.4, FLARE = 10;
/** How far ahead of a burn the board has scorched, and how much of its width what's burnt keeps. Guess. */
const SCORCH = 2.2, CHAR = 0.8;
/** How a torn end goes: up and down this far, this often. Guess, from a photo. */
const RAG = 0.7, RAG_STEP = 0.32;

/** A number from 0 to 1 that's the same for the same seed. */
const shake = (n: number) => {
  const v = Math.sin(n * 127.1) * 43758.5453;
  return v - Math.floor(v);
};
/** A torn line across a strip w wide, from its right edge to its left. */
const ragged = (w: number, y: number, seed: number): Point[] => {
  const out: Point[] = [], n = Math.max(3, Math.round(w / RAG_STEP));
  for (let i = 0; i <= n; i++) out.push([w - (i * w) / n, y + (shake(seed + i) - 0.5) * RAG]);
  return out;
};
/** How wide a match is this far from its tip: its neck, then a straight taper out to the whole strip where the comb's teeth meet. */
const across = (w: number, y: number) => w * NECK + (w - 0.06 - w * NECK) * Math.min(Math.max((y - SHOULDER) / (FLARE - SHOULDER), 0), 1);
/** The outline of a match from `from` along it to a torn end at `end`. */
const stick = (w: number, end: number, seed: number, from = SHOULDER) => {
  const top = across(w, from) / 2, mid = w / 2, sides: Point[] = from < FLARE ? [[w - 0.03, FLARE, 3]] : [];
  return poly([[mid - top, from, 0.05], [mid + top, from, 0.05], ...sides, ...ragged(w, end, seed).map(([x, y], i, a) => [i === 0 ? w - 0.03 : i === a.length - 1 ? 0.03 : x, y] as Point), ...(from < FLARE ? [[0.03, FLARE, 3] as Point] : [])], { spread: 2 });
};
/** The dip: a blunt stub, square-shouldered and worn round at the tip, not a ball. */
const headOf = (w: number) => rect(w * (0.5 - NECK * 0.58), 0, w * NECK * 1.16, HEAD, { radius: w * 0.17 });

const heightOf = (p: Part) => num(p, 'height', 0.18);

// One tooth of a comb of matches, standing where it's stapled at the foot of its box. `torn` is mm from the foot where it was torn out, and what's left is a ragged stub. `head` and `material` say what it's dipped in and made of.
definePart({
  selector: '[d-match~="tooth"]',
  local: MM,
  live: ['torn'],
  paint(s, p) {
    const w = p.w / MM, h = p.h / MM, material = p.el.getAttribute('material') || 'pulp-coral', torn = p.el.hasAttribute('torn') ? num(p, 'torn', 5) : 0;
    const seed = num(p, 'seed', 1), rise = heightOf(p);
    if (torn) {
      s.surface(poly([[w - 0.03, h], [0.03, h], ...ragged(w, h - torn, seed).reverse()], { spread: 2 }), { material, rise, bevel: 0.25 });
      return;
    }
    s.surface(stick(w, h, seed), { material, rise, bevel: 0.25 });
    s.surface(headOf(w), { material: p.el.getAttribute('head') || 'head-tan', rise: rise * 1.8, bevel: 0.9, profile: 'round' });
  },
});

const EMBER = [2.8, 0.75, 0.12] as const;
// A match out of its comb, head at the top of its box, torn off at the foot. `burn` is how far it's burnt from the head, 0 to 1, and `spent` that its head has gone, with it lit or not.
definePart({
  selector: '[d-match~="loose"]',
  local: MM,
  live: ['burn', 'spent'],
  paint(s, p) {
    const w = p.w / MM, h = p.h / MM, material = p.el.getAttribute('material') || 'pulp-coral', burn = Math.min(Math.max(num(p, 'burn', 0), 0), 1), spent = p.el.hasAttribute('spent');
    const seed = num(p, 'seed', 1), rise = heightOf(p), whole = stick(w, h, seed), front = HEAD + burn * (h - HEAD);
    if (burn <= 0) s.surface(whole, { material, rise, bevel: 0.25 });
    else {
      // What's still board, from the burn to the torn end, and scorched brown just ahead of the burn.
      s.surface(stick(w, h, seed, front), { material, rise, bevel: 0.25 }, () => {
        s.cut(rect(0, front, w, SCORCH), { ink: linear('#2c1610'), feather: 5, rough: 0.9 });
      });
      // Behind it the board has gone to char and drawn in, a curl narrower than it was.
      const mid = w / 2, tip = (w * NECK * CHAR) / 2, end = (across(w, front) * CHAR) / 2;
      s.surface(poly([[mid - tip, SHOULDER, 0.1], [mid + tip, SHOULDER, 0.1], [mid + end, front + 0.2, 0.1], [mid - end, front + 0.2, 0.1]], { spread: 2 }), { material: 'pulp-char', rise: rise * 0.8, bevel: 0.3 });
    }
    s.surface(headOf(w), { material: spent ? 'head-spent' : p.el.getAttribute('head') || 'head-tan', rise: rise * 1.8, bevel: 0.9, profile: 'round' });
    if (burn > 0 && burn < 1 && p.el.hasAttribute('lit')) s.cut(rect(-1, front - 0.3, w + 2, 0.6), { ink: [0.5, 0.12, 0.02], emit: [...EMBER], feather: 1.2 });
    if (p.focused) s.glow(whole, FOCUS);
  },
});

// The gold contacts of a smart card or SIM, filling its box: a plate let into the card and split by fine channels into eight pads round a middle.
definePart({
  selector: '[d-chip~="contacts"]',
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'gold', { x, y, w, h } = p, gap = num(p, 'gap', 0.25) * MM;
    s.surface(rect(x, y, w, h, { radius: num(p, 'radius', 1.25) * MM }), { material, rise: num(p, 'height', 0.1), bevel: 0.6 });
    const channel = (cx: number, cy: number, cw: number, ch: number) => s.cut(rect(x + cx * w, y + cy * h, cw, ch), { depth: 0.06, soft: 0.2, ink: [0.03, 0.025, 0.015], rough: 0.8, metal: 0 });
    const L = 0.3, R = 0.7, T = 0.26, B = 0.74;
    // The middle.
    channel(L, T, (R - L) * w, gap);
    channel(L, B, (R - L) * w, gap);
    channel(L, T, gap, (B - T) * h);
    channel(R, T, gap, (B - T) * h);
    // Out to the edge, a pad above and below each side's middle one.
    for (const side of [0, R]) for (const line of [0.34, 0.66]) channel(side, line, L * w, gap);
    channel(0.5, 0, gap, T * h);
    channel(0.5, B, gap, (1 - B) * h);
  },
});
