/** One soft light in the room, as seen from the object: where it is and how big, across a plane one object-height up. */
export interface Panel {
  at: [number, number];
  size: [number, number];
  /** How far its edge blurs. */
  soft: number;
  power: number;
}

/** A lighting setup. Metal shows the room, and everything takes its shadow from the lamp. */
export interface Lighting {
  /** What shiny things reflect, at most six. */
  panels: Panel[];
  /** How bright the room is where there is no panel. */
  dark: number;
  /** A glow straight overhead. */
  glow: number;
  /** How pale the room is round the sides, as in a tent, which is what a rolled edge sees. */
  tent: number;
  /** Where the lamp hangs, in lengths of the object from its centre. */
  lamp: [number, number];
  /** How strong the lamp is, 1 by default. */
  power: number;
  /** How wide its highlight is. 0 is a bare bulb, .14 a softbox. */
  soft: number;
  /** How far it follows a pointer over the object, in lengths of the object. */
  sway: number;
  /** How much the room lights what the lamp doesn't. */
  fill: number;
  /** How dark a shadow on the page is, 1 by default. */
  shadow: number;
  /** The colour of the room's light and its lamp, linear: white by default. What glows by itself, a screen or a lamp, keeps its own. */
  color: [number, number, number];
}

const lightings = new Map<string, Lighting>();

export const STUDIO: Lighting = {
  panels: [
    { at: [-0.55, -0.35], size: [0.42, 0.8], soft: 0.16, power: 1.25 },
    { at: [0.75, 0.3], size: [0.16, 0.9], soft: 0.12, power: 1 },
    { at: [0.05, -1.5], size: [1.3, 0.25], soft: 0.2, power: 1.2 },
  ],
  dark: 0.1, glow: 0.3, tent: 0.35, lamp: [-0.96, -3.15], power: 1.15, soft: 0.05, sway: 3.2, fill: 0.6, shadow: 1.5, color: [1, 1, 1],
};

/** Adds a setup, starting from the studio, so a new one says only what differs. */
export function defineLighting(name: string, l: Partial<Lighting>): void {
  lightings.set(name, { ...STUDIO, ...l });
}

/** A setup by name. An unknown name gets the studio. */
export function getLighting(name: string): Lighting {
  return lightings.get(name) ?? STUDIO;
}

// Softboxes round a dark room for metal to show, and a small lamp that swings hard shadows across with the pointer.
/** A light held in the hand. */
export interface Torch {
  /** Half the angle of its beam, radians. */
  cone: number;
  /** How bright its centre is, how bright the flood around it is, and how much spills past the edge. */
  core: number;
  flood: number;
  spill: number;
  /** Where the edge of the beam starts, as a share of the way out. Near 1 is a hard edge, 0 no edge at all. */
  edge: number;
  /** The rings a reflector leaves in a beam, as a share of it. */
  rings: number;
  /** Linear colour. */
  color: [number, number, number];
  power: number;
  /** How far off it's held, as a share of a flashlight. */
  hold: number;
  /** How much of its aim comes from carrying it there, rather than turning a wrist. */
  arm: number;
  /** How much it wavers, as a share of its power. */
  flicker: number;
  /** How strongly it makes pale things glow. */
  fluoresce: number;
}

/** What a hand can hold. A candle is carried close and low, so its light dies away fast and its shadows are long, and a blacklight shows almost nothing but what it wakes up. */
export const TORCHES = {
  flashlight: { cone: 0.2, core: 1.1, flood: 0.4, spill: 0.07, edge: 0.3, rings: 0.03, color: [1, 0.97, 0.9], power: 1, hold: 1, arm: 0.4, flicker: 0, fluoresce: 0 },
  candle: { cone: 1.15, core: 0, flood: 1, spill: 0, edge: 0, rings: 0, color: [1, 0.55, 0.2], power: 0.55, hold: 0.3, arm: 0.85, flicker: 0.2, fluoresce: 0 },
  blacklight: { cone: 0.3, core: 0.3, flood: 0.5, spill: 0.03, edge: 0.35, rings: 0, color: [0.3, 0.1, 1], power: 0.5, hold: 0.8, arm: 0.4, flicker: 0, fluoresce: 7 },
} satisfies Record<string, Torch>;
export type TorchName = keyof typeof TORCHES;

