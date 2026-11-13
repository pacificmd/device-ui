import { FINISHES, roughOf, sizes, type FinishName } from './finishes.js';
import type { Material, MaterialDef, PartDef, Substance, Vec3 } from './types.js';

const read = new Map<string, Vec3>();
let named: OffscreenCanvasRenderingContext2D | null | undefined;

/** The 0-255 channels of any colour css takes, as a page writes it on an attribute: #rgb, #rrggbb with or without alpha, rgb(), or a name. Null when it isn't one. */
function channels(colour: string): [number, number, number] | null {
  let c = colour.trim();
  if (!/^#|^rgba?\(/i.test(c)) {
    // Names, hsl() and the rest are the browser's to read: it writes back what it took as #rrggbb or rgba().
    named ??= typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(1, 1).getContext('2d');
    if (!named) return null;
    named.fillStyle = '#010203';
    named.fillStyle = c;
    if (named.fillStyle === '#010203') return null;
    c = named.fillStyle;
  }
  const hex = c.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map(d => d + d).join('') : hex;
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  return rgb ? [+rgb[1]!, +rgb[2]!, +rgb[3]!].map(v => Math.min(Math.max(v, 0), 255)) as [number, number, number] : null;
}

/** A colour as the renderer works in it, linear light 0 to 1. One it can't read says so and comes out mid grey, rather than as whatever its digits happen to spell. */
export function linear(colour: string): Vec3 {
  let v = read.get(colour);
  if (v) return v;
  const rgb = channels(colour);
  if (!rgb) warnOnce(`"${colour}" isn't a colour, so it's drawn grey. Write it as css does: #rgb, #rrggbb, rgb() or a name.`);
  const c = (n: number) => {
    n /= 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  v = (rgb ?? [128, 128, 128]).map(c) as Vec3;
  read.set(colour, v);
  return v;
}

const said = new Set<string>();

/** Says a thing once, however often it's still true. A warning that repeats every frame is one nobody reads. */
export function warnOnce(message: string, level: 'warn' | 'error' = 'warn'): void {
  if (said.has(message)) return;
  said.add(message);
  console[level](`[device-ui] ${message}`);
}

/** An element as it was written, for a message: its tag and attributes, without what's inside. */
export function written(el: Element): string {
  const html = (el.cloneNode(false) as Element).outerHTML, tag = html.slice(0, html.lastIndexOf('</'));
  return tag.length > 120 ? `${tag.slice(0, 120)}…` : tag;
}

const base: Required<Pick<MaterialDef, 'rough' | 'metal' | 'coat' | 'aniso' | 'tangent' | 'mottle' | 'fleck' | 'wear' | 'emit' | 'legend' | 'patinaRough' | 'age' | 'touch' | 'film' | 'filmVary' | 'leak' | 'dents' | 'fade' | 'rings' | 'pores'>> & {
  color: string;
  sub: string;
} = {
  color: '#808080', sub: '#8f9194', rough: 0.5, metal: 0, coat: 0, aniso: 0, tangent: 0,
  mottle: 0, fleck: 0, wear: 0, emit: [0, 0, 0], legend: '#e9e6dc',
  patinaRough: 0.72, age: 0, touch: 0, film: 0, filmVary: 0, leak: 0, dents: 0, fade: 0, rings: 3.5, pores: 0.6,
};

// What follows from what a thing is. Marks and wear are off unless the stuff can really take them.
// How it was made is its finish, and these are the ones it comes with unless a material says.
// Refractive indices are spec: soda-lime glass and acrylic.
const SUBSTANCES: Record<Substance, Pick<MaterialDef, 'sheen' | 'scatter' | 'marks' | 'wears' | 'broad' | 'coatRough' | 'metal' | 'ior' | 'breaks'> & { finish: FinishName }> = {
  metal: { finish: 'satin-metal', metal: 1, marks: 1, wears: 'chip', broad: 0.4 },
  paint: { finish: 'matte-paint', marks: 1, wears: 'chip', broad: 0.6, coatRough: 0.12 },
  plastic: { finish: 'bead-mould', scatter: 0.3, marks: 1, wears: 'polish', broad: 0.7, ior: 1.49, breaks: 'split' },
  rubber: { finish: 'moulded-rubber', sheen: 0.55, scatter: 0.45, marks: 0.4, wears: 'polish', broad: 0.6 },
  ceramic: { finish: 'glazed', scatter: 0.15, marks: 1, wears: 'spall', broad: 0.4 },
  glass: { finish: 'float-glass', marks: 1, wears: 'none', broad: 0.15, ior: 1.52, breaks: 'glass' },
  stone: { finish: 'honed-stone', scatter: 0.1, marks: 0.6, wears: 'polish', broad: 0.5 },
  wood: { finish: 'oiled-wood', scatter: 0.1, marks: 0.5, wears: 'polish', broad: 0.4, coatRough: 0.28 },
  leather: { finish: 'tanned-leather', sheen: 0.15, scatter: 0.15, marks: 0.3, wears: 'polish', broad: 0.6 },
  cloth: { finish: 'knitted-cloth', sheen: 0.8, scatter: 0.3, marks: 0, wears: 'none', broad: 0.5 },
  paper: { finish: 'uncoated-paper', sheen: 0.1, scatter: 0.3, marks: 0.2, wears: 'none', broad: 0.5 },
  liquid: { finish: 'still', marks: 0, wears: 'none', broad: 0 },
};

/** A material's finish, and what that sets before the material has its say. */
function finishOf(def: MaterialDef | undefined, over?: Partial<MaterialDef>) {
  const name = over?.finish ?? def?.finish ?? (def?.substance && SUBSTANCES[def.substance].finish);
  const finish = name ? FINISHES[name] : undefined;
  if (!finish) return { finish, set: {} };
  const dir = finish.fine === 'none' ? 0 : finish.fine.dir ?? 0;
  return { finish, set: { rough: roughOf(finish.fine), aniso: dir, coat: finish.coat ?? 0 } };
}

const materials = new Map<string, MaterialDef>([['plain', { substance: 'paint' }]]);
/** Materials worked out, by name and what was laid over them, since a page of a thousand things asks for the same few thousands of times.
 * What comes back is shared, so it's read and never written. Defining a material forgets them all, and so does a page
 * that's asked for more than `KEEP` kinds, as one ageing everything by the second would. */
const resolved = new Map<string, Material>();
const KEEP = 4096;

export function defineMaterial(name: string, def: MaterialDef): void {
  materials.set(name, def);
  resolved.clear();
}

export function defineMaterials(table: Record<string, MaterialDef>): void {
  for (const [name, def] of Object.entries(table)) defineMaterial(name, def);
}

export type Scheme = 'light' | 'dark';

let scheme: Scheme = 'light', followed = false;

/** Says which side of `light-dark(a, b)` holds for what's painted next, and whether anything has followed the scheme since the last call. */
export function schemed(next: Scheme): boolean {
  const was = followed;
  scheme = next;
  followed = false;
  return was;
}

/** `light-dark(a, b)`, as in css: one material in a light scheme, another in a dark one. */
function pick(name: string): string {
  if (!name.startsWith('light-dark(')) return name;
  followed = true;
  const [light = '', dark = light] = name.slice(11, -1).split(',').map(side => side.trim());
  return scheme === 'dark' ? dark : light;
}

export function getMaterialDef(name: string): MaterialDef {
  const def = materials.get(pick(name)), { finish, set } = finishOf(def), { substance } = def ?? {};
  const shape = finish && finish.pattern !== 'none' ? finish.pattern.shape : undefined;
  return { ...base, ...(substance && SUBSTANCES[substance]), ...set, ...(shape && { pattern: shape }), ...def };
}

export function hasMaterial(name: string): boolean {
  return materials.has(pick(name));
}

// Sun bleaches a dye. A metal's colour is the metal's own, and glass and a glaze are coloured by oxides fired into them, so none of
// those fade: gold, brass or red glass left in the window come back the colour they went in.
const UNFADED = new Set<string>(['metal', 'glass', 'ceramic']);

// What light does to the stuff itself over years, as a filter on its colour, linear: the polymer in white and pale plastic browns and
// takes the blue out first, so a white goes cream and then nicotine, while a dark one barely moves. Only for things that don't say what
// they age to. Measured off aged ABS and polycarbonate, the white #ecebe7 going to about #e2d5ad: guess.
const AGES: Partial<Record<string, Vec3>> = { plastic: [0.93, 0.82, 0.55] };

// How bright a body has to be, linear, before light print stops reading on it, and the ink it gets then.
const PALE = 0.3, DARK_LEGEND = '#1c1b19';
const colour = (c: string | Vec3): Vec3 => (typeof c === 'string' ? linear(c) : c);

/** Resolves a named material, with overrides, into the numbers the shader takes. */
export function resolveMaterial(side: string, over?: Partial<MaterialDef>): Material {
  const name = pick(side), key = over ? `${name}\0${JSON.stringify(over)}` : name;
  let m = resolved.get(key);
  if (!m) {
    if (resolved.size >= KEEP) resolved.clear();
    resolved.set(key, (m = resolveFresh(name, over)));
  }
  return m;
}

function resolveFresh(name: string, over?: Partial<MaterialDef>): Material {
  if (!materials.has(name)) warnOnce(`unknown material "${name}"`);
  const named = materials.get(name), { finish, set } = finishOf(named, over);
  const m = { coatRough: 0.09, sheen: 0, scatter: 0, marks: 0, wears: 'none' as const, broad: 0, ...base, ...(named?.substance && SUBSTANCES[named.substance]), ...set, ...named, ...over };
  const built = sizes(finish, { ...m, size: over?.size ?? named?.size });
  // Metal wears down to metal. Anything else is the same stuff, paler, unless it says otherwise.
  // A bare metal that doesn't say what's under it is the same metal all through.
  const metalBelow = m.metal > 0.5 || m.sub === base.sub, solid = m.metal > 0.5 && named?.sub === undefined && over?.sub === undefined;
  const top = m.under?.[0] ?? { color: solid ? m.color : m.sub, rough: metalBelow ? 0.44 : Math.max(m.rough, 0.5), metal: metalBelow ? 1 : 0 };
  const low = m.under?.[1] ?? top;
  // Nothing on it to flake, so it scratches and rubs smooth instead, unless it says how it wears.
  const wears = solid && !m.coat && named?.wears === undefined && over?.wears === undefined ? 'polish' : m.wears;
  const chips = wears !== 'none', ages = named?.substance ? AGES[named.substance] : undefined;
  return {
    coatRough: m.coatRough, sheen: m.sheen ?? 0, scatter: m.grating ?? m.scatter ?? 0, marks: m.marks ?? 0, polish: wears === 'polish' ? 1 : 0, chip: wears === 'spall' ? 3 : 1, broad: m.broad ?? 0,
    color: colour(m.color), sub: colour(top.color), rough: m.rough, metal: m.metal, coat: m.coat,
    subRough: top.rough ?? 0.44, subMetal: top.metal ?? 1,
    bare: colour(low.color), bareRough: low.rough ?? 0.44, bareMetal: low.metal ?? 1,
    coatTint: m.coatTint ? colour(m.coatTint) : [1, 1, 1],
    dents: chips ? m.dents : 0, fade: UNFADED.has(named?.substance ?? '') ? 0 : m.fade, rings: m.rings, pores: m.pores, filmVary: m.filmVary, leak: m.leak,
    aniso: m.aniso, tangent: m.tangent, mottle: m.mottle, ...built,
    fleck: m.fleck, wear: chips ? m.wear : 0, emit: m.emit, patina: m.patina ? colour(m.patina) : ages ? colour(m.color).map((v, i) => v * ages[i]!) as Vec3 : null,
    patinaRough: m.patina || !ages ? m.patinaRough : m.rough, age: m.age, touch: m.touch,
    color2: colour(m.color2 ?? m.color), film: m.film,
  };
}

/** What's printed on a material, unless it says: dark on anything pale, since pale print on a pale body can't be read. */
export function legendColor(name: string): Vec3 {
  const { legend, color } = getMaterialDef(name);
  if (legend !== base.legend) return linear(legend!);
  const [r, g, b] = colour(color ?? base.color);
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > PALE ? linear(DARK_LEGEND) : linear(base.legend);
}

const parts: PartDef[] = [];
let version = 0;
/** Each part under the one name an element has to carry to be it, `tag` or `[attribute`, latest first, so an element is only tried
 * against the parts its own names could make it and not every part there is. A selector that looks past the element goes under ''. */
const keyed = new Map<string, PartDef[]>(), defined = new Map<PartDef, number>();
const ALONE = /^([a-z][\w-]*)?((?:\[[^\]]+\])*)$/i;
const keyOf = (selector: string): string => {
  const [, tag, attrs] = ALONE.exec(selector.trim()) ?? [];
  if (tag) return tag.toLowerCase();
  const first = attrs && /^\[\s*([^\s~|^$*=\]]+)/.exec(attrs);
  return first ? `[${first[1]!.toLowerCase()}` : '';
};

