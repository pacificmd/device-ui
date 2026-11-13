---
name: panel
description: Build interfaces out of physical controls with Device UI (`device-ui`), a web component kit of real knobs, keys, switches, meters and displays rendered with light and material. Use when asked for a skeuomorphic, tactile, hardware-like or retro interface, or to use Device UI, device-ui, d-device or any d- tag.
---

# Device UI

HTML tags that render as physical hardware. A key is a real `<button>`, a knob wraps a real `<input type="range">`, and a gauge wraps a real `<meter>`, so forms, keyboard use, screen readers and ordinary event listeners all work. Light, shadow and material come from a WebGL2 renderer. You write markup and CSS. You never draw.

- [reference/parts.md](reference/parts.md): every part in one line, by group. Read it first, then open the group file for a part's attributes and an example.
- [reference/materials.md](reference/materials.md): every material name.

To build a real thing at its real size from photos, "make me a Walkman", use the [device](../device/SKILL.md) skill beside this one.

## Set up

```bash
npm install device-ui
```

```ts
import 'device-ui/controls';  // the first pack: keys, knobs, switches, sliders, meters, displays, screens, hardware
import 'device-ui/synth';     // another pack, only if you use its parts
```

It's one install with a path for each pack, and a page pays only for what it imports. Packs mix freely on one page. `device-ui` itself is base: the elements, joints and motion. Each part's entry says what to import. A `d-` tag no part answers to warns in the console, inside a device at once and loose on a page after about two seconds, and that usually means a pack wasn't imported. There is no setup call.

On a page with no build step, use a script tag. Both files draw whatever's on the page, with no setup, and expose everything as the global `DeviceUI`:

```html
<script src="node_modules/device-ui/dist/device-ui.global.js"></script>      <!-- base, materials, controls, print, sound: 338KB -->
<script src="node_modules/device-ui/dist/device-ui.all.global.js"></script>  <!-- all that and every pack: 431KB, 152KB gzipped -->
```

Use one or the other. Imports like `device-ui/watch` have no meaning on such a page, so a part from any pack but controls needs the second file. In the examples below, `import { setValue } from 'device-ui'` becomes `const { setValue } = DeviceUI`.

## The tree

A device is one physical object, and the parts on it sit inside it. A part with no device round it is a bare device of its own, so `<button d-key="tab">Save</button>` works anywhere on a page. `<d-set>` makes a group of loose parts one device with one canvas, for a row of keys that should share light and shadow. Reach for `d-device` when the thing is a machine. For an ordinary page, see below.

```html
<d-device material="anodised-graphite" radius="2" class="panel">
  <div d-knob class="gain"><input type="range" min="0" max="10" value="4" aria-label="Gain"></div>
  <div d-meter="gauge" class="level" label="Level"><meter min="0" max="100" value="62"></meter></div>
  <button d-key class="go">Start</button>
  <div d-lamp color="green" on class="power"></div>
</d-device>
```

```css
.panel { display: grid; grid-template-columns: repeat(3, auto); gap: 18px; padding: 20px; align-items: center; }
.gain { width: 72px; height: 72px; }
.level { width: 120px; height: 120px; }
.go { width: 88px; height: 44px; }
.power { width: 14px; height: 14px; }
```

## Rules

**Size everything.** Most parts have no default size, so give each a width and height. The device takes the size of its content, or set one. 1 css px is 0.25mm of the object, so a 44px key is 11mm, which is a real key. Think in real sizes: a 300px knob is a 75mm knob and it will look like a toy. The sizes in each part's example are good starting points.

**CSS owns layout.** Grid, flex, media queries and container queries all work. Don't put rules for parts inside a CSS `@layer`: the library's styles are unlayered and will win.

**Place things in mm.** `place="x y w h"` puts a thing's centre x, y from the top left of what holds it, in real mm, at that size; no `h` is square. `place="corner x y w h"` goes by its top left. It makes it `position: absolute`, and works on anything, part or not. For a stylesheet, `mm(n)` from `device-ui` gives the length.

**Attributes mean one thing.** A tag's own value says which kind of part it is, as in `d-mark="label flat"` or `d-key="piano black"`. `material` always says what it's made of. `height` is how far it stands, in mm. A wrong attribute does nothing, and on a local page the library warns in the console once for each form and name. Read the part's table first.

**A key is one part.** `d-key` alone is the plain keycap, and its value picks the form, as in `d-key="chiclet"`, `d-key="mech"` or `d-key="arcade"`. A value that names no form draws nothing and warns in the console.