defineLighting('studio', {});
// One small lamp close by, low and to the side. Hard shadows that swing as it moves, and a lot of dark in the metal.
defineLighting('desk', {
  panels: [{ at: [-0.8, -0.9], size: [0.22, 0.22], soft: 0.14, power: 2.6 }],
  dark: 0.02, glow: 0.04, tent: 0.22, lamp: [-1.5, -1.9], power: 1.35, soft: 0.04, sway: 1.8, fill: 0.5, shadow: 1.5,
});
// A big window to one side of a pale room. Little contrast, for reading what things are.
defineLighting('window', {
  panels: [{ at: [-1, -0.2], size: [0.55, 1.2], soft: 0.3, power: 1.5 }],
  dark: 0.14, glow: 0.5, tent: 0.85, lamp: [-1.6, -0.9], power: 0.7, soft: 0.28, sway: 0.5, fill: 1.25, shadow: 0.65,
});
// A control room with its lights down: dim strips far overhead and nothing close by, so glass shows what's behind it,
// not the room, and what's seen by is the consoles' own screens and lamps.
defineLighting('control', {
  panels: [
    { at: [0, -2.4], size: [1.6, 0.06], soft: 0.3, power: 0.35 },
    { at: [0, -3.4], size: [1.6, 0.06], soft: 0.3, power: 0.25 },
  ],
  dark: 0.005, glow: 0.01, tent: 0.06, lamp: [0.2, -3.6], power: 0.75, soft: 0.22, sway: 0.4, fill: 0.35, shadow: 1.2,
});
// The same room with one low lamp over its desk: enough to read the hardware by and pick out a black knob, and no more,
// so the desk stays as dark as the consoles round it.
defineLighting('console', { ...getLighting('control'), lamp: [-1.3, -1.7], power: 0.95, soft: 0.06, fill: 0.3, shadow: 1.4, glow: 0.015 });
// The same room on alert: its lights down to the red that keeps eyes used to the dark, as on a ship's bridge.
defineLighting('alert', { ...getLighting('control'), color: [1.6, 0.05, 0.02], power: 0.9 });
// The same room with its lights off: nothing overhead and almost nothing to fill, so all that shows is what glows by itself,
// and the faint shapes of what's next to it.
defineLighting('blackout', {
  ...getLighting('control'),
  panels: [{ at: [0, -2.4], size: [1.6, 0.06], soft: 0.3, power: 0.03 }],
  power: 0.06, fill: 0.08, dark: 0.002, glow: 0, shadow: 0.4,
});
// A white tent, as a product is shot in: pale all round with darker strips to give chrome something to draw, and nothing dark where a flat face looks back. It's what polished metal needs to read as bright.
defineLighting('tent', {
  panels: [
    { at: [-0.6, -0.5], size: [0.7, 0.9], soft: 0.3, power: 1.5 },
    { at: [0.9, 0.5], size: [0.4, 0.8], soft: 0.25, power: 1.1 },
    { at: [0, -1.5], size: [1.6, 0.4], soft: 0.3, power: 1.4 },
  ],
  dark: 0.16, glow: 0.55, tent: 0.85, lamp: [-1.2, -2.6], power: 0.8, soft: 0.2, sway: 0.8, fill: 1.1, shadow: 0.8,
});
// No room at all, for what stands outdoors: a high sun off to one side, and the sky over everything, which is all that glass has to show. Nobody stands where a camera would.
defineLighting('outdoors', {
  panels: [{ at: [0, -1.1], size: [2.4, 1.3], soft: 0.5, power: 1.5 }],
  dark: 0.4, glow: 0.7, tent: 0.75, lamp: [-1.25, -2.4], power: 1, soft: 0.1, sway: 0.5, fill: 1.1, shadow: 1,
});
