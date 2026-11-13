# Keys

Things you press. They are real buttons, so focus, click and forms all work as usual.

## `d-key`

Something you press and it comes back. The value says which kind, as `d-key="chiclet"`.

Forms: `arcade`, `flush`, `tact`, `mushroom`, `type`, `piano`, `membrane`, `tab`, `chiclet`, `mech`, `face`, `pill`, `mat`, `etched`, `side`, `sculpt`, `soft`, `sensor`, `slab`, `tile`, `drum`, `edge`, `plunger`, `touch`, `step`, `switch`, `scissor`, `screen`, `ring`, `bumper`, `guide`, `lamp`, `pusher`.

### `[d-key=""]`

A square keycap in a well. The text inside is the legend.

Import `device-ui/controls`. Write `<button d-key>`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the cap. | `keycap` on the device, then `keycap-grey` |
| keycap (on the device) | Cap material for every key that does not name its own. | `keycap-grey` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="anodised-graphite" keycap="keycap-grey" radius="3" style="display:inline-grid;grid-template-columns:repeat(3,66px);grid-auto-rows:50px;gap:8px;padding:18px;font-size:15px">
  <button d-key>A</button>
  <button d-key material="keycap-red">Clr</button>
  <button d-key material="keycap-ivory">Call</button>
</d-device>
```

### `[d-key~="arcade"]`

A big round button in a collar. It lights with `on`, and at 60% while held.

Import `device-ui/controls`. Write `<button d-key="arcade">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the plunger. | `plastic-red` |
| collar | Material of the ring around it. | same as the plunger |
| crown | How far the cap swells, in mm, for a palm instead of a finger. Without it the cap is dished. | 0 |
| on | Lights it. Boolean. | off |
| color | Lamp colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `red` |
| gain | How bright the lamp burns. Change it over time to make it breathe. | 1 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="lacquer-black" radius="3.5" style="display:inline-flex;align-items:center;gap:18px;padding:20px">
  <button d-key="arcade" material="plastic-red" aria-label="Fire" style="width:70px;height:70px"></button>
  <button d-key="arcade" material="plastic-yellow" collar="chrome" color="amber" on aria-label="Coin" style="width:70px;height:70px"></button>
</d-device>
```

### `[d-key~="flush"]`

A flush round button in a metal collar, as on a lift panel. `on` lights the cap and legend.

Import `device-ui/controls`. Write `<button d-key="flush">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the cap. | `plastic-black` |
| on | Lights the cap and legend. Boolean. | off |
| color | Lamp colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `amber` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| aria-pressed |  |  |
| gain |  | 1 |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="brushed-steel" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:18px">
  <button d-key="flush" style="width:64px;height:64px">Rec</button>
  <button d-key="flush" on color="red" style="width:64px;height:64px">Play</button>
</d-device>
```

### `[d-key~="tact"]`

A tactile switch on a board: a square body under a steel cover, and the stem that clicks a dome a quarter of a millimetre down. 6mm and 12mm are the common sizes.

Import `device-ui/controls`. Write `<button d-key="tact">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| cap | Snaps a cap over the stem: `round` or `square`. | bare stem |
| material | Material of the stem or cap. | `plastic-black` |
| height | How far the stem stands over the cover, mm. | 1.5, or 1.8 on a 12mm switch |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="pcb-green" radius="1" style="display:inline-flex;align-items:center;gap:12px;padding:14px">
  <button d-key="tact" aria-label="Reset" style="width:48px;height:48px"></button>
  <button d-key="tact" cap="round" material="plastic-red" aria-label="Boot" style="width:48px;height:48px"></button>
  <button d-key="tact" aria-label="Mode" style="width:24px;height:24px"></button>
</d-device>
```

### `[d-key~="mushroom"]`

An emergency stop: a red mushroom head on a yellow plate. Struck, it locks down, and stays down until it is let out.

Import `device-ui/controls`. Write `<label d-key="mushroom"><input type="checkbox">`.
Wraps: A checkbox, whose checked state is the lock. Or `aria-pressed` on a `<button>`..
Use: Change on the checkbox, or click on the button.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the head. | `plastic-red` |
| plate | Material of the plate under it. | `plastic-yellow` |
| grip | `ribbed` ribs the head's rim. `smooth` leaves it plain. | smooth |
| aria-pressed | On a button, `true` holds it locked down. | not set |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-key | The form, then any option words. |  |

```html
<d-device material="powder-coat" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:20px">
  <label d-key="mushroom" style="width:160px;height:160px"><input type="checkbox" aria-label="Emergency stop"></label>
  <label d-key="mushroom" grip="ribbed" style="width:160px;height:160px"><input type="checkbox" checked aria-label="Emergency stop"></label>
</d-device>
```

### `[d-key~="type"]`

A typewriter key: a disc under glass in a metal ring, on a long throw. From the `office` pack.

Import `device-ui/office`. Write `<button d-key="type">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the disc. | `lacquer-black` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="enamel-cream" radius="3" style="display:inline-flex;align-items:center;gap:12px;padding:18px;font-size:18px">
  <button d-key="type" style="width:48px;height:48px">Q</button>
  <button d-key="type" material="keycap-ivory" style="width:48px;height:48px">W</button>
