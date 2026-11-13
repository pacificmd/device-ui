import { getEngine } from './engine.js';
import { HIDDEN_FAR } from './scale.js';
import { place, replace } from './place.js';
import { audit, defineStyles, definePart, legendColor, onParts, partDefs, partsSelector, resolveMaterial } from './registry.js';
import { circle, mask, outline, path, rect, text, within } from './shapes.js';
import { layOf, MM, offerGround, offerSeat, parseLength, seatBox, seatCurves, seatOf, type Profile, type Sheet, type SurfaceCommand } from './sheet.js';
import type { Part } from './types.js';

/**
 * Whether `el` is hidden for being far off in a camera's world, and `back` each time what holds it comes back. A page drawn from markup
 * draws nothing while it's hidden, so it waits, and draws on its way back.
 */
export function farOff(el: Element, back: () => void): { far: () => boolean; stop: () => void } {
  const holder = el.closest('d-device, [data-alone]'), watch = new MutationObserver(() => !holder!.hasAttribute('data-far') && back());
  if (holder) watch.observe(holder, { attributes: true, attributeFilter: ['data-far'] });
  return { far: () => !!el.closest(HIDDEN_FAR), stop: () => watch.disconnect() };
}

export { parseLength };

const EDGE: Record<string, Profile> = { rolled: 'round', round: 'round', chamfer: 'chamfer', flat: 'flat', dome: 'dome', blend: 'blend' };

/** How far past a fold's crest a sheet rolls away, in thicknesses. A tight fold in card is about its own thickness in radius: guess, from photos. */
const ROLL = 2.2;
/** A score pressed in a card before it's folded: across and how deep, mm. Guess, from photos of a matchbook's spine. */
const SCORE = [0.35, 0.09] as const;

/**
 * What says a surface is a sheet of `thick` mm: where it's cut you see the thickness, the pale stock under the print, and where it's folded it rolls away
 * from you and the print goes round. `fold` names which edges of its box are folds. `score` is lines pressed across it, mm from the top.
 */
function stock(s: Sheet, p: Part, material: string, thick: number, fold: string[], score: number[], bevel: number) {
  const { x, y, w, h } = p, cut = thick * MM * 0.6, roll = thick * ROLL * MM, far = (w + h) * 2, under = resolveMaterial(material).sub;
  const sides = [
    ['top', rect(x - far, y - far, w + far * 2, far + roll)], ['bottom', rect(x - far, y + h - roll, w + far * 2, far + roll)],
    ['left', rect(x - far, y - far, far + roll, h + far * 2)], ['right', rect(x + w - roll, y - far, far + roll, h + far * 2)],
  ] as const;
  // A rim of the stock, on the edges that are cut, as thin as what shows of a sheet seen from nearly straight on.
  const lip = [
    ['top', rect(x, y, w, cut)], ['bottom', rect(x, y + h - cut, w, cut)], ['left', rect(x, y, cut, h)], ['right', rect(x + w - cut, y, cut, h)],
  ] as const;
  for (const [edge, band] of lip) if (!fold.includes(edge)) s.cut(band, { ink: under, feather: bevel ? 0.3 : 0, rough: 0.8 });
  for (const [edge, band] of sides) if (fold.includes(edge)) s.cut(band, { depth: thick * 0.7, soft: roll });
  for (const at of score) s.cut(rect(x, y + (at - SCORE[0] / 2) * MM, w, SCORE[0] * MM), { depth: SCORE[1], soft: SCORE[0] * MM });
}

