// Cameras.
import { circle, definePart, defineStyles, ellipse, FOCUS, hinge, input, legendColor, mask, MM, path, press, rect, setValue, turn, type Part, type PartDef, type Sheet, type SurfaceOptions } from 'device-ui';
import { key } from 'device-ui/controls/key';
import { controlStyles, font, ground, lying, num, nums, polar, upright } from 'device-ui/controls/shared';

defineStyles(`${controlStyles('[d-wheel~="lens"]', '[d-wheel~="drum"]')}
[d-mark~="ring"], [d-fixing~="cap"], [d-fixing~="lug"], [d-fixing~="turned"], [d-fixing~="crank"], [d-cover~="cap"] { display: block; }
[d-switch~="flick"] { display: block; touch-action: none; }
/* A press lands on the ring it's over, and a ring is round. */
[d-wheel~="lens"], [d-wheel~="lens"] input { border-radius: 50%; }
`);

const RAD = Math.PI / 180;

// A knurled ring round a lens: a disc with teeth at its edge, seen from the front, turned with a hand on it.
// Stack them narrowest last and each one shows as a ring. `from` and `to` are its ends, in degrees.
const lensRing = (joint: ReturnType<typeof turn>): PartDef => ({
  selector: '[d-wheel~="lens"]',
  ...joint,
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, material = p.el.getAttribute('material') || 'black-oxide';
    const rise = num(p, 'height', 6), teeth = num(p, 'teeth', 120);
    s.group(joint.place(p), () => {
      s.surface(circle(0, 0, R, { ripple: [teeth, 1.8] }), { material, rise, bevel: 3.2, over: { wear: d.wear * 0.3 } });
      // Where it has been turned to. From the front that's the one thing that shows it.
      s.cut(rect(-1, -R + 3, 2, 7, { radius: 0.5 }), { depth: 0.06, ink: legendColor(material), wear: d.wear * 0.2 });
    });
    if (p.focused) s.glow(circle(cx, cy, R + 1), FOCUS);
  },
});

const ends = (p: Part): [number, number] => [num(p, 'from', -45), num(p, 'to', 45)];

definePart(lensRing(turn({ mass: 30, material: 'metal-on-grease', input: true, hubless: true, detents: { strength: 0.2 }, stops: { at: ends } })));

// With `clicks` it's a sprung ball in a row of dimples, as on an aperture ring: light, and hard to stop between.
definePart({
  ...lensRing(turn({ mass: 8, material: 'brass-on-steel', input: true, hubless: true, detents: { strength: 0.6 }, stops: { at: ends } })),
  selector: '[d-wheel~="lens"][clicks]',
});

// Letters set round a circle, on whatever is under them. `text` runs clockwise from `start` degrees, or is centred on `at` degrees, and `radius` is mm to
// their middles. `under` sets it for reading along the bottom of the circle, running the other way with its tops to the middle. `height` casts the letters to stand that many mm, in place of engraving them.
definePart({
  selector: '[d-mark~="ring"]',
  mask(ctx, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = p.el.hasAttribute('radius') ? num(p, 'radius', 0) * MM : Math.min(p.w, p.h) / 2 - 8, spread = num(p, 'spread', 1.15);
    const line = p.el.getAttribute('text') ?? '';
    ctx.font = font(p, num(p, 'size', 2.25) * MM);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const way = p.el.hasAttribute('under') ? -1 : 1, centred = p.el.hasAttribute('at');
    let a = (centred ? num(p, 'at', 0) * RAD - (way * (ctx.measureText(line).width * spread)) / R / 2 : num(p, 'start', 0) * RAD);
    for (const ch of line) {
      const step = (way * ctx.measureText(ch).width * spread) / R;
      ctx.save();
      ctx.translate(cx + Math.sin(a + step / 2) * R, cy - Math.cos(a + step / 2) * R);
      ctx.rotate(a + step / 2 + (way < 0 ? Math.PI : 0));
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      a += step;
    }
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  },
  paint(s, p, d) {
    if (!p.mask) return;
    const tall = num(p, 'height', 0);
    s.cut(mask(p.mask), tall ? { depth: -tall, soft: 3, wear: d.wear * 0.5 } : { depth: 0.04, ink: legendColor(ground(p, d)), wear: d.wear * 0.2 });
  },
});

