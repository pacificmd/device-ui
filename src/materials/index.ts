import { defineMaterials, type MaterialDef, type Vec3 } from 'device-ui';

export interface MaterialSpec extends MaterialDef {
  /** Colour of text shown live on this material, such as an LCD's digits. */
  text?: string;
}

// Zinc primer over aluminium, as on anything built to fly.
const PRIMED = [{ color: '#8f9a82', rough: 0.7, metal: 0 }, { color: '#b9bbbe', rough: 0.42 }];

// Skin of a tool the plastic was shot into: no paint, no clear coat, just a fine even texture.
const moulded = (color: string, legend: string, patina?: string): MaterialSpec =>
  ({ substance: 'plastic', finish: 'stoned-mould', color, legend, ...(patina && { patina, patinaRough: 0.5 }) });
// Satin paint with metal flake in it. The flake gives it a little of a metal's highlight, in its own colour.
const flaked = (color: string, legend: string): MaterialSpec => ({ substance: 'paint', finish: 'metallic-paint', color, legend, metal: 0.35 });
const holo = (color: string, legend: string): MaterialDef => ({ substance: 'metal', finish: 'hot-foil', color, grating: 1, legend });
// A film printed in flat colour, laid on a panel.
const film = (color: string, legend: string): MaterialSpec => ({ substance: 'plastic', finish: 'polished-mould', color, legend, rough: 0.34 });
// A rubbery lacquer over plastic. It has a velvety sheen and it goes shiny with handling.
const softTouch = (color: string, legend: string, sub: string): MaterialSpec =>
  ({ substance: 'rubber', finish: 'soft-touch-lacquer', color, legend, sub });
// Board with a clay coat, printed solid on the one side: what's cut or folded shows the pale board under it, as `sub`.
const card = (color: string, legend: string, sub = '#e9e4d6'): MaterialSpec => ({ substance: 'paper', finish: 'coated-board', color, legend, sub });
/** Printed vinyl label stock: colour on a white film, under a clear coat. */
const stock = (color: string, legend: string, over: Partial<MaterialSpec> = {}): MaterialSpec => ({ substance: 'plastic', finish: 'flowed-film', color, coat: 0.7, legend, wears: 'chip', under: [{ color: '#e4e2dc', rough: 0.7, metal: 0 }], ...over });
const pulp = (color: string, legend: string): MaterialSpec => ({ substance: 'paper', finish: 'pressed-pulp', color, legend });
const dipped = (color: string, legend: string): MaterialSpec => ({ substance: 'stone', finish: 'dipped-crust', color, legend });
// A skim of plaster, painted or stained through.
const bound = (color: string, legend = '#e8dcc2'): MaterialSpec => ({ substance: 'cloth', finish: 'book-cloth', color, legend });
const plaster = (color: string, legend: string): MaterialSpec => ({ substance: 'stone', finish: 'trowelled-plaster', color, legend });

