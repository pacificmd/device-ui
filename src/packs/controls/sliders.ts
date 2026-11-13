// Things you push along a track.
import { capsule, circle, definePart, FOCUS, legendColor, linear, mask, MM, path, rect, slide, text, together, type DeviceInfo, type Part, type PartDef, type Sheet } from 'device-ui';
import { font, ground, lamp, loose, num, nums, scale, standing } from './shared.js';
import { words } from './key.js';
import { printScale } from './anatomy.js';

const isAcross = (p: Part) => p.w > p.h;

/**
 * A fader's cap by its shape, mm: how long it is along the slot, how tall, its corner and edge, how deep its top is dished and how wide
 * its white line is. Ribbed is a mixing desk's, a fin is a synth's thin blade, and flat is a DJ mixer's low square. Guess, from photos.
 */
const CAPS = {
  ribbed: { along: 6.5, height: 8, radius: 0.75, bevel: 1.1, dish: 0.6, line: 0.45 },
  fin: { along: 2.6, height: 11, radius: 1, bevel: 0.9, dish: 0, line: 0.6 },
  flat: { along: 9, height: 4.5, radius: 1.2, bevel: 0.8, dish: 0, line: 0.8 },
};

const fader = slide({
  input: 0, mass: 11, material: 'metal-on-grease', friction: 0.6,
  axis: p => (isAcross(p) ? 'x' : 'y'), travel: p => (isAcross(p) ? p.w - 40 : 40 - p.h) / MM,
  jump: p => p.el.hasAttribute('jump'),
});

