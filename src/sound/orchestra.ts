// What a pit orchestra has that the synthesisers don't: a skin struck and left to ring, strings bowed, and people singing. All are worked out
// ahead of time, as the kit's pads are, into plain samples for the page to play however it likes.

/** The same numbers every time from the same seed, so a sound is the same sound every time. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scales a sound so its loudest moment is `level`, and makes sure it ends on nothing, so it never clicks off. */
function finish(chans: Float32Array[], level: number, rate: number): void {
  let top = 0;
  for (const d of chans) for (const v of d) top = Math.max(top, Math.abs(v));
  const k = top ? level / top : 0, tail = Math.min(Math.round(rate * 0.02), chans[0]!.length);
  for (const d of chans) {
    for (let i = 0; i < d.length; i++) d[i]! *= k;
    for (let i = 0; i < tail; i++) d[d.length - 1 - i]! *= i / tail;
  }
}

export interface Strike {
  /** The note it's tuned to. */
  hz: number;
  /** How long to work out. */
  seconds?: number;
  /** 0 lets it ring, 1 is a hand laid on the skin. */
  damp?: number;
  /** 0 a soft felt head, 1 a hard wooden one: how much of the blow itself is heard. */
  mallet?: number;
  /** How far sharp the skin starts, as a share, while it's stretched by the blow. */
  glide?: number;
  /** The loudest it gets. */
  level?: number;
}

/**
 * A kettle drum, struck once. A round skin rings in modes that don't make a chord, but the air in the kettle pulls the ones a
 * player strikes near the rim into a rough harmonic series, so it has a note. Under that note is the thud of the whole skin
 * moving at once, which dies fast, and over it the knock of the stick, which dies faster.
 */
export function membrane(rate: number, o: Strike): Float32Array<ArrayBuffer> {
  const { hz, seconds = 2.5, damp = 0, mallet = 0.3, glide = 0.04, level = 0.8 } = o;
  const out = new Float32Array(Math.ceil(seconds * rate)), random = seeded(Math.round(hz * 100));
  // Ratio to the note, how loud, how many seconds to die by two thirds. The first is the skin as a whole.
  const modes: [number, number, number][] = [[0.62, 0.7, 0.18], [1, 1, 1.8], [1.5, 0.45, 1.3], [1.98, 0.3, 1], [2.44, 0.18, 0.75], [2.94, 0.1, 0.6], [3.42, 0.06, 0.45]];
  const life = 1 - damp * 0.85;
  for (const [ratio, gain, decay] of modes) {
    let phase = random() * Math.PI * 2;
    const tau = decay * life;
    for (let i = 0; i < out.length; i++) {
      const t = i / rate, sharp = 1 + glide * Math.exp(-t / 0.09);
      phase += (2 * Math.PI * hz * ratio * sharp) / rate;
      out[i]! += Math.sin(phase) * gain * Math.exp(-t / tau);
    }
  }
  // The stick: a few ms of noise, darker for felt.
  const knock = Math.round(rate * 0.012), smooth = 0.15 + mallet * 0.7;
  let lp = 0;
  for (let i = 0; i < knock; i++) {
    lp += ((random() * 2 - 1) - lp) * smooth;
    out[i]! += lp * (1 - i / knock) ** 2 * (0.4 + mallet * 1.2);
  }
  finish([out], level, rate);
  return out;
}

export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u';

// Where a voice's throat rings for each vowel, in Hz, and how loud each ring is: an alto's, between a man's and a woman's.
const FORMANTS: Record<Vowel, [number, number][]> = {
  a: [[800, 1], [1150, 0.5], [2900, 0.18]],
  e: [[400, 1], [1600, 0.35], [2700, 0.2]],
  i: [[350, 1], [1700, 0.25], [2700, 0.2]],
  o: [[450, 1], [800, 0.4], [2830, 0.08]],
  u: [[325, 1], [700, 0.25], [2700, 0.05]],
};