</d-device>
```

### `[d-key~="piano"]`

A piano key with no legend. Heights are set so a row of them nests, with sharps above the white keys. From the `synth` pack.

Import `device-ui/synth`. Write `<button d-key="piano">`.
Wraps: Nothing. Put the attribute on a `<button>`, with an `aria-label`..
Use: Native button: Tab to focus, Space or Enter to press. Pull each sharp over its neighbours with a negative margin, as below.

| Attribute | Does | Default |
| --- | --- | --- |
| d-key | `piano black` makes a sharp. Anything after `piano` but `black` is a white key. | white key |
| keycap (on the device) | Cap for white keys that don't name their own. Sharps stay `lacquer-black`. | `keycap-ivory` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| material | What it's made of, a name from the materials list. | `keycap-ivory` |

```html
<d-device material="lacquer-black" radius="2.5" style="display:inline-block;padding:14px">
  <div style="display:flex">
    <button d-key="piano" aria-label="C" style="width:36px;height:130px"></button>
    <button d-key="piano black" aria-label="C sharp" style="width:22px;height:82px;margin:0 -11px;z-index:1"></button>
    <button d-key="piano" aria-label="D" style="width:36px;height:130px"></button>
    <button d-key="piano black" aria-label="D sharp" style="width:22px;height:82px;margin:0 -11px;z-index:1"></button>
    <button d-key="piano" aria-label="E" style="width:36px;height:130px"></button>
  </div>
</d-device>
```

### `[d-key~="membrane"]`

A printed patch on a sheet of film, over a snap dome. There is no gap and no key, so all that moves is the film, which dips under a finger and stays pillowed a little over the dome at rest.

Import `device-ui/controls`. Write `<button d-key="membrane">`.
Wraps: Its text is the legend. Children are printed on it..

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the film. | `film-white` |
| height | How far it pillows up, in mm. | .3 |
| travel | How far the film dips, mm. | 0.7 |
| path, viewbox | The patch's edge as an SVG path, and the box it's drawn in, for one that isn't a box. | none |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| round | Boolean. | off |
| radius | Corner radius, in mm. | `0.5` |
| icon | An icon name, printed on it. |  |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="soft-touch-black" radius="3" style="display:inline-flex;align-items:center;gap:10px;padding:16px">
  <button d-key="membrane" style="width:72px;height:44px;font-size:14px;color:#ddd">Stop</button>
  <button d-key="membrane" style="width:72px;height:44px;font-size:14px;color:#ddd">Start</button>
</d-device>
```

### `[d-key~="tab"]`

A latching bar, one of a row. It stays down while its input is checked, or, on a link or a button, while that says so. `d-key="tab lit"` lights through the cap while it's down, with a black legend, so it shows which is in with the room dark or not.

Import `device-ui/controls`. Write `<label d-key="tab">`.
Wraps: `<input type="radio">` or `<input type="checkbox">`, inside a `<label>`, or nothing on an `<a>` or `<button>`. Its text is the legend..
Use: Click to latch. Radios: Tab into the group, arrow keys to move. Checkboxes: Space.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the bar. | `keycap` on the device, then `keycap-black` |
| color | Lights the bar and its legend while latched. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | unlit |
| gain | How much brighter its legend and light are. | 1 |
| gap | How much of the well shows round the cap, mm. | 0.5, or 0.3 when lit |
| height | How far the bar stands, in mm. | 2.4 |
| travel | How far it goes in, in mm. | `height` and 0.2 more |
| aria-current | On a link: holds it down, as a radio bank holds its station. | not set |
| aria-pressed | On a button: `true` holds it down. | not set |
| backlight (on the device) | Lights every legend from behind, brighter while latched. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | unlit |
| keycap (on the device) | Bar material for every tab that does not name its own. | `keycap-black` |
| name, checked | On the `<input>`. Radios with the same name form a group. | unchecked |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-key | The form, then any option words. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| fit | Boolean. | off |

```html
<d-device material="brushed-steel" radius="2.5" style="display:inline-flex;align-items:center;gap:2px;padding:14px">
  <label d-key="tab" style="width:56px;height:44px;line-height:44px"><input type="radio" name="band" checked>FM</label>
  <label d-key="tab" style="width:56px;height:44px;line-height:44px"><input type="radio" name="band">AM</label>
  <label d-key="tab" material="keycap-ivory" style="width:56px;height:44px;line-height:44px"><input type="radio" name="band">SW</label>
</d-device>
```

### `[d-key~="chiclet"]`

A laptop key: low and square. With a backlight, the legend and the gap around the cap glow.

Import `device-ui/controls`. Write `<button d-key="chiclet">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the cap. | `keycap` on the device, then `soft-touch-black` |
| gain | Backlight strength. | `1` |
| on | Boolean. Lights a pin in the corner of the cap, as on a caps lock key. | off |
| color | Backlight colour for this key. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `backlight` on the device |
| keycap (on the device) | Cap material for every key that does not name its own. | `soft-touch-black` |
| backlight (on the device) | Backlight colour for every key. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. Without it or `color`, the key is unlit. | unlit |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="aluminium-space" keycap="soft-touch-black" backlight="white" radius="3.5" style="display:inline-flex;align-items:center;gap:6px;padding:16px;font-size:14px">
  <button d-key="chiclet" style="width:58px;height:54px">A</button>
  <button d-key="chiclet" style="width:58px;height:54px">S</button>
  <button d-key="chiclet" style="width:100px;height:54px">Shift</button>
</d-device>
```

### `[d-key~="mech"]`

A mechanical keycap: tall and sculpted, on a long travel, lit from the switch below.

