// Things you press.
import { circle, definePart, FOCUS, getMaterialDef, input, legendColor, linear, mask, MM, press, rect, type Part, type Vec3 } from 'device-ui';
import { icon } from './icons.js';
import { key, legend, words } from './key.js';
import { inherited, keyShape, lamp, num, scale } from './shared.js';
import { bezel, gripped, isDish, isGrip, isKeyProfile, isLegend, keycap, legendLook, lowCap, profiledCap } from './anatomy.js';

const FLOOR = -1.8;

// The plain key. A value on the tag picks another form, as `d-key="chiclet"`.
definePart(key('[d-key=""]', {
  feel: { mass: 3 },
  cap: 'keycap-grey',
  draw(s, p, d, k) {
    const g = 0.75;
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 7 }), { material: 'well', bevel: 2.5, zEdge: 0, zTop: FLOOR });
    s.group({ at: [p.x + p.w / 2, p.y + p.h / 2], scale: MM }, () => keycap(s, p.w / MM - 2 * g, p.h / MM - 2 * g, {
      material: k.cap, z: FLOOR, height: 5.2 - 3.2 * k.down, dish: 'spherical', depth: 0.4, skirt: 2.1, radius: 1.25,
      over: { wear: d.wear * 0.55, sub: '#3a3a3a', touch: d.age * 0.8 },
    }));
    k.focus(rect(p.x + 1, p.y + 1, p.w - 2, p.h - 2, { radius: 7 }));
    legend(s, p, k.cap, { depth: 0.09, wear: d.wear * 0.25 });
  },
}));

// A big round button, sat in a collar. Lights up with `on`, and while it is held. `gain` sets how bright its lamp burns. Its cap is dished for a finger, or swells by `crown` mm for a palm.
definePart(key('[d-key~="arcade"]', {
  feel: { mass: 6, friction: 0.1 },
  cap: 'plastic-red',
  own: true,
  lit: { stiffness: 200, damping: 24 },
  live: ['on', 'gain'],
  draw(s, p, d, k) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, name = p.el.getAttribute('material') || k.cap;
    const press = k.down, lit = Math.max(p.springs.lit!.value, press * 0.6);
    const collar = p.el.getAttribute('collar') || name, crown = num(p, 'crown', 0);
    s.surface(circle(cx, cy, R), {
      material: collar, bevel: R * 0.16, zEdge: 0, zTop: 2.4, over: { wear: d.wear * 0.5 },
    });
    s.surface(circle(cx, cy, R * 0.76), { material: 'well', bevel: 1.5, zEdge: 2.4, zTop: -1 });
    s.surface(circle(cx, cy, R * 0.72), {
      material: name, bevel: R * 0.2, zEdge: -0.6, zTop: 4.6 - 3.1 * press, ...(crown ? { crown } : { dish: 1.3 }),
      over: { touch: d.age * 0.7, emit: scale(lamp(p, 'red'), 0.12 * lit * num(p, 'gain', 1)) },
    });
    k.focus(circle(cx, cy, R + 1.5));
    legend(s, p, name, { depth: 0.08 });
  },
}));

// A flush round button with a metal collar, as on a lift panel. `on` lights the legend, and `gain` sets how bright its lamp burns. With `aria-pressed` it
// stays in while that says so, as a release does while what it lets go is turned.
definePart(key('[d-key~="flush"]', {
  ...press({ mass: 2.4, material: 'plastic-on-rubber', held: p => p.el.getAttribute('aria-pressed') === 'true' }),
  cap: 'plastic-black',
  own: true,
  lit: { stiffness: 220, damping: 26 },
  live: ['on', 'gain', 'aria-pressed'],
  draw(s, p, d, k) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2, cap = k.cap;
    const lit = p.springs.lit!.value * num(p, 'gain', 1);
    const c = lamp(p, 'amber');
    s.surface(circle(cx, cy, R), {
      material: 'brushed-steel', radial: true, bevel: R * 0.22, zEdge: 0, zTop: 1.3,
      over: { rough: 0.3, aniso: 0.6, grain: [0, 1, 1] },
    });
    s.surface(circle(cx, cy, R * 0.74), { material: 'well', bevel: 1, zEdge: 1.3, zTop: 0 });
    s.surface(circle(cx, cy, R * 0.7), {
      material: cap, bevel: R * 0.12, zEdge: 0, zTop: 1.8 - 1.1 * k.down, dish: 0.2,
      over: { emit: scale(c, 0.04 * lit), touch: d.age * 0.6 },
    });
    k.focus(circle(cx, cy, R + 1.5));
    legend(s, p, cap, { depth: 0.06, ink: lit > 0.05 ? [0.9, 0.8, 0.6] : undefined, emit: scale(c, 0.6 * lit) });
  },
}));

