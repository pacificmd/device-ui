// Everything that holds a device together.
import { circle, definePart, defineStyles, grow, holes, legendColor, linear, mask, MM, offerSeat, path, picture, poly, rect, redraw, reduced, seatOf, slide, text, union, warnOnce, within, type FrostOptions, type Part, type PartDef, type Point, type Sheet, type Vec3 } from 'device-ui';
import { lampColours } from 'device-ui/materials';
import { words } from './key.js';
import { PUNCHED, TAPE_THICK, ground, lamp, legs, num, scale, standing } from './shared.js';
import { icon, icons } from './icons.js';
import { hexNut, isDrive, isScrewHead, isScrewSize, screwHead, SCREWS } from './anatomy.js';

const RAD = Math.PI / 180;

// Words cut into what it's on. `d-mark="label flat"` prints them flat, and `ink` sets the colour.
definePart({
  selector: '[d-mark~="label"]',
  options: ['flat'],
  label: true,
  paint(s, p, d) {
    if (!p.label) return;
    const on = p.el.closest('d-surface')?.getAttribute('material') ?? d.material;
    const printed = words(p, 'd-mark')[1] === 'flat';
    const ink = p.el.getAttribute('ink');
    s.cut(mask(p.label), { depth: printed ? 0 : 0.2, ink: ink ? linear(ink) : legendColor(on), wear: d.wear * 0.1 });
  },
});

// What a die stamps: an `<img>`, or the words inside, in `material`. What's see-through in an image stays off it, so any picture can be foil.
// A symbol from the icon set, printed on what it's on, as big as its box: `icon` says which and `color` its ink. `weight` is its stroke, on the icon's 24 unit grid.
definePart({
  selector: '[d-mark~="symbol"]',
  paint(s, p, d) {
    const name = p.el.getAttribute('icon') ?? '', size = Math.min(p.w, p.h), ink = p.el.getAttribute('color');
    if (!icons[name]) warnOnce(`no icon called "${name}". There are ${Object.keys(icons).join(', ')}.`);
    s.cut(icon(name, p.x + (p.w - size) / 2, p.y + (p.h - size) / 2, size, { weight: num(p, 'weight', 2) }), { ink: ink ? linear(ink) : legendColor(ground(p, d)) });
  },
});

definePart({
  selector: '[d-mark~="stamp"]',
  label: true,
  connect(p) {
    if (!(p.el instanceof HTMLImageElement) || p.el.complete) return;
    const off = new AbortController();
    p.el.addEventListener('load', () => redraw(p.el), { signal: off.signal });
    return () => off.abort();
  },
  paint(s, p) {
    const foil = { material: p.el.getAttribute('material') || 'foil-gold', follow: true, rise: 0.05, bevel: 0.4, over: { wear: 0 } };
    if (p.el instanceof HTMLImageElement) {
      if (p.el.naturalWidth) s.surface(picture(p.el, p.x, p.y, p.w, p.h), foil);
      return;
    }
    if (!p.label) return;
    const { lines, font, letterSpacing, wordSpacing } = p.label;
    for (const l of lines) s.surface(text(l.text, l.x, l.y, l.w, l.h, { font, letterSpacing, wordSpacing }), foil);
  },
});

// A raised plate with its text engraved. `rivets` adds one at each end.
definePart({
  selector: '[d-mark~="plate"]',
  label: true,
  paint(s, p, d) {
    const name = p.el.getAttribute('material') || 'brass';
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 2.5 }), {
      material: name, bevel: 1.6, zEdge: 0, zTop: 0.9, over: { wear: d.wear * 0.35 },
    });
    if (p.el.hasAttribute('rivets')) {
      for (const x of [p.x + 8, p.x + p.w - 8]) {
        s.surface(circle(x, p.y + p.h / 2, 3.2), {
          material: name, profile: 'dome', zEdge: 0.9, zTop: 1.5, over: { rough: 0.24 },
        });
      }
    }
    if (p.label) s.cut(mask(p.label), { depth: 0.18, ink: legendColor(name), rough: 0.55 });
  },
});