Import `device-ui/controls`. Write `<button d-key="mech">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the cap. | `keycap` on the device, then `keycap-black` |
| color | Switch light for this key. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `backlight` on the device |
| keycap (on the device) | Cap material for every key that does not name its own. | `keycap-black` |
| backlight (on the device) | Switch light for every key. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | unlit |
| profile | The family the cap is cut to, which sets its height, the size of its top and its dish: `cherry` low and cylindrical, `oem` a little taller, `sa` tall and spherical, `dsa` low and uniform, or `xda` uniform with a wide flat top. | `cherry` |
| dish | How the top is hollowed, over what the profile says: `cylindrical`, a trough across, `spherical`, a bowl, or `flat`. | the profile's |
| row | Sculpts it as that row of a board, 1 at the top to 4 at the bottom: the top leans and stands taller. 0 is unsculpted, and `dsa` and `xda` are the same on every row. | 0 |
| legend | How the legend is put on: `pad` printed on top, which wears, `twoshot` moulded through, `laser` darkened in, or `engraved` and filled. | `pad` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="aluminium-space" keycap="keycap-black" radius="3.5" style="display:inline-flex;align-items:center;gap:8px;padding:16px;font-size:15px">
  <button d-key="mech" material="keycap-grey" color="cyan" row="1" style="width:64px;height:64px">Q</button>
  <button d-key="mech" color="pink" profile="sa" legend="twoshot" style="width:64px;height:64px">W</button>
  <button d-key="mech" material="keycap-ivory" legend="engraved" style="width:64px;height:64px">E</button>
</d-device>
```

### `[d-key~="face"]`

A round domed gamepad button with its letter on top.

Import `device-ui/controls`. Write `<button d-key="face">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the button. | `gloss-black` |
| flat | Boolean. A moulded disc with a rolled edge, in place of the dome. | off |
| gap | Mm between the button and its hole. | 0.4 |
| plate | Colour of a disc printed under the letter. | none |
| ink | Colour of the letter or icon. | the legend colour of the cap |
| plate-size | Disc's radius as a share of the key's. | 0.6 |
| weight | Icon stroke weight. | 2 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| height | How far it stands, in mm. | 3.6 |
| color | A hex colour, or a colour name. | `amber` |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 1 |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="soft-touch-grey" radius="3.5" style="display:inline-flex;align-items:center;gap:12px;padding:18px;font-size:18px">
  <button d-key="face" material="gloss-black" style="width:54px;height:54px">A</button>
  <button d-key="face" material="gloss-white" style="width:54px;height:54px">B</button>
</d-device>
```

### `[d-key~="pill"]`

A rubber pill coming up through a slot in a shallow dish in the shell, as under Start and Select. From `device-ui/gamepad`.

Import `device-ui/gamepad`. Write `<button d-key="pill">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the pill. | `rubber` |
| rotate | Degrees. | 0 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-key | The form, then any option words. |  |

```html
<d-device material="shell-grey" radius="3.5" style="display:inline-flex;align-items:center;gap:26px;padding:26px">
  <button d-key="pill" material="rubber-grey" rotate="-27" aria-label="Select" style="width:40px;height:16px"></button>
  <button d-key="pill" material="rubber-grey" rotate="-27" aria-label="Start" style="width:40px;height:16px"></button>
</d-device>
```

### `[d-key~="mat"]`

A phone key: silicone standing up through a hole in the cover, which dips to meet it. From `device-ui/phone`.

Import `device-ui/phone`. Write `<button d-key="mat">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the key. | `rubber-silver` |
| num, sub | The big legend, and the small one under it. | none |
| flip | Boolean. Sets them from the right. | off |
| inline | Boolean. Sets them side by side. | off |
| path, viewbox | The key's edge as an SVG path, and its coordinates. | an oval filling the box, `0 0 100 100` |
| mark, markink | Any other legend, as a path in `viewbox`, and its colour. | none, the legend colour |
| rotate | Degrees. | 0 |
| height | Mm the key stands above the cover. | 1.1 |
| bevel | Width of the edge in mm. | 1.25 |
| on | Boolean. Turns on the light under the mat. | off |
| color | The light. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `lime` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| legend |  | 2 |
| d-key | The form, then any option words. |  |

```html
<d-device material="shell-navy" radius="3.5" style="display:inline-flex;align-items:center;gap:12px;padding:18px">
  <button d-key="mat" num="2" sub="abc" aria-label="2" style="width:62px;height:40px"></button>
  <button d-key="mat" num="3" sub="def" flip on aria-label="3" style="width:62px;height:40px"></button>
</d-device>
```

### `[d-key~="etched"]`

A key etched out of one sheet of metal: a groove round its edge, over a snap dome, so the sheet dips under a finger and nothing else moves. Lit, the light comes up through the groove and the legends. From `device-ui/phone`.

Import `device-ui/phone`. Write `<button d-key="etched">`.
Wraps: Nothing. Put the attribute on a `<button>`. It is a patch of the surface it sits on, so it takes that material..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| num, sub | The big legend, and the small one beside it. | none |
| path, viewbox | The groove as an SVG path, and its coordinates. | a rounded box filling the key |
| mark | Any other legend, as a path in `viewbox`. | none |
| on | Boolean. Turns on the light under the sheet. | off |
| color | The light. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `blue` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-key | The form, then any option words. |  |

```html
<d-device material="satin-chrome" radius="2.5" style="display:inline-flex;align-items:center;gap:6px;padding:14px">
  <button d-key="etched" num="2" sub="ABC" aria-label="2" style="width:54px;height:27px"></button>
  <button d-key="etched" num="3" sub="DEF" on aria-label="3" style="width:54px;height:27px"></button>
</d-device>
```

### `[d-key~="side"]`

A sliver of side rail coming out from behind the body, which hides the rest. Pressing it pushes it in. From `device-ui/phone`.

