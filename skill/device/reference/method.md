# The method, in depth

Each step of [SKILL.md](../SKILL.md), with what the tools take and print. Run every tool from the folder that holds `node_modules`.

## 1. The model and its size

Name one model and year. Search the web for its dimensions ("<model> dimensions mm", a manual, a spec sheet, a teardown). Write them down with where they came from. If only one is known (say the width), the others come off the straight-on photo by ratio later and are `measured`.

Sources disagree when a thing was reissued, revised or sold in other versions: an original and its reissue can differ by millimetres and in details such as a sleeve, a bezel or the badge. Decide which one you're making, then keep its sizes and its photos together. `measure` prints the straightened photo's ratio; if it disagrees with the spec, the photo is of another version or a corner is wrong. Say in the report which version it is and why.

The id is the device's id and the page's name: lower case, letters, digits and dashes, as `walkman-wm2`.

## 2. Photos

```bash
npx device-ui ref walkman-wm2 "sony walkman wm-2 cassette player"
```

It searches for reviews, teardowns and close-ups, keeps up to 12 large originals in `reference/<id>/01.jpg ...`, and writes `reference/<id>/sheet.jpg` with each one's number. Searching again with other words adds to the folder. If it finds nothing, the search was blocked: save photos into `reference/<id>/` by hand.

Read the sheet, then open the 5 to 10 most useful photos at full size. For each, note what it shows: the face square-on, an angle that shows the section, the sides, the back, a close-up of print or a control.

## 3. The straight-on photo

The best one has the face filling the frame, the camera square to it (opposite edges parallel), even light, and the model you named. `npx device-ui ref <id> --front 04` copies photo 04 to `front.jpg`, which `look` puts on its sheet to judge by. A slight angle is fine for measuring once `measure` straightens it, but never draw that angle.

## 4. Say the form

Write this out before any markup. A flat drawing is usually a form nobody looked at.

