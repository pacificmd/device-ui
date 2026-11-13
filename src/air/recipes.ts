// What happens in a room, asked for by what it really is: a fault of so many joules, a shake of so much g, a fire of so many
// watts, steam at so many metres a second. Each is worked out here into plumes, sparks and lights, so a page never builds one
// out of them, and two pages asking for the same thing get the same thing. Every number below is marked spec or guess.
import type { Air, Place, Plume } from './air.js';

type Rgb = [number, number, number];

/** A css px place on the page, from a place or an element's middle. */
const where = (p: Place): [number, number] => {
  if (Array.isArray(p)) return p;
  const r = p.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
};

/** How much of an arc's energy comes out as light that's seen, lm per W. Guess: a short's light, mostly metal vapour lines. */
const ARC_EFFICACY = 10;
/** How long an arc's flash lasts, s. Guess: a fault clears in a few cycles of the mains. */
const ARC_SECONDS = 0.1;
/** How much of an arc's energy goes into a blast, the rise of pressure round it. Spec, about: arc fault studies in switchgear put it at 0.3 to 0.5, the thermal transfer coefficient k_p. */
const BLAST = 0.4;
/** How much of an arc's energy goes into the metal it throws off. Guess. */
const SPATTER = 0.01;
/** What it takes to melt steel from the room and take it to 2100 K, J/kg: 500 J/kg·K over 1800 K and 270 kJ/kg to melt. Spec. */
const STEEL_MELT = 1.17e6;
/** A quarter-millimetre drop of steel, kg. Spec: 7800 kg/m³. */
const DROP = (7800 * Math.PI * (0.25e-3) ** 3) / 6;

export interface ImpactOptions {
  /** How hot its light looks, kelvin: an arc's bluish white, 6000, by default. */
  kelvin?: number;
  /** Which way what it throws goes, degrees from up, and how widely: every way over the top, by default. */
  toward?: number;
  spread?: number;
  /** How fast it throws them, mm a second. */
  speed?: number;
  /** How big its drops are, mm. */
  size?: number;
}

/**
 * A fault or a strike on metal, of so many joules: the arc's light, given off every way for the tenth of a second it burns, and
 * the metal it melted thrown off as sparks. Under about 10 J it melts too little to throw a spark at all.
 */
export function impact(room: Air, at: Place, joules: number, o: ImpactOptions = {}) {
  // The ball of hot gas an arc makes grows as the cube root of its energy: 5 cm at a kilojoule. Guess.
  const radius = 50 * Math.cbrt(joules / 1000), candela = (ARC_EFFICACY * joules) / ARC_SECONDS / (4 * Math.PI);
  // Its light is on while the arc burns and goes out as the fault clears: the gas cools in well under a frame. Spec, about.
  const flash = room.light({ at: where(at), radius, candela, kelvin: o.kelvin ?? 6000 });
  setTimeout(() => flash.remove(), ARC_SECONDS * 1000);
  // What doesn't go into light and metal goes into the air round it, heated faster than it can move: a blast.
  room.shock(at, BLAST * joules);
  const size = o.size ?? 0.25, drops = (SPATTER * joules) / STEEL_MELT / (DROP * (size / 0.25) ** 3);
  if (drops >= 1) room.sparks(at, Math.round(drops), { speed: o.speed, toward: o.toward, spread: o.spread ?? 200, size });
}

const ceilings = new WeakMap<Air, Plume>();

/**
 * The room shaken, by its peak acceleration in g: dust lets go of the ceiling and comes down in sheets, and what it stirs hangs
 * through the room until the air carries it off. Below about a twentieth of g nothing comes down.
 */
export function shake(room: Air, g: number) {
  // How hard, 0 to 1: dust lets go at 0.05 g, and by about 0.65 g everything loose has. Guess.
  const k = Math.min(1, Math.max(0, (g - 0.05) / 0.6));
  if (!k) return;
  const s = room.scale, w = innerWidth / s, h = innerHeight / s;
  let dust = ceilings.get(room);
  if (!dust) ceilings.set(room, (dust = room.plume({ at: [innerWidth / 2, 0], size: [w, h], anchor: [0.5, 0] })));
  // Patches let go across the ceiling, more and bigger the harder it's shaken, and fall as a sheet of dusty air falls: a few
  // hundred mm a second, as it's only a little heavier than the air round it. Guess.
  for (let i = 0; i < Math.round(2 + k * 5); i++)
    dust.puff({ at: [innerWidth * (0.05 + Math.random() * 0.9), 2], radius: 12 + k * 30, rate: 0.2 + k * 0.45, steam: 0.5, jet: [(Math.random() - 0.5) * 60, 260 + k * 380], grip: 0.5, color: [0.6, 0.55, 0.48] }, 0.25 + k * 0.5);
  room.stir(k * 0.3);
}

