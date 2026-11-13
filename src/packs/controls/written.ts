// What's been drawn on a canvas. Holding `live` says a screen may change at any moment, not that it did, and most of a screen's life
// is a picture standing still. So a screen's 2D context tells on itself, and a picture that came out the same as the last counts for nothing.
import { getEngine } from 'device-ui';

interface Mark {
  ctx: CanvasRenderingContext2D;
  drawn: boolean;
  print: number;
  /** How many reads in a row found a new picture, and how many changes are still to be taken at their word. */
  changing: number;
  trust: number;
}

const marks = new WeakMap<HTMLCanvasElement, Mark>();
const DRAWS = ['clearRect', 'drawImage', 'fill', 'fillRect', 'fillText', 'putImageData', 'reset', 'stroke', 'strokeRect', 'strokeText'] as const;
/** Over this many pixels, reading a picture back costs more than it saves, and a change is taken at its word. */
const READ_MOST = 2 ** 19;
/**
 * A screen whose picture was new the last this many times it was read is moving, and the next `TRUST` changes are taken at their word,
 * before it's read again: reading back and comparing what's always new was a fifth of the bridge's main thread.
 */
const MOVING = 4, TRUST = 30;

function watch(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const mark: Mark = { ctx, drawn: false, print: 0, changing: 0, trust: 0 };
  marks.set(canvas, mark);
  for (const name of DRAWS) {
    const draw = ctx[name] as ((...args: unknown[]) => unknown) | undefined;
    if (!draw) continue;
    (ctx[name] as unknown) = (...args: unknown[]) => {
      if (!mark.drawn) {
        mark.drawn = true;
        getEngine().schedule(canvas);
      }
      return draw.apply(ctx, args);
    };
  }
}

// A context can only be watched from the moment it's made, and nothing can ask a canvas whether it has one.
if (typeof HTMLCanvasElement !== 'undefined') {
  const made = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, options?: CanvasRenderingContext2DSettings) {
    if (kind !== '2d' || marks.has(this) || !this.closest('d-screen')) return made.call(this, kind, options);
    const ctx = made.call(this, kind, options) as CanvasRenderingContext2D | null;
    if (ctx) watch(this, ctx);
    return ctx;
  } as typeof made;
}

/** Whether a canvas holds a new picture since the last time of asking, or null for one nobody's watching. */
export function written(canvas: HTMLCanvasElement): boolean | null {
  const mark = marks.get(canvas);
  if (!mark) return null;
  if (!mark.drawn) return false;
  mark.drawn = false;
  const { width, height } = canvas;
  if (width * height > READ_MOST) return true;
  if (mark.trust > 0) {
    mark.trust--;
    return true;
  }
  const pixels = new Uint32Array(mark.ctx.getImageData(0, 0, width, height).data.buffer);
  let print = 0x811c9dc5;
  for (let i = 0; i < pixels.length; i++) print = Math.imul(print ^ pixels[i]!, 16777619);
  if (print === mark.print) {
    mark.changing = 0;
    return false;
  }
  mark.print = print;
  if (++mark.changing >= MOVING) mark.trust = TRUST;
  return true;
}