// Punched label tape: raised letters, whitened where the plastic stretched.
definePart({
  selector: '[d-mark~="dymo"]',
  label: true,
  paint(s, p, d) {
    const name = p.el.getAttribute('material') || 'dymo-black';
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 1 }), {
      material: name, bevel: 1, zEdge: 0, zTop: TAPE_THICK, over: { wear: d.wear * 0.3, rough: 0.34 },
    });
    if (!p.label) return;
    const { lines, font, letterSpacing, wordSpacing } = p.label;
    for (const l of lines) s.surface(text(l.text, l.x, l.y, l.w, l.h, { font, letterSpacing, wordSpacing, spread: 3 }), { ...PUNCHED, zEdge: TAPE_THICK, zTop: TAPE_THICK + 0.25 });
  },
});

// A field of holes in the surface, `pitch` apart and `hole` across, in mm. `square` makes them square, and `round` keeps them inside a circle.
definePart({
  selector: '[d-opening~="grille"]',
  paint(s, p) {
    const pitch = num(p, 'pitch', 2) * MM, hole = num(p, 'hole', 0.6) * MM;
    const well = { material: 'well', bevel: 1.3, zEdge: 0, zTop: -3.6 };
    if (!p.el.hasAttribute('round')) return void s.surface(holes(p.x, p.y, p.w, p.h, { pitch, hole, square: p.el.hasAttribute('square') }), well);
    // Whole holes inside a circle, on a square pitch.
    const R = Math.min(p.w, p.h) / 2, n = Math.floor(R / pitch), inside = [];
    for (let x = -n; x <= n; x++) for (let y = -n; y <= n; y++) {
      if (Math.hypot(x, y) * pitch + hole / 2 <= R) inside.push(circle(p.x + p.w / 2 + x * pitch, p.y + p.h / 2 + y * pitch, hole / 2));
    }
    s.surface(union(...inside), well);
  },
});

// A thin sunk line that fills its box.
definePart({
  selector: '[d-seam]',
  paint(s, p) {
    s.well(rect(p.x, p.y, p.w, p.h, { radius: 1 }), 1, { bevel: 1 });
  },
});

// Four screws, one in each corner of the device, each with its drive at its own angle. `screws` says which: a head
// (`pan`, `countersunk`, `button`, `cheese`), a drive (`slot`, `cross`, `hex`, `star`) and a size (`M2`, `M3`, `M4`), slotted M2 pan heads if it's bare.
definePart({
  selector: 'd-device[screws]',
  paint(s, p, d) {
    const { x, y, w, h } = d, said = words(p, 'screws');
    const head = said.find(isScrewHead) ?? 'pan', drive = said.find(isDrive) ?? 'slot', size = said.find(isScrewSize) ?? 'M2';
    // Each sits its head and 1.25mm more in from the corner. Guess, from panel screws.
    const m = (SCREWS[size].heads[head][0] / 2 + 1.25) * MM;
    const corners = [[x + m, y + m], [x + w - m, y + m], [x + m, y + h - m], [x + w - m, y + h - m]] as const;
    corners.forEach(([cx, cy], i) => s.group({ at: [cx, cy], scale: MM }, () => screwHead(s, {
      head, drive, size, angle: i * 1.9 + 0.4, sunk: head === 'countersunk' ? 0 : 0.5, material: 'brushed-steel', over: { rough: 0.34, aniso: 0.6, grain: [0, 1, 1] },
    })));
  },
});

