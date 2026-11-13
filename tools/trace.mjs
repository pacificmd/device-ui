// Outlines off a straight-on photo, so a curved object's shapes are read rather than written by hand.
// pnpm trace <photo> <wMm>[x<hMm>] name=x,y[,tolerance][,mirror][,part][,around] ... name=x,y,w,h,ink ...
// x,y is any point inside the shape, in the photo's pixels. `around` takes the point as being outside the shape, on a plain ground, and traces what stands on that ground: for a dark or shaded body whose inside doesn't flood. `--ground x,y,w,h`, in the photo's pixels, counts that box as ground, for something lying across the shape, such as a neck over a body. `--blur px` evens a noisy photo before anything is compared, 1.5 by default. `ink` traces lettering: x,y,w,h is a box in the photo's pixels round a logo, a signature or a word, and everything in it in the colour least like the box's rim is the mark, every letter and every hole, as one path to fill with `rule="evenodd"`. The first shape sets the scale and the origin: it is that many mm
// across and its corner is 0,0, and nothing else can leave it. Paths print in mm with each one's box, a `part` from its own
// corner, and .look/trace.png shows what was found, to check by eye.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, cmd, privateDir } from './browser.mjs';

const USAGE = `${cmd('trace')} <photo> <wMm>[x<hMm>] name=x,y[,tolerance][,mirror][,part][,around] | name=x,y,w,h,ink ... [--ground x,y,w,h] [--blur px]`;
// Playwright closes its browser on the way out.
const stop = message => {
  console.error(message);
  process.exit(1);
};

const args = process.argv.slice(2), grounds = [];
let blur = 1.5;
if (args.includes('--blur')) blur = +args.splice(args.indexOf('--blur'), 2)[1];
for (let i = args.indexOf('--ground'); i >= 0; i = args.indexOf('--ground')) {
  const box = (args[i + 1] ?? '').split(',').map(Number);
  if (box.length !== 4 || box.some(n => !Number.isFinite(n))) stop(`--ground takes x,y,w,h in the photo's pixels.\n${USAGE}`);
  grounds.push(box);
  args.splice(i, 2);
}
const [photo, wide, ...specs] = args;
if (!photo || !wide || !specs.length) stop(USAGE);
const sizes = wide.match(/^(\d*\.?\d+)(?:x(\d*\.?\d+))?$/), wMm = +sizes?.[1], hMm = +sizes?.[2] || 0;
if (!wMm || (sizes[2] && !hMm)) stop(`"${wide}" isn't a size. It's the first shape's width in mm, or <wMm>x<hMm>.\n${USAGE}`);
if (!existsSync(resolve(photo))) stop(`No such photo: ${photo}`);

const shapes = specs.map(s => {
  const m = s.match(/^([A-Za-z_]\w*)=(\d+),(\d+)((?:,[^,]+)*)$/);
  if (!m) stop(`"${s}" isn't a shape. It wants name=x,y with whole photo pixels, then any of a tolerance, mirror, part, around.\n${USAGE}`);
  const more = m[4].split(',').slice(1);
  if (more.includes('ink')) {
    const [bw, bh, ...rest] = more.filter(o => o !== 'ink' && o !== 'part');
    if (!(+bw > 2) || !(+bh > 2) || rest.length) stop(`"${s}": ink takes a box, name=x,y,w,h,ink, in whole photo pixels, and only part besides.`);
    return { name: m[1], x: +m[2], y: +m[3], box: [+m[2], +m[3], +bw, +bh], ink: true, part: more.includes('part') };
  }
  const odd = more.find(o => o !== 'mirror' && o !== 'part' && o !== 'around' && !(+o > 0));
  if (odd) stop(`"${s}": "${odd}" isn't a tolerance above 0, mirror, part, around or ink.`);
  return { name: m[1], x: +m[2], y: +m[3], tol: +more.find(o => +o) || 12, mirror: more.includes('mirror'), part: more.includes('part'), around: more.includes('around') };
});
const twice = shapes.find((s, i) => shapes.findIndex(o => o.name === s.name) !== i);
if (twice) stop(`Two shapes are called ${twice.name}, and each becomes a const.`);

