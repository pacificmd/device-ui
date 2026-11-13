// Things that light up.
import { circle, definePart, legendColor, mask, MM, rect, type Part, type PartDef, type Sheet, type Vec3 } from 'device-ui';
import { lampColours } from 'device-ui/materials';
import { lamp, num, scale, standing } from './shared.js';
import { bezel, bushing, hexNut, isLens, lens as glass } from './anatomy.js';

interface Lens {
  cx: number;
  cy: number;
  R: number;
  on: number;
  c: Vec3;
  /** The glass of a lit lens. */
  lens: { color: Vec3; emit: Vec3 };
}

/** How tall a panel lamp's body stands behind its bezel, mm. Guess, from an 8 mm panel indicator. */
const BODY = 6;

/** A panel lamp's threaded body with its hex nut, which is all of it a panel hides. */
const threaded = (s: Sheet, cx: number, cy: number, R: number) => s.group({ at: [cx, cy], scale: MM }, () => {
  const r = R / MM;
  bushing(s, r * 1.6, 0, BODY - 1.6, { material: 'chrome' });
  hexNut(s, r * 1.7, BODY - 1.6, 1.6);
});

/** One form of the indicator. `level` runs it at part brightness while it is `on`, 0 to 1, as a lamp switched faster than the eye can follow would look. */
const indicator = (selector: string, draw: (s: Sheet, p: Part, at: Lens) => void, body?: (s: Sheet, cx: number, cy: number, R: number) => void): PartDef => ({
  selector,
  springs: { lit: { stiffness: 160, damping: 22 } },
  live: ['on', 'color', 'level'],
  update(p) {
    p.springs.lit!.set(p.el.hasAttribute('on') ? num(p, 'level', 1) : 0);
  },
  paint(s, p) {
    const on = p.springs.lit!.value, c = lamp(p), cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    const front = () => draw(s, p, {
      cx, cy, R, on, c,
      lens: { color: c.map(v => 0.012 + v * 0.03) as Vec3, emit: c.map(v => v * on * 0.55) as Vec3 },
    });
    // Loose, it stands on the body a panel hides, with the nut that holds it run down to the bezel.
    if (body) standing(s, p, BODY, () => body(s, cx, cy, R), front);
    else front();
  },
});

// A jewel in a chrome bezel. `lens` is how the glass is cut: `jewel`, `dome`, `flat` or `fresnel`. `square` makes it a square pilot
// light, with a flat lens in a square bezel, and `bezel` names what the bezel is made of.
definePart(indicator('[d-lamp=""]', (s, p, { cx, cy, R, lens }) => s.group({ at: [cx, cy], scale: MM }, () => {
  const r = R / MM, kind = p.el.getAttribute('lens'), square = p.el.hasAttribute('square'), material = p.el.getAttribute('bezel') || 'chrome';
  const open = bezel(s, { w: r * 2, wall: r * (square ? 0.24 : 0.38), height: 2.2, floor: 0.6, square, radius: r * 0.2, material });
  if (square) s.surface(rect(-open.w / 2 + 0.2, -open.h / 2 + 0.2, open.w - 0.4, open.h - 0.4, { radius: r * 0.08 }), { material: 'glass-red', profile: 'round', bevel: r * 0.15, zEdge: 0.6, zTop: 1.6, crown: 0.3, over: lens });
  else glass(s, isLens(kind) ? kind : 'jewel', open.w / 2 - r * 0.04, 0.4, { height: 2.2, over: lens });
}), threaded));

// A neon indicator: a clear glass bulb in a black sleeve, with two electrodes inside, and when it's on the gas glows orange round
// them and nowhere else. Spec: an NE-2, 6mm across, with its electrodes about 1.5mm apart.
definePart(indicator('[d-lamp~="neon"]', (s, p, { cx, cy, R, on }) => {
  const c = lampColours[p.el.getAttribute('color') ?? 'neon'] ?? lampColours.neon!;
  s.group({ at: [cx, cy], scale: MM }, () => {
    const r = R / MM, gap = r * 0.25, w = r * 0.22, l = r * 0.9;
    s.surface(circle(0, 0, r), { material: 'plastic-black', profile: 'round', bevel: r * 0.2, zEdge: 0, zTop: 1.4 });
    s.surface(circle(0, 0, r * 0.8), { material: 'well', bevel: 0.2, zEdge: 1.4, zTop: 0.2 });
    for (const x of [-gap - w / 2, gap + w / 2]) {
      s.surface(rect(x - w / 2, -l / 2, w, l, { radius: w * 0.3 }), { material: 'satin-steel', bevel: 0.1, zEdge: 0.2, zTop: 0.8, over: { emit: scale(c, 0.05 * on) } });
      if (on > 0.01) s.lamp(rect(x - w * 1.1, -l * 0.55, w * 2.2, l * 1.1, { radius: w }), c, on, { gain: 0.18 });
    }
    s.glass(circle(0, 0, r * 0.8), { height: 2, bevel: r * 0.6, curve: 1, coat: 0.6 });
  });
}));