// A tab is in when its checkbox is ticked or it's marked current or pressed. Its lamp is on that contact, not on the travel,
// so a finger resting on it or a press on the way down lights nothing.
const tabIn = (p: Part) => input(p)?.checked ?? (p.el.hasAttribute('aria-current') || p.el.getAttribute('aria-pressed') === 'true');

// A latching bar, one of a row: a radio button or checkbox in a label, a link, which stays in at the page it goes to, or a button with `aria-pressed`.
// `color` lights the bar while it is latched, and the device's `backlight` lights its legend whether it is or not. A dark print stops light, so it never glows.
// `d-key="tab lit"` is a bar that lights right through while it's latched, with its legend left black on it, so the one that's in reads the same in any room. `gain` turns its legend and its light up, and `gap` is how much of the well shows round the cap.
definePart(key('[d-key~="tab"]', {
  options: ['lit'],
  ...press({ mass: 4.6, material: 'plastic-on-rubber', latch: true, rests: 0.22, held: tabIn }),
  live: ['aria-current', 'aria-pressed', 'icon', 'disabled', '#text', 'gain'],
  draw(s, p, d) {
    const cap = p.el.getAttribute('material') || inherited(d, 'keycap') || 'keycap-black';
    const lit = words(p).includes('lit'), down = p.springs.press!.value, on = tabIn(p) ? 1 : 0, gain = num(p, 'gain', 1);
    const c = lit ? lamp(p, 'white') : p.el.hasAttribute('color') ? lamp(p, 'amber') : null;
    const back = inherited(d, 'backlight'), glow = c ?? (back ? lamp(p, back) : null);
    const printed = legendColor(cap), dark = printed[0] + printed[1] + printed[2] < 0.6;
    const blocked = (p.el as HTMLButtonElement).disabled || !!input(p)?.disabled;
    const colour = getMaterialDef(cap).color ?? '#808080', body = typeof colour === 'string' ? linear(colour) : colour;
    const ink = blocked ? printed.map((v, i) => v + (body[i]! - v) * 0.62) as Vec3 : lit ? printed.map(v => v * (1 - on)) as Vec3 : printed;
    const shines = lit ? (dark ? ([0, 0, 0] as Vec3) : scale(glow!, 0.14 * gain * (1 - on))) : glow && !dark && !blocked ? scale(glow, (back ? 0.14 * gain : 0) + 0.4 * on) : undefined;
    const g = num(p, 'gap', lit ? 0.3 : 0.5) * MM, rise = num(p, 'height', 2.4), travel = num(p, 'travel', rise + 0.2);
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 4 }), { material: 'well', bevel: 2, zEdge: 0, zTop: FLOOR });
    s.surface(rect(p.x + g, p.y + g, p.w - g * 2, p.h - g * 2, { radius: 3 }), {
      material: cap, bevel: 3, zEdge: FLOOR, zTop: rise - travel * down,
      over: { wear: d.wear * 0.5, sub: '#3a3a3a', touch: d.age * 0.5, ...(c ? { emit: scale(c, (lit ? 0.16 : 0.018) * on * gain) } : {}) },
    });
    if (p.focused) s.glow(rect(p.x, p.y, p.w, p.h, { radius: 4 }), FOCUS);
    legend(s, p, cap, { depth: 0.07, ink, emit: shines, wear: d.wear * 0.2 });
  },
}));

// A laptop key: low, square, with its legend and edges lit from under the cap.
definePart(key('[d-key~="chiclet"]', {
  feel: { mass: 2 },
  cap: 'soft-touch-black',
  live: ['on', 'color', 'gain'],
  draw(s, p, d, k) {
    const cap = k.cap;
    const lit = p.el.hasAttribute('color') || !!inherited(d, 'backlight');
    const c = lit ? lamp(p, inherited(d, 'backlight') || 'white') : ([0, 0, 0] as const);
    const gain = num(p, 'gain', 1);
    const box = rect(p.x, p.y, p.w, p.h, { radius: 5 });
    s.well(box, 0.8, { bevel: 1, over: { emit: scale([...c], 0.03 * gain) } });
    s.group({ at: [p.x + p.w / 2, p.y + p.h / 2], scale: MM }, () => lowCap(s, p.w / MM, p.h / MM, k.down, cap, { touch: d.age * 0.7 }));
    legend(s, p, cap, { ink: lit ? scale([...c], 0.04) : undefined, emit: lit ? scale([...c], 0.34 * gain) : undefined });
    // A pin light in the corner, as on a caps lock key.
    if (p.el.hasAttribute('on')) s.cut(circle(p.x + 8, p.y + 8, 1.7), { ink: [0.05, 0.3, 0.1], emit: lamp(p, 'green').map(v => v * 0.5) as Vec3 });
    k.focus(box);
  },
}));

