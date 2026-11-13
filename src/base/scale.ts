// How big a thing is shown, which is the one setting that says how it meets a narrow page. An object has one shape, so it shrinks whole, like a product photo:
// `scale="fit"`, or `scale="fit 2"` to show it twice its size where there's room. A thing you work in keeps its scale and rearranges, so the page gets a number:
// `scale="0.3"`. It's the same on a device and on a part with no device round it, and it's always `zoom`, so that layout and hit areas stay true.

/** A world a camera shows, the scale it's shown at, and whether the engine shows it on a stage. */
const cameras = new WeakMap<Element, { scale: number; stage: boolean; turns: number }>();
/** What a camera turns, whose style is the camera's own. */
const tables = new WeakSet<Element>();
/** Who hears that a camera moved, and which world it moved. */
const watchers = new Set<(world: HTMLElement) => void>();

/** How much bigger than its own css px an element is shown: the CSS zoom it sits in, times every camera it's in. */
export function zoomOf(el: HTMLElement, r?: DOMRect): number {
  const z = el.currentCSSZoom;
  // Without one to read, its rect has every scale in it already.
  if (z === undefined) return el.offsetWidth ? (r ?? el.getBoundingClientRect()).width / el.offsetWidth : 1;
  let k = z;
  for (let w = el.closest('[data-camera]'); w; w = w.parentElement?.closest('[data-camera]') ?? null) k *= cameras.get(w)?.scale ?? 1;
  return k;
}

/** What an animation can move a box by: its rect then has a scale in it that no zoom says. */
const MOVES = ['transform', 'scale', 'translate', 'rotate'];

/**
 * When whatever is moving `el` lands, or null if nothing is: an animation on anything holding it that turns, scales or shifts it.
 * Its rect is read through that, mid-way, so what's measured off it is only right once it's landed. Its own moves are the engine's
 * to take off as it measures.
 */
export function inFlight(el: Element): Promise<unknown> | null {
  const moving = document.getAnimations().filter(a => {
    const e = a.effect;
    return a.playState === 'running' && e instanceof KeyframeEffect && e.target !== el && !!e.target?.contains(el) && e.getKeyframes().some(k => MOVES.some(m => m in k));
  });
  return moving.length ? Promise.all(moving.map(a => a.finished.catch(() => {}))) : null;
}

let lastShown: HTMLElement | null = null;

/** Says a world was shown at `scale`, and tells whoever's drawing in it. */
export function shown(world: HTMLElement, scale: number, stage = true): void {
  const c = cameras.get(world);
  if (c) c.scale = scale;
  else {
    cameras.set(world, { scale, stage, turns: 0 });
    world.dataset.camera = '';
  }
  lastShown = world;
  for (const w of watchers) w(world);
}

/** Says what's turned when `world`'s camera turns. */
export function turnsOn(table: Element): void {
  tables.add(table);
}

/** Whether a camera writes this element's style, to turn it. */
export const isTable = (el: Element) => tables.has(el);

/** Says a world's camera turned, and tells whoever's drawing in it. */
export function turnedTo(world: HTMLElement): void {
  const c = cameras.get(world);
  if (c) c.turns++;
  for (const w of watchers) w(world);
}

/** How many times a world's camera has turned: what's drawn turned is out of date when this isn't what it was. */
export const turnsOf = (world: Element) => cameras.get(world)?.turns ?? 0;

/** What's far from the window in a camera's world, and so hidden: a camera decides what's seen there, not the keyboard or a scroll. */
export const HIDDEN_FAR = '[data-camera] [data-far]';

/** The scale a camera last showed its world at, or undefined for an element no camera shows. */
export const scaleOf = (world: Element) => cameras.get(world)?.scale;

/** Whether a world's camera has the engine show it on a stage. */
export const staging = (world: Element) => cameras.get(world)?.stage ?? false;

/** Hears every camera move. */
/** Tells `fn` of each world shown from now on, starting with the last one shown, as what draws may not start till long after a camera has. */
export const onShown = (fn: (world: HTMLElement) => void) => {
  watchers.add(fn);
  if (lastShown) fn(lastShown);
};

/** The most an element may be shown at, given its own size. */
type View = (w: number, h: number) => number;

interface Fit {
  el: HTMLElement;
  holder: HTMLElement;
  view: View;
  /** Whether a page asked for this with `frame`, rather than the markup. */
  framed: boolean;
  /** The holder's width, and the element's own size, when the zoom was last worked out. NaN until it first is. */
  across: number;
  w: number;
  h: number;
}

const fits = new Map<HTMLElement, Fit>();
const arriving = new Set<Fit>();

/** The room inside a holder. A rect, since a holder sized in CSS can be a fraction of a pixel, and a zoom worked out from a whole one is out by that much. */
function widthOf(holder: HTMLElement): number {
  const cs = getComputedStyle(holder), r = holder.getBoundingClientRect();
  return r.width / zoomOf(holder, r) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
}

/** The most it can be across: its holder's room, unless the holder scrolls sideways, which has no edge to fit to. What's in that is as wide as its view says, and pans. */
const most = (f: Fit, across: number) => {
  const x = getComputedStyle(f.holder).overflowX;
  return x === 'auto' || x === 'scroll' ? Infinity : across / f.w;
};