// A camera lens: a black well behind coated elements. All of them fill the opening, so no element has an edge you can see, and the room shows once on each,
// at its own size and turned over on the hollow one, in the colour its coating leaves at that angle. Glass
// is nearly black where it faces nothing bright, so those images are all the colour it has, and they're what makes a lens read as deep.
// `rim` is how much of the radius the outer ring takes, `pupil` how much the glass does, `core` how much of the glass the iris
// leaves open, `height` how far it stands, mm, and `baffles` how many ridges step down the well to the glass.
definePart({
  selector: '[d-glass~="lens"]',
  paint(s, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = Math.min(p.w, p.h) / 2;
    const name = p.el.getAttribute('material') || 'titanium-black', rim = num(p, 'rim', 0.2), pupil = num(p, 'pupil', 0.62), core = num(p, 'core', 0.48), z = num(p, 'height', 2.4) / 2.4, baffles = num(p, 'baffles', 0);
    const glass = R * pupil, edge = (glass * 0.05) / 4;
    s.surface(circle(cx, cy, R), { material: name, bevel: R * 0.1, zEdge: 0, zTop: 2.4 * z });
    s.surface(circle(cx, cy, R * (1 - rim)), { material: 'black-oxide', bevel: R * 0.16, zEdge: 2.4 * z, zTop: 0.8 * z });
    // Each baffle is a disc, so they go down before the well, which cuts back through all of them inside the glass.
    for (let i = 0; i < baffles; i++) {
      const t = i / baffles, r = R * (1 - rim) + (glass - R * (1 - rim)) * t, top = 2.4 * z * (1 - t) + 0.8 * z * t;
      s.surface(circle(cx, cy, r), { material: 'black-oxide', profile: 'chamfer', bevel: (R * (1 - rim) - glass) / baffles / 2, zEdge: top, zTop: top - (1.6 * z) / baffles, over: { rough: 0.7 } });
    }
    // One cone down to the iris. A step in it would stand a wall up at a glance to the lamp, which the barrel in front keeps from it.
    s.surface(circle(cx, cy, glass), { material: 'flock-black', profile: 'chamfer', bevel: glass * (1 - Math.max(core, 0.5)), zEdge: 0.8 * z, zTop: -2 * z });
    s.glass(circle(cx, cy, glass), { height: 0.2 * z, bevel: glass * 0.3, curve: 0.4, film: 0.42, rim: edge / 2, coat: 0.42 });
    s.glass(circle(cx, cy, glass), { height: 0.3 * z, bevel: glass * 0.6, curve: -0.7, film: 0.3, rim: edge / 2, coat: 0.28 });
    s.glass(circle(cx, cy, glass), { height: 0.6 * z, bevel: glass * 0.9, curve: 1.1, film: 0.18, rim: edge, coat: 0.22 });
  },
});

// A row of socket pins, as on the edge of a dev board: square holes on a 2.54mm pitch, as many as fit its long side.
definePart({
  selector: '[d-port~="header"]',
  paint(s, p) {
    const pitch = 2.54 * MM, hole = num(p, 'hole', 1) * MM, along = p.w >= p.h, n = Math.floor((along ? p.w : p.h) / pitch);
    // Loose, it's a socket strip: a moulded bar a pitch wide, 8.5 mm tall. Spec, for a 2.54 mm female header.
    const strip = along ? rect(p.x, p.y + (p.h - pitch) / 2, n * pitch, pitch, { radius: 0.6 }) : rect(p.x + (p.w - pitch) / 2, p.y, pitch, n * pitch, { radius: 0.6 });
    standing(s, p, 8.5, () => s.surface(strip, { material: 'plastic-black', bevel: 0.8, zEdge: 0, zTop: 8.5 }), () => {
      for (let i = 0; i < n; i++) {
        const c = (i + 0.5) * pitch - hole / 2;
        s.well(rect(along ? p.x + c : p.x + (p.w - hole) / 2, along ? p.y + (p.h - hole) / 2 : p.y + c, hole, hole, { radius: 0.5 }), 3, { bevel: 0.5 });
      }
    });
  },
});

// A socket on the side of something. The form says which. A jack takes `nut`, the hex nut of a panel jack, and `plug`, a lead plugged in, whose barrel is that material. It may wrap a checkbox, for the plug to come and go.
const socket = (selector: string, kind: string): PartDef => ({
  selector,
  paint(s, p) {
    // Loose, a socket stands on its tail, mouth up, as tall as it runs back, on the legs it's soldered by.
    standing(s, p, DEPTH[kind]!, () => back(s, p, kind), () => mouth(s, p, kind));
  },
});

/** How far each socket runs back from its mouth, mm. USB-C and USB-A are spec, from the receptacle drawings; the rest are guesses. */
const DEPTH: Record<string, number> = { usbc: 7.35, usba: 14, hdmi: 11.5, jack: 11, sd: 15, modular: 16 };

