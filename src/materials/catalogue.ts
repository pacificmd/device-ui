import { FINISHES, roughOf, type Finish, type FinishName, type MaterialDef } from 'device-ui';
import type { MaterialSpec } from './index.js';

type Substance = NonNullable<MaterialDef['substance']>;

/** Where a number came from: published, read off a photo, or ours. */
export type Mark = 'spec' | 'measured' | 'guess';

/** Every number a finish holds. */
export type Value = 'broad.wave' | 'broad.height' | 'pattern.size' | 'pattern.depth' | 'fine.ra' | 'fine.spacing';

interface Source {
  /** What was done to the surface, in a line. */
  what: string;
  /** The values that are a published number. Anything not listed here or in `measured` is a guess. */
  spec?: Value[];
  /** The values read off a photo. */
  measured?: Value[];
}

// The same marks as the comments in base's finishes.ts, as data, so they can be shown and tested.
// A finish added there without an entry here doesn't compile.
const SOURCES: Record<FinishName, Source> = {
  'polished-mould': { what: 'Shot into a tool polished to a mirror.', spec: ['fine.ra'] },
  'stoned-mould': { what: 'Shot into a tool finished with fine stones, which leaves faint lines.', spec: ['pattern.depth', 'fine.ra'] },
  'bead-mould': { what: 'Shot into a bead-blasted tool, which leaves a fine even matt.', spec: ['pattern.depth', 'fine.ra'] },
  'moulded-stipple': { what: 'Shot into a tool with a coarse stippled texture, as on a controller shell.' },
  'moulded-dots': { what: 'A lattice of raised dots cut into the tool, as on a controller grip.' },
  'sintered-powder': { what: 'Nylon powder fused layer by layer with a laser. Left as it came out.', spec: ['fine.ra'] },
  'layer-printed': { what: 'Plastic laid down in beads by a 3D printer. The layers stay visible.', spec: ['fine.ra'] },
  'trowelled-plaster': { what: 'A skim coat floated on by hand and sanded back. The passes of the float stay in it, very shallow.' },
  'soft-touch-lacquer': { what: 'A rubbery lacquer sprayed over plastic. Its fine values are set to reach a published gloss.', spec: ['pattern.size'] },

  'matte-paint': { what: 'Sprayed or screened paint with a flat binder.' },
  'metallic-paint': { what: 'Satin paint with aluminium flake in it, which sparkles as it turns.' },
  'flowed-film': { what: 'A liquid that levelled and cured smooth: solder mask, tape, label film. Peel wavelength from paint data.', spec: ['broad.wave'] },
  'textured-paint': { what: 'A soft-grained panel paint, sprayed thick and left to run together.' },
  'powder-coat': { what: 'Dry powder sprayed on and baked. It flows into a coarse texture.' },
  'clear-lacquer': { what: 'Coats of clear flatted and polished. Peel is the published 1 µm over 3 mm.', spec: ['broad.wave', 'broad.height'] },
  'brushed-enamel': { what: 'Enamel laid on by hand. Brush marks stay under the gloss.' },

  'bead-blast': { what: 'Blasted with glass beads, usually before anodising.', spec: ['fine.ra'] },
  'bead-blast-coarse': { what: 'Blasted with a coarser bead, so the sparkle shows at arm\'s length.' },
  'brushed-metal': { what: 'Drawn across a 150 grit belt, so the scratches all run one way. The grain on sheet and panels.', spec: ['fine.ra'] },
  'brushed-metal-coarse': { what: 'Drawn across an 80 grit belt, leaving scratches you can see from across a room.' },
  'brushed-metal-fine': { what: 'Drawn across a 400 grit belt, as on a watch case, so the lines only show up close.', spec: ['fine.ra'] },
  'satin-metal': { what: 'Plate left dull by a blasted or scratched base.' },
  'buffed-metal': { what: 'Buffed on a wheel with compound. Bright, with a slight haze.' },
  'polished-metal': { what: 'Polished until nothing below a wavelength of light is left. The claim is a mirror.' },
  'lacquered-metal': { what: 'Buffed on a wheel, then coated in clear lacquer that levels what is left, as on a brass instrument.' },
  'sand-cast': { what: 'Poured into a sand mould and left as cast.', spec: ['fine.ra'] },
  'hot-foil': { what: 'Metal film pressed on with a heated die.' },
  'embossed-foil': { what: 'Foil embossed with a repeating relief that splits light.' },
  'knurled': { what: 'A crossed pattern rolled into the metal by a hard wheel.' },
  'roll-formed': { what: 'Sheet passed through shaped rollers into ribs.' },
  'perforated': { what: 'Sheet punched through with a hexagonal pattern.' },

  'moulded-rubber': { what: 'Pressed or injected in a matt tool.', spec: ['fine.ra'] },

  'glazed': { what: 'Fired with a glass glaze, which leaves a few pinholes and a slow wave.', spec: ['fine.ra'] },
  'unglazed': { what: 'Fired with no glaze. The body is the surface.' },
  'float-glass': { what: 'Floated on molten tin, which leaves it flat and fire-polished. The claim is no structure at all.' },
  'reeded-glass': { what: 'Pressed in a mould into ribs that throw light sideways. Pitch read off a photo of a viewfinder.', measured: ['pattern.size'] },
  'etched-glass': { what: 'Etched to a frost with acid, as on anti-glare panels.', spec: ['fine.ra', 'fine.spacing'] },

  'knitted-cloth': { what: 'Yarn knitted into loops. The fibre gives the sheen.' },
  'woven-fibre': { what: 'Fibre tows woven in a twill and set in resin. Tow size is published.', spec: ['pattern.size'] },
  'pressed-felt': { what: 'Loose fibre matted under heat and pressure. No weave.' },
  'electrostatic-flock': { what: 'Short fibres shot end on into glue by a charge, as inside a lens barrel. It follows what it lines.' },
  'basket-weave': { what: 'Coated yarn woven in a basket for a speaker baffle. Pitch read off a photo.', measured: ['pattern.size'] },
  'book-cloth': { what: 'Fine cotton weave filled with starch and calendered flat, to go round a board.' },

  'oiled-wood': { what: 'Sanded and oiled, so the grain stays open. Vessel width is published.', spec: ['pattern.size'] },
  'lacquered-wood': { what: 'Sanded, filled and lacquered to a shine. Vessel width and polished Ra are published.', spec: ['pattern.size', 'fine.ra'] },
  'tanned-leather': { what: 'Tanned hide with a pressed grain, as on a watch strap or a bag.' },
  'smooth-calf': { what: 'Pressed calf with a far finer grain, as on the lid of a good camera.' },
  'pressed-vulcanite': { what: 'Hard cured rubber pressed against a goatskin die. Cell size read off a photo.', measured: ['pattern.size'] },
  'pressed-vinyl': { what: 'Vinyl cloth rolled against an engraved plate and glued round a cabinet. Cell size read off a photo.', measured: ['pattern.size'] },
  'sanded-cork': { what: 'Cork bark ground to a face. Its cells open at the surface.' },
  'polished-stone': { what: 'Ground and polished. The veins go through the stone.', spec: ['fine.ra'] },
  'honed-stone': { what: 'Ground flat and left dull.' },
  'ground-terrazzo': { what: 'Chips cast in a binder and ground flat.', spec: ['fine.ra'] },
  'cast-concrete': { what: 'Poured against a form. Air leaves bug holes in the face.' },
  'cleft-stone': { what: 'Split along its bed, not cut.' },
  'wire-cut-brick': { what: 'Clay pushed out in a column, cut with wire and fired. The wire drags the face.' },
  'struck-mortar': { what: 'Sand in lime, pressed into a joint and struck off with a trowel.' },
  'embossed-linen': { what: 'Card rolled between engraved plates after printing, then varnished, so a weave runs through the print too.', measured: ['pattern.size'] },
  'uncoated-paper': { what: 'Pressed fibre with no coating. The fibres lie mostly one way.' },
  'coated-board': { what: 'Board with a clay coat rolled on, printed flat. Smooth, with the cockle of the board under it.' },
  'pressed-pulp': { what: 'Cheap board cut in strips. Its long fibres show as streaks.' },
  'dipped-crust': { what: 'Dipped wet and dried crusty, as a match head.' },
  'grit-coat': { what: 'Grit spread in a binder and dried, as a striker or fine sandpaper.' },

  'still': { what: 'A liquid at rest. Nothing at any size.' },
};

