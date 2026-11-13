// Positions off a photo, so nobody guesses them. `pnpm measure <photo> <wMm>[x<hMm>] --corners 120,80 1900,92 1890,1100 115,1090`.
// The corners are where the object's straight edges would meet, clockwise from the top left, in the photo's pixels. Run it without them for .look/measure-photo.png, the photo with a pixel grid to read them off.
// A person finds these in a look and nothing else finds them reliably, so nothing here tries: a wrong corner skews every position without a sign of it.
// Straightens the photo onto the object's real size and writes .look/measure.png with a mm grid to read `place` off. `--zoom x,y,w,h` looks again at that region in mm, as large as the picture allows, with a 1mm grid, or 0.1mm on something 6mm or less, as many times as you like. Each writes .look/measure-zoom-x_y_w_h.png, so one doesn't lose another.
// For a dial, `--polar cx,cy` adds rings and spokes round that centre in mm, with angles clockwise from straight up. `--circle x,y x,y x,y ...` fits a circle through points in mm, for a dial's centre, and gives each point's angle round it.
// `--colour x,y` reads the colour at that point in mm, as many times as you like.
// `--outline x,y x,y x,y ...` takes a rough closed outline in mm, a dozen or so points off the grid, clockwise, and pulls it onto the object's edge, for bodies `pnpm trace` can't flood: gloss, sunburst, a shadow. It looks `--reach` mm either side, 3 by default, and prints points ready for `spline`, with .look/measure-outline.png to check them on. Give it again for another shape.
// `--list` also boxes what stands out and writes each one's centre and size to .look/measure.txt, ready for `place`. It's good on dense print and noise on bodies and form. `--min 0.5` finds things down to that many mm, 1 by default, and `--all` keeps rules and ticks too.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, cmd, privateDir } from './browser.mjs';

const USAGE = `${cmd('measure')} <photo> <wMm>[x<hMm>] --corners x,y x,y x,y x,y [--zoom x,y,w,h] [--polar cx,cy] [--circle x,y x,y x,y ...] [--colour x,y] [--outline x,y x,y x,y ...] [--reach mm] [--list] [--min mm] [--all]`;
const stop = message => {
  console.error(message);
  process.exit(1);
};

const point = text => {
  const p = (text ?? '').split(',').map(Number);
  return p.length === 2 && p.every(Number.isFinite) ? p : null;
};
const args = process.argv.slice(2), plain = [], zooms = [], colours = [], outlines = [];
let corners = null, smallest = 1, all = false, list = false, polar = null, circle = null, reach = 3;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--corners') {
    corners = args.slice(i + 1, i + 5).map(c => c.split(',').map(Number));
    if (corners.length !== 4 || corners.flat().some(n => !Number.isFinite(n))) stop(`--corners takes four x,y points, clockwise from the top left.\n${USAGE}`);
    i += 4;
  } else if (a === '--zoom') {
    const z = (args[++i] ?? '').split(',').map(Number);
    if (z.length !== 4 || z.some(n => !Number.isFinite(n))) stop(`--zoom takes x,y,w,h in mm.\n${USAGE}`);
    zooms.push(z);
  } else if (a === '--min') {
    smallest = +args[++i];
    if (!(smallest > 0)) stop(`--min takes a size in mm.\n${USAGE}`);
    list = true;
  } else if (a === '--all') all = list = true;
  else if (a === '--list') list = true;
  else if (a === '--polar') {
    polar = point(args[++i]);
    if (!polar) stop(`--polar takes a centre, cx,cy in mm.\n${USAGE}`);
  } else if (a === '--colour') {
    const at = point(args[++i]);
    if (!at) stop(`--colour takes x,y in mm.\n${USAGE}`);
    colours.push(at);
  } else if (a === '--circle') {
    circle = [];
    while (point(args[i + 1])) circle.push(point(args[++i]));
    if (circle.length < 3) stop(`--circle takes at least three x,y points in mm.\n${USAGE}`);
  } else if (a === '--outline') {
    const rough = [];
    while (point(args[i + 1])) rough.push(point(args[++i]));
    if (rough.length < 3) stop(`--outline takes at least three x,y points in mm, round the shape.\n${USAGE}`);
    outlines.push(rough);
  } else if (a === '--reach') {
    reach = +args[++i];
    if (!(reach > 0)) stop(`--reach takes a distance in mm.\n${USAGE}`);
  }
  else if (a.startsWith('-')) stop(`No such flag as ${a}.\n${USAGE}`);
  else plain.push(a);
}
const [photo, size] = plain;
if (!photo || !size) stop(USAGE);
const sizes = size.match(/^(\d*\.?\d+)(?:x(\d*\.?\d+))?$/);
if (!sizes) stop(`"${size}" isn't a size. It's the object's width in mm, or <wMm>x<hMm>.\n${USAGE}`);
if (!existsSync(resolve(photo))) stop(`No such photo: ${photo}`);
const W = +sizes[1];