/** What a case hides of a socket: the shell running back from its mouth, or the block it's moulded in. */
function back(s: Sheet, p: Part, kind: string): void {
  const { x, y, w, h } = p, long = DEPTH[kind]!, shell = { material: 'brushed-steel', bevel: 1, zEdge: 0, zTop: long, over: { aniso: 0 } } as const;
  if (kind === 'jack') {
    // A panel jack: a phenolic block behind its threaded bush, and the nut run down onto it.
    const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) / 2;
    s.surface(rect(cx - R * 1.6, cy - R * 1.9, R * 3.2, R * 3.8, { radius: 1.5 }), { material: 'bakelite', bevel: 1, zEdge: 0, zTop: long - 2 });
    s.group({ at: [cx, cy], scale: MM }, () => hexNut(s, (R * 1.45 * Math.sqrt(3)) / MM, long - 2, 2));
    return;
  }
  if (kind === 'modular') {
    // The plastic block the hole is moulded into, with its two pegs' legs out at the sides.
    legs(s, x - 3.5 * MM, w + 7 * MM, y + h / 2);
    s.surface(rect(x - 3.5 * MM, y - 2 * MM, w + 7 * MM, h + 4 * MM, { radius: 1 }), { material: 'plastic-black', bevel: 1, zEdge: 0, zTop: long });
    return;
  }
  legs(s, x, w, y + h / 2);
  s.surface(kind === 'hdmi' ? path('M0 0 H100 V58 L84 100 H16 L0 58 Z', x, y, w, h, { spread: 4 }) : rect(x, y, w, h, { radius: kind === 'usbc' ? h / 2 : 1.5 }), shell);
}

/** A socket as it shows through a case. */
function mouth(s: Sheet, p: Part, kind: string): void {
  const { x, y, w, h } = p;
  // A socket moulded in the case, as a power inlet often is, takes the case's material.
  const shell = { material: p.el.getAttribute('material') || 'brushed-steel', bevel: 1, zEdge: 0, zTop: 0.3, over: { aniso: 0 } } as const;
  const hole = { material: 'well', bevel: 1, zEdge: 0.3, zTop: -3.4 } as const;
  if (kind === 'jack') {
    const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) / 2, plug = p.el.getAttribute('plug');
    // A panel jack is held by a nut, whose flats are what you see of it.
    if (p.el.hasAttribute('nut')) {
      s.surface(poly(Array.from({ length: 6 }, (_, i): Point => [cx + R * Math.sin((i * Math.PI) / 3 + 0.26), cy + R * Math.cos((i * Math.PI) / 3 + 0.26), 0.6]), { spread: 4 }), { ...shell, bevel: 1.6, zTop: 1.8 * MM });
      s.surface(circle(cx, cy, R * 0.72), { ...shell, zEdge: 1.8 * MM, zTop: 2.2 * MM });
      s.surface(circle(cx, cy, R * 0.4), { ...hole, zEdge: 2.2 * MM });
    } else {
      s.surface(circle(cx, cy, R), shell);
      s.surface(circle(cx, cy, R * 0.66), hole);
    }
    // The plug that's in it, seen end on: a barrel of that material, with the lead coming out of its middle.
    if (plug !== null) {
      const material = plug || 'plastic-black';
      s.surface(circle(cx, cy, R * 0.72), { material, profile: 'round', bevel: R * 0.2, zEdge: 2.2 * MM, zTop: 7 * MM, radial: true });
      s.surface(circle(cx, cy, R * 0.3), { material: 'rubber', profile: 'dome', bevel: R * 0.3, zEdge: 7 * MM, zTop: 9 * MM });
    }
    return;
  }
  if (kind === 'hdmi') {
    const box = [x, y, w, h] as const;
    s.surface(path('M0 0 H100 V58 L84 100 H16 L0 58 Z', ...box, { spread: 4 }), shell);
    s.surface(path('M5 8 H95 V54 L80 92 H20 L5 54 Z', ...box, { spread: 4 }), hole);
    s.surface(rect(x + w * 0.16, y + h * 0.28, w * 0.68, h * 0.26), { material: 'plastic-black', bevel: 0.6, zEdge: -3.4, zTop: -0.2 });
    return;
  }
  if (kind === 'modular') {
    // A telephone socket: a plain square hole in the case, a notch in one side for the plug's latch, and its contacts in the roof.
    s.well(rect(x, y + h * 0.14, w, h * 0.86, { radius: 1 }), 3.4, { bevel: 0.8 });
    s.well(rect(x + w * 0.3, y, w * 0.4, h * 0.3), 3, { bevel: 0.6 });
    for (let i = 0; i < 4; i++) s.surface(rect(x + w * (0.27 + i * 0.15), y + h * 0.26, w * 0.05, h * 0.26), { material: 'brass', zEdge: -3.4, zTop: -1.2, bevel: 0.3 });
    return;
  }
  const r = kind === 'usbc' ? h / 2 : 1.5;
  s.surface(rect(x, y, w, h, { radius: r }), shell);
  s.surface(rect(x + 1.5, y + 1.5, w - 3, h - 3, { radius: Math.max(r - 1.5, 0.5) }), hole);
  if (kind === 'sd') return;
  const tongue = kind === 'usbc' ? rect(x + w * 0.16, y + h * 0.4, w * 0.68, h * 0.2, { radius: 1 }) : rect(x + 4, y + h * 0.2, w - 8, h * 0.34);
  s.surface(tongue, { material: kind === 'usba' ? 'plastic-blue' : 'plastic-black', bevel: 0.5, zEdge: -3.4, zTop: -0.4 });
}
definePart(socket('[d-port~="usbc"]', 'usbc'));
definePart(socket('[d-port~="usba"]', 'usba'));
definePart(socket('[d-port~="hdmi"]', 'hdmi'));
defineStyles(`
label[d-port~="jack"] { display: block; cursor: pointer; border-radius: 50%; }
label[d-port~="jack"] input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: inherit; }
`);
definePart({ ...socket('[d-port~="jack"]', 'jack'), live: ['plug'] });
definePart(socket('[d-port~="sd"]', 'sd'));
definePart(socket('[d-port~="modular"]', 'modular'));