// Most parts are a form, one word of one of our attributes: `[d-key~="chiclet"]`, `[d-key=""]`. Those go under the attribute and the word,
// so an element is tried only against the forms its own words name, of the few dozen a name like `d-key` has. One that's nothing but
// that is decided by the word alone, without asking the browser.
const worded = new Map<string, PartDef[]>(), wordedNames = new Set<string>(), whole = new Set<PartDef>();
const WORD = /^\[\s*(d-[\w-]+)\s*(~?=)\s*(?:"([\w-]*)"|'([\w-]*)'|([\w-]+))\s*\]/;
/** The attribute, `=` or `~=`, and the word a tagless selector's first clause names, and whether that clause is all of it. */
const wordOf = (selector: string): [string, string, string, boolean] | null => {
  const s = selector.trim(), m = WORD.exec(s);
  if (!m || !ALONE.test(s)) return null;
  const word = m[3] ?? m[4] ?? m[5] ?? '';
  // `~=` never matches nothing.
  if (m[2] === '~=' && !word) return null;
  return [m[1]!.toLowerCase(), m[2]!, word, m[0].length === s.length];
};
// Split as CSS splits a list of words.
const SPACE = /[ \t\n\f\r]+/;

// Names that are ours but aren't parts: the device itself, and what the engine reads or sets on a part.
const tags = new Set(['d-device']), attributes = new Set(['d-layer', 'd-reach']);
const forms = new Map<string, Set<string>>(), anyValue = new Set<string>();
// The words a form takes after it, by `attribute form`. A form that names none isn't checked.
const options = new Map<string, Set<string>>();
const OURS = /^d-/;