const bytes = readFileSync(resolve(photo));
const mime = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'image/jpeg'
  : bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? 'image/png'
    : bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP' ? 'image/webp' : null;
if (!mime) stop(`${photo} isn't a JPEG, PNG or WebP.`);

const browser = await (await chromium()).launch();
const page = await browser.newPage();
const fail = message => browser.close().then(() => stop(message));
const { pw, ph, rgba } = await page.evaluate(async src => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight }), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height).data;
  let s = '';
  for (let i = 0; i < data.length; i += 32768) s += String.fromCharCode(...data.subarray(i, i + 32768));
  return { pw: c.width, ph: c.height, rgba: btoa(s) };
}, `data:${mime};base64,${bytes.toString('base64')}`).catch(() => fail(`${photo} can't be decoded.`));
const px = Buffer.from(rgba, 'base64');

/** The photo as it came, with a pixel grid to read corners off, and the corners over it if there are any. */
const original = async quad => {
  const k = Math.min(1, 1400 / Math.max(pw, ph)), step = Math.max(pw, ph) > 1600 ? 200 : 100;
  await page.setViewportSize({ width: Math.ceil(pw * k), height: Math.ceil(ph * k) });
  await page.setContent(`<!doctype html><body style="margin:0"><img id="p" src="data:${mime};base64,${bytes.toString('base64')}" style="width:${pw * k}px;display:block"><svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 ${pw} ${ph}">
    ${Array.from({ length: Math.floor(pw / step) }, (_, i) => `<line x1="${(i + 1) * step}" x2="${(i + 1) * step}" y1="0" y2="${ph}" stroke="#0ff" stroke-opacity=".3" vector-effect="non-scaling-stroke"/><text x="${(i + 1) * step}" y="${16 / k}" fill="#0ff" font-size="${12 / k}">${(i + 1) * step}</text>`).join('')}
    ${Array.from({ length: Math.floor(ph / step) }, (_, i) => `<line y1="${(i + 1) * step}" y2="${(i + 1) * step}" x1="0" x2="${pw}" stroke="#0ff" stroke-opacity=".3" vector-effect="non-scaling-stroke"/><text y="${(i + 1) * step}" x="${2 / k}" fill="#0ff" font-size="${12 / k}">${(i + 1) * step}</text>`).join('')}
    ${quad ? `<polygon points="${quad.join(' ')}" fill="none" stroke="#f30" stroke-width="2" vector-effect="non-scaling-stroke"/>` : ''}</svg>`);
  await page.locator('#p').evaluate(i => i.decode());
  await page.screenshot({ path: '.look/measure-photo.png' });
};

privateDir('.look');
if (!corners) {
  await original(null);
  await fail(`${photo} is ${pw}×${ph}px. Read the object's corners off .look/measure-photo.png, where its straight edges would meet if its corners are round, clockwise from the top left, and give them:\n${USAGE}`);
}
const quad = corners;
// Clockwise and not crossed, or everything comes out mirrored or folded.
for (let i = 0; i < 4; i++) {
  const [a, b, c] = [quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4]];
  if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) <= 0) await fail(`--corners go clockwise from the top left, and these don't: ${quad.join(' ')}.\n${USAGE}`);
}
const across = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const seenW = (across(quad[0], quad[1]) + across(quad[3], quad[2])) / 2, seenH = (across(quad[0], quad[3]) + across(quad[1], quad[2])) / 2;
const H = +sizes[2] || +(W * seenH / seenW).toFixed(1);
// A photo at an angle foreshortens one way, so this only says so. Straight-on, it means a corner or a size is wrong.
const slant = (seenH / seenW) / (H / W);
const notes = Math.abs(Math.log(slant)) > 0.2 ? [`The corners are ${(seenW / seenH).toFixed(2)}:1 and the size is ${(W / H).toFixed(2)}:1. Fine on a photo at an angle, where things that stand proud shift too. Straight-on, a corner or the size is wrong.`] : [];