**Materials come from the list.** Any part takes any material, and an unknown name warns in the console. Don't set colours with CSS: a part's colour is its material, or `color` where the table has one. Pick one body material and one or two for the controls. Real objects are restrained.

**A lit key is `on`.** `<button d-key="chiclet" color="green" on>` lights it, and `toggleAttribute('on', ...)` drives it. `d-key="tab"` latches and lights through its checkbox or radio instead, as in the bank below. `d-key="lamp"` is a big lit pad from `device-ui/light`, not the general answer.

**A knob's form is its body.** `d-knob="skirt"`, `"collet"`, `"cap"` and the rest say its section from the side. Everything else is an option on any form: `grip="knurled"`, `top="spun"`, `mark="dot"`, `material`, `height` in mm. Add `detents` to make it click. An encoder is `d-knob="cap" detents grip="knurled" top="spun"`.

**A position knob's range is its labels.** On `d-knob="pointer"`, set the input to `min="0"` and `max` one less than the number of labels, or the labels bunch up. `sweep` is the degrees either side of straight up. Plain `d-knob` is a value knob and takes `ticks`, not labels.

**Labels are print.** Text on a device goes in `<span d-mark="label flat">Gain</span>`, or as a button's text, which becomes its legend. Plain `d-mark="label"` is engraved rather than printed. A device sets labels in small capitals, so write them normally. Text elsewhere inside a device isn't drawn. Lay a label and its part out as you would anything else: a flex column works.

**A part must exist as hardware.** Something you couldn't buy as a physical component isn't a part. Lists, tables, long text, inputs and charts stay ordinary HTML outside the device, or go on a `d-screen`. The best interfaces use a few devices among normal page content: a send button, a volume strip, a status panel. Don't turn a whole page into a machine.

**Tall things cast shadows.** The light moves with the pointer, and a tall part's shadow falls across its neighbours. Leave room around big knobs, and print labels below a part rather than beside it. Keep parts a few mm inside the device's edge. A fader needs room at both ends for its cap.

## Driving parts

Read and write the native element, and listen to it as usual.

```ts
import { setValue } from 'device-ui';
import { present } from 'device-ui/controls';

button.addEventListener('click', start);
knobInput.addEventListener('input', () => gain(knobInput.valueAsNumber));

meter.value = 80;                 // a meter follows on its own
sevenSegment.textContent = '12:34';
lamp.toggleAttribute('on', true);

setValue(knobInput, 7);           // for any range input, and it fires `input`. `input.value = 7` alone won't move the part
toggle.checked = true;
toggle.dispatchEvent(new Event('change', { bubbles: true }));
```

Set `checked` the same way on anything that wraps a checkbox or radio, a `d-cover="guard"` included. A `d-cover="guard"` stops hands, not code: `button.click()` goes through a shut cover, so check it in your handler too.

A `d-readout="seven"` shows its unlit digits. Set `digits` to the most it will ever show, and no more.

A canvas on a `d-screen` shows nothing new by itself. Hold the `live` attribute on one you draw on freely, or call `present(screen)` after drawing now and then. `live` costs nothing until the picture changes, as long as the 2D context is taken once the canvas is in the screen. WebGL, or a context taken earlier, repaints every frame.

A touch screen is a `d-screen` you can write on. `onTouch(screen, { down, move, up })` from `device-ui/controls` reports a pen, finger or pointer in the canvas's own pixels, inside the frame and the `active` area, and holds a stroke at the edge if it runs off. Return `false` from `down` to let a press through. For any other flat area, `onPen(el, area, pen)` from `device-ui` does the same over the box `area()` gives.

## Patterns

A radio group as a bank of latching keys. The latched one stays in, and `color` lights it:

```html
<d-device material="anodised-graphite" radius="2" class="bank">
  <label d-key="tab" color="white" gain="4"><input type="radio" name="view" value="send" checked>Send</label>
  <label d-key="tab" color="white" gain="4"><input type="radio" name="view" value="reports">Reports</label>
</d-device>
```

When a bank has to come all the way out, as a tape deck's keys do, use checkboxes and give each key the same `bank="name"`: one going in lets the others out, and a key that doesn't latch in that bank, such as Stop, lets them all out. Each one let out fires its own `change`, so read what's in from all of them, not from the one that changed.

A keyboard's keys take the same `run="name"`, so a hand held down slides along them by mouse, pen or finger. Each new key goes down before the last comes up, and the key left fires `run` with `detail.to`, the key it went on to, or null off the end:

```js
keys.addEventListener('run', e => { if (e.detail.to) synth.press(e.detail.to.dataset.note); synth.release(e.target.dataset.note); });
```