export interface FireOptions {
  /** How much it burns at, W, once it's in flames, which says how tall they stand. A lamp's bezel and wiring, 50, by default. */
  watts?: number;
}

export interface Fire {
  /** Smouldering, giving off a thread of pale smoke, or in flames, which glow, give off soot and light the room. */
  set(state: 'smoke' | 'flame'): void;
  remove(): void;
}

/** How much of a fire's heat comes out as light that's seen, lm per W. Spec, about: a candle's 12 lm from 80 W. */
const FLAME_EFFICACY = 0.15;
// Board and paper burn cleaner than wax, and it's the soot in a flame that shines. Guess: a third of a candle.
const CLEAN_EFFICACY = 0.05;
/** How hot a sooty flame's light looks, K. Spec, about. */
const FLAME_KELVIN = 1900;
/** How hot what comes off it is, in the air's heat units of 450 K over the room: smouldering at 520 K, flames at 1465 K. */
const SMOULDER_HEAT = 0.5, FLAME_HEAT = 2.6;
const SMOKE: Rgb = [0.85, 0.83, 0.8], SOOT: Rgb = [0.12, 0.11, 0.1];

/**
 * Where a fire burns all the time, mm across and up, from how much it burns at, W, on something so wide, mm. Its flames stand
 * L = 0.235·Q^0.4 − 1.02·D tall (Heskestad, m and kW: spec). A small fire doesn't burn across all of what it's on: it burns
 * where its flames come out twice as tall as they're wide, as a candle's or a match's do. Guess. The bottom 0.4 of them
 * always burns, and above that they come and go in tongues (McCaffrey: spec), which the air makes of what rises off it.
 */
const flameZone = (watts: number, wide: number): [number, number] => {
  const reach = 0.235 * (watts / 1000) ** 0.4, d = Math.min(wide / 1000, reach / 3.02), tall = reach - 1.02 * d;
  return [d * 1000, 0.4 * tall * 1000];
};

/**
 * Something set into a panel that's caught: it smokes out of the seam round it, where it meets the panel, and once in flames
 * it burns over its face, in tongues as tall as what it burns at makes them, and lights the room. It starts smouldering.
 */
export function fire(room: Air, at: Element, o: FireOptions = {}): Fire {
  const box = at.getBoundingClientRect(), s = room.scale, span: [number, number] = [box.width / s, box.height / s];
  const watts = o.watts ?? 50, zone = flameZone(watts, span[0]);
  // In flames it burns from its middle up.
  const flames: [number, number] = [box.left + box.width / 2, box.top + box.height / 2 - (zone[1] / 2) * s];
  // Its smoke goes up until the room's air takes it: about half a metre, as wide as it spreads by then. Guess.
  const plume = room.plume({ at, size: [Math.max(220, span[0] * 3), 560], anchor: [0.5, 0.9] });
  const source = plume.add({ at, radius: 2, span, seam: true, rate: 8, heat: SMOULDER_HEAT, color: SMOKE });
  const candela = (FLAME_EFFICACY * watts) / (4 * Math.PI);
  let lamp: ReturnType<Air['light']> | null = null;
  return {
    set(state) {
      const flame = state === 'flame';
      source.set(flame ? { at: flames, span: zone, seam: false, heat: FLAME_HEAT, rate: 10, radius: 3, color: SOOT } : { at, span, seam: true, heat: SMOULDER_HEAT, rate: 8, radius: 2, color: SMOKE });
      if (flame) lamp ??= room.light({ at: flames, radius: zone[1] * 1.25, candela, kelvin: FLAME_KELVIN });
      else lamp?.remove(), (lamp = null);
    },
    remove() {
      lamp?.remove();
      plume.remove();
    },
  };
}

