// A length of tape under a head: it plays at any speed, backwards too, and takes a recording.
// A source node can't go backwards in every browser, so the head is its own worklet, written out here since a worklet needs a url.
import { audio, output, worklet, soon } from './audio.js';
import { hat, kick, snare } from './drums.js';

const HEAD = `
class Head extends AudioWorkletProcessor {
  constructor() {
    super();
    this.clips = new Map();
    this.clip = null;
    this.rate = this.speed = this.at = this.left = this.peak = 0;
    this.writing = false;
    this.port.onmessage = ({ data: m }) => {
      if (m.end) this.ended = true;
      if (m.load) this.clips.set(m.load, { data: m.data, span: m.span });
      if (m.pick) {
        this.clip = this.clips.get(m.pick) ?? null;
        this.at = m.at;
        this.speed = 0;
      }
      if (m.rate !== undefined) this.rate = m.rate;
      if (m.write !== undefined) {
        this.writing = m.write;
        if (!m.write && this.clip) {
          this.clip.span = this.at;
          this.port.postMessage({ took: this.at });
        }
      }
    };
  }
  process(inputs, outputs) {
    if (this.ended) return false;
    const out = outputs[0][0], c = this.clip;
    if (!out || !c) return true;
    const n = out.length, length = c.data.length;
    if (this.writing) {
      const take = inputs[0][0];
      for (let i = 0; i < n && take && this.at < length; i++, this.at++) {
        c.data[this.at] = take[i];
        this.peak = Math.max(this.peak, Math.abs(take[i]));
      }
      out.fill(0);
    } else {
      for (let i = 0; i < n; i++) {
        this.speed += (this.rate - this.speed) * 0.004;
        const next = Math.max(0, Math.min(c.span, this.at + this.speed));
        // Stopped dead by either end of the tape.
        if (next !== this.at + this.speed) this.speed = 0;
        this.at = next;
        const k = Math.floor(next), f = next - k, a = c.data[k % length], b = c.data[(k + 1) % length];
        // A tape barely moving past the head makes no sound.
        out[i] = (a + (b - a) * f) * Math.min(1, Math.abs(this.speed) * 3);
        this.peak = Math.max(this.peak, Math.abs(out[i]));
      }
    }
    if ((this.left -= n) <= 0) {
      this.left = 1024;
      this.port.postMessage({ at: this.at, peak: this.peak });
      this.peak = 0;
    }
    return true;
  }
}
registerProcessor('tape-head', Head);
`;

export interface Tape {
  /** Where the head is, seconds. */
  readonly position: number;
  /** How far the tape goes, seconds. */
  readonly span: number;
  /** The loudest of the last moment, 0 to 1. */
  readonly peak: number;
  /** Times real speed. Backwards is below 0, and it gets there with the weight of the tape. */
  rate: number;
  /** Opens the audio device. Call it from a tap or a key, which is the browser's rule. */
  wake(): Promise<void>;
  /** Puts a clip in, which runs for `span` seconds, round and round its samples, and returns how to pick it. */
  load(data: Float32Array<ArrayBuffer>, span?: number): number;
  /** Puts the head on a clip, `at` seconds in. */
  pick(clip: number, at?: number): void;
  /** Records a stream onto a new clip of up to `most` seconds, and returns the clip. */
  record(stream: MediaStream, most: number): number;
  /** Ends a recording, and gives back how long it ran. */
  stop(): Promise<number>;
  /** The sample rate, once awake. */
  readonly sampleRate: number;
  /** Lets go of the audio device. */
  close(): void;
}

