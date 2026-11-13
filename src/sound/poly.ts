// Six voices of subtractive synthesis with one set of controls, as on a polyphonic synthesiser of the early eighties: an oscillator with
// a pulse, a saw, a square an octave down and noise, each voice through its own ladder and its own contour, then one high-pass and a stereo bucket-brigade chorus
// over the lot. `mono()` is one fat voice with three oscillators. This is many thin ones, and most of what it sounds like is the chorus.
import { audio, output, worklet, soon } from './audio.js';

/** What the panel sets. A share is 0 to 1, and it's the voices that know what a share means in seconds or octaves. */
export interface PolyPatch {
  /** Share, how fast the slow oscillator runs. */
  lfoRate: number;
  /** Share, how long the slow oscillator takes to come in after a key. */
  lfoDelay: number;
  /** The slow oscillator comes in with the keys. Off, it comes in only while `trig` is on. */
  lfoAuto: boolean;
  trig: boolean;
  /** Share, how much the slow oscillator moves the pitch. */
  dcoLfo: number;
  /** Share, how narrow the pulse goes. */
  pwm: number;
  /** What moves the pulse: 0 the slow oscillator, 1 nothing, 2 the contour. */
  pwmMode: number;
  pulse: boolean;
  saw: boolean;
  sub: boolean;
  /** Shares, the square an octave down and noise in the mixer. */
  subLevel: number;
  noise: number;
  /** 0 is off, then three steps up. */
  hpf: number;
  /** Share, where the filter sits. */
  cutoff: number;
  /** Share. It starts to sing near the top. */
  resonance: number;
  /** The contour opens the filter. Off, it closes it. */
  envUp: boolean;
  /** Shares of the filter's modulation: the contour, the slow oscillator and how it follows the keys. */
  envAmount: number;
  vcfLfo: number;
  kybd: number;
  /** The voice is on while its key is down, and the contour only reaches the filter. */
  gate: boolean;
  /** Share, how loud each voice is. */
  level: number;
  /** Shares of the contour. */
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  /** 0 off, 1 slow, 2 faster, 3 both at once, which is quick and shallow. */
  chorus: number;
  /** Keys stay down after they're let go, until the next chord or until this goes off. */
  hold: boolean;
  /** The keys held play one at a time. */
  arp: boolean;
  /** 0 up, 1 up and down, 2 down. */
  arpMode: number;
  /** How many octaves it runs over, 1 to 3. */
  arpRange: number;
  /** Share, how fast it runs. */
  arpRate: number;
  /** -1 to 1, the lever. */
  bend: number;
  /** Shares, how far the lever takes the pitch and the filter. */
  bendDco: number;
  bendVcf: number;
  /** Semitones on everything played. */
  transpose: number;
  /** The output is switched on. */
  output: boolean;
}

export const POLY: PolyPatch = {
  lfoRate: 0.45, lfoDelay: 0, lfoAuto: true, trig: false, dcoLfo: 0, pwm: 0.4, pwmMode: 1, pulse: false, saw: true, sub: false, subLevel: 0.5, noise: 0, hpf: 0,
  cutoff: 0.65, resonance: 0.15, envUp: true, envAmount: 0.2, vcfLfo: 0, kybd: 0.5, gate: false, level: 0.7, attack: 0.1, decay: 0.4, sustain: 0.6, release: 0.35,
  chorus: 1, hold: false, arp: false, arpMode: 0, arpRange: 1, arpRate: 0.5, bend: 0, bendDco: 0.2, bendVcf: 0, transpose: 0, output: true,
};

/** Runs alone inside a worklet, written out from its own source, so it reaches for nothing outside itself and has no class fields. */
export class PolyVoices {
  rate: number;
  patch: PolyPatch;
  /** Keys the player has down right now. */
  down: number[];
  /** Keys that are sounding, or being arpeggiated. With `hold` on, this outlasts `down`. */
  held: number[];
  /** Each voice's key, or -1. Up to date for anything watching. */
  notes: Int16Array;
  /** Each voice's key is down. */
  gates: Uint8Array;
  private keyOf: Float64Array;
  private born: Float64Array;
  private phase: Float64Array;
  private inc: Float64Array;
  private width: Float64Array;
  private square: Float64Array;
  private env: Float64Array;
  private step: Uint8Array;
  private amp: Float64Array;
  private tune: Float64Array;
  private feedback: Float64Array;
  private ladders: Float64Array;
  private hp: Float64Array;
  private line: Float32Array;
  private write: number;
  private chorusAt: Float64Array;
  private wetL: number;
  private wetR: number;
  private lfoPhase: number;
  private lfoNow: number;
  private lfoIn: number;
  private lfoWait: number;
  private seed: number;
  private tick: number;
  private clock: number;
  private arpAt: number;
  private arpLeft: number;
  private arpGate: number;
  private arpNote: number;
  private arpDir: number;
  private settled: number;

