// One voice of subtractive synthesis, worked out sample by sample: three oscillators into a mixer, a transistor ladder filter
// and two contours. `instrument()` is the many small notes of a keyboard. This is the single fat one of a monosynth, which needs
// a filter a biquad can't be: its cutoff moves at audio rate, its four stages saturate, and with enough feedback it sings by itself.
import { audio, output, worklet, soon } from './audio.js';

/** What the panel sets. A share is 0 to 1, and it's the voice that knows what a share means in seconds or octaves. */
export interface Patch {
  /** Share. The middle is in tune, the ends two semitones out. */
  tune: number;
  /** Share, how long a note takes to slide to the next. */
  glide: number;
  glideOn: boolean;
  /** Share, between the first modulation source and the second. */
  blend: number;
  /** The first source is the filter contour, not the third oscillator. */
  contourSource: boolean;
  /** The second source is the slow oscillator, not noise. */
  lfoSource: boolean;
  /** Share, how much modulation gets through. */
  wheel: number;
  /** -1 to 1, a bend of up to five semitones. */
  bend: number;
  /** Modulation reaches the oscillators. */
  modPitch: boolean;
  /** Modulation reaches the filter. */
  modFilter: boolean;
  /** The third oscillator follows the keys and the modulation. Off, it runs free, as a slow source. */
  thirdFollows: boolean;
  /** Each oscillator's range: 0 very low, then 32', 16', 8', 4' and 2'. */
  range: [number, number, number];
  /** Each oscillator's wave: 0 triangle, 1 triangle-saw (a reverse saw on the third), 2 saw, 3 square, 4 wide pulse, 5 narrow pulse. */
  wave: [number, number, number];
  /** Semitones each oscillator is off from the keys. */
  detune: [number, number, number];
  /** Shares, each oscillator in the mixer. */
  level: [number, number, number];
  on: [boolean, boolean, boolean];
  /** Share, noise in the mixer. */
  noise: number;
  noiseOn: boolean;
  pink: boolean;
  /** Share, the output sent back into the mixer, as with a lead from the phones to the external input. */
  loop: number;
  loopOn: boolean;
  /** Share, where the filter sits. */
  cutoff: number;
  /** Share, how much of the ladder's output goes back in. It starts to sing near the top. */
  emphasis: number;
  /** Share, how far the filter contour moves the cutoff. */
  amount: number;
  /** The filter follows the keys by a third. */
  followOne: boolean;
  /** The filter follows the keys by two thirds. */
  followTwo: boolean;
  /** Shares of the filter contour. */
  filterAttack: number;
  filterDecay: number;
  filterSustain: number;
  /** Shares of the loudness contour. */
  ampAttack: number;
  ampDecay: number;
  ampSustain: number;
  /** A released key dies away over the decay time, not at once. */
  decay: boolean;
  /** Share, how fast the slow oscillator runs. */
  lfo: number;
  /** A steady A at 440Hz, to tune by. */
  tone: boolean;
  /** The output is switched on. */
  output: boolean;
}

export const PATCH: Patch = {
  tune: 0.5, glide: 0, glideOn: false, blend: 0, contourSource: false, lfoSource: false, wheel: 0, bend: 0, modPitch: false, modFilter: false, thirdFollows: true,
  range: [3, 3, 3], wave: [2, 2, 2], detune: [0, 0, 0], level: [1, 0, 0], on: [true, false, false], noise: 0, noiseOn: false, pink: false, loop: 0, loopOn: false,
  cutoff: 0.6, emphasis: 0.2, amount: 0.4, followOne: false, followTwo: false, filterAttack: 0.1, filterDecay: 0.4, filterSustain: 0.4, ampAttack: 0.05, ampDecay: 0.4, ampSustain: 0.8,
  decay: true, lfo: 0.4, tone: false, output: true,
};

/** Runs alone inside a worklet, written out from its own source, so it reaches for nothing outside itself and has no class fields. */
export class MonoVoice {
  rate: number;
  patch: Patch;
  held: number[];
  /** 0 to 1, how far the mixer is being driven past clean. Falls away by itself. */
  overload: number;
  /** Hz, where the filter is now. */
  hz: number;
  private osc: Float64Array;
  private drift: Float64Array;
  private inc: Float64Array;
  private stage: Float64Array;
  private tan: Float64Array;
  private delay: Float64Array;
  private pinkState: Float64Array;
  private note: number;
  private pitch: number;
  private gate: boolean;
  private filterStep: number;
  private ampStep: number;
  private filterEnv: number;
  private ampEnv: number;
  private lfoPhase: number;
  private beep: number;
  private seed: number;
  private tick: number;
  private tune: number;
  private feedback: number;
  private last: number;
  private third: number;
  private noiseNow: number;