export interface FlameOptions {
  /** How much it burns at, W. A paper match settled, 12, by default: a candle's 80 W stands about 40 mm, and this about half that. Guess. */
  watts?: number;
  /** What it's burning on, mm across. */
  wide?: number;
  /** How far it can go from where it starts, mm across and up and down, as a hand carries it. */
  reach?: [number, number];
  /** It catches with a spit of this many sparks, as a struck head does. */
  spits?: number;
}

export interface Flame {
  /** Where it is now, and how much it's burning at, W. */
  set(at: [number, number], watts?: number): void;
  /** Goes out, leaving a thread of smoke off what's still hot. */
  out(): void;
  remove(): void;
}

/** A small flame on the end of something in the hand: it's carried about, and what it burns on feeds it more or less as it goes. */
export function flame(room: Air, at: [number, number], o: FlameOptions = {}): Flame {
  const wide = o.wide ?? 2, s = room.scale, [rx, ry] = o.reach ?? [90, 110];
  let watts = o.watts ?? 12, here = at;
  const zone = () => flameZone(watts, wide), flames = (): [number, number] => [here[0], here[1] - (zone()[1] / 2) * s];
  const plume = room.plume({ at, size: [rx * 2, ry * 2], anchor: [0.5, 0.5] });
  // A clean little flame smokes in a thread: soot goes with how hard it's burning. Guess, by eye.
  const soot = () => Math.min(10, watts * 0.7);
  const source = plume.add({ at: flames(), radius: 1, span: zone(), heat: FLAME_HEAT, rate: soot(), color: SOOT });
  const glow = () => ({ at: flames(), radius: zone()[1] * 1.25, candela: (CLEAN_EFFICACY * watts) / (4 * Math.PI), kelvin: FLAME_KELVIN });
  const lamp = room.light(glow());
  if (o.spits) room.sparks(at, o.spits, { speed: 420, toward: 0, spread: 150, size: 0.2, kelvin: 1900, metal: 'copper' });
  let gone = false;
  return {
    set(to, w) {
      if (gone) return;
      here = to;
      if (w !== undefined) watts = w;
      source.set({ at: flames(), span: zone(), rate: soot() });
      lamp.set(glow());
    },
    out() {
      if (gone) return;
      gone = true;
      lamp.remove();
      source.remove();
      // Off an ember for a second or two, cooling. Guess, by eye.
      plume.puff({ at: here, radius: 0.8, span: [wide * 0.5, 0.5], rate: 1.2, heat: SMOULDER_HEAT, color: SMOKE }, 2.5);
    },
    remove() {
      gone = true;
      lamp.remove();
      plume.remove();
    },
  };
}

export interface VentOptions {
  /** Each grating's size, mm across and down. */
  size: [number, number];
  /** How many slots there are down a grating. 3 by default. */
  slots?: number;
  /** How fast what comes out leaves, m/s. */
  speed?: number;
}

export interface Vent {
  /** Lets go for so many seconds. */
  blow(seconds: number): void;
  remove(): void;
}

/**
 * Steam let out through gratings in the floor, all in one body of air: it comes out of the slots as a jet, at a hundred degrees,
 * and is gone as it evaporates.
 */
export function vent(room: Air, at: Place[], o: VentOptions): Vent {
  const s = room.scale, places = at.map(where), slots = o.slots ?? 3, speed = o.speed ?? 0.5, [gw, gh] = o.size;
  const xs = places.map(p => p[0]), left = Math.min(...xs), right = Math.max(...xs), bottom = Math.max(...places.map(p => p[1]));
  // As wide as the gratings go, and as high as a jet that fast carries before it's slowed to the room's own air. Guess.
  const plume = room.plume({ at: [(left + right) / 2, bottom + (gh / 2) * s], size: [(right - left) / s + gw * 1.5, speed * 1500 + 200], anchor: [0.5, 1] });
  const pitch = gh / slots;
  return {
    blow(seconds) {
      for (const [x, y] of places)
        for (let i = 0; i < slots; i++)
          // Steam at 100 °C is 0.17 of a heat unit over the room. Spec.
          plume.puff({ at: [x, y + (i - (slots - 1) / 2) * pitch * s], radius: 3, span: [gw, pitch * 0.4], rate: 3, steam: 0.85, heat: 0.17, jet: [0, -speed * 1000], grip: 0.5, blast: 60, color: [1, 1, 1] }, seconds);
    },
    remove: () => plume.remove(),
  };
}