/** Unit square to the photo. */
const homography = ([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) => {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3, den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
};
const M = homography(quad);

/** A region of the object, in mm, straightened at `scale` pixels to the mm. */
const flatten = ([rx, ry, rw, rh], scale) => {
  const w = Math.round(rw * scale), h = Math.round(rh * scale), out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (rx + (x + 0.5) / scale) / W, v = (ry + (y + 0.5) / scale) / H, k = M[6] * u + M[7] * v + 1;
    const sx = (M[0] * u + M[1] * v + M[2]) / k - 0.5, sy = (M[3] * u + M[4] * v + M[5]) / k - 0.5, x0 = Math.floor(sx), y0 = Math.floor(sy), i = (y * w + x) * 4;
    out[i + 3] = 255;
    if (x0 < 0 || y0 < 0 || x0 + 1 >= pw || y0 + 1 >= ph) continue;
    const fx = sx - x0, fy = sy - y0;
    for (let c = 0; c < 3; c++) {
      const a = (y0 * pw + x0) * 4 + c, b = a + 4, d = a + pw * 4, e = d + 4;
      out[i + c] = (px[a] * (1 - fx) + px[b] * fx) * (1 - fy) + (px[d] * (1 - fx) + px[e] * fx) * fy;
    }
  }
  return { w, h, data: out };
};

/** What stands out from the surface round it, by its distance from a wide average, joined into pieces, and letters into words. */
const features = ({ w, h, data }, scale, least) => {
  const gray = new Float32Array(w * h), sum = new Float64Array((w + 1) * (h + 1));
  for (let i = 0; i < w * h; i++) gray[i] = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sum[(y + 1) * (w + 1) + x + 1] = gray[y * w + x] + sum[y * (w + 1) + x + 1] + sum[(y + 1) * (w + 1) + x] - sum[y * (w + 1) + x];
  const R = Math.max(4, Math.round(5 * scale)), far = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = Math.max(0, x - R), b = Math.max(0, y - R), c = Math.min(w, x + R + 1), d = Math.min(h, y + R + 1);
    far[y * w + x] = Math.abs(gray[y * w + x] - (sum[d * (w + 1) + c] - sum[b * (w + 1) + c] - sum[d * (w + 1) + a] + sum[b * (w + 1) + a]) / ((c - a) * (d - b)));
  }
  // The photo's own noise sets how far is far: half the pixels are surface, so the middle of the distances is its grain.
  const sorted = Float32Array.from(far).sort(), T = Math.max(14, sorted[(w * h) >> 1] * 3.5);
  const seen = new Int32Array(w * h), pieces = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || far[i] <= T) continue;
    const id = pieces.length + 1, stack = [i];
    seen[i] = id;
    let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    const edge = [];
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j / w) | 0;
      n++;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      let rim = false;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) {
        if (k < 0 || far[k] <= T) { rim = true; continue; }
        if (!seen[k]) { seen[k] = id; stack.push(k); }
      }
      if (rim) edge.push([x, y]);
    }
    pieces.push({ n, x0, y0, x1: x1 + 1, y1: y1 + 1, edge });
  }
  const small = least * scale;
  // What touches the edge of the picture is the object's own edge, or the photo's.
  const clear = Math.ceil(scale * 0.7);
  let found = pieces.filter(p => (p.x1 - p.x0 >= small || p.y1 - p.y0 >= small) && (p.x1 - p.x0) * (p.y1 - p.y0) < w * h * 0.5 && p.x0 >= clear && p.y0 >= clear && p.x1 <= w - clear && p.y1 <= h - clear);
  const kind = p => {
    const bw = p.x1 - p.x0, bh = p.y1 - p.y0, cx = (p.x0 + p.x1) / 2, cy = (p.y0 + p.y1) / 2, r = (bw + bh) / 4;
    // A rule, or the outline of something bigger, with almost nothing in its box.
    if (Math.max(bw, bh) / Math.min(bw, bh) > 6 || p.n < bw * bh * 0.12) return 'line';
    if (bw / bh > 0.82 && bw / bh < 1.22 && r > 1.2 * scale) {
      // Its outermost points lie on a circle, however much of what's inside it is lit.
      const by = new Map();
      for (const [x, y] of p.edge) {
        const a = Math.round(Math.atan2(y - cy, x - cx) * 16), d = Math.hypot(x - cx, y - cy);
        by.set(a, Math.max(by.get(a) ?? 0, d));
      }
      const off = [...by.values()].map(d => Math.abs(d - r) / r).sort((a, b) => a - b);
      if (by.size > 60 && off[(off.length * 0.8) | 0] < 0.08) return 'circle';
    }
    const inside = p.edge.filter(([x, y]) => x - p.x0 > 2 && p.x1 - x > 3 && y - p.y0 > 2 && p.y1 - y > 3).length;
    return bw > 2 * scale && bh > 2 * scale && inside < p.edge.length * 0.15 ? 'box' : 'mark';
  };
  for (const p of found) p.kind = kind(p);
  // Letters of a word: marks of about the same height on about the same line, closer than they are tall.
  const marks = found.filter(p => p.kind === 'mark' && p.y1 - p.y0 < 9 * scale && p.y1 - p.y0 > 0.8 * scale).sort((a, b) => a.x0 - b.x0), joined = [];
  for (const p of marks) {
    const near = joined.find(q => {
      const hp = p.y1 - p.y0, hq = q.y1 - q.y0, mid = Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0);
      return p.x0 - q.x1 < Math.max(hp, hq) * 0.9 && p.x0 >= q.x0 && mid > Math.min(hp, hq) * 0.5;
    });
    if (near) Object.assign(near, { x1: Math.max(near.x1, p.x1), y0: Math.min(near.y0, p.y0), y1: Math.max(near.y1, p.y1), letters: near.letters + 1 });
    else joined.push({ ...p, letters: 1 });
  }
  found = [...found.filter(p => !marks.includes(p)), ...joined.map(p => (p.letters > 1 ? { ...p, kind: 'text' } : p))];
  // Anything wholly inside a circle or box belongs to it, so it's counted once. The zoom is how to see into one.
  const holder = p => found.some(q => q !== p && (q.kind === 'circle' || q.kind === 'box') && p.x0 >= q.x0 && p.x1 <= q.x1 && p.y0 >= q.y0 && p.y1 <= q.y1);
  // Rules and loose ticks would bury the rest, and the grid reads them well enough.
  const wanted = p => all || p.kind === 'circle' || p.kind === 'box' || p.kind === 'text' || (p.kind === 'mark' && Math.max(p.x1 - p.x0, p.y1 - p.y0) >= 1.5 * least * scale);
  return found.filter(p => !holder(p) && wanted(p)).map(({ kind, x0, y0, x1, y1 }) => ({ kind, x: (x0 + x1) / 2 / scale, y: (y0 + y1) / 2 / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale }));
};

