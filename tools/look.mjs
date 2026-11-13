// One command from a change to seeing it. Drives a device through the `states` its page declares in `window.look`, with real clicks, so a click area that is
// covered fails here, as does a control that's drawn and on top where the pointer can't get at it, a sliver of body or print out of its box. Writes a sheet to .look/<id>.png: every state with its click areas and pins,
// the heights, close-ups of the rest state, and the photo to judge by eye. Photos are never lined up or scored, because they are
// taken at an angle, of other models, on other backgrounds. Writes .look/<id>.txt too: each part in words, with its box in mm, its height and
// what it runs into, which `--scene` also prints, then what each state changed in the page, where it changed on screen in mm and how loud it was, so no one writes a script to find out. States run in order, each from where the last left it. A state's step is what to click,
// or { on, to } for a control's value from 0 to 1, or { on, attr: { name: value } } to set attributes (null takes one off), as cracks on a d-device, or { on, key } to press a key on it, or { on, at: [[x, y], ...] } to drag through shares of its box, or { on, turn: [from, to] } to drag round its centre in degrees clockwise from straight up, with r for how far out as a share of its width, with ms for how long each leg takes and hold: true to keep it pressed for the sheet, or { hover } to leave the pointer over something, or { wait: ms } to listen that long and say the level it holds and how many beats a minute it keeps, apart from any click that started it. `--crop x,y,w,h` in mm, or `--crop <selector>`, writes
// .look/<id>.crop.png: that piece of it in every state. Each state is also its own picture at full size, .look/<id>/<state>.png, and with --crop its piece as .look/<id>/<state>.crop.png, to read one without cutting up a sheet.
// `--try '<steps>'` runs steps from rest instead of the declared states, as many times as you like, to try something without touching the page: a selector, or JSON of one step or a list of them. `--debug <view>` draws every state in one of the engine's debug views.
// `--live` stays open and writes the sheet again on every change, `--strict` fails on a warning as well as an error.
// This is the one implementation: `npx device-ui look <page.html>` runs it on a page of anyone's, and the device-ui repository's `pnpm look <id>` on its site.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { launch, privateDir } from './browser.mjs';
import { faults } from './reach.mjs';
import { scene } from './scene.mjs';

const FLAGS = ['--live', '--strict', '--scene', '--all'];

/**
 * Looks at each thing asked for, by the page that shows it.
 * - `usage`: how to call it.
 * - `open(page, target)`: goes to the page for one thing asked for. Its `window.look` names its devices by id, each with its states.
 * - `everything(page)`, if there is such a list: what `--all` means.
 * - `photo(id)`: the straight-on photo of the real thing, if there is one, to put on the sheet.
 * - `watch(context, again)`, if it can: calls `again` whenever what it shows has changed, for `--live`.
 */
export async function look({ argv, usage, open, everything, photo, watch }) {
const args = [...argv], crops = args.indexOf('--crop'), crop = crops < 0 ? null : args.splice(crops, 2)[1];
const quit = message => {
  console.error(message);
  process.exit(1);
};
if (crops >= 0 && !crop) quit('--crop takes x,y,w,h in mm from the device\'s top left, or a selector.');
const tries = [];
for (let i; (i = args.indexOf('--try')) >= 0;) {
  const text = args.splice(i, 2)[1];
  if (!text) quit('--try takes a selector, or JSON of one step or a list of them.');
  let steps = text;
  try {
    steps = JSON.parse(text);
  } catch {}
  tries.push(Array.isArray(steps) ? steps : [steps]);
}
const debugs = args.indexOf('--debug'), debug = debugs < 0 ? null : args.splice(debugs, 2)[1];
if (debugs >= 0 && !debug) quit('--debug takes one of the engine\'s debug views, such as height.');
const live = args.includes('--live'), strict = args.includes('--strict'), wordy = args.includes('--scene'), asked = args.filter(a => !FLAGS.includes(a));
const unknown = asked.find(a => a.startsWith('-'));
if (unknown) quit(`No such flag as ${unknown}. ${usage}`);
if (args.includes('--all') && !everything) quit(`--all only means something where there's a list of everything. ${usage}`);
if (live && !watch) quit(`--live can't tell here when something changes. ${usage}`);
if (!asked.length && !args.includes('--all')) quit(usage);

const MARGIN = 28, SHEET = 1600, TALL = 1200, VIEW = { width: 1600, height: 1100 };
// A close-up shows this many css px, one sheet pixel for each pixel captured.
const SPAN = 130, MOST = 9;
// What the browser says for itself about GL and canvases. The library's own warnings have a [device-ui] tag, a demo's come from its source.
const BROWSER = /GL Driver Message|\[\.WebGL-|GroupMarkerNotSet|software WebGL|Canvas2D: Multiple readback|willReadFrequently/;
const started = performance.now();

const { browser, renderer, software } = await launch();
if (software) console.log(`Software GL (${renderer}): a frame can take seconds, so sheets are 1x and each object takes about a minute.`);
// Doubling the pixels costs software GL more than the sharpness is worth to anyone reading a sheet.
const SCALE = software ? 1 : 2, SLOW = software ? 6 : 1;
// How long a click waits for its target on a busy machine, and how long a thing gets to come to rest, the first time and once it's known not to.
const CLICK = 5000 * SLOW, SETTLE = 4000 * SLOW, RESTLESS = 800 * SLOW;
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE });
privateDir('.look');
let failed = false, warned = 0, shots = 0;

