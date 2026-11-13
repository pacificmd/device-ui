// A mains buzzer: a steel reed on an electromagnet, off the wall and not a circuit, so it strikes twice for each cycle of the supply and its pitch is the supply's.
// It has no tune to it. What you hear is the reed's edges and the tin it's bolted to.

export interface BuzzerOptions {
  /** The supply's frequency. 60 in America, 50 most other places. */
  hz?: number;
  /** How loud, 0 to 1. */
  level?: number;
}

export interface Buzzer {
  /** Turns it up or down, 0 to 1, as a shutter over it does. */
  level(v: number): void;
  /** Cuts the power, now or at a time on the context's clock. */
  stop(at?: number): void;
}

const QUICK = 0.012;
const loudness = (v: number) => Math.max(0, v) ** 2 * 0.5;

/** Sounds a buzzer into `to`, from now, until stopped. */
export function buzzer(c: BaseAudioContext, to: AudioNode, o: BuzzerOptions = {}): Buzzer {
  const hz = (o.hz ?? 60) * 2, out = c.createGain(), power = c.createGain();
  out.gain.value = loudness(o.level ?? 1);
  power.gain.setValueAtTime(0, c.currentTime);
  power.gain.linearRampToValueAtTime(1, c.currentTime + 0.02);
  // The reed's strike, then the case ringing at two places, and a hard edge where the reed hits its stop.
  const reed = c.createOscillator(), rattle = c.createOscillator(), mix = c.createGain(), edge = c.createWaveShaper(), body = c.createBiquadFilter(), tin = c.createBiquadFilter(), low = c.createGain(), high = c.createGain();
  reed.type = 'sawtooth';
  reed.frequency.value = hz;
  rattle.type = 'square';
  rattle.frequency.value = hz * 1.002;
  mix.gain.value = 0.6;
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) curve[i] = Math.tanh(((i / 127.5) - 1) * 4);
  edge.curve = curve;
  body.type = 'peaking';
  body.frequency.value = 620;
  body.Q.value = 2.5;
  body.gain.value = 12;
  tin.type = 'bandpass';
  tin.frequency.value = 2400;
  tin.Q.value = 1.4;
  low.gain.value = 0.7;
  high.gain.value = 0.5;
  reed.connect(mix);
  rattle.connect(mix);
  mix.connect(edge).connect(body);
  body.connect(low).connect(power);
  body.connect(tin).connect(high).connect(power);
  power.connect(out).connect(to);
  reed.start();
  rattle.start();
  return {
    level(v) {
      out.gain.setTargetAtTime(loudness(v), c.currentTime, QUICK);
    },
    stop(at = c.currentTime) {
      power.gain.setTargetAtTime(0, at, QUICK);
      reed.stop(at + 0.2);
      rattle.stop(at + 0.2);
      reed.onended = () => out.disconnect();
    },
  };
}