// A mechanical keycap: tall, on a long travel, lit from the switch below. `profile` is the family it's cut to, `cherry`, `oem`, `sa`, `dsa`
// or `xda`, which sets how tall it stands, how big its top is and how it's dished. `dish` overrides that (`cylindrical`, `spherical` or `flat`),
// `row` sculpts it as that row of a board, 1 at the top to 4, and `legend` says how its legend is put on: `pad`, `twoshot`, `laser` or `engraved`.
definePart(key('[d-key~="mech"]', {
  feel: { mass: 6, friction: 0.1 },
  cap: 'keycap-black',
  live: ['color'],
  draw(s, p, d, k) {
    const cap = k.cap, dish = p.el.getAttribute('dish'), process = p.el.getAttribute('legend'), profile = p.el.getAttribute('profile');
    const under = p.el.getAttribute('color') ?? inherited(d, 'backlight');
    const c = under === null ? null : lamp(p, under || 'white'), press = k.down;
    const box = rect(p.x, p.y, p.w, p.h, { radius: 4 });
    s.well(box, 2.4, { bevel: 1, over: c ? { emit: scale(c, 0.1) } : undefined });
    const g = 0.55 * MM;
    s.group({ at: [p.x + p.w / 2, p.y + p.h / 2], scale: MM }, () => profiledCap(s, isKeyProfile(profile) ? profile : 'cherry', (p.w - g * 2) / MM, (p.h - g * 2) / MM, {
      material: cap, z: -1.4 - 2.4 * press, dish: isDish(dish) ? dish : undefined, row: num(p, 'row', 0), over: { touch: d.age * 0.8 },
    }));
    legend(s, p, cap, { ...legendLook(isLegend(process) ? process : 'pad', c ? scale(c, 0.05) : legendColor(cap), d.wear), emit: c ? scale(c, 0.2) : undefined });
    k.focus(box);
  },
}));

// A round gamepad button, domed, with its letter under a clear cap. `rise` is how far it stands
// up, mm, and `color` tints the letter. `flat` turns the dome into a moulded disc with a rolled edge, and `gap` is the mm between it and its hole.
// `plate` prints a disc of that colour under the letter, `plate-size` of the way across, and `ink` colours the letter. `icon` prints an icon in place of one.
definePart(key('[d-key~="face"]', {
  feel: { mass: 3, friction: 0.13 },
  cap: 'gloss-black',
  own: true,
  draw(s, p, d, k) {
    const cap = k.cap, rise = num(p, 'height', 3.6);
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    s.well(circle(cx, cy, R), 1.4, { bevel: 1 });
    s.surface(circle(cx, cy, R - num(p, 'gap', 0.4) * MM), {
      material: cap, ...(p.el.hasAttribute('flat') ? { bevel: R * 0.26, dish: 0.15 } : { profile: 'dome' as const }), zEdge: -1, zTop: rise - 0.66 * rise * k.down, over: { touch: d.age * 0.5 },
    });
    const plate = p.el.getAttribute('plate'), ink = p.el.getAttribute('ink');
    if (plate) s.cut(circle(cx, cy, R * num(p, 'plate-size', 0.6)), { ink: linear(plate), rough: 0.5 });
    if (p.label) s.cut(mask(p.label), { depth: 0.05, ink: ink ? linear(ink) : p.el.hasAttribute('color') ? scale(lamp(p), 0.1) : legendColor(cap) });
    const glyph = p.el.getAttribute('icon');
    if (glyph) {
      const size = R * num(p, 'icon-size', 1);
      s.cut(icon(glyph, cx - size / 2, cy - size / 2, size, { weight: num(p, 'weight', 2) }), { depth: 0.05, ink: ink ? linear(ink) : legendColor(cap) });
    }
    k.focus(circle(cx, cy, R + 1));
  },
}));

