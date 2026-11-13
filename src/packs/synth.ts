// Things that make music by hand: flat keys, knobs on a panel, and a platter you can catch.
import { capsule, circle, definePart, defineStyles, FOCUS, grow, legendColor, linear, motor, partOf, path, rect, text, turn, union, type Part, type Shape, type Sheet, type Solid } from 'device-ui';
import 'device-ui/controls/knob';
import { key, legend, words } from 'device-ui/controls/key';
import { controlStyles, font, nums, num, polar } from 'device-ui/controls/shared';

defineStyles(`
${controlStyles('[d-knob~="wing"]', '[d-knob~="ribbed"]', '[d-knob~="flange"]', '[d-switch~="bar"]', '[d-wheel~="spin"]')}
[d-knob~="wing"], [d-knob~="ribbed"], [d-knob~="flange"], [d-knob~="wing"] input, [d-knob~="ribbed"] input, [d-knob~="flange"] input { border-radius: 50%; }
[d-wheel~="spin"], [d-wheel~="spin"]:focus-visible, [d-switch~="bar"], [d-switch~="bar"]:focus-visible { outline: none; border-radius: 50%; }
[d-switch~="bar"] { border-radius: 0; }
`);

const RAD = Math.PI / 180;
const MM = 4;

// A square rubber pad to play with a finger, standing out of a well. It gives under a hit and comes back slowly. `material` is its rubber,
// `height` is mm and `travel` how far it gives.
definePart(key('[d-key~="drum"]', {
  feel: { mass: 4, material: 'rubber-on-plastic', friction: 0.3 },
  label: false,
  cap: 'rubber-grey',
  own: true,
  draw(s, p, d, k) {
    const name = k.cap, down = k.down, top = num(p, 'height', 3), travel = num(p, 'travel', 1.4);
    s.well(rect(p.x - 1.5, p.y - 1.5, p.w + 3, p.h + 3, { radius: 3 }), 0.8, { bevel: 0.5 });
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 3 }), { material: name, profile: 'round', bevel: 4, zEdge: -0.8, zTop: top - travel * down, dish: 0.15, over: { touch: d.age * 0.8 } });
    k.focus(rect(p.x, p.y, p.w, p.h, { radius: 3 }));
  },
}));


// A square tile of a keybed with a soft boss moulded on it, the whole thing on a rubber dome. `boss` is `round`, `pill`
// or `none`, and `cap` makes it another colour. `inlay` is a disc of another material set into the boss, `at` is how far
// across the tile the boss sits, 0 to 1, and `size` is its radius in mm. Sits in a well, which shows round it as a gap.
definePart(key('[d-key~="tile"]', {
  feel: { mass: 4, material: 'plastic-on-rubber', friction: 0.2, sound: 'dome' },
  cap: 'plastic-white',
  own: true,
  draw(s, p, d, k) {
    const name = k.cap, cap = p.el.getAttribute('cap') || name, down = k.down, boss = p.el.getAttribute('boss') || 'round';
    const top = 1.7 - 0.9 * down, cx = p.x + p.w * num(p, 'at', 0.5), cy = p.y + p.h / 2, gap = num(p, 'gap', 0.15) * MM, R = num(p, 'size', 5.6) * MM;
    const face = rect(p.x + gap, p.y + gap, p.w - gap * 2, p.h - gap * 2, { radius: 2.4 });
    s.surface(face, { material: name, profile: 'chamfer', bevel: 2, zEdge: 0.4, zTop: top, over: { touch: d.age * 0.5 } });
    const above = { zEdge: top, zTop: top + 0.75 };
    if (boss === 'pill') {
      const hw = R, hh = p.h / 2 - 2 * MM;
      s.surface(capsule(cx, cy - hh + hw, cx, cy + hh - hw, hw, hw), { material: cap, bevel: 3, profile: 'chamfer', zEdge: top, zTop: top + 0.4 });
    } else if (boss === 'round') {
      s.surface(circle(cx, cy, R), { material: cap, bevel: R * 0.4, profile: 'round', ...above, dish: 0.25 });
      const inlay = p.el.getAttribute('inlay');
      if (inlay) s.surface(circle(cx, cy, R * 0.74), { material: inlay, bevel: 1, profile: 'round', zEdge: top + 0.55, zTop: top + 0.85 });
    }
    legend(s, p, cap, { depth: 0.03, wear: d.wear * 0.2 });
    k.focus(face);
  },
}));

