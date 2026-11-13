// A small playable synthesiser, made here and now from oscillators, for things with keys. Contacts are `sound()`.
import { audio, output, soon } from './audio.js';
const MOST = 16;
// Of the note's own pitch: how far the second oscillator can bend the first.
const DEPTH = 5;

/** What the player can change, 0 to 1 unless it says. */
export interface Tone {
  /** From a soft triangle to something full of edges. */
  shape: number;
  /** How far the filter is open. */
  bright: number;
  /** From a pluck to a held pad. */
  decay: number;
  /** How much goes round the echo. */
  echo: number;
  /** The second oscillator's pitch, as a multiple of the note's. Whole numbers ring in tune, others like bells and metal. Not a share. */
  ratio: number;
  /** How much more it bends the first at the start of a note, falling away as the note goes on: the bark of an electric piano or brass. */
  bite: number;
  /** A sine alone for the first oscillator, with no edges added, so all its overtones are the second's doing. */
  pure: boolean;
  /** Cents on everything sounding, for a bend. Not a share. */
  detune: number;
}

export interface NoteOptions {
  /** On the audio clock, for a note played ahead of time. */
  at?: number;
  /** Seconds. Left out, it's held until the function it returns is called. */
  length?: number;
  /** 0 to 1. */
  level?: number;
}

export interface Instrument {
  /** 0 to 1. */
  volume: number;
  /** How many notes are still making sound. */
  readonly sounding: number;
  /** The audio clock, or 0 before `wake`. */
  readonly now: number;
  /** Opens the audio device. Call it from a tap or a key, which is the browser's rule. */
  wake(): void;
  /** Sets any of the tone, and reaches the notes already sounding. */
  set(tone: Partial<Tone>): void;
  /** Starts a note, and returns what lets go of it. */
  play(hz: number, o?: NoteOptions): () => void;
  /** The last moments of output, -1 to 1, or null before `wake`. */
  scope(): Float32Array<ArrayBuffer> | null;
  /** Lets go of the audio device. */
  close(): void;
}

interface Voice {
  filter: BiquadFilterNode;
  pitched: OscillatorNode[];
  hz: number;
  over: number;
}

export function instrument(tone: Partial<Tone> = {}, volume = 0.7): Instrument {
  soon();
  const now: Tone = { shape: 0.3, bright: 0.6, decay: 0.3, echo: 0.2, ratio: 2, bite: 0, pure: false, detune: 0, ...tone };
  let ctx: AudioContext | null = null, mix: GainNode, send: GainNode, master: GainNode, scope: AnalyserNode, samples: Float32Array<ArrayBuffer>;
  const voices = new Set<Voice>();
  const cutoff = (hz: number) => Math.min(hz * 1.5 + 200 * 2 ** (now.bright * 6), 18000);
  const loudness = (v: number) => v * v * 1.6;

  const open = (c: AudioContext) => {
    mix = c.createGain();
    send = c.createGain();
    master = c.createGain();
    scope = c.createAnalyser();
    const delay = c.createDelay(1), back = c.createGain(), soft = c.createBiquadFilter(), limit = c.createDynamicsCompressor();
    scope.fftSize = 1024;
    samples = new Float32Array(scope.fftSize);
    delay.delayTime.value = 0.28;
    back.gain.value = 0.42;
    soft.type = 'lowpass';
    soft.frequency.value = 2600;
    send.gain.value = now.echo * 0.7;
    master.gain.value = loudness(volume);
    limit.threshold.value = -14;
    limit.ratio.value = 6;
    mix.connect(limit);
    mix.connect(send).connect(delay).connect(soft).connect(back).connect(delay);
    soft.connect(limit);
    limit.connect(master).connect(scope).connect(output());
  };

  return {
    get volume() {
      return volume;
    },
    set volume(v) {
      volume = v;
      if (ctx) master.gain.setTargetAtTime(loudness(v), ctx.currentTime, 0.02);
    },
    get sounding() {
      const t = ctx?.currentTime ?? 0;
      for (const v of voices) if (v.over < t) voices.delete(v);
      return voices.size;
    },
    get now() {
      return ctx?.currentTime ?? 0;
    },
    wake() {
      if (!ctx) open((ctx = audio()));
      else audio();
    },
    set(tone) {
      Object.assign(now, tone);
      if (!ctx) return;
      send.gain.setTargetAtTime(now.echo * 0.7, ctx.currentTime, 0.03);
      for (const v of voices) {
        v.filter.frequency.setTargetAtTime(cutoff(v.hz), ctx.currentTime, 0.02);
        for (const o of v.pitched) o.detune.setTargetAtTime(now.detune + (o === v.pitched[1] ? 6 : 0), ctx.currentTime, 0.01);
      }
    },
    play(hz, o = {}) {
      this.wake();
      const c = ctx!, t = Math.max(o.at ?? 0, c.currentTime), level = (o.level ?? 1) * 0.3;
      if (this.sounding >= MOST) voices.delete(voices.values().next().value!);
      const a = 0.003 + now.decay * 0.04, d = 0.09 + now.decay * 0.9, hold = now.decay ** 1.5 * 0.8, r = 0.07 + now.decay * 1.2;
      const body = c.createOscillator(), edge = c.createOscillator(), bend = c.createOscillator();
      const depth = c.createGain(), edges = c.createGain(), filter = c.createBiquadFilter(), amp = c.createGain();
      body.type = now.pure ? 'sine' : 'triangle';
      edge.type = 'sawtooth';
      bend.frequency.value = hz * now.ratio;
      body.frequency.value = edge.frequency.value = hz;
      body.detune.value = bend.detune.value = now.detune;
      edge.detune.value = now.detune + 6;
      const index = hz * DEPTH * now.shape ** 2;
      depth.gain.setValueAtTime(index + hz * DEPTH * now.bite, t);
      if (now.bite) depth.gain.setTargetAtTime(index, t, 0.03 + now.decay * 0.25);
      edges.gain.value = now.pure ? 0 : now.shape * 0.5;
      filter.type = 'lowpass';
      filter.Q.value = 1.2;
      filter.frequency.value = cutoff(hz);
      bend.connect(depth).connect(body.frequency);
      depth.connect(edge.frequency);
      body.connect(filter);
      edge.connect(edges).connect(filter);
      filter.connect(amp).connect(mix);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(level, t + a);
      amp.gain.setTargetAtTime(level * Math.max(hold, 0.001), t + a, d / 3);
      const v: Voice = { filter, pitched: [body, edge, bend], hz, over: Infinity };
      voices.add(v);
      for (const n of [body, edge, bend]) n.start(t);
      const off = (at: number) => {
        amp.gain.cancelScheduledValues(at);
        // From where the note has got to, since a fall from a value nobody set is a click.
        if (at <= c.currentTime + 0.001) amp.gain.setValueAtTime(amp.gain.value, at);
        amp.gain.setTargetAtTime(0, at, r / 4);
        v.over = at + r * 1.4;
        for (const n of [body, edge, bend]) n.stop(v.over);
        body.onended = () => amp.disconnect();
      };
      let done = o.length !== undefined;
      if (done) off(t + o.length!);
      return () => {
        if (!done) off(c.currentTime);
        done = true;
      };
    },
    scope() {
      if (!ctx) return null;
      scope.getFloatTimeDomainData(samples);
      return samples;
    },
    close() {
      voices.clear();
      master?.disconnect();
      ctx = null;
    },
  };
}
