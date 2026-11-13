// A drum kit you hit, and what plays it back in time. The voices are worked out sample by sample, then held at the sampler's own rate and depth,
// so the grit of an old drum machine comes from the same place it did: 12 bits at 40kHz. Nothing is downloaded.
import { audio, output, soon } from './audio.js';

/** Noise with a fixed seed: the same hit each time, from nothing but `t`. */
export const noise = (t: number): number => Math.sin(t * 91234.7) * Math.sin(t * 7341.9 + Math.sin(t * 51234));
export const kick = (t: number): number => Math.sin(Math.PI * 2 * (46 * t + 6 * (1 - Math.exp(-t * 28)))) * Math.exp(-t * 9) * 0.9;
export const snare = (t: number): number => (noise(t) * 0.5 + Math.sin(t * 1200) * 0.2) * Math.exp(-t * 16);
export const hat = (t: number): number => noise(t * 3.1) * Math.exp(-t * 70) * 0.22;

const square = (hz: number, t: number) => (Math.sin(Math.PI * 2 * hz * t) >= 0 ? 1 : -1);
// Six squares at no common pitch ring like metal.
const metal = (base: number, t: number) => [1, 1.5, 2.08, 2.715, 3.395, 4.105].reduce((sum, r) => sum + square(base * r, t), 0) / 6;
const tom = (hz: number) => (t: number) => Math.sin(Math.PI * 2 * (hz * t + (hz / 34) * (1 - Math.exp(-t * 34)))) * Math.exp(-t * 7) * 0.9 + noise(t) * Math.exp(-t * 200) * 0.2;
const backbeat = (hz: number, snap: number, tail: number) => (t: number) =>
  Math.sin(Math.PI * 2 * hz * t) * Math.exp(-t * 26) * 0.55 + Math.sin(Math.PI * 2 * hz * 1.48 * t) * Math.exp(-t * 34) * 0.3 + noise(t) * (snap * Math.exp(-t * tail) + 0.25 * Math.exp(-t * 90));
const clap = (t: number) => {
  const after = [0, 0.011, 0.023, 0.034].filter(d => d <= t).at(-1) ?? 0;
  return noise(t) * (t < 0.04 ? Math.exp(-(t - after) * 220) : Math.exp(-(t - 0.034) * 14)) * 0.9;
};

/** One pad's sound, as a function of seconds since the hit. */
export interface Pad {
  name: string;
  seconds: number;
  at(t: number): number;
  /** Takes its length from `decay`, and each hit cuts off the last. */
  choked?: boolean;
  /** Choked, but it keeps the length it was made with. */
  own?: boolean;
}

/** The sampler's rate. */
export const RATE = 40000;
/** The largest value 12 bits hold. */
const FULL = 2047;

/** The sixteen pads of a drum sampler, in the order they're numbered: hats and snares along the bottom, up through toms and cymbals to percussion. */
export const PADS: readonly Pad[] = [
  { name: 'HIHAT', seconds: 1.4, at: t => (metal(420, t) * 0.75 + noise(t * 3.1) * 0.35) * Math.exp(-t * 2.4) * 0.6, choked: true },
  { name: 'SNARE 1', seconds: 0.34, at: backbeat(196, 0.72, 15) },
  { name: 'SNARE 2', seconds: 0.5, at: backbeat(168, 0.6, 9) },
  { name: 'BASS', seconds: 0.5, at: t => kick(t) + noise(t) * Math.exp(-t * 420) * 0.3 },
  { name: 'TOM 1', seconds: 0.6, at: tom(196) },
  { name: 'TOM 2', seconds: 0.65, at: tom(147) },
  { name: 'TOM 3', seconds: 0.75, at: tom(110) },
  { name: 'TOM 4', seconds: 0.85, at: tom(82) },
  { name: 'RIDE 1', seconds: 1.8, at: t => (metal(610, t) * 0.5 + Math.sin(Math.PI * 2 * 3120 * t) * 0.12) * Math.exp(-t * 3) * 0.6 },
  { name: 'RIDE 2', seconds: 1.8, at: t => (metal(760, t) * 0.5 + Math.sin(Math.PI * 2 * 2480 * t) * 0.3 * Math.exp(-t * 9)) * Math.exp(-t * 3) * 0.6 },
  { name: 'CRASH 1', seconds: 2.2, at: t => (metal(530, t) * 0.5 + noise(t) * 0.5) * Math.exp(-t * 2.4) * 0.7 },
  { name: 'CRASH 2', seconds: 2.2, at: t => (metal(680, t) * 0.4 + noise(t * 1.3) * 0.6) * Math.exp(-t * 3.2) * 0.7 },
  { name: 'PERC 1', seconds: 0.3, at: t => (square(540, t) + square(800, t)) * 0.3 * (Math.exp(-t * 40) + Math.exp(-t * 11) * 0.5) },
  { name: 'PERC 2', seconds: 0.35, at: clap },
  { name: 'PERC 3', seconds: 0.08, at: t => (Math.sin(Math.PI * 2 * 1720 * t) * 0.8 + noise(t) * 0.3) * Math.exp(-t * 110) },
  { name: 'PERC 4', seconds: 0.4, at: t => Math.sin(Math.PI * 2 * (330 * t + 5 * (1 - Math.exp(-t * 60)))) * Math.exp(-t * 13) * 0.85 },
];