// A knob on a stepped switch points wherever its stops say, so all three of these read `from` and `to`, in degrees from straight up.
const stepped = turn({ mass: 9, material: 'metal-on-grease', input: true, detents: { strength: 0.9 }, travel: 220, stops: { at: p => [num(p, 'from', -135), num(p, 'to', 135)] } });
// The switch's bush and nut as they show round a knob: a dark washer on the panel and a turned collar in it, `collar` being its metal. Fills R.
const collared = (s: Sheet, cx: number, cy: number, R: number, material: string) => {
  s.surface(circle(cx, cy, R), { material: 'black-oxide', profile: 'chamfer', bevel: R * 0.05, zEdge: 0, zTop: 0.5 });
  s.surface(circle(cx, cy, R * 0.88), { material, profile: 'round', bevel: R * 0.24, zEdge: 0.5, zTop: 3, radial: true });
};
// The wings' outline, the pointing end up, in a box of 100 across: blunt at both ends and as wide as the head where they meet it.
const WING = 'M41 3Q50 1 59 3Q62 4 63 7L82 32Q84 36 84 40V62Q84 66 82 69L66 94Q64 97 60 97H40Q36 97 34 94L18 69Q16 66 16 62V40Q16 36 18 32L37 7Q38 4 41 3Z';

// A winged pointer knob on a rotary switch: a round head with a pair of moulded wings under it, the longer one pointing, on a collar. It fills its box with the collar.
// `material` is the moulding, `collar` the metal round it, `mark` the line let into the pointing wing, `size` how much of the box the wings span, and `height` is mm.
definePart({
  selector: '[d-knob~="wing"]',
  ...stepped,
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, name = p.el.getAttribute('material') || 'plastic-red';
    const reach = R * num(p, 'size', 0.96), head = reach * 0.6, top = num(p, 'height', 18), wing = top * 0.42, mark = linear(p.el.getAttribute('mark') || '#e8e6dd');
    collared(s, cx, cy, R, p.el.getAttribute('collar') || 'satin-chrome');
    s.group(stepped.place(p), () => {
      s.surface(path(WING, -reach, -reach, reach * 2, reach * 2, { viewBox: [0, 0, 100, 100] }), { material: name, profile: 'chamfer', bevel: reach * 0.1, zEdge: 3, zTop: wing, over: { touch: d.age * 0.3 } });
      s.cut(rect(-reach * 0.022, -reach * 0.95, reach * 0.044, reach * 0.3), { depth: 0.08, ink: mark });
      s.surface(circle(0, 0, head), { material: name, profile: 'chamfer', bevel: head * 0.09, zEdge: wing, zTop: top, over: { touch: d.age * 0.5 } });
    });
    if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
  },
});

// A ribbed moulded knob with a smooth domed top and a short line at its foot to point with, turning a stepped switch. `size` is how much of its box it fills, and what's left shows `collar` if it has one.
// `lift` stands it that many mm up, on a `flange` of its own switch's outer shaft: it's the inner knob of a concentric pair. `cap` is its top, `mark` the line, `ribs` how many, and `height` how far it rises, mm.
definePart({
  selector: '[d-knob~="ribbed"]',
  ...stepped,
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, box = Math.min(p.w, p.h) / 2, R = box * num(p, 'size', 1), name = p.el.getAttribute('material') || 'keycap-grey', cap = p.el.getAttribute('cap') || name;
    const collar = p.el.getAttribute('collar'), lift = collar ? 3 : num(p, 'lift', 0), top = lift + num(p, 'height', 15), mark = linear(p.el.getAttribute('mark') || '#e8e6dd');
    if (collar) collared(s, cx, cy, box, collar);
    s.group(stepped.place(p), () => {
      s.surface(circle(0, 0, R, { ripple: [num(p, 'ribs', 22), R * 0.022] }), { material: name, bevel: R * 0.05, zEdge: lift, zTop: top - 1.2 });
      s.cut(rect(-R * 0.03, -R * 1.02, R * 0.06, R * 0.24), { depth: 0.08, ink: mark });
      s.surface(circle(0, 0, R * 0.78), { material: cap, profile: 'dome', zEdge: top - 1.2, zTop: top, over: { touch: d.age * 0.4 } });
    });
    if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
  },
});