// A turned stack on an upright axis, seen from the side, its foot on the bottom of its box. `profile` is each step going up, diameter and height in mm.
definePart({
  selector: '[d-fixing~="turned"]',
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'satin-chrome', cx = p.x + p.w / 2;
    let y = p.y + p.h;
    for (const step of (p.el.getAttribute('profile') ?? '').split(',')) {
      const [across = p.w / MM, tall = p.h / MM] = step.trim().split(/\s+/).map(Number);
      y -= tall * MM;
      upright(s, cx, (across * MM) / 2, y, tall * MM, { material, over: { wear: d.wear * 0.5 } });
    }
  },
});

// A rewind crank folded down on its knob: a short turned drum on a shaft leaning `tilt` degrees, tipped towards you so its top shows as an ellipse,
// with the crank lying across that and its handle sprung into a notch at the rim. The box is the drum's width by all you see of it, `wall` is its side in mm.
definePart({
  selector: '[d-fixing~="crank"]',
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'satin-chrome', tilt = num(p, 'tilt', 0) * RAD, wall = num(p, 'wall', 4) * MM, over = { wear: d.wear * 0.5 };
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = p.w / 2, ry = (p.h - wall) / 2, top = -p.h / 2 + ry, rise = num(p, 'height', 6);
    const side = `M${-r} ${top} L${r} ${top} L${r} ${top + wall} A${r} ${ry} 0 0 1 ${-r} ${top + wall} Z`;
    s.group({ at: [cx, cy], rotate: tilt }, () => {
      s.surface(path(side, -r, -p.h / 2, p.w, p.h, { viewBox: [-r, -p.h / 2, p.w, p.h], spread: 6 }), { material, rise, bevel: r * 0.5, over });
      s.surface(ellipse(0, top, r, ry), { material, zEdge: rise * 0.86, zTop: rise, bevel: 2, over: { ...over, rough: 0.3 } });
      s.cut(rect(-r * 0.68, top - 0.5, r * 1.32, 1, { rotate: 0.26, radius: 0.5 }), { depth: 0.2, soft: 0.4, ink: [0.1, 0.1, 0.1] });
      s.surface(rect(r * 0.44, top + ry * 0.42, r * 0.34, ry * 0.42, { rotate: 0.26, radius: 1 }), { material, zEdge: rise, zTop: rise + 0.3, bevel: 1, over });
    });
  },
});

// A knurled drum seen from the side, on an upright axle, rolled sideways under a thumb through its stops.
const drum = (joint: ReturnType<typeof turn>): PartDef => ({
  selector: '[d-wheel~="drum"]',
  ...joint,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'satin-chrome', { x, y, w, h } = p, phase = p.springs.turn!.value, n = num(p, 'ribs', 60);
    const cap = Math.min(p.el.hasAttribute('cap') ? num(p, 'cap', 0) * MM : 0.3 * h, h), r = w / 2, cx = x + r;
    upright(s, cx, r, y + cap, h - cap, { material, over: { wear: d.wear * 0.5 } });
    if (cap) upright(s, cx, r - 2, y, cap, { material });
    for (let i = 0; i < n; i++) {
      const t = ((i / n) * Math.PI * 2 + phase) % (Math.PI * 2);
      if (Math.cos(t) < 0.12) continue;
      const u = Math.sin(t), thin = Math.max(Math.cos(t), 0.3) * 1.5;
      s.cut(rect(cx + u * (r - 0.6) - thin / 2, y + cap + 0.6, thin, h - cap - 1.2), { depth: 0.3, soft: 0.5, ink: [0.14, 0.14, 0.14] });
    }
    if (p.focused) s.glow(rect(x, y, w, h, { radius: 3 }), FOCUS);
  },
});

definePart(drum(turn({
  mass: 6, material: 'brass-on-steel', input: true, rolled: 'x', detents: { strength: 0.6 },
  stops: { at: p => [0, num(p, 'sweep', 300)] },
  travel: p => (num(p, 'sweep', 300) * RAD * p.w) / 2,
})));

