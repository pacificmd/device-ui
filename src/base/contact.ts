import type { DeviceInfo, Part } from './types.js';

// `stop` is a part hitting the end of its travel. `rub` is a part dragged along with nothing to catch on, and keeps coming for as long as it moves.
export type ContactKind = 'press' | 'release' | 'toggle' | 'detent' | 'stop' | 'rub';

/** The mechanism behind a contact, for whatever listens. Packs declare these. */
export interface ContactMotion {
  joint: 'press' | 'slide' | 'turn' | 'hinge' | 'spring' | 'pluck' | 'sheaf';
  /** What's touching what, such as `steel-on-steel`. */
  material: string;
  /** Grams, as felt at the hand. */
  mass: number;
  /** Something pushes it home. */
  returns: boolean;
  /** Has an arrival of its own, as a throw does. */
  arrives?: boolean;
  /** It's a recording by name, in place of what the rest of this comes to. */
  sound?: string;
  /** Stays down until it's pressed again. */
  latch?: boolean;
  /** Seen edge on. */
  rolled?: boolean;
}

/** Something touched something. Sound, haptics and a twitching needle all hear the same report. */
export interface Contact {
  kind: ContactKind;
  part: Part;
  device: DeviceInfo;
  /** What the moving piece is made of: the last surface its part painted. */
  material: string;
  /** How fast it was going, in its spring's units a second, about 10 for a key. For a detent, in detents a second. For a rub, in ranges a second. */
  speed: number;
  /** The spring's target when it arrived, so one way can be told from the other. */
  to?: number;
  /** The mechanism that made it, if one is declared. */
  motion?: ContactMotion;
}

const listeners = new Set<(c: Contact) => void>();

/** Calls `fn` for every contact on the page. Returns what stops it. */
export function onContact(fn: (c: Contact) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Reports a contact. Springs do this for themselves, so a part only calls it for something no spring can see. `heard: 'device'` is for a knock the case round it rings with, not the piece that moved.
 * A part with `quiet` reports none: it still moves, but makes no sound and no buzz, as a click wheel does with its clicker off. */
export function contact(part: Part | null, kind: ContactKind, speed: number, from?: { to?: number; motion?: ContactMotion; heard?: 'device' }): void {
  if (!part || !listeners.size || part.el.hasAttribute?.('quiet')) return;
  const device = (part.el.closest('d-device, [data-alone]') as (Element & { __d?: DeviceInfo }) | null)?.__d;
  if (!device) return;
  const motion = from?.motion ?? (part.def as { motion?: ContactMotion } | undefined)?.motion;
  const c: Contact = { kind, part, device, material: (from?.heard ? undefined : topSurface(part)) ?? device.material, speed, to: from?.to, motion };
  for (const fn of listeners) {
    // A listener that throws must not take the frame down with it.
    try {
      fn(c);
    } catch (e) {
      console.error(e);
    }
  }
}

function topSurface(part: Part): string | undefined {
  const commands = part.commands ?? [];
  for (let i = commands.length - 1; i >= 0; i--) {
    const c = commands[i]!;
    if (c.op === 'surface') return c.name;
  }
  return undefined;
}