// A ribbed cap on a range input, sliding in a sunk slot between printed ticks. It runs across when its box is wider than tall.
// `slot` is the slot's width, `cap` the cap's across the slot and `tick-length` how long a tick is, all in mm. `d-slider="fader fin"`
// tops it with a thin blade, as on a synth, and `fader flat` with a low square, as on a DJ mixer.
// `leds` puts a row of that many LEDs beside the slot in place of its ticks, a level meter: while it's `on` they glow low, and up to
// the cap they burn, in `color`.
definePart({
  selector: '[d-slider~="fader"]',
  options: ['ribbed', 'fin', 'flat'],
  ...fader,
  live: ['style', 'on'],
  mask(ctx, p) {
    if (p.el.hasAttribute('leds')) return;
    const n = num(p, 'ticks', 11), across = isAcross(p);
    const len = (across ? p.w : p.h) - 40, c = across ? p.y + p.h / 2 : p.x + p.w / 2, half = (across ? p.h : p.w) * 0.42, tick = num(p, 'tick-length', 1.75) * MM;
    // Each row of ticks runs in towards the slot from the edge of the box.
    for (const side of [-1, 1] as const) {
      const at = c + side * half, ends: [[number, number], [number, number]] = across ? [[p.x + 20, at], [p.x + 20 + len, at]] : [[at, p.y + 20], [at, p.y + 20 + len]];
      printScale(ctx, ends[0], ends[1], { ticks: n, length: tick, minor: tick - 0.75 * MM, side: across ? (-side as 1 | -1) : side });
    }
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p, d) {
    // Loose, it's the whole slide pot: a steel channel the length of its travel, with a screw hole in each end. Its ticks
    // were the panel's, so they go. Guess, from a 45 mm fader.
    const along = isAcross(p), bw = Math.min(9 * MM, along ? p.h : p.w), hole = 0.8 * MM;
    const channel = along ? rect(p.x, p.y + (p.h - bw) / 2, p.w, bw, { radius: 1.5 }) : rect(p.x + (p.w - bw) / 2, p.y, bw, p.h, { radius: 1.5 });
    standing(s, p, 7, () => s.surface(channel, { material: 'satin-steel', bevel: 1, zEdge: 0, zTop: 7, profile: 'chamfer' }, () => {
      for (const k of [0, 1]) s.well(circle(along ? p.x + hole * 1.3 + k * (p.w - hole * 2.6) : p.x + p.w / 2, along ? p.y + p.h / 2 : p.y + hole * 1.3 + k * (p.h - hole * 2.6), hole), 1, { bevel: 0.4 });
    }), () => {
      const name = p.el.getAttribute('material') || 'keycap-black';
      const across = isAcross(p), t = p.springs.slide!.value;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2, slot = num(p, 'slot', 1.5) * MM, wide = num(p, 'cap', 0) * MM;
      if (p.mask && !loose(p)) s.cut(mask(p.mask), { depth: 0.08, ink: legendColor(ground(p, d)), wear: d.wear * 0.3 });
      const leds = num(p, 'leds', 0);
      if (leds) {
        const c = lamp(p), lit = p.el.hasAttribute('on'), len = (across ? p.w : p.h) - 40, half = (across ? p.h : p.w) * 0.42, dot = Math.min(1.2 * MM, (len / Math.max(leds - 1, 1)) * 0.3);
        for (let i = 0; i < leds; i++) {
          const at = 20 + (i / Math.max(leds - 1, 1)) * len, on = !lit ? 0 : i <= t * (leds - 1) + 0.01 ? 1 : 0.14;
          const x = across ? p.x + at : cx - half + dot, y = across ? cy - half + dot : p.y + p.h - at;
          s.surface(circle(x, y, dot), { material: 'glass-red', profile: 'dome', zEdge: 0, zTop: 0.5, over: { color: scale(c, 0.006), emit: scale(c, 0.22 * on), rough: 0.3 } });
        }
      }
      s.surface(across ? rect(p.x + 8, cy - slot / 2, p.w - 16, slot, { radius: slot / 2 }) : rect(cx - slot / 2, p.y + 8, slot, p.h - 16, { radius: slot / 2 }), {
        material: 'well', bevel: 1.5, zEdge: 0, zTop: -1.8,
      });
      const kind = words(p, 'd-slider').find(w => w in CAPS) as keyof typeof CAPS | undefined, c = CAPS[kind ?? 'ribbed'];
      const long = c.along * MM, cw = across ? long : wide || Math.min(p.w * 0.62, 34), ch = across ? wide || Math.min(p.h * 0.62, 34) : long;
      // The cap is what the slide carries: drawn where it rests, from the part's top left, in the group the joint moves.
      s.group(fader.place(p), () => {
        const fx = across ? 20 : p.w / 2, fy = across ? p.h / 2 : p.h - 20;
        const shade = rect(fx - cw / 2, fy - ch / 2, cw, ch, { radius: c.radius * MM });
        s.surface(shade, { material: name, profile: kind === 'fin' ? 'round' : 'chamfer', bevel: c.bevel * MM, zEdge: -0.8, zTop: c.height, dish: c.dish, over: { wear: d.wear * 0.4, touch: d.age * 0.5 } });
        // Ribs across the top for a thumb to catch, on the ribbed cap only.
        if (!kind || kind === 'ribbed') for (const k of [-7, -4, 4, 7]) {
          s.cut(across ? rect(fx + k - 0.5, fy - ch / 2 + 3, 1, ch - 6) : rect(fx - cw / 2 + 3, fy + k - 0.5, cw - 6, 1), { depth: 0.4, ink: [0.01, 0.01, 0.01] });
        }
        const line = c.line * MM;
        s.cut(across ? rect(fx - line / 2, fy - ch / 2 + 2, line, ch - 4) : rect(fx - cw / 2 + 2, fy - line / 2, cw - 4, line), {
          depth: 0.1, ink: [0.85, 0.85, 0.82],
        });
        if (p.focused) s.glow(shade, FOCUS);
      });
    });
  },
});

const drawn = slide({ input: 0, name: 'pull', mass: 9, material: 'plastic-on-rubber', return: 0.5, home: 0, axis: 'x', travel: p => num(p, 'travel', 20), stops: { landing: 'soft' } });

// A knob on a rod, drawn out of the end of a body and pulled back in by its spring when it's let go, as a choke or a starter cord is.
// The box is the knob home against the body, which the rod comes out of on the left. `travel` is how far it draws and `rod` the rod's
// diameter, both mm. `path` is the knob's outline seen from the side in its `viewbox`, a ball on a neck if there's none; it's turned, so round all the way round.
definePart({
  selector: '[d-slider~="pull"]',
  ...drawn,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'plastic-black', out = p.springs.pull!.value * num(p, 'travel', 20) * MM;
    const cy = p.y + p.h / 2, rod = (num(p, 'rod', 6) * MM) / 2, x = p.x + out, R = rod / MM;
    if (out > 0.5) {
      s.bend({ from: [p.x, cy], to: [p.x, cy + rod], mirror: [p.x, cy], rigid: true, drop: R });
      s.surface(rect(p.x - 2, cy - rod, out + 4, rod * 2), { material: 'chrome', bevel: 0.5, zEdge: R - 0.3, zTop: R });
      s.bend();
    }
    const edge = p.el.getAttribute('path') ?? 'M0 38 L20 40 C30 40 34 15 65 15 A35 35 0 1 1 65 85 C34 85 30 60 20 60 L0 62 Z';
    const knob = path(edge, x, p.y, p.w, p.h, { viewBox: nums(p, 'viewbox', [0, 0, 100, 100]) as [number, number, number, number], spread: 8 });
    s.surface(knob, { material, profile: 'dome', bevel: p.h * 0.5, rise: p.h / 2 / MM, over: { wear: d.wear * 0.4, touch: d.age * 0.5 } });
    if (p.focused) s.glow(knob, FOCUS);
  },
});