// Slots milled in a row, for air or sound. The row runs along the longer side. `rotate` turns the
// row about its middle, degrees, and `wall` is how far out a chamfer runs round each slot, mm.
// `recess` moulds each slot instead: a crisp-edged stadium that wide, mm, its floor the shell's own, falling
// from `deep` / 3 at one side to `deep`, mm, at the other, and there the slit, `slot` wide. The slit runs `run` of
// the way along, and the first `blind` of the row have none, for the ones with nothing behind them.
definePart({
  selector: '[d-opening~="vent"]',
  paint(s, p) {
    const wide = p.w > p.h && !p.el.hasAttribute('rows'), pitch = num(p, 'pitch', 2) * MM, recess = num(p, 'recess', 0) * MM, slot = p.el.hasAttribute('slot') ? num(p, 'slot', 0) * MM : recess ? recess * 0.2 : pitch * 0.45, wall = num(p, 'wall', 0) * MM;
    const across = recess || slot, n = Math.max(Math.floor(((wide ? p.w : p.h) + pitch - across) / pitch + 0.01), 1), hw = p.w / 2, hh = p.h / 2;
    const long = wide ? p.h : p.w, start = wide ? -hh : -hw, deep = num(p, 'deep', 0.8), run = num(p, 'run', 1), blind = num(p, 'blind', 0);
    s.group({ at: [p.x + hw, p.y + hh], rotate: (num(p, 'rotate', 0) * Math.PI) / 180 }, () => {
      for (let i = 0; i < n; i++) {
        const at = i * pitch + (wide ? -hw : -hh);
        // Across the slot and along it, whichever way the row runs.
        const box = (a: number, b: number, w: number, l: number) => (wide ? [at + a, start + b, w, l] : [start + b, at + a, l, w]) as [number, number, number, number];
        if (!recess) {
          const r = rect(...box(0, 0, slot, long), { radius: slot / 2 });
          if (wall) s.cut(grow(r, wall), { depth: wall * 0.3, soft: wall });
          s.surface(r, { material: 'well', bevel: 1.2, zEdge: 0, zTop: -3.4 });
          continue;
        }
        const hollow = rect(...box(0, 0, recess, long), { radius: recess / 2 }), slope = recess * 0.72;
        s.cut(hollow, { depth: deep / 3, soft: 0.5 });
        // The floor's slope, from the far wall. Its other sides lie out past the slot, so they never show.
        s.cut(within(path('M0 0H1V1H0Z', ...box(recess - slope * 2, -slope, slope * 2, long + slope * 2), { viewBox: [0, 0, 1, 1], spread: 2 }), hollow, 16), { depth: (deep * 2) / 3, soft: slope });
        if (i >= blind) s.well(rect(...box(recess * 0.08, recess * 0.3, slot, long * run - recess * 0.3), { radius: slot * 0.3 }), 2.4, { bevel: 0.4 });
      }
    });
  },
});