/** The primitive everything else can be built from, in plain HTML. */
definePart({
  selector: 'd-surface',
  label: true,
  paint(s, p, d) {
    const a = (name: string) => p.el.getAttribute(name);
    // Without one of its own, it's made of what it's cut into: the surface it sits on, or else the device.
    const on = p.el.parentElement?.closest('d-surface[material], d-device');
    const material = a('material') ?? (on?.localName === 'd-surface' ? on.getAttribute('material')! : d.material);
    const rise = parseLength(a('height'), 1), [cx = 0, cy = cx] = (a('crown') ?? '0').trim().split(/\s+/).map(v => parseLength(v, 0));
    const crown: [number, number] = [cx, cy], bevel = parseLength(a('bevel'), 0.625) * MM;
    offerSeat(p.el, { top: seatOf(p) + rise, crown, x: p.x, y: p.y, w: p.w, h: p.h });

    const d0 = a('path');
    const viewBox = a('viewbox')?.trim().split(/[\s,]+/).map(Number) as [number, number, number, number] | undefined;
    const rotate = (+(a('rotate') ?? 0) * Math.PI) / 180;
    const drawn = d0 ? path(d0, p.x, p.y, p.w, p.h, { viewBox, rotate, rule: a('rule') === 'evenodd' ? 'evenodd' : undefined, spread: bevel + 8 }) : null;
    // `stop` is a second outline to end at: the surface's bevel still comes from `path`, so one side can slope wider than the others.
    const stop = a('stop'), shape = drawn ? (stop ? within(drawn, path(stop, p.x, p.y, p.w, p.h, { viewBox, rotate, spread: bevel + 8 })) : drawn)
      : a('shape') === 'circle' ? circle(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) / 2)
        : rect(p.x, p.y, p.w, p.h, { radius: parseLength(a('radius'), 0.75) * MM, rotate });
    // A recess can run off the surface it's sunk in, and it has no wall there. There's nothing past that edge to sink.
    const seat = rise < 0 ? seatBox(p) : undefined, r = parseLength(a('radius'), 0.75) * MM;
    const sunk = seat && (p.x < seat.x || p.y < seat.y || p.x + p.w > seat.x + seat.w || p.y + p.h > seat.y + seat.h)
      ? within(shape.type === 'field' ? shape : outline(p.x, p.y, p.w, p.h, [r, r, r, r], { rotate, spread: bevel + 8 }), rect(seat.x, seat.y, seat.w, seat.h)) : shape;

    // `clear` is a moulding you see through to what's under it, adding its reflection, and still lifting what's on it. Its value is how cloudy it is, 0 to 1, for a thick one that scatters what comes through.
    if (p.el.hasAttribute('clear')) {
      const cloud = +(a('clear') || 0);
      if (cloud) s.frost(sunk, { blur: bevel / 2, tint: resolveMaterial(material).color, opacity: cloud, zEdge: 0, zTop: rise, bevel, material, wear: +(a('wear') ?? d.wear) });
      return void s.glass(sunk, { material, height: rise, bevel, rim: bevel / MM, covers: true, curve: +(a('curve') || 0), thick: Math.max(rise, 0.3) });
    }

    s.surface(sunk, {
      material, follow: seatCurves(p), rise, bevel, profile: EDGE[a('edge') ?? 'rolled'] ?? 'round', crown, radial: p.el.hasAttribute('radial'),
      over: { wear: +(a('wear') ?? d.wear), ...layOf(a('lay')) },
    });
    offerGround(p.el, s.commands[s.commands.length - 1] as SurfaceCommand);
    if (a('sheet') !== null) stock(s, p, material, parseLength(a('sheet'), 0.35), (a('fold') ?? '').trim().split(/\s+/), (a('score') ?? '').trim().split(/\s+/).filter(Boolean).map(Number), bevel);

    const mode = a('label') ?? 'engrave';
    if (mode === 'emboss' && p.label) {
      const { lines, font, letterSpacing, wordSpacing } = p.label;
      for (const l of lines) {
        s.surface(text(l.text, l.x, l.y, l.w, l.h, { font, letterSpacing, wordSpacing }), {
          material, follow: seatCurves(p), rise: 0.5, bevel: 1.2, over: { rough: 0.3 },
        });
      }
    } else if (p.label) {
      s.cut(mask(p.label), { depth: mode === 'print' ? 0 : 0.2, ink: legendColor(material), wear: d.wear * 0.2 });
    }
  },
});

/** Parts that belong together, with no body: one canvas between them, however many there are. A part on its own needs no such thing. */
definePart({ selector: 'd-set', paint() {} });

