# Sliders and sticks

Things you push along a track, and joysticks.

## `d-stick`

Something you lean or move in two directions at once. The value says which kind, as `d-stick="analog"`.

Forms: `analog`, `gimbal`, `hat`, `slide`, `paddle`, `pad`, `dpad`, `mouse`.

### `[d-stick=""]`

A joystick that returns to the middle when let go.

Import `device-ui/controls`. Write `<div d-stick>`.
Wraps: Two `<input type="range">`, across then up.
Use: Drag anywhere on it, and it springs back on release. Arrow keys move each input in turn, and a keyboard move stays where it is put.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the ball, or the thumbstick cap. | `plastic-red`, or `silicone-black` for `analog` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| d-stick | The form, then any option words. |  |

```html
<d-device material="anodised-oxide" radius="3" style="display:inline-flex;align-items:center;gap:22px;padding:18px">
  <div d-stick style="width:130px;height:130px"><input type="range" min="-1" max="1" step="0.01" value="0.3" aria-label="X"><input type="range" min="-1" max="1" step="0.01" value="-0.4" aria-label="Y"></div>
  <div d-stick="analog" style="width:96px;height:96px"><input type="range" min="-1" max="1" step="0.01" value="0.4" aria-label="X"><input type="range" min="-1" max="1" step="0.01" value="0.3" aria-label="Y"></div>
</d-device>
```

### `[d-stick~="analog"]`

A thumbstick: a hollow rubber cap on a short post, in a rounded well.

Import `device-ui/controls`. Write `<div d-stick="analog">`.
Wraps: Two `<input type="range">`, across then up.
Use: Drag anywhere on it, and it springs back on release. Arrow keys move each input in turn, and a keyboard move stays where it is put.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the cap. | `silicone-black` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| d-stick | The form, then any option words. |  |

```html
<d-device material="anodised-oxide" radius="3" style="display:inline-flex;align-items:center;gap:22px;padding:18px">
  <div d-stick="analog" style="width:96px;height:96px"><input type="range" min="-1" max="1" step="0.01" value="0.4" aria-label="X"><input type="range" min="-1" max="1" step="0.01" value="0.3" aria-label="Y"></div>
</d-device>
```

### `[d-stick~="gimbal"]`

A thin stem with a knurled head over an open gimbal, as on a radio transmitter.

Import `device-ui/controls`. Write `<div d-stick="gimbal">`.
Wraps: Two `<input type="range">`, across then up.
Use: Drag anywhere on it, and it springs back on release. Arrow keys move each input in turn, and a keyboard move stays where it is put.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the head. | `aluminium-pale` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| d-stick | The form, then any option words. |  |

```html
<d-device material="anodised-oxide" radius="3" style="display:inline-flex;align-items:center;gap:22px;padding:18px">
  <div d-stick="gimbal" style="width:130px;height:130px"><input type="range" min="-1" max="1" step="0.01" value="0.4" aria-label="X"><input type="range" min="-1" max="1" step="0.01" value="0.3" aria-label="Y"></div>
</d-device>
```

### `[d-stick~="hat"]`

A small five-way nub, pitted so a thumb stays on it. It leans half as far as a stick.

Import `device-ui/controls`. Write `<div d-stick="hat">`.
Wraps: Two `<input type="range">`, across then up.
Use: Drag anywhere on it, and it springs back on release. Arrow keys move each input in turn, and a keyboard move stays where it is put.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the nub. | `silicone-black` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| d-stick | The form, then any option words. |  |

```html
<d-device material="anodised-oxide" radius="3" style="display:inline-flex;align-items:center;gap:22px;padding:18px">
  <div d-stick="hat" style="width:76px;height:76px"><input type="range" min="-1" max="1" step="0.01" value="0.4" aria-label="X"><input type="range" min="-1" max="1" step="0.01" value="0.3" aria-label="Y"></div>
</d-device>
```

### `[d-stick~="slide"]`

A slide pad: a flat disc that slides across a shallow well instead of tilting, as on a handheld.

Import `device-ui/controls`. Write `<div d-stick="slide">`.
Wraps: Two `<input type="range">`, across then up.
Use: Drag anywhere on it, and it springs back on release. Arrow keys move each input in turn, and a keyboard move stays where it is put.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the disc. | `plastic-black` |
| height | How far the disc stands, in mm. | `1.6` |
| ring | A raised rim round the dish. | off |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| d-stick | The form, then any option words. |  |

```html
<d-device material="paint-silver" radius="3" style="display:inline-flex;align-items:center;gap:22px;padding:18px">
  <div d-stick="slide" ring style="width:76px;height:76px"><input type="range" min="-1" max="1" step="0.01" value="0.4" aria-label="X"><input type="range" min="-1" max="1" step="0.01" value="0.3" aria-label="Y"></div>
</d-device>
```

### `[d-stick~="paddle"]`

A short paddle in a long slot, sprung to the middle, for bending a note.