A shutter or any two-stage button takes `stage="0.45"`, the share of its travel to its first step. Held, it stops there; letting go takes it the rest of the way and back up, and sliding off lets it up without going on. Listen for `stage`, whose `detail.stage` is 1 at the step, 2 all the way in and 0 out:

```js
shutter.addEventListener('stage', e => camera.shutter(e.detail.stage));
```

A key held for something takes `long="700"`, in ms: held that long it fires `long` once, and letting it go then isn't a click, so a tap and a hold on one key do different things. A key that goes on while it's held takes `repeat="170 55"`, the ms to the first repeat and then between them, and fires `repeat` each time:

```js
power.addEventListener('long', () => screen.toggleAttribute('lit'));
power.addEventListener('click', () => pilot.power());
left.addEventListener('repeat', () => game.move(-1));
```

A script plays a key as a hand would with `hold(key, true)` and `hold(key, false)` from `device-ui`: it goes in and comes out, latches, stages, repeats and says `long` just as under a finger, but doesn't click, so the page does what the key does itself. Use it to play the real keys from the computer's keyboard, so they move, rather than sending fake pointer events:

```js
addEventListener('keydown', e => { if (!e.repeat && keys[e.key]) { hold(keys[e.key], true); keys[e.key].click(); } });
addEventListener('keyup', e => keys[e.key] && hold(keys[e.key], false));
```

A body in two halves on a hinge, as a flip phone, a lid or a door, is `fold(body)`. The half that swings has two faces, each a `d-device` child placed where it lies flat: `fold="open"` with `pin` on its hinge edge, and `fold="shut"` across that edge. `folded` on the body shuts it. `open` sets where it comes to rest open, in degrees from shut, so a door that springs to its stop is `fold(door, { open: 100 })`, opened by its latch. A lid on stays rests on each with `to(deg)`. Whichever face is up is set at its `angle` about the pin, then drawn and lit there. Past 75° off the body it's held at 75°:

```js
const lid = fold(body, { open: 100 });
latch.addEventListener('click', () => lid.open());
```

A confirm that takes a real gesture. Lift the cover, then press:

```html
<d-device material="anodised-graphite" radius="2" class="launch">
  <div d-cover="guard"><input type="checkbox" aria-label="Arm"><button d-key="arcade" aria-label="Send">Send</button></div>
  <div d-lamp="annunciator" class="armed" color="amber">Armed</div>
</d-device>
```

An assembly is one tag with its pieces as forms, nested as the real thing is, each sized by your CSS. A watch, with the crown and a cover from controls:

```ts
import 'device-ui/controls';
import 'device-ui/watch';
```

```html
<d-device class="tray" material="walnut" radius="6.5">
  <div d-watch="cushion">
    <div d-watch="strap" class="up"></div>
    <div d-watch="strap" class="down" tail></div>
    <div d-watch="case">
      <div d-watch="bezel" opening="51.45" wall="2.275">
        <div d-watch="dial" skip="3 6 9" date="6"><div d-watch="hands"></div></div>
      </div>
      <div d-glass="cover"></div>
    </div>
  </div>
  <div d-wheel="crown">
    <input type="range" min="0" max="720" value="0" aria-label="Set the time">
    <input type="range" min="0" max="1" step="1" value="0" aria-label="Crown: in to wind, out to set the time">
  </div>
</d-device>
```

A crown turns its first input, dragged up or down, and pulls out to the positions of its second, dragged out or in. It comes out 1.2mm a position and the stem shows behind it. What each position does is up to the page: the site's watches add what turning it does to the hands' `offset` only while it's all the way out. Without the second input it only turns. A checkbox after the ranges makes it screw down, as a diver's does: `<input type="checkbox" checked aria-label="Crown screwed down">`. Ticked, it sits 0.7mm further in and won't pull out. Turning it back two turns unscrews it, and it springs out to winding. Pushing it in while turning it on screws it down again. From the keyboard, Space on the checkbox does either. The thread is base's `thread()` joint, which any part with a `turn` can ride, as a lid or a filter ring.

```css
.tray { width: 400px; height: 660px; }
.tray [d-watch], .tray [d-glass], .tray [d-wheel] { position: absolute; }
[d-watch~="cushion"] { left: 60px; top: 72px; width: 280px; height: 516px; }
[d-watch~="strap"] { left: 74px; width: 132px; height: 190px; }
[d-watch~="strap"].up { top: -42px; }
[d-watch~="strap"].down { top: 368px; }
[d-watch~="case"] { left: 0; top: 118px; width: 280px; height: 280px; }
[d-watch~="bezel"] { left: 12.6px; top: 12.6px; width: 254.8px; height: 254.8px; }
[d-watch~="dial"] { left: 24.5px; top: 24.5px; width: 205.8px; height: 205.8px; }
[d-watch~="hands"] { left: -9px; top: -9px; width: 224px; height: 224px; }
[d-glass~="cover"] { left: 28px; top: 28px; width: 224px; height: 224px; }
[d-wheel~="crown"] { left: 346px; top: 304px; width: 26px; height: 52px; }
```