/** Unenhanced, these are plain usable controls. .d-gl hands the look to the renderer. */
defineStyles(`
d-device { display: block; position: relative; isolation: isolate; }
/* An app rather than an object: it takes the size of what holds it, and casts nothing outside it. */
d-device[fill] { width: 100%; height: 100%; overflow: clip; }
/* Far out of the window, nothing of it is painted or hit, and it keeps its place. Clipped, not hidden, so the keyboard and a screen reader still reach it. A printed page has no window, so all of it prints.
   Clipped to a sliver of its whole height, too thin to paint: clipped to nothing, an observer judges it by its top edge alone, so one a window or more taller than the window, jumped or scrolled up into, never came near. Its width is still judged by its left edge. A rectangle, as a polygon that keeps the whole box costs about twice the layerizing, and a camera's world has no observers to tell, so it's clipped to nothing there. */
@media screen { [data-far] { clip-path: inset(0 calc(100% - 0.01px) 0 0); } ${HIDDEN_FAR} { clip-path: inset(50%); } }
/* In a camera's world it's hidden, as the browser still walks what it clips every time anything in the world is painted again: a page
   of 2,000 loading one at a time painted for 16 ms a frame, all of it a window or more away (44 → 15 s to load). There a camera decides
   what's seen, which no key or scroll can bring into view, so the keyboard and a screen reader pass it by until it comes back. */
@media screen { ${HIDDEN_FAR}, ${HIDDEN_FAR} * { visibility: hidden !important; } }
/* Shown too small to use, its markup sleeps: hidden, the device's own box left as it was, and a hand coming over it wakes it. Hidden, not
   clipped, as the browser still paints what it clips, every frame a camera moves (1.15 → 0.36 s a wheel out over 5,000 objects): so
   until a hand comes, the keyboard and a screen reader pass it by too. All of it, as some parts show themselves inside a device. */
@media screen { [data-asleep] > :not(canvas[data-d], d-device), [data-asleep] > :not(canvas[data-d], d-device) * { visibility: hidden !important; } }
/* The same for what a page hasn't brought in yet: its picture has further to come. */
@media screen { [data-veiled] d-device > :not(canvas[data-d], d-device), [data-veiled] d-device > :not(canvas[data-d], d-device) * { visibility: hidden !important; } }
d-device > canvas[data-d] { position: absolute; z-index: -1; pointer-events: none; }
/* A device's edges, while it waits to be drawn. Over its canvas, so they give way to its picture as it lands. */
:is(d-device, [data-alone]) > canvas[data-sketch] { position: absolute; z-index: -1; pointer-events: none; }
@media print { canvas[data-sketch] { display: none; } }
d-surface { display: block; position: relative; }
d-set { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
/* A part out on the page holds its own canvas. Most rules should win over this, so it weighs nothing. */
:where([data-alone]) { isolation: isolate; }
/* Named here so a framework's reset, in its base layer, can't undo what's in ours. This sheet comes first in the head, so this sets the order. */
@layer theme, base, device-ui, components, utilities;
/* In a layer so a page's own position wins. */
@layer device-ui { :where([data-alone]) { position: relative; } }
[data-alone] > canvas[data-d] { position: absolute; z-index: -1; pointer-events: none; }
/* A box is only what the page lays out, and most of one isn't what's drawn. What can't be used stays out of the way of what can. */
:where(.d-gl d-device *) { pointer-events: none; }
:where(.d-gl d-device :is(a, button, input, label, select, summary, textarea, [tabindex])) { pointer-events: auto; }
/* A finger on an object works it, as a hand on the real one does: two quick presses are two presses and not a zoom, a long one is a hold
   and not a selection or a menu, and nothing flashes grey over what's pressed. The page still scrolls past it. */
:where(.d-gl d-device) { touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.d-gl :is(d-device[lean], d-device:has(> d-device:is([reverse], [side])), d-device:is([reverse], [side])) { cursor: grab; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
.d-gl :is(d-device[lean], d-device:has(> d-device:is([reverse], [side])), d-device:is([reverse], [side])):active { cursor: grabbing; }
/* A finger on a run of keys slides along it, and doesn't move the page. */
.d-gl d-device [run] { touch-action: none; }
/* The other face of a body, in the same place, and the only one showing once it's up. It takes the pointer as its body does: a page
   that's put a body out of a hand's reach has put all of its faces out of it. */
d-device[reverse] { position: absolute; inset: 0; visibility: hidden; pointer-events: inherit; }
/* A side, as wide as the body is deep, across its middle. */
d-device[side] { position: absolute; top: 0; bottom: 0; left: 50%; width: var(--d-deep); margin-left: calc(var(--d-deep) / -2); visibility: hidden; pointer-events: inherit; }
/* A body and its long edges, each a device of its own in a holder that draws nothing, and only the one that's up showing. See tip.ts. */
/* The two faces of the half of a body that folds, each where it rests, and only the one that's up showing. */
d-device > d-device[fold] { position: absolute; }
d-device[folded] > d-device[fold="open"], d-device:not([folded]) > d-device[fold="shut"] { visibility: hidden; }
d-device > d-device[loose] { position: absolute; visibility: visible; pointer-events: auto; cursor: grab; touch-action: none; }
/* What's seated is drawn by what holds it, and only a hand's way to it stays here, on the face its seat is on: the thing and what's on it, so a lens's
   rings still turn on the body. What's still lying spare waits until there's a way in to see. */
d-device > d-device[loose][seated], d-device > d-device[loose][seated]:not([moving]) > canvas[data-d] { visibility: hidden; }
d-device:not([data-up]) > d-device[loose][seated][data-face="front"], d-device[data-up="back"] > d-device[loose][seated][data-face="back"],
d-device[data-up="left"] > d-device[loose][seated][data-face="left"], d-device[data-up="right"] > d-device[loose][seated][data-face="right"] { visibility: visible; }
d-device:not([data-up="back"]) > d-device[loose][at] { visibility: hidden; }
d-device[data-over] { visibility: hidden; }
d-device[data-up="back"] > d-device[reverse], d-device[data-up="left"] > d-device[side="left"], d-device[data-up="right"] > d-device[side="right"] { visibility: visible; }
/* Each face draws its part of the body, so all of them show while it goes round. */
d-device:is([data-turning], [data-up="left"], [data-up="right"]) > canvas[data-d], d-device:is([data-up="left"], [data-up="right"]) > d-device[reverse] > canvas[data-d], d-device[data-turning] > d-device:is([reverse], [side]) > canvas[data-d] { visibility: visible; }
/* Where a part is drawn outside its box. Behind its contents, so its own inputs still come first. */
:where([d-reach])::after { content: ''; position: absolute; z-index: -1; left: var(--reach-x); top: var(--reach-y); width: var(--reach-w); height: var(--reach-h); }
/* Its corners are the body's, as its radius says in mm at 4 css px a mm, so anything drawn round its box, an outline or a focus ring, follows
   it. Where attr() can't read a number, the default radius. */
d-device { background: #ddd; border: 1px solid #777; border-radius: 10px; border-radius: calc(attr(radius type(<number>), 2.5) * 4px); }
.d-gl d-device { background: none; border: 0; }
.d-gl d-surface { color: transparent; }
@media (forced-colors: active) {
  :is(d-device, [data-alone]) > canvas:is([data-d], [data-sketch]) { display: none; }
}
`);