// The outer knob of a concentric pair: a low spun metal flange with a knurled rim and a line to point with, turning its own stepped switch. It fills its box. A `ribbed` knob with `lift` stands in the middle of it.
// `material` is the metal, `mark` the line, `knurl` how many teeth, `bore` how much of it the inner knob's well takes, and `height` is mm.
definePart({
  selector: '[d-knob~="flange"]',
  ...stepped,
  paint(s, p, d) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, name = p.el.getAttribute('material') || 'satin-chrome', top = num(p, 'height', 5), bore = R * num(p, 'bore', 0.62);
    const mark = linear(p.el.getAttribute('mark') || '#141414');
    s.group(stepped.place(p), () => {
      s.surface(circle(0, 0, R, { ripple: [num(p, 'knurl', 120), R * 0.008] }), { material: name, bevel: R * 0.02, zEdge: 0, zTop: top * 0.5, over: { wear: d.wear * 0.3 } });
      s.surface(circle(0, 0, R * 0.93), { material: name, profile: 'round', bevel: R * 0.3, zEdge: top * 0.5, zTop: top, radial: true, over: { touch: d.age * 0.2 } });
      s.cut(circle(0, 0, bore), { depth: 0.3, soft: 0.6, ink: [0.02, 0.02, 0.022] });
      s.cut(rect(-R * 0.012, -R * 0.9, R * 0.024, R * 0.28), { depth: 0.06, ink: mark });
    });
    if (p.focused) s.glow(circle(cx, cy, R), FOCUS);
  },
});

// A length of piano hinge laid along an edge: a barrel of rolled knuckles the whole length of its box. `pitch` is mm from knuckle to knuckle.
definePart({
  selector: '[d-fixing~="hinge"]',
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'satin-steel', pitch = num(p, 'pitch', 8) * MM, wide = p.w >= p.h, long = wide ? p.w : p.h, thick = wide ? p.h : p.w;
    s.surface(rect(p.x, p.y, p.w, p.h), { material, profile: 'round', bevel: thick * 0.46, zEdge: -0.3, zTop: 1 });
    for (let at = pitch; at < long; at += pitch) {
      s.cut(wide ? rect(p.x + at - 0.45, p.y, 0.9, p.h) : rect(p.x, p.y + at - 0.45, p.w, 0.9), { depth: 0.6, soft: 0.3, ink: [0.012, 0.012, 0.012] });
    }
  },
});

const rock = turn({
  mass: 7, material: 'steel-on-steel', stops: { at: [-4, 4] }, hubless: true, contact: 'toggle', sound: 'cam',
  at: p => (p.el.hasAttribute('pin') ? nums(p, 'pin', []).map(v => v * MM) : [p.w / 2, p.h / 2]) as [number, number],
  letGo: p => p.el.setAttribute('turn', '0'),
});

// A long bar on a pin, rocked in the plane of its face, that goes back to the middle when let go. Filling its box,
// with `pin` as x, y in mm from the top left, which is also where the riveted end of the pin shows.
definePart({
  selector: '[d-switch~="bar"]',
  ...rock,
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'satin-steel', [x = p.w / 2, y = p.h / 2] = nums(p, 'pin', []).map(v => v * MM), r = p.w / 2, rise = num(p, 'height', 2);
    s.group(rock.place(p), () => {
      s.surface(union(capsule(0, -y + r, 0, p.h - y - r, r, r), circle(0, 0, r * 1.7)), { material, zEdge: -2, zTop: rise, bevel: r * 0.34 });
    });
    s.surface(circle(p.x + x, p.y + y, r * 0.6), { material: 'polished-steel', profile: 'dome', zEdge: rise - 0.1, zTop: rise + 0.3 });
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: r }), FOCUS);
  },
});

const hand = turn({
  mass: 60, material: 'ball-bearing', friction: 0.03, hubless: true,
  accepts(p) {
    drive.hold(p, true);
    return true;
  },
  letGo: p => drive.hold(p, false),
});
const drive = motor({ mass: 60, return: 0.05, friction: 0.5 });

/** How fast a `d-wheel="spin"` is really going, radians a second, the motor and the hand together. */
export const spinOf = (el: Element): number => {
  const p = partOf(el);
  return p ? p.springs.turn!.velocity + (p.springs.speed!.value / 60) * Math.PI * 2 : 0;
};