// With `sprung` it's a ring turned either way against a spring, which takes it back to the middle of its input when it's let go,
// as a zoom lever round a shutter is. `sweep` is all of its throw, end to end.
const middle = (p: Part) => {
  const el = input(p);
  setValue(el, (+el.min + +el.max) / 2);
};
const sprung = (rolled: true | 'x', r: (p: Part) => number) => turn({
  mass: 3, material: 'steel-on-steel', input: true, rolled, return: 0.5,
  stops: { at: p => [-num(p, 'sweep', 40) / 2, num(p, 'sweep', 40) / 2] },
  travel: p => num(p, 'sweep', 40) * RAD * r(p),
  letGo: middle,
});
const sprungDrum = (def: PartDef, joint: ReturnType<typeof turn>, selector: string): PartDef => ({
  ...def,
  selector,
  connect(p) {
    const off = joint.connect!(p), up = () => middle(p);
    p.el.addEventListener('keyup', up);
    return () => {
      p.el.removeEventListener('keyup', up);
      off?.();
    };
  },
});
const lever = sprung('x', p => p.w / 2);
definePart(sprungDrum(drum(lever), lever, '[d-wheel~="drum"][sprung]'));

// With `across` its axle lies along the box, and it's rolled up or down under a thumb, or twisted in a fist, as a grip on a handlebar.
// `profile` is each step from the left, diameter and length in mm, for a grip that's turned down in stages; without one it fills its box.
const steps = (p: Part) => {
  let x = p.x;
  return (p.el.getAttribute('profile') ?? `${p.h / MM} ${p.w / MM}`).split(',').map(step => {
    const [across = p.h / MM, long = p.w / MM] = step.trim().split(/\s+/).map(Number), at = x;
    x += long * MM;
    return { x: at, r: (across * MM) / 2, w: long * MM };
  });
};
const grip = (joint: ReturnType<typeof turn>): PartDef => ({
  selector: '[d-wheel~="drum"][across]',
  ...joint,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'satin-chrome', phase = p.springs.turn!.value, n = num(p, 'ribs', 60), cy = p.y + p.h / 2;
    for (const { x, r, w } of steps(p)) {
      lying(s, cy, r, x, w, { material, over: { wear: d.wear * 0.5 } });
      for (let i = 0; i < n; i++) {
        const t = ((i / n) * Math.PI * 2 + phase) % (Math.PI * 2);
        if (Math.cos(t) < 0.12) continue;
        const v = Math.sin(t), thin = Math.max(Math.cos(t), 0.3) * 1.5;
        s.cut(rect(x + 0.6, cy + v * (r - 0.6) - thin / 2, w - 1.2, thin), { depth: 0.3, soft: 0.5, ink: [0.14, 0.14, 0.14] });
      }
    }
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: 3 }), FOCUS);
  },
});
definePart(grip(turn({
  mass: 6, material: 'brass-on-steel', input: true, rolled: true, detents: { strength: 0.6 },
  stops: { at: p => [0, num(p, 'sweep', 300)] },
  travel: p => (num(p, 'sweep', 300) * RAD * p.h) / 2,
})));
const twisted = sprung(true, p => p.h / 2);
definePart(sprungDrum(grip(twisted), twisted, '[d-wheel~="drum"][across][sprung]'));

// A release seen from the side: a threaded button pressed straight down into a collar. `travel` is mm.
definePart(key('[d-key~="plunger"]', {
  feel: { mass: 5, material: 'brass-on-steel', contact: 'press', return: 0.6, sound: 'shutter' },
  label: false,
  cap: 'satin-chrome',
  own: true,
  draw(s, p, d, k) {
    const { x, y, w, h } = p, drop = num(p, 'travel', 1.25) * MM * k.down, stem = w * 0.42, collar = h * 0.5, over = { wear: d.wear * 0.5 };
    upright(s, x + w / 2, stem / 2, y + drop, h - collar + 2, { material: k.cap, over });
    upright(s, x + w / 2, w / 2, y + h - collar, collar, { material: k.cap, over });
    k.focus(rect(x, y, w, h, { radius: 3 }));
  },
}));

/** The pad of a flick lever stands this far from the pin, of the part's height. Its pin is near the foot. */
const LEVER_PIN = 0.84;
const flick = turn({
  mass: 4, material: 'steel-on-steel', hubless: false, return: 0.4, contact: 'press', sound: 'cam',
  at: p => [p.w / 2, p.h * LEVER_PIN],
  stops: { at: p => [-num(p, 'throw', 16), 0] },
  letGo: p => p.el.setAttribute('turn', '0'),
});