const pulled = slide({ input: 0, mass: 40, material: 'plastic-on-plastic', return: 1.5, catches: 0.7, axis: 'y', travel: p => num(p, 'travel', 12) });

// A T-handle on a stem, pulled straight down, and caught by a pawl at the bottom so it stays pulled until its input is set back, as a fire
// alarm's is. Short of the pawl its spring takes it back. The box is the handle home, with the bar along its bottom. `travel` is how far it
// pulls, `bar` the bar's depth, `stem` the stem's width and `height` how far the bar stands, all mm. `text` is moulded along the bar, in `color`.
definePart({
  selector: '[d-slider~="handle"]',
  ...pulled,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'plastic-white';
    const bar = num(p, 'bar', 8) * MM, stem = num(p, 'stem', 12) * MM, tall = num(p, 'height', 6), over = { wear: d.wear * 0.4, touch: d.age * 0.5 };
    const ink = p.el.hasAttribute('color') ? linear(p.el.getAttribute('color')!) : legendColor(material), y = p.h - bar, said = p.el.getAttribute('text');
    s.group(pulled.place(p), () => {
      s.surface(rect((p.w - stem) / 2, 0, stem, p.h - bar + 2, { radius: 2 }), { material, bevel: 2, zEdge: tall * 0.3, zTop: tall - 2, over });
      s.surface(rect(0, y, p.w, bar, { radius: 3 }), { material, bevel: 3, zEdge: tall - 3, zTop: tall - 0.8, over });
      s.surface(rect(0, y, p.w, bar * 0.36, { radius: 3 }), { material, bevel: 2, zEdge: tall - 0.8, zTop: tall, over });
      if (said) s.cut(text(said, 0, y + bar * 0.36, p.w, bar * 0.64, { font: font(p, bar * 0.3), letterSpacing: `${bar * 0.09}px`, spread: 4 }), { depth: 0.1, ink, wear: d.wear * 0.3 });
      if (p.focused) s.glow(rect(0, y, p.w, bar, { radius: 3 }), FOCUS);
    });
  },
});

// A long lever in a slot, topped with a ball.
definePart({
  selector: '[d-slider~="lever"]',
  ...slide({ input: 0, mass: 37, material: 'metal-on-grease', axis: 'y', travel: p => (40 - p.h) / MM }),
  paint(s, p, d) {
    const name = p.el.getAttribute('material') || 'plastic-red';
    const cx = p.x + p.w / 2, t = p.springs.slide!.value;
    s.surface(rect(cx - 14, p.y, 28, p.h, { radius: 6 }), {
      material: 'black-oxide', bevel: 3, zEdge: 0, zTop: 1.2, over: { wear: d.wear * 0.5 },
    });
    s.surface(rect(cx - 4, p.y + 9, 8, p.h - 18, { radius: 4 }), { material: 'well', bevel: 1.5, zEdge: 1.2, zTop: -1.4 });
    const y = p.y + p.h - 20 - t * (p.h - 40), lean = 34 * (t - 0.5), ball = Math.min(p.w * 0.3, 17);
    s.surface(capsule(cx, y, cx, y - lean, 4.6, 3.8), { material: 'chrome', zEdge: -1, zTop: 11 });
    s.surface(circle(cx, y - lean, ball), {
      material: name, profile: 'dome', zEdge: 11, zTop: 15, over: { rough: 0.18, coat: 1, wear: d.wear * 0.3 },
    });
    if (p.focused) s.glow(circle(cx, y - lean, ball + 2), FOCUS);
  },
});

// Of a stick's radius, how far its head can lean.
const LEAN = 0.42;