- **Outline**: rectangle with corner radius, or a traced shape. Which corners differ.
- **Section**: how deep the body is (`height` on `d-device`), how its edge meets the face (`bevel`, `edge="rolled|round|chamfer|flat|dome"`), whether the ends roll round (`roll` on `d-device`: `rx ry ix iy fall`).
- **Steps**: each plate or panel that stands up from the body, each recess or well that sinks into it, and by how many mm. A `d-surface` with `height="1.2"` stands 1.2 mm; `height="-0.8"` sinks 0.8 mm. Nested surfaces stack on the one they're in.
- **What stands proud**: each key, knob, switch and lamp, and how far it stands (the part's `height`, in mm, over what it sits on).
- **Materials**: one per region, chosen from `../device-ui/reference/materials.md` by substance and finish first, then colour. Real objects are restrained: a body, a face, the controls, maybe one accent.
- **Parts**: every feature, and the part and form that is it. Grep the list:

```bash
grep -n "grille\|speaker" ../device-ui/reference/parts.md
grep -n '^### `\[d-opening' -A30 ../device-ui/reference/parts/hardware.md
```

The group files are long; read only the section for the part you're using. Each section names its attributes, what each does, and an example.

Common answers:

| On the thing | In the library |
| --- | --- |
| body, case | `d-device` (`path` for a shaped outline, `height` its depth) |
| face plate, panel, step, recess, well, bezel round a window | `d-surface` |
| button, key | `d-key`, by form: `chiclet`, `tact`, `membrane`, `pill`, `face`, `piano`, `type`, `mech`, `flush` ... |
| knob, dial, thumbwheel, jog | `d-knob` or `d-wheel` by form |
| slide switch, fader | `d-slider` |
| toggle, rocker | `d-switch` |
| LED, indicator | `d-lamp` |
| needle meter, VU | `d-meter` |
| digits, LCD readout | `d-readout` |
| screen | `d-screen` with a `canvas` |
| window, lens, clear cover | `d-glass` |
| speaker grille, vents | `d-opening` |
| screws, rivets, hinges | `d-fixing` |
| jacks, sockets, slots | `d-port` |
| any printed word, logo, scale | `d-mark="print <process>"` (`pad`, `silk`, `offset`, `etch`, `mould`, `foil`, `emboss`) |
| groove between two panels | `d-seam` |
| cassette, reel | `d-tape` |

## 5. Measure

```bash
npx device-ui measure reference/<id>/front.jpg 110x88
```

Without corners it writes `.look/measure-photo.png`, the photo with a pixel grid. The grid's numbers are the photo's own pixels, whatever size the picture shows at, so read them straight off. On `.look/measure.png` read mm off the grid's labelled lines, not the picture's pixels: the picture has a margin. Read off where the body's four straight edges would meet (for round corners, where the edges would meet if they were sharp), clockwise from top left, and run it again:

```bash
npx device-ui measure reference/<id>/front.jpg 110x88 --corners 212,140 1830,152 1822,1450 205,1441
```

`.look/measure.png` is now the face straightened onto its real size with a mm grid. Read each feature's centre and size off it; that's its `place`. More:

- `--zoom x,y,w,h` (mm): a closer look, with a 1 mm grid, or 0.1 mm on anything 6 mm or smaller. Writes its own file.
- `--list`: boxes what stands out and prints each one's `x y w h`. Good on dense print, noise on bodies.
- `--circle x,y x,y x,y`: fits a circle through points, for a dial's centre. `--polar cx,cy` adds rings and spokes round it.
- `--colour x,y`: the colour there, for print ink.
- `--outline x,y x,y ...`: a rough closed outline in mm, pulled onto the edge, printed as points ready for `spline`.

If the corners' ratio disagrees with the spec size by much, the photo is at an angle or a corner is wrong: it says so.

For a curved body, trace it on the straight-on photo instead:

```bash
npx device-ui trace reference/<id>/front.jpg 110x88 body=900,700
```

`body=x,y` is any point inside the shape, in the photo's pixels. The first shape sets the scale. It prints `const BODY = 'M...Z';` in mm and writes `.look/trace.png` to check by eye. Use it as `path="${BODY}" viewbox="0 0 ${W} ${H}"`. More shapes after the first are in the same mm; add `,part` to one to get it from its own corner. For lettering, a logo or a signature, give a box instead of a point: `name=x,y,w,h,ink` traces everything in the box that stands out from its rim, every letter and every counter, as one path in the same mm; the box wants plain ground all round its edge.

## 6. The page

```bash
npx device-ui new walkman-wm2 110 88
```

writes `devices/walkman-wm2.html`: the library as one script tag, a stage, and a script that builds the device from a mm block. Keep that shape. The mm block reads like this:

```js
const W = 110, H = 88, D = 29; // spec
const R = 3.5; // measured, corner radius
const FACE = [4, 6, 102, 54]; // measured, x y w h of the face plate
const KEY = [10.5, 7]; // measured, a transport key's w h
const KEY_PITCH = 15.2; // measured, centre to centre
const KEYS_Y = 75.5; // measured, centre
const SINK = 0.6; // guess, how far the cassette window sits in
```

## 7. Compose

The body is the `d-device`; what's on it goes inside, each placed in mm from its holder's top left with `place="x y w h"` (its centre). `place="corner x y w h"` goes by its top left. A part inside a `d-surface` is placed from that surface's top left.

```js
const html = `<d-device id="walkman-wm2" scale="fit 3" material="aluminium-silver" radius="${R}" height="${D}" bevel="1.5" shadow="5">
  <d-surface class="face" material="aluminium-silver" radius="2" height="0.6" bevel="0.4" place="corner ${FACE.join(' ')}">
    <d-surface class="well" material="black-oxide" radius="1" height="${-SINK}" place="51 27 70 38">
      <div d-glass="window" radius="1" place="35 19 66 34"></div>
    </d-surface>
    <div d-mark="print silk" class="brand" color="#1a1a1a" place="14 6 20 3">SONY</div>
  </d-surface>
  ${['stop', 'play', 'ff', 'rew'].map((k, i) => `<button d-key="slab" material="aluminium-silver" class="${k}" aria-label="${k}" place="${20 + i * KEY_PITCH} ${KEYS_Y} ${KEY.join(' ')}"></button>`).join('')}
</d-device>`;
```

That's an illustration of the idioms, not a Walkman: check each part's real attributes in its section before using it.

- **Print** is real text in `d-mark="print ..."`. Its letters take the page's font: set `font` in the css, with the size in px from the cap height you measured (a sans's capitals are about 0.7 of its size, so 2 mm capitals is `font-size: ${2 / 0.7 * MM}px`), and `line-height: 1`. The box is the measured box of the ink. `fit` spaces the letters to fill the box's width. If the words come out wider than their measured box, the font is too wide: the real one is condensed, or lighter, or custom lettering. Fonts are whatever the machine has, and the common ones are wide: Arial Narrow and Helvetica Neue still overrun most panel labels, and `font-stretch` does nothing to a family without condensed faces. For a condensed sans that's the same everywhere, install an open one and load it by `@font-face` from `node_modules`, as `npm i @fontsource/barlow-condensed` then `@import '../node_modules/@fontsource/barlow-condensed/500.css'` in the page's `<style>`; Oswald, Roboto Condensed and IBM Plex Sans Condensed come the same way. Pick the one whose capitals match the photo's in width at the same height. Never widen the box, and never hide the overrun with `white-space: nowrap`: `look` counts that too. Words that wrap onto two lines on the real thing are written with `<br>`. A logo or a signature is custom lettering: trace it with `ink` (below), and it's a `path` and `viewbox` on the print with `rule="evenodd"`; if the photo's too soft to trace, set it in the nearest font and report it.
- **The page is a module**, as `new` writes it, so its names are its own. Every pack is in the one script: tags from any part's section work without an import line.
- **An option that does nothing** with no warning is a gap: say which attribute on which form, in the report, rather than trying others until something shows.
- **Recesses hold what's in them.** A screen, window or readout that sits in a well goes inside the well's `d-surface`, placed from its top left, so it sits on the well's floor. Put on the body beside it, it stands on the face and `look` says the two run into each other.
- **Outlines with straight edges** are `polyline([[x, y, r], ...])` from `DeviceUI`: one point per corner in mm, clockwise, each with its own corner radius. Curved ones come from `trace`.
- **A round key** gets a square box, `place="x y d d"`. Some forms are round already (`arcade`, `flush`, `face`, `mushroom`, `tact cap="round"`); `slab` and `membrane` take `round` for a disc. Pick by section: a flat matte calculator key is `slab round`, not `face`, which is a glossy domed gamepad button.
- **Labels on a device** are set in small capitals by the library; write them normally.
- **Sizes**: the device needs a width and height in the css (`W * MM` px). Parts placed with `place` need nothing else.
- **Nothing outside the library.** No `<div>` with a background as a stand-in for a part; text outside a `d-mark` or a part isn't drawn.
- **Behaviour**: parts are real buttons and inputs. Listen to them in the page's script as on any page (`root.querySelector('.play').addEventListener('click', ...)`). Light a lamp with `toggleAttribute('on', true)`.

## 8. Look

```bash
npx device-ui look devices/<id>.html
```

It serves the folder, opens the page in Chromium with a GPU (or software GL, slower), and drives the device through every state in `window.look`, each from where the last left it. It writes:

- `.look/<id>.png`: every state with blue boxes where a click lands, the height view (lighter stands higher), close-ups, and `front.jpg`.
- `.look/<id>/<state>.png`: each state at full size.
- `.look/<id>.txt`: each part with its box in mm from the device's top left, how far it stands, what it sits on and what it runs into, then what each state changed.

Lines starting `!` are errors and fail the run: a control a click can't reach, print out of its box, a page error. Fix the cause: never move or resize something measured to quiet one. Lines starting `~` are warnings: read each one. A warning that a state "changed nothing" means the step didn't do anything visible.

In the `.txt`, `stands 1.6 (1.6 up)` is how far a part stands over what it sits on, then over the body's face, in mm: the first should be the `height` you gave it. A state's line says how many of the page's values changed (a key that springs back changes none) and how much of the picture changed, which the light moving with the pointer adds to. Each run takes half a minute or so: change several things between runs, and use `--crop` to judge a detail.

States are steps, as in the template:

```js
window.look = { 'walkman-wm2': {
  play: [{ on: '#walkman-wm2 .play', hold: true }],      // pressed and held for the picture
  volume: [{ on: '#walkman-wm2 .volume', to: 0.8 }],      // a control's value, 0 to 1
  dial: [{ on: '#walkman-wm2 .tune', turn: [0, 90] }],    // dragged round its centre, degrees clockwise from up
  slide: [{ on: '#walkman-wm2 .hold', at: [[0.2, 0.5], [0.8, 0.5]] }], // dragged through shares of its box
  dropped: [{ on: '#walkman-wm2', attr: { cracks: 0.8, seed: 3 } }], // attributes set, as no hand could: broken, worn
} };
```

A plain selector string is a click. Flags:

- `--crop x,y,w,h` (mm from the device's top left) or `--crop <selector>`: that piece in every state, `.look/<id>.crop.png`.
- `--try '<steps>'`: runs steps from rest instead of the page's states, to try something without editing.
- `--scene`: prints the `.txt` too.
- `--debug height`: draws every state as heights. Others: `albedo`, `normal`, `roughness`, `metal`.
- `--live`: stays open and looks again whenever the page is saved.

## 9. Compare and fix

Put the rest state beside the photo. Go in this order, since each one can hide the next:

1. **Proportions**: outline, where the big regions sit, how big the controls are against the body. Wrong here means a wrong measurement: measure again.
2. **Form**: what stands up and what sinks, edges, how far controls stand. The height view in the sheet shows this.
3. **Material**: substance and finish, then colour. A plastic that reads as metal is the wrong substance, not the wrong colour.
4. **Print**: every word there, at the measured size and place.

Fix the cause from a measurement, never by nudging until it looks right. Then look again.

## 10. Report

Give the user the page's path and how to see it (`npx device-ui serve`, then open `devices/<id>.html` under the address it prints), the sheet's path, the model and its spec size, which sizes are still `guess`, and what the library lacked. Never send or commit the photos.