/** Notes the names markup can use, in tags or `[attributes]`, so that anything else with our prefix can be told apart. */
function learn(selector: string): void {
  for (const [, attribute, tag] of selector.matchAll(/\[(d-[\w-]+)|(?<![\w.#[-])(d-[\w-]+)/g)) {
    if (attribute) attributes.add(attribute);
    else tags.add(tag!);
  }
  // `[d-key=""]` is the plain form, `[d-key~="chiclet"]` a named one, and a bare `[d-key]` takes any value.
  for (const [, attribute, form] of selector.matchAll(/\[(d-[\w-]+)~?="([\w-]*)"/g)) {
    if (!forms.has(attribute!)) forms.set(attribute!, new Set());
    forms.get(attribute!)!.add(form!);
  }
  for (const [, attribute] of selector.matchAll(/\[(d-[\w-]+)\]/g)) anyValue.add(attribute!);
}

function learnOptions({ selector, options: words }: PartDef): void {
  const form = /\[(d-[\w-]+)~="([\w-]+)"/.exec(selector);
  if (!form || !words) return;
  const at = `${form[1]} ${form[2]}`;
  options.set(at, new Set([...(options.get(at) ?? []), ...words]));
}

/** Says what a part reads from markup that isn't a part of its own, as `tag` or `[attribute]`. */
export function defineNames(...names: string[]): void {
  names.forEach(learn);
}

/** Words after a form that the form doesn't take, as `d-mark="print slik"`. The form still draws, without what was meant. */
export function unknownWords(el: Pick<Element, 'getAttributeNames' | 'getAttribute'>): string[] {
  return el.getAttributeNames().filter(name => OURS.test(name)).flatMap(name => {
    const [form, ...rest] = el.getAttribute(name)!.trim().split(/\s+/), known = options.get(`${name} ${form}`);
    return known ? rest.filter(word => !known.has(word)).map(word => `[${name}="${form} ${word}"]`) : [];
  });
}

/**
 * What in this element's markup looks like a part and isn't one, usually a pack that wasn't imported, or a form
 * nothing has defined. It would otherwise draw nothing and say nothing.
 */
export function unknownNames(el: Pick<Element, 'localName' | 'getAttributeNames' | 'getAttribute'>): string[] {
  const names = OURS.test(el.localName) && !tags.has(el.localName) ? [`<${el.localName}>`] : [];
  for (const name of el.getAttributeNames()) {
    if (!OURS.test(name)) continue;
    if (!attributes.has(name)) {
      names.push(`[${name}]`);
      continue;
    }
    // The form comes first and options follow it, so only the first word can be misspelt into nothing.
    const value = el.getAttribute(name)!.trim(), known = forms.get(name);
    if (known && !anyValue.has(name) && !known.has(value.split(/\s+/)[0]!)) names.push(`[${name}="${value}"]`);
  }
  return names;
}

/** Says what's wrong with this element's markup, once each. */
export function audit(el: Element): void {
  // Most of a device's markup is plain HTML, with nothing of ours to get wrong.
  if (!OURS.test(el.localName) && !el.getAttributeNames().some(name => OURS.test(name))) return;
  for (const name of unknownNames(el)) warnOnce(`${name} matches no part, so it draws nothing. Is its pack imported? ${written(el)}`);
  for (const word of unknownWords(el)) warnOnce(`${word} isn't an option of that form, so it's ignored. ${written(el)}`);
  if (BUILDING) readChecks(el);
}

// Where someone is working on a page, not where it's published. What every form reads is too much for a page to pay for, so it only comes here.
const BUILDING = typeof location !== 'undefined' && (location.protocol === 'file:' || /^(?:localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*\.test)$/.test(location.hostname));
let auditAttributes: ((el: Element) => void) | null = null, loading: Element[] | null = null;

/** Checks an element's other attributes against what its form reads, as soon as that's here. */
function readChecks(el: Element): void {
  if (auditAttributes) return auditAttributes(el);
  if (loading) return void loading.push(el);
  loading = [el];
  void import('./attributes.js').then(checks => {
    auditAttributes = checks.auditAttributes;
    for (const waiting of loading!) if (waiting.isConnected) auditAttributes(waiting);
    loading = null;
  });
}

/** Later definitions win when two selectors match the same element. */
export function definePart(def: PartDef): void {
  parts.unshift(def);
  const word = wordOf(def.selector), key = word ? `${word[0]} ${word[1]}${word[2]}` : keyOf(def.selector), index = word ? worded : keyed;
  index.set(key, [def, ...(index.get(key) ?? [])]);
  if (word) {
    wordedNames.add(word[0]);
    if (word[3]) whole.add(def);
  }
  defined.set(def, parts.length);
  learn(def.selector);
  learnOptions(def);
  version++;
  // Anything else in a device lets the pointer through, as it does for a bare surface.
  if (def.motion) defineStyles(`:where(.d-gl :is(${def.selector})) { pointer-events: auto; }`);
  for (const fn of listeners) fn();
}

const listeners: (() => void)[] = [];
/** Runs after every part that's defined from now on, and once now. */
export function onParts(fn: () => void): void {
  listeners.push(fn);
  fn();
}

export const partDefs = (): readonly PartDef[] => parts;
export const partsVersion = (): number => version;

/** The part an element is, the latest defined of those that match it. */
export function partFor(el: Element): PartDef | undefined {
  let best: PartDef | undefined, at = -1;
  const among = (list: PartDef[] | undefined) => {
    const def = list?.find(p => whole.has(p) || el.matches(p.selector));
    if (def && defined.get(def)! > at) [best, at] = [def, defined.get(def)!];
  };
  among(keyed.get(el.localName));
  for (const name of el.getAttributeNames()) {
    among(keyed.get(`[${name}`));
    if (!wordedNames.has(name)) continue;
    const value = el.getAttribute(name)!;
    among(worded.get(`${name} =${value}`));
    for (const word of value.split(SPACE)) if (word) among(worded.get(`${name} ~=${word}`));
  }
  among(keyed.get(''));
  return best;
}

let selectors: { version: number; every: string; names: string; attributes: Set<string> | null } | null = null;
const selectorsNow = () => {
  if (selectors?.version !== version) {
    const names = [...keyed].flatMap(([key, list]) => (key === '' ? list.map(p => p.selector) : [key.startsWith('[') ? `${key}]` : key]));
    // A selector that's only a tag and attributes reads nothing else of an element. Anything more may read any of it.
    const plain = parts.every(p => p.selector.split(',').every(one => ALONE.test(one.trim())));
    const attributes = plain ? new Set(parts.flatMap(p => [...p.selector.matchAll(/\[\s*([^\s~|^$*=\]]+)/g)].map(m => m[1]!.toLowerCase()))) : null;
    selectors = { version, every: parts.map(p => p.selector).join(','), names: [...new Set([...names, ...[...wordedNames].map(n => `[${n}]`)])].join(','), attributes };
  }
  return selectors;
};
/** The attributes that can make an element a part or not, or null when any can: a change to any other leaves every part what it was. */
export const partAttributes = (): ReadonlySet<string> | null => selectorsNow().attributes;
/** Matches exactly what's a part. */
export const partsSelector = (): string => selectorsNow().every;
/** Matches whatever carries a name some part needs: everything that's a part and a little more, cheaper to look for. Each one
 * found still goes through `partFor`. */
export const maybePartsSelector = (): string => selectorsNow().names;

const styles: string[] = [];
let onStyles: ((css: string) => void) | null = null;

export function defineStyles(css: string): void {
  styles.push(css);
  onStyles?.(css);
}

/** Hears every stylesheet defined from now on, and has those defined so far given to `first`, or to `fn` if it's not given. */
export function watchStyles(fn: (css: string) => void, first = fn): void {
  styles.forEach(first);
  onStyles = fn;
}