const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export class DeviceElement extends Base {
  connectedCallback(): void {
    // Before the engine sees it, which measures as it adds.
    place(this);
    getEngine().add(this);
  }
  disconnectedCallback(): void {
    getEngine().remove(this);
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('d-device')) {
  customElements.define('d-device', DeviceElement);
}

// A table lays out what it's given and a closed details hides it, so neither can keep a canvas. Whatever holds them does.
const CANT_HOLD = new Set(['input', 'img', 'hr', 'br', 'canvas', 'select', 'textarea', 'meter', 'progress', 'table', 'details']);

const TOP = 'dialog, [popover]';

/** A part with no device round it is a device of its own, with no body: `<button d-key="tab">` works anywhere on a page. */
function claim(root: ParentNode, among = partsSelector()): void {
  const parts = partsSelector();
  const found = [...(root instanceof Element && root.matches(among) ? [root] : []), ...root.querySelectorAll(among)] as HTMLElement[];
  for (const el of found) {
    if (el.hasAttribute('data-alone') || el.closest('d-device') || CANT_HOLD.has(el.localName)) continue;
    // The top layer is out of reach of any canvas below it, so what opens there has its own, whatever's round it in the markup.
    const holder = el.parentElement?.closest(`${parts}, ${TOP}`);
    if (holder?.matches(parts)) continue;
    el.setAttribute('data-alone', '');
    getEngine().add(el);
  }
}

function release(root: Element): void {
  for (const el of [root, ...root.querySelectorAll('[data-alone]')]) {
    if (!el.hasAttribute('data-alone') || el.isConnected) continue;
    el.removeAttribute('data-alone');
    getEngine().remove(el as HTMLElement);
  }
}

/** How long a page gets for its packs to arrive, before what no part answers to counts as a mistake. */
const SETTLE = 2000;
const unseen = new Set<Element>();
let settling = 0;

/** A device checks its own markup. A name no part answers to out on the page makes no device to check it, so this does. */
function check(): void {
  settling = 0;
  for (const root of unseen) if (root.isConnected) for (const el of [root, ...root.querySelectorAll('*')]) audit(el);
  unseen.clear();
}

if (typeof MutationObserver !== 'undefined') {
  let queued = false, known = 0;
  // Packs load whenever they're imported, so what counts as a part can change with the page already there. Only what the parts new since
  // last time match can have become one: the page searched for every part there is, as each pack came, was a tenth of a second on zoom.
  onParts(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      const all = partDefs(), fresh = all.slice(0, all.length - known);
      known = all.length;
      if (fresh.length) claim(document, fresh.map(p => p.selector).join(','));
      unseen.add(document.documentElement);
      clearTimeout(settling);
      settling = window.setTimeout(check, SETTLE);
    });
  });
  new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'attributes') {
        replace(r.target as Element);
        continue;
      }
      for (const n of r.removedNodes) if (n instanceof Element) release(n);
      for (const n of r.addedNodes) {
        if (!(n instanceof Element) || !n.isConnected) continue;
        place(n);
        claim(n);
        unseen.add(n);
        settling ||= window.setTimeout(check, SETTLE);
      }
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['place'] });
  place(document.documentElement);
}