  constructor(rate: number, patch: PolyPatch) {
    const n = 6;
    this.rate = rate;
    this.patch = patch;
    this.down = [];
    this.held = [];
    this.notes = new Int16Array(n).fill(-1);
    this.gates = new Uint8Array(n);
    this.keyOf = new Float64Array(n).fill(60);
    this.born = new Float64Array(n);
    // They never line up, or a chord would start as one loud click.
    this.phase = new Float64Array([0.1, 0.37, 0.71, 0.53, 0.89, 0.23]);
    this.inc = new Float64Array(n);
    this.width = new Float64Array(n).fill(0.5);
    this.square = new Float64Array(n).fill(1);
    this.env = new Float64Array(n);
    this.step = new Uint8Array(n);
    this.amp = new Float64Array(n);
    this.tune = new Float64Array(n);
    this.feedback = new Float64Array(n);
    // Each voice keeps nine numbers: four stages, three stored saturations and two for the half-sample average.
    this.ladders = new Float64Array(n * 9);
    this.hp = new Float64Array(4);
    this.line = new Float32Array(Math.ceil(rate * 0.02));
    this.write = 0;
    this.chorusAt = new Float64Array(2);
    this.wetL = 0;
    this.wetR = 0;
    this.lfoPhase = 0;
    this.lfoNow = 0;
    this.lfoIn = 0;
    this.lfoWait = 0;
    this.seed = 22222;
    this.tick = 0;
    this.clock = 0;
    this.arpAt = -1;
    this.arpLeft = 0;
    this.arpGate = 0;
    this.arpNote = -1;
    this.arpDir = 1;
    this.settled = 0;
  }

  /** Which voice takes a new key: the one already on it, else the free one that's been quiet longest, else the oldest down. */
  private allocate(key: number): number {
    let free = -1, oldest = 0;
    for (let i = 0; i < 6; i++) {
      if (this.notes[i] === key) return i;
      if (!this.gates[i] && (free < 0 || this.born[i]! < this.born[free]!)) free = i;
      if (this.born[i]! < this.born[oldest]!) oldest = i;
    }
    return free >= 0 ? free : oldest;
  }

  private start(key: number): void {
    const v = this.allocate(key);
    this.notes[v] = key;
    this.gates[v] = 1;
    this.keyOf[v] = key;
    this.born[v] = this.clock + 1;
    this.clock++;
    this.step[v] = 1;
  }

  private stop(key: number): void {
    for (let i = 0; i < 6; i++) {
      if (this.notes[i] !== key || !this.gates[i]) continue;
      this.gates[i] = 0;
      this.step[i] = 4;
    }
  }

  /** A key goes down, as a MIDI note. */
  press(key: number): void {
    const p = this.patch;
    // Holding, a fresh hand clears what was left down.
    if (p.hold && !this.down.length) {
      for (const k of this.held) if (!p.arp) this.stop(k);
      this.held = [];
    }
    if (this.down.indexOf(key) < 0) this.down.push(key);
    if (this.held.indexOf(key) < 0) this.held.push(key);
    if (!p.arp) this.start(key);
  }