/** A pad's sound at the sampler's rate and depth. Every sample is a whole step of 12 bits. */
export function sampled(pad: Pad, rate = RATE, full = FULL): Float32Array<ArrayBuffer> {
  const n = Math.round(pad.seconds * rate), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, (n - 1 - i) / (rate * 0.01));
    out[i] = Math.round(Math.tanh(pad.at(i / rate) * 1.2) * fade * full) / full;
  }
  return out;
}

/** Ticks to the quarter note. */
export const PPQ = 96;
const SIXTEENTH = PPQ / 4;

/**
 * Where a tick really sounds, with the second sixteenth of each pair pushed late. `swing` is how much of the pair the first takes:
 * 0.5 is straight and 0.75 is a dotted feel.
 */
export function swung(tick: number, swing: number): number {
  const pair = SIXTEENTH * 2, at = ((tick % pair) + pair) % pair, start = tick - at, split = pair * swing;
  return start + (at < SIXTEENTH ? (at / SIXTEENTH) * split : split + ((at - SIXTEENTH) / SIXTEENTH) * (pair - split));
}

/** The straight tick something heard at `tick` belongs to: `swung` the other way. */
export function unswung(tick: number, swing: number): number {
  const pair = SIXTEENTH * 2, at = ((tick % pair) + pair) % pair, start = tick - at, split = pair * swing;
  return start + (at < split ? (at / split) * SIXTEENTH : SIXTEENTH + ((at - split) / (pair - split)) * SIXTEENTH);
}

export interface Note {
  tick: number;
  pad: number;
  level: number;
}

/** A loop of hits, on a straight grid. Swing is how it's played, not where it's stored. */
export class Sequence {
  notes: Note[] = [];
  bars: number;

  constructor(bars = 2) {
    this.bars = bars;
  }

  get ticks(): number {
    return this.bars * PPQ * 4;
  }

  /** Puts a hit heard at `tick` on the grid, every `grid` ticks, and stores it. A `grid` of 0 keeps it where it fell. */
  add(tick: number, pad: number, level: number, grid = SIXTEENTH, swing = 0.5): Note {
    const straight = unswung(tick, swing), note = { tick: (grid ? Math.round(straight / grid) * grid : Math.round(straight)) % this.ticks, pad, level };
    const same = this.notes.findIndex(n => n.tick === note.tick && n.pad === pad);
    if (same >= 0) this.notes.splice(same, 1);
    this.notes.push(note);
    return note;
  }

  /** Takes out one pad, or all of them. */
  erase(pad?: number): void {
    this.notes = pad === undefined ? [] : this.notes.filter(n => n.pad !== pad);
  }
}

export interface Drums {
  volume: number;
  /** How long the hihat rings, 0 to 1. */
  decay: number;
  /** The clock everything is timed against, in seconds. */
  readonly now: number;
  wake(): void;
  hit(pad: number, level?: number, at?: number): void;
  /** Works a pad's sound out again, after what it's made from has changed. */
  remake(pad: number): void;
  /** The metronome: a short tick. */
  click(accent: boolean, at: number): void;
  scope(): Float32Array<ArrayBuffer> | null;
  close(): void;
}

/** Another kit than the sampler's: its pads, and the rate and largest value they're held at. */
export interface KitOptions {
  pads?: readonly Pad[];
  rate?: number;
  full?: number;
}

