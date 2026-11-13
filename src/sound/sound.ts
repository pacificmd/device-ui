import { onContact } from 'device-ui';
import { audio, isMuted, mute, onMute, output, soon } from './audio.js';
import { hit, hitFor, owns, panFor, pick, type Blow, type Hit } from './hit.js';
import { kinds, type Clip } from './voices.js';

// Past this a chord of keys is a wash anyway, so the oldest gives way.
const MOST = 24;
const ROOM = 0.13;
const WET = 0.1;
// How long a loop goes on after a part last moved, seconds, and how fast it comes and goes.
const HOLD = 0.09, SWELL = 0.012, DIE = 0.04;
// A tap or a key is when a page that began muted can open the device, the browser's rule, so that's when it's first asked for.
const GESTURES = ['pointerdown', 'keydown', 'touchend', 'click'] as const;
const REACH = ['pointerover', 'focusin'] as const;

/** Where each recording lives, or several of the same thing, which take turns. A mechanism with no clip plays its contact's, and a contact with none stays silent. */
export type Clips = Partial<Record<Clip, string | string[]>>;

export interface SoundOptions {
  clips: Clips;
  /** A device's own clips, by the id of its `d-device`. They win over `clips`, which still answer what they don't cover, and play as they are, with no material on them. Each set is fetched when a hand or the keyboard first reaches its device. */
  devices?: Record<string, Clips>;
  /** 0 to 1. */
  volume?: number;
  /** Start silent. This is the page's one mute, `mute()` from `device-ui/sound`, so it silences everything else that plays too, and setting `muted` later turns them all on. */
  muted?: boolean;
  /** Which contacts to play, if not all of them. */
  only?: (c: Parameters<Parameters<typeof onContact>[0]>[0]) => boolean;
}

export interface Sound {
  volume: number;
  muted: boolean;
  /** Plays one hit by hand, with no part behind it. */
  play(blow: Blow): void;
  /** Stops listening and lets go of the audio device. */
  stop(): void;
}

/** One set of recordings, decoded. */
interface Bank {
  buffers: Partial<Record<Clip, AudioBuffer[]>>;
  last: Partial<Record<Clip, number>>;
  has: (clip: Clip) => boolean;
  ready: Promise<unknown>;
}

function room(ctx: AudioContext): AudioBuffer {
  const n = Math.ceil(ROOM * ctx.sampleRate);
  const buffer = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let dull = 0;
    for (let i = 0; i < n; i++) {
      dull += 0.35 * (Math.random() * 2 - 1 - dull);
      data[i] = dull * (1 - i / n) ** 3;
    }
  }
  return buffer;
}

