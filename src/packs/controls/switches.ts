// Things that flip between states.
import { capsule, circle, definePart, FOCUS, hinge, input, legendColor, linear, mask, MM, path, poly, rect, slide, turn, type DeviceInfo, type Part, type Point, type Sheet } from 'device-ui';
import { font, ground, lamp, num, scale, standing } from './shared.js';
import { bushing, collar, hexNut, ringNut } from './anatomy.js';

/** A bat handle through a round collar, thrown `t` from -1 down to 1 up. `nut` puts it through a threaded bush and a hex nut instead (`nut="knurled"` a knurled ring nut), `handle="paddle"` makes the handle a flat paddle, `slot` through a long black escutcheon, and `tip` caps it in that material. */
function bat(s: Sheet, p: Part, t: number, across = false): void {
  // Loose, it stands on its body: a phenolic base under the steel frame the bush comes up through. Guess, from a miniature toggle.
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, bw = 8 * MM, bh = 13 * MM, tall = 10;
  standing(s, p, tall, () => {
    s.surface(rect(cx - bw / 2, cy - bh / 2, bw, bh, { radius: 2 }), { material: 'plastic-black', bevel: 1.5, zEdge: 0, zTop: tall - 0.8 });
    s.surface(rect(cx - bw / 2, cy - bh / 2 + 0.75 * MM, bw, bh - 1.5 * MM, { radius: 1 }), { material: 'satin-steel', bevel: 1, zEdge: tall - 0.8, zTop: tall, profile: 'chamfer' });
  }, () => front(s, p, t, across));
}

/** The toggle as it shows through a panel. */
function front(s: Sheet, p: Part, t: number, across = false): void {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = across ? Math.min(p.h, p.w * 0.6) / 2 : Math.min(p.w, p.h * 0.6) / 2;
  const tip = p.el.getAttribute('tip');
  if (p.el.hasAttribute('slot')) {
    const box = rect(p.x, p.y, p.w, p.h, { radius: p.w / 2 });
    s.surface(box, { material: 'plastic-black', bevel: 2, zEdge: 0, zTop: 1 });
    s.well(rect(p.x + p.w * 0.3, p.y + p.w * 0.3, p.w * 0.4, p.h - p.w * 0.6, { radius: p.w * 0.2 }), 2, { bevel: 0.8, zEdge: 1, zTop: -1 });
  } else {
    // What holds it in the panel, in mm round its middle: a hex or knurled nut on the bush, or a plain collar.
    const r = R / MM, nut = p.el.getAttribute('nut');
    s.group({ at: [cx, cy], scale: MM }, () => {
      if (nut === null) return collar(s, r * 2, r * 0.38, 0, 1.3);
      if (nut === 'knurled') ringNut(s, r * 2, 0, 2.4);
      else hexNut(s, r * Math.sqrt(3), 0, 2.4);
      bushing(s, r * 1.32, 2.4, 2.2, { hole: r * 0.8 });
    });
  }
  const reach = t * R * 1.5 || 0.5, endX = across ? cx + reach : cx, endY = across ? cy : cy - reach, paddle = p.el.getAttribute('handle') === 'paddle';
  // `handle`: a bat, round and swelling to its end, or a paddle, flat and wide as on a panel you work with gloves.
  if (paddle) s.surface(capsule(cx, cy, endX, endY, 5.5, 5.5), { material: tip || 'chrome', profile: 'flat', bevel: 1.5, over: { rough: 0.16 }, zEdge: 0, zTop: 12 });
  else s.surface(capsule(cx, cy, endX, endY, 3.1, 6.2), { material: 'chrome', over: { rough: 0.16 }, zEdge: 0, zTop: 15 });
  if (tip && !paddle) s.surface(circle(endX, endY, 6), { material: tip, profile: 'dome', zEdge: 13, zTop: 16 });
  if (p.focused) s.glow(circle(cx, cy, R + 3), FOCUS);
}

// A bat handle through a collar, on a checkbox. It flips up and down.
definePart({
  selector: '[d-switch~="toggle"]',
  ...hinge({ mass: 1.1, material: 'steel-on-steel', input: true, axis: 'y', travel: -6 }),
  paint(s, p) {
    bat(s, p, p.springs.hinge!.value);
  },
});

// A toggle sprung to its centre, which is off, with a momentary contact each way. It wraps a range of 0, 1 and 2: up reads 2, down reads 0, and it comes back to 1.
definePart({
  selector: '[d-switch~="spring"]',
  ...slide({ input: 0, mass: 1.1, material: 'steel-on-steel', axis: 'y', travel: -6, touch: true, detents: true, contact: 'toggle', return: 0.5, home: 0.5 }),
  paint(s, p) {
    bat(s, p, p.springs.slide!.value * 2 - 1);
  },
});

