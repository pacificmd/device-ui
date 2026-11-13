// A part ignores an attribute it doesn't read, so a wrong one draws what was asked for without it and says nothing. This says.
// `audit` loads it only where someone is building, as it holds what every form of every pack reads.
import { EVERY, READS } from './reads.js';
import { partFor, warnOnce } from './registry.js';

// What the browser means by a name its own properties don't spell, and what anything may carry for itself.
const THE_BROWSERS = /^(?:class|for|role|xmlns.*|aria-.+|data-.+)$/;
// Names with this are a part's own, and `audit` already checks those.
const OURS = /^d-/;

const properties = new WeakMap<object, Set<string>>();
/** The attributes the browser reads off this kind of element: its properties, as `tabIndex` is `tabindex`. A `<button>` can be `disabled` and a `<div>` can't. */
const native = (el: Element): Set<string> => {
  const kind = Object.getPrototypeOf(el) as object;
  let names = properties.get(kind);
  if (!names) {
    names = new Set();
    for (let o: object | null = kind; o; o = Object.getPrototypeOf(o) as object | null) {
      for (const [name, d] of Object.entries(Object.getOwnPropertyDescriptors(o))) if (d.get) names.add(name.toLowerCase());
    }
    properties.set(kind, names);
  }
  return names;
};

/** How many letters apart two names are. */
const apart = (a: string, b: string): number => {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length]!;
};

/** The name it was probably meant to be, close enough that a typo explains it. */
export function closest(name: string, among: readonly string[]): string | undefined {
  let best: string | undefined, least = name.length < 5 ? 2 : 3;
  for (const known of among) {
    const d = apart(name, known);
    if (d < least) [best, least] = [known, d];
  }
  return best;
}

/** The attributes on this element nothing reads, by the form it is. A form the catalogue doesn't list is someone's own, with reads we can't know. */
export function unknownAttributes(el: Element): { form: string; name: string; reads: string[] }[] {
  const form = el.localName === 'd-device' ? 'd-device' : partFor(el)?.selector;
  const read = form === undefined ? undefined : READS[form];
  if (read === undefined) return [];
  // A part on its own is a device of its own, so it takes what one takes.
  const reads = [...read.split(' '), ...EVERY.split(' '), ...(el.hasAttribute('data-alone') ? READS['d-device']!.split(' ') : [])].filter(Boolean);
  return el.getAttributeNames()
    .filter(name => !OURS.test(name) && !THE_BROWSERS.test(name) && !reads.includes(name) && !native(el).has(name))
    .map(name => ({ form: form!, name, reads }));
}

/** Says which attributes on this element do nothing, once for each form and name. */
export function auditAttributes(el: Element): void {
  for (const { form, name, reads } of unknownAttributes(el)) {
    const meant = closest(name, reads);
    warnOnce(`${form} doesn't read "${name}", so it does nothing.${meant ? ` Did you mean "${meant}"?` : ''} It reads: ${reads.join(', ')}.`);
  }
}