/** Plays every contact on the page. Silent until the page's first tap or key, which is the browser's rule. */
export function sound(options: SoundOptions): Sound {
  let volume = options.volume ?? 0.6;
  if (options.muted !== undefined) mute(options.muted);
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const playing = new Set<AudioBufferSourceNode>();
  const rubbing = new Map<Clip, { source: AudioBufferSourceNode; level: GainNode; off: ReturnType<typeof setTimeout> }>();

  // Decoded ahead of the first gesture, or the first press would land before its clip.
  const decoder = new OfflineAudioContext(1, 1, 44100);
  const load = (clips: Clips): Bank => {
    const buffers: Bank['buffers'] = {};
    const ready = Promise.all((Object.entries(clips) as [Clip, string | string[]][]).flatMap(([name, urls]) =>
      [urls].flat().map(url => fetch(url)
        .then(r => r.arrayBuffer())
        .then(data => decoder.decodeAudioData(data))
        .then(b => {
          (buffers[name] ??= []).push(b);
        })
        .catch(() => console.warn(`device-ui: no clip at ${url}`)))));
    return { buffers, last: {}, has: clip => !!buffers[clip]?.length, ready };
  };
  const base = load(options.clips);
  const banks = new Map<string, Bank>();
  const bankOf = (device?: string): Bank => {
    const clips = device ? options.devices?.[device] : undefined;
    if (!clips) return base;
    let bank = banks.get(device!);
    if (!bank) banks.set(device!, bank = load(clips));
    return bank;
  };
  // A press comes a moment after the hand does, which is long enough to fetch what it plays.
  const reach = (e: Event) => {
    const device = (e.target as Partial<Element>).closest?.('d-device');
    if (device) bankOf(device.id);
  };
  if (options.devices) for (const e of REACH) window.addEventListener(e, reach, { passive: true });

  const prepare = () => {
    if (!ctx && !isMuted()) {
      ctx = audio();
      master = ctx.createGain();
      master.gain.value = volume;
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -6;
      limit.knee.value = 6;
      limit.ratio.value = 12;
      limit.attack.value = 0.002;
      limit.release.value = 0.1;
      const walls = ctx.createConvolver();
      walls.buffer = room(ctx);
      const wet = ctx.createGain();
      wet.gain.value = WET;
      master.connect(limit).connect(output());
      master.connect(walls).connect(wet).connect(limit);
    }
  };
  const later = soon(prepare);

  const open = () => {
    prepare();
    if (ctx) for (const g of GESTURES) window.removeEventListener(g, open, true);
  };

  const voice = (ctx: AudioContext, master: GainNode, buffer: AudioBuffer, h: Hit, pan: number) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = h.rate;
    const dull = ctx.createBiquadFilter();
    dull.type = 'lowpass';
    dull.frequency.value = Math.min(h.tone, ctx.sampleRate / 2);
    const level = ctx.createGain();
    level.gain.value = h.level;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    source.connect(dull).connect(level).connect(panner).connect(master);
    source.onended = () => panner.disconnect();
    return { source, level };
  };

  /** A loop runs while contacts keep coming, and each one puts its end off. */
  const rub = (h: Hit, pan: number, buffer: AudioBuffer) => {
    if (!ctx || !master) return;
    let r = rubbing.get(h.clip);
    if (!r) {
      const { source, level } = voice(ctx, master, buffer, h, pan);
      level.gain.value = 0;
      source.loop = true;
      source.start(0, h.take * buffer.duration);
      r = { source, level, off: 0 as unknown as ReturnType<typeof setTimeout> };
      rubbing.set(h.clip, r);
    }
    const { source, level } = r, now = ctx.currentTime, hold = h.hold ?? HOLD, clip = h.clip;
    source.playbackRate.value = h.rate;
    level.gain.cancelScheduledValues(now);
    level.gain.setTargetAtTime(h.level, now, SWELL);
    level.gain.setTargetAtTime(0, now + hold, DIE);
    clearTimeout(r.off);
    r.off = setTimeout(() => {
      rubbing.delete(clip);
      source.stop();
    }, (hold + DIE * 6) * 1000);
  };

  const fire = (h: Hit, pan: number, bank: Bank) => {
    const takes = bank.buffers[h.clip];
    if (!ctx || !master || isMuted() || !takes?.length) return;
    const at = pick(takes.length, bank.last[h.clip] ?? -1, h.take);
    bank.last[h.clip] = at;
    if (kinds[h.clip].loop) return rub(h, pan, takes[at]!);
    const { source } = voice(ctx, master, takes[at]!, h, pan);
    source.addEventListener('ended', () => playing.delete(source));
    if (playing.size >= MOST) {
      const [oldest] = playing;
      oldest?.stop();
      playing.delete(oldest!);
    }
    playing.add(source);
    source.start();
  };

  for (const g of GESTURES) window.addEventListener(g, open, true);
  // Whatever turns the page's sound on, a switch or a key, it's a tap or a key, so it can open the device.
  const unheard = onMute(m => {
    if (!m && navigator.userActivation?.isActive !== false) open();
  });
  const off = onContact(c => {
    if (!ctx || isMuted() || options.only?.(c) === false) return;
    const device = bankOf(c.device.el.id), own = device !== base && owns(c, device.has), bank = own ? device : base;
    const h = hitFor(c, Math.random, bank.has, own);
    if (h) fire(h, panFor(c), bank);
  });

  return {
    get volume() {
      return volume;
    },
    set volume(v) {
      volume = v;
      if (master) master.gain.value = v;
    },
    get muted() {
      return isMuted();
    },
    set muted(v) {
      mute(v);
    },
    play(blow) {
      open();
      const bank = bankOf(blow.device);
      void bank.ready.then(() => {
        const h = hit({ ...blow, own: bank !== base });
        if (h) fire(h, 0, bank);
      });
    },
    stop() {
      off();
      unheard();
      for (const r of rubbing.values()) clearTimeout(r.off);
      rubbing.clear();
      later();
      for (const e of REACH) window.removeEventListener(e, reach);
      for (const g of GESTURES) window.removeEventListener(g, open, true);
      master?.disconnect();
      ctx = master = null;
    },
  };
}