Import `device-ui/phone`. Write `<button d-key="side left">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| d-key | After `side`, the side it stands out of: `left`, `right` or `top`. | `right` |
| material | Material of the rail. | `titanium-black` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |

```html
<div style="padding:12px 20px"><d-device material="titanium-black" radius="4.5" style="position:relative;display:block;width:120px;height:120px">
  <button d-key="side left" aria-label="Volume" style="position:absolute;left:-2.6px;top:36px;width:8px;height:48px"></button>
  <button d-key="side right" aria-label="Side key" style="position:absolute;right:-2.6px;top:36px;width:8px;height:48px"></button>
</d-device></div>
```

### `[d-key~="sculpt"]`

A sculpted home-computer keycap, with a dished top set back on a skirt and a long front face carrying a second legend. From `device-ui/keyboard`.

Import `device-ui/keyboard`. Write `<button d-key="sculpt">`.
Wraps: A `<button>`. Its text is the legend on top.
Use: Pad the button to lift its label onto the top.

| Attribute | Does | Default |
| --- | --- | --- |
| material | The cap material. | the device's `keycap`, or `keycap-black` |
| front | The legend on the front face. | none |
| height | How far the top stands up, mm. | 4.6 |
| travel | How far it goes down, mm. | 2.4 |
| keycap (on the device) | Cap for keys that don't name their own. Read off the part, then what holds it. | `keycap-black` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="shell-biscuit" radius="3" style="display:inline-block;padding:24px">
  <button d-key="sculpt" material="keycap-umber" front="RED" style="padding-bottom:28px;font:600 14px Arial;color:transparent" style="width:76px;height:76px">3</button>
</d-device>
```

### `[d-key~="soft"]`

A capacitive key: a legend printed on the panel, dim at rest and lit while held. It does not latch by itself: set `on` from a script.

Import `device-ui/controls`. Write `<button d-key="soft">`.
Wraps: Nothing. Put the attribute on a `<button>`..
Use: Native button: Tab to focus, Space or Enter to press.

| Attribute | Does | Default |
| --- | --- | --- |
| on | Keeps it lit. Boolean. | off |
| color | Lamp colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `white` |
| ink | Prints the legend in this colour, so it reads with the lamp off. It stops showing as the lamp comes up. | none |
| groove | Moulds a groove this wide round it, in mm, which a round key follows. | none |
| gain | How hard the lamp is driven. Past about 0.2 a coloured lamp burns towards white. | 0.46 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="glass-black" radius="4" style="display:inline-flex;align-items:center;gap:8px;padding:16px;font-size:13px;letter-spacing:.1em">
  <button d-key="soft" color="white" style="width:90px;height:50px">Power</button>
  <button d-key="soft" on color="cyan" style="width:90px;height:50px">Fan</button>
  <button d-key="soft" on color="amber" style="width:90px;height:50px">Heat</button>
</d-device>
```

### `[d-key~="sensor"]`

A fingerprint pad. Hold it until the ring closes, and it fires a `hold` event that bubbles.

Import `device-ui/controls`. Write `<button d-key="sensor">`.
Wraps: Itself: a `<button>`.
Use: Hold the pointer down, or hold Space or Enter while focused, for 0.9 seconds. Let go early and the ring runs back.

| Attribute | Does | Default |
| --- | --- | --- |
| color | The light. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `white` |
| material | Material of the rim. | `titanium` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-key | The form, then any option words. |  |

```html
<d-device material="gloss-black" radius="5" style="display:inline-block;padding:18px">
  <button d-key="sensor" color="green" aria-label="Unlock" style="width:96px;height:96px"></button>
</d-device>
```

### `[d-key~="slab"]`

A flat key with square shoulders in a narrow gap, that goes down onto a hard stop.

Import `device-ui/controls`. Write `<button d-key="slab" material="keycap-grey">`.
Wraps: `button`.
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Its material. | `keycap-grey` |
| round | Boolean. A disc. | off |
| radius | Its corners in mm, one or four. | 0.5 |
| path, viewbox | The cap's edge as an SVG path, and the box it's drawn in, for a cap that isn't a box, as a calculator's barrel keys. | none |
| lamp | Sets a pin LED in it, this many mm from the top. `on` lights it, and `color` tints it. | none |
| collar | The material of a frame round it. `rim` is how wide, mm. | none |
| height, travel, gap, deep, bevel | How far it stands, how far it goes, the gap round it and how deep that goes, and its shoulder, all mm. | 2.6, 1.8, 0.2, 0.6, 0.6 |
| rim | Width of the `collar`, mm. | 1.2 |
| open | Sides with no gap: `left`, `right`, `top`, `bottom`. | none |
| dish | Depth of a shallow hollow in the top, mm. | 0 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| color | A hex colour, or a colour name. | `red` |
| on | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="anodised-graphite" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <button d-key="slab" material="plastic-scarlet" lamp="2.4" on aria-label="Step" style="width:44px;height:76px"></button>
  <button d-key="slab" material="plastic-yellow" collar="satin-steel" aria-label="Start" style="width:76px;height:76px"></button>
</d-device>
```

### `[d-key~="tile"]`

A square tile of a keybed with a soft boss moulded on it, on a rubber dome. From the `synth` pack.

Import `device-ui/synth`. Write `<button d-key="tile" material="plastic-white">`.
Wraps: `button`.
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Its material. | `plastic-white` |
| boss | `round`, `pill` or `none`. | `round` |
| cap | The material of the boss. | the tile |
| inlay | A disc of this material set into the boss. | none |
| at, size, gap | How far across the boss sits, 0 to 1, its radius in mm and the gap round the tile in mm. | 0.5, 5.6, 0.15 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="well" radius="1.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <button d-key="tile" aria-label="Key" style="width:62px;height:62px"></button>
  <button d-key="tile" inlay="plastic-black" aria-label="Key" style="width:62px;height:62px"></button>
  <button d-key="tile" boss="pill" aria-label="Key" style="width:62px;height:124px"></button>
