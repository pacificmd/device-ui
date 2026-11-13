import type { Pattern } from './types.js';

/** Waviness over centimetres, in mm: distance between crests, and crest to trough. */
export interface Broad {
  wave: number;
  height: number;
}

/** Texture you can see, in mm: distance between features, whatever the shape, and how deep they go. */
export interface Relief {
  shape: Pattern;
  size: number;
  depth: number;
}

/**
 * What only shows inside a highlight, in mm. Gloss comes from slope, not height, so it takes the
 * roughness Ra and the spacing of the bumps. `dir` is how much of it runs one way, 0 to 1.
 */
export interface Fine {
  ra: number;
  spacing: number;
  dir?: number;
}

/** How a surface was made, at three sizes. `none` is a statement about the surface, never a default. */
export interface Finish {
  broad: Broad | 'none';
  pattern: Relief | 'none';
  fine: Fine | 'none';
  /** A clear layer the process leaves on top, 0 to 1. */
  coat?: number;
}

const lay = (wave: number, height: number): Broad => ({ wave, height });
const cut = (shape: Pattern, size: number, depth: number): Relief => ({ shape, size, depth });
const ra = (mm: number, spacing: number, dir?: number): Fine => ({ ra: mm, spacing, ...(dir && { dir }) });

// spec means a published number, guess means ours. Most spacings are guesses: they were set so that
// slope gives the gloss of the real thing. Most broad heights are guesses too, outside paint.
const TABLE = {
  // Moulded. Ra from SPI and VDI, depth from Mold-Tech: spec. Feature sizes and all waves: guess.
  'polished-mould': { broad: lay(60, 0.005), pattern: 'none', fine: ra(0.00005, 0.03) },
  'stoned-mould': { broad: lay(60, 0.005), pattern: cut('lines', 0.06, 0.002), fine: ra(0.0003, 0.024, 0.15) },
  'bead-mould': { broad: lay(60, 0.005), pattern: cut('stipple', 0.12, 0.006), fine: ra(0.0012, 0.055) },
  // A game controller's shell. All guess, by eye from product photos.
  'moulded-stipple': { broad: lay(100, 0.01), pattern: cut('stipple', 0.2, 0.025), fine: ra(0.003, 0.21) },
  // Its grips: a lattice cut in the tool. All guess, pitch 0.7-1, dot about 0.5.
  'moulded-dots': { broad: lay(100, 0.01), pattern: cut('dots', 0.85, 0.12), fine: ra(0.003, 0.21) },
  // Ra spec, the rest guess.
  'sintered-powder': { broad: lay(50, 0.02), pattern: cut('stipple', 0.15, 0.05), fine: ra(0.012, 0.6) },
  'layer-printed': { broad: lay(5, 0.03), pattern: cut('ribs', 0.3, 0.05), fine: ra(0.008, 0.3, 0.4) },
  // Bead size spec, gloss spec, the rest guess.
  // A skim coat, trowelled flat and sanded. All guess: long shallow passes of the float, and a tooth you can feel.
  'trowelled-plaster': { broad: lay(140, 0.05), pattern: cut('stipple', 0.5, 0.012), fine: ra(0.004, 0.12) },
  'soft-touch-lacquer': { broad: lay(60, 0.005), pattern: cut('stipple', 0.05, 0.003), fine: ra(0.001, 0.02) },

  // Paint. Orange peel, 1µm over 3mm: spec. The rest guess.
  'matte-paint': { broad: lay(10, 0.005), pattern: cut('stipple', 0.12, 0.002), fine: ra(0.00075, 0.03) },
  'flowed-film': { broad: lay(3, 0.005), pattern: 'none', fine: ra(0.0001, 0.02) },
  'powder-coat': { broad: lay(6, 0.01), pattern: cut('stipple', 1, 0.05), fine: ra(0.001, 0.04) },
  // A soft-grained panel paint, sprayed thick and let run together, as on instrument panels. All guess, from a macro photo.
  'textured-paint': { broad: lay(20, 0.02), pattern: cut('pebble', 1.6, 0.04), fine: ra(0.0012, 0.05) },
  // A satin paint with aluminium flake laid in it, as on a phone of the late nineties: each flake tilts its own way and catches the light alone. Flake 0.02-0.1mm spec, their spacing and the rest guess.
  'metallic-paint': { broad: lay(10, 0.005), pattern: cut('stipple', 0.16, 0.006), fine: ra(0.0005, 0.03) },
  'clear-lacquer': { broad: lay(3, 0.001), pattern: 'none', fine: ra(0.00004, 0.02), coat: 1 },
  'brushed-enamel': { broad: lay(20, 0.005), pattern: cut('lines', 1.6, 0.006), fine: ra(0.00004, 0.02), coat: 1 },

  // Metal. Ra spec where the standards give one: blast, brushed, mirror, sand cast. The rest guess.
  'bead-blast': { broad: lay(50, 0.003), pattern: cut('stipple', 0.08, 0.004), fine: ra(0.0008, 0.05) },
  // A coarser bead, whose sparkle shows at arm's length, as on a music player's face. Guess, by eye from product photos.
  'bead-blast-coarse': { broad: lay(50, 0.003), pattern: cut('stipple', 0.22, 0.007), fine: ra(0.0008, 0.05) },
  // Brushing is named for its grit, so the scratch size belongs to the process and never to the object. Sheet is 150
  // grit, No. 4: grit and Ra spec, the rest guess. Coarse is 80 grit, fine is about 400 as on a watch case or a phone rail:
  // those scale from sheet by grit, all guess but the hairline Ra.
  'brushed-metal': { broad: lay(100, 0.005), pattern: cut('lines', 0.15, 0.004), fine: ra(0.0006, 0.04, 0.72) },
  'brushed-metal-coarse': { broad: lay(100, 0.005), pattern: cut('lines', 0.3, 0.008), fine: ra(0.0012, 0.06, 0.72) },
  'brushed-metal-fine': { broad: lay(100, 0.005), pattern: cut('lines', 0.04, 0.0011), fine: ra(0.0002, 0.02, 0.72) },
  'satin-metal': { broad: lay(100, 0.005), pattern: cut('stipple', 0.06, 0.002), fine: ra(0.0005, 0.03) },
  'buffed-metal': { broad: lay(10, 0.003), pattern: cut('stipple', 0.03, 0.0002), fine: ra(0.00015, 0.04) },
  'polished-metal': { broad: lay(10, 0.003), pattern: 'none', fine: 'none' },
  // Buffed bright, then a clear coat baked over it, as on brass instruments. The coat leaves the buffing's hairlines out of the highlight. All guess.
  'lacquered-metal': { broad: lay(20, 0.004), pattern: 'none', fine: ra(0.00006, 0.03), coat: 1 },
  'sand-cast': { broad: lay(50, 0.2), pattern: cut('stipple', 0.25, 0.07), fine: ra(0.011, 0.5) },
  'hot-foil': { broad: lay(30, 0.005), pattern: cut('stipple', 0.4, 0.006), fine: ra(0.0002, 0.03) },
  'embossed-foil': { broad: lay(30, 0.005), pattern: cut('foil', 2.25, 0.08), fine: ra(0.0002, 0.05) },
  'knurled': { broad: lay(100, 0.005), pattern: cut('knurl', 1, 0.18), fine: ra(0.0006, 0.04) },
  'roll-formed': { broad: lay(100, 0.05), pattern: cut('ribs', 1.75, 0.18), fine: ra(0.0006, 0.04) },
  'perforated': { broad: lay(100, 0.01), pattern: cut('hex', 1.5, 0.5), fine: ra(0.0006, 0.04) },

  // Rubber. Ra spec, the rest guess.
  'moulded-rubber': { broad: lay(50, 0.01), pattern: cut('stipple', 0.4, 0.01), fine: ra(0.004, 0.093) },

  // Ceramic and glass. Glaze and glass Ra spec, anti-glare spacing spec, the rest guess.
  'glazed': { broad: lay(15, 0.02), pattern: cut('pits', 9, 0.02), fine: ra(0.000016, 0.012), coat: 1 },
  'unglazed': { broad: lay(20, 0.05), pattern: cut('stipple', 0.5, 0.05), fine: ra(0.004, 0.08) },
  'float-glass': { broad: lay(60, 0.0003), pattern: 'none', fine: 'none' },
  // Pressed in the mould to throw daylight into a viewfinder. Pitch measured on a photo, depth guess.
  'reeded-glass': { broad: lay(60, 0.0003), pattern: cut('ribs', 1.7, 0.2), fine: ra(0.0002, 0.02) },
  'etched-glass': { broad: lay(60, 0.0003), pattern: cut('stipple', 0.02, 0.0005), fine: ra(0.0002, 0.02) },

  // Cloth, where tow size is spec and the rest guess. A height field gets the cells, sheen gets the fibre.
  'knitted-cloth': { broad: lay(30, 0.3), pattern: cut('knit', 0.7, 0.2), fine: ra(0.02, 0.25) },
  'woven-fibre': { broad: lay(20, 0.003), pattern: cut('twill', 2, 0.01), fine: ra(0.0001, 0.01), coat: 0.9 },
  'pressed-felt': { broad: lay(10, 0.2), pattern: cut('stipple', 0.05, 0.02), fine: ra(0.02, 0.25) },
  // Fibres shot end on into glue, so it lies as the part it lines does, with no waves of its own. Fibre length and spacing guess.
  'electrostatic-flock': { broad: lay(30, 0.002), pattern: cut('stipple', 0.05, 0.01), fine: ra(0.05, 0.05) },
  // Plastic-coated yarn woven in a basket for a speaker baffle. Pitch read off a straight-on photo, the rest guess.
  'basket-weave': { broad: lay(40, 0.08), pattern: cut('knit', 2.4, 0.22), fine: ra(0.01, 0.2) },
  'book-cloth': { broad: lay(40, 0.02), pattern: cut('twill', 0.45, 0.03), fine: ra(0.012, 0.2) },

  // Grown or quarried. Vessel width and polished Ra spec, the rest guess.
  'oiled-wood': { broad: lay(4, 0.02), pattern: cut('wood', 0.8, 0.035), fine: ra(0.005, 0.2, 0.3), coat: 0.2 },
  'lacquered-wood': { broad: lay(4, 0.01), pattern: cut('wood', 0.8, 0.012), fine: ra(0.0001, 0.011), coat: 0.6 },
  'tanned-leather': { broad: lay(30, 0.1), pattern: cut('pebble', 1.1, 0.12), fine: ra(0.006, 0.24) },
  // Pressed calf, as on the lid of a good camera: the same process, a far finer grain. All guess, from a macro photo.
  'smooth-calf': { broad: lay(30, 0.08), pattern: cut('pebble', 0.5, 0.05), fine: ra(0.004, 0.2) },
  // Hard cured rubber pressed against a goatskin die. Cells 1.2-1.8 measured on a straight-on photo, the rest guess.
  'pressed-vulcanite': { broad: lay(30, 0.04), pattern: cut('pebble', 1.25, 0.2), fine: ra(0.0016, 0.1) },
  // Vinyl cloth rolled against an engraved plate and glued round a cabinet, Levant grain as on an amp. Cells 3-5 read off a straight-on photo, the rest guess.
  'pressed-vinyl': { broad: lay(60, 0.12), pattern: cut('pebble', 3.6, 0.4), fine: ra(0.004, 0.2) },
  'sanded-cork': { broad: lay(20, 0.1), pattern: cut('pebble', 1.1, 0.07), fine: ra(0.02, 0.3) },
  'polished-stone': { broad: lay(50, 0.005), pattern: cut('stone', 30, 0.0005), fine: ra(0.00008, 0.04), coat: 0.9 },
  'honed-stone': { broad: lay(50, 0.01), pattern: cut('stipple', 3, 0.006), fine: ra(0.0006, 0.024) },
  'ground-terrazzo': { broad: lay(50, 0.005), pattern: cut('terrazzo', 1.5, 0.0005), fine: ra(0.0002, 0.03), coat: 0.5 },
  'cast-concrete': { broad: lay(150, 0.5), pattern: cut('pits', 12, 0.6), fine: ra(0.012, 0.16) },
  'cleft-stone': { broad: lay(30, 0.3), pattern: cut('lines', 1, 0.03), fine: ra(0.006, 0.16) },
  // Clay extruded and cut with wire, then fired, so the face keeps the drag of the wire and a wander you can see along a course. Mortar is sand held in lime, struck off with a trowel. All guess, from photos.
  'wire-cut-brick': { broad: lay(90, 0.6), pattern: cut('lines', 2.5, 0.35), fine: ra(0.02, 0.3) },
  'struck-mortar': { broad: lay(25, 0.3), pattern: cut('stipple', 1.2, 0.25), fine: ra(0.03, 0.4) },
  // Card rolled between engraved plates after printing, then given a thin varnish, so the weave runs through the print too. Pitch 0.4 read off a straight-on photo, the rest guess.
  'embossed-linen': { broad: lay(40, 0.03), pattern: cut('knit', 0.4, 0.002), fine: ra(0.0012, 0.05), coat: 0.35 },
  'uncoated-paper': { broad: lay(5, 0.02), pattern: cut('stipple', 0.06, 0.006), fine: ra(0.0045, 0.08, 0.1) },
  // Board with a clay coat rolled on and printed flat, as on a carton or a matchbook. All guess: smoother than uncoated by about four times, by photos, with the board's cockle still in it.
  'coated-board': { broad: lay(9, 0.03), pattern: cut('stipple', 0.05, 0.0015), fine: ra(0.0012, 0.06, 0.1) },
  // Cheap board, dyed and cut in strips, with its long fibres showing as streaks you can see from arm's length. All guess: a photo of a comb of matches read about 0.15 apart, and this is set wider and deeper than that so they show at the size it's looked at.
  'pressed-pulp': { broad: lay(6, 0.02), pattern: cut('lines', 0.25, 0.025), fine: ra(0.009, 0.1, 0.5) },
  // Dipped wet and dried crusty, as a match's head: pits about a third of a mm. All guess, from photos.
  'dipped-crust': { broad: lay(2, 0.04), pattern: cut('pebble', 0.32, 0.03), fine: ra(0.012, 0.12) },
  // Grit in a binder, spread on and dried, as a striker: clumps of it about 0.3 across. Guess, not read off a photo: 120 grit is about 0.12, which showed nothing at the size it's looked at.
  'grit-coat': { broad: lay(9, 0.03), pattern: cut('stipple', 0.3, 0.05), fine: ra(0.02, 0.12) },

  // A liquid lies still and has nothing at any size.
  'still': { broad: 'none', pattern: 'none', fine: 'none' },
} satisfies Record<string, Finish>;