export function drums(volume = 0.8, decay = 0.4, { pads = PADS, rate = RATE, full = FULL }: KitOptions = {}): Drums {
  soon();
  let ctx: AudioContext | null = null, master: GainNode, scope: AnalyserNode, samples: Float32Array<ArrayBuffer>, buffers: AudioBuffer[] = [], last: GainNode | null = null;
  const held = (c: AudioContext, pad: Pad) => {
    const data = sampled(pad, rate, full), b = c.createBuffer(1, data.length, rate);
    b.copyToChannel(data, 0);
    return b;
  };
  return {
    get volume() {
      return volume;
    },
    set volume(v) {
      volume = v;
      if (ctx) master.gain.setTargetAtTime(v * v, ctx.currentTime, 0.02);
    },
    get decay() {
      return decay;
    },
    set decay(v) {
      decay = v;
    },
    get now() {
      return ctx?.currentTime ?? 0;
    },
    wake() {
      if (ctx) {
        audio();
        return;
      }
      const c = (ctx = audio());
      master = c.createGain();
      master.gain.value = volume * volume;
      scope = c.createAnalyser();
      scope.fftSize = 2048;
      samples = new Float32Array(scope.fftSize);
      master.connect(scope).connect(output());
      buffers = pads.map(pad => held(c, pad));
    },
    remake(pad) {
      if (ctx) buffers[pad] = held(ctx, pads[pad]!);
    },
    hit(pad, level = 1, at) {
      this.wake();
      const c = ctx!, when = at ?? c.currentTime, source = c.createBufferSource(), gain = c.createGain();
      source.buffer = buffers[pad]!;
      gain.gain.value = level ** 1.6;
      source.connect(gain).connect(master);
      const { choked, own } = pads[pad]!;
      if (choked) {
        last?.gain.setTargetAtTime(0, when, 0.004);
        if (!own) gain.gain.setTargetAtTime(0, when + 0.01, 0.012 + decay * decay * 0.5);
        last = gain;
      }
      source.start(when);
    },
    click(accent, at) {
      const c = ctx!, tone = c.createOscillator(), gain = c.createGain();
      tone.type = 'square';
      tone.frequency.value = accent ? 1600 : 1100;
      gain.gain.setValueAtTime(0.14, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.03);
      tone.connect(gain).connect(master);
      tone.start(at);
      tone.stop(at + 0.04);
    },
    scope() {
      if (!ctx) return null;
      scope.getFloatTimeDomainData(samples);
      return samples;
    },
    close() {
      master?.disconnect();
      ctx = last = null;
    },
  };
}

export interface Sequencer {
  bpm: number;
  swing: number;
  /** Ticks on the metronome while it plays. */
  metronome: boolean;
  /** Called with each note as it's scheduled. */
  onnote?: (note: Note, at: number) => void;
  readonly playing: boolean;
  /** The straight tick the playhead is on. */
  readonly tick: number;
  play(): void;
  stop(): void;
}

/** How far ahead of the audio clock it works, in seconds, so a slow frame doesn't move a hit. */
const AHEAD = 0.12;

export function sequencer(kit: Drums, sequence: Sequence, bpm = 90, swing = 0.5): Sequencer {
  let timer: ReturnType<typeof setInterval> | null = null, next = 0, time = 0;
  const length = () => 60 / self.bpm / PPQ;
  const pump = () => {
    while (time < kit.now + AHEAD) {
      const at = next % sequence.ticks;
      for (const note of sequence.notes) {
        if (note.tick !== at) continue;
        const when = Math.max(time + (swung(at, self.swing) - at) * length(), kit.now);
        kit.hit(note.pad, note.level, when);
        self.onnote?.(note, when);
      }
      if (self.metronome && at % PPQ === 0) kit.click(at % (PPQ * 4) === 0, Math.max(time, kit.now));
      next++;
      time += length();
    }
  };
  const self: Sequencer = {
    bpm,
    swing,
    metronome: false,
    get playing() {
      return timer !== null;
    },
    get tick() {
      return timer === null ? 0 : (((next - (time - kit.now) / length()) % sequence.ticks) + sequence.ticks) % sequence.ticks;
    },
    play() {
      if (timer !== null) return;
      kit.wake();
      next = 0;
      time = kit.now + 0.05;
      pump();
      timer = setInterval(pump, 25);
    },
    stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    },
  };
  return self;
}