// A strip of LEDs behind a diffuser. `value` is how far along it is lit, 0 to 1.
definePart({
  selector: '[d-meter~="lightbar"]',
  springs: { level: { stiffness: 120, damping: 18 } },
  live: ['value', 'color', 'color2', 'pulse'],
  update(p) {
    p.springs.level!.set(num(p, 'value', 1));
  },
  tick(p, dt) {
    const pulse = num(p, 'pulse', 0);
    if (!pulse || reduced()) return false;
    p.data.t = (((p.data.t ?? 0) as number) + pulse * dt) % 1;
    return true;
  },
  paint(s, p) {
    const n = Math.max(Math.round(p.w / 7), 6), a = lamp(p, 'white');
    const b = lampColours[p.el.getAttribute('color2') ?? ''] ?? a, level = p.springs.level!.value, t = (p.data.t ?? 0) as number;
    const box = rect(p.x, p.y, p.w, p.h, { radius: p.h / 2 });
    s.surface(box, { material: 'smoked-glass', bevel: 1, zEdge: 0, zTop: -0.4 });
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, on = Math.max(0, Math.min(1, (level - k) * n + 0.5));
      const wave = t ? 0.45 + 0.55 * Math.sin((k - t) * Math.PI * 2) ** 2 : 1;
      const c: Vec3 = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      s.cut(rect(p.x + (i * p.w) / n + 0.5, p.y + 1, p.w / n - 1, p.h - 2, { radius: 1 }), { ink: scale(c, 0.02), emit: scale(c, 0.3 * on * wave) });
    }
    s.frost(box, { blur: p.h * 0.8, opacity: 0.04, tint: [0.1, 0.1, 0.11], zEdge: 0, zTop: 0.3, bevel: 2, rough: 0.3 });
  },
});

// A pane laid over what is inside it. The form says which.
const pane = (selector: string, look: FrostOptions): PartDef => ({
  selector,
  layer: 2,
  paint(s, p) {
    const tint = p.el.getAttribute('tint'), height = num(p, 'height', 1.6);
    s.frost(rect(p.x, p.y, p.w, p.h, { radius: num(p, 'radius', 2.5) * MM }), {
      ...look, blur: num(p, 'blur', look.blur ?? 14), opacity: num(p, 'opacity', look.opacity ?? 0.2),
      tint: tint ? linear(tint) : look.tint, zEdge: height - 1, zTop: height, bevel: 2.5,
    });
  },
});
definePart(pane('[d-glass~="frosted"]', { blur: 14, opacity: 0.14, rough: 0.46, coat: 0.5 }));
definePart(pane('[d-glass~="smoked"]', { blur: 0, tint: [0.006, 0.006, 0.007], opacity: 0.97, rough: 0.1, coat: 1 }));
definePart(pane('[d-glass~="clear"]', { blur: 0, opacity: 0.04, rough: 0.08, coat: 1 }));

// A flat coated window into a body, as on a viewfinder or a meter: a pane of its own over what's inside, which keeps its
// colour and texture, and a reflection of the room in the colour the coating leaves. `film` is the coating, 0 for bare
// glass, `coat` how much it shows, `radius` its corners, mm, and `height` how far it stands over what's inside, mm. `material` is what
// it's made of, glass unless it says otherwise, as a moulded polycarbonate window does.
definePart({
  selector: '[d-glass~="window"]',
  layer: 2,
  paint(s, p) {
    s.glass(rect(p.x, p.y, p.w, p.h, { radius: num(p, 'radius', 1) * MM }), {
      material: p.el.getAttribute('material') || undefined,
      height: num(p, 'height', 0.3), bevel: MM * 0.6, curve: 0, film: num(p, 'film', 0.3), rim: 0.3, coat: num(p, 'coat', 1),
    });
  },
});

// Lit text set straight onto a panel, such as a clock showing through glass.
definePart({
  selector: '[d-readout=""]',
  live: ['#text', 'color'],
  paint(s, p) {
    const value = (p.el.textContent ?? '').trim(), c = lamp(p, 'white'), css = getComputedStyle(p.el);
    if (!value) return;
    const align = css.textAlign === 'right' || css.textAlign === 'end' ? 'right' : css.textAlign === 'center' ? 'center' : 'left';
    const type = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    s.cut(text(value, p.x, p.y, p.w, p.h, { font: type, align, letterSpacing: css.letterSpacing === 'normal' ? '' : css.letterSpacing, spread: 4 }), {
      ink: scale(c, 0.03), emit: scale(c, num(p, 'gain', 0.2)),
    });
  },
});