// Until the engine has been still for a moment, since a spring takes as long as it takes, but something with a
// timer of its own never stops, and each frame of it can be slow. Says whether it came to rest.
const settled = (page, most) => page.evaluate(most => new Promise(finish => {
  const count = () => engine.stats.paints + engine.stats.lights;
  let last = count(), still = 0, over = false;
  const done = rested => {
    over = true;
    finish(rested);
  };
  // Frames can stop altogether on a page that's stuck.
  const limit = setTimeout(() => done(false), most);
  const step = () => {
    if (over) return;
    const now = count();
    still = now === last ? still + 1 : 0;
    last = now;
    if (still > 12) {
      clearTimeout(limit);
      done(true);
    } else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), most);

// Until the map of what a hand can reach has caught up. Something that never rests gets little time per state, and what's still on its way when that's up has yet to be mapped.
const mapped = (page, id, most) => page.evaluate(([id, most]) => new Promise(done => {
  const limit = setTimeout(done, most), device = [...engine.devices].find(d => d.el.id === id);
  const step = () => {
    if (device?.reachDirty) requestAnimationFrame(step);
    else {
      clearTimeout(limit);
      done();
    }
  };
  step();
}), [id, most]);

// Every control's real corners, with any turn applied, and the pin it turns on.
const controls = (page, id) => page.evaluate(id => {
  const root = document.getElementById(id), o = root.getBoundingClientRect();
  return [...root.querySelectorAll('button, input, select, [tabindex]')].filter(el => el.checkVisibility()).map(el => {
    // Only a turn is undone and put back, about its pin. What's only moved along is where the page already says, whatever it's zoomed by.
    const css = getComputedStyle(el), m = new DOMMatrix(css.transform), turned = m.a !== 1 || m.b !== 0, was = el.style.transform;
    if (turned) el.style.transform = 'none';
    const r = el.getBoundingClientRect(), [ox, oy] = css.transformOrigin.split(' ').map(parseFloat);
    if (turned) el.style.transform = was;
    const px = r.left + ox, py = r.top + oy;
    const at = (x, y) => { const p = m.transformPoint({ x: x - px, y: y - py }); return [p.x + px - o.left, p.y + py - o.top]; };
    return { corners: [at(r.left, r.top), at(r.right, r.top), at(r.right, r.bottom), at(r.left, r.bottom)], pin: turned ? [px - o.left, py - o.top] : null };
  });
}, id);

/** A piece of the device in mm, or whatever a selector picks out, as a box on the page. */
const cropBox = async (page, id, box, size) => {
  const mm = crop.match(/^(-?[\d.]+),(-?[\d.]+),([\d.]+),([\d.]+)$/);
  if (mm) {
    const k = box.width / size[0], [x, y, w, h] = mm.slice(1).map(Number);
    return { x: box.x + x * k, y: box.y + y * k, width: w * k, height: h * k };
  }
  return page.locator(`#${id} ${crop}`).first().boundingBox({ timeout: 2000 });
};

const png = buffer => `data:image/png;base64,${buffer.toString('base64')}`;

// Only for what is too big to show pixel for pixel. One of each kind of part, print first since that's what a small picture loses, and none
// that mostly shows what another does, so nothing goes on plain background.
const closeups = ({ w, h }, parts) => {
  if (w * SCALE <= SHEET && h * SCALE <= TALL) return [];
  const clamp = (v, size) => Math.max(0, Math.min(v, size - SPAN));
  const tiles = parts.map(p => ({ ...p, left: clamp(p.x + MARGIN + p.w / 2 - SPAN / 2, w), top: clamp(p.y + MARGIN + p.h / 2 - SPAN / 2, h) }));
  const rank = p => (p.print ? 0 : p.text ? 1 : 2);
  const chosen = [], kinds = new Set();
  for (const again of [false, true]) {
    for (const p of [...tiles].sort((a, b) => rank(a) - rank(b) || a.w * a.h - b.w * b.h)) {
      if (chosen.length === MOST || (!again && kinds.has(p.kind))) continue;
      if (chosen.some(c => Math.abs(c.left - p.left) < SPAN / 2 && Math.abs(c.top - p.top) < SPAN / 2)) continue;
      chosen.push(p);
      kinds.add(p.kind);
    }
  }
  return chosen;
};

const sheet = (page, states, height, photo, parts) => {
  const tile = (src, label, extra = '', big = false) => `<figure${big ? ' class="big"' : ''}><div><img src="${src}">${extra}</div><figcaption>${label}</figcaption></figure>`;
  const marks = ({ hits, w, h }) => `<svg viewBox="0 0 ${w} ${h}">${hits.map(({ corners, pin }) =>
    `<polygon points="${corners.join(' ')}"/>${pin ? `<circle cx="${pin[0]}" cy="${pin[1]}" r="3"/>` : ''}`).join('')}</svg>`;
  const rest = states[0], zoom = closeups(rest, parts).map(({ left, top, name }) => `<figure><i style="background-position: ${-left * SCALE}px ${-top * SCALE}px"></i><figcaption>${name.replace(/</g, '&lt;').slice(0, 34)}</figcaption></figure>`).join('');
  return page.setContent(`<!doctype html><style>
    body { margin: 16px; background: #222; color: #ddd; font: 13px ui-monospace, monospace; display: flex; flex-wrap: wrap; gap: 12px; }
    figure { margin: 0; } figure div { position: relative; width: fit-content; } img { max-width: ${SHEET}px; max-height: 460px; display: block; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; } polygon { fill: none; stroke: #0af; stroke-width: .6; } circle { fill: #f30; }
    .big img { max-height: ${TALL}px; } figcaption { margin-top: 4px; }
    .zoom { display: flex; flex-wrap: wrap; gap: 12px; }
    i { display: block; width: ${Math.min(SPAN, rest.w) * SCALE}px; height: ${Math.min(SPAN, rest.h) * SCALE}px; background: url(${rest.src}) no-repeat; }
  </style>${states.map((s, i) => tile(s.src, i === 0 ? `${s.name}  (blue: where a click lands, red dot: what it turns on)` : s.name, marks(s), i === 0)).join('')}${zoom && `<div class="zoom">${zoom}</div>`}${tile(height, 'height')}${photo ? tile(photo, 'photo') : ''}`);
};

const page = await context.newPage();
// Everything that reaches the speakers also goes to something that can be read, since a script can't hear.
await page.addInitScript(() => {
  // What the checks reach the engine by. A page of anyone's has the library as the global DeviceUI, and asking for the engine starts it, as the site's own handle does.
  if (!('engine' in window)) Object.defineProperty(window, 'engine', { configurable: true, get: () => window.DeviceUI?.getEngine() });
  // The site starts muted, and the browser it's in is muted anyway.
  localStorage.setItem('device-ui-sound', 'on');
  const connect = AudioNode.prototype.connect, ears = new WeakMap();
  window.lookEars = [];
  window.lookPeak = 0;
  const buffer = new Float32Array(2048);
  setInterval(() => {
    for (const ear of window.lookEars) {
      ear.getFloatTimeDomainData(buffer);
      let top = 0;
      for (const v of buffer) top = Math.max(top, Math.abs(v));
      window.lookPeak = Math.max(window.lookPeak, top);
      window.lookHeard?.push([performance.now(), top]);
      // The pitch it's holding: where the wave best matches itself, from where it first comes close to matching at all.
      if (top > 0.01 && window.lookPitches) {
        const rate = ear.context.sampleRate, N = 1024, r = [];
        for (let l = Math.round(rate / 2000); l < Math.min(rate / 60, N); l++) {
          let s = 0;
          for (let i = 0; i < N; i++) s += buffer[i] * buffer[i + l];
          r[l] = s;
        }
        const most = Math.max(...r.filter(Boolean));
        for (let l = Math.round(rate / 2000) + 1; l < r.length - 1; l++) if (r[l] > r[l - 1] && r[l] >= r[l + 1] && r[l] > most * 0.9) {
          window.lookPitches.push(rate / (l + (0.5 * (r[l - 1] - r[l + 1])) / (r[l - 1] - 2 * r[l] + r[l + 1])));
          break;
        }
      }
    }
  }, 20);
  AudioNode.prototype.connect = function (to, ...rest) {
    if (to instanceof AudioDestinationNode) {
      if (!ears.has(to)) {
        const ear = to.context.createAnalyser();
        ear.fftSize = 2048;
        ears.set(to, ear);
        window.lookEars.push(ear);
      }
      connect.call(this, ears.get(to));
    }
    return connect.call(this, to, ...rest);
  };
});
// The loudest it has been since the last time this was asked, or null if nothing has ever made a sound. Everything is heard as it happens, since a click's note is over by the time a state has settled.
const loudness = page => page.evaluate(() => {
  if (!window.lookEars.length) return null;
  const peak = window.lookPeak;
  window.lookPeak = 0;
  return peak;
});
// What can be read off it: every attribute, value and bit of text, by what it is, so two states can be told apart in words.
const readings = (page, id) => page.evaluate(id => {
  // By its place among its own kind and not by its label, which can be what changes.
  const QUIET = new Set(['style', 'class', 'id', 'd-reach', 'd-layer', 'data-far', 'data-asleep', 'data-bent', 'debug']), out = {}, seen = new Map();
  for (const el of [document.getElementById(id), ...document.getElementById(id).querySelectorAll('*')]) {
    const own = el.getAttributeNames().find(a => a.startsWith('d-') && !QUIET.has(a)), base = own ? `${own}="${el.getAttribute(own)}"` : el.localName;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const name = `${base} #${n}`;
    for (const a of el.getAttributeNames()) if (!QUIET.has(a)) out[`${name} ${a}`] = el.getAttribute(a);
    if ('value' in el && el.localName !== 'button') out[`${name} value`] = String(el.value);
    if (el.type === 'checkbox' || el.type === 'radio') out[`${name} checked`] = String(el.checked);
    if (!el.childElementCount && el.textContent.trim()) out[`${name} text`] = el.textContent.trim();
  }
  return out;
}, id);
const changes = (from, to) => [...new Set([...Object.keys(from), ...Object.keys(to)])].filter(k => from[k] !== to[k]).map(k => `${k}: ${from[k] ?? '(none)'} → ${to[k] ?? '(none)'}`);
const noteName = hz => {
  const m = 69 + 12 * Math.log2(hz / 440), near = Math.round(m), cents = Math.round((m - near) * 100);
  return `${['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][near % 12]}${Math.floor(near / 12) - 1}${cents >= 0 ? '+' : ''}${cents}`;
};
// Listening for a while: the level it holds, and the beats in it, each a rise through most of the way to its loudest.
const listen = async (page, ms) => {
  await page.evaluate(() => { window.lookHeard = []; window.lookPitches = []; });
  await page.waitForTimeout(ms);
  const { heard, pitches } = await page.evaluate(() => {
    const was = { heard: window.lookHeard, pitches: window.lookPitches };
    window.lookHeard = window.lookPitches = null;
    return was;
  });
  const levels = heard.map(h => h[1]).sort((a, b) => a - b), top = levels.at(-1) ?? 0, seconds = (ms / 1000).toFixed(1);
  if (top < 0.001) return `over ${seconds}s: silent`;
  const beats = [];
  let low = true;
  for (const [at, level] of heard) {
    if (low && level > top * 0.5) {
      beats.push(at);
      low = false;
    } else if (level < top * 0.25) low = true;
  }
  const rate = beats.length > 2 ? `, ${beats.length} beats, ${((60000 * (beats.length - 1)) / (beats.at(-1) - beats[0])).toFixed(1)} a minute` : '';
  // The middle of what it sang, so a note's first moments don't count, and only if it stayed there.
  const sung = pitches.sort((a, b) => a - b), hz = sung[sung.length >> 1], steady = sung.length > 3 && sung[Math.floor(sung.length * 0.8)] / sung[Math.floor(sung.length * 0.2)] < 1.03;
  const note = hz && steady ? `, pitch ${hz.toFixed(1)} Hz ${noteName(hz)}` : '';
  return `over ${seconds}s: holds ${levels[levels.length >> 1].toFixed(3)}, peak ${top.toFixed(3)}${rate}${note}`;
};
/** One step of a state: a click, a value, or a drag, each done as a person would where a person could. A wait says what it heard. */
const act = async (page, step) => {
  if (typeof step === 'string') return page.click(step, { timeout: CLICK });
  if (step.wait) return listen(page, step.wait);
  if (step.press) return page.keyboard.down(step.press);
  if (step.release) return page.keyboard.up(step.release);
  if (step.hover) return page.hover(step.hover, { timeout: CLICK });
  const on = page.locator(step.on).first();
  await on.waitFor({ timeout: CLICK });
  if (step.key) return on.press(step.key, { timeout: CLICK });
  // What no person could do, but the page's author can: set attributes, to see the part another way, as broken or worn. Waits for the redraw.
  if (step.attr) {
    await on.evaluate((el, attr) => { for (const [k, v] of Object.entries(attr)) v === null ? el.removeAttribute(k) : el.setAttribute(k, String(v)); }, step.attr);
    return page.waitForTimeout(600);
  }
  if (step.to !== undefined) {
    const set = await on.evaluate((el, to) => {
      const input = el.matches('input') ? el : el.querySelector('input[type="range"], input');
      if (!input) return false;
      const min = +(input.min || 0), max = +(input.max || 1);
      if (input.type === 'checkbox' || input.type === 'radio') input.checked = to >= 0.5;
      else input.value = String(min + (max - min) * to);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, step.to);
    if (!set) throw new Error(`${step.on} has no input to set a value on, so drag it with at`);
    return;
  }
  const box = await on.boundingBox(), arc = step.turn && Array.from({ length: Math.ceil(Math.abs(step.turn[1] - step.turn[0]) / 15) + 1 }, (_, i) => {
    const a = ((step.turn[0] + Math.sign(step.turn[1] - step.turn[0]) * 15 * i) * Math.PI) / 180, r = step.r ?? 0.35;
    return [0.5 + Math.sin(a) * r, 0.5 - (Math.cos(a) * r * box.width) / box.height];
  });
  const points = (arc ?? step.at ?? [[0.5, 0.5]]).map(([x, y]) => [box.x + box.width * x, box.y + box.height * y]);
  await page.mouse.move(...points[0]);
  await page.mouse.down();
  // A person's pace, with ms for each leg of the drag: some things care how fast they're moved. Without it, as fast as the page takes it.
  for (const point of points.slice(1)) {
    if (!step.ms) await page.mouse.move(...point, { steps: 8 });
    else {
      const from = points[points.indexOf(point) - 1], steps = Math.max(2, Math.round(step.ms / 16));
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(from[0] + ((point[0] - from[0]) * i) / steps, from[1] + ((point[1] - from[1]) * i) / steps);
        await page.waitForTimeout(16);
      }
    }
  }
  if (!step.hold) await page.mouse.up();
};
// Vite's own reload would land in the middle of a capture, so this page never hears of it.
await page.routeWebSocket(/./, () => {});
const problems = [], warnings = [];
page.on('pageerror', e => problems.push(e.message));
page.on('console', m => {
  if (m.type() === 'error' && !m.text().includes('404')) problems.push(m.text());
  else if (m.type() === 'warning' && !BROWSER.test(m.text())) warnings.push(m.text());
});
// What a page names, after going to it. A thing asked for by its id is that one; a page asked for is everything on it.
const visit = async target => {
  await open(page, target);
  // One device that fails to load takes the whole page with it.
  const all = await page.evaluate(() => window.look ?? null);
  // A script that fails never gets as far as window.look, so its error is the news.
  if (!all && problems.length) throw new Error(`${target} failed before it set window.look: ${problems.join('; ')}`);
  if (!all) throw new Error(`${target} sets no window.look, which names its device by id with its states, as { id: { state: [steps] } }`);
  return all;
};
const targets = asked.length ? asked : await everything(page);
const composer = await (await browser.newContext({ viewport: { width: SHEET + 32, height: 900 } })).newPage();
// Where two pictures of it differ, as shares of the picture, and how much of it that is. What's on a canvas or a screen shows here when the page's own words don't change.
const moved = (a, b) => composer.evaluate(async ([a, b]) => {
  const W = 480, read = async src => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: W, height: Math.round((W * img.naturalHeight) / img.naturalWidth) }), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, c.width, c.height);
    return x.getImageData(0, 0, c.width, c.height);
  };
  const [p, q] = [await read(a), await read(b)], H = p.height;
  let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (Math.abs(p.data[i] - q.data[i]) + Math.abs(p.data[i + 1] - q.data[i + 1]) + Math.abs(p.data[i + 2] - q.data[i + 2]) < 24) continue;
    n++;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return n ? { share: n / (W * H), x: x0 / W, y: y0 / H, w: (x1 - x0 + 1) / W, h: (y1 - y0 + 1) / H } : null;
}, [a, b]);