  release(key: number): void {
    this.down = this.down.filter(k => k !== key);
    if (this.patch.hold) return;
    this.held = this.held.filter(k => k !== key);
    if (!this.patch.arp) this.stop(key);
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

  /** The notes the arpeggiator walks, low to high, over its octaves. */
  private run(): number[] {
    const low = this.held.slice().sort((a, b) => a - b), out: number[] = [];
    for (let o = 0; o < this.patch.arpRange; o++) for (const k of low) out.push(k + o * 12);
    return out;
  }

  /** One step along: up, down, or up and back without playing either end twice. */
  private arpStep(): void {
    const p = this.patch, notes = this.run();
    if (this.arpNote >= 0) this.stop(this.arpNote);
    this.arpNote = -1;
    if (!notes.length) {
      this.arpAt = -1;
      return;
    }
    if (p.arpMode === 0) this.arpAt = (this.arpAt + 1) % notes.length;
    else if (p.arpMode === 2) this.arpAt = this.arpAt <= 0 ? notes.length - 1 : this.arpAt - 1;
    else {
      if (notes.length === 1) this.arpAt = 0;
      else {
        if (this.arpAt >= notes.length - 1) this.arpDir = -1;
        if (this.arpAt <= 0) this.arpDir = 1;
        this.arpAt += this.arpDir;
      }
    }
    this.arpAt = Math.min(Math.max(this.arpAt, 0), notes.length - 1);
    this.arpNote = notes[this.arpAt]!;
    this.start(this.arpNote);
  }

  /** The slow work, every few samples: where each voice's pitch, pulse and filter should be. */
  private control(n: number): void {
    const p = this.patch, r = this.rate, seconds = n / r;
    // A key left by `hold` lets go when it goes off.
    if (!p.hold && this.held.length > this.down.length) {
      for (const k of this.held) if (this.down.indexOf(k) < 0 && !p.arp) this.stop(k);
      this.held = this.held.filter(k => this.down.indexOf(k) >= 0);
    }
    if (!p.arp && this.arpNote >= 0) {
      this.stop(this.arpNote);
      this.arpNote = -1;
      for (const k of this.held) this.start(k);
    }
    if (p.arp) {
      for (let i = 0; i < 6; i++) if (this.gates[i] && this.notes[i] !== this.arpNote) this.stop(this.notes[i]!);
      // 2Hz to 30Hz: guess, from what it does on the bench.
      this.arpLeft -= seconds * 2 * 15 ** p.arpRate;
      this.arpGate -= seconds * 2 * 15 ** p.arpRate;
      if (this.arpLeft <= 0) {
        this.arpLeft += 1;
        if (this.arpLeft <= 0) this.arpLeft = 1;
        this.arpGate = 0.5;
        this.arpStep();
      } else if (this.arpGate <= 0 && this.arpNote >= 0) {
        this.stop(this.arpNote);
        this.arpNote = -1;
      }
    }

    this.lfoPhase = (this.lfoPhase + 0.1 * 300 ** p.lfoRate * seconds) % 1;
    this.lfoNow = 4 * Math.abs(this.lfoPhase - 0.5) - 1;
    const sounding = this.gates.some(g => g > 0), wanted = p.lfoAuto ? sounding : p.trig;
    if (wanted) {
      this.lfoWait += seconds;
      const wait = p.lfoDelay * p.lfoDelay * 3;
      if (this.lfoWait > wait) this.lfoIn = Math.min(this.lfoIn + seconds / (wait * 0.5 + 0.01), 1);
    } else {
      this.lfoWait = 0;
      this.lfoIn = p.lfoAuto ? this.lfoIn * 0.999 : Math.max(this.lfoIn - seconds * 8, 0);
    }
    const lfo = this.lfoNow * this.lfoIn;

    const semis = p.bend * p.bendDco * 12 + lfo * p.dcoLfo * p.dcoLfo * 6 + p.transpose;
    for (let v = 0; v < 6; v++) {
      if (!this.step[v] && !this.gates[v]) continue;
      const key = this.keyOf[v]!, env = this.env[v]!;
      this.inc[v] = Math.min((440 * 2 ** ((key + semis - 69) / 12)) / r, 0.45);
      const mod = p.pwmMode === 0 ? (lfo + 1) / 2 : p.pwmMode === 2 ? env : 1;
      this.width[v] = 0.5 - 0.45 * p.pwm * mod;

      const octaves = p.cutoff * 10.5 + (p.envUp ? env : -env) * p.envAmount * 7 + lfo * p.vcfLfo * 3 + (p.kybd * (key + p.transpose - 60)) / 12 + p.bend * p.bendVcf * 3;
      const hz = Math.min(20 * 2 ** octaves, r * 0.42);
      // Huovilainen's fit of the tuning and the resonance to the stages' real delay, run at twice the rate.
      const fc = hz / r, f = fc * 0.5, fcr = 1.873 * fc * fc * fc + 0.4955 * fc * fc - 0.649 * fc + 0.9988, acr = -3.9364 * fc * fc + 1.8409 * fc + 0.9968;
      this.tune[v] = 1 - Math.exp(-2 * Math.PI * f * fcr);
      this.feedback[v] = 4 * Math.min(p.resonance * 1.06, 1.06) * acr;
    }
  }

  private sat(x: number): number {
    const v = x > 3 ? 3 : x < -3 ? -3 : x;
    return (v * (27 + v * v)) / (27 + 9 * v * v);
  }

  /** One voice's ladder, four stages with the end fed back, taken from `at` in the store. */
  private ladder(at: number, x: number, g: number, k: number): number {
    const d = this.ladders, HEAT = 0.9;
    let out = d[at + 8]!;
    for (let i = 0; i < 2; i++) {
      const a = d[at]! + (g / HEAT) * (this.sat((x - k * out) * HEAT) - d[at + 4]!);
      d[at] = a;
      d[at + 4] = this.sat(a * HEAT);
      const b = d[at + 1]! + (g / HEAT) * (d[at + 4]! - d[at + 5]!);
      d[at + 1] = b;
      d[at + 5] = this.sat(b * HEAT);
      const c = d[at + 2]! + (g / HEAT) * (d[at + 5]! - d[at + 6]!);
      d[at + 2] = c;
      d[at + 6] = this.sat(c * HEAT);
      const e = d[at + 3]! + (g / HEAT) * (d[at + 6]! - this.sat(d[at + 3]! * HEAT));
      d[at + 3] = e;
      out = (e + d[at + 7]!) * 0.5;
      d[at + 7] = e;
    }
    if (!(Math.abs(out) < 8)) {
      d.fill(0, at, at + 9);
      out = 0;
    }
    d[at + 8] = out;
    return out;
  }

  /** What one voice says next. */
  private voice(v: number, attack: number, decay: number, sustain: number, release: number, gateRate: number): number {
    const p = this.patch, dt = this.inc[v]!;
    let env = this.env[v]!, step = this.step[v]!;
    if (step === 1) {
      env += attack;
      if (env >= 1) {
        env = 1;
        step = 2;
      }
    } else if (step === 2) env += (sustain - env) * decay;
    else if (step === 4) {
      env *= 1 - release;
      if (env < 0.00002) {
        env = 0;
        step = 0;
      }
    }
    this.env[v] = env;
    const gate = this.gates[v] ? 1 : 0;
    let amp = this.amp[v]!;
    amp += ((p.gate ? gate : env) - amp) * gateRate;
    this.amp[v] = amp;
    this.step[v] = step;
    if (!step && amp < 0.00002) {
      this.notes[v] = -1;
      return 0;
    }

    let q = this.phase[v]! + dt;
    if (q >= 1) {
      q -= 1;
      this.square[v] = -this.square[v]!;
    }
    this.phase[v] = q;
    let mixed = 0;
    if (p.saw) mixed += (2 * q - 1 - this.blep(q, dt)) * 0.55;
    if (p.pulse) {
      const w = this.width[v]!, t = (q - w + 1) % 1;
      mixed += ((q < w ? 1 : -1) + this.blep(q, dt) - this.blep(t, dt)) * 0.5;
    }
    if (p.sub) {
      // It flips as the saw wraps, so it's a square an octave down, and the step is rounded the same way.
      const s = this.square[v]!;
      mixed += (s + (q < dt ? s : -s) * this.blep(q, dt)) * p.subLevel * 0.5;
    }
    if (p.noise > 0) mixed += this.random() * p.noise * 0.4;
    return this.ladder(v * 9, mixed * (1 + p.resonance * 0.7), this.tune[v]!, this.feedback[v]!) * amp;
  }

  /** The bucket brigade: one read of the line, sliding between samples. */
  private tap(ms: number): number {
    const line = this.line, size = line.length, at = (this.write - (ms * this.rate) / 1000 + size * 2) % size, i = Math.floor(at), f = at - i;
    const a = line[(i + size - 1) % size]!, b = line[i]!, c = line[(i + 1) % size]!, d = line[(i + 2) % size]!;
    return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  }

  /** Fills `left` and `right` with what the voices say next. */
  render(left: Float32Array, right: Float32Array): void {
    const p = this.patch, r = this.rate, EVERY = 16;
    // Times from the panel: guess, from what the manual says each end does.
    const attack = 1 / (r * 0.0015 * 2000 ** p.attack), decay = 1 - Math.exp(-1 / (r * 0.0015 * 2600 ** p.decay)), release = 1 - Math.exp(-1 / (r * 0.0015 * 2600 ** p.release));
    const gateRate = 1 - Math.exp(-1 / (r * 0.002));
    // High-pass corners: guess, the three steps of a fixed filter. Chorus timings as measured by others off the bucket-brigade's clock.
    const corner = [0, 225, 340, 720][p.hpf] ?? 0, cut = 1 - Math.exp((-2 * Math.PI * corner) / r);
    const rates = [0, 0.513, 0.863, 9.75], from = [0, 1.66, 1.66, 3.3], to = [0, 5.35, 5.35, 3.7];
    const speed = rates[p.chorus]! / r, shallow = from[p.chorus]!, deep = to[p.chorus]!, soften = 1 - Math.exp((-2 * Math.PI * 8000) / r), size = this.line.length;
    for (let i = 0; i < left.length; i++) {
      if (this.tick++ % EVERY === 0) this.control(EVERY);
      let sum = 0;
      for (let v = 0; v < 6; v++) if (this.step[v] || this.amp[v]! > 0.00002 || this.gates[v]) sum += this.voice(v, attack, decay, p.sustain, release, gateRate);
      sum *= 1.1 * p.level * p.level;
      if (corner) {
        // Two poles, so a step takes the bottom away rather than tilting it.
        this.hp[0] = this.hp[0]! + (sum - this.hp[0]!) * cut;
        const a = sum - this.hp[0]!;
        this.hp[1] = this.hp[1]! + (a - this.hp[1]!) * cut;
        sum = a - this.hp[1]!;
      }
      this.line[this.write] = sum;
      this.write = (this.write + 1) % size;
      let l = sum, o = sum;
      if (p.chorus) {
        const phase = (this.chorusAt[0] = (this.chorusAt[0]! + speed) % 1), tri = 4 * Math.abs(phase - 0.5) - 1, mid = (shallow + deep) / 2, swing = (deep - shallow) / 2;
        // The same delay, swung opposite ways for each side, on top of the dry signal.
        this.wetL += (this.tap(mid + tri * swing) - this.wetL) * soften;
        this.wetR += (this.tap(mid - tri * swing) - this.wetR) * soften;
        l = sum * 0.7 + this.wetL * 0.7;
        o = sum * 0.7 + this.wetR * 0.7;
      }
      left[i] = p.output ? this.sat(l * 1.2) * 0.7 : 0;
      right[i] = p.output ? this.sat(o * 1.2) * 0.7 : 0;
    }
  }
}

export interface Poly {
  /** 0 to 1. */
  volume: number;
  /** The loudest of the last moment. */
  readonly peak: number;
  /** Opens the audio device. Call it from a tap or a key, which is the browser's rule. */
  wake(): Promise<void>;
  /** Changes any of the patch, and reaches notes already sounding. */
  set(patch: Partial<PolyPatch>): void;
  /** A key goes down, as a MIDI note. */
  press(key: number): void;
  /** A key comes up. */
  release(key: number): void;
  /** Lets go of the audio device. */
  close(): void;
}

const WORKLET = `const Voices = (${PolyVoices.toString()});
class Run extends AudioWorkletProcessor {
  constructor(o) {
    super();
    this.voices = new Voices(sampleRate, o.processorOptions.patch);
    this.left = 0;
    this.peak = 0;
    this.port.onmessage = ({ data: m }) => {
      if (m.end) this.ended = true;
      if (m.set) Object.assign(this.voices.patch, m.set);
      if (m.press !== undefined) this.voices.press(m.press);
      if (m.release !== undefined) this.voices.release(m.release);
    };
  }
  process(_, outputs) {
    if (this.ended) return false;
    const [l, r] = outputs[0];
    if (!l) return true;
    this.voices.render(l, r ?? l);
    for (let i = 0; i < l.length; i++) this.peak = Math.max(this.peak, Math.abs(l[i]));
    if ((this.left -= l.length) <= 0) {
      this.left = 2048;
      this.port.postMessage({ peak: this.peak });
      this.peak = 0;
    }
    return true;
  }
}
registerProcessor('poly-voices', Run);
`;

export function polyphonic(patch: Partial<PolyPatch> = {}, volume = 0.7): Poly {
  soon();
  const now: PolyPatch = { ...POLY, ...patch };
  let ctx: AudioContext | null = null, node: AudioWorkletNode | null = null, master: GainNode, opening: Promise<void> | null = null, peak = 0;
  const waiting: object[] = [];
  const send = (m: object) => (node ? node.port.postMessage(m) : waiting.push(m));
  const loudness = (v: number) => v * v;

  return {
    get volume() {
      return volume;
    },
    set volume(v) {
      volume = v;
      if (ctx) master.gain.setTargetAtTime(loudness(v), ctx.currentTime, 0.02);
    },
    get peak() {
      return peak;
    },
    wake() {
      return (opening ??= (async () => {
        const c = (ctx = audio());
        await worklet('poly-voices', WORKLET);
        node = new AudioWorkletNode(c, 'poly-voices', { numberOfInputs: 0, outputChannelCount: [2], processorOptions: { patch: now } });
        node.port.onmessage = ({ data: m }) => {
          peak = m.peak;
        };
        master = c.createGain();
        master.gain.value = loudness(volume);
        node.connect(master).connect(output());
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
    close() {
      // Its voice runs for as long as it's told to, so it's told to stop, then let go.
      node?.port.postMessage({ end: true });
      node?.disconnect();
      ctx = node = opening = null;
    },
  };
}