/** The picture softened by `r` pixels, a run each way twice, as floats. */
const soften = ({ w, h, data }, r) => {
  const out = new Float32Array(w * h * 3), line = new Float32Array(Math.max(w, h));
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) out[i * 3 + c] = data[i * 4 + c];
  const run = (n, at) => {
    for (let pass = 0; pass < 2; pass++) for (let c = 0; c < 3; c++) {
      for (let i = 0; i < n; i++) line[i] = out[at(i) * 3 + c];
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += line[Math.min(n - 1, Math.max(0, i))];
      for (let i = 0; i < n; i++) {
        out[at(i) * 3 + c] = sum / (2 * r + 1);
        sum += line[Math.min(n - 1, i + r + 1)] - line[Math.max(0, i - r)];
      }
    }
  };
  for (let y = 0; y < h; y++) run(w, x => y * w + x);
  for (let x = 0; x < w; x++) run(h, y => y * w + x);
  return out;
};

/**
 * A rough closed outline pulled onto the edge it runs near. Every point along it looks in and out for where the colour changes and what lies beyond is the ground that's further out still, which is what tells the silhouette from a highlight on a glossy rim.
 * The answer is then the cheapest way round through all of those, where moving sideways costs something, so one bad patch can't drag it off: it just carries on from either side, and says so.
 */
