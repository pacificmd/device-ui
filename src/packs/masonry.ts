// What a wall is built of. Nothing here moves or takes a hand, and it uses base alone, with materials of its own, so it's the proof that the renderer doesn't need a machine to draw on.
// All of it stands off whatever holds it by `height`, or goes back into it by `depth`, in mm, so a wall can be any thickness.
import { defineMaterials, definePart, getMaterialDef, linear, minus, MM, offerSeat, parseLength, rect, seatOf, type MaterialDef, type Part, type Vec3 } from 'device-ui';

// Fired clay. `color2` is the dark end of a kiln's range, so bricks in one batch can differ the way real ones do.
const brick = (color: string, color2: string, legend: string): MaterialDef => ({ substance: 'ceramic', finish: 'wire-cut-brick', color, color2, mottle: 0.55, fleck: 0.2, marks: 0.2, legend });

// Only a wall uses these, so they come with it, and the pack draws with nothing else imported.
export const materials: Record<string, MaterialDef> = {
  'brick-red': brick('#99472f', '#4f2620', '#efe6d8'),
  'brick-buff': brick('#c4a678', '#7c6242', '#1a1a18'),
  'mortar-lime': { substance: 'stone', finish: 'struck-mortar', color: '#bcb4a3', mottle: 0.3, legend: '#1a1a18' },
};

defineMaterials(materials);

const length = (p: Part, name: string, fallback: number) => parseLength(p.el.getAttribute(name), fallback);

/** The same number for the same brick, however the wall is painted. */
const chance = (a: number, b: number) => {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const colour = (c: unknown): Vec3 => (typeof c === 'string' ? linear(c) : c as Vec3);

/** How much a brick stands out of line, mm, either way. Guess. */
const LINE = 1;

// Bricks in mortar, filling the box, cut where it cuts them. The value is the bond: `stretcher` lays them long and breaks each joint on the course below, `soldier` stands them on end in one course.
// `brick`, `course` and `joint` are the size of one, in mm. A UK brick is the default: 215 by 65 with a 10 joint, spec. `height` is how far its face stands off the mortar.
definePart({
  selector: '[d-wall~="brickwork"]',
  options: ['stretcher', 'soldier'],
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'brick-red', mortar = p.el.getAttribute('mortar') || 'mortar-lime';
    const long = length(p, 'brick', 215) * MM, high = length(p, 'course', 65) * MM, joint = length(p, 'joint', 10) * MM, proud = length(p, 'height', 4);
    const soldier = (p.el.getAttribute('d-wall') ?? '').split(/\s+/).includes('soldier'), def = getMaterialDef(material), pale = colour(def.color), dark = colour(def.color2 ?? def.color);
    s.surface(rect(p.x, p.y, p.w, p.h), { material: mortar, rise: 0, bevel: 0 });
    const wide = soldier ? high : long, tall = soldier ? long : high, right = p.x + p.w, bottom = p.y + p.h;
    for (let row = 0, y = p.y; y < bottom; row++, y += tall + joint) {
      const shift = !soldier && row % 2 ? -(wide + joint) / 2 : 0;
      for (let at = 0, x = p.x + shift; x < right; at++, x += wide + joint) {
        const left = Math.max(x, p.x), w = Math.min(x + wide, right) - left, h = Math.min(y + tall, bottom) - y;
        if (w <= 0 || h <= 0) continue;
        // Most of a batch is near its own colour, and a few sat close to the fire.
        const burnt = chance(row, at) ** 2.5;
        s.surface(rect(left, y, w, h, { radius: 0.8 * MM }), {
          material, rise: proud + (chance(at, row) - 0.5) * 2 * LINE, bevel: 1.2 * MM, over: { color: mix(pale, dark, burnt) },
        });
      }
    }
  },
});

// A hole in a wall, as deep as the wall's outer skin, so what's set in it stands back from the face. `depth` is how far, and the floor is what shows if nothing is nested in it.
definePart({
  selector: '[d-wall~="reveal"]',
  paint(s, p, d) {
    const depth = length(p, 'depth', 102.5), material = p.el.getAttribute('material') || d.material;
    s.surface(rect(p.x, p.y, p.w, p.h), { material, zEdge: -depth, zTop: -depth, bevel: 0.4 * MM, profile: 'flat' });
    offerSeat(p.el, { top: seatOf(p) - depth, crown: [0, 0], x: p.x, y: p.y, w: p.w, h: p.h });
  },
});

// A window: a fixed frame, a sash in each light and glass behind them, filling its box. `lights` is how many, side by side. `frame` and `sash` are how wide they are, in mm, and `height` how far the frame stands off the glass.
definePart({
  selector: '[d-wall~="casement"]',
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'gloss-white', pane = p.el.getAttribute('glass') || 'glass-black';
    const frame = length(p, 'frame', 60) * MM, sash = length(p, 'sash', 45) * MM, rise = length(p, 'height', 38), lights = Math.max(+(p.el.getAttribute('lights') ?? 2), 1);
    s.surface(rect(p.x, p.y, p.w, p.h), { material: pane, rise: 0, bevel: 0 });
    const inner = p.w - frame * 2, wide = inner / lights, bar = (x: number, y: number, w: number, h: number, stand: number) =>
      s.surface(rect(x, y, w, h), { material, zEdge: 0, zTop: stand, bevel: 0.8 * MM, profile: 'chamfer' });
    for (let i = 0; i < lights; i++) {
      const x = p.x + frame + wide * i, y = p.y + frame, h = p.h - frame * 2, stand = rise * 0.7;
      s.glass(rect(x + sash, y + sash, wide - sash * 2, h - sash * 2), { height: 1.2 });
      bar(x, y, wide, sash, stand);
      bar(x, y + h - sash, wide, sash, stand);
      bar(x, y, sash, h, stand);
      bar(x + wide - sash, y, sash, h, stand);
    }
    for (let i = 1; i < lights; i++) bar(p.x + frame + wide * i - frame / 2, p.y, frame, p.h, rise);
    bar(p.x, p.y, p.w, frame, rise);
    bar(p.x, p.y + p.h - frame, p.w, frame, rise);
    bar(p.x, p.y, frame, p.h, rise);
    bar(p.x + p.w - frame, p.y, frame, p.h, rise);
  },
});

/** How far a sill's top falls for each mm it comes forward, so rain leaves it. 1 in 10, spec. */
const WEATHER = 0.1;

// A sill under an opening: it comes out past the wall by `height`, back into the opening by `depth`, and its top falls toward the front.
// It runs past the opening at each end, by `stool` mm, and those ends are left flat for the brickwork to bear on. The box is the whole of it.
definePart({
  selector: '[d-wall~="sill"]',
  paint(s, p) {
    const material = p.el.getAttribute('material') || 'cast-stone', proud = length(p, 'height', 45), back = length(p, 'depth', 102.5);
    const stool = length(p, 'stool', 110) * MM, slope = (proud + back) * WEATHER * MM, x = p.x + stool, w = p.w - stool * 2;
    // Twice as tall as it shows, as the front covers its lower half and the ends cover its sides.
    s.surface(rect(x - slope, p.y, w + slope * 2, slope * 2), { material, zEdge: -back, zTop: proud, bevel: slope, profile: 'chamfer' });
    s.surface(minus(rect(p.x, p.y, p.w, p.h), rect(x, p.y - MM, w, slope + MM)), { material, zEdge: 0, zTop: proud, bevel: 1.5 * MM, profile: 'chamfer' });
  },
});
