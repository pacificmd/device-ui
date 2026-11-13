// All that crosses between the page side (engine.ts) and the renderer (renderer.ts): one plate per device,
// a live view of its sizes and condition, and for each frame a list of commands and a scene to light them in.
import type { FieldShape } from './shapes.js';
import { MAX_HEIGHT } from './shaders/light.js';
import type { TorchName } from './lighting.js';
import type { Command, ScreenCommand } from './sheet.js';
import type { Box } from './types.js';

export interface EngineStats {
  paints: number;
  /** Paints that touched only the parts that moved. */
  partial: number;
  lights: number;
  frames: number;
  layouts: number;
  /** Layouts that read the parts off the page. The rest only placed a canvas again for a new view of it. */
  measures: number;
  paintMs: number;
  lightMs: number;
  copyMs: number;
  /** Pictures copied out to a device's own canvas, and frames of the stage drawn. */
  copies: number;
  stages: number;
  layoutMs: number;
  /** Frames given up because the GPU hadn't finished the last one. */
  held: number;
}

/** What the page says about a device, kept up to date by the page. Everything else about it is the page's. */
export interface PlateSpec {
  pw: number;
  ph: number;
  cw: number;
  ch: number;
  dpr: number;
  /** How many of the sheet's pixels go to one on the display, since a sheet is drawn fine and a zoomed-out device finer still. */
  fine: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The most margin round the device that the window can ever show, across and down, css px: past it a shadow is never seen, at any
   * scroll. A device as tall as the window shows none above or below it, however wide the window is. */
  room: [number, number];
  seed: number;
  prints: number;
  dust: number;
  scuff: number;
  haze: number;
  grime: number;
  /** How badly its glass is broken, 0 to 1: see broken.ts. */
  cracks: number;
  debug: number;
  /** Drawn on a stage, for its camera, where there is one. */
  staged?: boolean;
  /** How far across the debug channel starts, 0 to 1, or below 0 for no split. */
  split: number;
  /** Height of the face, mm, which stays where the page put it as the view leans. */
  face: number;
  /** How much of the lamp it's following, 0 to 1. At 0 it sits in its own light and a moving pointer costs it nothing. */
  hand: number;
  /** How tall a shadow the body throws on the page, mm. */
  cast: number;
  /** Most degrees it turns under a hand that drags it. 0 stays straight-on. */
  lean: number;
  /** Which way it's turned, as a share of `lean` across and down, inside a circle of 1. */
  turn: [number, number];
  /** How it's set in the room, degrees about its upright and then across it, as `rotateY` and `rotateX` turn it. */
  angle: [number, number];
  /** Which way the eye is from it, in the room, a unit vector: straight out of the page unless it's set in a `perspective`. */
  eye: [number, number, number];
  /** Whether it's one face of a body that turns over. */
  turns: boolean;
  /** How far this face has turned from straight on about the upright through the body, radians. Past PI/2 either way it's the face turned away. */
  spin: number;
  /** How far below the face the upright it turns about is, mm. */
  axis: number;
  /** How far either way from its middle the body is this face's, mm, and whether another face meets it at its left and right ends.
   * Where one does, what's nearer that one is that one's to draw. */
  owns: [number, number, number];
  /** Which way this face looks out of the body, radians round the upright from the front's. */
  round: number;
  /** Every face of the body this is one of, front first, when it has more than one. Each sees the others edge-on. */
  body: Plate[] | null;
  lightDirty: boolean;
  /** Where light has to be worked out again, if not everywhere. */
  lightBox: Box | null;
}

