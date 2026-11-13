import type { ContactMotion } from './contact.js';
import type { FinishName } from './finishes.js';

export type Vec3 = [number, number, number];

/** A physical description of a surface. Colours are hex strings, or linear RGB. */
export type Pattern = 'twill' | 'knit' | 'wood' | 'stone' | 'terrazzo' | 'leather' | 'pebble' | 'stipple' | 'lines' | 'dots' | 'pits' | 'hex' | 'knurl' | 'hazard' | 'ribs' | 'foil';

/** One coat or substrate under a finish. */
export interface Layer {
  color: string | Vec3;
  rough?: number;
  metal?: number;
}

/** What a material is. It decides how light behaves in it and what can happen to it. */
/**
 * How a clear thing breaks under a blow. `glass` shatters from it in a web, finer the thinner it is. `crystal`, as sapphire, mostly
 * holds, and if it goes splits in a few straight cracks. `split`, as acrylic, cracks in a few long smooth curves. `craze`, as
 * polycarbonate, gives before it cracks: a patch of fine short crazes round the blow, and only a hard one cracks it through.
 */
export type Breaks = 'glass' | 'crystal' | 'split' | 'craze';

export type Substance = 'metal' | 'paint' | 'plastic' | 'rubber' | 'ceramic' | 'glass' | 'stone' | 'wood' | 'leather' | 'cloth' | 'paper' | 'liquid';

export interface MaterialDef {
  /** Sets `sheen`, `scatter`, `marks`, `wears` and `broad`, and any of them can still be set here. */
  substance?: Substance;
  /** How the surface was made, which sets its structure at three sizes and its roughness. Each substance has a default. */
  finish?: FinishName;
  /** How much light it holds at a glancing angle, 0 to 1, as rubber and cloth do. */
  sheen?: number;
  /** How far light travels inside it before coming back out, 0 to 1. */
  scatter?: number;
  /** How much fingerprints, hairlines and dust show on it, 0 to 1. */
  marks?: number;
  /** What rubbing does to it: `chip` goes down through its layers, `spall` too but in wide round flakes, as glass does, `polish` burnishes, `none` leaves it. */
  wears?: 'chip' | 'spall' | 'polish' | 'none';
  /** How unevenly it was made, 0 to 1: slow drift in thickness, finish and tone together. */
  broad?: number;
  color?: string | Vec3;
  /** Distance over which `emit` builds up from the edge of a surface, css px, for light from under something. */
  leak?: number;
  /** What shows through when the finish wears away. Shorthand for a single `under` layer. */
  sub?: string | Vec3;
  /** What lies under the finish, top first: a primer, then what the object is made of. Two at most. */
  under?: Layer[];
  rough?: number;
  metal?: number;
  /** Clear coat, 0 to 1. */
  coat?: number;
  /** Its refractive index, which sets how much a clear pane of it reflects at each face. Each clear substance has one. */
  ior?: number;
  /** How it breaks under a blow. Each clear substance has a way. */
  breaks?: Breaks;
  /** Roughness of the clear coat. Oil on wood is far duller than lacquer on a piano. */
  coatRough?: number;
  /** Colour the clear coat gives what is under it, as varnish does. Deepens with age. */
  coatTint?: string | Vec3;
  /** Brushing strength, 0 to 1, along `tangent`. */
  aniso?: number;
  tangent?: number;
  /** Relief as [amplitude mm, frequency x, frequency y], per css px. Takes the place of the finish's texture, and at zero turns it off. */
  grain?: [number, number, number];
  /** Orange peel amplitude, mm. Takes the place of the finish's waves. */
  peel?: number;
  mottle?: number;
  fleck?: number;
  wear?: number;
  /** Linear emissive light. */
  emit?: Vec3;
  /** What this turns into with age: rust, tarnish, verdigris, yellowing. */
  patina?: string | Vec3;
  /** Roughness of the patina. */
  patinaRough?: number;
  /** How old this surface is, 0 to 1. Takes the device's age unless overridden. */
  age?: number;
  /** How much fingers have worn the middle of this surface, 0 to 1. */
  touch?: number;
  /** Shallow knocks in the surface, 0 to 1. They show as bent reflections. */
  dents?: number;
  /** How far sunlight has bleached the colour, 0 to 1. */
  fade?: number;
  /** A pattern built into the surface: relief, colour and brushing together. */
  pattern?: Pattern;
  /** The pattern's second colour. */
  color2?: string | Vec3;
  /** Distance between the pattern's features, mm. */
  size?: number;
  /** Width of a year's growth in wood, mm. */
  rings?: number;
  /** How open wood's pores are, 0 to 1. High on oak, low on maple. */
  pores?: number;
  /** Thickness of a clear film on a metal, 0 to 1, as on heat-treated titanium. It sets the colour. */
  film?: number;
  /** How much that thickness drifts across the surface, 0 to 1. */
  filmVary?: number;
  /** How strongly a metal's ruled surface splits a lamp into its colours, 0 to 1, as on holographic foil. Unlike a film, it's the lamp that moves them. */
  grating?: number;
  /** Default colour for labels on this material. */
  legend?: string;
  [extra: string]: unknown;
}