export interface Sing {
  /** The chord, in Hz. Each note gets its own section. */
  notes: number[];
  seconds: number;
  vowel?: Vowel;
  /** Singers to a note. More is smoother and wider. */
  voices?: number;
  /** Seconds to come in, and to die away at the end. */
  attack?: number;
  release?: number;
  /** How wide the sections stand, 0 all in the middle to 1 from wall to wall. */
  spread?: number;
  /** How far apart singers on one note are, in cents. */
  detune?: number;
  level?: number;
  seed?: number;
}

/**
 * A choir: singers on each note, none of them quite together, each with their own vibrato, through a throat shaped for a vowel.
 * Returns the left and the right.
 */
export function choir(rate: number, o: Sing): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const { notes, seconds, vowel = 'a', voices = 4, attack = 0.6, release = 1, spread = 0.7, detune = 14, level = 0.8, seed = 7 } = o;
  const n = Math.ceil(seconds * rate), left = new Float32Array(n), right = new Float32Array(n), random = seeded(seed);
  const throat = new Float32Array(n), all = notes.length * voices;
  notes.forEach((hz, ni) => {
    for (let v = 0; v < voices; v++) {
      const k = ni * voices + v, pan = all > 1 ? ((k / (all - 1)) * 2 - 1) * spread : 0;
      const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
      const cents = (random() * 2 - 1) * detune, rateV = 4.6 + random() * 1.6, depth = 0.004 + random() * 0.004, late = random() * 0.25;
      let phase = random(), vib = random() * Math.PI * 2;
      const f0 = hz * 2 ** (cents / 1200);
      for (let i = 0; i < n; i++) {
        const t = i / rate;
        // Vibrato comes in after the note does, as a singer's does.
        vib += (2 * Math.PI * rateV) / rate;
        const f = f0 * (1 + Math.sin(vib) * depth * Math.min(t / 0.8, 1)), dt = f / rate;
        phase += dt;
        if (phase >= 1) phase -= 1;
        // A saw with its corners rounded off, so it doesn't alias: the glottis is a buzz.
        let saw = 2 * phase - 1;
        if (phase < dt) {
          const x = phase / dt;
          saw -= x + x - x * x - 1;
        } else if (phase > 1 - dt) {
          const x = (phase - 1) / dt;
          saw -= x * x + x + x + 1;
        }
        const env = Math.min(Math.max((t - late) / attack, 0), 1) * Math.min((seconds - t) / release, 1);
        left[i]! += saw * env * gl;
        right[i]! += saw * env * gr;
      }
    }
  });
  // Breath in the sound, a little.
  for (let i = 0; i < n; i++) throat[i] = (random() * 2 - 1) * 0.03 * Math.min(i / rate / attack, 1) * Math.min((seconds - i / rate) / release, 1);
  for (const d of [left, right]) {
    const shaped = new Float32Array(n);
    for (const [f, gain] of FORMANTS[vowel]) {
      // One resonance: a band-pass with its peak held at the gain, so wide and narrow rings sit level.
      const w = (2 * Math.PI * Math.min(f, rate * 0.45)) / rate, q = f / (60 + f * 0.06), alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
      const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < n; i++) {
        const x = d[i]! + throat[i]!, y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        shaped[i]! += y * gain;
      }
    }
    d.set(shaped);
  }
  finish([left, right], level, rate);
  return [left, right];
}

export interface Bow {
  /** The chord, in Hz. Each note gets its own desk of players. */
  notes: number[];
  seconds: number;
  /** Players to a note. More is smoother and wider. */
  players?: number;
  /** Seconds to come in, and to die away at the end. */
  attack?: number;
  release?: number;
  /** How the bow moves through the note: 0 held level, 1 a swell from nothing up to full at the end, -1 dying away from the start. */
  swell?: number;
  /** Where the bow sits: 0 over the fingerboard, veiled, to 1 near the bridge, bright and edgy. */
  bright?: number;
  /** How wide the desks stand, 0 all in the middle to 1 from wall to wall. */
  spread?: number;
  /** How far apart players on one note are, in cents. */
  detune?: number;
  level?: number;
  seed?: number;
}