export function tape(): Tape {
  soon();
  let ctx: AudioContext | null = null, head: AudioWorkletNode | null = null, opening: Promise<void> | null = null, input: MediaStreamAudioSourceNode | null = null;
  let position = 0, peak = 0, rate = 0, next = 1, span = 0, took: ((s: number) => void) | null = null;
  const spans = new Map<number, number>();
  const hz = () => ctx?.sampleRate ?? 48000;

  return {
    get position() {
      return position;
    },
    get span() {
      return span;
    },
    get peak() {
      return peak;
    },
    get sampleRate() {
      return hz();
    },
    get rate() {
      return rate;
    },
    set rate(v) {
      rate = v;
      head?.port.postMessage({ rate: v });
    },
    wake() {
      return (opening ??= (async () => {
        const c = (ctx = audio());
        await worklet('tape-head', HEAD);
        head = new AudioWorkletNode(c, 'tape-head', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
        head.port.onmessage = ({ data: m }) => {
          if (m.at !== undefined) {
            position = m.at / hz();
            peak = m.peak;
          }
          if (m.took !== undefined) {
            span = m.took / hz();
            spans.set(next - 1, span);
            took?.(span);
            took = null;
          }
        };
        head.connect(output());
      })());
    },
    load(data, s) {
      const clip = next++;
      spans.set(clip, s ?? data.length / hz());
      head!.port.postMessage({ load: clip, data, span: spans.get(clip)! * hz() }, [data.buffer]);
      return clip;
    },
    pick(clip, at = 0) {
      span = spans.get(clip)!;
      position = at;
      head!.port.postMessage({ pick: clip, at: at * hz() });
    },
    record(stream, most) {
      const clip = this.load(new Float32Array(Math.ceil(most * hz())));
      this.pick(clip);
      input = ctx!.createMediaStreamSource(stream);
      input.connect(head!);
      head!.port.postMessage({ write: true });
      return clip;
    },
    stop() {
      input?.disconnect();
      input = null;
      head!.port.postMessage({ write: false });
      return new Promise(done => (took = done));
    },
    close() {
      input?.disconnect();
      head?.port.postMessage({ end: true });
      head?.disconnect();
      ctx = head = input = null;
      opening = null;
    },
  };
}

/** A few bars of a small band, worked out sample by sample, with a clear front and back to every hit, so it's plain which way the tape is going. */
export function groove(rate: number, bpm = 96, bars = 4): Float32Array<ArrayBuffer> {
  const beat = (60 / bpm) * rate, n = Math.round(beat * 4 * bars), out = new Float32Array(n);
  const hit = (at: number, s: number, voice: (t: number) => number) => {
    const start = Math.round(at), end = Math.min(n, start + Math.round(s * rate));
    for (let i = start; i < end; i++) out[i] = out[i]! + voice((i - start) / rate);
  };
  const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);
  const pluck = (hz: number, v: number) => (t: number) => {
    const y = Math.sin(Math.PI * 2 * hz * t + 2.4 * Math.exp(-t * 7) * Math.sin(Math.PI * 4 * hz * t));
    return y * Math.exp(-t * 5) * v * Math.min(1, t * 400);
  };
  const chords = [[45, 57, 60, 64], [41, 53, 60, 65], [48, 55, 60, 64], [43, 55, 59, 62]];
  for (let bar = 0; bar < bars; bar++) {
    const [root, a, b, c] = chords[bar % chords.length]!, at = bar * 4 * beat;
    for (const q of [0, 1.5, 2.5]) hit(at + q * beat, 0.5, kick);
    for (const q of [1, 3]) hit(at + q * beat, 0.3, snare);
    for (let q = 0; q < 8; q++) hit(at + (q * beat) / 2, 0.08, hat);
    for (const q of [0, 0.75, 1.5, 2.5, 3.25]) hit(at + q * beat, 0.5, pluck(midi(root!), 0.3));
    [a, b, c, a! + 12, b! + 12, c! + 12, a! + 24, c! + 12].forEach((m, q) => hit(at + (q * beat) / 2, 0.7, pluck(midi(m!), 0.16)));
  }
  let top = 0;
  for (const v of out) top = Math.max(top, Math.abs(v));
  for (let i = 0; i < n; i++) out[i] = (out[i]! * 0.8) / top;
  return out;
}