/** One way a stick leans. The whole of it is the width of its well. */
const stickAxis = (o: { input: number; name: string; axis: 'x' | 'y' }, sign: number) => slide({
  ...o, mass: 23, material: 'plastic-on-rubber', return: 0.5, home: 0.5, stops: { landing: 'soft' },
  travel: p => (sign * Math.min(p.w, p.h)) / MM,
});

const leaning = together(stickAxis({ input: 0, name: 'x', axis: 'x' }, 1), stickAxis({ input: 1, name: 'y', axis: 'y' }, -1));

interface Lean {
  cx: number;
  cy: number;
  R: number;
  /** Where the stem's top has got to. */
  tx: number;
  ty: number;
  /** Draws what moves with the head, rigid, in the group its joint carries, given where the head's centre is at rest. */
  head(draw: (x: number, y: number) => void): void;
}

/** Where the joint has a stick's head, which goes less far than the hand had to push it. */
const headAt = (p: Part, head: number) => {
  const c = leaning.carried(p), lean = LEAN * head;
  return { ...c, x: c.x * lean, y: c.y * lean };
};

/** One form of the stick. They share how it leans and comes back, and only `head` of the lean carries a hand. */
const stick = (selector: string, draw: (s: Sheet, p: Part, d: DeviceInfo, at: Lean) => void, head = 1): PartDef => ({
  selector,
  ...leaning,
  /** A hand goes where the head goes, which is less far than the hand had to push it. */
  carried: (p: Part) => headAt(p, head),
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    const tx = cx + (p.springs.x!.value * 2 - 1) * R * LEAN, ty = cy - (p.springs.y!.value * 2 - 1) * R * LEAN;
    // The springs run 0 to 1 and rest in the middle, so the head's 0 is a lean's worth up and to the left of where it rests.
    const k = R * LEAN * head, at = headAt(p, head);
    draw(s, p, d, { cx, cy, R, tx, ty, head: f => s.group({ at: [at.x, at.y], carried: true }, () => f(cx - k, cy + k)) });
    if (p.focused) s.glow(circle(cx, cy, R + 2), FOCUS);
  },
});

// A joystick. Wrap two range inputs, across then up, and it sprints back to the middle.
definePart(stick('[d-stick=""]', (s, p, d, { cx, cy, R, tx, ty }) => {
  const name = p.el.getAttribute('material') || 'plastic-red';
  s.surface(circle(cx, cy, R), { material: 'black-oxide', bevel: 3, zEdge: 0, zTop: 1, over: { wear: d.wear * 0.4 } });
  s.surface(circle(cx, cy, R * 0.8, { ripple: [20, 1.6] }), { material: 'rubber', bevel: R * 0.5, zEdge: 1, zTop: 4.2 });
  s.surface(capsule(cx, cy, tx, ty, 5, 4.2), { material: 'chrome', zEdge: 4, zTop: 11, over: { rough: 0.2 } });
  s.surface(circle(tx, ty, R * 0.36), {
    material: name, profile: 'dome', zEdge: 7, zTop: 15, over: { rough: 0.16, coat: 1, wear: d.wear * 0.3 },
  });
}));

// A thumbstick: a hollow rubber cap on a short post, in a rounded well.
definePart(stick('[d-stick~="analog"]', (s, p, d, { cx, cy, R, tx, ty }) => {
  const cap = p.el.getAttribute('material') || 'silicone-black';
  const lean = { x: cx + (tx - cx) * 0.7, y: cy + (ty - cy) * 0.7 }, side = R * 1.8, pot = R * 0.5;
  // Loose, it's the whole module: a steel frame round the gimbal, with a pot on two sides, one for each way it leans. Guess, from a games-pad thumbstick.
  standing(s, p, 6, () => {
    s.surface(rect(cx + side / 2 - 0.5 * MM, cy - pot / 2, pot * 0.9, pot, { radius: 1 }), { material: 'plastic-black', bevel: 0.8, zEdge: 0, zTop: 4.5 });
    s.surface(rect(cx - pot / 2, cy + side / 2 - 0.5 * MM, pot, pot * 0.9, { radius: 1 }), { material: 'plastic-black', bevel: 0.8, zEdge: 0, zTop: 4.5 });
    s.surface(rect(cx - side / 2, cy - side / 2, side, side, { radius: 1.5 }), { material: 'satin-steel', bevel: 1, zEdge: 0, zTop: 6, profile: 'chamfer' });
  }, () => {
    s.well(circle(cx, cy, R), 2.4, { bevel: R * 0.3 });
    s.surface(circle(lean.x, lean.y, R * 0.34), { material: 'plastic-black', zEdge: -2, zTop: 3 });
    s.surface(circle(tx, ty, R * 0.68, { ripple: [36, 0.5] }), {
      material: cap, bevel: R * 0.14, zEdge: 3, zTop: 6, dish: 1.3, over: { touch: d.age * 0.8 },
    });
  });
}));