const snapOutline = (rough, { w, h }, soft, scale, reach) => {
  const closed = [...rough, rough[0]], at = i => rough[(i + rough.length) % rough.length];
  // Through the rough points with the same curve `spline` uses, finely enough to walk along.
  const fine = [];
  for (let i = 0; i < rough.length; i++) {
    const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)], n = Math.max(4, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) * 4));
    for (let k = 0; k < n; k++) {
      const t = k / n, q = 1 - t, b0 = q * q * q, b1 = 3 * q * q * t, b2 = 3 * q * t * t, b3 = t * t * t;
      fine.push([0, 1].map(e => b0 * b[e] + b1 * (b[e] + (c[e] - a[e]) / 6) + b2 * (c[e] - (d[e] - b[e]) / 6) + b3 * c[e]));
    }
  }
  let run = 0;
  const lengths = fine.map((p, i) => (run += i ? Math.hypot(p[0] - fine[i - 1][0], p[1] - fine[i - 1][1]) : 0));
  const whole = run + Math.hypot(fine[0][0] - fine.at(-1)[0], fine[0][1] - fine.at(-1)[1]), gap = Math.min(2, Math.max(0.4, whole / 400)), N = Math.round(whole / gap), step = whole / N;
  const along = [];
  for (let i = 0, k = 0; i < N; i++) {
    while (k < fine.length - 1 && lengths[k + 1] < i * step) k++;
    along.push(fine[k]);
  }
  // Clockwise on screen has positive area here; out is to the left of the way it's walked.
  const area = closed.slice(1).reduce((a, p, i) => a + closed[i][0] * p[1] - p[0] * closed[i][1], 0), sign = area > 0 ? 1 : -1;
  const normals = along.map((p, i) => {
    const a = along[(i - 2 + N) % N], b = along[(i + 2) % N], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [(dy / l) * sign, (-dx / l) * sign];
  });
  const colour = (x, y) => {
    const u = Math.min(w - 2, Math.max(0, x * scale - 0.5)), v = Math.min(h - 2, Math.max(0, y * scale - 0.5)), x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0, i = (y0 * w + x0) * 3;
    return [0, 1, 2].map(c => (soft[i + c] * (1 - fx) + soft[i + 3 + c] * fx) * (1 - fy) + (soft[i + w * 3 + c] * (1 - fx) + soft[i + w * 3 + 3 + c] * fx) * fy);
  };
  const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const middle = list => [0, 1, 2].map(c => list.map(p => p[c]).sort((a, b) => a - b)[list.length >> 1]);
  const off = Math.max(0.1, 1 / scale), J = Math.round(reach / off) * 2 + 1, side = Math.max(0.4, 2 / scale), cost = new Float32Array(N * J), bare = new Float32Array(N * J);
  const grounds = along.map((p, i) => {
    const [nx, ny] = normals[i], seen = [];
    for (let d = reach + 1; d <= reach + 4; d += 0.5) seen.push(colour(p[0] + nx * d, p[1] + ny * d));
    return middle(seen);
  });
  // The ground changes slowly, so it's the middle of those along a stretch: one shadow or a thing lying across doesn't set it.
  const span = Math.round(12 / step);
  const ground = grounds.map((_, i) => middle(Array.from({ length: span * 2 + 1 }, (_, k) => grounds[(i + k - span + N * 2) % N])));
  let top = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < J; j++) {
    const d = (j - (J >> 1)) * off, [nx, ny] = normals[i], x = along[i][0] + nx * d, y = along[i][1] + ny * d;
    const outer = colour(x + nx * side, y + ny * side), inner = colour(x - nx * side, y - ny * side);
    bare[i * J + j] = apart(outer, inner) * Math.max(0, 1 - apart(outer, ground[i]) / Math.max(30, apart(inner, ground[i])));
    top = Math.max(top, bare[i * J + j]);
  }
  const sorted = Float32Array.from(bare).sort(), full = Math.max(sorted[(sorted.length * 0.98) | 0], 8);
  for (let k = 0; k < cost.length; k++) cost[k] = 1 - Math.min(1, bare[k] / full);
  // Twice round and keep the middle, so where it starts doesn't show.
  const reachOver = Math.max(1, Math.round(step / off)), sideways = 0.8 * off / step, T = N * 2;
  const best = new Float32Array(J), next = new Float32Array(J), from = new Int16Array(T * J);
  for (let j = 0; j < J; j++) best[j] = cost[j];
  for (let t = 1; t < T; t++) {
    const i = t % N;
    for (let j = 0; j < J; j++) {
      let low = Infinity, pick = j;
      for (let q = Math.max(0, j - reachOver); q <= Math.min(J - 1, j + reachOver); q++) {
        const c = best[q] + Math.abs(q - j) * sideways;
        if (c < low) { low = c; pick = q; }
      }
      next[j] = low + cost[i * J + j];
      from[t * J + j] = pick;
    }
    best.set(next);
  }
  let j = 0;
  for (let q = 1; q < J; q++) if (best[q] < best[j]) j = q;
  const chosen = new Int16Array(T);
  for (let t = T - 1; t >= 0; t--) {
    chosen[t] = j;
    j = from[t * J + j];
  }
  const path = [], weak = [];
  for (let k = 0; k < N; k++) {
    const t = k + (N >> 1), i = t % N, d = (chosen[t] - (J >> 1)) * off;
    path[i] = [along[i][0] + normals[i][0] * d, along[i][1] + normals[i][1] * d];
    weak[i] = cost[i * J + chosen[t]] > 0.92;
  }
  // The pixel steps out of it, then only the points the curve needs.
  let smooth = path;
  for (let pass = 0; pass < 2; pass++) smooth = smooth.map((_, i) => [0, 1].map(e => (smooth[(i - 1 + N) % N][e] + smooth[i][e] * 2 + smooth[(i + 1) % N][e]) / 4));
  const TOL = Math.max(0.2, W / 800), keep = new Set([0, N >> 1]);
  const split = (a, b) => {
    const [ax, ay] = smooth[a], [bx, by] = smooth[b % N], l = Math.hypot(bx - ax, by - ay) || 1;
    let far = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const dist = Math.abs((smooth[i][0] - ax) * (by - ay) - (smooth[i][1] - ay) * (bx - ax)) / l;
      if (dist > far) { far = dist; at = i; }
    }
    if (far > TOL) {
      keep.add(at);
      split(a, at);
      split(at, b);
    }
  };
  split(0, N >> 1);
  split(N >> 1, N);
  const points = [...keep].sort((a, b) => a - b).map(i => smooth[i]);
  // Where it found nothing, in runs along the way round.
  const blind = [];
  for (let i = 0; i < N; i++) if (weak[i] && !weak[(i - 1 + N) % N]) {
    let e = i;
    while (weak[(e + 1) % N] && e - i < N) e++;
    if ((e - i + 1) * step >= 8) blind.push([smooth[i], smooth[e % N], (e - i + 1) * step]);
  }
  const moved = smooth.map((p, i) => Math.hypot(p[0] - along[i][0], p[1] - along[i][1]));
  return { smooth, points, weak, blind, along, worst: Math.max(...moved), tol: TOL };
};