// A small domed LED.
definePart(indicator('[d-lamp~="led"]', (s, _p, { cx, cy, R, lens }) => s.group({ at: [cx, cy], scale: MM }, () => {
  const r = R / MM;
  s.surface(circle(0, 0, r), { material: 'black-oxide', bevel: 0.25, zEdge: 0, zTop: 0.4 });
  glass(s, 'dome', r * 0.72, 0.5, { height: 0.9, over: lens });
})));

// A pinhole in the panel: nothing to see until it is lit, unless `hole` drills it, so it shows dark when it's out.
definePart(indicator('[d-lamp~="pin"]', (s, p, { cx, cy, R, c, on }) => {
  if (p.el.hasAttribute('hole')) s.well(circle(cx, cy, R), 0.3, { bevel: 0.05 * MM });
  s.lamp(circle(cx, cy, R), c, on);
}));

// Frosted glass with the lamp behind it: whatever it sits on, and lit through.
definePart(indicator('[d-lamp~="window"]', (s, _p, { cx, cy, R, c, on }) => {
  if (on > 0.01) s.lamp(circle(cx, cy, R), c, on, { gain: 0.4 });
}));

// A flat bar of an LED, set level with what it sits in. It fills its box.
definePart(indicator('[d-lamp~="bar"]', (s, p, { c, on, lens }) => {
  s.surface(rect(p.x, p.y, p.w, p.h, { radius: 1 }), { material: 'black-oxide', bevel: 0.6, zEdge: 0, zTop: 0.2, over: lens });
  if (on > 0.01) s.lamp(rect(p.x, p.y, p.w, p.h, { radius: 1 }), c, on, { gain: 0.5 });
}));

// A warning tile on a panel: dark until it isn't, with its legend lit through it. `material` makes the tile that, with its legend always dark,
// as on a frosted tile with a bulb behind it, and `frame` is what holds it. `bare` is just a patch of phosphor laid into a panel, with its legend black on it.
definePart({
  selector: '[d-lamp~="annunciator"]',
  label: true,
  springs: { lit: { stiffness: 240, damping: 24 } },
  live: ['on', 'color'],
  update(p) {
    p.springs.lit!.set(p.el.hasAttribute('on') ? 1 : 0);
  },
  paint(s, p) {
    const c = lamp(p), on = p.springs.lit!.value, dim = c.map(v => 0.008 + v * 0.012) as Vec3, tile = p.el.getAttribute('material');
    if (p.el.hasAttribute('bare')) {
      if (on > 0.01) s.cut(rect(p.x, p.y, p.w, p.h, { radius: 1 }), { ink: scale(c, 0.02), emit: scale(c, num(p, 'gain', 0.1) * on) });
      if (p.label) s.cut(mask(p.label), { ink: [0.005, 0.006, 0.005], rough: 0.7 });
      return;
    }
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 2 }), { material: p.el.getAttribute('frame') || 'black-oxide', bevel: 1.5, zEdge: 0, zTop: 0.8 });
    const glass = rect(p.x + 2, p.y + 2, p.w - 4, p.h - 4, { radius: 1 });
    if (tile) {
      s.surface(glass, { material: tile, profile: 'flat', zEdge: 0.5, zTop: 0.5, over: { emit: scale(c, num(p, 'gain', 0.2) * on) } });
      if (p.label) s.cut(mask(p.label), { ink: legendColor(tile), rough: 0.7 });
    } else {
      s.surface(glass, { material: 'glass-red', profile: 'flat', zEdge: 0.5, zTop: 0.5, over: { color: dim, emit: scale(c, 0.075 * on), rough: 0.3 } });
      // Printed on the tile, so it reads pale when dark and black against the light.
      if (p.label) s.cut(mask(p.label), { ink: scale([0.5, 0.5, 0.48], 1 - on), rough: 0.9 });
    }
    s.glass(glass, { height: 0.3, bevel: 3, coat: 0.7 });
  },
});