export interface Textures {
  A: WebGLTexture;
  /**
   * Heights, finish (`S`), sheen and marks (`M`), condition (`C`) and what each point sees of the room (`O`) are what a paint works in,
   * with relief (`D`) where it's kept apart. A renderer that only makes maps gives them back once its player has packed them and the device
   * is still, and they're null until a paint makes them again and paints all of it: see `Renderer.spare`. `S` says whether they're there.
   * Heights stay where grain is kept in them (no `N`), as the player reads that where it is.
   */
  H: WebGLTexture | null;
  S: WebGLTexture | null;
  /** What glows, made when something first does: most things don't, and it costs a target and a chain of mips. */
  E: WebGLTexture | null;
  /** What a paint draws into. */
  targets: number[];
  /** Sheen, scatter and marks, which the light pass reads. A blank pixel where a GPU has no fifth target. */
  M: WebGLTexture | null;
  /** Relief, when height is in half floats. */
  D: WebGLTexture | null;
  /** Grain's direction and coverage, when height has full floats to itself. See `MATERIAL_FS`. */
  N: WebGLTexture | null;
  /** Undersides, made when something first stands clear of the ground: most things don't. */
  U: WebGLTexture | null;
  /** Prints, dust, hairlines and haze. See `CONDITION_FS`. Made when first drawn, after the paint. */
  C: WebGLTexture | null;
  /** What each point can see of the room. See `OCCLUSION_FS`. Made when first drawn, after the paint. */
  O: WebGLTexture | null;
  mask: WebGLTexture;
  fbo: WebGLFramebuffer;
  /** Albedo and surface only, so weathering can read height while it draws. */
  weather: WebGLFramebuffer;
  condition: WebGLFramebuffer;
  occlusion: WebGLFramebuffer;
  /** The tallest thing a view ray (r) or shadow ray (g) from each cell could meet, in `T`. */
  tops: Uint8Array;
  /** What all of it came to, bytes, when it last held what a paint works in: see `Renderer.spare`. */
  most: number;
  /** Its labels were given back, and are a texel of nothing till a layout draws them again: see `Renderer.spare`. */
  blank: boolean;
  tw: number;
  th: number;
  T: WebGLTexture;
  /** What has been drawn so far, kept for frosted glass to read, over `box` of the maps (map px): only what the frost can see. Made when first needed. */
  back: { A: WebGLTexture; E: WebGLTexture; S: WebGLTexture; fbo: WebGLFramebuffer; box: { x: number; y: number; w: number; h: number } } | null;
  /** The heights so far, kept for a sheet that bridges them to read, over `box` of the maps (map px): only what the sheets can reach. Made when first needed. */
  under: { H: WebGLTexture; N: WebGLTexture | null; fbo: WebGLFramebuffer; nfbo: WebGLFramebuffer | null; box: { x: number; y: number; w: number; h: number } } | null;
  /** The heights a face of a body drew itself, before what it sees of the others went in. They're what the others see of it. */
  own: { H: WebGLTexture; fbo: WebGLFramebuffer } | null;
  /** How near each of the others' solids it drew stands, so the nearest wins. Made with `own`. */
  deep: WebGLRenderbuffer | null;
}

/** A torch over a device, in its own mm: where it stands, which way it points, how far that is and where it lands. */
export interface Beam {
  sx: number;
  sy: number;
  sz: number;
  ax: number;
  ay: number;
  az: number;
  far: number;
  /** Where a flame has wavered to, -1 to 1. */
  shake: number;
  tx: number;
  ty: number;
  pool: Box;
}

/** Where a device sits on the shared canvas while it's lit, and what to take back off it. */
export interface Seat {
  x: number;
  y: number;
  pw: number;
  ph: number;
  scale: number;
  box: Box | null;
}

/** What's the same for everything lit in a frame. */
export interface Scene {
  /** The lamp is carried by something other than the pointer, such as a phone being tilted, and what can lean goes with it. */
  carried: boolean;
  /** Everything needs light. */
  all: boolean;
  /** Something other than the torch changed, so all of a device needs light. */
  full: boolean;
  /** The light is moving. */
  sweeping: boolean;
  /** Something on the page is changing size. */
  sizing: boolean;
  tilt: number;
  look: number;
  lights: number;
  ambient: number;
  torch: number;
  handheld: TorchName;
  lighting: string;
  /** Where the lamp has got to, in window pixels, and how far it's come out, 0 to 1. */
  pointer: { x: number; y: number; i: number };
  /** Where the lamp hangs for a device at this rect, if not over the pointer: see the engine's `lampFor`. */
  lampFor?: ((rect: { left: number; top: number; width: number; height: number }, x: number, y: number) => [number, number] | null) | null;
  /** The window, and its pixels to the css px. */
  width: number;
  height: number;
  ratio: number;
}

/** One device's go at the light. */
export interface Turn {
  plate: Plate;
  /** Where the finished picture goes, or nowhere but the GPU, for the stage to show. */
  ctx: CanvasRenderingContext2D | null;
  /** Where its canvas is on the page. */
  rect: DOMRect;
  lighting: string;
}

