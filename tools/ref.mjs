// Real photos of a thing, kept private: `npx device-ui ref zippo "zippo lighter brushed chrome"`, or `pnpm ref` in the device-ui repository.
// Searches for reviews, teardowns and close-ups, keeps the largest originals, and writes one sheet to read at reference/<id>/sheet.jpg.
// The folder holds a `.gitignore` of `*`: the photos belong to whoever took them, so they never go into a repository or a build.
// `--into <dir>` puts them somewhere other than reference/.
// Searching again with other words adds to what's there and the sheet shows it all, so nothing it found is lost.
// front.jpg is the photo `look` shows beside the object. It starts as the largest one found: `ref <id> --front 03` makes it that one instead.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, cmd, privateDir } from './browser.mjs';

const argv = process.argv.slice(2), into = argv.indexOf('--into'), ROOT = into < 0 ? 'reference' : argv.splice(into, 2)[1];
const [id, query, pick] = argv;
const REF = cmd('ref');
if (!/^[a-z][a-z0-9-]*$/.test(id ?? '') || !query || (query === '--front' && !pick) || !ROOT) {
  console.log(`${REF} <id> "<what it is>", or ${REF} <id> --front <number on the sheet>. The id is lower case, as the device's.`);
  process.exit(1);
}
const dir = resolve(ROOT, id);
// Before anything is fetched, so a missing browser doesn't waste a search.
const browserType = await chromium();

if (query === '--front') {
  const file = existsSync(dir) && readdirSync(dir).find(f => f.startsWith(`${pick.padStart(2, '0')}.`));
  if (!file) {
    console.log(`No photo ${pick} in ${dir}.`);
    process.exit(1);
  }
  // Whatever it came as, since front.jpg is read as a jpeg.
  const browser = await browserType.launch(), page = await browser.newPage(), ext = file.split('.').pop();
  const jpeg = await page.evaluate(async src => {
    const im = new Image();
    im.src = src;
    await im.decode();
    const c = Object.assign(document.createElement('canvas'), { width: im.naturalWidth, height: im.naturalHeight });
    c.getContext('2d').drawImage(im, 0, 0);
    return c.toDataURL('image/jpeg', 0.95).split(',')[1];
  }, `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${readFileSync(resolve(dir, file)).toString('base64')}`);
  await browser.close();
  writeFileSync(resolve(dir, 'front.jpg'), Buffer.from(jpeg, 'base64'));
  console.log(`front.jpg is now ${file}.`);
  process.exit(0);
}

// Requests carry no one's details: the contact is a placeholder and stays one.
const KEEP = 12, SMALLEST = 1200, MOST = 15e6, EACH = 40, HEADERS = { 'User-Agent': 'Mozilla/5.0 (research@example.invalid)' };
// Real photos come from people handling the thing, so ask for that and not for product shots.
const ANGLES = ['review hands on photo', 'teardown', 'macro close up', 'real photo'];
// Watermarked, or thumbnails of something else.
const SKIP = /shutterstock|alamy|gettyimages|istockphoto|dreamstime|adobe|123rf|depositphotos|pinimg|freepik|vecteezy|bigstock/;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const search = async angle => {
  const q = encodeURIComponent(`${query} ${angle}`);
  const url = `https://www.bing.com/images/search?q=${q}&qft=+filterui:imagesize-large+filterui:photo-photo&form=HDRSC2`;
  const html = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) }).then(r => r.text()).catch(() => '');
  return [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)].map(m => m[1].replace(/&amp;/g, '&')).slice(0, EACH);
};

const fetchImage = async url => {
  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    const ext = TYPES[r.headers.get('content-type')?.split(';')[0] ?? ''];
    if (!r.ok || !ext) return null;
    const data = Buffer.from(await r.arrayBuffer());
    return data.length < MOST ? { url, ext, data } : null;
  } catch {
    return null;
  }
};

