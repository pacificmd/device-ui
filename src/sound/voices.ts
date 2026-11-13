import { getMaterialDef, type ContactKind, type ContactMotion } from 'device-ui';

// Everything you hear is set in this file and the clips. Change a number, the bench page reloads, press it again.

export interface Voice {
  /** Playback speed of the clip, which moves pitch and length together. Bigger and denser is slower. */
  rate: number;
  /** Top of a full-force hit, in Hz. Softer hits go below it. */
  tone: number;
  /** Loudness of this material against the others. */
  gain: number;
}

export const voices: Record<string, Voice> = {
  // The clips are plastic and spring steel, so this one leaves them as they are.
  plastic: { rate: 1, tone: 20000, gain: 1 },
  metal: { rate: 1.12, tone: 20000, gain: 0.85 },
  iron: { rate: 0.85, tone: 7000, gain: 1 },
  bakelite: { rate: 0.82, tone: 5000, gain: 1.1 },
  rubber: { rate: 0.7, tone: 1400, gain: 1.2 },
  wood: { rate: 0.8, tone: 4000, gain: 1.1 },
  glass: { rate: 1.25, tone: 20000, gain: 0.7 },
  stone: { rate: 0.95, tone: 9000, gain: 0.9 },
};

// Materials a finish can't tell apart, by the first word of their name.
const named: Record<string, string> = {
  bakelite: 'bakelite', lacquer: 'bakelite',
  cast: 'iron', rust: 'iron',
  gloss: 'plastic', hull: 'plastic', lcd: 'plastic', oled: 'glass', ips: 'glass',
  stoneware: 'stone', concrete: 'stone', slate: 'stone',
};

/** Which voice a material speaks in. Any material works, including one defined after this was written. */
export function voiceFor(material: string): string {
  const name = named[material.split('-')[0]!] ?? material;
  if (voices[name]) return name;
  const m = getMaterialDef(material);
  if ((m.metal ?? 0) > 0.5) return 'metal';
  if (m.pattern === 'wood') return 'wood';
  if (m.pattern === 'stone' || m.pattern === 'terrazzo') return 'stone';
  if ((m.rough ?? 0) >= 0.6) return 'rubber';
  if ((m.coat ?? 0) >= 0.9 && (m.rough ?? 1) <= 0.2) return 'glass';
  return 'plastic';
}

/** One recording for each mechanism, or a few where a repeat would give it away. */
export type Clip =
  | 'press' | 'release' | 'toggle' | 'detent' | 'rotary'
  | 'slide' | 'rocker' | 'latch' | 'unlatch'
  | 'thumbwheel' | 'jog' | 'clickwheel' | 'crown' | 'bezel'
  | 'mech' | 'mechup' | 'dome'
  | 'transport' | 'tapedoor' | 'eject'
  | 'lidopen' | 'lidshut' | 'flint' | 'cam'
  | 'shutter' | 'winder'
  | 'bolt' | 'strike' | 'bell' | 'carriage'
  | 'wipe' | 'fader'
  | 'plug' | 'hook' | 'knock' | 'guard' | 'keylock' | 'flap';

export interface Kind {
  /** The speed that counts as as hard as it gets. A press is about 10 and a toggle 25. Detents are in detents a second. */
  full: number;
  /** Loudness against the press. */
  level: number;
  /** The voice the recording already speaks in, so that voice leaves it as it is. Plastic if unsaid. */
  made?: string;
  /** Plays for as long as a part keeps moving, and `full` is in ranges a second. */
  loop?: boolean;
}

export const kinds: Record<Clip, Kind> = {
  press: { full: 25, level: 1 },
  release: { full: 25, level: 0.7 },
  toggle: { full: 25, level: 1 },
  detent: { full: 30, level: 0.6 },
  rotary: { full: 30, level: 0.7 },
  slide: { full: 25, level: 0.8 },
  rocker: { full: 25, level: 1 },
  latch: { full: 10, level: 1 },
  unlatch: { full: 10, level: 0.8 },
  thumbwheel: { full: 30, level: 0.5 },
  jog: { full: 30, level: 0.5, made: 'metal' },
  clickwheel: { full: 30, level: 0.5 },
  crown: { full: 30, level: 0.4, made: 'metal' },
  bezel: { full: 30, level: 0.6, made: 'metal' },
  mech: { full: 10, level: 1 },
  mechup: { full: 10, level: 0.6 },
  dome: { full: 10, level: 0.9 },
  transport: { full: 10, level: 1 },
  tapedoor: { full: 25, level: 0.8 },
  eject: { full: 25, level: 0.9 },
  lidopen: { full: 25, level: 1, made: 'metal' },
  lidshut: { full: 25, level: 1, made: 'metal' },
  flint: { full: 25, level: 0.9, made: 'metal' },
  cam: { full: 25, level: 0.5, made: 'metal' },
  shutter: { full: 10, level: 1, made: 'metal' },
  winder: { full: 10, level: 0.8, made: 'metal' },
  bolt: { full: 10, level: 1, made: 'iron' },
  strike: { full: 10, level: 1, made: 'metal' },
  bell: { full: 10, level: 0.8, made: 'metal' },
  carriage: { full: 10, level: 0.8, made: 'metal' },
  wipe: { full: 4, level: 0.25, loop: true },
  fader: { full: 4, level: 0.25, loop: true },
  plug: { full: 10, level: 0.9, made: 'metal' },
  hook: { full: 10, level: 1, made: 'bakelite' },
  knock: { full: 10, level: 0.7, made: 'metal' },
  guard: { full: 25, level: 1 },
  keylock: { full: 25, level: 0.9, made: 'metal' },
  flap: { full: 10, level: 0.6 },
};