// A toggle that stays where it's thrown, on a range: two positions or more, the highest at the top, with a click at each.
definePart({
  selector: '[d-switch~="throw"]',
  ...slide({ input: 0, mass: 1.1, material: 'steel-on-steel', axis: 'y', travel: -6, touch: true, detents: true, contact: 'toggle' }),
  paint(s, p) {
    bat(s, p, p.springs.slide!.value * 2 - 1);
  },
});

// The same toggle on its side, thrown left and right, the highest value to the right. Give it a wide box.
definePart({
  selector: '[d-switch~="throw"][across]',
  ...slide({ input: 0, mass: 1.1, material: 'steel-on-steel', axis: 'x', travel: 6, touch: true, detents: true, contact: 'toggle' }),
  paint(s, p) {
    bat(s, p, p.springs.slide!.value * 2 - 1, true);
  },
});

const rocker = (axis: 'x' | 'y') => ({
  ...hinge({ mass: 2.5, input: true, axis, travel: axis === 'x' ? 6 : -6 }),
  mask(ctx: OffscreenCanvasRenderingContext2D, p: Part) {
    if (p.el.hasAttribute('bare') || p.el.hasAttribute('blank')) return;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, h = p.h * 0.17;
    ctx.fillRect(cx - 1.2, cy - p.h * 0.25 - h / 2, 2.4, h);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + p.h * 0.25, h * 0.46, 0, Math.PI * 2);
    ctx.stroke();
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s: Sheet, p: Part, d: DeviceInfo) {
    const name = p.el.getAttribute('material') || 'plastic-black', cap = p.el.getAttribute('cap') || name, bare = p.el.hasAttribute('bare'), flip = p.el.hasAttribute('flip');
    const value = p.springs.hinge!.value, t = flip ? -value : value, c = lamp(p, 'red'), on = (value + 1) / 2, frame = bare ? 0 : num(p, 'frame', 0.625) * MM, g = bare ? 1.5 : frame + 1, w = p.w - g * 2, h = p.h - g * 2;
    const disc = p.el.hasAttribute('round'), D = Math.min(p.w, p.h);
    const outer = disc ? circle(p.x + p.w / 2, p.y + p.h / 2, D / 2) : rect(p.x, p.y, p.w, p.h, { radius: 4 });
    const inner = disc ? circle(p.x + p.w / 2, p.y + p.h / 2, D / 2 - frame) : rect(p.x + frame, p.y + frame, p.w - frame * 2, p.h - frame * 2, { radius: 3 });
    if (!bare) s.surface(outer, { material: name, bevel: 2, zEdge: 0, zTop: disc ? 1.8 : 1.2, profile: disc ? 'dome' : undefined });
    s.surface(inner, { material: 'well', bevel: 1, zEdge: bare ? 0 : 1.2, zTop: -0.6 });
    const glow = p.el.hasAttribute('lit') ? { emit: scale(c, num(p, 'glow', 0.05) * on) } : {};
    // `round` is the round-bezel rocker of a power strip: the rocker is a disc split across its hinge.
    const round = p.el.hasAttribute('round'), cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = Math.min(w, h) / 2;
    const half = (k: number) => poly(Array.from({ length: 25 }, (_, i): Point => {
      const a = (axis === 'x' ? Math.PI / 2 : 0) + Math.PI * (k < 0 ? 1 + i / 24 : i / 24);
      return [cx + Math.cos(a) * r - (axis === 'x' ? k : 0), cy + Math.sin(a) * r - (axis === 'y' ? k : 0)];
    }));
    const first = round ? half(-1) : axis === 'x' ? rect(p.x + g, p.y + g, w / 2 + 1, h, { radius: 2.5 }) : rect(p.x + g, p.y + g, w, h / 2 + 1, { radius: 2.5 });
    const second = round ? half(1) : axis === 'x' ? rect(p.x + p.w / 2 - 1, p.y + g, w / 2 + 1, h, { radius: 2.5 }) : rect(p.x + g, p.y + p.h / 2 - 1, w, h / 2 + 1, { radius: 2.5 });
    const swing = bare ? 2.6 : 1.8, rest = bare ? 3.4 : 3;
    // The lamp sits in the end that goes in when it's on.
    s.surface(first, { material: cap, bevel: 4, zEdge: 0.5 - t, zTop: rest - swing * t, over: { wear: d.wear * 0.3, ...(flip && !p.el.hasAttribute('whole') ? {} : glow) } });
    s.surface(second, { material: cap, bevel: 4, zEdge: 0.5 + t, zTop: rest + swing * t, over: { wear: d.wear * 0.3, ...(flip || p.el.hasAttribute('whole') ? glow : {}) } });
    if (p.mask) s.cut(mask(p.mask), { depth: 0.08, ink: [0.8, 0.8, 0.78], emit: p.el.hasAttribute('lit') ? scale(c, 0.5 * on) : undefined, wear: d.wear * 0.3 });
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: 4 }), FOCUS);
  },
});

