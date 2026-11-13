// The key: one part, in many forms. A form says how it feels and what shape it is, and everything else a key does is here.
import { defineStyles, FOCUS, legendColor, mask, press, type CutOptions, type DeviceInfo, type Part, type PartDef, type PressOptions, type Shape, type Sheet, type SpringDef } from 'device-ui';
import { icon } from './icons.js';
import { inherited, keyStyles, num } from './shared.js';

// A label round a checkbox that goes in sideways, or lights a step, keeps its own colour.
defineStyles(keyStyles('[d-key]:not(:where(label[d-key~="edge"], label[d-key~="step"]))'));

/** What a form draws with. */
export interface KeyCap {
  /** What the cap is made of. */
  cap: string;
  /** How far down it is, 0 to 1, and a little past either end as it lands. */
  down: number;
  /** A keyboard focus ring round this shape, while there is one. */
  focus(shape: Shape, width?: number): void;
}

export interface KeyForm extends Partial<Omit<PartDef, 'selector' | 'paint'>> {
  /** How it feels. Or spread a joint of its own into the form. */
  feel?: PressOptions;
  /** What its cap is unless `material` or the device's `keycap` says. A form with none reads neither. */
  cap?: string;
  /** It isn't a keycap, so the device's `keycap` leaves it alone. */
  own?: boolean;
  /** How the light comes up, for a form that `on` lights. */
  lit?: SpringDef;
  /** The shape, and nothing else. */
  draw(s: Sheet, p: Part, d: DeviceInfo, k: KeyCap): void;
}

/** What the tag's value says: its form, then anything else, as `d-key="side left"`. */
export const words = (p: Part, tag = /d-[\w-]+/.exec(p.def.selector)?.[0] ?? 'd-key') => (p.el.getAttribute(tag) ?? '').trim().split(/\s+/);

/** `icon="play"` on a key: a legend from the icon set, in place of or beside its text. `icon-size` is its share of the key's short side. */
const glyphOf = (p: Part) => {
  const name = p.el.getAttribute('icon');
  if (!name) return null;
  const size = Math.min(p.w, p.h) * num(p, 'icon-size', 0.5);
  return icon(name, p.x + (p.w - size) / 2, p.y + (p.h - size) / 2, size, { weight: 2.4, solid: p.el.hasAttribute('icon-solid') });
};

/** A key's text and its icon, in `ink`, or in what its cap prints unless that's said. */
export function legend(s: Sheet, p: Part, cap: string, o: Omit<CutOptions, 'ink'> & { ink?: CutOptions['ink'] } = {}): void {
  const look = { ...o, ink: o.ink ?? legendColor(cap) }, glyph = glyphOf(p);
  if (p.label) s.cut(mask(p.label), look);
  if (glyph) s.cut(glyph, look);
}

/** One form of the key. `selector` is `[d-key~="form"]`, or `[d-key=""]` for the plain one. */
export function key(selector: string, form: KeyForm): PartDef {
  const joint = { ...press(form.feel), ...form };
  return {
    selector,
    label: true,
    ...joint,
    springs: { ...joint.springs, ...(form.lit ? { lit: form.lit } : {}) },
    update(p) {
      joint.update?.(p);
      if (form.lit) p.springs.lit!.set(p.el.hasAttribute('on') ? 1 : 0);
    },
    paint(s, p, d) {
      form.draw(s, p, d, {
        cap: !form.cap ? '' : p.el.getAttribute('material') || (form.own ? '' : inherited(d, 'keycap')) || form.cap,
        down: p.springs.press!.value,
        focus(shape, width) {
          if (p.focused) s.glow(shape, FOCUS, width);
        },
      });
    },
  };
}