const round = v => +v.toFixed(1);
/** Top to bottom in rows, left to right along each, numbered, with the even pitch of any row that has one. */
const rows = (found, [rx, ry]) => {
  const left = found.map(f => ({ ...f, x: f.x + rx, y: f.y + ry })).sort((a, b) => a.y - b.y), lines = [];
  for (const f of left) {
    const row = lines.at(-1);
    if (row && Math.abs(f.y - row.y) < Math.max(1, Math.min(f.h, row.h) * 0.5)) row.items.push(f);
    else lines.push({ y: f.y, h: f.h, items: [f] });
  }
  let n = 0;
  for (const r of lines) {
    r.items.sort((a, b) => a.x - b.x);
    for (const f of r.items) f.n = ++n;
  }
  return lines;
};
const say = lines => lines.map(r => {
  const gaps = r.items.slice(1).map((f, i) => f.x - r.items[i].x), mean = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
  const even = gaps.length > 1 && gaps.every(g => Math.abs(g - mean) < Math.max(0.4, mean * 0.04));
  return [`row y ${round(r.items.reduce((a, f) => a + f.y, 0) / r.items.length)}${even ? `, even at ${mean.toFixed(2)}mm` : ''}`, ...r.items.map(f =>
    `  #${f.n} ${f.kind.padEnd(6)} ${`${round(f.x)} ${round(f.y)} ${round(f.w)} ${round(f.h)}`}`)].join('\n');
}).join('\n');