// An error fails the run. A warning is printed and only fails it under --strict.
const report = () => {
  for (const p of problems) {
    console.log(`  ! ${p}`);
    failed = true;
  }
  const counts = new Map();
  for (const w of warnings) counts.set(w, (counts.get(w) ?? 0) + 1);
  // A hand or a rod passes over print, so print is only lost if it's under something in every state.
  for (const [w, n] of counts) if (w.startsWith('print is under') && n < shots) counts.delete(w);
  for (const [w, n] of counts) console.log(`  ~ ${w}${n > 1 ? ` (in ${n} states)` : ''}`);
  warned += counts.size;
};

const capture = async (target, id, again) => {
  const t0 = performance.now();
  problems.length = warnings.length = shots = 0;
  const single = `.look/${id}`, fileOf = name => `${single}/${name.replace(/[^\w-]+/g, '-')}`;
  rmSync(single, { recursive: true, force: true });
  mkdirSync(single, { recursive: true });
  const all = again ? await visit(target) : await page.evaluate(() => window.look);
  if (!all[id]) {
    console.log(`${id}: no such thing. There are ${Object.keys(all).join(', ')}.`);
    failed = true;
    return;
  }
  // A page may mount its device a frame or two after load. Waiting for an id it hasn't got would only run out the clock.
  const there = await page.waitForFunction(id => document.getElementById(id), id, { timeout: CLICK }).then(() => true, () => false);
  if (!there) {
    const devices = await page.evaluate(() => [...document.querySelectorAll('d-device')].map(d => d.id || 'one with no id'));
    console.log(`${id}: window.look names it, so its device needs id="${id}", and nothing on the page has it. It has ${devices.length ? `d-device ${devices.join(', ')}` : 'no d-device'}.`);
    failed = true;
    return report();
  }
  await page.waitForFunction(id => [...(window.engine?.devices ?? [])].some(d => d.el.id === id && d.canvas), id, { timeout: SETTLE * 3 });
  await page.evaluate(() => document.querySelector('[data-demo] ~ img, [data-demo] + img')?.remove());
  let restless = false;
  const calm = async () => {
    if (!(await settled(page, restless ? RESTLESS : SETTLE))) restless = true;
  };
  await calm();
  const device = page.locator(`#${id}`), low = await device.boundingBox();
  if (debug) await device.evaluate((el, debug) => el.setAttribute('debug', debug), debug);
  // A clip is cut off at the viewport without a word, which shrinks the picture under its click areas.
  await page.setViewportSize({ ...VIEW, height: Math.max(VIEW.height, Math.ceil(low.y + low.height + MARGIN)) });
  await calm();
  const box = await device.boundingBox();
  const clip = { x: box.x - MARGIN, y: box.y - MARGIN, width: box.width + MARGIN * 2, height: box.height + MARGIN * 2 };
  const view = { w: clip.width, h: clip.height };
  const found = new Set();
  const shot = async name => {
    shots++;
    await mapped(page, id, SETTLE * 3);
    // A fault that holds in every state is said once, by the first state that found it.
    for (const fault of await page.evaluate(faults, id)) {
      if (found.has(fault)) continue;
      found.add(fault);
      if (fault.startsWith('maybe: ')) warnings.push(fault.slice(7));
      else problems.push(`state "${name}": ${fault}`);
    }
    // The picture stops at the device and its margin, so a thing carried past that is gone from it without a word. What already lay past it at rest isn't news: a box can be bigger than what's drawn in it.
    const off = await page.evaluate(({ id, x, y, width, height }) => {
      const out = [...document.getElementById(id).querySelectorAll('*')].filter(el => {
        // A face turned away only lies somewhere until it's up.
        if (el.localName === 'canvas' || el.closest('[reverse], [side]') || !el.checkVisibility()) return false;
        const r = el.getBoundingClientRect();
        return r.width && r.height && (r.left < x - 1 || r.top < y - 1 || r.right > x + width + 1 || r.bottom > y + height + 1);
      });
      const atRest = (window.lookOff ??= new Set(out));
      return out.filter(el => !atRest.has(el)).map(el => el.getAttributeNames().filter(a => a.startsWith('d-') && a !== 'd-layer' && a !== 'd-reach').map(a => `${a}="${el.getAttribute(a)}"`)[0] ?? el.localName);
    }, { id, ...clip });
    for (const what of new Set(off)) warnings.push(`state "${name}": ${what} runs off the picture`);
    const hits = (await controls(page, id)).map(c => ({
      pin: c.pin && [c.pin[0] + MARGIN, c.pin[1] + MARGIN], corners: c.corners.map(([x, y]) => [x + MARGIN, y + MARGIN]),
    }));
    return { name, hits, ...view, src: png(await page.screenshot({ clip, path: `${fileOf(name)}.png` })) };
  };
  const states = [await shot('rest')];
  const seen = await page.evaluate(scene, id), inWords = [];
  const piece = !crop ? null : await cropBox(page, id, box, seen?.size ?? [box.width / 4, box.height / 4]).catch(() => null);
  if (crop && !piece) problems.push(`--crop ${crop} isn't anything on it`);
  const cropped = [];
  const cut = async name => {
    if (piece) cropped.push({ name, src: png(await page.screenshot({ clip: piece, path: `${fileOf(name)}.crop.png` })) });
  };
  await cut('rest');
  let before = await readings(page, id);
  if (seen) {
    const { size: [w, h], lines, counts } = seen;
    inWords.push(`${id}  ${w}×${h}mm  ${counts.parts} parts. Boxes are mm from the device's top left, by centre. Height is mm over what it sits on, then over the device's face.`, ...lines);
  }
  for (const [name, clicks] of tries.length ? tries.map((steps, i) => [`try ${i + 1}`, steps]) : Object.entries(all[id])) {
    const heard = [];
    try {
      await page.mouse.up();
      for (const step of clicks) {
        const said = await act(page, step);
        if (typeof said === 'string') heard.push(said);
      }
    } catch (e) {
      const why = e.message.match(/\S.*intercepts pointer events/)?.[0];
      problems.push(`state "${name}": ${e.name === 'TimeoutError' ? `nothing to click at ${clicks.map(c => c.on ?? c.hover ?? c.wait ?? c).join(', ')}` : e.message}${why ? `: ${why}` : ''}`);
    }
    if (!clicks.some(c => c.hold || c.hover)) await page.mouse.move(0, 0);
    await calm();
    const was = states.at(-1), now = await shot(name), after = await readings(page, id), changed = changes(before, after), peak = await loudness(page);
    states.push(now);
    await cut(name);
    before = after;
    const diff = await moved(was.src, now.src), perMm = seen ? seen.size[0] / box.width : 1 / 4;
    if (!changed.length && !diff) warnings.push(`state "${name}" changed nothing, in the page or on screen`);
    // From the device's corner, as everything else here is.
    const where = !diff ? 'nothing on screen' : `${(diff.share * 100).toFixed(1)}% of the picture, in ${[(diff.x * clip.width - MARGIN) * perMm, (diff.y * clip.height - MARGIN) * perMm, diff.w * clip.width * perMm, diff.h * clip.height * perMm].map(v => v.toFixed(0)).join(' ')}mm`;
    const loud = peak === null ? '' : `, sound peak ${peak.toFixed(3)}`;
    console.log(`  ${name}: ${changed.length} change${changed.length === 1 ? '' : 's'}, ${where}${loud}${heard.map(h => `; ${h}`).join('')}`);
    inWords.push('', `state "${name}": ${where}${loud || ', no sound'}${heard.map(h => `; ${h}`).join('')}`, ...changed.slice(0, 40).map(c => `  ${c.slice(0, 160)}`), ...(changed.length > 40 ? [`  and ${changed.length - 40} more`] : []));
  }
  if (inWords.length) {
    const report = `${inWords.join('\n')}\n`;
    writeFileSync(`.look/${id}.txt`, report);
    if (wordy) console.log(report);
  }
  if (cropped.length) {
    await composer.setContent(`<!doctype html><style>body { margin: 16px; background: #222; color: #ddd; font: 13px ui-monospace, monospace; display: flex; flex-wrap: wrap; gap: 12px; } figure { margin: 0; } img { width: ${piece.width > 500 ? SHEET : Math.min(760, Math.round(piece.width * 3))}px; display: block; } figcaption { margin-top: 4px; }</style>${cropped.map(c => `<figure><img src="${c.src}"><figcaption>${c.name}</figcaption></figure>`).join('')}`);
    await composer.waitForLoadState();
    await composer.screenshot({ path: `.look/${id}.crop.png`, fullPage: true });
    console.log(`  → .look/${id}.crop.png`);
  }
  await device.evaluate(el => el.setAttribute('debug', 'height'));
  await calm();
  await page.waitForTimeout(100);
  const height = png(await page.screenshot({ clip }));

  // `front.jpg` is the one to judge by. `ref` starts it off and you replace it with the straight-on one.
  const file = photo(id);
  await sheet(composer, states, height, file && `data:image/jpeg;base64,${readFileSync(file).toString('base64')}`, seen?.close ?? []);
  await composer.waitForLoadState();
  await composer.screenshot({ path: `.look/${id}.png`, fullPage: true });
  console.log(`${id.padEnd(7)}${((performance.now() - t0) / 1000).toFixed(1)}s  ${states.length} state${states.length > 1 ? 's' : ''}${restless ? ', never still' : ''}  → .look/${id}.png, each state in .look/${id}/${seen ? `, ${seen.counts.parts} parts, ${seen.counts.into} run into another, ${seen.counts.past} past their holder → .look/${id}.txt` : ''}`);
  report();
};

// One that crashes doesn't stop the rest.
const attempt = async target => {
  let ids = [];
  try {
    const all = await visit(target);
    ids = target in all ? [target] : Object.keys(all);
    if (!ids.length) throw new Error(`${target}'s window.look names no device`);
    for (const [i, id] of ids.entries()) await capture(target, id, i > 0);
  } catch (e) {
    console.log(`${ids.length === 1 ? ids[0] : target}: ${e.message}`);
    failed = true;
  }
};

for (const target of targets) await attempt(target);

if (live) {
  let again = false, busy = false, timer;
  const run = async () => {
    if (busy) return void (again = true);
    busy = true;
    for (const target of targets) await attempt(target);
    busy = false;
    if (again) {
      again = false;
      run();
    }
  };
  await watch(context, () => {
    clearTimeout(timer);
    timer = setTimeout(run, 30);
  });
  console.log('Watching. Stop with ctrl-c.');
  await new Promise(() => {});
}

await browser.close();
console.log(`${((performance.now() - started) / 1000).toFixed(1)}s${warned ? `, ${warned} warning${warned > 1 ? 's' : ''}` : ''}`);
process.exit(failed || (strict && warned) ? 1 : 0);
}
