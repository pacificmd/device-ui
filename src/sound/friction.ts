// What rubs and tears: noise shaped by how it's torn or dragged, with no recording in it. A match on a striker is grit on grit, then the head going up.
import { audio, output } from './audio.js';

let white: AudioBuffer | null = null;
const noise = (c: BaseAudioContext) => {
  if (white) return white;
  white = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = white.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return white;
};

/** A burst of noise through a band, along `shape`, which is [seconds, level] from now. */
function burst(hz: number, q: number, shape: readonly (readonly [number, number])[], sweep?: number) {
  const c = audio(), n = c.createBufferSource(), band = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
  n.buffer = noise(c);
  n.loop = true;
  band.type = 'bandpass';
  band.frequency.setValueAtTime(hz, t);
  band.Q.value = q;
  const end = shape[shape.length - 1]![0];
  if (sweep) band.frequency.exponentialRampToValueAtTime(sweep, t + end);
  g.gain.setValueAtTime(0, t);
  for (const [at, level] of shape) g.gain.linearRampToValueAtTime(level, t + at);
  n.connect(band).connect(g).connect(output());
  n.start(t, Math.random() * 0.9);
  n.stop(t + end + 0.02);
}

/** Something gritty dragged over something gritty, for `seconds`, as hard as `force`, 0 to 1. */
export function rasp(seconds = 0.12, force = 1) {
  const f = Math.min(Math.max(force, 0), 1);
  burst(3400, 0.8, [[0.008, 0.5 * f], [seconds * 0.7, 0.32 * f], [seconds, 0]], 5200);
}

/** A head going up: a spit of hiss, dying into the flame's breath. Heard for about a second. */
export function flare() {
  burst(5200, 0.6, [[0.015, 0.55], [0.12, 0.3], [0.5, 0.05], [1, 0]], 1800);
  burst(420, 0.7, [[0.08, 0.28], [1.2, 0.05], [1.8, 0]]);
}

/** Fibres letting go, in a few quick stages. */
export function tear() {
  burst(1900, 1.2, [[0.006, 0.34], [0.03, 0.08], [0.05, 0.3], [0.09, 0.05], [0.11, 0.2], [0.17, 0]], 3200);
}