/** What a mechanism plays for each kind of contact. A kind it doesn't name plays what it's called, null says nothing, and `shut` is a toggle coming back. */
export type Sounds = Partial<Record<ContactKind | 'shut', Clip | null>>;

// Grams. A key on a tall switch is 6, where a laptop key is 2.
const MECH = 5;
// A steel lid against the lever of a toggle, and a watch crown against a key in a lock.
const LID = 10;
// A flip-up cover is felt as much heavier than either, for its long arm.
const COVER = 500;
// Past this it's a machine, and what you hear is bolts.
const VAULT = 1000;

// Every moving part comes to one of these through its joint.
const KEY: Sounds = { stop: null };
const HIT: Sounds = { release: null, stop: null };
const SOUNDS: Record<string, Sounds> = {
  mech: { ...KEY, press: 'mech', release: 'mechup' },
  dome: { ...KEY, press: 'dome' },
  latch: { ...KEY, press: 'latch', release: 'unlatch' },
  transport: { ...KEY, press: 'transport', release: 'unlatch' },
  lid: { toggle: 'lidopen', shut: 'lidshut', stop: null },
  // A carriage steps along with every key. What you hear is it going back.
  carriage: { press: null, release: 'carriage', stop: null },
  hook: { press: null, release: 'hook', stop: null },
  bolt: { press: 'bolt', release: 'bolt', stop: 'bolt' },
};

const justThis = (clip: Clip): Sounds => ({ press: clip, toggle: clip, detent: clip, ...HIT });

function byJoint(m: ContactMotion): Sounds {
  const { joint, material, mass, returns } = m, soft = /rubber/.test(material);
  if (joint === 'press') {
    if (m.latch) return SOUNDS.latch!;
    if (soft) return SOUNDS.dome!;
    return material === 'plastic-on-plastic' && mass >= MECH ? SOUNDS.mech! : KEY;
  }
  if (joint === 'hinge') {
    if (mass >= COVER) return { toggle: 'guard', stop: null };
    if (material === 'steel-on-steel' && mass >= LID) return SOUNDS.lid!;
    return { toggle: material === 'steel-on-steel' ? 'toggle' : 'rocker', stop: null };
  }
  if (joint === 'slide') return { toggle: 'slide', detent: m.arrives ? 'slide' : 'detent', stop: 'knock', rub: returns ? null : 'fader' };
  if (joint === 'turn') {
    if (material === 'governor') return { detent: 'rotary', stop: null, rub: null };
    if (material === 'finger-on-glass') return { detent: 'clickwheel', rub: null };
    if (material === 'ball-bearing') return { detent: 'jog', stop: 'knock', rub: null };
    if (m.rolled) return { detent: soft ? 'thumbwheel' : 'crown', stop: 'knock', rub: null };
    if (material === 'brass-on-steel') return { toggle: 'keylock', detent: mass < LID ? 'crown' : 'detent', stop: 'knock', rub: null };
    if (material === 'steel-on-steel') return { detent: 'bezel', stop: mass >= VAULT ? 'bolt' : 'knock', rub: null };
    // Anything else turning clicks through its detents, if it has them, and wipes where it doesn't.
    return { detent: 'detent', stop: 'knock', rub: 'wipe' };
  }
  return mass >= VAULT ? SOUNDS.bolt! : { press: 'knock', ...HIT };
}

/** What a mechanism plays. Declared by name if it says, and otherwise what its joint, material and mass come to. */
export function soundsOf(m: ContactMotion): Sounds {
  const asked = m.sound;
  if (asked && SOUNDS[asked]) return SOUNDS[asked]!;
  if (asked && asked in kinds) return justThis(asked as Clip);
  return byJoint(m);
}