export type FinishName = keyof typeof TABLE;

export const FINISHES: Record<FinishName, Finish> = TABLE;

/** Css px per mm, and the rest of the sums run in mm. */
const PX = 4;

interface Shape {
  /** How steep it is against depth/size. */
  slope?: number;
  /** Relief in mm when a material names the pattern itself. */
  depth?: number;
  /** How much of its slope lies across one direction. */
  across?: number;
  /** Size of what actually shows, against the spacing: the finest thing it repeats, which is what a pixel has to tell apart. */
  feature?: number;
  /** How much longer a feature is across than along, in the slope it draws. A shape that says nothing is round, and `finish-size.spec` holds it to that. */
  stretch?: number;
}

const SHAPES: Partial<Record<Pattern, Shape>> = {
  lines: { across: 1 },
  ribs: { across: 1, depth: 0.18 },
  dots: { slope: 0.8, depth: 0.12, feature: 0.87 },
  pits: { slope: 0.1, feature: 0.2, depth: 0.05 },
  pebble: { slope: 0.6, depth: 0.07 },
  leather: { slope: 0.6, depth: 0.07 },
  wood: { slope: 0.3, depth: 0.035, stretch: 6 },
  stone: { slope: 0, depth: 0.0005 },
  terrazzo: { slope: 0, depth: 0.0005 },
  twill: { depth: 0.012 },
  knit: { depth: 0.2, stretch: 1.7, feature: 0.67 },
  knurl: { depth: 0.18, feature: 0.71 },
  hex: { slope: 0, depth: 0.5, feature: 0.87 },
  foil: { slope: 0, depth: 0.08 },
  hazard: { slope: 0, depth: 0 },
};