export interface FinishRow {
  size: 'broad' | 'pattern' | 'fine';
  /** `none` on a row with no values is the finish's claim that nothing is there. */
  none?: true;
  shape?: string;
  /** Share of the fine structure that runs one way, 0 to 1. */
  dir?: number;
  values: { label: string; value: Value; mm: number; mark: Mark }[];
}

const markOf = (s: Source, v: Value): Mark => (s.spec?.includes(v) ? 'spec' : s.measured?.includes(v) ? 'measured' : 'guess');

/** What a finish does, and every number in it with where it came from. */
export function finishSheet(name: FinishName): { what: string; rows: FinishRow[]; coat: number; rough: number } {
  const f: Finish = FINISHES[name], s = SOURCES[name];
  const val = (label: string, value: Value, mm: number) => ({ label, value, mm, mark: markOf(s, value) });
  const rows: FinishRow[] = [
    f.broad === 'none' ? { size: 'broad', none: true, values: [] }
      : { size: 'broad', values: [val('wave', 'broad.wave', f.broad.wave), val('high', 'broad.height', f.broad.height)] },
    f.pattern === 'none' ? { size: 'pattern', none: true, values: [] }
      : { size: 'pattern', shape: f.pattern.shape, values: [val('size', 'pattern.size', f.pattern.size), val('deep', 'pattern.depth', f.pattern.depth)] },
    f.fine === 'none' ? { size: 'fine', none: true, values: [] }
      : { size: 'fine', ...(f.fine.dir && { dir: f.fine.dir }), values: [val('Ra', 'fine.ra', f.fine.ra), val('spacing', 'fine.spacing', f.fine.spacing)] },
  ];
  return { what: s.what, rows, coat: f.coat ?? 0, rough: roughOf(f.fine) };
}

