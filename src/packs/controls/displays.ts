// Things that show text or pictures.
import { circle, defineNames, onPen, type Pen, definePart, ellipse, getEngine, getMaterialDef, legendColor, linear, MM, partOf, path, polyline, rect, redraw, reduced, resolveMaterial, spring, squash, text, within, type FieldShape, type Part, type ScreenKind, type Vec3 } from 'device-ui';
import { DIM_FOCUS, font, lamp, num, nums, scale } from './shared.js';
import { watchPage } from './screenpage.js';
import { written } from './written.js';

const content = (p: Part) => (p.el.textContent ?? '').trim();

// An LCD panel sunk in a black frame. Its text shows in the ink of `material`.
definePart({
  selector: '[d-readout~="lcd"]',
  update(p) {
    const ink = getMaterialDef(p.el.getAttribute('material') ?? 'lcd-amber').text as string | undefined;
    if (ink && p.data.ink !== ink) {
      p.data.ink = ink;
      p.el.style.setProperty('--d-lcd-ink', ink);
    }
  },
  paint(s, p) {
    const name = p.el.getAttribute('material') || 'lcd-amber', g = 5;
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 6 }), { material: 'black-oxide', bevel: 3, zEdge: 0, zTop: 0.7 });
    s.surface(rect(p.x + g, p.y + g, p.w - 2 * g, p.h - 2 * g, { radius: 3 }), {
      material: name, bevel: 2, zEdge: 0.7, zTop: -0.6,
    });
    if (p.focused) s.glow(rect(p.x + 1, p.y + 1, p.w - 2, p.h - 2, { radius: 6 }), DIM_FOCUS);
  },
});

// Segments in a 60 by 100 box.
type Bar = [number, number][];
const across = (y: number): Bar => [[10, y], [14, y - 4], [46, y - 4], [50, y], [46, y + 4], [14, y + 4]];
const down = (x: number, y0: number, y1: number): Bar => [[x, y0], [x + 4, y0 + 4], [x + 4, y1 - 4], [x, y1], [x - 4, y1 - 4], [x - 4, y0 + 4]];
const SEG: Record<string, Bar> = {
  a: across(8), g: across(50), d: across(92),
  f: down(8, 10, 48), b: down(52, 10, 48), e: down(8, 52, 90), c: down(52, 52, 90), p: down(30, 28, 72),
};
const GLYPHS: Record<string, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  '-': 'g', '+': 'gp', _: 'd', A: 'abcefg', B: 'cdefg', C: 'adef', D: 'bcdeg', E: 'adefg', F: 'aefg', G: 'acdef', H: 'bcefg', I: 'ef',
  J: 'bcd', L: 'def', N: 'ceg', O: 'cdeg', P: 'abefg', R: 'eg', S: 'acdfg', T: 'defg', U: 'bcdef', Y: 'bcdfg',
};
/** The segments of a character as a path. `lean` is how far the top runs to the right, per unit of height. */
export const glyph = (ch: string, lean = 0) => [...(GLYPHS[ch.toUpperCase()] ?? '')]
  .map(k => `M${SEG[k]!.map(([x, y]) => `${x + (50 - y) * lean} ${y}`).join(' L')} Z`).join(' ');