</d-device>
```

### `[d-key~="drum"]`

A square rubber pad to play with a finger, standing out of a well. It gives under a hit. From the `synth` pack.

Import `device-ui/synth`. Write `<button d-key="drum">`.
Wraps: None. It is a `<button>`.
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Its rubber, by material name. | `rubber-grey` |
| height, travel | How tall it stands and how far it gives, in mm. | 3, 1.4 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-key | The form, then any option words. |  |

```html
<d-device material="paint-panel-slate" radius="1.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <button d-key="drum" aria-label="Pad" style="width:96px;height:96px"></button>
  <button d-key="drum" material="rubber-putty" aria-label="Pad" style="width:96px;height:96px"></button>
</d-device>
```

### `button[d-key~="edge"]`

A key standing out of the edge of a case, going in sideways, ribbed across its end. Put it before the body so the body covers what goes in. From the `audio` pack.

Import `device-ui/audio`. Write `<button d-key="edge right"></button>`.
Wraps: None.
Use: Press to push it in. Enter or Space too.

| Attribute | Does | Default |
| --- | --- | --- |
| d-key | After `edge`, `right` or `top`: which edge. | `right` |
| travel | How far in it goes, mm. | 70% of what stands out |
| ribs | How many ribs across its end. | one every 4px |
| material | Material of the key. | `satin-steel` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |

```html
<d-device material="aluminium-silver" radius="2" style="display:inline-block;padding:14px 40px">
  <button d-key="edge right" aria-label="Key" style="width:16px;height:60px"></button>
</d-device>
```

### `label[d-key~="edge"]`

The same key latching: it stays in while its checkbox is checked, as a tape key does. From the `audio` pack.

Import `device-ui/audio`. Write `<label d-key="edge right"><input type="checkbox"></label>`.
Wraps: input[type=checkbox].
Use: Press to latch it in, and again to let it out.

| Attribute | Does | Default |
| --- | --- | --- |
| d-key | After `edge`, `right` or `top`: which edge. | `right` |
| travel | How far in it goes, mm. | 70% of what stands out |
| ribs | How many ribs across its end. | one every 4px |
| material | Material of the key. | `satin-steel` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |

```html
<d-device material="aluminium-silver" radius="2" style="display:inline-block;padding:14px 40px">
  <label d-key="edge right" style="width:16px;height:60px"><input type="checkbox" aria-label="Key"></label>
