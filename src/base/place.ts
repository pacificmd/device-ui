// Where a thing sits on what holds it, in real mm: `place="x y w h"`, from the holder's top left to the thing's centre, the way a
// photo is measured. `place="corner x y w h"` goes to its top left. No `h` is as high as it's wide. It stays markup, so what a
// device shows as its HTML is the sizes it was measured at.
import { warnOnce, written } from './registry.js';
import { MM } from './sheet.js';

/** Real mm as a CSS length, for what no `place` covers: a stylesheet, a size set from a script. */
export const mm = (n: number): string => `${n * MM}px`;

const done = new WeakMap<HTMLElement, string>();

function placeOne(el: HTMLElement): void {
  const value = el.getAttribute('place');
  if (value === null) {
    if (done.delete(el)) el.style.position = el.style.left = el.style.top = el.style.width = el.style.height = '';
    return;
  }
  if (done.get(el) === value) return;
  done.set(el, value);
  const words = value.trim().split(/\s+/), corner = words[0] === 'corner', numbers = (corner ? words.slice(1) : words).map(Number);
  const [x = NaN, y = NaN, w = NaN, h = w] = numbers;
  if (numbers.length < 3 || numbers.length > 4 || numbers.some(Number.isNaN)) return warnOnce(`place takes "x y w h" or "corner x y w h" in mm, with h optional. ${written(el)}`);
  // Parts are `position: relative` to be laid out in plain HTML, which would take these as nudges.
  el.style.position = 'absolute';
  el.style.left = mm(corner ? x : x - w / 2);
  el.style.top = mm(corner ? y : y - h / 2);
  el.style.width = mm(w);
  el.style.height = mm(h);
}

/** Places this element and everything in it that says where it goes. */
export function place(root: Element): void {
  if (root.hasAttribute('place')) placeOne(root as HTMLElement);
  for (const el of root.querySelectorAll<HTMLElement>('[place]')) placeOne(el);
}

/** Places it again now that its attribute has changed. */
export const replace = (el: Element): void => placeOne(el as HTMLElement);