// What earlier searches kept, which this one adds to.
const SOURCES = resolve(dir, 'sources.txt');
const earlier = (existsSync(SOURCES) ? readFileSync(SOURCES, 'utf8').trim().split('\n') : []).map(line => {
  const [file, size, url] = line.split(' ');
  return { file, url, ext: file?.split('.').pop(), size: size?.split('x').map(Number) };
}).filter(s => s.url && existsSync(resolve(dir, s.file))).map(s => ({ ...s, data: readFileSync(resolve(dir, s.file)) }));

const found = [...new Set((await Promise.all(ANGLES.map(search))).flat())].filter(u => !SKIP.test(u));
if (!found.length) {
  console.log('Nothing found. Search may be blocking this, so save photos into the folder by hand.');
  process.exit(1);
}
const urls = found.filter(u => !earlier.some(s => s.url === u));
const got = [];
for (let i = 0; i < urls.length; i += 12) got.push(...await Promise.all(urls.slice(i, i + 12).map(fetchImage)));

const browser = await browserType.launch();
try {
  const page = await browser.newPage({ viewport: { width: 2000, height: 1500 } });

  const seen = [];
  for (const g of got.filter(Boolean)) {
    seen.push({ ...g, size: await page.evaluate(src => new Promise(done => {
      const im = new Image();
      im.onload = () => done([im.naturalWidth, im.naturalHeight]);
      im.onerror = () => done([0, 0]);
      im.src = src;
    }), `data:image/${g.ext};base64,${g.data.toString('base64')}`) });
  }

  // One from each site before a second from any, or a single review fills the sheet.
  const best = seen.filter(s => Math.max(...s.size) >= SMALLEST).sort((a, b) => b.size[0] * b.size[1] - a.size[0] * a.size[1]);
  const host = s => new URL(s.url).hostname.replace(/^www\./, '');
  const rank = new Map(), turn = s => { const n = rank.get(host(s)) ?? 0; rank.set(host(s), n + 1); return n; };
  const kept = best.map(s => [turn(s), s]).sort((a, b) => a[0] - b[0]).map(x => x[1]).slice(0, KEEP);

  const tally = `${urls.length} found, ${seen.length} fetched, ${best.length} large enough, ${kept.length} kept.`;
  // Nothing to put in its place, so the folder stays exactly as it was.
  if (!kept.length) {
    console.log(`${tally}\nNothing written. Search or the image hosts may be blocking this, so save photos into ${dir} by hand.`);
    process.exitCode = 1;
  } else {
    privateDir(ROOT);
    mkdirSync(dir, { recursive: true });
    const shown = [...earlier, ...kept.map((s, i) => {
      const file = `${String(earlier.length + i + 1).padStart(2, '0')}.${s.ext}`;
      writeFileSync(resolve(dir, file), s.data);
      return { ...s, file };
    })];
    writeFileSync(SOURCES, shown.map(s => `${s.file} ${s.size.join('x')} ${s.url}`).join('\n') + '\n');

    const front = resolve(dir, 'front.jpg'), first = shown.find(s => s.ext === 'jpg');
    const fresh = !existsSync(front) && first;
    if (fresh) copyFileSync(resolve(dir, first.file), front);

    const cells = shown.map(s => `<figure><img src="data:image/${s.ext};base64,${s.data.toString('base64')}"><figcaption>${s.file} ${s.size.join('x')} ${host(s)}</figcaption></figure>`).join('');
    await page.setContent(`<style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(4,1fr);align-content:start;gap:6px;font:15px sans-serif;color:#ddd}
figure{margin:0}img{width:100%;height:340px;object-fit:contain;background:#222;display:block}figcaption{padding:3px 6px;white-space:nowrap;overflow:hidden}</style>${cells}`);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
    await page.screenshot({ path: resolve(dir, 'sheet.jpg'), type: 'jpeg', quality: 85, fullPage: true });

    console.log(`${tally}\n${dir}/sheet.jpg`);
    console.log(fresh ? `front.jpg is ${first.file} for now. ${REF} ${id} --front <number> makes it the straight-on one.` : existsSync(front) ? 'front.jpg left as it was.' : 'No jpg kept, so no front.jpg. Save the straight-on photo there.');
    console.log(readFileSync(resolve(dir, 'sources.txt'), 'utf8').trimEnd());
  }
} finally {
  await browser.close();
}