A shelf is the other kind: nothing on it is laid out by hand. It takes its holder's width and wraps what stands in it, so give it no size and give each book a real one. Books are real size, 110 to 140 by 520 to 560px on the spine, so show the whole shelf smaller with `scale`:

```html
<div d-library="shelf wall" material="oak" scale="0.3">
  <a d-library="book spine" href="#" material="bookcloth-oxblood" style="width:140px;height:560px">Dracula</a>
  <a d-library="book spine" href="#" material="bookcloth-moss" style="width:110px;height:520px">Walden</a>
</div>
```

An app panel that fills its container and casts nothing outside it:

```html
<div class="sidebar"><d-device fill material="soft-touch-grey">...</d-device></div>
```

## An ordinary page

A part with no `d-device` round it is its own device, so an ordinary page can have one guarded button and nothing else. It fills the box you give it, so give it one in your CSS. Everything around it stays your own HTML and CSS. A part prints its legends in what reads on what's under it, and a loose part can't see the page, so on a pale page put it in `<d-set material="paper">`.

```html
<div d-cover="guard" style="display:grid;place-items:center;width:104px;height:104px">
  <input type="checkbox" aria-label="Lift the cover">
  <button d-key="arcade" style="width:68px;height:68px">Send</button>
</div>
```

## Scale

How a thing meets a narrow page is one attribute, on a `d-device` or a loose part. Choose by what it is:

- An object has one shape, so it shrinks whole: `scale="fit"`, or `scale="fit 2"` to show it up to twice its size.
- A thing you work in keeps its scale and rearranges with your CSS: `scale="0.3"`, or `scale="1"` to say it never shrinks. Give it a real phone layout.
- No `scale`: it stays its size and the library does nothing.

`scale="fit"` looks at the element it's in. A loose piece that changes size with the window goes in a holder sized by your CSS, and nothing else is needed. A device as wide as its holder never shrinks, so a `scale="fit"` device can set `width: 100%` in a phone media query and rearrange there.

```html
<d-device scale="fit" style="width:640px;height:400px">...</d-device>
<d-device scale="0.3" fill>...</d-device>
<div d-library="shelf wall" scale="0.3" material="oak">...</div>
```

Never write CSS `zoom` on a device or part: `scale` owns it. A page that frames what it shows calls `frame(el, view)` from `device-ui`. If your code has hand-set `zoom` or its own fit-to-width, see [CHANGES.md](CHANGES.md).

A page you zoom and pan, like a map or a closer look at one object, puts what it shows in one element and moves it with `camera(world)` from `device-ui`. `cam.set(scale, x, y)` shows the world at `scale`, with the window's corner at `x`, `y` in shown px. It's a transform, so nothing in the world is laid out or measured again however far it goes, and once the camera stops, what's on screen draws again at the size it's shown. Call it on every step of a gesture. Never zoom a world with CSS `zoom`, or with a transform the engine isn't told about.

A world of many things gives each its own box that holds its layout: a fixed size and `contain: size layout`, not itself an item of a grid or flex box (put it in a plain slot that is). Then a thing arriving or changing lays out and is read again only in its box. As a grid's own item, every change lays out the whole grid, so a page of thousands loads in quadratic time.

## Performance

A device at rest costs nothing. While anything on it moves, it repaints. Split a big interface into several small devices.

`lean="5"` on a `d-device` lets a drag on its body turn it up to that many degrees, 8 at most, so tall parts slide and show their sides. Hovering only moves the light. It stays turned until the pointer leaves. It's for objects with real height: give the body its true depth with `height`, a small `bevel`, and a `shadow` shorter than that so it doesn't throw a long one. Only the one under the hand pays for it: about twice a moving lamp while it's turned, nothing otherwise.

`angle="18 0"` on a `d-device` sets it in a room with depth: degrees about its upright, then across it, as `rotateY` and `rotateX` turn it. Put devices inside a `perspective` and place them with `translate` (a z is how much nearer the eye) and `transform-origin`, and leave `rotate` to the library. The lamp stays put in the room as it turns, and a device off to one side of the eye, turned or not, is seen from that side, so moving `perspective-origin` with the pointer is parallax the parts answer. It's laid out flat, so its parts' boxes stay true.

