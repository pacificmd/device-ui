# Device UI

Real DOM controls, drawn as lit physical objects: a key is a `<button>`, a knob wraps `<input type="range">`, a display is a text input. Materials have real sizes in mm, CSS does the layout, and every surface on the page shares one set of lights.

<!-- TODO (owner): link to the docs site once it has a public URL. -->

## Install

```bash
npm install device-ui
```

## A first device

Import controls once. Then write markup.

```ts
import 'device-ui/controls';
```

```html
<d-device material="enamel-cream" keycap="keycap-black" radius="3.5" wear="0.12">
  <div d-readout="lcd" material="lcd-green"><input aria-label="Frequency" value="96.4 MHZ"></div>
  <button d-key>Tune</button>
  <div d-lamp color="green" on></div>
</d-device>
```

The button is a real `<button>` and the display is a real `<input>`. There is no setup call. CSS owns layout: a device is a block element and parts are its descendants. Most parts have no default size, so give each a width and height. 1 CSS pixel is 0.25 mm of the object.

```css
d-device { display: grid; grid-template-columns: 1fr auto; gap: 14px; padding: 18px; }
[d-readout~="lcd"] { height: 58px; }
[d-key] { width: 80px; height: 44px; }
```

## Paths

One package, a path for each thing. You only pay for what you import.

| Path | What it is |
| --- | --- |
| `device-ui` | Base: renderer, `<d-device>`, `<d-surface>`, shapes, joints and motion, `definePart`, `defineMaterial` |
| `device-ui/materials` | The material list and lamp colours |
| `device-ui/controls` | The first pack: keys, knobs, switches, sliders, touch controls, lamps, meters, displays, screens, glass, hardware |
| `device-ui/appliance`, `/audio`, `/brass`, `/camera`, `/cards`, `/clockwork`, `/computer`, `/gamepad`, `/guitar`, `/keyboard`, `/lab`, `/library`, `/light`, `/masonry`, `/office`, `/phone`, `/pocket`, `/screen`, `/sewing`, `/synth`, `/tool`, `/vault`, `/watch` | Packs: parts for one kind of object, each its own import. A pack may build on controls and never on another pack, so any page can mix them |
| `device-ui/print` | Print, etch, foil, emboss and stickers |
| `device-ui/sound` | Plays a clip for every contact, shaped by material |
| `device-ui/air` | Haze, smoke, steam, fire, dust and sparks over a page |
| `device-ui/hand` | The drawn hand that plays an object by itself |
| `device-ui/react` | React wrappers for the common parts. Needs React 19 |
| `device-ui/script` | Base, materials, controls and the add-ons in one file, as a global, for a script tag |
| `device-ui/script/all` | The same with every pack |
| `device-ui/parts.json` | The catalogue: every part, its forms and its attributes |

With no build step:

```html
<script src="node_modules/device-ui/dist/device-ui.global.js"></script>
<d-device material="brushed-steel" radius="3" style="width: 200px; padding: 16px">
  <button d-key style="width: 100%; height: 44px">Start</button>
</d-device>
```

## Browsers

It needs WebGL2. Without it, or with forced colours on, you get the plain elements, styled, and they still work. It is ES modules only, and needs a DOM: importing it in Node does nothing useful. Tested on Chromium and WebKit; Firefox is untested.

## Making a real thing

The package carries the tools this library's own objects are built with, for building a real device at its real size from photos:

```bash
npm i -D playwright && npx playwright install chromium
npx device-ui new walkman 110 88       # devices/walkman.html, a page with no build step
npx device-ui ref walkman "sony walkman wm-2"   # reference photos, kept out of git
npx device-ui measure reference/walkman/front.jpg 110x88   # the photo on a mm grid
npx device-ui look devices/walkman.html   # every state of it, as pictures and words
npx device-ui serve                      # to open it in a browser
```

The repository's `skill/device` is an agent skill that walks an agent through it: "make me a Walkman".