/** Plain lines on what a substance does, in the order the page shows them. */
export const SUBSTANCE_NOTES: Partial<Record<Substance, string>> = {
  metal: 'No body colour of its own: it reflects the room, tinted. Rubbing chips what is on it down to what is under it.',
  paint: 'A thin layer over something else. It chips down through its coats to what it was painted on.',
  plastic: 'Light goes a little way in and comes back, so colour sits under the surface. Rubbing polishes it.',
  rubber: 'Soft, with a sheen at a glancing angle. Handling makes it shiny.',
  ceramic: 'A fired body, usually under glass. It chips.',
  glass: 'Mostly reflection. It does not wear in any way shown here, but it takes fingerprints.',
  stone: 'Colour goes all the way through. Rubbing polishes it.',
  wood: 'Grain and pores come from growth, set by ring width and how open the pores are. It burnishes with use.',
  leather: 'A hide, so its grain is uneven. It burnishes with use.',
  cloth: 'Fibres catch light at a glancing angle. It takes no marks and does not wear here.',
  paper: 'Pressed fibre. It takes few marks and does not wear here.',
};

/** Substances in the order to read them. */
export const SUBSTANCE_ORDER: Substance[] = ['metal', 'paint', 'plastic', 'rubber', 'ceramic', 'glass', 'stone', 'wood', 'leather', 'cloth', 'paper', 'liquid'];

export interface Recipe {
  /** What its colourways share in their names, or its own name if it has none. */
  name: string;
  substance: Substance;
  finish: FinishName;
  /** Each colour of it, by full material name, in library order. */
  colours: string[];
  /** Values this recipe sets over its finish, other than colour. */
  over: Record<string, unknown>;
}

// All of this is colour, and what colour turns into or wears down to. Everything else is the recipe.
const COLOUR = new Set(['color', 'color2', 'legend', 'sub', 'under', 'patina', 'patinaRough', 'coatTint', 'text']);
const WHAT = new Set(['substance', 'finish']);

const stem = (name: string) => name.includes('-') ? name.slice(0, name.lastIndexOf('-')) : name;
const fingerprint = (m: MaterialDef) => JSON.stringify(Object.entries(m).filter(([k]) => !COLOUR.has(k)).sort(([a], [b]) => (a < b ? -1 : 1)));

/**
 * The library as recipes. Materials whose names share a stem and that differ only in colour are one
 * recipe in several colours, however they were written down.
 */
export function recipes(table: Record<string, MaterialSpec>): Recipe[] {
  const by = new Map<string, Recipe>();
  for (const [name, m] of Object.entries(table)) {
    const key = `${stem(name)} ${fingerprint(m)}`, found = by.get(key);
    if (found) {
      found.colours.push(name);
      continue;
    }
    const over = Object.fromEntries(Object.entries(m).filter(([k]) => !COLOUR.has(k) && !WHAT.has(k)));
    by.set(key, { name, substance: m.substance!, finish: m.finish!, colours: [name], over });
  }
  return [...by.values()].map(r => (r.colours.length > 1 ? { ...r, name: stem(r.name) } : r));
}
