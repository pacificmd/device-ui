// Everything on the GPU, in one store. See S1 in docs/milestones/world-renderer.md.

/**
 * What an entry holds, in the order they're given back at the same worth: maps only matter to light again, a bake or a hold only to
 * light faster and a field only to paint; a picture is what's shown, and shrinks to its smallest sizes before it goes. What the stage
 * itself holds, its bench and its camera, is never given back, only sized to what's lit.
 */
export const KINDS = ['maps', 'bake', 'hold', 'field', 'picture', 'stage'] as const;
export type Kind = (typeof KINDS)[number];

/** What only a relight makes again, given back everywhere before anything a paint makes again: a field or a picture. */
const remade = (k: Kind) => +(k === 'field' || k === 'picture');

/** What holds it: a plate, or what it's the same for everything showing it, a field's shape and size. */
export type Owner = object | string;

interface Entry {
  owner: Owner;
  kind: Kind;
  /** Bytes it holds now. Asked, not told, so nothing it grows by goes uncounted. */
  size: () => number;
  /** Gives it back, all of it or, for a picture, all but its smallest sizes. */
  give: () => void;
  /** The squeeze it was made at, so what it would take unsqueezed is known. One that's made again as the squeeze changes says so as it goes. */
  at: () => number;
  /** Bytes it holds at its most, where what it holds comes and goes with its work: what the squeeze goes by, so that holds still. */
  most?: () => number;
}

/** How long it should stay. The engine judges what's on the stage each frame, and a field is judged as it's used. */
export interface Worth {
  /** The frame it was last shown or used in. What this frame shows or uses is never given back. */
  frame: number;
  /** 0 is in the window and 2 away from it, with fields between. */
  tier: number;
  /** How far from what's shown, in window px, or for a field how long since it was used, ms. The furthest goes first. */
  far: number;
}

const AWAY: Worth = { frame: -1, tier: 2, far: Infinity };

/** Fields are worth keeping less than anything near the window and more than anything away from it. */
export const FIELD_TIER = 1.5;

/**
 * Everything on the GPU in one place, under two limits: what isn't shown keeps no more than `keep`, and all of it no more than `ceiling`,
 * what the GPU holds. Room is made by giving back the least worth first. When what's shown is more than the ceiling, `squeeze` says how
 * much each side of what's drawn should shrink to fit, so a window too sharp to hold draws coarser and never blank.
 */
export class Store {
  private entries = new Map<Owner, Map<Kind, Entry>>();
  private worth = new Map<Owner, Worth>();
  frame = 0;
  /** The most what isn't shown holds, bytes. What's shown is held whatever it is, up to the ceiling. */
  keep = Infinity;
  /** The most the GPU holds, bytes: a guess until it refuses, and then what it held, less a margin. */
  ceiling = Infinity;
  /** What this frame shows, bytes, as it was last tallied. */
  shown = 0;
  /** How much each side shrinks, 0 to 1, as it was when what's shown was last tallied. */
  squeeze = 1;
  /** Bytes given back, and how many times the GPU refused, for the counts. */
  given = 0;
  refusals = 0;
  private refusedIn = -1;
  /**
   * What was held and kept at most, as last counted this frame, with all asked for since: anything given back or shown since only
   * makes less of either. Under both limits there's room without counting again.
   */
  private over: { frame: number; held: number; kept: number; ceiling: number; keep: number } | null = null;

  hold(owner: Owner, kind: Kind, size: () => number, give: () => void, at?: () => number, most?: () => number): void {
    let of = this.entries.get(owner);
    if (!of) this.entries.set(owner, (of = new Map()));
    const made = this.squeeze;
    of.set(kind, { owner, kind, size, give, at: at ?? (() => made), most });
  }

  /** It's gone, by its owner's doing: one kind, or all it holds. */
  drop(owner: Owner, kind?: Kind): void {
    const of = this.entries.get(owner);
    if (!of) return;
    if (kind) of.delete(kind);
    else of.clear();
    if (of.size) return;
    this.entries.delete(owner);
    this.worth.delete(owner);
  }

  judge(owner: Owner, tier: number, far: number, shown: boolean): void {
    const w = this.worth.get(owner);
    if (w) {
      w.tier = tier;
      w.far = far;
      if (shown) w.frame = this.frame;
    } else this.worth.set(owner, { frame: shown ? this.frame : -1, tier, far });
  }

  /** It's used this frame, whatever it was judged: being made, painted or lit, it stays. */
  use(owner: Owner): void {
    const w = this.worth.get(owner);
    if (w) w.frame = this.frame;
    else this.worth.set(owner, { frame: this.frame, tier: 0, far: 0 });
  }