const bytes = readFileSync(resolve(photo));
// By what's in the file, as an extension can be wrong and a saved web image often is.
const mime = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'image/jpeg'
  : bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? 'image/png'
    : bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP' ? 'image/webp' : null;
if (!mime) stop(`${photo} isn't a JPEG, PNG or WebP.`);

// The browser reads the photo and draws the check.
const browser = await (await chromium()).launch();
const page = await browser.newPage();
const file = `data:${mime};base64,${bytes.toString('base64')}`;
const { w, h, rgba } = await page.evaluate(async ({ src, blur }) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
  const x = c.getContext('2d');
  x.filter = `blur(${blur}px)`;
  x.drawImage(img, 0, 0);
  const bytes = x.getImageData(0, 0, c.width, c.height).data;
  let s = '';
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return { w: c.width, h: c.height, rgba: btoa(s) };
}, { src: file, blur }).catch(() => stop(`${photo} can't be decoded.`));
const px = Buffer.from(rgba, 'base64');
for (const s of shapes) if (s.x >= w || s.y >= h) stop(`${s.name}: ${s.x},${s.y} is outside the photo, which is ${w}x${h}.`);

/** Everything reachable from a point without crossing an edge, compared step by step so shading on a curve doesn't stop it. */
function flood({ x, y, tol, around }, within) {
  const mask = new Uint8Array(w * h), stack = [y * w + x];
  const seed = (y * w + x) * 4;
  const far = (a, b) => Math.abs(px[a] - px[b]) + Math.abs(px[a + 1] - px[b + 1]) + Math.abs(px[a + 2] - px[b + 2]);
  mask[y * w + x] = 1;
  while (stack.length) {
    const i = stack.pop(), a = i * 4;
    for (const j of [i - 1, i + 1, i - w, i + w]) {
      if (j < 0 || j >= w * h || mask[j] || (within && !within(j)) || (j % w === 0 && i % w === w - 1) || (i % w === 0 && j % w === w - 1)) continue;
      const b = j * 4;
      // Colour may drift across a highlight, but not all the way to something else. A ground may go from dark to light as a backdrop does, and it's the steps that matter.
      if (far(a, b) <= tol && (around || far(seed, b) <= tol * 12)) {
        mask[j] = 1;
        stack.push(j);
      }
    }
  }
  return mask;
}

/** What a flood of the ground left: whatever the ground never reached, down to its biggest piece. */
function stands(ground) {
  for (const [x, y, bw, bh] of grounds) for (let r = y; r < Math.min(y + bh, h); r++) ground.fill(1, r * w + x, r * w + Math.min(x + bw, w));
  const mask = new Uint8Array(w * h), seen = new Uint8Array(w * h);
  let best = [];
  for (let i = 0; i < w * h; i++) {
    if (ground[i] || seen[i]) continue;
    const blob = [i], stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const a = stack.pop();
      for (const j of [a - 1, a + 1, a - w, a + w]) {
        if (j < 0 || j >= w * h || seen[j] || ground[j] || (j % w === 0 && a % w === w - 1) || (a % w === 0 && j % w === w - 1)) continue;
        seen[j] = 1;
        blob.push(j);
        stack.push(j);
      }
    }
    if (blob.length > best.length) best = blob;
  }
  for (const i of best) mask[i] = 1;
  return mask;
}

/** The mask's outer edge, walking round it with the shape on the right. Holes don't matter, since only the outside is followed. */
function edge(mask) {
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
  // Thin specks on the rim would snag the walk, so it starts from the biggest row and keeps to one blob.
  let start = -1;
  for (let i = 0; i < w * h && start < 0; i++) if (mask[i] && at((i % w) + 1, (i / w) | 0) && at(i % w, ((i / w) | 0) + 1)) start = i;
  if (start < 0) return [];
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const sx = start % w, sy = (start / w) | 0, line = [[sx, sy]];
  let x = sx, y = sy, d = 0;
  for (let n = 0; n < w * h; n++) {
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const t = (d + 6 + k) % 8, nx = x + dirs[t][0], ny = y + dirs[t][1];
      if (at(nx, ny)) {
        x = nx;
        y = ny;
        d = t;
        moved = true;
        break;
      }
    }
    if (!moved || (x === sx && y === sy)) break;
    line.push([x, y]);
  }
  return line;
}

