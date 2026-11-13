import { shown, turnedTo, turnsOn, zoomOf } from './scale.js';

// A view onto a world, as a map has: how big it's shown and which part of it is in the window. It's a scale and a shift, never a zoom, so
// nothing in the world is laid out again as it moves, however far in or out it goes. What's drawn in it is drawn again at the size
// it's shown at once the camera stops, as a zoom would leave it, and only what's in the window.

/** How long a camera must be still before what it shows is put back on its own layer, so the browser draws its text sharp at the new size, ms. */
const STILL = 200;

export interface Camera {
  /** How big the world is shown, and where the window's corner is in shown px. */
  readonly scale: number;
  readonly x: number;
  readonly y: number;
  /** How far it's turned, in degrees, and about where in the world's css px. */
  readonly turned: { readonly deg: number; readonly x: number; readonly y: number };
  /** Shows the world at `scale`, with the window's corner at `x`, `y` in shown px. */
  set(scale: number, x: number, y: number): void;
  /** Turns the camera so what `turns` holds shows turned by `deg`, about `x`, `y` in the world's css px. Nothing lies anywhere new, so nothing is measured again. */
  turn(deg: number, x: number, y: number): void;
}

export interface CameraOptions {
  /**
   * Whether the engine shows the world on a stage: one canvas for everything in it, through a lens that meters its light. Yes by
   * default. No for a camera that's only a closer look at a page, which keeps each device on its own canvas and the page's own light.
   */
  stage?: boolean;
  /** What in the world goes round when the camera turns. Its own element, holding all there is to turn, as the stage's canvas has to stay square to the window. The camera writes its style. */
  turns?: HTMLElement;
}

/** The closest a hand takes a camera to anything, as a multiple of its real size: 1 css px to 0.0625 mm. Further in, what it shows is more
 * of the drawing than of the thing, and every step in is drawn sharper again. */
export const CLOSEST = 4;
/** As close as that with nothing else in the window, as one thing looked at alone is all there is to draw. The engine draws nothing
 * finer than this: a camera set closer shows the closest drawing bigger. */
export const CLOSEST_ALONE = 8;

/** The most `cam` may show its world at for `el` in it to be shown no closer than `CLOSEST` its real size, or `CLOSEST_ALONE` when it's
 * `alone` in the window. A page says what's being looked at, and whether it's alone, as only the page knows what its things are. */
export function closest(cam: Camera, el: HTMLElement, alone = false): number {
  return (cam.scale * (alone ? CLOSEST_ALONE : CLOSEST)) / zoomOf(el);
}

/** A camera on `world`, which should be the one thing in a window that clips it. */
export function camera(world: HTMLElement, o: CameraOptions = {}): Camera {
  world.style.transformOrigin = '0 0';
  const table = o.turns;
  // Turned from the start, even by nothing, so what's in it is drawn as what something turns.
  if (table) {
    turnsOn(table);
    Object.assign(table.style, { transformOrigin: '0 0', transform: 'rotate(0deg)' });
  }
  let still = 0, settled = 0;
  const c = {
    scale: 1,
    x: 0,
    y: 0,
    turned: { deg: 0, x: 0, y: 0 },
    set(scale: number, x: number, y: number) {
      if (scale === c.scale && x === c.x && y === c.y && world.style.scale) return;
      c.scale = scale;
      c.x = x;
      c.y = y;
      // While it moves, the browser only scales what it has; once it's still, its text and edges are drawn again at the size they're shown.
      world.style.willChange = 'translate, scale';
      clearTimeout(still);
      still = window.setTimeout(() => (world.style.willChange = ''), STILL);
      // Its own properties, not `transform`, so a page can still animate the world's transform, as one sliding it away does.
      world.style.translate = `${-x}px ${-y}px`;
      world.style.scale = String(scale);
      shown(world, scale, o.stage ?? true);
    },
    turn(deg: number, x: number, y: number) {
      if (!table) return;
      c.turned = { deg, x, y };
      const transform = deg ? `translate(${x}px, ${y}px) rotate(${deg}deg) translate(${-x}px, ${-y}px)` : 'rotate(0deg)';
      if (table.style.transform === transform) return;
      table.style.willChange = 'transform';
      clearTimeout(settled);
      settled = window.setTimeout(() => (table.style.willChange = ''), STILL);
      table.style.transform = transform;
      turnedTo(world);
    },
  };
  return c;
}

// The same camera on a whole page, from outside it: `<body camera="x y w h">` fills the window with that rect of the page, in css px
// as the window shows it with no camera, so anything there is drawn at the size it's now shown, as a close look at it would be. It's
// how a page is shot at any size: a still or a film of one part of it, as sharp as the window is big, and never a picture enlarged.
// The rect keeps its middle and grows to the window's shape. Taking the attribute off puts the page back.

let page: Camera | null = null, overflow = '';

function aim(): void {
  const body = document.body, value = body.getAttribute('camera')?.trim().split(/[\s,]+/).map(Number);
  const [x, y, w, h] = value ?? [];
  if (!value || value.length !== 4 || value.some(v => !Number.isFinite(v)) || !(w! > 0) || !(h! > 0)) {
    if (!page) return;
    page.set(1, 0, 0);
    Object.assign(body.style, { translate: '', scale: '', willChange: '', transformOrigin: '' });
    document.documentElement.style.overflow = overflow;
    page = null;
    return;
  }
  if (!page) {
    overflow = document.documentElement.style.overflow;
    // What it shows bigger stays inside the window, rather than making the page scroll further.
    document.documentElement.style.overflow = 'hidden';
    // A closer look at the page as it is, so with no stage, and no lens of its own to meter the light differently.
    page = camera(body, { stage: false });
  }
  // Where the body's corner is with no camera, from where it is shown now.
  const r = body.getBoundingClientRect(), bx = r.left + page.x, by = r.top + page.y;
  const s = Math.min(innerWidth / w!, innerHeight / h!);
  page.set(s, bx + (x! + w! / 2 - bx) * s - innerWidth / 2, by + (y! + h! / 2 - by) * s - innerHeight / 2);
}

function watch(): void {
  new MutationObserver(aim).observe(document.body, { attributes: true, attributeFilter: ['camera'] });
  addEventListener('resize', () => page && aim());
  aim();
}

if (typeof document !== 'undefined') {
  if (document.body) watch();
  else document.addEventListener('DOMContentLoaded', watch, { once: true });
}