Import `device-ui/controls`. Write `<div d-stick="paddle">`.
Wraps: `<input type="range">`.
Use: Drag it along the slot, and it springs back on release. Arrow keys move it, and a keyboard move stays where it is put.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the paddle. | `plastic-black` |
| height | How far it stands, mm. | 11 |
| lean | How much of the slot it can reach, 0 to 1. | 0.8 |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| d-stick | The form, then any option words. |  |

```html
<d-device material="paint-panel-charcoal" radius="3" style="display:inline-flex;align-items:center;gap:22px;padding:18px">
  <div d-stick="paddle" style="width:180px;height:40px"><input type="range" min="-1" max="1" step="0.01" value="0" aria-label="Bender"></div>
</d-device>
```

### `[d-stick~="pad"]`

A flat pad you touch anywhere, which sets two values at once. A lit crosshair marks them.

Import `device-ui/controls`. Write `<div d-stick="pad">`.
Wraps: Two `<input type="range">`, across then up.
Use: Touch or drag anywhere: both values jump to the pointer. Tab reaches each input. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| color | The light. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `cyan` |
| grid | Number of divisions in the dot grid. | 8 |
| material | Material of the pad. | `glass-black` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| d-stick | The form, then any option words. |  |

```html
<d-device material="gloss-black" radius="5" style="display:inline-block;padding:16px">
  <div d-stick="pad" color="cyan" style="width:180px;height:180px">
    <input type="range" value="70" aria-label="Cutoff">
    <input type="range" value="30" aria-label="Resonance">
  </div>
</d-device>
```

### `[d-stick~="dpad"]`

A cross you rock with a thumb. Four real buttons sit on its arms. A word after `dpad` says how it is moulded: `disc` for a dished disc on a pivot, `cross` for one moulding with a dimple and ribbed arms, `ring` for a round moulding with raised arrows and a hole for a centre key, which is a part of its own, `flat` for a flat ring let into its face with a hub of its own, as on a music player with no wheel. With none it is a flat cross with arrows.

Import `device-ui/controls`. Write `<div d-stick="dpad">`.
Wraps: Four `<button>` elements, in the order up, left, right, down, and a fifth for one that also presses straight in, which sinks all of it.
Use: Press an arm. Tab reaches each button, and Space or Enter presses it. Arrow keys do nothing unless you add them.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the cross. | `plastic-black` |
| plain | Boolean. On a `disc`, a bare dished disc with no cross, as on a music player. On a `ring`, no raised arrows, for one with its marks printed on. On a `cross`, no dimple or ribs. | off |
| square | Boolean. On a `ring`, a rounded square, as round the five-way on an e-reader. | off |
| hub | On `flat`, how wide the hub is, mm. `center` is its material, `labels` the ring's legends clockwise from the top, `legend` how tall they stand, mm, and `ink` their colour. `mark` prints one on the hub, `mark-size` tall, mm, in `mark-ink`. | 60% across |
| height | Mm it stands up. | 2.6 on a `cross`, 1.6 on a `ring`, 1.2 on a plain `disc` |
| gap | Mm between the cross and the box, on each side. | 0.3 |
| labels | Glyphs printed round it, up, right, down and left, comma separated. | none |
| legend | How tall those glyphs stand, mm. | in scale with it |
| ink | The colour of those glyphs. | the material's legend |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-stick | The form, then any option words. |  |
| center |  | `plastic-black` |
| mark |  |  |
| mark-size |  | 2 |
| mark-ink |  |  |
| round | Boolean. | off |
| arm |  | 8 |
| smooth | Boolean. | off |
| bevel | How wide its edge rolls over, in mm. | 0 or 0.875 |

```html
<d-device material="soft-touch-grey" radius="4" style="display:inline-block;padding:16px">
  <div d-stick="dpad" style="width:130px;height:130px">
    <button aria-label="Up"></button>
    <button aria-label="Left"></button>
    <button aria-label="Right"></button>
    <button aria-label="Down"></button>
  </div>
</d-device>
```

### `[d-stick~="mouse"]`

A corded three-key mouse that rolls about its box under the hand. The body fills only part of the box, so the box is its mat. From `device-ui/computer`.

Import `device-ui/computer`. Write `<div d-stick="mouse">`.
Wraps: Two range inputs, across then down, 0 to 1, then three buttons, one for each key..
Use: Drag the body. Press its keys.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the body. | `shell-cream` |
| key-material | Material of the keys. | `keycap-grey` |
| size | The body, mm wide then long. | 60 88 |
| cord | The point the wire runs off to, mm from the corner of the box. Without it, no wire. | none |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-stick | The form, then any option words. |  |

```html
<d-device material="felt-grey" radius="3.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-stick="mouse" size="30 44" cord="100 0" style="width:200px;height:220px"><input type="range" min="0" max="1" step="0.01" value="0.4" aria-label="Across"><input type="range" min="0" max="1" step="0.01" value="0.6" aria-label="Down"><button aria-label="Left key"></button><button aria-label="Middle key"></button><button aria-label="Right key"></button></div>
</d-device>
```