  constructor(rate: number, patch: Patch) {
    this.rate = rate;
    this.patch = patch;
    this.held = [];
    this.overload = 0;
    this.hz = 1000;
    this.osc = new Float64Array([0.1, 0.37, 0.71]);
    this.drift = new Float64Array(3);
    this.inc = new Float64Array(3);
    this.stage = new Float64Array(4);
    this.tan = new Float64Array(3);
    this.delay = new Float64Array(6);
    this.pinkState = new Float64Array(3);
    this.note = 60;
    this.pitch = 60;
    this.gate = false;
    this.filterStep = 0;
    this.ampStep = 0;
    this.filterEnv = 0;
    this.ampEnv = 0;
    this.lfoPhase = 0;
    this.beep = 0;
    this.seed = 22222;
    this.tick = 0;
    this.tune = 0;
    this.feedback = 0;
    this.last = 0;
    this.third = 0;
    this.noiseNow = 0;
  }

  /** The lowest key held sounds, and the contours fire only on the first of a run of held keys, as on the Model D's single trigger. */
  press(key: number): void {
    if (this.held.indexOf(key) < 0) this.held.push(key);
    const first = !this.gate;
    this.note = Math.min(...this.held);
    if (first) {
      this.gate = true;
      this.filterStep = this.ampStep = 1;
      if (!this.patch.glideOn) this.pitch = this.note;
    }
  }

  release(key: number): void {
    this.held = this.held.filter(k => k !== key);
    if (this.held.length) this.note = Math.min(...this.held);
    else {
      this.gate = false;
      this.filterStep = this.ampStep = 3;
    }
  }

  private random(): number {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x | 0;
    return (x | 0) / 2147483648;
  }

  /** A step in a wave is what aliases, so this rounds it off over one sample each side. */
  private blep(t: number, dt: number): number {
    if (t < dt) {
      const x = t / dt;
      return x + x - x * x - 1;
    }
    if (t > 1 - dt) {
      const x = (t - 1) / dt;
      return x * x + x + x + 1;
    }
    return 0;
  }

  private wave(i: number, shape: number, p: number, dt: number): number {
    const saw = 2 * p - 1 - this.blep(p, dt), tri = 4 * Math.abs(p - 0.5) - 1;
    if (shape === 0) return tri;
    if (shape === 1) return i === 2 ? -saw : (tri + saw) * 0.5;
    if (shape === 2) return saw;
    const w = shape === 3 ? 0.5 : shape === 4 ? 0.3 : 0.1, q = (p - w + 1) % 1;
    return (p < w ? 1 : -1) + this.blep(p, dt) - this.blep(q, dt);
  }

  /** A contour one sample on. `step` 1 climbs, 2 falls to sustain, 3 dies away, 0 is done. */
  private contour(env: number, step: number, attack: number, decay: number, sustain: number): [number, number] {
    if (step === 1) {
      env += (1.25 - env) * attack;
      if (env >= 1) return [1, 2];
      return [env, 1];
    }
    if (step === 2) return [env + (sustain - env) * decay, 2];
    if (step === 3) {
      env += (0 - env) * (this.patch.decay ? decay : 300 / this.rate);
      return env < 0.00001 ? [0, 0] : [env, 3];
    }
    return [env, 0];
  }

