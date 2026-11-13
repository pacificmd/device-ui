// Starts a device on a page of its own: `npx device-ui new walkman 110 88`, its size in mm, writes devices/walkman.html.
// `--into <dir>` puts it somewhere other than devices/. The page needs no build step: the library comes in as one script, from
// node_modules, and any static server shows it, as `npx device-ui look devices/walkman.html` does. Everything past this is composition.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { cmd } from './browser.mjs';

const argv = process.argv.slice(2), into = argv.indexOf('--into'), DIR = into < 0 ? 'devices' : argv.splice(into, 2)[1];
const [id, W, H] = argv;
if (!/^[a-z][a-z0-9-]*$/.test(id ?? '') || !(+W > 0) || !(+H > 0) || !DIR) {
  console.log(`${cmd('new')} <id> <width mm> <height mm> [--into dir]. The id is lower case: letters, digits and dashes.`);
  process.exit(1);
}
const file = resolve(DIR, `${id}.html`);
if (existsSync(file)) {
  console.log(`${relative(process.cwd(), file)} already exists.`);
  process.exit(1);
}

// The one-file build, from the nearest node_modules that has the library, as the page will find it.
let lib = null;
for (let at = dirname(file); !lib; at = dirname(at)) {
  if (existsSync(join(at, 'node_modules/device-ui/package.json'))) lib = join(at, 'node_modules/device-ui/dist/device-ui.all.global.js');
  else if (dirname(at) === at) break;
}
if (!lib) {
  console.log('No node_modules/device-ui above where the page goes. Install it first: npm i device-ui');
  process.exit(1);
}
const src = relative(dirname(file), lib).split('\\').join('/');

mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${id}</title>
<!-- The library with every pack, as the global DeviceUI. No build step. -->
<script src="${src}"></script>
<style>
  body { margin: 0; background: #d8d5ce; }
  /* The device shows as large as fits here, up to three times its real size, as a product photo would. */
  .stage { width: 100vw; height: 100vh; display: grid; place-items: center; }
</style>
<div class="stage"></div>
<!-- A module, so its names stay its own: a plain script's top-level names are the window's, and \`top\` or \`name\` would clash. -->
<script type="module">
// One device, from the real thing. Composition only: parts, sizes, materials and options from the library. Nothing here draws.
const { MM, polyline } = DeviceUI;

// All in mm, from the real thing. Mark each size spec, measured or guess. Repeats come from their pitch.
// place="x y w h" puts a thing's centre x, y from its holder's top left, at that size. place="corner x y w h" goes by its top left.
const W = ${+W}, H = ${+H}; // spec
const SHELL = 2; // guess
const BODY = polyline([[0, 0, 2], [W, 0, 2], [W, H, 2], [0, H, 2]]); // guess, a corner radius on each point

const html = \`<d-device id="${id}" scale="fit 3" material="plastic-black" path="\${BODY}" viewbox="0 0 \${W} \${H}" aria-label="${id}">
  <d-surface class="body" material="plastic-black" path="\${BODY}" viewbox="0 0 \${W} \${H}" height="\${SHELL}">
    <button d-key="chiclet" material="plastic-white" aria-label="Button" place="\${W / 2} \${H / 2} 8 5"></button>
  </d-surface>
</d-device>\`;

// Real size: 1 css px is 0.25mm, so a length in mm is n * MM px.
const css = \`#${id} { width: \${W * MM}px; height: \${H * MM}px; }
#${id} .body { position: absolute; inset: 0; }\`;

document.head.insertAdjacentHTML('beforeend', \`<style>\${css}</style>\`);
document.querySelector('.stage').innerHTML = html;
const root = document.getElementById('${id}');

// What it does, if anything: listen to the real elements inside it as on any page.

// What \`${cmd('look')}\` drives, by name, in order, each from where the last left it: a selector to click, { on, hold: true } to keep it
// pressed, { on, to: 0..1 } to set a control, { on, at: [[x, y], ...] } to drag through shares of its box, { on, turn: [from, to] } to turn it.
window.look = { '${id}': { pressed: [{ on: '#${id} [d-key]', hold: true }] } };
</script>
`);
const shown = relative(process.cwd(), file);
console.log(`${shown}\n${cmd('ref')} ${id} "<what it is>"\n${cmd('look')} ${shown}\n${cmd('serve')} to see it in a browser`);