/** A device's last picture, kept on the GPU for the stage to show, and the canvas box it was made for: margins, size and the device's own width, css px. */
export interface Picture {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  pw: number;
  ph: number;
  box: [x: number, y: number, cw: number, ch: number, w: number];
}

/** One paint of a device: all it drew, and if only part of that changed, what did. */
export interface PaintJob {
  commands: Command[];
  /** When the paint began, for the time it's counted against. */
  began: number;
  /** How far the body stands, mm. */
  stands: number;
  /** Its canvas is the size it's given, and takes no margin for shadows. */
  fixed: boolean;
  /** Only what moved was drawn again, so it's a repaint over what's there. */
  partial: boolean;
  /** What a repaint has to draw again: moved, recoloured, and pictures on screens. */
  moved: Box[];
  coloured: Box[];
  pictures: ScreenCommand[];
  /** The light it gives off changed. */
  hot: boolean;
  /** How high what moved stands, mm. */
  stood: number;
  /** All the commands of the parts that moved, when any did. */
  redrawn: Command[] | null;
  /** All of it is drawn again as it was, for what a paint works in, which was given back: no news to the faces that see it edge-on. */
  remade?: boolean;
}

/** What came of a paint: nothing yet, a canvas that has to grow first, or where it needs light. */
export type Painted = null | { margin: [number, number] } | { all: boolean; box: Box | null };

export class Plate {
  tex: Textures | null = null;
  /** Where its maps lie on its canvas, in pixels: what's drawn, and as far round it as anything reads. A shadow falls further, onto the canvas's margin, but reads nothing there. */
  map: Box = { x: 0, y: 0, w: 0, h: 0 };
  /** The fields it's making before it can show. */
  wanted: FieldShape[] | null = null;
  /** Drawn with fields of another sharpness standing in, and owed a picture with its own once they're made. */
  stood = false;
  /** Where a torch lit it last. */
  pool: Box | null = null;
  /** What a layout printed on it before it had maps, which they take as their mask. See `Renderer.ink`. */
  ink: WebGLTexture | null = null;
  /** Last lit softer than it's shown, at the screen's own size while the camera moved, and owed a sharp picture. */
  rough = false;
  /** Where it's being lit on the shared canvas this frame. */
  seat: Seat | null = null;
  /** A lamp moving on it is relit less often than every frame, and the next is still to come: it hasn't stopped, so nothing settles yet. */
  lampOwed = false;
  /** Where it was left rough, when that's less than all of it. */
  roughBox: Box | null = null;
  /** What the condition texture was last drawn with. */
  drawn = '';
  /** Height of the tallest thing painted, in mm, where view rays start. */
  peak = MAX_HEIGHT;
  /** How much height the map of what stands nearby covers, mm. */
  tall = MAX_HEIGHT;
  /** Glass with a surface of its own, which the light pass works out from these numbers. */
  panes: number[] = [];
  /** Which glass that is. The rest has to be raised in the height. */
  paned = new Set<Command>();
  /** Counts every paint, whole or part: what's kept of its maps elsewhere is out of date when this has moved on. */
  painted = 0;
  /** Something is about to read off it by painting parts of it, springs or a readback: what a paint works in stays. See `Renderer.hold`. */
  keep = false;
  /** Waiting to give back what a paint works in, once nothing has painted for a moment. */
  spare: ReturnType<typeof setTimeout> | undefined = undefined;
  /** Counts each paint of the whole of a face of a body, and what it was for each of the others when it last drew them edge-on. */
  shaped = 0;
  edged: number[] = [];
  /** This paint is only for what it sees of the others, so it's no news to them. */
  reedge = false;
  /** All a face of a body drew last, which the others draw again as they see it edge-on. */
  made: Command[] | null = null;
  /** `made` is what it said it would draw, and it hasn't drawn since: see `Renderer.known`. */
  known = false;
  /** Its broken glass, as the light and its screens read it, and what it was worked out from: see broken.ts. */
  broken: { key: string; cracks: WebGLTexture; faces: WebGLTexture; panels: Map<string, WebGLTexture> } | null = null;
  /** Its last picture, when the stage shows it rather than a canvas of its own. */
  picture: Picture | null = null;

  constructor(readonly spec: PlateSpec) {}

  /** Whether it has anything on the GPU yet. */
  get ready(): boolean {
    return !!this.tex;
  }
}