A body with two faces turns over. Put its back inside it as `<d-device reverse>`, drawn as seen from behind. A drag across the body turns it, and `turned` on the outer device says the back is up; set it to turn it in code. `fixed` keeps it on the face it's on: a drag only leans it, and `turned` still turns it. Each face draws its own half of the body, either side of the plane through the middle, so the sides come into view as it turns. What stands clear of the body with `back`, such as a dial on the top deck, is put on the front only: the back draws it too, from behind, where it reaches past the middle, and it stays one part with one value. A back nobody turns to is never drawn, so it costs nothing until a hand comes near.

Its ends turn to as well. Put each inside the body as `<d-device side="left">` or `side="right"`, drawn as seen from that side: its `path` and `viewbox` are the body's depth across and its length down, with its front edge toward the front, so the left one runs the other way. Its parts sit on it as on any face. A drag lands on whichever face is nearest square on, a quarter turn at a time, and `turned` says which: `left`, `right`, `back`, or bare for the back. On a side, front and back lie edge on behind it, so a lens or a dial that stands off them still shows in profile. Only declared faces are landed on.

Every turn goes the same way, on every object, from the engine: nothing on a page or in an object times it. At rest only the face that's up is drawn, with its own shadow and nothing beside it. Set off for another face, by a drag or by `turned`, it leans as far as a hand would take it while its shadow draws in under it, in 0.15 s, and the face it's going to is drawn meanwhile, waiting up to 0.6 s more if it needs it. Then it whips: what's up smears the way it's going and catches the light, sides it passes show at the corners, cut to the body's outline, and the next face rocks back to rest. Once it's back within the lean its shadow comes out again, in 0.2 s, and lies as if it had never turned. The lamp and the hand go on as before throughout. Turned back before it lands, it goes back the same way, from where it is. With reduced motion it's on the next face at once. While it turns the outer device has `data-turning`, and `data-up` names the face that shows.

Something that comes out of a body, such as a cartridge or a battery door, is a `d-device loose` directly inside it, set where it sits, with `seated` on the one that's in. Every piece that's out lies on the body's shelf, an outlined place beside it, and the body keeps room for the shelf with a right margin. `plug(things, { run, seat, axis })` from `device-ui` lets a hand pull one `run` mm along its rails and then free. It's loose only while it's held: let go near the way in with the seat empty and it slides home, and anywhere else it goes back to its place on the shelf. While it's on the rails, it's drawn in `seat` as part of the body, so it slides under whatever covers the way in, and turns and lights with the body. A `d-surface` with no `material` is made of the surface it sits on, so a piece's own ribs and recesses keep its colour in the seat. It fires a bubbling `plug` with `seated`.

Something that holds a piece in, as a Game Boy's power switch reaches into the cartridge, sets `aria-disabled="true"` on the piece: seated, a hand moves it a hair and no further, and out, it can't go in. A part that something holds still is a native `disabled` on its input or button.

A piece that comes off toward you, as a lens off a bayonet, takes `twist` in place of `run`: the degrees it turns to come free, signed the way it turns off, as `plug([lens], { twist: -45, seat: mount, release })`. It turns, and comes off, only while `release` is in, a button a click keeps in a few seconds and that says so with `aria-pressed`, or once it's already turned off its lock. Otherwise what's on it has the hand, so a lens's rings still turn while it's on. Dropped back on its seat, it sits turned until a hand turns it home. The seat can be on any face, and the piece takes the hand on that face only. `twist="deg"` on any `d-surface` or `d-device` turns its drawing and everything on it, prints included, clockwise about its middle. The page's boxes stay square.

A height field has one height to a pixel, so anything standing off a body would reach down to the page. `back="19"` on a part stands it clear: it's built round a plane 19mm behind the front, going as far behind that as it stands in front, so a strap lug is a thin plate and a dial on the top of a camera is a whole disc when you look down on it. It doesn't turn with a `roll`, so it also makes a flat block on a round end, such as a camera's finder, and what sits on it stays on it. A `roll` that falls at least half the body's depth makes the body round both ways, as a capsule. What can't be shown is two separate things along one line of sight, so a gap between a lever and the deck behind it closes up.

## Check your work

WebGL2 is required for the real picture. Without it, parts fall back to plain styled controls. In a headless browser, use a GPU flag, then take a screenshot and look at it. In Playwright on a Mac, that's `chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] })`. Wait a second or two after load, as drawing waits for packs and fonts. Check that every part has a size, labels are readable, nothing sits in a shadow, and the console has no warnings. `debug="height"` on a device shows how far everything stands.