// `<div d-readout="seven" color="red">12:34</div>`. The text is real, so it reads out and copies, and a space is a blank digit.
// `bare` leaves off its panel and glass, for digits that are part of whatever they sit on. `slant` leans them, degrees.
// `point-cell` gives a decimal point a digit's place of its own, as on displays where it's a separate LED.
definePart({
  selector: '[d-readout~="seven"]',
  live: ['#text', 'color'],
  paint(s, p) {
    const bare = p.el.hasAttribute('bare'), lean = Math.tan((num(p, 'slant', 0) * Math.PI) / 180);
    const pad = bare ? 0 : Math.max(p.h * 0.14, 5), h = p.h - pad * 2, c = lamp(p, 'red'), dead = p.el.hasAttribute('dead'), separate = p.el.hasAttribute('point-cell');
    const cells: { ch: string; colon: boolean; dot: boolean }[] = [];
    for (const ch of (p.el.textContent ?? '').replace(/[\n\t]/g, '')) {
      if (ch === '.' && separate) cells.push({ ch: ' ', colon: false, dot: true });
      else if (ch === ':' || ch === '.') {
        const last = cells[cells.length - 1];
        if (last) last[ch === ':' ? 'colon' : 'dot'] = true;
      } else cells.push({ ch, colon: false, dot: false });
    }
    while (cells.length < num(p, 'digits', 0)) cells.unshift({ ch: ' ', colon: false, dot: false });
    // Squeezed narrower than its digits are tall, the gaps between them give way first, so a digit never turns inside out.
    const cell = (p.w - pad * 2) / Math.max(cells.length, 1), gap = Math.min(h * 0.14, cell / 2), w = Math.min(h * 0.56, cell - gap);
    const panel = rect(p.x, p.y, p.w, p.h, { radius: 3 }), lit = { ink: scale(c, 0.05), emit: scale(c, num(p, 'gain', 0.62)) };
    if (!bare) s.surface(panel, { material: 'smoked-glass', bevel: 2, zEdge: 0, zTop: 0.5 });
    let x = p.x + p.w - pad - w - gap * 0.4;
    for (let i = cells.length - 1; i >= 0; i--) {
      const { ch, colon, dot } = cells[i]!;
      const seg = (d: string) => path(d, x, p.y + pad, w, h, { viewBox: [0, 0, 60, 100], spread: 3 });
      if (!dead) s.cut(seg(glyph('8', lean)), { ink: scale(c, 0.006) });
      const on = glyph(ch, lean);
      if (on) s.cut(seg(on), lit);
      if (dot) s.cut(circle(separate ? x + w / 2 : x + w + gap * 0.3, p.y + pad + h * 0.93, h * 0.05), lit);
      if (colon) {
        for (const k of [0.3, 0.7]) s.cut(circle(x + w + gap * 0.5, p.y + pad + h * k, h * 0.05), lit);
      }
      x -= w + gap + (i > 0 && cells[i - 1]!.colon ? gap * 0.8 : 0);
    }
    if (!bare) s.glass(panel, { height: 0.4, bevel: 6, coat: 0.7 });
  },
});

// The strokes of one digit on segmented glass, `w` by `h`, `t` thick, leaning `lean` across per unit up. The ends are mitred
// with a fine gap between them, as etched electrodes are. `i` and `j` are stems down the middle, for letters a digit can't make.
const strokes = (w: number, h: number, t: number, lean: number) => {
  const W = w - lean * h, g = t * 0.14, r = t * 0.12, mid = h / 2;
  const seg = (pts: [number, number][]) => polyline(pts.map(([x, y]) => [x + lean * (h - y), y, r]));
  const flipX = (pts: [number, number][]) => pts.map(([x, y]): [number, number] => [W - x, y]);
  const flipY = (pts: [number, number][]) => pts.map(([x, y]): [number, number] => [x, h - y]);
  const top: [number, number][] = [[t * 0.75, 0], [W - t * 0.75, 0], [W - t * 1.45, t], [t * 1.45, t]];
  const side: [number, number][] = [[t * 0.16, g * 1.6], [t * 1.1, t + g * 1.4], [t * 1.1, mid - t * 0.6], [t * 0.55, mid - g], [0, mid - t * 0.5]];
  const stem: [number, number][] = [[W / 2 - t * 0.38, t + g * 2], [W / 2 + t * 0.38, t + g * 2], [W / 2 + t * 0.38, mid - t * 0.5 - g * 2], [W / 2 - t * 0.38, mid - t * 0.5 - g * 2]];
  return {
    a: seg(top), d: seg(flipY(top)), f: seg(side), b: seg(flipX(side)), e: seg(flipY(side)), c: seg(flipX(flipY(side))),
    g: seg([[t * 0.6, mid], [t * 1.1, mid - t * 0.46], [W - t * 1.1, mid - t * 0.46], [W - t * 0.6, mid], [W - t * 1.1, mid + t * 0.46], [t * 1.1, mid + t * 0.46]]),
    i: seg(stem), j: seg(flipY(stem)),
  } as Record<string, string>;
};
// What a stem makes possible.
const STEMMED: Record<string, string> = { T: 'aij', M: 'abcefi', W: 'bcdefj' };

interface GlassCell {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** A digit's strokes, or null for one fixed shape. */
  strokes: Record<string, string> | null;
  stems: boolean;
  d: string;
  view: [number, number, number, number];
  /** A word etched as one electrode, as a meter's units are. */
  word: string;
  weight: number;
}

const glassOf = (p: Part) => (p.data.glass ??= [...p.el.querySelectorAll('d-seg')].map((el): GlassCell => {
  const a = (n: string) => el.getAttribute(n), [x = 0, y = 0, w = 0, h = 0] = (a('box') ?? '').trim().split(/\s+/).map(v => +v * MM);
  const d = a('path') ?? '', word = a('text') ?? '';
  return {
    name: a('name') ?? '', x, y, w, h, stems: el.hasAttribute('stems'), d, word, weight: +(a('weight') ?? 500), view: (a('viewbox')?.trim().split(/\s+/).map(Number) ?? [0, 0, 1, 1]) as GlassCell['view'],
    strokes: d || word ? null : strokes(w, h, +(a('stroke') ?? 0.5) * MM, +(a('lean') ?? 0)),
  };
})) as GlassCell[];