// A thin stem with a knurled head over an open gimbal, as on a radio transmitter. It stands in a slotted cup, and each axis slides its own plate along under the window.
definePart(stick('[d-stick~="gimbal"]', (s, p, _d, { cx, cy, R }) => {
  const head = p.el.getAttribute('material') || 'aluminium-pale', u = (p.springs.x!.value * 2 - 1) * R * 0.3, v = -(p.springs.y!.value * 2 - 1) * R * 0.3;
  s.surface(circle(cx, cy, R), { material: 'plastic-black', bevel: 1.6, zEdge: -0.2, zTop: 0.5 });
  s.well(circle(cx, cy, R * 0.86), 1.2, { bevel: R * 0.1 });
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const c = Math.cos(a), n = Math.sin(a), w = Math.abs(c) > 0.5 ? R * 0.2 : 1, h = Math.abs(c) > 0.5 ? 1 : R * 0.16;
    s.cut(rect(cx + c * R * 0.74 - w / 2, cy + n * R * 0.76 - h / 2, w, h), { depth: 0.2, ink: [0.05, 0.05, 0.05] });
  }
  const ww = R * 0.64, wh = R * 0.55;
  s.well(rect(cx - ww, cy - wh, ww * 2, wh * 2, { radius: 2 }), 4, { bevel: 1.4 });
  s.surface(rect(cx - ww, cy - wh, ww * 2, wh * 2, { radius: 2 }), { material: 'plastic-black', zEdge: -5.4, zTop: -5.2 });
  s.surface(rect(cx - ww + 2, cy + v - R * 0.16, ww * 2 - 4, R * 0.32, { radius: 1 }), { material: 'plastic-black', bevel: 0.8, zEdge: -5, zTop: -3.4 });
  s.surface(rect(cx + u - R * 0.17, cy - wh + 2, R * 0.34, wh * 2 - 4, { radius: 1 }), { material: 'plastic-black', bevel: 0.8, zEdge: -3.4, zTop: -2.4 });
  s.surface(circle(cx + u, cy + v, R * 0.08), { material: 'aluminium-pale', zEdge: -2.4, zTop: 3.4 });
  const hx = cx + u * 1.4, hy = cy + v * 1.4;
  s.surface(circle(hx, hy, R * 0.25, { ripple: [18, 0.7] }), { material: 'black-oxide', bevel: R * 0.05, zEdge: 3.4, zTop: 5 });
  s.surface(circle(hx, hy, R * 0.21, { ripple: [18, 0.5] }), { material: head, bevel: R * 0.06, zEdge: 5, zTop: 6, dish: 0.3 });
  s.surface(circle(hx, hy, R * 0.085), { material: 'chrome', bevel: R * 0.04, zEdge: 6, zTop: 6.2 });
}));

// A small five-way nub, pitted so a thumb stays on it.
definePart(stick('[d-stick~="hat"]', (s, p, d, { cx, cy, R, head }) => {
  const cap = p.el.getAttribute('material') || 'silicone-black', n = R * 0.62;
  s.well(circle(cx, cy, R), 1.4, { bevel: 1 });
  head((hx, hy) => {
    s.surface(circle(hx, hy, n), { material: cap, bevel: n * 0.3, zEdge: -1, zTop: 1.6, dish: 0.15, over: { touch: d.age * 0.5 } });
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (Math.hypot(i, j) * 2.6 < n * 0.76) s.cut(circle(hx + i * 2.6, hy + j * 2.6, 0.75), { depth: 0.3, ink: [0.012, 0.012, 0.013] });
  });
}, 0.5));