</d-device>
```

### `[d-key~="plunger"]`

A shutter release seen from the side: a threaded button pressed straight down into a collar. From the `camera` pack.

Import `device-ui/camera`. Write `<button d-key="plunger" material="satin-chrome"></button>`.
Wraps: None.
Use: Native button: Tab to focus, Space or Enter to press. The cap moves while held.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Its material. | `satin-chrome` |
| travel | How far it goes down, mm. | 1.25 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-key | The form, then any option words. |  |

```html
<d-device material="satin-chrome" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <button d-key="plunger" material="satin-chrome" aria-label="Release" style="width:64px;height:22px"></button>
</d-device>
```

### `[d-key~="touch"]`

A capacitive key with a picture for a legend, printed in the glass and lit from behind. Nothing goes down on glass, so its press is the light coming up, and it still gives a tap.

Import `device-ui/audio`. Write `<div d-key="touch">`.

| Attribute | Does | Default |
| --- | --- | --- |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| color | A hex colour, or a colour name. | `white` |
| icon | An icon name, printed on it. |  |
| on | Boolean. | off |
| d-key | The form, then any option words. |  |

### `[d-key~="step"]`

A silicone key that glows from under the rubber. A checkbox inside makes it latch. `material` is its rubber and `height` how far it stands, mm, `radius` its corners, mm, and `gap` the mm to what holds it. With `through` the LED lights the whole of a pale key, and not a slit, and `level`, 0 to 1, dims it.

Import `device-ui/audio`. Write `<div d-key="step">`.

| Attribute | Does | Default |
| --- | --- | --- |
| level | 0 to 1. If set, sets the light directly in place of the checkbox or `on`. | not set |
| gap | Mm to what holds it. | 0.5 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| on | Boolean. | off |
| beat | Boolean. | off |
| color | A hex colour, or a colour name. | `amber` |
| height | How far it stands, in mm. | 3 |
| through | Boolean. | off |
| radius | Corner radius, in mm. | 2.25 |
| bevel | How wide its edge rolls over, in mm. | 1.75 |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| material | What it's made of, a name from the materials list. | `silicone-black` |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

### `[d-key~="switch"]`

A sculpted cap on a tall switch, whose LED follows the board's backlight and flares when it's hit. `profile` and `row` cut the cap as on `d-key="mech"`.

Import `device-ui/keyboard`. Write `<div d-key="switch">`.

| Attribute | Does | Default |
| --- | --- | --- |
| profile | The family the cap is cut to, as on `d-key="mech"`. | `oem` |
| row | Sculpts it as that row of a board, 1 at the top to 4. | 0 |
| keycap (on the device) | Cap for every switch key that doesn't name its own. Read off the part, then what holds it. | `keycap-black` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| material | What it's made of, a name from the materials list. | `keycap-black` |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

### `[d-key~="scissor"]`

A low key on a scissor, whose legend and edge light follow the board's backlight.

Import `device-ui/keyboard`. Write `<div d-key="scissor">`.

| Attribute | Does | Default |
| --- | --- | --- |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| on | Boolean. | off |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

### `[d-key~="screen"]`

A key with a screen under it: a small panel fixed in the board, and a clear cap over it that goes down when pressed while the panel stays. A `<canvas>` inside is the panel, one canvas pixel to one of its pixels: draw on it and call `present`. `panel` is the side of what shows in mm, `radius` the corner of the hole, `gap` how far the cap stands off the hole's wall, `height` how far the cap stands proud and `travel` how far it goes, all in mm.

Import `device-ui/keyboard`. Write `<div d-key="screen">`.

| Attribute | Does | Default |
| --- | --- | --- |
| gap | Mm the cap stands off the hole's wall. | 0.4 |
| panel | Side of what shows, mm. | 13 |
| travel | How far the cap goes, mm. | 1 |
| gain | Panel brightness. It dims 24% as the cap goes down. | 1 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| radius | Corner radius, in mm. | 3 |
| height | How far it stands, in mm. | 0.5 |
| d-key | The form, then any option words. |  |

### `[d-key~="ring"]`

A steel push button with a lit ring round its cap. `on` lights the ring.

Import `device-ui/appliance`. Write `<div d-key="ring">`.

| Attribute | Does | Default |
| --- | --- | --- |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| on | Boolean. | off |
| material | What it's made of, a name from the materials list. | `brushed-steel` |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

### `[d-key~="bumper"]`

A rocker on the shoulder, tucked under the edge of the shell. `d-key="bumper left"` or `"bumper right"`. Plain, it's a straight bar set at an angle. `moulded` follows the shoulder, drawn in millimetres.

Import `device-ui/gamepad`. Write `<div d-key="bumper">`.

| Attribute | Does | Default |
| --- | --- | --- |
| angle | Tilt of the plain bar, degrees, opposite each side. Not used with `moulded`. | 33 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-key | The form, then any option words. |  |
| moulded | Boolean. | off |
| radius | Corner radius, in mm. | 3.75 |
| bevel | How wide its edge rolls over, in mm. | 1.75 |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| material | What it's made of, a name from the materials list. | `soft-touch-black` |
| fit | Boolean. | off |

### `[d-key~="guide"]`

The button in the middle: smoked black, with `logo`, an SVG path on a 2 by 2 box round 0, lit from behind while it's on.

Import `device-ui/gamepad`. Write `<div d-key="guide">`.

| Attribute | Does | Default |
| --- | --- | --- |
| aria-pressed | `true` lights the logo. | not set |
| logo | SVG path, on a 2 by 2 box round 0 unless `viewbox` says. | none |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| viewbox | The box `path` is drawn in, as in SVG. | `-1 -1 2 2` |
| d-key | The form, then any option words. |  |

### `[d-key~="lamp"]`

A big translucent pad over a lamp, on a pivot, in any outline: `path` and `viewbox` fill the box. `on` or a press lights it from behind, brightest over the lamp at `lamp`, mm from the box's top left. `pivot` is the way to the hinged side, degrees clockwise from up, and the far side drops `travel` mm. Leave it off and the whole pad goes straight down. `height` is mm above what it's on. Without a `path` it's its box with `radius` mm corners, as an illuminated pushbutton is, and the text inside is its legend.

Import `device-ui/light`. Write `<div d-key="lamp">`.

| Attribute | Does | Default |
| --- | --- | --- |
| travel | Mm the far side drops, or the whole pad without `pivot`. | 1.6 |
| pivot | Way to the hinged side, degrees clockwise from up. Without it the pad goes straight down. | none |
| lamp | x y in mm from the box's top left. | middle of the box |
| gain | How bright the light is over the lamp. | 0.26 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| viewbox | The box `path` is drawn in, as in SVG. |  |
| color | A hex colour, or a colour name. | `white` |
| height | How far it stands, in mm. | 2 |
| path | An SVG path for its outline, in `viewbox` units. |  |
| radius | Corner radius, in mm. | 1.5 |
| bevel | How wide its edge rolls over, in mm. | 1.75 |
| icon | An icon name, printed on it. |  |
| icon-size | How big the icon is, in mm. | 0.5 |
| icon-solid | Boolean. | off |
| on | Boolean. | off |
| material | What it's made of, a name from the materials list. | `plastic-white` |
| d-key | The form, then any option words. |  |
| fit | Boolean. | off |

### `[d-key~="pusher"]`

A short round pusher in the side of the case, pointing along `rot` from its box's left edge and middle, or for a pin from the edge it leaves by. Set `size`, its width in mm, and `out`, how far it stands in mm, for a plain pin. Or a stem with a head on it, lying along `rot` through the middle of its box: `stem` and `head` are each `across long` in mm, `band` is `long colour` round the head's waist and `at` how far up the head it starts in mm, `flutes` how many are cut round the head, `travel` how far it goes in, in mm. `material` is what it's made of.

Import `device-ui/watch`. Write `<div d-key="pusher">`.

| Attribute | Does | Default |
| --- | --- | --- |
| rot | Direction it points, degrees. | 0 |
| size | Width in mm. Above 0 draws a plain pin. | 0 |
| out | How far the pin stands, mm. | 0 |
| stem, head | A stem with a head on it, each `across long` in mm, lying along `rot` through the middle of its box. | none |
| band | Round the head's waist, `long colour`. | none |
| at | How far up the head the band starts, mm. | in the middle |
| flutes | How many are cut round the head. | 0 |
| travel | How far it goes in, mm. | 1 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| material | What it's made of, a name from the materials list. | `chrome` |
| d-key | The form, then any option words. |  |

## `d-switch`

Something you throw from one position to another. The value says which kind, as `d-switch="toggle"`.

Forms: `seesaw`, `toggle`, `spring`, `throw`, `rocker`, `key`, `bar`, `flick`, `blade`.

### `[d-switch~="seesaw"]`

A moulded key on a pivot with two ends, each a real button. The end under the thumb dips. From `device-ui/phone`.

Import `device-ui/phone`. Write `<div d-switch="seesaw">`.
Wraps: Two `<button>` elements, placed by your own CSS, first the end that tips up.
Use: Press an end. Tab reaches each button, and Space or Enter presses it.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the key. | `rubber-silver` |
| path, viewbox, mark, markink, height, bevel, lit, color | As on `d-key="mat"`, with `lit` for its `on`. | as on `d-key="mat"` |
| dips | Where each end dips, as two x y pairs in `viewbox`. | `0 0 0 0` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-switch | The form, then any option words. |  |

```html
<d-device material="shell-navy" radius="3.5" style="display:inline-block;padding:18px">
  <div d-switch="seesaw" dips="50 20 50 80" style="position:relative;width:48px;height:88px">
    <button aria-label="Up" style="position:absolute;inset:0 0 50% 0"></button>
    <button aria-label="Down" style="position:absolute;inset:50% 0 0 0"></button>
  </div>
