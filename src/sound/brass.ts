// A valved brass instrument, made as it's made: lips buzzing against the air coming back up a tube. Nothing plays a pitch. The lips have a tension and the bore has its resonances,
// and the note is whichever of those the two settle on, so notes slot, slur, crack and go sharp on long fingerings as they do on the real thing. Contacts are `sound()`.
import { audio, output, worklet, soon } from './audio.js';

export interface BrassOptions {
  /** The open tube from lips to bell, metres. A Bb trumpet is about 1.48. */
  length: number;
  /** What each valve adds when it's down, metres. They simply add up, so the long fingerings come out sharp as they really do. */
  valves: readonly number[];
  /** Where the sound goes. Built when the audio device opens. */
  into?(c: AudioContext): AudioNode;
}

export interface Brass {
  /** Opens the audio device. Call it from a tap or a key, which is the browser's rule. */
  wake(): void;
  /** How hard the player is blowing, 0 to 1. 0 stops. */
  blow(pressure: number): void;
  /** How tight the lips are, as which resonance of the tube they aim for: 2 is the lowest playable note, 8 the top of the usual range. */
  lip(partial: number): void;
  /** Puts a valve down or lets it up. */
  valve(i: number, down: boolean): void;
  /** Opens a hole near the end of the tube, 0 to 1, as a water key does. */
  leak(open: number): void;
  /** Lets go of the audio device. */
  close(): void;
}

// Lip and bell numbers are tuned, not measured: `packages/device-ui/test/brass.test.ts` holds every fingering on every partial to the note it should be.
const SOUND = 343; // m/s, air at 20C. spec
const SLUR = 0.03; // seconds for the lips to change tension. guess
const THROW = 0.012; // seconds for a valve's ports to pass from one path to the other. guess, about what a fast finger takes

/** The physics alone, for a worklet or anything else that can run a loop. One sample at a time, at this rate. */
export const BRASS_CORE = `
class BrassCore {
  constructor(rate, length, valves) {
    this.rate = rate;
    this.length = length;
    this.added = valves;
    this.down = valves.map(() => false);
    this.buf = new Float32Array(Math.ceil(rate * 2 * (length + valves.reduce((a, b) => a + b, 0)) / ${SOUND}) + 8);
    this.w = 0;
    // The tube the air goes round: two of them while a valve is on its way, one fading into the other.
    this.from = this.to = this.delay();
    this.mix = 1;
    this.mixStep = 1 / (rate * ${THROW});
    this.partial = this.partialTo = 4;
    this.pressure = this.pressureTo = 0;
    this.open = this.openTo = 0;
    this.y1 = this.y2 = 0;
    this.bell = 0;
    this.dcIn = this.dcOut = 0;
    this.rad = 0;
    this.tension = 0;
    this.slur = 1 - Math.exp(-1 / (rate * ${SLUR}));
    this.attack = 1 - Math.exp(-1 / (rate * 0.012));
    this.release = 1 - Math.exp(-1 / (rate * 0.04));
    this.phase = 0;
    this.seed = 1;
  }
  delay() {
    let l = this.length;
    this.added.forEach((a, i) => { if (this.down[i]) l += a; });
    // The bell's roll-off holds the wave back a little itself, and that's part of the way round.
    return (this.rate * 2 * l) / ${SOUND} - 1.38;
  }
  valve(i, down) {
    if (i < 0 || i >= this.down.length) return;
    this.down[i] = down;
    this.from = this.mix >= 1 ? this.to : this.from + (this.to - this.from) * this.mix;
    this.to = this.delay();
    this.mix = 0;
  }
  read(d) {
    const { buf } = this, n = buf.length, at = this.w - d + n + n, i = Math.floor(at), f = at - i;
    return buf[i % n] * (1 - f) + buf[(i + 1) % n] * f;
  }
  tick() {
    this.partial += (this.partialTo - this.partial) * this.slur;
    this.pressure += (this.pressureTo - this.pressure) * (this.pressureTo > this.pressure ? this.attack : this.release);
    this.open += (this.openTo - this.open) * this.release;
    if (this.mix < 1) this.mix = Math.min(this.mix + this.mixStep, 1);
    // A valve halfway has both ports half shut: both paths sound, and less gets through either.
    const m = this.mix, shut = 1 - 0.55 * Math.sin(Math.PI * m);
    const back = (this.read(this.from) * (1 - m) + this.read(this.to) * m) * shut;
    // The bell keeps the top and sends the bottom back: reflection rolls off above about 1.5k, and a hole in the tube sends less of it.
    this.bell += 0.42 * (back - this.bell);
    const bore = this.bell * 0.92 * (1 - 0.75 * this.open);
    // The lips aim at a resonance of the tube as it now is, which is what a player hears in their head. A slight wobble keeps it alive.
    this.phase += 5.1 / this.rate;
    const wobble = this.pressure > 0.01 ? 1 + 0.0016 * Math.sin(2 * Math.PI * this.phase) : 1;
    const tube = this.rate / (this.from + (this.to - this.from) * m);
    const hz = this.partial * tube * wobble;
    // A mass on a spring, which is what a lip is. Blowing harder shuts it faster, so it brightens.
    const r = 0.9985, a1 = 2 * r * Math.cos((2 * Math.PI * hz) / this.rate), a2 = -r * r;
    const mouth = this.pressure * 0.75;
    // Breath is never quite steady, and that's what starts a lip moving again when a jump has shaken it off the tube.
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0;
    const dp = mouth * (0.3 + (this.seed / 2147483648) * 0.03) - bore * 0.85;
    // As soft a lip at any tension: a resonator's peak gets higher as it gets lower.
    const y = 0.3 * Math.sin((2 * Math.PI * hz) / this.rate) * dp + a1 * this.y1 + a2 * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    // The gap between the lips, opened by that motion: how much of the mouth gets through and how much of the bore is turned back.
    const gap = Math.min(y * y, 1), out = gap * mouth + (1 - gap) * bore;
    // No steady air comes back as sound.
    this.dcOut = out - this.dcIn + 0.995 * this.dcOut;
    this.dcIn = out;
    this.buf[this.w] = this.dcOut;
    this.w = (this.w + 1) % this.buf.length;
    // What leaves the bell is what wasn't reflected: the top of it, more than the bottom.
    const heard = back - this.bell * 0.72;
    return heard + (out - heard) * this.open * 0.5;
  }
}
`;