const every = (c: GlassCell) => (c.stems ? 'abcdefgij' : 'abcdefg');
const driven = (c: GlassCell, ch: string) => {
  if (ch === '*') return every(c);
  const up = ch.toUpperCase();
  return (c.stems && STEMMED[up]) || GLYPHS[ch] || GLYPHS[up] || '';
};

// Glass with its electrodes etched to order, one shape each, as a watch or a meter has: no pixels, and nothing it can show but what was cut.
defineNames('d-seg');

// `<d-seg name box stroke lean stems>` children are digits, and `<d-seg name box path viewbox>` or `<d-seg name box text weight>` fixed shapes, `box` being x y w h in mm from
// the glass's corner. `on` lists what's driven: a digit as `name=5`, or `name=*` for every stroke, and a shape by its name. `ghost` shows
// what's off, 0 to 1, as a slant of the light does. `light` is a lamp beside the glass at `light-at` in mm, spreading `light-size` mm across, in `color`.
definePart({
  selector: '[d-readout~="segments"]',
  live: ['on', 'light', 'aria-label'],
  paint(s, p) {
    const name = p.el.getAttribute('material') || 'lcd-grey', glass = glassOf(p), ink = linear(String(getMaterialDef(name).text ?? '#101214'));
    const ground = resolveMaterial(name).color, ghost = num(p, 'ghost', 0);
    const place = (c: GlassCell, d: string) => c.word ? text(c.word, p.x + c.x, p.y + c.y, c.w, c.h, { font: font(p, c.h * 0.86, c.weight), spread: 2 }) : path(d, p.x + c.x, p.y + c.y, c.w, c.h, { viewBox: c.strokes ? [0, 0, c.w, c.h] : c.view, spread: 2 });
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: num(p, 'radius', 1) * MM }), { material: name, profile: 'flat', zEdge: 0, zTop: 0 });
    if (p.el.hasAttribute('light')) {
      const [x = 0, y = 0] = (p.el.getAttribute('light-at') ?? '').trim().split(/\s+/).map(v => +v * MM), size = num(p, 'light-size', 20) * MM;
      // It lights the glass and nothing past it: the case around it is opaque.
      s.cut(within(ellipse(p.x + x, p.y + y, size / 2, size / 2), rect(p.x, p.y, p.w, p.h, { radius: num(p, 'radius', 1) * MM }), 64), { emit: scale(lamp(p, 'green'), 0.2), feather: size * 0.46 });
    }
    // Lit from behind, what's off goes.
    if (ghost && !p.el.hasAttribute('light')) {
      const off = scale(ground, 1 - ghost * 0.3);
      for (const c of glass) s.cut(place(c, c.strokes ? [...every(c)].map(k => c.strokes![k]).join(' ') : c.d), { ink: off });
    }
    const on = (p.el.getAttribute('on') ?? '').split(' ');
    for (const c of glass) {
      for (const token of on) {
        if (!c.strokes) {
          if (token === c.name) s.cut(place(c, c.d), { ink, rough: 0.5 });
        } else if (token.startsWith(`${c.name}=`)) {
          const lit = [...driven(c, token.slice(c.name.length + 1))].map(k => c.strokes![k]).join(' ');
          if (lit) s.cut(place(c, lit), { ink, rough: 0.5 });
        }
      }
    }
  },
});

// Fourteen thin strokes in a 60 by 100 box, each named: `a` to `f` round the outside, `g` and `h` the two halves of the middle, and `i` to `n` the star inside it, clockwise from top left.
const STROKES: Record<string, [number, number, number, number]> = {
  a: [10, 6, 50, 6], b: [54, 9, 54, 47], c: [54, 53, 54, 91], d: [10, 94, 50, 94], e: [6, 53, 6, 91], f: [6, 9, 6, 47], g: [10, 50, 27, 50], h: [33, 50, 50, 50],
  i: [11, 12, 26, 44], j: [30, 11, 30, 45], k: [49, 12, 34, 44], l: [34, 56, 49, 88], m: [30, 55, 30, 89], n: [26, 56, 11, 88],
};
const STAR: Record<string, string> = {
  A: 'abcefgh', B: 'abcdjmh', C: 'adef', D: 'abcdjm', E: 'adefg', F: 'aefg', G: 'acdefh', H: 'bcefgh', I: 'adjm', J: 'bcde', K: 'efgkl', L: 'def', M: 'bcefik', N: 'bcefil', O: 'abcdef', P: 'abefgh', Q: 'abcdefl',
  R: 'abefghl', S: 'acdfgh', T: 'ajm', U: 'bcdef', V: 'efkn', W: 'bcefln', X: 'ikln', Y: 'ikm', Z: 'adkn',
  0: 'abcdefkn', 1: 'bc', 2: 'abdegh', 3: 'abcdh', 4: 'bcfgh', 5: 'acdfgh', 6: 'acdefgh', 7: 'abc', 8: 'abcdefgh', 9: 'abcdfgh', '-': 'gh', "'": 'j', '/': 'kn',
};
const stroke = (k: string, lean: number, width: number) => {
  const [x0, y0, x1, y1] = STROKES[k]!, dx = x1 - x0 + (y0 - y1) * lean, dy = y1 - y0, len = Math.hypot(dx, dy), nx = (-dy / len) * width, ny = (dx / len) * width;
  const X0 = x0 + (50 - y0) * lean, X1 = x1 + (50 - y1) * lean;
  return `M${X0 + nx} ${y0 + ny} L${X1 + nx} ${y1 + ny} L${X1 - nx} ${y1 - ny} L${X0 - nx} ${y0 - ny} Z`;
};