  /** The slow work, every few samples: where each oscillator and the filter should be. */
  private control(n: number): void {
    const p = this.patch, r = this.rate;
    const spell = (share: number, from: number, range: number) => 1 - Math.exp(-1 / (from * range ** share * r / n));
    // Glide runs to a third of the way in this long, as a capacitor does.
    this.pitch = p.glideOn && p.glide > 0.001 ? this.pitch + (this.note - this.pitch) * (1 - Math.exp(-n / (r * 3 * p.glide * p.glide + 1))) : this.note;
    this.lfoPhase = (this.lfoPhase + (0.1 * 300 ** p.lfo * n) / r) % 1;
    const lfo = 4 * Math.abs(this.lfoPhase - 0.5) - 1;
    const first = p.contourSource ? this.filterEnv : this.third, second = p.lfoSource ? lfo : this.noiseNow;
    const mod = (first * (1 - p.blend) + second * p.blend) * p.wheel * p.wheel;

    const octave = [-8, -2, -1, 0, 1, 2];
    const bend = (p.tune - 0.5) * 4 + p.bend * 5 + (p.modPitch ? mod * 12 : 0);
    for (let i = 0; i < 3; i++) {
      this.drift[i] = this.drift[i]! * 0.9995 + this.random() * 0.0008;
      const free = i === 2 && !p.thirdFollows;
      const at = (free ? 60 : this.pitch + bend) + octave[p.range[i]!]! * 12 + p.detune[i]! + this.drift[i]!;
      this.inc[i] = Math.min((440 * 2 ** ((at - 69) / 12)) / r, 0.45);
    }

    const a = spell(p.filterAttack, 0.001, 10000), d = spell(p.filterDecay, 0.004, 5000);
    for (let k = 0; k < n; k++) {
      [this.filterEnv, this.filterStep] = this.contour(this.filterEnv, this.filterStep, 1 - (1 - a) ** (1 / n), 1 - (1 - d) ** (1 / n), p.filterSustain);
    }
    const follow = (p.followOne ? 1 / 3 : 0) + (p.followTwo ? 2 / 3 : 0);
    const octaves = p.cutoff * 9 + this.filterEnv * p.amount * 4 + (follow * (this.pitch - 60)) / 12 + (p.modFilter ? mod * 3 : 0);
    const hz = Math.min(40 * 2 ** octaves, r * 0.42);
    this.hz = hz;
    // Huovilainen's fit of the tuning and the resonance to the stages' real delay, run at twice the rate.
    const fc = hz / r, f = fc * 0.5, fcr = 1.873 * fc * fc * fc + 0.4955 * fc * fc - 0.649 * fc + 0.9988, acr = -3.9364 * fc * fc + 1.8409 * fc + 0.9968;
    this.tune = 1 - Math.exp(-2 * Math.PI * f * fcr);
    this.feedback = 4 * Math.min(p.emphasis * 1.08, 1.08) * acr;
    this.overload *= 0.995;
  }

  private sat(x: number): number {
    const v = x > 3 ? 3 : x < -3 ? -3 : x;
    return (v * (27 + v * v)) / (27 + 9 * v * v);
  }

  /** The ladder: four stages in a row, each saturating, and the end of them fed back in, opposite way up. */
  private ladder(x: number): number {
    const s = this.stage, t = this.tan, d = this.delay, g = this.tune, HEAT = 0.8;
    for (let i = 0; i < 2; i++) {
      const input = x - this.feedback * d[5]!;
      const a = (s[0] = d[0]! + (g / HEAT) * (this.sat(input * HEAT) - t[0]!));
      d[0] = a;
      t[0] = this.sat(a * HEAT);
      const b = (s[1] = d[1]! + (g / HEAT) * (t[0] - t[1]!));
      d[1] = b;
      t[1] = this.sat(b * HEAT);
      const c = (s[2] = d[2]! + (g / HEAT) * (t[1] - t[2]!));
      d[2] = c;
      t[2] = this.sat(c * HEAT);
      const e = (s[3] = d[3]! + (g / HEAT) * (t[2] - this.sat(d[3]! * HEAT)));
      d[3] = e;
      d[5] = (e + d[4]!) * 0.5;
      d[4] = e;
    }
    if (!(Math.abs(d[5]!) < 8)) {
      s.fill(0);
      t.fill(0);
      d.fill(0);
    }
    return d[5]!;
  }

  /** Fills `out` with what the voice says next. */
  render(out: Float32Array): void {
    const p = this.patch, r = this.rate, EVERY = 4;
    const ampAttack = 1 - Math.exp(-1 / (0.001 * 10000 ** p.ampAttack * r)), ampDecay = 1 - Math.exp(-1 / (0.004 * 5000 ** p.ampDecay * r));
    for (let i = 0; i < out.length; i++) {
      if (this.tick++ % EVERY === 0) this.control(EVERY);
      let mixed = 0, third = 0;
      for (let k = 0; k < 3; k++) {
        const dt = this.inc[k]!, q = (this.osc[k]! + dt) % 1;
        this.osc[k] = q;
        const v = this.wave(k, p.wave[k]!, q, dt);
        if (k === 2) third = v;
        if (p.on[k]) mixed += v * p.level[k]! * p.level[k]!;
      }
      this.third = third;
      const white = this.random();
      const q = this.pinkState;
      q[0] = 0.99765 * q[0]! + white * 0.099046;
      q[1] = 0.963 * q[1]! + white * 0.2965164;
      q[2] = 0.57 * q[2]! + white * 1.0526913;
      const noise = p.pink ? (q[0]! + q[1]! + q[2]! + white * 0.1848) * 0.2 : white;
      this.noiseNow = noise;
      if (p.noiseOn) mixed += noise * p.noise * p.noise;
      if (p.loopOn) mixed += this.last * p.loop * 2.5;
      const drive = Math.abs(mixed) * 0.62;
      if (drive > 0.95) this.overload = 1;
      const filtered = this.ladder(mixed * 0.62 * (1 + p.emphasis * 0.7));
      [this.ampEnv, this.ampStep] = this.contour(this.ampEnv, this.ampStep, ampAttack, ampDecay, p.ampSustain);
      this.last = filtered * this.ampEnv;
      this.beep = (this.beep + 440 / r) % 1;
      const tone = p.tone ? Math.sin(this.beep * Math.PI * 2) * 0.3 : 0;
      out[i] = p.output ? this.last * 0.8 + tone : 0;
    }
  }
}