</d-device>
```

### `[d-switch~="toggle"]`

A chrome bat-handle toggle. Checked is up.

Import `device-ui/controls`. Write `<div d-switch="toggle">`.
Wraps: `<input type="checkbox">`.
Use: Click, or Tab to it and press Space.

| Attribute | Does | Default |
| --- | --- | --- |
| checked | On the `<input>`. | unchecked |
| nut | Through a threaded bush and hex nut, in place of a round collar. `nut="knurled"` is a knurled ring nut. | off |
| handle | `bat`, round and swelling to its end, or `paddle`, flat and wide. | bat |
| tip | Caps the handle in this material. | none |
| slot | Boolean. | off |
| d-switch | The form, then any option words. |  |

```html
<d-device material="enamel-cream" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:16px">
  <div d-switch="toggle" style="width:42px;height:70px"><input type="checkbox" aria-label="Power"></div>
  <div d-switch="toggle" style="width:42px;height:70px"><input type="checkbox" checked aria-label="Line"></div>
</d-device>
```

### `[d-switch~="spring"]`

A toggle sprung to its centre, with a momentary contact each way. Up reads 2, down reads 0, and it comes back to 1.

Import `device-ui/controls`. Write `<div d-switch="spring">`.
Wraps: `<input type="range" min="0" max="2" step="1" value="1">`.
Use: Press its top or bottom half. With the keyboard, hold an arrow key.

| Attribute | Does | Default |
| --- | --- | --- |
| nut | Through a threaded bush and hex nut, in place of a round collar. | off |
| tip |  | `chrome` |
| slot | Boolean. | off |
| handle |  |  |
| d-switch | The form, then any option words. |  |

```html
<d-device material="enamel-cream" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:16px">
  <div d-switch="spring" style="width:42px;height:70px"><input type="range" min="0" max="2" step="1" value="1" aria-label="Examine"></div>
  <div d-switch="spring" nut style="width:42px;height:70px"><input type="range" min="0" max="2" step="1" value="1" aria-label="Deposit"></div>
</d-device>
```

### `[d-switch~="throw"]`

A toggle that stays where it is thrown, with two positions or more. The highest value is at the top.

Import `device-ui/controls`. Write `<div d-switch="throw">`.
Wraps: `<input type="range" min="0" max="2" step="1">`.
Use: Press its top or bottom half, or drag it. Arrow keys step it.

| Attribute | Does | Default |
| --- | --- | --- |
| nut | Through a threaded bush and hex nut, in place of a round collar. | off |
| slot | Through a long black escutcheon. Give it a tall box. | off |
| tip | Caps the handle in this material. | none |
| handle |  |  |
| d-switch | The form, then any option words. |  |

```html
<d-device material="paint-panel-charcoal" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:16px">
  <div d-switch="throw" slot tip="plastic-white" style="width:32px;height:80px"><input type="range" min="0" max="2" step="1" value="2" aria-label="Mode"></div>
  <div d-switch="throw" style="width:42px;height:70px"><input type="range" min="0" max="1" step="1" value="0" aria-label="Trigger"></div>
</d-device>
```

### `[d-switch~="rocker"]`

A rocker in a frame, printed with I and O. `lit` puts a lamp in the on side.

Import `device-ui/controls`. Write `<div d-switch="rocker">`.
Wraps: `<input type="checkbox">`.
Use: Click, or Tab to it and press Space.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the frame and rocker. | `plastic-black` |
| lit | Boolean. Lights the on side when checked. | off |
| color | Lamp colour. Needs `lit`. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `red` |
| bare | Boolean. A plain paddle in a slot, with no frame and no marks. | off |
| round | Boolean. A round bezel, the rocker a disc split across its hinge, as on a power strip. | off |
| checked | On the `<input>`. | unchecked |
| blank | Boolean. | off |
| cap |  | `plastic-black` |
| flip | Boolean. | off |
| frame |  | 0.625 |
| glow |  | 0.05 |
| whole | Boolean. | off |
| d-switch | The form, then any option words. |  |

```html
<d-device material="enamel-cream" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:16px">
  <div d-switch="rocker" style="width:50px;height:80px"><input type="checkbox" aria-label="Mains"></div>
  <div d-switch="rocker" round style="width:80px;height:80px"><input type="checkbox" aria-label="Strip"></div>
  <div d-switch="rocker" lit color="red" material="plastic-red" style="width:50px;height:80px"><input type="checkbox" checked aria-label="Heat"></div>
