// Plucked strings heard through magnetic pickups. Each is a loop of the wave travelling both ways along it, so where it was plucked
// and where a pickup sits both come out of the geometry as they do on the real thing. Contacts are `sound()`.
import { audio, output, worklet, soon } from './audio.js';

export interface StringsOptions {
  /** Each string's open pitch. */
  hz: readonly number[];
  /** Where each pickup sits along the string, 0 at the bridge to 1 at the nut. */
  pickups: readonly number[];
  /** How long the lowest and the highest ring, seconds to silence. */
  ring?: readonly [number, number];
  /** Where the sound goes. Built when the audio device opens, so a page's tone stack can wait for a hand. */
  into?(c: AudioContext): AudioNode;
}

export interface Strings {
  /** Opens the audio device. Call it from a tap or a key, which is the browser's rule. */
  wake(): void;
  /** `at` runs from 0 at the bridge to 1 at the nut, `force` from 0 to 1. */
  pluck(string: number, at: number, force: number): void;
  /** How much of each pickup is heard. */
  listen(gains: readonly number[]): void;
  /** Lets go of the audio device. */
  close(): void;
}

const WORKLET = `
class Strings extends AudioWorkletProcessor {
  constructor({ processorOptions: { hz, pickups, ring } }) {
    super();
    this.pickups = pickups;
    this.gains = pickups.map(() => 1);
    this.strings = hz.map((f, i) => {
      const k = hz.length > 1 ? i / (hz.length - 1) : 0;
      const soft = 0.3 - 0.16 * k, seconds = ring[0] + (ring[1] - ring[0]) * k;
      const total = sampleRate / f - soft / (1 - soft), n = Math.floor(total - 0.3), frac = total - n;
      return {
        n, buf: new Float32Array(n), r: 0, soft, low: 0, keep: Math.pow(10, -3 / (f * seconds)),
        ap: (1 - frac) / (1 + frac), apIn: 0, apOut: 0, last: pickups.map(() => 0), level: 2.4 / (n * 0.002 + 1) * (0.7 + 0.3 * (n / 600)),
        tap: pickups.map(x => Math.max(1, Math.round((x * n) / 2))),
      };
    });
    this.port.onmessage = ({ data: m }) => {
      if (m.gains) this.gains = m.gains;
      if (m.pluck) this.pluck(m.pluck);
    };
  }
  pluck({ string, at, force }) {
    const s = this.strings[string];
    if (!s) return;
    const { n, buf, r } = s, half = n / 2, apex = Math.min(Math.max(at, 0.02), 0.98);
    const shape = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const x = k <= half ? k / half : 2 - k / half;
      const y = (x < apex ? x / apex : (1 - x) / (1 - apex)) * force * 0.5;
      shape[k] = k <= half ? y : -y;
    }
    // A finger or a pick has a width, and a soft stroke lays less top on the string than a hard one.
    for (let pass = 0, passes = Math.round(1 + (1 - force) * 5); pass < passes; pass++) {
      let before = shape[n - 1];
      for (let k = 0; k < n; k++) {
        const now = shape[k];
        shape[k] = 0.25 * before + 0.5 * now + 0.25 * shape[(k + 1) % n];
        before = now;
      }
    }
    // Whatever was ringing is mostly stopped by the pick that takes it.
    for (let k = 0; k < n; k++) {
      const i = (r + k) % n;
      buf[i] = buf[i] * 0.25 + shape[k];
    }
  }
  process(_, [out]) {
    const left = out[0], { gains, strings } = this;
    for (let i = 0; i < left.length; i++) {
      let sum = 0;
      for (const s of strings) {
        const { n, buf, tap, last } = s;
        const head = s.r;
        for (let p = 0; p < tap.length; p++) {
          if (!gains[p]) continue;
          // The string's height at the pickup, and a magnetic pickup hears how fast that's changing.
          const a = head + tap[p], b = head - tap[p];
          const y = buf[a >= n ? a - n : a] - buf[b < 0 ? b + n : b];
          sum += (y - last[p]) * gains[p] * s.level;
          last[p] = y;
        }
        const x = buf[head];
        s.low = (1 - s.soft) * x + s.soft * s.low;
        const v = s.low * s.keep, ap = s.ap * (v - s.apOut) + s.apIn;
        s.apIn = v;
        s.apOut = ap;
        buf[head] = ap;
        s.r = head + 1 === n ? 0 : head + 1;
      }
      left[i] = sum;
    }
    for (let c = 1; c < out.length; c++) out[c].set(left);
    return true;
  }
}
registerProcessor('plucked-strings', Strings);
`;

export function strings(o: StringsOptions): Strings {
  soon();
  let node: AudioWorkletNode | null = null, opening: Promise<void> | null = null, gone = false;
  const waiting: object[] = [];
  const send = (m: object) => (node ? node.port.postMessage(m) : waiting.push(m));
  return {
    wake() {
      opening ??= (async () => {
        const c = audio();
        await worklet('plucked-strings', WORKLET);
        if (gone) return;
        node = new AudioWorkletNode(c, 'plucked-strings', {
          numberOfInputs: 0, outputChannelCount: [1],
          processorOptions: { hz: [...o.hz], pickups: [...o.pickups], ring: [...(o.ring ?? [7, 3.5])] },
        });
        node.connect(o.into?.(c) ?? output());
        for (const m of waiting.splice(0)) node.port.postMessage(m);
      })();
    },
    pluck: (string, at, force) => send({ pluck: { string, at, force } }),
    listen: gains => send({ gains: [...gains] }),
    close() {
      gone = true;
      node?.disconnect();
      node = null;
    },
  };
}