// `<div d-readout="starburst" color="phosphor" digits="8">SPELL</div>`: an alphanumeric tube, each character out of fourteen strokes, as on a vacuum fluorescent display.
// The text is real, and fills from the left. `weight` is a stroke's width as a share of the character's height, and `slant` leans it, degrees.
// It has no panel of its own: it sits under whatever glass holds it.
definePart({
  selector: '[d-readout~="starburst"]',
  live: ['#text', 'color'],
  paint(s, p) {
    const n = num(p, 'digits', 8), lean = Math.tan((num(p, 'slant', 0) * Math.PI) / 180), c = lamp(p, 'phosphor'), width = (num(p, 'weight', 0.09) * 100) / 2;
    const pitch = p.w / n, w = Math.min(pitch * 0.78, p.h * 0.6), chars = [...(p.el.textContent ?? '').replace(/[\n\t]/g, '').toUpperCase()];
    const dead = Object.keys(STROKES).map(k => stroke(k, lean, width)).join(' ');
    const lit = { ink: scale(c, 0.05), emit: scale(c, num(p, 'gain', 0.62)) };
    for (let i = 0; i < n; i++) {
      const seg = (d: string) => path(d, p.x + i * pitch, p.y, w, p.h, { viewBox: [0, 0, 60, 100], spread: 2 });
      s.cut(seg(dead), { ink: scale(c, 0.0012) });
      const on = STAR[chars[i] ?? ' '];
      if (on) s.cut(seg([...on].map(k => stroke(k, lean, width)).join(' ')), lit);
    }
  },
});

const NIXIE: [number, number, number] = [7, 1.9, 0.26];