/** Evens the two sides about a centre, row by row, for a shape that's meant to be symmetrical. */
function mirrored(line, centre) {
  const rows = new Map();
  for (const [x, y] of line) {
    const r = rows.get(y) ?? [x, x];
    rows.set(y, [Math.min(r[0], x), Math.max(r[1], x)]);
  }
  const ys = [...rows.keys()].sort((a, b) => a - b), half = y => (rows.get(y)[1] - rows.get(y)[0]) / 2;
  return [...ys.map(y => [centre - half(y), y]), ...ys.reverse().map(y => [centre + half(y), y])];
}

const smooth = (line, sigma) => {
  const r = Math.ceil(sigma * 2.5), weight = [];
  for (let i = -r; i <= r; i++) weight.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const total = weight.reduce((a, b) => a + b), n = line.length;
  return line.map((_, i) => {
    let x = 0, y = 0;
    weight.forEach((v, k) => {
      const p = line[(i + k - r + n * 4) % n];
      x += p[0] * v;
      y += p[1] * v;
    });
    return [x / total, y / total];
  });
};

/** Keeps the points that matter, Douglas-Peucker, within `e` of the line. */
function simplify(line, e) {
  const keep = new Uint8Array(line.length);
  const run = (a, b) => {
    let far = 0, at = -1;
    const [ax, ay] = line[a], [bx, by] = line[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const dist = Math.abs((line[i][0] - ax) * dy - (line[i][1] - ay) * dx) / len;
      if (dist > far) {
        far = dist;
        at = i;
      }
    }
    if (far > e) {
      keep[at] = 1;
      run(a, at);
      run(at, b);
    }
  };
  const half = line.length >> 1;
  keep[0] = keep[half] = 1;
  run(0, half);
  run(half, line.length - 1);
  return line.filter((_, i) => keep[i]);
}