// A flat key with square shoulders, in a narrow gap, that goes down onto a hard stop. The text inside is its legend.
// `open` names the sides with no gap, `left`, `right`, `top` or `bottom`, for a key that runs to the edge of what holds it.
// `lamp` sets a pin LED in it, near the top, which `on` lights. `collar` is a metal frame round it. `round` makes it a disc,
// and `path` in a `viewbox` any other outline, traced off a cap that isn't a box, as a calculator's barrel keys.
definePart(key('[d-key~="slab"]', {
  feel: { mass: 9, material: 'plastic-on-plastic', friction: 0.12 },
  cap: 'keycap-grey',
  own: true,
  lit: { stiffness: 260, damping: 26 },
  live: ['on'],
  draw(s, p, d, k) {
    const cap = k.cap, down = k.down, rise = num(p, 'height', 2.6), travel = num(p, 'travel', 1.8);
    const collar = p.el.getAttribute('collar'), rim = collar ? num(p, 'rim', 1.2) * MM : 0, gap = num(p, 'gap', 0.2) * MM, bevel = num(p, 'bevel', 0.6) * MM, deep = num(p, 'deep', 0.6);
    if (collar) s.surface(keyShape(p, p.x, p.y, p.w, p.h), { material: collar, rise: 1, bevel: 2.4, profile: 'chamfer' });
    const x = p.x + rim, y = p.y + rim, w = p.w - rim * 2, h = p.h - rim * 2;
    const open = (side: string) => p.el.getAttribute('open')?.includes(side) ?? false;
    const [l, r, t, b] = ['left', 'right', 'top', 'bottom'].map(side => (open(side) ? 0 : gap)) as [number, number, number, number];
    s.well(keyShape(p, x, y, w, h), deep, { bevel: 0.4, zEdge: collar ? 1 : 0, zTop: collar ? 1 - deep : -deep });
    s.surface(keyShape(p, x + l, y + t, w - l - r, h - t - b), {
      material: cap, profile: 'chamfer', bevel, zEdge: -deep, zTop: rise - travel * down, dish: num(p, 'dish', 0), over: { wear: d.wear * 0.5, touch: d.age * 0.7 },
    });
    legend(s, p, cap, { depth: 0.04, wear: d.wear * 0.25 });
    if (p.el.hasAttribute('lamp')) {
      const c = lamp(p, 'red'), on = p.springs.lit!.value, cx = p.x + p.w / 2, cy = p.y + num(p, 'lamp', 2) * MM, top = rise - travel * down;
      const lens: Vec3 = [0.05 + c[0] * 0.02, 0.008, 0.006];
      s.surface(circle(cx, cy, 5.6), { material: 'plastic-black', bevel: 1, zEdge: top - 0.4, zTop: top + 0.05 });
      s.surface(circle(cx, cy, 3.7), { material: 'glass-red', profile: 'dome', zEdge: top, zTop: top + 0.7, over: { color: lens, emit: scale(c, 0.5 * on) } });
    }
    k.focus(keyShape(p, p.x, p.y, p.w, p.h));
  },
}));

// A printed patch on a sheet of film, over a snap dome. There's no gap and no key, so all that moves is the film, which dips under a finger and stays pillowed
// a little over the dome at rest. The text inside is its legend, and children are printed on it.
definePart(key('[d-key~="membrane"]', {
  ...press({ mass: 1.4, material: 'rubber-on-plastic', friction: 0.3, sound: 'dome' }),
  draw(s, p, d) {
    const film = p.el.getAttribute('material') || 'film-white', down = p.springs.press!.value, r = Math.min(p.w, p.h);
    s.surface(keyShape(p, p.x, p.y, p.w, p.h), { material: film, profile: 'round', bevel: r * 0.12, zEdge: 0, zTop: num(p, 'height', 0.3), over: { wear: d.wear * 0.5, touch: d.age * 0.7 } }, () => {
      if (down > 0.001) s.cut(circle(p.x + p.w / 2, p.y + p.h / 2, r * 0.52), { depth: num(p, 'travel', 0.7) * down, soft: r * 0.34 });
    });
    const name = p.el.getAttribute('icon'), size = r * 0.5;
    if (name) s.cut(icon(name, p.x + (p.w - size) / 2, p.y + (p.h - size) / 2, size), { ink: legendColor(film), wear: d.wear * 0.25 });
    if (p.label) s.cut(mask(p.label), { ink: legendColor(film), wear: d.wear * 0.25 });
    if (p.focused) s.glow(keyShape(p, p.x, p.y, p.w, p.h), FOCUS);
  },
}));