/** How long a shape's features are across, against along. Lines have no length to measure. */
export const stretchOf = (shape: Pattern): number | null => {
  const s = SHAPES[shape];
  return s?.across ? null : s?.stretch ?? 1;
};

/** Noise runs through `grain`, which spends two noise calls on every shape it draws. */
const NOISE = new Set<Pattern>(['stipple', 'lines']);

/** GGX alpha from Ra over spacing: a sine has Rq 1.11 Ra and rms slope 2π Rq / L, and alpha is √2 of that. */
const ALPHA = Math.SQRT2 * 2 * Math.PI * 1.11;
/** Roughness of a surface with no fine structure of its own. */
const SMOOTH = 0.05;

/** The roughness a fine structure comes to. */
export const roughOf = (fine: Finish['fine']): number => (fine === 'none' ? SMOOTH : Math.sqrt(Math.min(ALPHA * fine.ra / fine.spacing, 1)));

/** How much of a wave comes through a clear coat. Levelling runs as h³/λ⁴ (Orchard), and a full coat closes at 1.5mm. */
export const levelled = (wavelength: number, coat: number): number =>
  coat > 0 ? Math.exp(-(((1.5 * coat ** 0.75) / wavelength) ** 4)) : 1;

/**
 * The only gain anywhere in the height sums. Real waves are slopes of a few thousandths, and the
 * room they reflect is blurred, so they vanish where a sharp reflection would show them. Broad
 * waves come up by this, but never past a slope that can already be seen. Patterns stay real.
 */