// A slide pad: a flat disc that doesn't tilt but slides across a shallow round well, as on a handheld. Its top is
// dished for the thumb, and `ring` on adds the raised rim some have round that dish.
definePart(stick('[d-stick~="slide"]', (s, p, d, { cx, cy, R, head }) => {
  const cap = p.el.getAttribute('material') || 'plastic-black', n = R * (1 - LEAN), top = num(p, 'height', 1.6);
  s.well(circle(cx, cy, R), 1.2, { bevel: R * 0.12 });
  head((tx, ty) => {
    s.surface(circle(tx, ty, n), { material: cap, bevel: n * 0.18, zEdge: -0.6, zTop: top, dish: n * 0.04, over: { touch: d.age * 0.6, wear: d.wear * 0.3 } });
    if (p.el.hasAttribute('ring')) s.surface(circle(tx, ty, n * 0.78), { material: cap, bevel: n * 0.08, zEdge: top, zTop: top + 0.4, dish: n * 0.06 });
  });
}));

const paddle = slide({ input: 0, mass: 23, material: 'plastic-on-rubber', return: 0.5, home: 0.5, stops: { landing: 'soft' }, axis: 'x', travel: p => p.w / MM });

// A short paddle standing out of a long slot, sprung to the middle, for bending a note. It rocks along the slot on a range input.
// `lean` is how much of the slot it can reach, 0 to 1.
definePart({
  selector: '[d-stick~="paddle"]',
  ...paddle,
  paint(s, p, d) {
    const name = p.el.getAttribute('material') || 'plastic-black', top = num(p, 'height', 11), wide = Math.min(p.w * 0.2, p.h * 0.9), r = 2, cy = p.y + p.h / 2;
    const cx = p.x + p.w / 2, tip = cx + (p.springs.slide!.value * 2 - 1) * (p.w - wide) * 0.5 * num(p, 'lean', 0.8), root = cx + (tip - cx) * 0.3, hw = wide / 2, hh = p.h * 0.34;
    s.well(rect(p.x, p.y, p.w, p.h, { radius: r }), 2.4, { bevel: 1 });
    s.surface(rect(root - hw * 0.7, cy - hh, hw * 1.4, hh * 2, { radius: r }), { material: name, bevel: 1, zEdge: -2, zTop: top * 0.5 });
    const head = rect(tip - hw, cy - hh, wide, hh * 2, { radius: r });
    s.surface(head, { material: name, profile: 'chamfer', bevel: 2.4, zEdge: top * 0.4, zTop: top, over: { wear: d.wear * 0.4, touch: d.age * 0.5 } });
    for (const k of [-0.5, -0.17, 0.17, 0.5]) s.cut(rect(tip + k * hw - 0.5, cy - hh + 3, 1, hh * 2 - 6), { depth: 0.4, ink: [0.012, 0.012, 0.012] });
    if (p.focused) s.glow(head, FOCUS);
  },
});

/** One way across a pad, which goes where the finger is. */
const padAxis = (o: { input: number; name: string; axis: 'x' | 'y' }, px: (p: Part) => number) => slide({
  ...o, touch: true, mass: 11, material: 'finger-on-glass', friction: 0.45, travel: p => px(p) / MM,
});

// A pad you touch anywhere, for two values at once. Wrap two range inputs, across then up.
definePart({
  selector: '[d-stick~="pad"]',
  ...together(padAxis({ input: 0, name: 'x', axis: 'x' }, p => p.w), padAxis({ input: 1, name: 'y', axis: 'y' }, p => -p.h)),
  mask(ctx, p) {
    const n = num(p, 'grid', 8);
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        ctx.beginPath();
        ctx.arc(p.x + 10 + (i / n) * (p.w - 20), p.y + 10 + (j / n) * (p.h - 20), 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p) {
    const name = p.el.getAttribute('material') || 'glass-black', c = lamp(p, 'cyan');
    const box = rect(p.x, p.y, p.w, p.h, { radius: 10 });
    const x = p.x + 10 + p.springs.x!.value * (p.w - 20), y = p.y + 10 + (1 - p.springs.y!.value) * (p.h - 20);
    s.surface(box, { material: name, bevel: 2, zEdge: 0, zTop: 0.6 });
    if (p.mask) s.cut(mask(p.mask), { ink: scale(c, 0.02), emit: scale(c, 0.04) });
    s.cut(rect(p.x + 10, y - 0.5, p.w - 20, 1), { ink: scale(c, 0.012), emit: scale(c, 0.06) });
    s.cut(rect(x - 0.5, p.y + 10, 1, p.h - 20), { ink: scale(c, 0.012), emit: scale(c, 0.06) });
    s.cut(circle(x, y, 7), { ink: scale(c, 0.03), emit: scale(c, 0.34) });
    s.glow(circle(x, y, 8), scale(c, 0.3), 1.5);
    if (p.focused) s.glow(box, FOCUS);
  },
});