// A tactile switch on a board, seen from above: a square body under a steel cover, and the stem that pushes the dome, which travels a
// quarter of a millimetre and clicks. Sized to the part: 6mm and 12mm are the common ones. `cap` snaps a cap over the stem, `round` or
// `square`, in its `material`. Spec: 6 × 6 body with a 3.5mm stem, 12 × 12 with a 7mm one, 0.25mm travel.
definePart(key('[d-key~="tact"]', {
  ...press({ mass: 0.6, material: 'plastic-on-plastic', sound: 'dome' }),
  cap: 'plastic-black',
  own: true,
  draw(s, p, d, k) {
    const side = Math.min(p.w, p.h) / MM, down = k.down, kind = p.el.getAttribute('cap'), big = side >= 9;
    s.group({ at: [p.x + p.w / 2, p.y + p.h / 2], scale: MM }, () => {
      s.surface(rect(-side / 2, -side / 2, side, side, { radius: 0.3 }), { material: 'plastic-black', bevel: 0.3, zEdge: 0, zTop: 3.1 });
      s.surface(rect(-side / 2 + 0.25, -side / 2 + 0.25, side - 0.5, side - 0.5, { radius: 0.2 }), { material: 'satin-steel', bevel: 0.15, zEdge: 3.1, zTop: 3.3, over: { rough: 0.35 } });
      // The cover is staked down at its corners on the big one.
      if (big) for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.cut(circle(x * (side / 2 - 1), y * (side / 2 - 1), 0.45), { depth: 0.1, soft: 0.5 });
      const r = side * 0.29, top = 3.3 + num(p, 'height', big ? 1.8 : 1.5) - 0.25 * down;
      if (kind === 'round' || kind === 'square') {
        const c = side * 0.42;
        const shape = kind === 'round' ? circle(0, 0, c) : rect(-c, -c, c * 2, c * 2, { radius: 0.8 });
        s.surface(shape, { material: k.cap, profile: 'round', bevel: c * 0.35, zEdge: 3.4, zTop: top + 1.6, dish: kind === 'round' ? 0.15 : 0, over: { touch: d.age * 0.6 } });
      } else s.surface(circle(0, 0, r), { material: k.cap, bevel: 0.2, zEdge: 3.3, zTop: top, over: { touch: d.age * 0.6 } });
    });
    k.focus(rect(p.x, p.y, p.w, p.h, { radius: 2 }));
  },
}));

// An emergency stop: a mushroom head on a collar that locks down when struck and stays down until it's let out, as the checkbox
// inside does, or `aria-pressed` on a button. It sits on a yellow plate, and its text is its name, not printed. `grip` ribs the head's rim
// (`ribbed` or `smooth`), and `plate` names the plate's material. Spec: a 40mm head on a 22mm hole, about 6mm of stroke.
definePart(key('[d-key~="mushroom"]', {
  ...press({ mass: 14, material: 'plastic-on-plastic', friction: 0.15, latch: true, held: p => input(p)?.checked ?? p.el.getAttribute('aria-pressed') === 'true' }),
  cap: 'plastic-red',
  own: true,
  label: false,
  live: ['aria-pressed'],
  draw(s, p, d, k) {
    const R = Math.min(p.w, p.h) / 2 / MM, down = k.down, grip = p.el.getAttribute('grip');
    s.group({ at: [p.x + p.w / 2, p.y + p.h / 2], scale: MM }, () => {
      s.surface(circle(0, 0, R), { material: p.el.getAttribute('plate') || 'plastic-yellow', bevel: 0.8, zEdge: 0, zTop: 1.2, over: { wear: d.wear * 0.5 } });
      bezel(s, { w: R * 1.1, wall: R * 0.08, height: 4, material: 'plastic-black' });
      const head = R * 0.62, top = 14 - 6 * down;
      s.surface(isGrip(grip) && grip !== 'smooth' ? gripped(head, grip, 36) : circle(0, 0, head), {
        material: k.cap, profile: 'round', bevel: head * 0.42, zEdge: top - 5, zTop: top, crown: 1.2, over: { touch: d.age * 0.4, wear: d.wear * 0.3 },
      });
    });
    k.focus(circle(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) / 2 + 1.5));
  },
}));