// Numerals made of wire, glowing inside glass tubes, one tube per character.
definePart({
  selector: '[d-readout~="nixie"]',
  live: ['#text'],
  paint(s, p) {
    const value = content(p), n = Math.max(value.length, num(p, 'digits', 0), 1);
    const gap = 3, w = (p.w - gap * (n - 1)) / n, h = p.h, size = h * 0.66;
    const type = `300 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    for (let i = 0; i < n; i++) {
      const x = p.x + i * (w + gap), ch = value[i - (n - value.length)];
      s.surface(rect(x + w * 0.1, p.y + h * 0.9, w * 0.8, h * 0.1, { radius: 2 }), { material: 'black-oxide', bevel: 2, zEdge: 0, zTop: 2 });
      const tube = rect(x, p.y, w, h * 0.94, { radius: Math.min(w * 0.46, 22) });
      s.surface(tube, { material: 'smoked-glass', profile: 'flat', zEdge: 0.5, zTop: 0.5, over: { color: [0.018, 0.012, 0.009] } });
      const box = [x, p.y + h * 0.06, w, h * 0.8] as const;
      if (ch && ch !== ' ') {
        const glyphs = text(ch, ...box, { font: type });
        s.cut(glyphs, { ink: [0.02, 0.01, 0.006], emit: scale(NIXIE, 0.1) });
        s.glow(glyphs, NIXIE, 0.8);
      }
      s.glass(tube, { height: 2.6, bevel: w * 0.46 });
    }
  },
});

const ALPHABET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.:/';
const half = (shape: FieldShape, top: boolean): FieldShape => ({
  ...shape,
  key: `${shape.key}|${top ? 'top' : 'low'}`,
  draw(ctx, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-20, top ? -20 : h / 2, w + 40, h / 2 + 20);
    ctx.clip();
    shape.draw(ctx, w, h);
    ctx.restore();
  },
});

interface Cell {
  at: number;
  to: number;
  t: number;
}

// A departure board. Flaps run through the alphabet to reach each new letter.
definePart({
  selector: '[d-readout~="flip"]',
  live: ['#text'],
  update(p) {
    const value = content(p).toUpperCase(), n = num(p, 'cells', value.length);
    const cells = (p.data.cells ??= []) as Cell[];
    for (let i = 0; i < n; i++) {
      const to = Math.max(ALPHABET.indexOf(value[i] ?? ' '), 0);
      const cell = (cells[i] ??= { at: to, to, t: 0 });
      cell.to = to;
      if (reduced()) {
        cell.at = to;
        cell.t = 0;
      }
    }
    cells.length = n;
  },
  tick(p, dt) {
    let moving = false;
    for (const c of (p.data.cells ?? []) as Cell[]) {
      if (c.at === c.to && !c.t) continue;
      moving = true;
      c.t += dt * 16;
      if (c.t >= 1) {
        c.t = 0;
        c.at = (c.at + 1) % ALPHABET.length;
      }
    }
    return moving;
  },
  paint(s, p) {
    const cells = (p.data.cells ?? []) as Cell[], n = Math.max(cells.length, 1);
    const gap = 3, w = (p.w - gap * (n - 1)) / n, h = p.h, mid = p.y + h / 2;
    const type = `600 ${h * 0.72}px ${getComputedStyle(p.el).fontFamily}`;
    const flap = 'lacquer-black', ink: [number, number, number] = [0.8, 0.78, 0.7];
    cells.forEach((c, i) => {
      const x = p.x + i * (w + gap), now = ALPHABET[c.at]!, next = ALPHABET[(c.at + 1) % ALPHABET.length]!;
      const glyph = (ch: string) => text(ch, x, p.y, w, h, { font: type, spread: 2 });
      s.surface(rect(x, p.y, w, h, { radius: 3 }), { material: flap, bevel: 2, zEdge: 0, zTop: 1.4, over: { rough: 0.5 } });
      if (c.t > 0) {
        if (next !== ' ') s.cut(half(glyph(next), true), { ink });
        if (now !== ' ') s.cut(half(glyph(now), false), { ink });
        const first = c.t < 0.5, k = Math.max(Math.abs(Math.cos(c.t * Math.PI)), 0.02), fh = (h / 2) * k;
        s.surface(rect(x, first ? mid - fh : mid, w, fh, { radius: 2 }), { material: flap, bevel: 1, zEdge: 1.4, zTop: 2.4, over: { rough: 0.5 } });
        const ch = first ? now : next;
        if (ch !== ' ') {
          const g = squash(half(glyph(ch), first), k);
          s.cut({ ...g, cy: mid }, { ink });
        }
      } else if (now !== ' ') s.cut(glyph(now), { ink });
      s.cut(rect(x - 1, mid - 0.6, w + 2, 1.2), { depth: 0.6, ink: [0.004, 0.004, 0.004] });
    });
  },
});

// Number wheels behind a window, with each one carrying into the next.
definePart({
  selector: '[d-readout~="odometer"]',
  springs: { value: spring({ mass: 20, return: 0.0033, friction: 1.0 }) },
  live: ['#text'],
  update(p) {
    p.springs.value!.set(+content(p) || 0);
  },
  paint(s, p) {
    const n = Math.max(num(p, 'digits', 0), content(p).length, 1), name = p.el.getAttribute('material') || 'keycap-ivory';
    const pad = 3, gap = 1.5, w = (p.w - pad * 2 - gap * (n - 1)) / n, h = p.h - pad * 2, cy = p.y + p.h / 2;
    const type = `600 ${h * 0.66}px ${getComputedStyle(p.el).fontFamily}`;
    const v = Math.max(p.springs.value!.value, 0), ink = legendColor(name);
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 3 }), { material: 'black-oxide', bevel: 2, zEdge: 0, zTop: 1.8 });
    for (let i = 0; i < n; i++) {
      const place = 10 ** (n - 1 - i), x = p.x + pad + i * (w + gap);
      const whole = Math.floor(v / place) % 10, lower = (v % place) / place;
      // A wheel only turns during the last tenth of the one below it.
      const pos = whole + (place === 1 ? v % 1 : Math.max(0, (lower - 0.9) * 10));
      s.surface(rect(x, p.y + pad, w, h, { radius: 1 }), { material: name, bevel: h * 0.44, zEdge: -2.4, zTop: 0.2 });
      const base = Math.floor(pos);
      for (let k = base - 1; k <= base + 2; k++) {
        const a = (k - pos) * Math.PI / 3;
        if (Math.abs(a) > 0.95) continue;
        const f = Math.cos(a), y = cy + Math.sin(a) * h * 0.38;
        const g = squash(text(String(((k % 10) + 10) % 10), x, cy - h / 2, w, h, { font: type, spread: 2 }), f);
        s.cut({ ...g, cy: y }, { ink });
      }
    }
  },
});

// Five columns per letter, low bit at the top, from space to Z.
const LETTERS = '000000000000005f00000007000700147f147f14242a7f2a12231308646236495620500008070300001c2241000041221c002a1c7f1c2a08083e080800503000000808080808006060000020100804023e5149453e00427f400072494949462141494d331814127f1027454545393c4a49493141211109073649494936464949291e0000140000004034000000081422411414141414004122140802015909063e415d594e7c1211127c7f494949363e414141227f4141413e7f494949417f090909013e414151737f0808087f00417f41002040413f017f081422417f404040407f021c027f7f0408107f3e4141413e7f090909063e4151215e7f09192946264949493203017f01033f4040403f1f2040201f3f4038403f631408146303047804036159494d43';
/** The five columns of a letter, low bit at the top, for anything drawing its own pixels. */
export const letter = (ch: string) => {
  const i = (ch.toUpperCase().codePointAt(0) ?? 32) - 32;
  return i < 0 || i > 58 ? [0, 0, 0, 0, 0] : [0, 1, 2, 3, 4].map(k => parseInt(LETTERS.slice(i * 10 + k * 2, i * 10 + k * 2 + 2), 16));
};

/** Lights the columns of `str` on a canvas, each letter `size` LEDs to the dot. */
function letters(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number): void {
  for (const ch of str) {
    letter(ch).forEach((bits, i) => {
      for (let b = 0; b < 7; b++) if (bits >> b & 1) ctx.fillRect(x + i * size, y + b * size, size, size);
    });
    x += 6 * size;
  }
}

// `<div d-readout="matrix" color="white" pitch="1">HELLO</div>`. Each dot is one LED, and `scroll`
// runs anything too long to fit past the window.
definePart({
  selector: '[d-readout~="matrix"]',
  live: ['#text', 'color', 'scroll'],
  tick(p) {
    if (!p.el.hasAttribute('scroll') || !p.data.long || reduced()) return false;
    const at = Math.floor(performance.now() / 45);
    if (at === p.data.at) {
      getEngine().schedule();
      return false;
    }
    p.data.at = at;
    return true;
  },
  paint(s, p) {
    const g = num(p, 'frame', 1) * MM, pitch = num(p, 'pitch', 1) * MM, value = content(p), c = lamp(p, 'red'), top = Math.max(...c);
    const canvas = (p.data.canvas ??= document.createElement('canvas')) as HTMLCanvasElement;
    const cols = Math.max(Math.floor((p.w - g * 2) / pitch), 1), rows = Math.max(Math.floor((p.h - g * 2) / pitch), 1);
    if (canvas.width !== cols || canvas.height !== rows) Object.assign(canvas, { width: cols, height: rows });
    const ctx = canvas.getContext('2d')!, size = Math.max(Math.floor(rows / 8), 1), span = value.length * 6 * size - size;
    p.data.long = span > cols;
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, cols, rows);
    ctx.fillStyle = `rgb(${c.map(v => Math.round((v / top) * 255)).join()})`;
    const run = p.data.long && p.el.hasAttribute('scroll') && !reduced();
    const x = run ? cols - ((p.data.at as number ?? 0) % (span + cols)) : p.data.long ? 0 : Math.floor((cols - span) / 2);
    letters(ctx, value, x, Math.floor((rows - 7 * size) / 2), size);
    s.surface(rect(p.x, p.y, p.w, p.h, { radius: 4 }), {
      material: p.el.getAttribute('material') || 'black-oxide', bevel: g * 0.7, zEdge: 0, zTop: 0.8,
    });
    s.screen(rect(p.x + g, p.y + g, p.w - g * 2, p.h - g * 2, { radius: 2 }), canvas, {
      kind: 'led', gain: num(p, 'gain', 1.4), color: [0.006, 0.006, 0.007], zTop: -0.2, rough: 0.34, coat: 0.3,
    });
  },
});

const FRAME: Record<ScreenKind, number> = { crt: 12, led: 5, lcd: 5, oled: 3, tft: 3, eink: 8, coat: 0 };
const kindOf = (el: Element) => (el.getAttribute('kind') || 'crt') as ScreenKind;

/** How far in from a d-screen's box the picture starts, css px. `frame` sets it in mm. */
export function screenFrame(el: Element): number {
  const v = el.getAttribute('frame');
  return v === null || v === '' ? FRAME[kindOf(el)] : +v * MM;
}
/** The gap between an LED wall's cabinets, mm (guess: a wall of the 2000s, before they butted up seamless). */
const SEAM = 1.5;
const GAIN: Record<ScreenKind, number> = { crt: 3, led: 3, lcd: 0, oled: 0.85, tft: 0.85, eink: 0, coat: 0 };
const PANEL: Partial<Record<ScreenKind, string>> = { oled: 'oled-panel', tft: 'tft-panel', eink: 'eink-panel' };
/** How much brighter a colour panel's white is than its black with the backlight on. */
const LEAK = 300;

/** Liquid crystal takes time to turn, so what's shown only follows what's drawn, and old pixels hang on as ghosts. */
const settle = (p: Part, source: HTMLCanvasElement) => {
  const r = num(p, 'response', 0);
  if (!r) return source;
  const ghost = (p.data.ghost ??= document.createElement('canvas')) as HTMLCanvasElement;
  // A panel can change size, and a new size starts it from nothing.
  if (ghost.width !== source.width || ghost.height !== source.height) Object.assign(ghost, { width: source.width, height: source.height });
  const ctx = ghost.getContext('2d')!, now = performance.now();
  ctx.globalAlpha = now >= ((p.data.until as number) ?? 0) ? 1 : 1 - Math.exp(-(now - (p.data.last as number)) / r);
  ctx.drawImage(source, 0, 0);
  p.data.last = now;
  return ghost;
};

/** Shows what has just been drawn on a screen's canvas, once. A screen drawing every frame holds `live` instead, and a panel with a `response` carries on settling by itself. */
export function present(el: Element): void {
  const p = partOf(el), r = p ? num(p, 'response', 0) : 0;
  if (r) p!.data.until = performance.now() + r * 5;
  redraw(el);
}

/** Where a pen on a screen lands, in its canvas's pixels: inside the frame, and inside the `active` area if it has one. */
export function onTouch(el: HTMLElement, o: Pen): () => void {
  return onPen(el, () => {
    const canvas = el.querySelector('canvas'), p = partOf(el), g = screenFrame(el), [aw = 0, ah = 0] = p ? nums(p, 'active', []) : [];
    const w = el.offsetWidth - g * 2, h = el.offsetHeight - g * 2, iw = aw ? aw * MM : w, ih = ah ? ah * MM : h;
    return { x: g + (w - iw) / 2, y: g + (h - ih) / 2, w: iw, h: ih, cols: canvas?.width ?? iw, rows: canvas?.height ?? ih };
  }, o);
}

/** Whether what's on a live screen has changed since it last looked. Anything it can't see into, it has to take on trust. */
function changed(p: Part): boolean {
  const source = p.el.querySelector<HTMLCanvasElement | HTMLVideoElement | HTMLImageElement>('canvas,video,img');
  if (source instanceof HTMLCanvasElement) {
    const said = written(source);
    if (said !== null) return said;
  }
  if (!(source instanceof HTMLVideoElement)) return true;
  // A video has no way to say, so it's looked at every frame. A paused one shows the same frame.
  getEngine().schedule();
  if (p.data.time === source.currentTime) return false;
  p.data.time = source.currentTime;
  return true;
}

// `<d-screen kind="crt" live><canvas width="160" height="120"></canvas></d-screen>`.
// `kind` is crt, led, lcd, oled, tft, eink or coat. Draw on the canvas however you like: one canvas
// pixel is one pixel, LED or scanline. A coat gives no light: it's a film on the back of glass, its `material` lit by the room, its `text` colour what's behind, and the canvas how much of it is left. A video or image works too. `mono` makes a crt a monochrome tube, one even phosphor, and `bulge` is how far its picture bows.
// An lcd takes `response`, ms for a pixel to turn, and `rate`, the panel's frames a second while it does. Any panel's `active`
// is the size of its pixels' area in mm, the rest being bare panel or dark glass. `backlight` is a lamp colour, on with `lit`, `glow` strong, and `wash` how far it colours the panel, 0 to 1.
// `pointer` says what's on it draws its own pointer, so the page's goes away over it. An led wall takes `cabinet`, the width and height of the panels it's built of in mm, and shows the seams between them.
// Or put real elements on it: `<d-screen kind="lcd"><canvas width="640" height="400"></canvas><form>...</form></d-screen>`. One element, which fills the panel,
// laid out by the browser and live as ever, and shown through the panel at the canvas's pixels, or with `pitch`, mm between pixels, at as many as fit the panel at any size. It's written as it should look, dark on light on a panel lit by the room, light on dark on one that gives light. With no canvas it gets one, a pixel to a css px.
definePart({
  selector: 'd-screen',
  connect(p) {
    const page = p.el.querySelector<HTMLElement>(':scope > :not(canvas, video, img)');
    if (!page) return;
    const canvas = p.el.querySelector<HTMLCanvasElement>(':scope > canvas') ?? p.el.insertBefore(Object.assign(document.createElement('canvas'), { width: page.offsetWidth, height: page.offsetHeight }), page);
    return watchPage(page, canvas, kindOf(p.el), () => present(p.el), num(p, 'pitch', 0));
  },
  tick(p) {
    if (p.el.hasAttribute('live') && changed(p)) return true;
    const until = p.data.until as number | undefined;
    if (until === undefined) return false;
    const now = performance.now();
    if (now - (p.data.last as number) < 1000 / num(p, 'rate', 12)) {
      getEngine().schedule();
      return false;
    }
    if ((p.data.last as number) >= until) {
      p.data.until = undefined;
      return false;
    }
    return true;
  },
  live: ['live', 'lit'],
  update() {
    getEngine().schedule();
  },
  paint(s, p, d) {
    const kind = kindOf(p.el);
    const source = p.el.querySelector<HTMLCanvasElement | HTMLVideoElement | HTMLImageElement>('canvas,video,img');
    const bezel = p.el.getAttribute('bezel') || 'black-oxide', g = screenFrame(p.el);
    const panel = p.el.getAttribute('material') || PANEL[kind], radius = num(p, 'radius', kind === 'crt' ? 3 : 1) * MM;
    if (g > 0) {
      s.surface(rect(p.x, p.y, p.w, p.h, { radius }), {
        material: bezel, bevel: g * 0.7, zEdge: 1, zTop: -0.8, over: { wear: d.wear * 0.3 },
      });
    }
    const ready = source instanceof HTMLVideoElement ? source.readyState >= 2
      : source instanceof HTMLImageElement ? source.complete && source.naturalWidth > 0 : !!source?.width;
    if (!source || !ready) return;
    const area = rect(p.x + g, p.y + g, p.w - g * 2, p.h - g * 2, { radius: kind === 'crt' ? radius + 2 : Math.max(radius - g, 1) });
    const m = panel ? resolveMaterial(panel) : null, ink = panel ? getMaterialDef(panel).text as string | undefined : undefined;
    const [aw, ah] = nums(p, 'active', []), lit = p.el.hasAttribute('lit'), hue = lamp(p, p.el.getAttribute('backlight') ?? 'white'), top = Math.max(...hue), tft = kind === 'tft', gain = tft && !lit ? 0 : num(p, 'gain', GAIN[kind]);
    // A backlight shows through a mono panel's glass, all of it. On a colour panel the picture is the backlight, so what's left
    // is what leaks through its blacks, a contrast of about 300 to 1 on a TFT of the 2000s (guess).
    const light = !lit ? [0, 0, 0] : kind === 'oled' || tft ? scale(hue, num(p, 'glow', gain / LEAK) / top) : scale(hue, num(p, 'glow', 0.1));
    // In a lit room a backlit panel looks like a coloured sheet more than a lamp, and a lamp that bright would light the case around it.
    const wash = lit ? num(p, 'wash', 0) : 0;
    s.screen(area, source instanceof HTMLCanvasElement ? settle(p, source) : source, {
      kind, mono: p.el.hasAttribute('mono'), bulge: num(p, 'bulge', 0.24), gain, color: m?.color.map((v, i) => v + (hue[i]! / top - v) * wash) as Vec3 | undefined, emit: m?.emit.map((v, i) => v + light[i]!) as Vec3 | undefined, zTop: -num(p, 'depth', 0.9),
      rough: m?.rough, coat: m?.coat, metal: m?.metal, ink: tft ? scale(hue, 1 / top) : ink ? linear(ink) : undefined,
      inset: aw && ah ? [(1 - (aw * MM) / (p.w - g * 2)) / 2, (1 - (ah * MM) / (p.h - g * 2)) / 2] : undefined,
    });
    // A tube's face is a thick pressed glass, 10 mm and more at its middle (guess).
    if (kind === 'crt') s.glass(area, { height: 1.4, bevel: Math.min(p.w, p.h) * 0.4, curve: 0.3, thick: 10 });
    // A wall of LED is built of cabinets, each a panel of its own, and where two butt up there's a line with no pixels in it.
    const [cw = 0, ch = 0] = kind === 'led' ? nums(p, 'cabinet', []) : [], x0 = p.x + g, y0 = p.y + g, x1 = p.x + p.w - g, y1 = p.y + p.h - g, gap = SEAM * MM;
    const line = (x: number, y: number, w: number, h: number) => s.print(rect(x, y, w, h), [0.003, 0.003, 0.0035], { emit: [0, 0, 0], rough: 0.7, soft: gap / 2 });
    if (cw > 0) for (let x = x0 + cw * MM; x < x1 - gap; x += cw * MM) line(x - gap / 2, y0, gap, y1 - y0);
    if (ch > 0) for (let y = y0 + ch * MM; y < y1 - gap; y += ch * MM) line(x0, y - gap / 2, x1 - x0, gap);
  },
});