const said = (f: Fit) => f.el.dispatchEvent(new Event('fitted', { bubbles: true }));

/** Its size at no zoom, with the room it keeps round it, as a body does for its shelf. */
function sizeOf(el: HTMLElement, r: DOMRect, z: number): [number, number] {
  const cs = getComputedStyle(el);
  return [r.width / z + parseFloat(cs.marginLeft) + parseFloat(cs.marginRight), r.height / z + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom)];
}

/** Sets zooms from sizes measured at no zoom at all, which is what something that flows with its holder needs. All are read, then all set.
 * A zoom round the holder still scales the rect, so it comes off too, or a thing in a world shown at a tenth is framed ten times too big. */
function refit(list: Fit[]): void {
  // A holder is measured with the rest, not as its element arrives: a page mounting hundreds would lay out once for each.
  for (const f of list) if (Number.isNaN(f.across)) f.across = widthOf(f.holder);
  // One just arrived has no zoom yet, so it's read in the same layout as its holder: a page mounting hundreds lays out once a batch and not twice.
  for (const f of list) if (f.el.style.zoom && f.el.style.zoom !== '1') f.el.style.zoom = '1';
  for (const f of list) {
    const r = f.el.getBoundingClientRect();
    [f.w, f.h] = sizeOf(f.el, r, zoomOf(f.el, r));
  }
  for (const f of list) f.el.style.zoom = String(Math.min(f.view(f.w, f.h), most(f, f.across)));
}

// Every holder is read, then every zoom set, so a page of them costs one layout, not one each. The observer says which holders
// moved, and only what they hold is read: a page of hundreds, arriving one at a time, would otherwise read all of them for each.
function refits(moved?: ResizeObserverEntry[] | Event): void {
  const only = Array.isArray(moved) ? new Set(moved.map(e => e.target)) : null;
  const changed = [...fits.values()].filter(f => !only || only.has(f.holder)).flatMap(f => {
    const r = f.el.getBoundingClientRect(), across = widthOf(f.holder), [w, h] = sizeOf(f.el, r, zoomOf(f.el, r));
    // Rects snap to a fraction of a pixel, which a zoom magnifies.
    const flows = Math.abs(w - f.w) > 0.5 || Math.abs(h - f.h) > 0.5;
    return across === f.across && !flows ? [] : [{ f, across, flows }];
  });
  for (const { f, across, flows } of changed) {
    f.across = across;
    if (!flows) f.el.style.zoom = String(Math.min(f.view(f.w, f.h), most(f, across)));
  }
  refit(changed.filter(c => c.flows).map(c => c.f));
  for (const { f } of changed) said(f);
}

// A window's resize comes before layout in the same frame, so the zoom is set before anything is measured, and a holder that takes
// its height from what's in it has nothing left to report. Anything else that moves a holder comes through the observer.
let holders: ResizeObserver | null = null;

function hold(el: HTMLElement, view: View, framed: boolean): Fit | null {
  const holder = el.parentElement;
  if (!holder) return null;
  if (!holders) {
    holders = new ResizeObserver(refits);
    addEventListener('resize', refits);
  }
  const f: Fit = { el, holder, view, framed, across: NaN, w: 0, h: 0 };
  fits.set(el, f);
  holders.observe(holder);
  return f;
}

function letGo(el: HTMLElement): void {
  const f = fits.get(el);
  if (!f) return;
  fits.delete(el);
  arriving.delete(f);
  if (![...fits.values()].some(o => o.holder === f.holder)) holders!.unobserve(f.holder);
}

/** Shows an element at what `view` gives for its size, and shrinks it to fit what holds it. `scale="fit"` is this with a number. It's for a page that frames what it shows, as a sheet of objects does, and it wins over the element's own `scale`. */
export function frame(el: HTMLElement, view: View = () => 1): () => void {
  letGo(el);
  const f = hold(el, view, true);
  if (!f) return () => {};
  arrive(f);
  return () => letGo(el);
}

/** Works out an element's zoom again, after it changed the room it keeps round it. */
export function rescale(el: HTMLElement): void {
  const f = fits.get(el);
  if (!f) return;
  refit([f]);
  said(f);
}

/** Reads `scale` off an element, when it arrives and when it `changed`. A zoom that was there first and never said `scale` isn't ours to touch. */
export function scaled(el: HTMLElement, changed = false): void {
  if (fits.get(el)?.framed) return;
  letGo(el);
  const value = el.getAttribute('scale')?.trim();
  if (!value) {
    if (changed) el.style.zoom = '';
    return;
  }
  const [word, most] = value.split(/\s+/);
  if (word !== 'fit') {
    el.style.zoom = String(+word! || 1);
    return;
  }
  const n = +(most ?? 1) || 1, f = hold(el, () => n, false);
  if (f) arrive(f);
}

/** What's arriving is fitted in a batch before the page is next drawn, so a page of them costs one layout and not one each. */
function arrive(f: Fit): void {
  if (!arriving.size) queueMicrotask(() => {
    const list = [...arriving];
    arriving.clear();
    refit(list);
    list.forEach(said);
  });
  arriving.add(f);
}

/** Lets go of an element that's left the page. */
export function unscaled(el: HTMLElement): void {
  if (!fits.get(el)?.framed) letGo(el);
}
