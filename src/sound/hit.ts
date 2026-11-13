import type { Contact } from 'device-ui';
import { kinds, soundsOf, voiceFor, voices, type Clip } from './voices.js';

// Quieter than this is a part settling, not something anyone did.
const QUIETEST = 0.03;
// Pixels across of a part that plays at the table's rate. Bigger is slower: a space bar is not a key.
const KEY = 40;
// How far the top falls on the softest hit, against a full one.
const DULLEST = 0.4;

export interface Hit {
  clip: Clip;
  /** Peak against the clip. */
  level: number;
  /** Playback speed. */
  rate: number;
  /** Lowpass, in Hz. */
  tone: number;
  /** Which recording of several, 0 to 1. */
  take: number;
  /** Seconds a loop goes on after this, with nothing more coming. */
  hold?: number;
}

export interface Blow {
  voice: string;
  clip?: Clip;
  force?: number;
  /** Across a part, in pixels. */
  size?: number;
  /** Stable offset in rate, so two keys are not the same key. */
  detune?: number;
  /** Seconds a loop goes on for. */
  hold?: number;
  /** Plays from this device's own clips, by the id of its `d-device`. */
  device?: string;
  /** A recording of this very thing, so its material and size are in it already. */
  own?: boolean;
}

/** A hit with no contact behind it, as the bench plays them. */
export function hit(b: Blow, random = Math.random): Hit | null {
  const clip = b.clip ?? 'press';
  const kind = kinds[clip], made = voices[kind.made ?? 'plastic']!, voice = b.own ? made : voices[b.voice]!;
  const force = b.force ?? 1;
  if (force < QUIETEST) return null;
  const size = b.own ? 1 : Math.min(1.4, Math.max(0.7, (KEY / (b.size ?? KEY)) ** 0.3));
  return {
    clip,
    level: Math.min(1, force * kind.level * (voice.gain / made.gain) * (0.9 + 0.2 * random())),
    rate: (voice.rate / made.rate) * size * (b.detune ?? 1) * (0.98 + 0.04 * random()),
    tone: voice.tone * (DULLEST + (1 - DULLEST) * force),
    take: random(),
    hold: b.hold,
  };
}

/** Which of `n` recordings, never the one before it if there's another. */
export function pick(n: number, last: number, take: number): number {
  if (n < 2 || last < 0 || last >= n) return Math.floor(take * n) % n;
  const i = Math.floor(take * (n - 1)) % (n - 1);
  return i >= last ? i + 1 : i;
}

// A contact's own recording, for when a mechanism's isn't there. A rub has none, and stays quiet.
const PLAIN: Record<Contact['kind'], Clip | null> = { press: 'press', release: 'release', toggle: 'toggle', detent: 'detent', stop: 'press', rub: null };

/** Which recording a contact plays, or null for none. `has` says what's loaded, and without its own a mechanism falls back on the contact's. */
export function clipFor({ kind, to, motion }: Contact, has: (clip: Clip) => boolean = () => true): Clip | null {
  const sounds = motion ? soundsOf(motion) : {}, shut = kind === 'toggle' && (to ?? 1) <= 0 ? sounds.shut : undefined;
  const own = shut !== undefined ? shut : sounds[kind];
  if (own === null) return null;
  return own && has(own) ? own : PLAIN[kind];
}

/** Whether a set of clips has something of its own for this contact. A contact it stays silent on isn't its to answer. */
export function owns(c: Contact, has: (clip: Clip) => boolean): boolean {
  const clip = clipFor(c, has);
  return !!clip && has(clip);
}

/** What a contact sounds like, or null if it can't be heard. `own` says the clips are this device's own. */
export function hitFor(c: Contact, random = Math.random, has?: (clip: Clip) => boolean, own = false): Hit | null {
  const { part } = c;
  const clip = clipFor(c, has);
  if (!clip) return null;
  return hit({
    voice: voiceFor(c.material), clip,
    force: Math.min(1, c.speed / kinds[clip].full) ** 0.7,
    size: Math.sqrt(part.w * part.h),
    detune: 1 + 0.03 * Math.sin(part.x * 12.9898 + part.y * 78.233),
    own,
  }, random);
}

/** Where a contact sits in the stereo field, -1 to 1. A part can stand out past its device's sides, as a shoulder key does. */
export const panFor = ({ part, device }: Contact): number => Math.max(-1, Math.min(1, 0.5 * (2 * (part.x + part.w / 2) / device.w - 1)));