export interface Mono {
  /** 0 to 1. */
  volume: number;
  /** Where the filter is now, Hz, as of the last moment. */
  readonly cutoff: number;
  /** 0 to 1, how hard the mixer is being driven. */
  readonly overload: number;
  /** The loudest of the last moment. */
  readonly peak: number;
  /** Opens the audio device. Call it from a tap or a key, which is the browser's rule. */
  wake(): Promise<void>;
  /** Changes any of the patch, and reaches the note already sounding. */
  set(patch: Partial<Patch>): void;
  /** A key goes down, as a MIDI note. */
  press(key: number): void;
  /** A key comes up. */
  release(key: number): void;
  /** The last moments of output, -1 to 1, or null before `wake`. */
  scope(): Float32Array<ArrayBuffer> | null;
  /** Lets go of the audio device. */
  close(): void;
}

const WORKLET = `const Voice = (${MonoVoice.toString()});
class Run extends AudioWorkletProcessor {
  constructor(o) {
    super();
    this.voice = new Voice(sampleRate, o.processorOptions.patch);
    this.left = 0;
    this.peak = 0;
    this.port.onmessage = ({ data: m }) => {
      if (m.end) this.ended = true;
      if (m.set) Object.assign(this.voice.patch, m.set);
      if (m.press !== undefined) this.voice.press(m.press);
      if (m.release !== undefined) this.voice.release(m.release);
    };
  }
  process(_, outputs) {
    if (this.ended) return false;
    const out = outputs[0][0];
    if (!out) return true;
    this.voice.render(out);
    for (let i = 1; i < outputs[0].length; i++) outputs[0][i].set(out);
    for (let i = 0; i < out.length; i++) this.peak = Math.max(this.peak, Math.abs(out[i]));
    if ((this.left -= out.length) <= 0) {
      this.left = 2048;
      this.port.postMessage({ hz: this.voice.hz, overload: this.voice.overload, peak: this.peak });
      this.peak = 0;
    }
    return true;
  }
}
registerProcessor('mono-voice', Run);
`;

export function mono(patch: Partial<Patch> = {}, volume = 0.7): Mono {
  soon();
  const now: Patch = { ...PATCH, ...patch };
  let ctx: AudioContext | null = null, node: AudioWorkletNode | null = null, master: GainNode | undefined, scope: AnalyserNode, samples: Float32Array<ArrayBuffer>, opening: Promise<void> | null = null;
  let cutoff = 0, overload = 0, peak = 0;
  const waiting: object[] = [];
  const send = (m: object) => (node ? node.port.postMessage(m) : waiting.push(m));
  const loudness = (v: number) => v * v;

  return {
    get volume() {
      return volume;
    },
    set volume(v) {
      volume = v;
      // Until the worklet is in, there's no master yet. It takes this volume when it's made.
      if (ctx && master) master.gain.setTargetAtTime(loudness(v), ctx.currentTime, 0.02);
    },
    get cutoff() {
      return cutoff;
    },
    get overload() {
      return overload;
    },
    get peak() {
      return peak;
    },
    wake() {
      return (opening ??= (async () => {
        const c = (ctx = audio());
        await worklet('mono-voice', WORKLET);
        node = new AudioWorkletNode(c, 'mono-voice', { numberOfInputs: 0, outputChannelCount: [2], processorOptions: { patch: now } });
        node.port.onmessage = ({ data: m }) => {
          cutoff = m.hz;
          overload = m.overload;
          peak = m.peak;
        };
        master = c.createGain();
        scope = c.createAnalyser();
        scope.fftSize = 2048;
        samples = new Float32Array(scope.fftSize);
        master.gain.value = loudness(volume);
        node.connect(master).connect(scope).connect(output());
        for (const m of waiting.splice(0)) node.port.postMessage(m);
      })());
    },
    set(patch) {
      Object.assign(now, patch);
      send({ set: patch });
    },
    press(key) {
      void this.wake();
      if (ctx) audio();
      send({ press: key });
    },
    release(key) {
      send({ release: key });
    },
    scope() {
      if (!node) return null;
      scope.getFloatTimeDomainData(samples);
      return samples;
    },
    close() {
      // Its voice runs for as long as it's told to, so it's told to stop, then let go.
      node?.port.postMessage({ end: true });
      node?.disconnect();
      ctx = node = opening = null;
    },
  };
}