/** A closed curve through the points, round everywhere but at real corners. */
function curve(points) {
  const n = points.length, mm = v => +v.toFixed(2);
  const tangents = points.map((p, i) => {
    const a = points[(i + n - 1) % n], b = points[(i + 1) % n];
    const ax = p[0] - a[0], ay = p[1] - a[1], bx = b[0] - p[0], by = b[1] - p[1];
    const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1, sharp = (ax * bx + ay * by) / (la * lb) < 0.3;
    const tx = ax / la + bx / lb, ty = ay / la + by / lb, l = Math.hypot(tx, ty) || 1;
    return sharp ? null : [tx / l, ty / l];
  });
  let out = `M${mm(points[0][0])} ${mm(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p = points[i], q = points[(i + 1) % n], t = tangents[i], u = tangents[(i + 1) % n], third = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
    const c1 = t ? [p[0] + t[0] * third, p[1] + t[1] * third] : p, c2 = u ? [q[0] - u[0] * third, q[1] - u[1] * third] : q;
    out += `C${mm(c1[0])} ${mm(c1[1])} ${mm(c2[0])} ${mm(c2[1])} ${mm(q[0])} ${mm(q[1])}`;
  }
  return `${out}Z`;
}

/** How far each pixel in the box is from its ground towards its ink, 0 to 1. The ground is the middle colour round the rim, and the ink the pixel least like it. */
function inked([bx, by, bw, bh]) {
  const at = (x, y) => (y * w + x) * 4, rim = [];
  for (let x = bx; x < bx + bw; x++) rim.push(at(x, by), at(x, by + bh - 1));
  for (let y = by; y < by + bh; y++) rim.push(at(bx, y), at(bx + bw - 1, y));
  const middle = c => rim.map(i => px[i + c]).sort((a, b) => a - b)[rim.length >> 1];
  const ground = [middle(0), middle(1), middle(2)];
  let ink = ground, far = 0;
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
    const i = at(x, y), d = Math.hypot(px[i] - ground[0], px[i + 1] - ground[1], px[i + 2] - ground[2]);
    if (d > far) [far, ink] = [d, [px[i], px[i + 1], px[i + 2]]];
  }
  const axis = [ink[0] - ground[0], ink[1] - ground[1], ink[2] - ground[2]], len = axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2 || 1;
  // A pixel out past the box counts as ground, so every outline closes.
  const field = new Float32Array((bw + 2) * (bh + 2));
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const i = at(bx + x, by + y);
    field[(y + 1) * (bw + 2) + x + 1] = Math.min(Math.max(((px[i] - ground[0]) * axis[0] + (px[i + 1] - ground[1]) * axis[1] + (px[i + 2] - ground[2]) * axis[2]) / len, 0), 1);
  }
  return { field, fw: bw + 2, fh: bh + 2, contrast: far };
}

/** Every outline where the field crosses a half, marching squares, as closed lines in the photo's pixels: outsides and holes alike. */
function outlines({ field, fw, fh }, [bx, by]) {
  const f = (x, y) => field[y * fw + x], half = 0.5, links = new Map();
  // A crossing on a cell's edge, named by the edge so neighbouring cells meet at it.
  const cross = (x0, y0, x1, y1) => {
    const a = f(x0, y0), b = f(x1, y1), t = (half - a) / (b - a);
    return { key: `${x0},${y0},${x1},${y1}`, at: [bx - 1 + x0 + (x1 - x0) * t, by - 1 + y0 + (y1 - y0) * t] };
  };
  const join = (p, q) => {
    for (const [a, b] of [[p, q], [q, p]]) {
      if (!links.has(a.key)) links.set(a.key, { at: a.at, to: [] });
      links.get(a.key).to.push(b.key);
    }
  };
  for (let y = 0; y < fh - 1; y++) for (let x = 0; x < fw - 1; x++) {
    const tl = f(x, y) > half, tr = f(x + 1, y) > half, br = f(x + 1, y + 1) > half, bl = f(x, y + 1) > half;
    const top = () => cross(x, y, x + 1, y), right = () => cross(x + 1, y, x + 1, y + 1), bottom = () => cross(x, y + 1, x + 1, y + 1), left = () => cross(x, y, x, y + 1);
    const n = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
    if (n === 0 || n === 15) continue;
    // Two opposite corners in: the middle says whether they join.
    const middle = (f(x, y) + f(x + 1, y) + f(x + 1, y + 1) + f(x, y + 1)) / 4 > half;
    if (n === 10) { if (middle) { join(top(), right()); join(bottom(), left()); } else { join(top(), left()); join(bottom(), right()); } continue; }
    if (n === 5) { if (middle) { join(top(), left()); join(bottom(), right()); } else { join(top(), right()); join(bottom(), left()); } continue; }
    const edges = [];
    if (tl !== tr) edges.push(top());
    if (tr !== br) edges.push(right());
    if (br !== bl) edges.push(bottom());
    if (bl !== tl) edges.push(left());
    join(edges[0], edges[1]);
  }
  const lines = [], seen = new Set();
  for (const [start, node] of links) {
    if (seen.has(start)) continue;
    const line = [node.at];
    seen.add(start);
    let prev = start, here = start;
    for (;;) {
      const next = links.get(here).to.find(k => k !== prev && !seen.has(k)) ?? links.get(here).to.find(k => k !== prev && k === start && line.length > 2);
      if (!next || next === start) break;
      seen.add(next);
      line.push(links.get(next).at);
      [prev, here] = [here, next];
    }
    if (line.length > 3) lines.push(line);
  }
  return lines;
}

const area = line => Math.abs(line.reduce((s, [x, y], i) => { const [u, v] = line[(i + 1) % line.length]; return s + x * v - u * y; }, 0)) / 2;

let scale = 1, tall = 1, ox = 0, oy = 0, centre = 0, within = null;
const found = [];
for (const s of shapes) {
  if (s.ink) {
    const [bx, by, bw, bh] = s.box;
    if (bx + bw > w || by + bh > h) stop(`${s.name}: the box ${s.box.join(',')} runs out of the photo, which is ${w}x${h}.`);
    const ink = inked(s.box);
    if (ink.contrast < 40) stop(`${s.name}: nothing in ${s.box.join(',')} stands out from its rim. Put the box round the mark, with plain ground at its edges.`);
    // Specks of a few pixels are grain or dust, not print.
    const lines = outlines(ink, s.box).filter(l => area(l) >= 4);
    if (!lines.length) stop(`${s.name}: nothing to trace in ${s.box.join(',')}.`);
    const all = lines.flat(), left = Math.min(...all.map(p => p[0])), right = Math.max(...all.map(p => p[0])), top = Math.min(...all.map(p => p[1])), bottom = Math.max(...all.map(p => p[1]));
    if (s === shapes[0]) {
      scale = wMm / (right - left);
      tall = hMm ? hMm / (bottom - top) : scale;
      ox = left;
      oy = top;
    }
    const [fx, fy] = s.part ? [left, top] : [ox, oy];
    const evened = lines.map(l => smooth(l, 0.6));
    const path = evened.map(l => curve(simplify(l, 0.25).map(([x, y]) => [(x - fx) * scale, (y - fy) * tall]))).join('');
    const size = [(left - ox) * scale, (top - oy) * tall, (right - left) * scale, (bottom - top) * tall].map(v => +v.toFixed(2)).join(', ');
    for (const line of evened) found.push({ name: s.name, seed: null, line });
    console.log(`// ${s.name}: box ${size}, ${lines.length} outlines, measured. Fill it with rule="evenodd".`);
    console.log(`const ${s.name.toUpperCase()} = '${path}';`);
    continue;
  }
  if (within && !within(s.y * w + s.x)) stop(`${s.name}: ${s.x},${s.y} is outside ${shapes[0].name}, the first shape, and nothing can leave that.`);
  const line = edge(s.around ? stands(flood(s, within)) : flood(s, within));
  if (!line.length) stop(`${s.name}: nothing to trace at ${s.x},${s.y}. The colours either side of it differ by more than the tolerance of ${s.tol}, so raise it or pick another point.`);
  const xs = line.map(p => p[0]), ys = line.map(p => p[1]), left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  if (right - left < 2 || bottom - top < 2) stop(`${s.name}: nothing to trace at ${s.x},${s.y}. It found ${right - left + 1}x${bottom - top + 1} pixels, so raise the tolerance or pick a point well inside the shape.`);
  if (s === shapes[0]) {
    scale = wMm / (right - left);
    tall = hMm ? hMm / (bottom - top) : scale;
    ox = left;
    oy = top;
    centre = (left + right) / 2;
    const rows = new Map();
    for (const [x, y] of line) rows.set(y, [Math.min(rows.get(y)?.[0] ?? x, x), Math.max(rows.get(y)?.[1] ?? x, x)]);
    within = i => {
      const r = rows.get((i / w) | 0), x = i % w;
      return r && x > r[0] + 3 && x < r[1] - 3;
    };
  }
  const even = smooth(s.mirror ? mirrored(line, centre) : line, 0.25 / scale);
  const [fx, fy] = s.part ? [left, top] : [ox, oy];
  const points = simplify(even, 0.1 / scale).map(([x, y]) => [(x - fx) * scale, (y - fy) * tall]);
  const size = [(left - ox) * scale, (top - oy) * tall, (right - left) * scale, (bottom - top) * tall].map(v => +v.toFixed(2)).join(', ');
  found.push({ name: s.name, seed: [s.x, s.y], line: even, path: curve(points), points: points.length });
  console.log(`// ${s.name}: box ${size}, ${points.length} points, measured`);
  console.log(`const ${s.name.toUpperCase()} = '${curve(points)}';`);
}

const check = await page.evaluate(async ({ src, found }) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.lineWidth = Math.max(c.width / 500, 1);
  found.forEach(({ line, seed }, i) => {
    x.strokeStyle = x.fillStyle = `hsl(${i * 67} 100% 50%)`;
    x.beginPath();
    line.forEach(([a, b], k) => (k ? x.lineTo(a, b) : x.moveTo(a, b)));
    x.closePath();
    x.stroke();
    if (!seed) return;
    x.beginPath();
    x.arc(seed[0], seed[1], x.lineWidth * 4, 0, 7);
    x.fill();
  });
  return c.toDataURL('image/png').split(',')[1];
}, { src: file, found });
privateDir('.look');
writeFileSync('.look/trace.png', Buffer.from(check, 'base64'));
await browser.close();