// A screw head, drawn to fill its box. `head` is `pan`, `countersunk`, `button` or `cheese`, `drive` is `slot`, `cross`, `hex` or `star`,
// and `angle` turns the drive, in degrees. Its proportions are the ISO ones for the nearest size to the box. `socket` is a hex drive.
definePart({
  selector: '[d-fixing~="screw"]',
  paint(s, p) {
    const R = Math.min(p.w, p.h) / 2, material = p.el.getAttribute('material') || 'satin-chrome', head = p.el.getAttribute('head'), drive = p.el.getAttribute('drive');
    const kind = isScrewHead(head) ? head : 'pan', across = (R * 2) / MM;
    const size = (['M2', 'M3', 'M4'] as const).reduce((a, b) => (Math.abs(SCREWS[b].heads[kind][0] - across) < Math.abs(SCREWS[a].heads[kind][0] - across) ? b : a));
    const k = across / SCREWS[size].heads[kind][0];
    s.group({ at: [p.x + p.w / 2, p.y + p.h / 2], scale: MM * k }, () => screwHead(s, {
      head: kind, size, drive: isDrive(drive) ? drive : p.el.hasAttribute('socket') ? 'hex' : 'slot', angle: num(p, 'angle', 20) * RAD, material,
    }));
  },
});


// A battery cell lying in a bay: a steel can in a printed sleeve, flat at one end and with its nub at the other. The box is the cell,
// nub and all, as an AA is 14.5 by 50.5mm, and it lies along its long side. `plus` is the end the nub is at, `up`, `down`, `left` or
// `right`. `material` is the sleeve. What's printed on it is a mark inside, which takes its curve.
const CELL_NUB = [5.5, 1] as const, CELL_SHOULDER = 1.2, CELL_FOOT = 0.6; // spec: IEC 60086 R6, nub across and how far it stands. Then guess.
definePart({
  selector: '[d-cell~="cylinder"]',
  paint(s, p, d) {
    const down = p.h >= p.w, across = (down ? p.w : p.h) / MM, long = (down ? p.h : p.w) / MM, r = across / 2;
    const plus = p.el.getAttribute('plus') ?? (down ? 'up' : 'right'), back = plus === 'down' || plus === 'right';
    // A length of it, mm from the nub's end, as wide as `wide` mm, in the box.
    const span = (from: number, to: number, wide = across, radius = 0.4) => {
      const [a, b] = back ? [long - to, long - from] : [from, to], inset = (across - wide) / 2;
      return down ? rect(p.x + inset * MM, p.y + a * MM, wide * MM, (b - a) * MM, { radius: radius * MM }) : rect(p.x + a * MM, p.y + inset * MM, (b - a) * MM, wide * MM, { radius: radius * MM });
    };
    // Round across and straight along: it falls away to each side, and its edge rolls down to the floor.
    const round = (wide: number): [number, number] => (down ? [wide * 0.45, 0] : [0, wide * 0.45]);
    const can = { material: 'satin-steel', profile: 'round' as const, zEdge: r * 0.4, over: { wear: d.wear * 0.4 } };
    s.surface(span(CELL_NUB[1] + 0.2, long), { ...can, zTop: across, crown: round(across), bevel: r * 0.3 * MM });
    s.surface(span(CELL_NUB[1] + CELL_SHOULDER, long - CELL_FOOT, across, 0.2), {
      material: p.el.getAttribute('material') || 'gloss-black', profile: 'round', zEdge: r * 0.4, zTop: across + 0.08, crown: round(across), bevel: r * 0.3 * MM, over: { wear: d.wear * 0.3 },
    });
    s.surface(span(0, CELL_NUB[1] + 0.4, CELL_NUB[0], 0.6), { ...can, zTop: r + CELL_NUB[0] / 2, crown: round(CELL_NUB[0]), bevel: CELL_NUB[0] * 0.3 * MM });
    offerSeat(p.el, { top: seatOf(p) + across, crown: round(across), x: p.x, y: p.y, w: p.w, h: p.h });
  },
});