const draw = async ({ w, h, data }, scale, [rx, ry], lines, grid, label, path, traces = []) => {
  await page.setViewportSize({ width: w + 40, height: h + 40 });
  await page.setContent('<!doctype html><body style="margin:0;background:#111"><canvas id="c"></canvas>');
  await page.evaluate(({ w, h, rgba, scale, rx, ry, items, grid, label, polar, traces }) => {
    const c = document.getElementById('c');
    c.width = w + 40;
    c.height = h + 40;
    const x = c.getContext('2d'), raw = Uint8ClampedArray.from(atob(rgba), ch => ch.charCodeAt(0));
    x.fillStyle = '#111';
    x.fillRect(0, 0, c.width, c.height);
    x.putImageData(new ImageData(raw, w, h), 40, 40);
    x.font = '12px ui-monospace, monospace';
    x.textBaseline = 'middle';
    const bold = grid * 5;
    for (let mm = Math.ceil(rx / grid) * grid; (mm - rx) * scale <= w; mm += grid) {
      const major = Math.abs(mm / bold - Math.round(mm / bold)) < 1e-6, u = 40 + (mm - rx) * scale;
      x.strokeStyle = major ? 'rgba(0,255,255,.55)' : 'rgba(0,255,255,.18)';
      x.beginPath(); x.moveTo(u, 40); x.lineTo(u, h + 40); x.stroke();
      if (major) { x.fillStyle = '#6ff'; x.textAlign = 'center'; x.fillText(+mm.toFixed(1), u, 20); }
    }
    for (let mm = Math.ceil(ry / grid) * grid; (mm - ry) * scale <= h; mm += grid) {
      const major = Math.abs(mm / bold - Math.round(mm / bold)) < 1e-6, v = 40 + (mm - ry) * scale;
      x.strokeStyle = major ? 'rgba(0,255,255,.55)' : 'rgba(0,255,255,.18)';
      x.beginPath(); x.moveTo(40, v); x.lineTo(w + 40, v); x.stroke();
      if (major) { x.fillStyle = '#6ff'; x.textAlign = 'right'; x.fillText(+mm.toFixed(1), 36, v); }
    }
    if (polar) {
      const [u, v] = [40 + (polar[0] - rx) * scale, 40 + (polar[1] - ry) * scale], far = Math.hypot(w, h) + Math.hypot(u, v);
      x.save();
      x.beginPath();
      x.rect(40, 40, w, h);
      x.clip();
      x.textAlign = 'center';
      for (let deg = 0; deg < 360; deg += 5) {
        const major = deg % 30 === 0, a = (deg * Math.PI) / 180;
        x.strokeStyle = major ? 'rgba(255,220,0,.7)' : 'rgba(255,220,0,.22)';
        x.beginPath(); x.moveTo(u, v); x.lineTo(u + Math.sin(a) * far, v - Math.cos(a) * far); x.stroke();
      }
      const ring = scale * 5, rings = Math.ceil(far / ring);
      for (let i = 1; i <= rings; i++) {
        x.strokeStyle = i % 2 ? 'rgba(255,220,0,.22)' : 'rgba(255,220,0,.6)';
        x.beginPath(); x.arc(u, v, ring * i, 0, Math.PI * 2); x.stroke();
        if (i % 2 === 0) { x.fillStyle = '#fd0'; x.fillText(i * 5, u, v - ring * i); }
      }
      for (let deg = 0; deg < 360; deg += 30) {
        const a = (deg * Math.PI) / 180, at = ring * 1.5;
        x.fillStyle = '#fd0';
        x.fillText(`${deg}°`, u + Math.sin(a) * at, v - Math.cos(a) * at);
      }
      x.restore();
    }
    for (const { along, smooth, weak, points } of traces) {
      const P = ([a, b]) => [40 + (a - rx) * scale, 40 + (b - ry) * scale];
      x.strokeStyle = 'rgba(255,220,0,.8)';
      x.setLineDash([4, 4]);
      x.beginPath();
      along.forEach(p => x.lineTo(...P(p)));
      x.closePath();
      x.stroke();
      x.setLineDash([]);
      smooth.forEach((p, i) => {
        x.strokeStyle = weak[i] ? '#f0f' : '#f22';
        x.lineWidth = 1.5;
        x.beginPath();
        x.moveTo(...P(p));
        x.lineTo(...P(smooth[(i + 1) % smooth.length]));
        x.stroke();
      });
      x.fillStyle = '#fff';
      for (const p of points) {
        x.beginPath();
        x.arc(...P(p), 2, 0, Math.PI * 2);
        x.fill();
      }
      x.lineWidth = 1;
    }
    x.textAlign = 'left';
    for (const f of items) {
      const u = 40 + (f.x - f.w / 2 - rx) * scale, v = 40 + (f.y - f.h / 2 - ry) * scale;
      x.strokeStyle = { circle: '#ff0', box: '#f80', text: '#0f0', mark: '#f0f', line: '#08f' }[f.kind];
      x.lineWidth = 1;
      x.strokeRect(u, v, f.w * scale, f.h * scale);
      const t = String(f.n), tw = x.measureText(t).width;
      x.fillStyle = 'rgba(0,0,0,.75)';
      x.fillRect(u, v - 13, tw + 4, 13);
      x.fillStyle = '#fff';
      x.fillText(t, u + 2, v - 6);
    }
    x.fillStyle = '#ddd';
    x.fillText(label, 44, 10);
  }, { w, h, rgba: Buffer.from(data.buffer).toString('base64'), scale, rx, ry, items: lines.flatMap(r => r.items), grid, label, polar, traces });
  await page.locator('#c').screenshot({ path });
};