</d-device>
```

### `[d-switch~="throw"][across]`

The same toggle on its side, thrown left and right, the highest value to the right. Give it a wide box.

Import `device-ui/controls`. Write `<div d-switch="throw" across>`.
Wraps: `<input type="range" min="0" max="1" step="1">`.
Use: Press its left or right half, or drag it. Arrow keys step it.

| Attribute | Does | Default |
| --- | --- | --- |
| nut | Through a threaded bush and hex nut, in place of a round collar. | off |
| slot | Through a long black escutcheon. | off |
| tip | Caps the handle in this material. | none |
| handle |  |  |
| d-switch | The form, then any option words. |  |
| across | Boolean. | off |

```html
<d-device material="paint-panel-charcoal" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:16px">
  <div d-switch="throw" across style="width:70px;height:42px"><input type="range" min="0" max="1" step="1" value="1" aria-label="Power"></div>
</d-device>
```

### `[d-switch~="rocker"][across]`

The same rocker on its side, tipping left and right.

Import `device-ui/controls`. Write `<div d-switch="rocker" across>`.
Wraps: `<input type="checkbox">`.
Use: Click, or Tab to it and press Space.

| Attribute | Does | Default |
| --- | --- | --- |
| checked | On the `<input>`. | unchecked |
| bare | Boolean. | off |
| blank | Boolean. | off |
| material | What it's made of, a name from the materials list. | `plastic-black` |
| cap |  | `plastic-black` |
| flip | Boolean. | off |
| color | A hex colour, or a colour name. | `red` |
| frame |  | 0.625 |
| round | Boolean. | off |
| lit | Boolean. | off |
| glow |  | 0.05 |
| whole | Boolean. | off |
| d-switch | The form, then any option words. |  |
| across | Boolean. | off |

```html
<d-device material="enamel-cream" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:16px">
  <div d-switch="rocker" across style="width:80px;height:50px"><input type="checkbox" aria-label="Mains"></div>
</d-device>
```

### `[d-switch~="key"]`

A barrel lock seen from the front, filling its box, with a key standing straight out of it, so all that shows of the key is the edge of its bow. Checked turns it a quarter turn clockwise.

Import `device-ui/controls`. Write `<div d-switch="key">`.
Wraps: `<input type="checkbox">`.
Use: Click, or Tab to it and press Space.

| Attribute | Does | Default |
| --- | --- | --- |
| labels | Two legends with a comma between them, outside the box: off, above, then on, to the right. | `OFF,ON` |
| material | The collar. | `brushed-steel` |
| core | The barrel. | `brass` |
| key | The key's material, or `none` for a lock with the key out, whose barrel still turns. | `brass` |
| height | How far the key stands, in mm. | 10 |
| checked | On the `<input>`. | unchecked |
| d-switch | The form, then any option words. |  |

```html
<d-device material="brushed-aluminium" radius="3" style="display:inline-block;padding:33px 52px 33px 33px">
  <div d-switch="key" labels="SAFE,ON" style="width:62px;height:62px"><input type="checkbox" aria-label="Arm"></div>
</d-device>
```

### `[d-switch~="bar"]`

A long bar on a pin, rocked in the plane of its face, that goes back to the middle when let go. From the `synth` pack.

Import `device-ui/synth`. Write `<div d-switch="bar" tabindex="0">`.
Wraps: None.
Use: Push either end. It stops at 4 degrees each way.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the bar. | `satin-steel` |
| pin | x and y of the pin, mm from the top left. | the middle |
| height | How far it stands, mm. | 2 |
| turn | Angle in radians, written by the hand, ±4 degrees at most. Goes to 0 on let go. | 0 |
| d-switch | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-switch="bar" tabindex="0" role="slider" aria-label="Lever" style="width:11px;height:120px"></div>
</d-device>
```

### `[d-switch~="flick"]`

A small lever on a round foot, thrown by a finger and sprung home. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-switch="flick" tabindex="0" role="slider"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the lever. | `satin-chrome` |
| inset | Material let into the blade. | `well` |
| rest, throw | Where it rests and how far it goes, in degrees. | 0, 16 |
| height | Height in mm. | 1.2 |
| turn | Angle in radians, written by the hand, between `-throw` and 0. Goes to 0 on let go or key up. | 0 |
| d-switch | The form, then any option words. |  |

```html
<d-device material="vulcanite-black" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <div d-switch="flick" tabindex="0" role="slider" aria-label="Lever" style="width:60px;height:120px"></div>
</d-device>
```

### `[d-switch~="blade"]`

A blade switch: a lever through a slot, clicking through each step of its input, with its pin out of sight under the panel. From the `guitar` pack.

Import `device-ui/guitar`. Write `<div d-switch="blade" pin="..."><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag the lever across, or use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| pin | Where it turns, x y in mm from its top left. | none |
| from, to | The ends of its swing, degrees from straight up round the pin. | -20, 20 |
| material | What it's made of, a name from the materials list. | `keycap-ivory` |
| height | How far it stands, in mm. | 9 |
| d-switch | The form, then any option words. |  |

```html
<d-device material="plastic-white" radius="2" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <div d-switch="blade" pin="20 60" style="width:160px;height:160px"><input type="range" min="0" max="4" step="1" value="2" aria-label="Pickup"></div>
</d-device>
```