// A sprung lever on a round foot, flicked over with a fingertip and back on its own when let go. `rest` is its lean in degrees, `inset` what fills its blade.
definePart({
  selector: '[d-switch~="flick"]',
  ...flick,
  connect(p) {
    const off = flick.connect(p), up = () => p.el.setAttribute('turn', '0');
    p.el.addEventListener('keyup', up);
    return () => {
      p.el.removeEventListener('keyup', up);
      off();
    };
  },
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'satin-chrome', inset = p.el.getAttribute('inset') || 'well', rise = num(p, 'height', 1.2);
    const hw = p.w * 0.27, foot = p.w / 2, pin = p.h * LEVER_PIN, top = -pin + 1;
    // Its lean at rest is part of how it's drawn, so it's turned inside the joint's group.
    s.group(flick.place(p), () => s.group({ rotate: num(p, 'rest', 0) * RAD }, () => {
      s.surface(rect(-hw, top, hw * 2, pin, { radius: 2 }), { material, rise, bevel: 2, over: { wear: d.wear * 0.6 } });
      s.surface(rect(-hw * 0.56, top + 3, hw * 1.12, pin * 0.46, { radius: 1 }), { material: inset, zEdge: rise, zTop: rise - 0.25, bevel: 1 });
      s.surface(circle(0, 0, foot), { material, rise: rise + 0.5, bevel: 3, over: { wear: d.wear * 0.6 } });
    }));
    if (p.focused) s.glow(circle(p.x + p.w / 2, p.y + pin, foot + 1), FOCUS);
  },
});

// A round cap screwed in flush, with a knurled ring to turn it by and `inset` in the middle.
definePart({
  selector: '[d-fixing~="cap"]',
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, material = p.el.getAttribute('material') || 'black-oxide';
    const inset = p.el.getAttribute('inset') || material, rise = num(p, 'height', 0.9);
    s.surface(circle(cx, cy, R, { ripple: [num(p, 'teeth', 90), 0.7] }), { material, rise, bevel: 1.6, over: { wear: d.wear * 0.5 } });
    s.surface(circle(cx, cy, R * 0.72), { material, zEdge: rise, zTop: rise - 0.35, bevel: 2 });
    s.surface(circle(cx, cy, R * 0.62), { material: inset, zEdge: rise - 0.35, zTop: rise - 0.2, bevel: 1 });
  },
});

// A flat lug with a round hole, to take a strap ring. It stands off the side of a body, its hole at the outer end. `side` is left or right.
definePart({
  selector: '[d-fixing~="lug"]',
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'satin-chrome', right = p.el.getAttribute('side') === 'right', rise = num(p, 'height', 1.4);
    const R = p.h / 2, hole = p.h * 0.2, cx = right ? p.w - R : R, cy = R, far = right ? 0 : p.w;
    const shape = `M${far} ${cy - R * 0.72} L${cx} 0 A${R} ${R} 0 0 ${right ? 1 : 0} ${cx} ${p.h} L${far} ${cy + R * 0.72} Z M${cx + hole} ${cy} A${hole} ${hole} 0 1 0 ${cx - hole} ${cy} A${hole} ${hole} 0 1 0 ${cx + hole} ${cy} Z`;
    s.surface(path(shape, p.x, p.y, p.w, p.h, { viewBox: [0, 0, p.w, p.h], rule: 'evenodd', spread: 6 }), { material, zEdge: rise * 0.2, zTop: rise, bevel: 1.6, over: { wear: d.wear * 0.5 } });
  },
});

const cap = hinge({ mass: 40, material: 'steel-on-steel', axis: 'y', travel: -6, contact: 'toggle' });

// A shallow cap in a frame, with `inset` let into its top. Click it and it lifts clear on its hinge, `lift` mm. `inset`'s margins are `margin`, mm: top, right, bottom, left.
definePart({
  selector: '[d-cover~="cap"]',
  ...cap,
  paint(s, p, d) {
    const material = p.el.getAttribute('material') || 'brushed-chrome', panel = p.el.getAttribute('inset') || 'leather-saddle', r = num(p, 'radius', 1.5) * MM;
    const rise = num(p, 'height', 2.4) + num(p, 'lift', 2.4) * cap.value(p), [t = 16, m = 16, b = 16, l = 16] = nums(p, 'margin', []).map(v => v * MM);
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: r }), { material, rise, bevel: 6, over: { wear: d.wear * 0.5 } });
    s.surface(rect(p.x + l, p.y + t, p.w - l - m, p.h - t - b, { radius: Math.max(r - 3, 2) }), { material: panel, zEdge: rise, zTop: rise - 0.2, bevel: 1.2 });
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: r }), FOCUS);
  },
});