// A rocker in a frame, tipped by a checkbox. `lit` puts a lamp in the on side, or under both with `whole`, and `glow` is how bright. `bare` is a plain paddle in a slot, with no frame and no marks.
// `blank` is the frame with no marks, for a panel that prints its own. `cap` is the rocker's material where it isn't the frame's, `frame` the frame's width in mm, and `flip` puts on at the bottom end.
definePart({ selector: '[d-switch~="rocker"]', ...rocker('y') });
// The same rocker on its side, tipping left and right.
definePart({ selector: '[d-switch~="rocker"][across]', ...rocker('x') });

const nubbed = slide({
  input: 0, mass: 3.4, friction: 0.3, detents: true, contact: 'toggle', click: true,
  axis: p => (p.h > p.w ? 'y' : 'x'), travel: p => (p.h > p.w ? 4 - p.h * (1 - num(p, 'nub', 0.46)) : p.w * (1 - num(p, 'nub', 0.46)) - 4) / MM,
});

// A ribbed nub in a slot. Works with a checkbox, or a range for three or more positions. `pill` rounds the slot's ends,
// `nub` is how much of it the nub fills, and `mark` prints a dot of that colour on the nub. `fin` makes the nub a low plate with a raised ridge across it, for a thumb, and `plain` leaves its ribs off.
// `lit` puts a lamp behind the slot, which fills as the nub slides over. `height` is how far the nub stands, mm.
definePart({
  selector: '[d-slider~="nub"]',
  ...nubbed,
  paint(s, p, d) {
    // Loose, it's the whole switch: a steel plate with an ear and a screw hole at each end, on its moulded base. Guess, from a miniature slide switch.
    const along = p.w >= p.h, ear = 3.5 * MM, side = 1.2 * MM, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const plate = along ? rect(p.x - ear, p.y - side, p.w + ear * 2, p.h + side * 2, { radius: 1.5 }) : rect(p.x - side, p.y - ear, p.w + side * 2, p.h + ear * 2, { radius: 1.5 });
    standing(s, p, 3.5, () => {
      s.surface(rect(p.x - side, p.y - side, p.w + side * 2, p.h + side * 2), { material: 'plastic-black', bevel: 1, zEdge: 0, zTop: 3 });
      s.surface(plate, { material: 'satin-steel', bevel: 0.8, zEdge: 3, zTop: 3.5, profile: 'chamfer' }, () => {
        for (const k of [-1, 1]) s.well(circle(along ? cx + k * (p.w / 2 + ear / 2) : cx, along ? cy : cy + k * (p.h / 2 + ear / 2), 0.9 * MM), 1, { bevel: 0.4 });
      });
    }, () => {
      const name = p.el.getAttribute('material') || 'plastic-black';
      const across = p.w >= p.h, t = p.springs.slide!.value;
      const r = p.el.hasAttribute('pill') ? Math.min(p.w, p.h) / 2 : 3, nub = num(p, 'nub', 0.46), mark = p.el.getAttribute('mark');
      const lit = p.el.hasAttribute('lit') ? { over: { emit: scale(lamp(p, 'white'), 0.012 + 0.13 * t) } } : {};
      s.well(rect(p.x, p.y, p.w, p.h, { radius: r }), 1.4, { bevel: 1.5, ...lit });
      const nw = across ? p.w * nub : p.w - 4, nh = across ? p.h - 4 : p.h * nub;
      const fin = p.el.hasAttribute('fin');
      // The nub is what the slide carries: drawn where it rests, from the part's top left, in the group the joint moves.
      s.group(nubbed.place(p), () => {
        const nx = 2, ny = across ? 2 : p.h - nh - 2;
        s.surface(rect(nx, ny, nw, nh, { radius: Math.max(r - 2, 2) }), {
          material: name, bevel: fin ? 3 : 2, zEdge: -1.2, zTop: num(p, 'height', fin ? 1.6 : 2.6), over: { wear: d.wear * 0.4 },
        });
        if (fin) {
          const wide = (across ? nw : nh) * 0.4, ridge = across ? rect(nx + (nw - wide) / 2, ny, wide, nh, { radius: 2 }) : rect(nx, ny + (nh - wide) / 2, nw, wide, { radius: 2 });
          s.surface(ridge, { material: name, profile: 'chamfer', bevel: wide * 0.46, zEdge: 1.2, zTop: 5, over: { wear: d.wear * 0.4 } });
        }
        const n = fin || p.el.hasAttribute('plain') ? 0 : 5;
        for (let i = 0; i < n; i++) {
          const k = (i + 1) / (n + 1);
          s.cut(across ? rect(nx + nw * k - 0.7, ny + 2, 1.4, nh - 4) : rect(nx + 2, ny + nh * k - 0.7, nw - 4, 1.4), {
            depth: 0.5, ink: [0.012, 0.012, 0.012],
          });
        }
        if (mark) s.cut(rect(nx + nw / 2 - nw * 0.1, ny + nh / 2 - nh * 0.14, nw * 0.2, nh * 0.28, { radius: 1 }), { ink: linear(mark), rough: 0.4 });
      });
      if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: r }), FOCUS);
    });
  },
});