  private shows(owner: Owner): boolean {
    return this.worth.get(owner)?.frame === this.frame;
  }

  get held(): number {
    let n = 0;
    for (const of of this.entries.values()) for (const e of of.values()) n += e.size();
    return n;
  }

  /** A new frame: what's shown is what it judges shown from here. */
  next(): void {
    this.frame++;
  }

  /**
   * Counts what this frame shows, and from it how much what's drawn has to shrink to fit under the ceiling. What's shown goes as the
   * square of a side, so what it would take unsqueezed is each entry over the square of the squeeze it was made at, and the squeeze is
   * what fills four fifths of the ceiling with that. An entry that holds more while it's worked on counts at its most there: a paint has
   * to fit, and a squeeze that let go with what the paint gave back would have it drawn at another size, and painted again for that. It shrinks at once and grows back a quarter a frame at most: what was given back
   * when the GPU refused isn't made again yet, and counted as nothing, it would let the squeeze out to where it was refused.
   */
  tally(): void {
    let shown = 0, full = 0;
    for (const [owner, of] of this.entries) {
      if (!this.shows(owner) && !of.has('stage')) continue;
      for (const e of of.values()) {
        const n = e.size();
        shown += n;
        full += (e.most?.() ?? n) / e.at() ** 2;
      }
    }
    this.shown = shown;
    const aim = Math.min(Math.max(Math.sqrt((this.ceiling * 0.8) / Math.max(full, 1)), 1 / 16), 1);
    this.squeeze = shown > this.ceiling || aim < this.squeeze ? aim : Math.min(aim, this.squeeze * 1.25);
  }

  /**
   * Gives back until what isn't shown is no more than `keep` and `need` more bytes fit under the ceiling, and says whether they do: first
   * what costs least to make again, and of that the least worth. What's shown is never given back. Both are counted as it is now, not as
   * a frame was tallied, so what's made between tallies is shown and never makes room by itself.
   */
  room(need = 0): boolean {
    // Every making asks, a few hundred a second while a page arrives, and counting goes through everything held.
    const o = this.over;
    if (o && o.frame === this.frame && o.ceiling === this.ceiling && o.keep === this.keep && o.held + need <= this.ceiling && o.kept + need <= this.keep) {
      o.held += need;
      o.kept += need;
      return true;
    }
    let held = 0, kept = 0;
    const order: { e: Entry; w: Worth }[] = [];
    for (const [owner, of] of this.entries) {
      const shown = this.shows(owner), w = this.worth.get(owner) ?? AWAY;
      for (const e of of.values()) {
        const n = e.size();
        held += n;
        if (shown || e.kind === 'stage') continue;
        kept += n;
        order.push({ e, w });
      }
    }
    const fits = () => held + need <= this.ceiling && kept <= this.keep;
    this.over = null;
    if (fits()) {
      // What's made for it may be for something not shown, so it counts as kept too.
      this.over = { frame: this.frame, held: held + need, kept: kept + need, ceiling: this.ceiling, keep: this.keep };
      return true;
    }
    order.sort((a, b) => remade(a.e.kind) - remade(b.e.kind) || b.w.tier - a.w.tier || b.w.far - a.w.far || KINDS.indexOf(a.e.kind) - KINDS.indexOf(b.e.kind));
    for (const { e } of order) {
      if (fits()) return true;
      const before = e.size();
      e.give();
      const after = this.entries.get(e.owner)?.get(e.kind) === e ? e.size() : 0;
      held -= before - after;
      kept -= before - after;
      this.given += before - after;
    }
    return fits();
  }

  /** What it holds of each kind, bytes. */
  kinds(): Record<Kind, number> {
    const out = Object.fromEntries(KINDS.map(k => [k, 0])) as Record<Kind, number>;
    for (const of of this.entries.values()) for (const e of of.values()) out[e.kind] += e.size();
    return out;
  }

  /** The GPU refused something: it holds no more than this, less a margin, from now on. */
  refused(): void {
    // One refusal a frame: the rest are what it was drawing into.
    if (this.refusedIn === this.frame) return;
    this.refusedIn = this.frame;
    this.refusals++;
    this.over = null;
    this.ceiling = Math.max(Math.min(this.ceiling, this.held) * 0.8, 64e6);
  }

  /** The context went, and everything on it. A new one may hold more. */
  lost(): void {
    this.over = null;
    this.entries.clear();
    this.worth.clear();
    this.shown = 0;
    this.squeeze = 1;
  }
}