/** Words printed on it: angle, how far out of 1, the turn of the text, and the text, each `:` apart. */
const printed = (p: Part, R: number) => (p.el.getAttribute('marks') ?? '').split(',').filter(Boolean).map(m => {
  const [deg, out, spin, label] = m.split(':'), size = num(p, 'size', 1.75) * MM, [x, y] = polar(0, 0, +out! * R, +deg! * RAD), w = size * (label!.length + 1);
  return text(label!.trim(), x - w / 2, y - size, w, size * 2, { font: font(p, size, 400), align: 'center', rotate: +spin! * RAD });
});

// A heavy disc on a bearing, driven from under by a small motor, and free to be caught. `rpm` is where the motor is headed.
// Flick it and it runs on. Hold it and the motor gives way. `hub` is the dished centre, `pins` the screws in it, `path`
// and `viewbox` are art printed across the whole disc, and `marks` are words on it, which turn with it.
definePart({
  selector: '[d-wheel~="spin"]',
  ...hand,
  springs: { ...hand.springs, ...drive.springs },
  live: [...hand.live, 'rpm'],
  update(p) {
    hand.update(p);
    drive.update(p);
  },
  tick: drive.tick,
  paint(s, p) {
    const R = Math.min(p.w, p.h) / 2, cx = p.x + p.w / 2, cy = p.y + p.h / 2, material = p.el.getAttribute('material') || 'aluminium-silver', on = legendColor(material);
    const hub = p.el.hasAttribute('hub') ? num(p, 'hub', 0) * MM : R * 0.26, place = hand.place(p), art = p.el.getAttribute('path'), view = p.el.getAttribute('viewbox')?.trim().split(/[\s,]+/).map(Number) as [number, number, number, number] | undefined, n = num(p, 'pins', 3);
    s.well(circle(cx, cy, R + 1.1), 0.4, { bevel: 0.5 });
    s.group({ ...place, rotate: place.rotate! + drive.angle(p) }, () => {
      s.surface(circle(0, 0, R), { material, bevel: 1.5, zEdge: -0.6, zTop: 0.1, profile: 'round' }, () => {
        if (art) s.cut(path(art, -R, -R, R * 2, R * 2, { viewBox: view }), { ink: on });
        for (const m of printed(p, R)) s.cut(m as Shape & Solid, { ink: on });
      });
      s.well(grow(circle(0, 0, hub), 0.6), 0.2, { bevel: 0.6 });
      s.surface(circle(0, 0, hub), { material: 'polished-steel', profile: 'flat', zEdge: -0.2, zTop: 0.1, bevel: 1.5, dish: 0.35 });
      for (let i = 0; i < n; i++) {
        const [x, y] = polar(0, 0, hub * 0.52, (i * Math.PI * 2) / n);
        s.surface(circle(x, y, 1.5), { material: 'polished-steel', profile: 'dome', zEdge: -0.2, zTop: 0.3 });
      }
    });
    if (p.focused) s.glow(circle(cx, cy, R + 2), FOCUS);
  },
});

// How far a key's front goes down per mm of its length, held all the way: it turns on a pivot at its back, so about 10mm at the front of a 150mm natural,
// and a sharp, as long as it is, goes down less. A guess.
const DIP = 10 / 150;

// `d-key="piano black"` for a sharp. Heights are set so a row of them nests.
definePart(key('[d-key~="piano"]', {
  feel: { mass: 8, friction: 0.08 },
  options: ['black'],
  label: false,
  cap: 'keycap-ivory',
  layer: p => (words(p).includes('black') ? 1 : 0),
  draw(s, p, d, k) {
    const black = words(p).includes('black');
    const press = k.down;
    s.surface(rect(p.x + 0.6, p.y, p.w - 1.2, p.h, { radius: 2.5 }), {
      material: black ? 'lacquer-black' : k.cap, bevel: black ? 3.5 : 2, zEdge: black ? 2 : 0,
      zTop: black ? 8 : 4, tilt: (DIP * press * p.h) / MM, pivot: [0, -1], over: { rough: black ? 0.2 : 0.3, touch: d.age * 0.4 },
    });
    k.focus(rect(p.x + 2, p.y + p.h - 12, p.w - 4, 10, { radius: 3 }));
  },
}));