/**
 * A string section, bowed. A bowed string is caught by the hair and let go once a cycle, so it moves as a saw does; no two
 * players are quite in tune or in time, each has their own vibrato, which comes in after the note does, and the hair rasps. A
 * wooden body then takes the top off, more over the fingerboard, and rings round its air and wood. Returns the left and the right.
 */
export function bow(rate: number, o: Bow): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const { notes, seconds, players = 4, attack = 0.8, release = 1.2, swell = 0, bright = 0.4, spread = 0.8, detune = 8, level = 0.8, seed = 11 } = o;
  const n = Math.ceil(seconds * rate), left = new Float32Array(n), right = new Float32Array(n), random = seeded(seed), all = notes.length * players;
  const shape = (t: number) => {
    const u = t / seconds, bowing = swell >= 0 ? 1 - swell + swell * u ** 1.6 : 1 + swell * u;
    return Math.min(t / attack, 1) * Math.min((seconds - t) / release, 1) * Math.max(0, bowing);
  };
  notes.forEach((hz, ni) => {
    for (let v = 0; v < players; v++) {
      const k = ni * players + v, pan = all > 1 ? ((k / (all - 1)) * 2 - 1) * spread : 0;
      const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
      const cents = (random() * 2 - 1) * detune, rateV = 5 + random() * 1.2, depth = 0.0025 + random() * 0.002, late = random() * 0.12;
      let phase = random(), vib = random() * Math.PI * 2;
      const f0 = hz * 2 ** (cents / 1200);
      for (let i = 0; i < n; i++) {
        const t = i / rate;
        vib += (2 * Math.PI * rateV) / rate;
        const f = f0 * (1 + Math.sin(vib) * depth * Math.min(Math.max(t - 0.3, 0) / 0.9, 1)), dt = f / rate;
        phase += dt;
        if (phase >= 1) phase -= 1;
        let saw = 2 * phase - 1;
        if (phase < dt) {
          const x = phase / dt;
          saw -= x + x - x * x - 1;
        } else if (phase > 1 - dt) {
          const x = (phase - 1) / dt;
          saw -= x * x + x + x + 1;
        }
        const env = shape(Math.max(t - late, 0)) * Math.min((seconds - t) / 0.02, 1);
        left[i]! += saw * env * gl;
        right[i]! += saw * env * gr;
      }
    }
  });
  // The hair on the string: a rasp that follows the bow.
  const rasp = 0.02 + bright * 0.05;
  for (let i = 0; i < n; i++) {
    const e = shape(i / rate) * rasp * Math.sqrt(all);
    left[i]! += (random() * 2 - 1) * e;
    right[i]! += (random() * 2 - 1) * e;
  }
  // The body: two poles of top cut, lower over the fingerboard, and the air and wood resonances added back in.
  const cut = 1 - Math.exp((-2 * Math.PI * (900 + bright * 4600)) / rate);
  for (const d of [left, right]) {
    let a = 0, b = 0;
    const dark = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      a += (d[i]! - a) * cut;
      b += (a - b) * cut;
      dark[i] = b;
    }
    const body = new Float32Array(n);
    for (const [f, gain] of [[280, 0.5], [460, 0.35], [2600, 0.12 + bright * 0.2]] as const) {
      const w = (2 * Math.PI * Math.min(f, rate * 0.45)) / rate, q = 2.5, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
      const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < n; i++) {
        const x = d[i]!, y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        body[i]! += y * gain;
      }
    }
    for (let i = 0; i < n; i++) d[i] = dark[i]! + body[i]!;
  }
  finish([left, right], level, rate);
  return [left, right];
}