// A material is what it is, how it was made and what colour it came out: substance, finish, colour.
// Structure lives in the finish. A `rough` here is this one thing differing from its process.
export const materials: Record<string, MaterialSpec> = {
  'anodised-slate': { substance: 'metal', finish: 'bead-blast', color: '#565654', sub: '#a9abae', patina: '#3c3a38', patinaRough: 0.6 },
  'anodised-graphite': { substance: 'metal', finish: 'bead-blast', color: '#303236', sub: '#a9abae', patina: '#3c3a38', patinaRough: 0.6 },
  'anodised-oxide': { substance: 'metal', finish: 'bead-blast', color: '#7a2e1f', sub: '#b6b8ba', patina: '#6b4436', patinaRough: 0.62 },
  'brushed-aluminium': { substance: 'metal', finish: 'brushed-metal', color: '#f4f5f6', legend: '#17181a', patina: '#8f8d88', patinaRough: 0.6 },
  'brushed-aluminium-dull': { substance: 'metal', finish: 'brushed-metal', color: '#a9aaaa', legend: '#17181a', patina: '#6f6d68', patinaRough: 0.6 },
  'brushed-steel': { substance: 'metal', finish: 'brushed-metal', color: '#c1bebb', legend: '#141517', patina: '#5e3119', patinaRough: 0.85 },
  'coarse-brushed-steel': { substance: 'metal', finish: 'brushed-metal-coarse', color: '#c1bebb', legend: '#141517', patina: '#5e3119', patinaRough: 0.85 },
  'enamel-cream': { substance: 'paint', finish: 'brushed-enamel', color: '#e2d8bd', rough: 0.3, under: [{ color: '#6d7470', rough: 0.72, metal: 0 }, { color: '#7d7b78', rough: 0.46 }], legend: '#2b2925', patina: '#c2ad7c', patinaRough: 0.5 },
  'paint-olive': { substance: 'paint', finish: 'powder-coat', color: '#59603f', under: [{ color: '#7a3b28', rough: 0.76, metal: 0 }, { color: '#8d8d88', rough: 0.48 }], patina: '#7d7e62', patinaRough: 0.8 },
  bakelite: { substance: 'plastic', finish: 'polished-mould', color: '#2a1810', rough: 0.26, coat: 0.7, mottle: 0.85, fleck: 0.25, sub: '#1a0f0a' },
  chrome: { substance: 'metal', finish: 'polished-metal', color: '#c5c4c4', rough: 0.09, legend: '#141517', patina: '#8f8a80', patinaRough: 0.5 },
  // Sheet aluminium brushed and dyed gold, as on an amplifier's panel. Colour measured on a photo, brightened for its age.
  'anodised-gold': { substance: 'metal', finish: 'brushed-metal', color: '#d8b769', rough: 0.34, aniso: 0.5, legend: '#1c1710' },
  // Yellow brass, buffed and clear-lacquered, as on a wind instrument. An engraver's cut holds dirt and shadow under the lacquer, so it reads dark. The tint is the lacquer's.
  // Lacquer is rubbed through by hands, not knocked off in flakes, and under it is the same brass, so it wears by polishing: `sub` is the cut's colour, not what a chip would show.
  'lacquered-brass': { substance: 'metal', finish: 'lacquered-metal', color: '#fbe2a0', rough: 0.09, coat: 1, coatTint: '#fff4d6', legend: '#3a2a10', sub: '#5a4018', wears: 'polish' },
  // The bright white metals an instrument's slides and mouthpiece are made of.
  'nickel-silver': { substance: 'metal', finish: 'polished-metal', color: '#d6d2c2', rough: 0.1, legend: '#141517', patina: '#7c7a68', patinaRough: 0.5 },
  'silver-plate': { substance: 'metal', finish: 'polished-metal', color: '#e8e6e0', rough: 0.07, legend: '#141517', patina: '#3f3d3a', patinaRough: 0.5 },
  // Mother of pearl, cut flat and polished: a thin film of its own layers over white.
  'mother-of-pearl': { substance: 'plastic', finish: 'polished-mould', color: '#efe8dc', rough: 0.14, film: 0.3, filmVary: 0.9, mottle: 0.15, legend: '#3a342c', sub: '#f4e7e0' },
  brass: { substance: 'metal', finish: 'brushed-metal', color: '#f5e5ad', rough: 0.3, aniso: 0.5, legend: '#1c1710', patina: '#4f5a3f', patinaRough: 0.66 },
  'black-oxide': { substance: 'metal', finish: 'bead-blast', color: '#17181a' },
  well: { substance: 'plastic', finish: 'moulded-stipple', color: '#0b0b0c' },
  rubber: { substance: 'rubber', finish: 'moulded-rubber', color: '#1a1a1c', rough: 0.74 },
  'keycap-ivory': { substance: 'plastic', finish: 'bead-mould', color: '#d9d2bf', legend: '#25231f', patina: '#c9ae6e', patinaRough: 0.42 },
  'keycap-white': { substance: 'plastic', finish: 'bead-mould', color: '#ebe8df', legend: '#25231f', patina: '#c9ae6e', patinaRough: 0.42 },
  'keycap-dove': { substance: 'plastic', finish: 'bead-mould', color: '#c8c5bc', legend: '#2c2b28', patina: '#c9ae6e', patinaRough: 0.42 },
  'keycap-slate': { substance: 'plastic', finish: 'bead-mould', color: '#a7adb4', legend: '#25231f' },
  'keycap-grey': { substance: 'plastic', finish: 'bead-mould', color: '#55585c', legend: '#ece9df' },
  'keycap-black': { substance: 'plastic', finish: 'bead-mould', color: '#1c1d20', legend: '#e6e3da' },
  'keycap-red': { substance: 'plastic', finish: 'bead-mould', color: '#a22a1e', legend: '#f3ece0' },
  'keycap-teal': { substance: 'plastic', finish: 'bead-mould', color: '#3f8ba3', legend: '#e9e6d6' },
  'keycap-umber': { substance: 'plastic', finish: 'bead-mould', color: '#38312d', legend: '#eeeadf' },
  'keycap-putty': { substance: 'plastic', finish: 'bead-mould', color: '#c8c2a4', legend: '#25231f' },
  'keycap-butter': { substance: 'plastic', finish: 'bead-mould', color: '#e6c56f', legend: '#25231f' },
  'keycap-apricot': { substance: 'plastic', finish: 'bead-mould', color: '#e5933a', legend: '#25231f' },
  'keycap-taupe': { substance: 'plastic', finish: 'bead-mould', color: '#a3977f', legend: '#25231f' },
  'keycap-navy': { substance: 'plastic', finish: 'bead-mould', color: '#3c4a78', legend: '#eef0f4' },
  'keycap-marigold': { substance: 'plastic', finish: 'bead-mould', color: '#e7ad35', legend: '#2b2418' },
  'keycap-jade': { substance: 'plastic', finish: 'bead-mould', color: '#3a9468', legend: '#f2f4ec' },
  'lcd-amber': { substance: 'glass', finish: 'etched-glass', color: '#070402', coat: 0.3, emit: [0.007, 0.0026, 0.0004], text: '#ffb340' },
  'lcd-green': { substance: 'glass', finish: 'etched-glass', color: '#8f9a6c', coat: 0.7, emit: [0.05, 0.056, 0.03], text: '#1e2412' },
  // Reflective twisted nematic with no backlight: a dull olive with the room's light coming back off a foil.
  'lcd-olive': { substance: 'glass', finish: 'etched-glass', color: '#6f7a38', coat: 0.5, emit: [0.016, 0.02, 0.005], text: '#1e2412' },
  // A reflective panel with no backlight: a silver mirror behind the crystal, so it's as bright as the room.
  'lcd-memory': { substance: 'glass', finish: 'etched-glass', color: '#b4b3a9', coat: 0.12, text: '#1b1b1a' },
  // Supertwist panels: grey under the room's light, whatever colour their backlight is, and their crystals dark blue-black.
  'lcd-silver': { substance: 'glass', finish: 'etched-glass', color: '#a9ad95', coat: 0.35, rough: 0.5, emit: [0.012, 0.013, 0.01], text: '#14181c' },
  // The printed glass over a handheld's digitiser, a shade off the panel beside it.
  'lcd-sage': { substance: 'glass', finish: 'etched-glass', color: '#a6bdb3', coat: 0.2, rough: 0.5, text: '#16221f' },
  'lcd-pewter': { substance: 'glass', finish: 'etched-glass', color: '#8a8574', coat: 0.15, rough: 0.5, emit: [0.008, 0.008, 0.007], text: '#1a120e' },
  // A watch's glass: a plain mirror behind a polariser, grey as pencil and lit by the room.
  'lcd-grey': { substance: 'glass', finish: 'etched-glass', color: '#9c9d94', coat: 0.1, rough: 0.55, text: '#0e1012' },
  'lcd-blue': { substance: 'glass', finish: 'etched-glass', color: '#02060c', coat: 0.45, emit: [0.002, 0.009, 0.018], text: '#8ad2ff' },
  'glass-red': { substance: 'glass', finish: 'float-glass', color: '#4a0805', rough: 0.14, coat: 1 },
  'glass-smoked-red': { substance: 'glass', finish: 'float-glass', color: '#1c0304', rough: 0.14, coat: 1 },
  'smoked-glass': { substance: 'glass', finish: 'float-glass', color: '#0a0a0b', rough: 0.2, coat: 0.9 },
  'plastic-red': moulded('#b5261b', '#f4ece0', '#9c4a3a'),
  'plastic-oxblood': moulded('#7a141b', '#f4ece0', '#7a3a34'),
  'plastic-navy': moulded('#23457a', '#e6ecf4', '#4a5f80'),
  'plastic-ash': moulded('#696d72', '#ece9df', '#8a8a86'),
  'plastic-dove': moulded('#7f8388', '#20232a', '#9a9a96'),
  'film-white': film('#e8e6e0', '#26262a'),
  'film-navy': film('#12264f', '#e9edf5'),
  'film-oxide': film('#17120e', '#e9edf5'),
  'film-sunflower': film('#ffcf10', '#1c1608'),
  'film-flame': film('#e8501c', '#fff0e4'),
  'film-tangerine': film('#f08a20', '#16100a'),
  'film-scarlet': film('#d8341a', '#16100a'),
  'film-sky': film('#1f8ad0', '#ffe23a'),
  'film-teal': film('#1fae97', '#eef6ee'),
  'film-salmon': film('#d9806f', '#2a1612'),
  'film-lavender': film('#8f93c2', '#191a2c'),
  'film-tan': film('#c79b6e', '#23180d'),
  'plastic-orange': moulded('#d9681a', '#20140a', '#b97a48'),
  'plastic-yellow': moulded('#e3b021', '#1d1707', '#b89a4e'),
  'plastic-sunflower': moulded('#ffc20d', '#1d1707', '#b89a4e'),
  'plastic-green': moulded('#2d7a41', '#eef0e2', '#5e7d5c'),
  'plastic-blue': moulded('#1f4fa3', '#e6ecf4', '#4f6a95'),
  'plastic-berry': moulded('#6a1842', '#f3e6ec', '#7f4a64'),
  'plastic-purple': moulded('#4f2386', '#e9e03c'),
  // Bright key and knob colours for instruments.
  'plastic-scarlet': moulded('#de2c12', '#fff1e8'),
  'plastic-tangerine': moulded('#f27c12', '#22160a'),
  'plastic-lemon': moulded('#e7df22', '#1d1b07'),
  'plastic-flame': moulded('#ee5518', '#fff1e8'),
  'plastic-sky': moulded('#2191d8', '#eef6fc'),
  'plastic-leaf': moulded('#2fae4a', '#eef8f0'),
  'plastic-teal': moulded('#3aa68f', '#eef8f0'),
  'plastic-mint': moulded('#7fc4c2', '#17302f'),
  'plastic-lilac': moulded('#a9a8cf', '#2a2940'),
  'plastic-white': moulded('#e5e3dd', '#232220', '#d1bd86'),
  'plastic-black': { ...moulded('#16161a', '#e6e3da'), sub: '#4c4a48' },
  'plastic-black-gloss': { substance: 'plastic', finish: 'polished-mould', color: '#0c0c0e', legend: '#e6e3da', sub: '#4c4a48' },
  'plastic-black-stippled': { substance: 'plastic', finish: 'moulded-stipple', color: '#141416', legend: '#e6e3da', sub: '#4c4a48' },
  'shell-white': { substance: 'plastic', finish: 'moulded-stipple', color: '#e6e5e0', legend: '#232220', sub: '#c8c7c2' },
  'shell-black': { substance: 'plastic', finish: 'moulded-stipple', color: '#17171a', legend: '#e6e3da', sub: '#4c4a48' },
  // Office-machine plastic before the sun gets to it, grey-beige rather than cream.
  'shell-beige': { substance: 'plastic', finish: 'moulded-stipple', color: '#d3c7a6', legend: '#2a2620', sub: '#b8ab88', patina: '#c9ae6e', patinaRough: 0.55 },
  // A phone's cover and the painted band on it.
  'resin-black': { substance: 'plastic', finish: 'bead-mould', color: '#1b1b1d', legend: '#e6e5e0', sub: '#4c4a48' },
  'shell-cream': { substance: 'plastic', finish: 'moulded-stipple', color: '#ddd5ba', legend: '#2a2620', sub: '#c2b998', patina: '#c9ae6e', patinaRough: 0.55 },
  'shell-biscuit': { substance: 'plastic', finish: 'moulded-stipple', color: '#b9ad85', legend: '#2a2620', sub: '#a0946c', patina: '#b89a5a', patinaRough: 0.55 },
  'shell-taupe': { substance: 'plastic', finish: 'moulded-stipple', color: '#c2b6a9', legend: '#2a2620', sub: '#a59a8d', patina: '#c9ae6e', patinaRough: 0.55 },
  'shell-navy': { substance: 'plastic', finish: 'bead-mould', color: '#35425e', legend: '#e6e5e0', sub: '#5a6478' },
  'shell-charcoal': { substance: 'plastic', finish: 'moulded-stipple', color: '#3c3c3e', legend: '#dcdbd5', sub: '#5a5a5c' },
  'shell-slate': { substance: 'plastic', finish: 'moulded-stipple', color: '#505053', legend: '#e4e3dc', sub: '#6c6c6e' },
  'shell-snow': { substance: 'plastic', finish: 'bead-mould', color: '#e8e7e3', legend: '#232220', sub: '#c8c7c2' },
  'paint-metallic-green': flaked('#2e3a2a', '#d9dccd'),
  'paint-metallic-grey': flaked('#5c5f66', '#1c1e22'),
  'paint-silver': { substance: 'paint', finish: 'matte-paint', color: '#b8b8b0', legend: '#1a1d26' },
  'shell-grey': { substance: 'plastic', finish: 'moulded-stipple', color: '#a9a7a2', legend: '#2a2d73', sub: '#8d8b86', patina: '#c9b68a', patinaRough: 0.55 },
  'grip-white': { substance: 'plastic', finish: 'moulded-dots', color: '#e2e1dc', legend: '#232220', sub: '#c8c7c2' },
  'grip-black': { substance: 'plastic', finish: 'moulded-dots', color: '#141417', legend: '#e6e3da', sub: '#4c4a48' },
  // Black enamel baked on cast iron and flatted between coats, as on old machine tools and sewing machines. It chips back to the grey iron.
  'japan-black': { substance: 'paint', finish: 'clear-lacquer', color: '#060607', legend: '#d3b267', under: [{ color: '#55524d', rough: 0.62 }] },
  'lacquer-black': { substance: 'paint', finish: 'clear-lacquer', color: '#0a0a0c', legend: '#e6e3da', under: [{ color: '#c79f54', rough: 0.3 }] },
  'dial-black': { substance: 'paint', finish: 'matte-paint', color: '#0d0e10', legend: '#e7e4d9' },
  'dial-white': { substance: 'paint', finish: 'matte-paint', color: '#e4e1d8', legend: '#16150f', patina: '#cdb98c', patinaRough: 0.6 },
  'dial-cream': { substance: 'paint', finish: 'matte-paint', color: '#dcc690', legend: '#1c160a', patina: '#b89a62', patinaRough: 0.6 },
  paper: { substance: 'paper', finish: 'uncoated-paper', color: '#e6e0cd', legend: '#26231c', patina: '#c9b488', patinaRough: 0.85 },
  'card-manila': { substance: 'paper', finish: 'uncoated-paper', color: '#dcc896', legend: '#4f4227', sub: '#c4ae7a' },
  'paper-black': { substance: 'paper', finish: 'uncoated-paper', color: '#131314' },
  'card-white': card('#ece7da', '#26231c'),
  'card-grey': card('#c9c2b0', '#26231c'),
  'card-green': card('#1d3b34', '#eadfc4'),
  'card-oxblood': card('#5c1420', '#eadfc4'),
  // What's pulled out of a comb: board dyed through, so what tears shows the same colour, fibres and all.
  'pulp-coral': pulp('#c8434f', '#26231c'),
  'pulp-ash': pulp('#6f6a64', '#26231c'),
  'pulp-char': pulp('#141211', '#d8d3c8'),
  'head-tan': dipped('#8e7a53', '#26231c'),
  'head-spent': dipped('#26221f', '#d8d3c8'),
  // Red phosphorus and ground glass in a binder. Dark brown, with a glitter of glass in it.
  striker: { substance: 'stone', finish: 'grit-coat', color: '#33271f', legend: '#d8d3c8' },
  tape: { substance: 'plastic', finish: 'flowed-film', color: '#160d09', rough: 0.34, aniso: 0.5, tangent: 1.57 },
  needle: { substance: 'plastic', finish: 'bead-mould', color: '#c8331c', rough: 0.4 },
  'dymo-black': { substance: 'plastic', finish: 'flowed-film', color: '#111114', rough: 0.3, legend: '#f2f1ec' },
  'dymo-red': { substance: 'plastic', finish: 'flowed-film', color: '#a81f1b', rough: 0.3, legend: '#f2f1ec' },
  'dymo-blue': { substance: 'plastic', finish: 'flowed-film', color: '#1c3f8f', rough: 0.3, legend: '#f2f1ec' },

  // Silk-screened enamel on a steel panel.
  'paint-blue': { substance: 'paint', finish: 'matte-paint', color: '#2f86c0', legend: '#f0efe9', under: PRIMED },
  'paint-graphite': { substance: 'paint', finish: 'matte-paint', color: '#3a3a38', legend: '#d8d7cf' },
  'paint-panel-black': { substance: 'paint', finish: 'textured-paint', color: '#161616', legend: '#dcdad2' },
  'paint-panel-umber': { substance: 'paint', finish: 'matte-paint', color: '#2c2522', legend: '#d8d3c4' },
  'paint-panel-charcoal': { substance: 'paint', finish: 'matte-paint', color: '#2b2c2f', legend: '#dcdad2' },
  'paint-panel-putty': { substance: 'paint', finish: 'matte-paint', color: '#bcc0bd', legend: '#25262a' },
  'paint-panel-tan': { substance: 'paint', finish: 'matte-paint', color: '#c8b292', legend: '#25262a' },
  'paint-panel-slate': { substance: 'paint', finish: 'matte-paint', color: '#8c9498', legend: '#25262a' },
  'paint-panel-steel': { substance: 'paint', finish: 'matte-paint', color: '#a0a3a3', legend: '#25262a' },
  'paint-panel-blue': { substance: 'paint', finish: 'matte-paint', color: '#2f5f8e', legend: '#e9e8e0' },
  'paint-panel-bluegrey': { substance: 'paint', finish: 'matte-paint', color: '#3a4750', legend: '#e2e2db' },
  'plastic-moss': { substance: 'plastic', finish: 'bead-mould', color: '#555c52', legend: '#e6e3da' },
  'paint-charcoal': { substance: 'paint', finish: 'matte-paint', color: '#1b1b1a', legend: '#d8d7cf' },
  // Machined and blasted metal, as on a laptop or a watch.
  'aluminium-mill': { substance: 'metal', finish: 'bead-blast', color: '#bdbab0', legend: '#17181a', patina: '#8f8d88', patinaRough: 0.6 },
  // Chromate conversion rather than anodising, as on flight hardware of the sixties: a dull grey-gold film on bare blasted metal.
  'aluminium-chromate': { substance: 'metal', finish: 'bead-blast', color: '#8c8c84', legend: '#1b1c1e', sub: '#e8e8e8', patina: '#6f6c5e', patinaRough: 0.6 },
  'aluminium-pale': { substance: 'metal', finish: 'bead-blast', color: '#dbdbd8', legend: '#1b1c1e', sub: '#efefed' },
  'aluminium-silver': { substance: 'metal', finish: 'bead-blast', color: '#f4f5f6', legend: '#1b1c1e', sub: '#e8e8e8' },
  'aluminium-space': { substance: 'metal', finish: 'bead-blast', color: '#55565a', legend: '#ecebe8', sub: '#c9c9cb' },
  'aluminium-face': { substance: 'metal', finish: 'bead-blast-coarse', color: '#55565a', legend: '#ecebe8', sub: '#c9c9cb' },
  'aluminium-face-silver': { substance: 'metal', finish: 'bead-blast-coarse', color: '#f0f0ef', legend: '#3a3b3e', sub: '#e0e0e1' },
  'aluminium-midnight': { substance: 'metal', finish: 'bead-blast', color: '#232a3a', legend: '#dfe3ea', sub: '#a7adb8' },
  'aluminium-blue': { substance: 'metal', finish: 'bead-blast', color: '#2c5a88', legend: '#dfe3ea', sub: '#b4c0cf' },
  'aluminium-azure': { substance: 'metal', finish: 'bead-blast', color: '#4d9fea', legend: '#f6f8fb', sub: '#b4c8dc' },
  'aluminium-slate': { substance: 'metal', finish: 'bead-blast', color: '#555b66', legend: '#ecebe8', sub: '#c2c6cc' },
  'aluminium-sage': { substance: 'metal', finish: 'bead-blast', color: '#7f8b77', legend: '#1b1e19', sub: '#d3d6d0' },
  'aluminium-rose': { substance: 'metal', finish: 'bead-blast', color: '#d4a998', legend: '#2a1d18', sub: '#ecd9d1' },
  'aluminium-ice': { substance: 'metal', finish: 'bead-blast', color: '#b4e0e8', legend: '#23282a', sub: '#b6b8ba', patina: '#6d8a90', patinaRough: 0.6 },
  'aluminium-pink': { substance: 'metal', finish: 'bead-blast', color: '#f778b4', legend: '#2a1a22', sub: '#b6b8ba', patina: '#8a4a68', patinaRough: 0.6 },
  'aluminium-lime': { substance: 'metal', finish: 'bead-blast', color: '#b4d63a', legend: '#1b1e19', sub: '#d9dfc4' },
  'aluminium-gold': { substance: 'metal', finish: 'bead-blast', color: '#d8b872', legend: '#2a2110', sub: '#ece0c0' },
  'aluminium-purple': { substance: 'metal', finish: 'bead-blast', color: '#8a4fd0', legend: '#f3ecfa', sub: '#d8c8ec' },
  'aluminium-red': { substance: 'metal', finish: 'bead-blast', color: '#d8232f', legend: '#fbe9ea', sub: '#f0c0c3' },
  'aluminium-orange': { substance: 'metal', finish: 'bead-blast', color: '#f58a1f', legend: '#2a1806', sub: '#f8dcbc' },
  'aluminium-yellow': { substance: 'metal', finish: 'bead-blast', color: '#f4d320', legend: '#262006', sub: '#f6ecb8' },
  'aluminium-mint': { substance: 'metal', finish: 'bead-blast', color: '#c6e0bb', legend: '#1b1e19', sub: '#e3ece0' },
  'aluminium-sky': { substance: 'metal', finish: 'bead-blast', color: '#2cc0f5', legend: '#10242e', sub: '#bfe3f3' },
  'aluminium-green': { substance: 'metal', finish: 'bead-blast', color: '#9ad81e', legend: '#1c2608', sub: '#dcecb6' },
  // Polished before it's dyed, so the colour is a mirror: the 2009 nano's.
  'aluminium-purple-polished': { substance: 'metal', finish: 'polished-metal', color: '#7a2ad8', rough: 0.26, legend: '#efe6fb', sub: '#d3c1ee' },
  'aluminium-orange-polished': { substance: 'metal', finish: 'polished-metal', color: '#ff7a10', rough: 0.26, legend: '#2a1806', sub: '#fbd6b0' },
  'aluminium-blue-polished': { substance: 'metal', finish: 'polished-metal', color: '#1a7ae8', rough: 0.26, legend: '#e6f0fb', sub: '#bcd6f3' },
  'aluminium-green-polished': { substance: 'metal', finish: 'polished-metal', color: '#3fbf2a', rough: 0.26, legend: '#0e2a08', sub: '#cdeec2' },
  'aluminium-silver-polished': { substance: 'metal', finish: 'polished-metal', color: '#dfe1e3', rough: 0.26, legend: '#26272a', sub: '#eceded' },
  'aluminium-pink-polished': { substance: 'metal', finish: 'polished-metal', color: '#ff2a9d', rough: 0.26, legend: '#fbe6f1', sub: '#f7c6dd' },
  titanium: { substance: 'metal', finish: 'bead-blast', color: '#cec9c3', legend: '#191816', sub: '#c2bfba' },
  'natural-titanium': { substance: 'metal', finish: 'brushed-metal-fine', color: '#cec9c3', legend: '#191816', sub: '#d2cec6' },
  'titanium-black': { substance: 'metal', finish: 'bead-blast', color: '#26262a', rough: 0.34, legend: '#e6e4df', sub: '#8e8a84' },
  'titanium-burnt': { substance: 'metal', finish: 'brushed-metal-fine', color: '#aea79c', rough: 0.3, film: 0.32, filmVary: 0.75, legend: '#121212', aniso: 0.4 },
  'oil-slick': { substance: 'metal', finish: 'polished-metal', color: '#8a8890', rough: 0.2, film: 0.6, filmVary: 1, legend: '#f0eeea' },
  // Silicon is a mirror, dark for one, and all the colour on a wafer comes from what's grown and ruled on it.
  silicon: { substance: 'metal', finish: 'polished-metal', color: '#6f727a', legend: '#e8ebf0' },
  'silicon-etched': { substance: 'metal', finish: 'satin-metal', color: '#85878c', legend: '#17181a' },
  'thermal-oxide': { substance: 'metal', finish: 'polished-metal', color: '#b9bac0', film: 0.42, filmVary: 0.08, legend: '#17181a' },
  'silicon-array': { substance: 'metal', finish: 'hot-foil', color: '#b4b0ac', grating: 1, legend: '#17181a' },
  'holo-foil': holo('#dcdce2', '#141418'),
  'holo-foil-red': holo('#e8362a', '#fff4e6'),
  // A quarter wave of green cancels green, which leaves the purple of a coated lens.
  'lens-coat': { substance: 'metal', finish: 'polished-metal', color: '#34353c', rough: 0.09, film: 0.36, filmVary: 0.05 },
  gold: { substance: 'metal', finish: 'buffed-metal', color: '#fbe5ab', legend: '#2a2010' },
  'rose-gold': { substance: 'metal', finish: 'buffed-metal', color: '#e0a88a', legend: '#2a1a12' },
  copper: { substance: 'metal', finish: 'buffed-metal', color: '#f9cec2', rough: 0.28, legend: '#20100a', patina: '#4f9180', patinaRough: 0.7 },
  bronze: { substance: 'metal', finish: 'buffed-metal', color: '#8c6a3f', rough: 0.34, legend: '#16100a', patina: '#3f5f50', patinaRough: 0.7 },

  // Plastics and elastomers, as on anything from this decade.
  'stippled-graphite': { substance: 'plastic', finish: 'moulded-stipple', color: '#2e2f32', legend: '#d6d5cf' },
  'plaster-white': plaster('#e4e2dc', '#26262a'),
  'plaster-black': plaster('#17171a', '#e6e5e0'),
  'plaster-cream': plaster('#ded3bb', '#2a2620'),
  'soft-touch-black': softTouch('#17171a', '#e6e5e0', '#34343a'),
  'soft-touch-grey': softTouch('#6d6f73', '#f0efea', '#8f9195'),
  'soft-touch-silver': softTouch('#a8a9ab', '#26272a', '#c2c3c5'),
  'soft-touch-white': softTouch('#e4e3df', '#26262a', '#c5c4bf'),
  'soft-touch-sand': softTouch('#c4b39b', '#2a2419', '#d9ccb9'),
  'soft-touch-sage': softTouch('#8a9583', '#1c2019', '#a7b1a1'),
  'soft-touch-clay': softTouch('#b5674a', '#fbeee6', '#cd8a70'),
  'rubber-grey': { substance: 'rubber', finish: 'moulded-rubber', color: '#8d8c90', legend: '#1c1c20' },
  'rubber-putty': { substance: 'rubber', finish: 'moulded-rubber', color: '#77756a', legend: '#1c1c20' },
  'rubber-silver': { substance: 'rubber', finish: 'moulded-rubber', color: '#c2c3c0', rough: 0.36, legend: '#141821' },
  'silicone-black': { substance: 'rubber', finish: 'moulded-rubber', color: '#1a1a1d', legend: '#dcdbd6' },
  'silicone-white': { substance: 'rubber', finish: 'moulded-rubber', color: '#dddcd6', legend: '#2a2a2d' },
  'silicone-red': { substance: 'rubber', finish: 'moulded-rubber', color: '#c8392b', legend: '#fff1ea' },
  'silicone-blue': { substance: 'rubber', finish: 'moulded-rubber', color: '#3a5fb0', legend: '#eef2fb' },
  'silicone-lime': { substance: 'rubber', finish: 'moulded-rubber', color: '#a9c43a', legend: '#1a2008' },
  'silicone-yellow': { substance: 'rubber', finish: 'moulded-rubber', color: '#f2b116', legend: '#1c1a10' },
  'silicone-putty': { substance: 'rubber', finish: 'moulded-rubber', color: '#c6c4b8', legend: '#2a2a2d' },
  // White laid on the back of something clear, which does the shining.
  'backing-white': { substance: 'plastic', finish: 'matte-paint', color: '#eeeeec', legend: '#222226' },
  'gloss-white': { substance: 'plastic', finish: 'polished-mould', color: '#ecebe7', coat: 1, legend: '#222226', sub: '#b9b8b3' },
  'gloss-black': { substance: 'plastic', finish: 'polished-mould', color: '#08080a', coat: 1, legend: '#ecebe6', sub: '#3a3a3e' },
  'gloss-slate': { substance: 'plastic', finish: 'polished-mould', color: '#403e46', coat: 1, legend: '#dcdad6', sub: '#3a3a3e' },
  'gloss-scarlet': { substance: 'plastic', finish: 'polished-mould', color: '#c20d13', coat: 1, legend: '#f0ece4', sub: '#8a0d12' },
  'gloss-red': { substance: 'plastic', finish: 'polished-mould', color: '#a01418', coat: 1, legend: '#f0ece4', sub: '#7a1014' },
  'gloss-pink': { substance: 'plastic', finish: 'polished-mould', color: '#e8819c', coat: 1, legend: '#2f1018' },
  'gloss-teal': { substance: 'plastic', finish: 'polished-mould', color: '#1b8f93', coat: 1, legend: '#eefafa' },
  'gloss-violet': { substance: 'plastic', finish: 'polished-mould', color: '#5a3fb8', coat: 1, legend: '#f1eefc' },
  'gloss-brown': { substance: 'plastic', finish: 'polished-mould', color: '#4a3024', coat: 1, legend: '#efe4d8', sub: '#7a6656' },
  'printed-orange': { substance: 'plastic', finish: 'layer-printed', color: '#e0671f', legend: '#20100a' },
  'printed-grey': { substance: 'plastic', finish: 'layer-printed', color: '#7c7f84', legend: '#111214' },
  'sintered-nylon': { substance: 'plastic', finish: 'sintered-powder', color: '#26272a', legend: '#d9d8d2' },

  // Ceramic and glass.
  // Glass fused to steel: over a dark ground coat, on to the steel, which rusts as soon as it's open to the rain.
  'vitreous-white': { substance: 'ceramic', finish: 'glazed', color: '#efece2', legend: '#17171a', under: [{ color: '#16161a', rough: 0.4, metal: 0 }, { color: '#55301a', rough: 0.95, metal: 0 }] },
  'ceramic-white': { substance: 'ceramic', finish: 'glazed', color: '#f0efea', legend: '#222226', sub: '#a9a79f' },
  'ceramic-black': { substance: 'ceramic', finish: 'glazed', color: '#0c0c0e', legend: '#e8e7e2', sub: '#2a2a2c' },
  'stoneware': { substance: 'ceramic', finish: 'unglazed', color: '#a39a8c', mottle: 0.5, fleck: 0.4, legend: '#1a1712' },
  'glass-black': { substance: 'glass', finish: 'float-glass', color: '#050506', rough: 0.08, coat: 1, legend: '#e9e8e3' },
  'glass-white': { substance: 'glass', finish: 'float-glass', color: '#e9e9e6', rough: 0.1, coat: 1, legend: '#232326' },
  // A back etched to a frost, and the same glass left polished, for a mark that only shows in the shine.
  'frosted-glass': { substance: 'glass', finish: 'etched-glass', color: '#8d897f', legend: '#17171a' },
  'frosted-glass-cream': { substance: 'glass', finish: 'etched-glass', color: '#c6c1aa', legend: '#17171a' },
  'polished-frosted-glass': { substance: 'glass', finish: 'float-glass', color: '#8d897f', rough: 0.05, coat: 1, legend: '#17171a' },
  // Clear covers, for a d-glass to say what it is. Sapphire's index is spec, and it reflects nearly twice what glass does.
  // Polycarbonate is a moulded plastic, so it splits rather than shatters when it breaks.
  'mineral-glass': { substance: 'glass', finish: 'float-glass', color: '#e8ecea', legend: '#141517' },
  // A plastic, however clear: it scratches, hazes and yellows, where glass does none of those.
  'polycarbonate': { substance: 'plastic', finish: 'polished-mould', scatter: 0, color: '#e8ecee', ior: 1.58, breaks: 'craze', legend: '#141517' },
  'sapphire': { substance: 'glass', finish: 'float-glass', color: '#e8ecee', ior: 1.77, breaks: 'crystal', legend: '#141517' },
  'acrylic': { substance: 'plastic', finish: 'polished-mould', color: '#eceeec', legend: '#141517' },

  // Composites and boards.
  'carbon-fibre': { substance: 'plastic', finish: 'woven-fibre', color: '#1a1b1e', tangent: 0.7854, legend: '#e6e5e0' },
  'carbon-matte': { substance: 'plastic', finish: 'woven-fibre', color: '#1b1c1f', rough: 0.5, coat: 0, tangent: 0.7854, legend: '#e6e5e0' },
  kevlar: { substance: 'plastic', finish: 'woven-fibre', color: '#c6a12f', rough: 0.4, coat: 0.7, tangent: 0.7854, legend: '#1a1608' },
  'pcb-green': { substance: 'plastic', finish: 'flowed-film', color: '#0f4d2c', rough: 0.3, coat: 0.7, fleck: 0.1, legend: '#eceee2' },
  'pcb-black': { substance: 'plastic', finish: 'flowed-film', color: '#0d0e0f', rough: 0.34, coat: 0.6, legend: '#eceee2' },

  // Cloth.
  'fabric-charcoal': { substance: 'cloth', finish: 'knitted-cloth', color: '#3a3b3e', color2: '#57595d', legend: '#e6e5e0' },
  'fabric-sand': { substance: 'cloth', finish: 'knitted-cloth', color: '#b9ac96', color2: '#d3c8b4', legend: '#26221a' },
  'fabric-coral': { substance: 'cloth', finish: 'knitted-cloth', color: '#c96a55', color2: '#de8b76', legend: '#fff1ea' },
  'fabric-slate': { substance: 'cloth', finish: 'knitted-cloth', color: '#4a5a6c', color2: '#677a8e', legend: '#eef2f6' },
  'felt-grey': { substance: 'cloth', finish: 'pressed-felt', color: '#6b6c6e', mottle: 0.2, legend: '#efeeea' },
  'felt-green': { substance: 'cloth', finish: 'pressed-felt', color: '#1f5a3a', mottle: 0.2, legend: '#efeeea' },
  'bookcloth-oxblood': bound('#5a1a1c'),
  'bookcloth-clay': bound('#9c4a28'),
  'bookcloth-ochre': bound('#b38a35', '#21170b'),
  'bookcloth-moss': bound('#55602f'),
  'bookcloth-bottle': bound('#173a30'),
  'bookcloth-ink': bound('#141b2e'),
  'bookcloth-soot': bound('#2a1d14'),
  'bookcloth-night': bound('#1d1722'),
  'bookcloth-slate': bound('#465462'),
  'bookcloth-bone': bound('#d8cdb4', '#21170b'),

  // Things that grew, or were quarried.
  walnut: { substance: 'wood', finish: 'oiled-wood', color: '#55341f', color2: '#26140b', coatTint: '#e8c9a0', rings: 2.75, pores: 0.45, legend: '#eadcc8', sub: '#7d5a3e' },
  'walnut-stained': { substance: 'wood', finish: 'oiled-wood', color: '#3d2010', color2: '#190b05', coatTint: '#e8c9a0', rings: 2.75, pores: 0.45, legend: '#eadcc8', sub: '#7d5a3e' },
  oak: { substance: 'wood', finish: 'oiled-wood', color: '#a8814d', color2: '#6b4623', coatTint: '#f0d6a6', rings: 4.25, pores: 0.95, legend: '#21170b', sub: '#d3b78e' },
  ash: { substance: 'wood', finish: 'oiled-wood', color: '#c7b38d', color2: '#8c7246', coat: 0, rings: 5, pores: 0.85, legend: '#241c0e', sub: '#ebdec7' },
  ebony: { substance: 'wood', finish: 'lacquered-wood', color: '#17110e', color2: '#070504', rings: 1.75, pores: 0.12, legend: '#e9e0d2' },
  teak: { substance: 'wood', finish: 'oiled-wood', color: '#8f5a30', color2: '#472811', coatTint: '#ecc896', rings: 3.75, pores: 0.6, legend: '#1f120a', sub: '#c49a6e' },
  rosewood: { substance: 'wood', finish: 'lacquered-wood', color: '#55261a', color2: '#1a0a08', coat: 0.5, coatTint: '#e6bd94', rings: 2.25, pores: 0.35, legend: '#ecd9c2', sub: '#8a5540' },
  'mahogany-gloss': { substance: 'wood', finish: 'lacquered-wood', color: '#6a2115', color2: '#2b0a07', coatTint: '#f0c8a0', rings: 2.5, pores: 0.4, legend: '#ecd9c2', sub: '#8a4a38' },
  'alder-amber': { substance: 'wood', finish: 'lacquered-wood', color: '#c47a22', color2: '#8c4a12', coat: 1, coatTint: '#f0c078', rings: 7, pores: 0.12, legend: '#241c0e', sub: '#d9b98c' },
  'maple-gloss': { substance: 'wood', finish: 'lacquered-wood', color: '#dba85c', color2: '#b67f36', coat: 0.8, coatTint: '#f4cf8e', rings: 6, pores: 0.08, legend: '#241c0e', sub: '#eee0c6' },
  maple: { substance: 'wood', finish: 'oiled-wood', color: '#d4bd94', color2: '#ad8b5b', coatTint: '#f4e2be', rings: 6, pores: 0.1, legend: '#241c0e', sub: '#eee0c6' },
  cork: { substance: 'wood', finish: 'sanded-cork', color: '#b08a5e', coat: 0, fleck: 0.5, mottle: 0.5, legend: '#20160a' },
  'tolex-black': { substance: 'leather', finish: 'pressed-vinyl', color: '#1b1b19', legend: '#d8c9a8', sub: '#3d3532' },
  'grille-black': { substance: 'cloth', finish: 'basket-weave', color: '#1c1c1b', color2: '#3a3a36', legend: '#e6e5e0' },
  'leather-black': { substance: 'leather', finish: 'tanned-leather', color: '#1c1a19', legend: '#d8c9a8', sub: '#3d3532' },
  'leather-tan': { substance: 'leather', finish: 'tanned-leather', color: '#8c5430', legend: '#f1e2c8', sub: '#b98a64' },
  'leather-saddle': { substance: 'leather', finish: 'smooth-calf', color: '#74462a', legend: '#f1e2c8', sub: '#c49468', patina: '#6d3a1c', patinaRough: 0.32 },
  'vulcanite-black': { substance: 'rubber', finish: 'pressed-vulcanite', color: '#0e0e0f', legend: '#d8d6d0', sub: '#34322f', patina: '#28231f', patinaRough: 0.4 },
  'leather-oxblood': { substance: 'leather', finish: 'tanned-leather', color: '#4c1518', legend: '#e6d2ac', sub: '#7a3a3a' },
  'marble-white': { substance: 'stone', finish: 'polished-stone', color: '#e8e6e1', color2: '#6f7278', legend: '#222226' },
  'marble-black': { substance: 'stone', finish: 'polished-stone', color: '#0f0f11', color2: '#b5b0a4', legend: '#e9e6dc' },
  'terrazzo': { substance: 'stone', finish: 'ground-terrazzo', color: '#dcd6ca', color2: '#7c7468', sub: '#b9543c', legend: '#26221c' },
  concrete: { substance: 'stone', finish: 'cast-concrete', color: '#8d8c88', mottle: 0.5, fleck: 0.1, legend: '#1a1a18' },
  'cast-stone': { substance: 'stone', finish: 'cast-concrete', color: '#cfc8b8', mottle: 0.35, fleck: 0.1, legend: '#1a1a18' },
  slate: { substance: 'stone', finish: 'cleft-stone', color: '#34383c', mottle: 0.4, legend: '#d7d8d6' },

  // Industrial and speculative.
  'hazard-tape': { substance: 'plastic', finish: 'flowed-film', color: '#e3b021', color2: '#141416', rough: 0.4, pattern: 'hazard', size: 4.25, legend: '#141416' },
  'hex-mesh': { substance: 'metal', finish: 'perforated', color: '#2a2b2e', legend: '#e6e5e0' },
  'diamond-plate': { substance: 'metal', finish: 'knurled', color: '#8f9193', size: 1.5, legend: '#121314' },
  knurled: { substance: 'metal', finish: 'knurled', color: '#b9babc', legend: '#121314' },
  'knurled-fine': { substance: 'metal', finish: 'knurled', color: '#b9babc', size: 0.175, legend: '#121314' },
  corrugated: { substance: 'metal', finish: 'roll-formed', color: '#9a9ca0', legend: '#121314', patina: '#6b3a20', patinaRough: 0.86 },
  'cast-iron-painted': { substance: 'paint', finish: 'sand-cast', color: '#55595f', legend: '#d9d8d2', patina: '#5e3119', patinaRough: 0.9 },
  'cast-iron': { substance: 'metal', finish: 'sand-cast', color: '#2c2d2f', legend: '#d9d8d2', patina: '#5e3119', patinaRough: 0.9 },
  rust: { substance: 'stone', finish: 'sand-cast', color: '#6b3417', rough: 0.9, mottle: 0.8, fleck: 0.3, legend: '#efe2cf' },
  'hull-pale': { substance: 'paint', finish: 'matte-paint', color: '#c3cac6', legend: '#1a1b1e', under: PRIMED },
  'hull-white': { substance: 'paint', finish: 'matte-paint', color: '#d6d7d9', legend: '#1a1b1e', under: PRIMED },
  'hull-grey': { substance: 'paint', finish: 'matte-paint', color: '#53565b', legend: '#ecebe6', under: PRIMED },
  'hull-orange': { substance: 'paint', finish: 'matte-paint', color: '#e05a1c', legend: '#fff1e6', under: PRIMED },

  // Stuck on or pressed on: label stock and hot foil.
  // Label stock is a printed face on a white base, and it's the face that goes: it scuffs away from the edges in, to the base, and takes the print with it.
  'sticker-paper': { substance: 'paper', finish: 'uncoated-paper', color: '#ece8dc', rough: 0.66, legend: '#1d1c19', wears: 'chip', under: [{ color: '#f1eee6', rough: 0.9, metal: 0 }], patina: '#d4c08e', patinaRough: 0.8 },
  'sticker-vinyl': stock('#ecece9', '#17171a', { patina: '#d9d0ae', patinaRough: 0.5 }),
  // Crêpe paper tape, the kind written on in marker and torn off the roll.
  'tape-masking': { substance: 'paper', finish: 'uncoated-paper', color: '#dccb98', rough: 0.72, legend: '#1d1c19', sub: '#c4b27e' },
  'sticker-vinyl-black': stock('#121214', '#ecebe6', { rough: 0.3, coat: 0.6 }),
  'sticker-vinyl-red': stock('#c11a12', '#fff7ea'),
  'sticker-vinyl-yellow': stock('#f2c81e', '#17140a'),
  'sticker-vinyl-blue': stock('#1c56c4', '#f4f6fb'),
  'sticker-vinyl-pink': stock('#ee5f9c', '#1d0c14'),
  'sticker-vinyl-green': stock('#2f9e4f', '#f3f8ef'),
  'foil-gold': { substance: 'metal', finish: 'hot-foil', color: '#fbe5ab', legend: '#2a2010' },
  'foil-silver': { substance: 'metal', finish: 'hot-foil', color: '#f4f5f6', legend: '#141517' },
  'foil-black': { substance: 'metal', finish: 'hot-foil', color: '#2c2a27', legend: '#ece9df' },

  // Watch work: a steel case, a painted dial, and the box it comes in.
  // Chrome over brass, as on a camera: the plate is blasted dull, or brushed, before it goes in the bath.
  'satin-chrome': { substance: 'metal', finish: 'satin-metal', color: '#c5c4c4', legend: '#111214', sub: '#5c5a54', patina: '#8a7a5e', patinaRough: 0.5 },
  'matt-chrome': { substance: 'metal', finish: 'bead-blast', color: '#e2e1de', rough: 0.38, legend: '#111214', sub: '#5c5a54', patina: '#8a7a5e', patinaRough: 0.5 },
  'brushed-chrome': { substance: 'metal', finish: 'brushed-metal', color: '#c5c4c4', rough: 0.32, legend: '#141517', sub: '#7a6a3f', patina: '#8f8a80', patinaRough: 0.5 },
  'enamel-red': { substance: 'paint', finish: 'clear-lacquer', color: '#c21a17', legend: '#f6efe4', under: [{ color: '#b9b4a6', rough: 0.4 }] },
  // What a viewfinder shows from outside, under its window: the dark optics inside, with the frame window's pale patch and the blue-grey strip
  // of the rangefinder's mirror in it. The shine and the maroon of the coating belong to the window over it, d-glass="window".
  'finder-glass': { substance: 'glass', finish: 'float-glass', color: '#110d0f', rough: 0.45 },
  'frame-glass': { substance: 'glass', finish: 'float-glass', color: '#c7c2b4', rough: 0.3, coat: 0.5, legend: '#141517' },
  'filter-glass': { substance: 'glass', finish: 'float-glass', color: '#8d9396', rough: 0.36, coat: 0.4, legend: '#141517' },
  'reeded-glass': { substance: 'glass', finish: 'reeded-glass', color: '#6f7072', coat: 0.3, tangent: 1.5708 },
  'satin-steel': { substance: 'metal', finish: 'brushed-metal-fine', color: '#c1bebb', rough: 0.27, aniso: 0.7, legend: '#141517' },
  'polished-steel': { substance: 'metal', finish: 'polished-metal', color: '#c5c4c4', rough: 0.07, legend: '#141517' },
  'blued-steel': { substance: 'metal', finish: 'buffed-metal', color: '#1b2a66' },
  'dial-silver': { substance: 'paint', finish: 'matte-paint', color: '#a5a29a', rough: 0.42, metal: 0.35, legend: '#17171a' },
  'dial-lacquer': { substance: 'paint', finish: 'clear-lacquer', color: '#050506', rough: 0.4, coat: 0, legend: '#ecebe4' },
  'dial-navy': { substance: 'metal', finish: 'satin-metal', color: '#070e20', rough: 0.36, aniso: 0.5, legend: '#eceef0' },
  lume: { substance: 'paint', finish: 'matte-paint', color: '#e9e6d6', emit: [0.03, 0.12, 0.08], legend: '#20231c' },
  'dial-ivory': { substance: 'paint', finish: 'matte-paint', color: '#ece9e0', legend: '#16150f' },
  'edge-paint': { substance: 'paint', finish: 'matte-paint', color: '#3f2312' },
  // Flocked black, as inside a lens barrel, there to swallow what gets past the glass.
  'flock-black': { substance: 'cloth', finish: 'electrostatic-flock', color: '#030304' },
  'felt-charcoal': { substance: 'cloth', finish: 'pressed-felt', color: '#26272a', mottle: 0.2, legend: '#efeeea' },
  'felt-slate': { substance: 'cloth', finish: 'pressed-felt', color: '#3d3f46', mottle: 0.2 },

  // Display panels.
  // An electroluminescent panel unlit: phosphor seen through a glass front, a dull olive tan.
  'el-panel': { substance: 'glass', finish: 'float-glass', color: '#6d6340', rough: 0.2, coat: 0.6, legend: '#141410' },
  'oled-panel': { substance: 'glass', finish: 'float-glass', color: '#020203', rough: 0.16, coat: 0.3 },
  'ips-panel': { substance: 'glass', finish: 'float-glass', color: '#0b0c0e', rough: 0.2, coat: 0.8 },
  // The stock panel carries a full clear coat, and under this much glass that greys the blacks.
  // A TFT with a reflector behind it, as colour music players had: grey in a lit room with its backlight off. Sampled at about #888 on reference/ipod5/02.jpg.
  'tft-panel': { substance: 'glass', finish: 'float-glass', color: '#888a8c', rough: 0.2, coat: 0.3 },
  'black-panel': { substance: 'glass', finish: 'float-glass', color: '#000000', rough: 0.2, coat: 0.3 },
  // Aluminium powder clinging to the back of a pane, with the dark inside of the box behind it where a stylus has scraped it away.
  'powder-aluminium': { substance: 'metal', finish: 'bead-blast', color: '#c9cccd', rough: 0.62, coat: 0.85, text: '#1d1e20' },
  'eink-panel': { substance: 'glass', finish: 'etched-glass', color: '#d6d3c9', rough: 0.86, legend: '#1a1a18' },
};

export const lampColours: Record<string, Vec3> = {
  red: [5.5, 0.35, 0.14],
  // Zinc sulphide phosphor, the blue-green of an electroluminescent panel.
  phosphor: [0.5, 4.6, 2.3],
  amber: [5.5, 2.1, 0.25],
  yellow: [5.5, 4.1, 0.3],
  green: [0.45, 4.2, 0.6],
  lime: [2.4, 4.2, 0.35],
  blue: [0.35, 1.3, 5.5],
  white: [4, 4, 3.8],
  // A white lamp through a blue film, as a 2004 music player's panel, sampled at #7886e4 lit on a photo.
  ice: [2.1, 2.6, 5.5],
  // The white LEDs behind a TFT of the 2000s, well on the blue side of white. Read off the lit panel on reference/ipod5/05.jpg.
  led: [3.4, 3.8, 4.4],
  cyan: [0.3, 3.6, 4.4],
  violet: [2.2, 0.7, 5.5],
  pink: [5.5, 0.9, 2.2],
  // The orange of neon glowing round a cathode, about 600nm.
  neon: [5.5, 1.1, 0.12],
};

for (const name of ['well', 'needle', 'tape']) materials[name]!.wears = 'none';

defineMaterials(materials);