const LEGEND = list ? '  yellow circle, orange box, green text, pink mark, blue line' : '';
const WIDEST = 2400, scale = Math.min(10, WIDEST / W), whole = [0, 0, W, H], flat = flatten(whole, scale), lines = list ? rows(features(flat, scale, smallest), whole) : [];
const count = lines.reduce((a, r) => a + r.items.length, 0);
let report = `${photo} straightened to ${W}×${H}mm, corners ${quad.map(q => q.map(Math.round).join(',')).join(' ')}.\n`;
for (const note of notes) report += `${note}\n`;
if (circle) {
  // The circle closest to the points, by what's linear in its centre and radius.
  const mx = circle.reduce((a, p) => a + p[0], 0) / circle.length, my = circle.reduce((a, p) => a + p[1], 0) / circle.length;
  let uu = 0, vv = 0, uv = 0, uz = 0, vz = 0, zz = 0;
  for (const [x, y] of circle) {
    const u = x - mx, v = y - my, z = u * u + v * v;
    uu += u * u; vv += v * v; uv += u * v; uz += u * z; vz += v * z; zz += z;
  }
  const den = 2 * (uu * vv - uv * uv), cu = (uz * vv - vz * uv) / den, cv = (vz * uu - uz * uv) / den, cx = mx + cu, cy = my + cv;
  const r = Math.sqrt(cu * cu + cv * cv + zz / circle.length), off = Math.max(...circle.map(([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - r)));
  const angle = ([x, y]) => ((Math.atan2(x - cx, cy - y) * 180) / Math.PI + 360) % 360;
  report += `Circle: centre ${round(cx)},${round(cy)}, radius ${round(r)}mm, the worst point ${off.toFixed(2)}mm off it. Angles clockwise from straight up: ${circle.map(p => angle(p).toFixed(1)).join(' ')}.\n`;
}
for (const [x, y] of colours) {
  // The middle of what's round it, so a speck or a highlight doesn't decide it.
  const r = Math.max(1, Math.round(scale * 0.5)), cx = Math.round(x * scale), cy = Math.round(y * scale), near = [[], [], []];
  for (let v = Math.max(0, cy - r); v <= Math.min(flat.h - 1, cy + r); v++) for (let u = Math.max(0, cx - r); u <= Math.min(flat.w - 1, cx + r); u++) for (let c = 0; c < 3; c++) near[c].push(flat.data[(v * flat.w + u) * 4 + c]);
  report += `Colour at ${x},${y}: #${near.map(n => Math.round(n.sort((a, b) => a - b)[n.length >> 1] ?? 0).toString(16).padStart(2, '0')).join('')}\n`;
}
if (outlines.length) {
  const soft = soften(flat, Math.max(1, Math.round(scale * 0.1))), traces = outlines.map(o => snapOutline(o, flat, soft, scale, reach));
  for (const [i, t] of traces.entries()) {
    report += `Outline${traces.length > 1 ? ` ${i + 1}` : ''}: ${t.points.length} points, ready for spline, moved up to ${round(t.worst)}mm from yours${t.worst > reach - 0.3 ? `, which is as far as it looks: try a bigger --reach, or a closer point there` : ''}.\n[${t.points.map(p => `[${round(p[0])}, ${round(p[1])}]`).join(', ')}]\n`;
    for (const [a, b, l] of t.blind) report += `No clear edge for ${round(l)}mm from ${round(a[0])},${round(a[1])} to ${round(b[0])},${round(b[1])}, so that's carried across. Put a point there yourself if it's wrong.\n`;
  }
  await draw(flat, scale, whole, [], W > 150 ? 10 : 5, `${W}×${H}mm  yellow yours, red the edge, pink no clear edge, white the points`, '.look/measure-outline.png', traces);
}
if (list) report += `${count} found. Each is "x y w h" in mm, centre from the top left, ready for place.\n${say(lines)}\n`;
await draw(flat, scale, whole, lines, W > 150 ? 10 : 5, `${W}×${H}mm${LEGEND}`, '.look/measure.png');

const zoomFile = z => `.look/measure-zoom-${z.join('_')}.png`;
for (const z of zooms) {
  const near = Math.min(WIDEST / z[2], 1400 / z[3]), part = flatten(z, near), inside = list ? rows(features(part, near, Math.min(smallest, 0.3)), z) : [];
  await draw(part, near, z, inside, Math.max(z[2], z[3]) <= 6 ? 0.1 : 1, `${z.join(',')} mm${LEGEND}`, zoomFile(z));
  if (list) report += `\nzoom ${z.join(',')}\n${say(inside)}\n`;
}

await original(quad);
writeFileSync('.look/measure.txt', report);
console.log(report);
console.log(`Read positions off .look/measure.png${zooms.map(z => `, ${zoomFile(z)}`).join('')}.${outlines.length ? ' Check the outline on .look/measure-outline.png.' : ''} The corners are on .look/measure-photo.png.`);
await browser.close();
process.exit(0);