export interface Material {
  coatRough: number;
  sheen: number;
  scatter: number;
  marks: number;
  polish: number;
  /** How big its chips are, against a coat of paint's. */
  chip: number;
  broad: number;
  /** Cycles of the broad wave per css px. Its height is `peel`. */
  wave: number;
  /** Height of the pattern, mm, after any coat. */
  relief: number;
  /** Size of what the pattern shows, css px. */
  feature: number;
  /** Slope of that relief, which becomes roughness as it falls below a texel. */
  slope: number;
  /** How much of that slope lies across the tangent, 0 to 1. */
  across: number;
  color: Vec3;
  sub: Vec3;
  subRough: number;
  subMetal: number;
  bare: Vec3;
  bareRough: number;
  bareMetal: number;
  coatTint: Vec3;
  dents: number;
  fade: number;
  rings: number;
  pores: number;
  filmVary: number;
  leak: number;
  rough: number;
  metal: number;
  coat: number;
  aniso: number;
  tangent: number;
  grain: [number, number, number];
  peel: number;
  mottle: number;
  fleck: number;
  wear: number;
  emit: Vec3;
  patina: Vec3 | null;
  patinaRough: number;
  age: number;
  touch: number;
  pattern: Pattern | null;
  color2: Vec3;
  scale: number;
  film: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a part's text was drawn, and how, so it can be redrawn as a shape. */
export interface Label extends Box {
  text: string;
  font: string;
  letterSpacing: string;
  wordSpacing: string;
  /** The same text as the browser wrapped it. */
  lines: (Box & { text: string })[];
}

export interface SpringDef {
  stiffness: number;
  damping: number;
  value?: number;
  /** Finishes a move away from its starting value before it can be sent back, so a quick tap still has its full travel. On by default for a spring called `press`. */
  through?: boolean;
  /** What reaching its travel counts as, for `onContact`. `press` is a press going out and a release coming back to its starting value, and is on by default for a spring called `press`. `toggle` is a throw, either way. */
  contact?: 'press' | 'toggle' | false;
  /** The mechanism it belongs to, reported with its contacts, because a part can have two. */
  motion?: ContactMotion;
}

/** A device, as parts see it. All lengths are css px in the device's canvas. */
export interface DeviceInfo {
  el: HTMLElement;
  x: number;
  y: number;
  w: number;
  h: number;
  material: string;
  wear: number;
  /** 0 is new, 1 is thirty years in a shed. */
  age: number;
  /** Same seed, same marks. */
  seed: number;
  radius: number;
}

export interface Part {
  el: HTMLElement;
  def: PartDef;
  x: number;
  y: number;
  w: number;
  h: number;
  /** True while this element, or something inside it, shows a keyboard focus ring. */
  focused: boolean;
  /** Where the element's text sits in the device mask, if the part asked for it. */
  label: Label | null;
  /** Where the part's own mask drawing sits, if it has one. */
  mask: Box | null;
  springs: Record<string, import('./springs.js').Spring>;
  /** Free space for the part's own state. */
  data: Record<string, unknown>;
  /** The area the part drew on last time, so a moving part can be repainted alone. */
  painted?: Box | null;
  /** Its drawn area has changed since the map of what a hand can reach was last made. */
  shifted?: boolean;
  /** The light it gave off last time, since a lamp changing is seen further away than a move. */
  glow?: number;
  /** What it drew last time, reused while something else on the device moves. */
  commands?: import('./sheet.js').Command[];
  /** A hand can reach it, as of the last time that was worked out. */
  hit?: boolean;
  /** Below the device's body, so its edge closes over this. */
  under?: boolean;
}

/** Moved this far, and turned this far round `pin`, in css px from the part's top left. */
export interface Carried {
  x: number;
  y: number;
  rotate: number;
  pin: [number, number];
}

export interface PartDef {
  /** Matched inside each device, and against the device itself. */
  selector: string;
  springs?: Record<string, SpringDef>;
  /** The words that can follow this form in its tag's value, as `left` in `d-key="side left"`. Any other warns. */
  options?: readonly string[];
  /** Paint the element's text into the device mask, and expose it as `part.label`. */
  label?: boolean;
  /** Read the DOM into spring targets. Runs on layout, attribute changes, input and change. */
  update?(part: Part): void;
  /** Parts paint in document order, then by layer, so a cover can sit above what it covers. Below 0 is under the device's own body, for what comes out from behind its edge. A `back` attribute says the same in mm behind the front face, so a part on a top or side of the object stands where it really is, and the furthest paints first. */
  layer?: number | ((part: Part) => number);
  /** Attributes that change often and never move anything, so they skip layout. */
  live?: string[];
  /** Runs every frame while it returns true, for things that keep moving on their own. Returning false, it waits to be told: by its springs,
   * its markup, or `getEngine().schedule()` called while it runs, as something on a clock does. */
  tick?(part: Part, dt: number): boolean;
  /** Set by a joint: a hand moves this part, so it takes the pointer. Anything else that does needs to be focusable, or to say so in css. */
  motion?: object;
  /** Set by a joint: where the bit of it in a hand has got to. */
  carried?(part: Part): Carried;
  /** Set by a joint: the spring values its stops hold it between, or null for none, as a ring that turns for ever. */
  ends?(part: Part): [number, number] | null;
  /** Attach listeners. May return a cleanup. */
  connect?(part: Part): void | (() => void);
  /** Draw into the device mask in white, then return the area used. */
  mask?(ctx: OffscreenCanvasRenderingContext2D, part: Part): Box | void;
  /** Draw from the part's own top left, not the device's. A number scales it too: `MM` draws in millimetres. */
  local?: true | number;
  /** The device's silhouette, in place of its `path`, so a drawing needs writing down only once. */
  outline?(part: Part): import('./shapes.js').Shape;
  /** Other parts read this one as they paint, so when it moves the whole device repaints. */
  spreads?: true;
  /** Declare this part's surfaces. */
  paint(sheet: import('./sheet.js').Sheet, part: Part, device: DeviceInfo): void;
}