// The slot in a barrel, with a ward cut into its side, up when it's off.
const KEYWAY = 'M44 8 H56 V40 H64 V50 H56 V92 H44 Z';

const barrel = turn({ mass: 100, material: 'brass-on-steel', input: true, detents: true, stops: { at: [0, 90] }, travel: 40, contact: 'toggle', click: true });

// A barrel lock seen from the front, filling its box, with a key standing straight out of it, so all that shows of the key is the edge of its
// bow. `material` is the collar and `core` the barrel. `key` is the key's material, or `none` for a lock with the key out, whose barrel still
// turns. `height` is how far the key stands, mm. `labels` are printed outside the box: off above, on to the right.
definePart({
  selector: '[d-switch~="key"]',
  ...barrel,
  mask(ctx, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    const [off = '', on = ''] = (p.el.getAttribute('labels') ?? 'OFF,ON').split(',').map(l => l.trim());
    ctx.font = font(p, 10);
    const tall = 14, gap = 5, wide = Math.max(ctx.measureText(off).width / 2 - R, 0), past = ctx.measureText(on).width + gap;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(off, cx, cy - R - gap - tall / 2);
    ctx.textAlign = 'left';
    ctx.fillText(on, cx + R + gap, cy);
    return { x: p.x - wide, y: p.y - gap - tall, w: p.w + wide + Math.max(past, wide), h: p.h + gap + tall };
  },
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, r = R * 0.72;
    const made = p.el.getAttribute('key') || 'brass';
    if (p.mask) s.cut(mask(p.mask), { ink: legendColor(ground(p, d)), wear: d.wear * 0.3 });
    s.surface(circle(cx, cy, R), { material: p.el.getAttribute('material') || 'brushed-steel', radial: true, bevel: R * 0.2, zEdge: 0, zTop: 1.6 });
    s.surface(circle(cx, cy, r), {
      material: p.el.getAttribute('core') || 'brass', radial: true, bevel: R * 0.1, zEdge: 1, zTop: 1.8, over: { aniso: 0.7 },
    });
    // The keyway and the key turn with the barrel: drawn upright round the pin, in the group the joint turns.
    s.group(barrel.place(p), () => {
      s.cut(path(KEYWAY, -r, -r, r * 2, r * 2, { spread: 4 }), { depth: 1.1, ink: [0.02, 0.018, 0.015] });
      if (made !== 'none') {
        const t = R * 0.2, L = R * 1.5;
        s.surface(rect(-t / 2, -L / 2, t, L, { radius: t / 2 }), { material: made, profile: 'round', bevel: t / 2, zEdge: 1.8, zTop: 1.8 + num(p, 'height', 10) });
      }
    });
    if (p.focused) s.glow(circle(cx, cy, R + 2), FOCUS);
  },
});

// Lifted by its own checkbox only, so what it guards can still be pressed. A click that followed a drag lands on the part.
const cover = hinge({ mass: 1000, input: true, axis: 'y', travel: -12, accepts: (p, e) => e.target === input(p) || e.target === p.el });

// A hinged safety cover. What it guards can only be reached with the cover up.
definePart({
  selector: '[d-cover~="guard"]',
  layer: 1,
  ...cover,
  update(p) {
    cover.update(p);
    const open = input(p).checked;
    // A shut cover stops the keyboard too.
    for (const el of p.el.children as HTMLCollectionOf<HTMLElement>) if (el !== input(p) && el.inert === open) el.inert = !open;
  },
  paint(s, p, d) {
    const name = p.el.getAttribute('material') || 'plastic-red';
    const t = (p.springs.hinge!.value + 1) / 2, lift = Math.cos(t * Math.PI * 0.56);
    const hinge = p.y + 5, h = (p.h - 6) * Math.abs(lift), w = p.w;
    s.surface(rect(p.x + 2, p.y, w - 4, 10, { radius: 2 }), { material: 'black-oxide', bevel: 2, zEdge: 0, zTop: 2 });
    const y = lift >= 0 ? hinge : hinge - h;
    s.surface(rect(p.x, y, w, Math.max(h, 1), { radius: 4 }), {
      material: name, bevel: 4, zEdge: 1 + t * 6, zTop: 8 + t * 6, dish: 1, over: { wear: d.wear * 0.5, coat: 0.5 },
    });
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: 4 }), FOCUS);
  },
});