const GAIN = 4;
const SEEN_SLOPE = 0.01;

/** A wave's height as drawn. A wave of height h and length L slopes at π h / L. */
const raised = (wave: number, height: number): number =>
  Math.max(height, Math.min(height * GAIN, (SEEN_SLOPE * wave) / Math.PI));

/** Noise cells are half a wave. Below this many cells to a texel it holds and keeps only what a texel's average would. */
const CELLS_PER_TEXEL = 0.8;

/** The noise frequency for a wave of this many mm. Everything drawn from noise is sized here. */
const waves = (mm: number): number => 2 / (mm * PX);

interface Sizes {
  wave: number;
  peel: number;
  grain: [number, number, number];
  pattern: Pattern | null;
  relief: number;
  scale: number;
  feature: number;
  slope: number;
  across: number;
}

/** The numbers the shader takes for broad and pattern, in css px and mm of height. */
export function sizes(finish: Finish | undefined, m: { coat: number; pattern?: Pattern; size?: number; peel?: number; grain?: [number, number, number] }): Sizes {
  const s: Sizes = { wave: 0, peel: 0, grain: [0, 1, 1], pattern: null, relief: 0, scale: PX, feature: 0, slope: 0, across: 0 };
  const broad = m.peel !== undefined ? (m.peel > 0 ? lay(2.3, m.peel / 2) : 'none') : finish?.broad ?? 'none';
  if (broad !== 'none') {
    s.wave = waves(broad.wave);
    s.peel = raised(broad.wave, broad.height) * levelled(broad.wave, m.coat);
  }
  const named = m.pattern ?? (finish?.pattern === 'none' ? undefined : finish?.pattern.shape);
  const tier = finish && finish.pattern !== 'none' && finish.pattern.shape === named ? finish.pattern : undefined;
  if (named) {
    const shape = SHAPES[named] ?? {}, size = m.size ?? tier?.size ?? 1;
    // A finish's pattern set to another size is the same cut made larger or smaller, so it keeps its shape: as deep for its size, and as steep.
    const depth = (tier ? (tier.depth * size) / tier.size : shape.depth ?? 0.01) * levelled(size, m.coat);
    const steep = (shape.slope ?? 1.5) * depth / size;
    s.feature = size * PX * (shape.feature ?? 1);
    s.slope = steep;
    s.across = shape.across ?? 0;
    if (NOISE.has(named)) {
      const f = waves(size);
      s.grain = [depth * 1.4, named === 'lines' ? f * 0.04 : f, f];
    } else {
      s.pattern = named;
      s.relief = depth;
      s.scale = size * PX;
    }
  }
  // Set by hand, grain takes the place of the finish's texture, and at zero turns it off.
  if (m.grain) {
    s.grain = m.grain;
    s.relief = 0;
    s.across = 0;
    const [a, x, y] = m.grain, f = Math.max(x, y);
    s.slope = a > 0 ? 2.1 * a * f : 0;
    if (a > 0) s.feature = 2 / f;
  }
  return s;
}

/** Height kept, and roughness, at a texel of this many css px. The same sums the paint pass does. */
export function atTexel(m: { grain: [number, number, number]; pattern: Pattern | null; relief: number; feature: number; slope: number; rough: number }, texel: number): { height: number; rough: number } {
  let seen = 1, height = m.relief;
  if (m.grain[0] > 0) {
    seen = Math.min(CELLS_PER_TEXEL / (Math.max(m.grain[1], m.grain[2]) * texel), 1);
    height = m.grain[0] * seen;
  } else if (m.pattern) {
    const t = Math.min(Math.max((m.feature / texel - 1.6) / 1.4, 0), 1);
    seen = t * t * (3 - 2 * t);
    height = m.relief * seen;
  }
  const a = m.rough * m.rough;
  return { height, rough: Math.min(Math.sqrt(Math.sqrt(a * a + 2 * m.slope * m.slope * (1 - seen * seen))), 1) };
}