const WORKLET = `${BRASS_CORE}
class BrassVoice extends AudioWorkletProcessor {
  constructor({ processorOptions: { length, valves } }) {
    super();
    this.core = new BrassCore(sampleRate, length, valves);
    this.port.onmessage = ({ data: m }) => {
      const c = this.core;
      if (m.blow !== undefined) c.pressureTo = m.blow;
      if (m.lip !== undefined) c.partialTo = m.lip;
      if (m.leak !== undefined) c.openTo = m.leak;
      if (m.valve !== undefined) c.valve(m.valve, m.down);
    };
  }
  process(_, [out]) {
    const left = out[0], c = this.core;
    for (let i = 0; i < left.length; i++) left[i] = c.tick();
    for (let k = 1; k < out.length; k++) out[k].set(left);
    return true;
  }
}
registerProcessor('brass-voice', BrassVoice);
`;

export function brass(o: BrassOptions): Brass {
  soon();
  let node: AudioWorkletNode | null = null, opening: Promise<void> | null = null, gone = false;
  const waiting: object[] = [];
  const send = (m: object) => (node ? node.port.postMessage(m) : waiting.push(m));
  return {
    wake() {
      opening ??= (async () => {
        const c = audio();
        await worklet('brass-voice', WORKLET);
        if (gone) return;
        node = new AudioWorkletNode(c, 'brass-voice', {
          numberOfInputs: 0, outputChannelCount: [1],
          processorOptions: { length: o.length, valves: [...o.valves] },
        });
        node.connect(o.into?.(c) ?? output());
        for (const m of waiting.splice(0)) node.port.postMessage(m);
      })();
    },
    blow: pressure => send({ blow: pressure }),
    lip: partial => send({ lip: partial }),
    valve: (i, down) => send({ valve: i, down }),
    leak: open => send({ leak: open }),
    close() {
      gone = true;
      node?.disconnect();
      node = null;
    },
  };
}
