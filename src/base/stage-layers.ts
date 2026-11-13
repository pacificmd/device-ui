// What the stage draws besides the pictures: a layer of its own, on the stage's own GL context, as the air in front of the
// devices is. A layer sees each picture's heights as it's drawn, so what it draws can stand in front of one thing and behind
// another, and it can bend the pictures by a field of offsets in mm, so a bend is as far on the thing whatever the zoom. Only
// where there's a stage: a page without one draws its layers some other way, or not at all.

/** One picture on the stage, as a layer sees it. */
export interface StageShot {
  /** Its heights, mm in `r`, or null while the device's maps are freed and its picture is kept: take it as flat at `face`. */
  height: WebGLTexture | null;
  /** From a place on the stage, css px from its corner, to the same place on `height`: uv = px · xy + zw. */
  toMap: [sx: number, sy: number, ox: number, oy: number];
  /** How many mm a css px of the stage is, on this device as it's shown. */
  mmPerPx: number;
  /** How high its face is, mm. */
  face: number;
  /** Where the picture is on the stage, css px: left, top, width and height. */
  box: [x: number, y: number, w: number, h: number];
}

/** A frame of the stage: its context, how big it is and where in the window, and how many device px a css px is. */
export interface StageFrame {
  gl: WebGL2RenderingContext;
  /** Its size, css px, and its corner in the window. */
  w: number;
  h: number;
  left: number;
  top: number;
  ratio: number;
  /** Where the stage is drawn: light, linear and premultiplied, as bright as it really is, where 1 is the white the light pass
   * shows a flat white under the lamp as. The stage's camera exposes and tone maps it after the last layer. */
  target: WebGLFramebuffer;
}

/**
 * Something drawn on the stage with the devices, on the context they share. The renderer leaves its state as its last pass had
 * it, a scissor among it, so a layer sets what it needs before it draws: scissor, depth, culling, blending and colour mask, as
 * the air does. It draws onto `target`, not the canvas. The framebuffer and viewport it may change: the stage's are set again
 * after each call.
 */
export interface StageLayer {
  /**
   * Before any picture is drawn: it may work on its own targets, and hands back offsets, mm across and down the page in `rg`,
   * over the whole stage with rows counting up as the stage's do, which every picture is then read through. Or null to bend nothing.
   */
  before(f: StageFrame): WebGLTexture | null;
  /** After each picture is drawn. */
  shot(s: StageShot, f: StageFrame): void;
  /** After every picture, drawing over them onto the stage, premultiplied. */
  after(f: StageFrame): void;
  /** The stage is gone, or its context: drop everything made on `gl`. */
  leave(gl: WebGL2RenderingContext | null): void;
}

const layers = new Set<StageLayer>();
const heard = new Set<() => void>();
let up: WebGL2RenderingContext | null = null;

/** Draws a layer on the stage from the next frame, until the returned function is called. */
export function stageLayer(l: StageLayer): () => void {
  layers.add(l);
  wakeStage();
  return () => {
    if (layers.delete(l)) l.leave(up);
  };
}

/** For a layer that changes on its own: the stage draws again next frame. */
export const wakeStage = () => heard.forEach(f => f());

/** Whether there's a stage for a layer to be drawn on now. */
export const staged = () => !!up;

/** For the renderer and engine. */
export const stageLayers = (): ReadonlySet<StageLayer> => layers;
export const onStageWake = (f: () => void) => heard.add(f);
/** The stage is up on `gl`, or gone. */
export function setStage(gl: WebGL2RenderingContext | null): void {
  if (gl === up) return;
  const was = up;
  up = gl;
  if (!gl) for (const l of layers) l.leave(was);
}
