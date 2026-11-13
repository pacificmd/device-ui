# Switches

Things that flip between states, each with a native input underneath.

## `d-slider`

Something you push along a track. The value says which kind, as `d-slider="fader"`.

Forms: `edge`, `nub`, `fader`, `lever`, `strip`, `pull`, `handle`, `wing`, `trigger`.

### `[d-slider~="edge"]`

A ribbed nub coming out of the top edge of a case, which closes over the rest of it. The box is the slot it runs in, so it can reach down over a legend and still be clicked. Put the case edge `out` mm below the top of the box. From `device-ui/gamepad`.

Import `device-ui/gamepad`. Write `<div d-slider="edge">`.
Wraps: An `<input type="checkbox">`.
Use: Click or drag it. Space flips it.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the nub. | what it sits on |
| out | Mm it stands out of the edge. | 1 |
| d-slider | The form, then any option words. |  |

```html
<div style="padding:12px 20px"><d-device material="shell-grey" path="M0 4 H200 V70 H0 Z" viewbox="0 0 200 70" style="width:200px;height:70px"><div d-slider="edge" out="1" style="position:absolute;left:40px;top:0;width:48px;height:36px"><input type="checkbox" aria-label="Power"></div></d-device></div>
```

### `[d-slider~="nub"]`

A ribbed nub in a slot. A checkbox gives two positions and a range gives three or more. It runs along the longer side of its box.

Import `device-ui/controls`. Write `<div d-slider="nub">`.
Wraps: `<input type="checkbox">` or `<input type="range">`.
Use: Checkbox: click, or Space. Range: click along the slot to jump there, or use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the nub. | `plastic-black` |
| lit | A lamp behind the slot, which fills as the nub slides over. | off |
| checked | On a checkbox `<input>`. | unchecked |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| nub | How much of the slot the nub fills, 0 to 1. Also sets its travel. | 0.46 |
| mark | Colour of a dot printed on the nub. | none |
| plain | Boolean. Leaves the ribs off the nub. | off |
| height | How far the nub stands, in mm. | 2.6, or 1.6 with `fin` |
| pill | Boolean. | off |
| color | A hex colour, or a colour name. | `white` |
| fin | Boolean. | off |
| d-slider | The form, then any option words. |  |

```html
<d-device material="paint-olive" radius="2.5" style="display:inline-flex;align-items:center;gap:16px;padding:18px">
  <div d-slider="nub" style="width:90px;height:34px"><input type="checkbox" aria-label="Lock"></div>
  <div d-slider="nub" style="width:90px;height:34px"><input type="range" min="0" max="2" value="1" aria-label="Band"></div>
</d-device>
```

### `[d-slider~="fader"]`

A studio fader with a printed scale. A box taller than it is wide runs up and down. A box wider than it is tall runs across.

Import `device-ui/controls`. Write `<div d-slider="fader">`.
Wraps: `<input type="range">`.
Use: Drag the cap: the length of the box less 40px covers the range. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| ticks | Number of scale marks each side. Every fifth one is long. | 11 |
| tick-length | How long a mark is, mm. | 1.75 |
| slot | How wide the slot is, mm. | 1.5 |
| cap | How wide the cap is across the slot, mm. | from the box |
| d-slider | The form, then the cap's shape: `ribbed`, a mixing desk's, `fin`, a synth's thin blade, or `flat`, a DJ mixer's low square. | `fader ribbed` |
| material | Material of the cap. | `keycap-black` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| jump | Boolean. | off |
| leds |  | 0 |
| color | A hex colour, or a colour name. | `amber` |
| on | Boolean. | off |

```html
<d-device material="anodised-oxide" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:14px">
  <div d-slider="fader" style="width:50px;height:170px"><input type="range" min="0" max="100" value="70" aria-label="Level"></div>
  <div d-slider="fader" material="plastic-red" style="width:200px;height:50px"><input type="range" min="0" max="100" value="60" aria-label="Crossfade"></div>
</d-device>
```

### `[d-slider~="lever"]`

A long lever in a slot, topped with a ball. The ball reaches a few px past the ends of the box, so leave room.

Import `device-ui/controls`. Write `<div d-slider="lever">`.
Wraps: `<input type="range">`.
Use: Drag up or down: the height of the box less 40px covers the range. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the ball. | `plastic-red` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| d-slider | The form, then any option words. |  |

```html
<d-device material="anodised-oxide" radius="3" style="display:inline-block;padding:18px 22px">
  <div d-slider="lever" style="width:60px;height:180px"><input type="range" min="0" max="100" value="40" aria-label="Throttle"></div>
</d-device>
```

### `[d-slider~="strip"]`

A strip you touch anywhere along. A solid lit bar, or a row of dots with `segments`. It runs along the longer side of its box.

Import `device-ui/controls`. Write `<div d-slider="strip">`.
Wraps: `<input type="range">`.
Use: Press or drag: the value jumps to the pointer. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| color | Lamp colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `white` |
| segments | Number of dots. 0 is a solid bar. | 0 |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| d-slider | The form, then any option words. |  |

```html
<d-device material="glass-black" radius="4" style="display:inline-flex;flex-direction:column;gap:18px;padding:22px">
  <div d-slider="strip" color="white" style="width:260px;height:24px"><input type="range" value="60" aria-label="Level"></div>
  <div d-slider="strip" segments="9" color="red" style="width:260px;height:24px"><input type="range" value="40" aria-label="Heat"></div>
</d-device>
```

### `[d-slider~="pull"]`

A knob on a rod, drawn out of the end of a body and pulled back in by its spring when let go, as a choke or a starter cord. The box is the knob home against the body, and the rod comes out on its left.

Import `device-ui/controls`. Write `<div d-slider="pull"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag it out and let go, or use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the knob. | `plastic-black` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| travel | How far it draws, in mm. | 20 |
| rod | The rod's diameter, in mm. | 6 |
| path | The knob's outline seen from the side, in `viewbox`. It's turned, so round all the way round. | a ball on a neck |
| viewbox | The box `path` is drawn in. | `0 0 100 100` |
| d-slider | The form, then any option words. |  |

```html
<d-device material="plastic-black-gloss" radius="3" style="display:inline-block;padding:18px 140px 18px 18px">
  <div d-slider="pull" material="plastic-sky" travel="25" style="width:96px;height:72px"><input type="range" min="0" max="1" step="0.01" value="0" aria-label="Pull"></div>
</d-device>
```

### `[d-slider~="handle"]`

A T-handle on a stem, pulled straight down. A pawl catches it near the bottom and it stays pulled until its input is set back; short of that, its spring takes it home. The box is the handle home, with the bar along its bottom.

Import `device-ui/controls`. Write `<div d-slider="handle"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag it down past the pawl and let go. Set the input back to 0 to reset it.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the handle. | `plastic-white` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| travel | How far it pulls, in mm. | 12 |
| bar | The bar's depth, in mm. | 8 |
| stem | The stem's width, in mm. | 12 |
| height | How far the bar stands, in mm. | 6 |
| text | Moulded along the bar. | none |
| color | The colour of `text`. | the material's legend |
| d-slider | The form, then any option words. |  |

```html
<d-device material="plastic-red" radius="3" style="display:inline-block;padding:18px 18px 72px">
  <div d-slider="handle" text="PULL" color="#b5261b" style="width:200px;height:64px"><input type="range" min="0" max="1" step="0.01" value="0" aria-label="Pull"></div>
</d-device>
```

### `[d-slider~="wing"]`

A lever in a slotted plate, with a wing handle to set it by and a printed scale down each side of the slot. From the `sewing` pack.

Import `device-ui/sewing`. Write `<div d-slider="wing"><input type="range"></div>`.
Wraps: An `<input type="range">` for the setting..
Use: Drag the lever. Tab to it and use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| ends | How much plate stays above and below the slot, in mm. | 13 |
| left, right | The numbers printed down each side. | none |
| mark | The print's colour. | `#121212` |
| material | The plate and lever. | `chrome` |
| reach |  |  |
| d-slider | The form, then any option words. |  |

```html
<d-device material="japan-black" radius="2" style="display:inline-flex;align-items:center;gap:24px;padding:16px">
  <div d-slider="wing" left="20 12 8 6" right="30 15 10 7" style="width:80px;height:312px"><input type="range" min="6" max="30" step="0.5" value="14" aria-label="Stitches to the inch"></div>
</d-device>
```

### `[d-slider~="trigger"]`

An analog trigger behind the rocker. It travels with a drag and springs back on release.

Import `device-ui/gamepad`. Write `<div d-slider="trigger">`.

| Attribute | Does | Default |
| --- | --- | --- |
| side | `left` leans it left. Anything else is right. | right |
| angle | Tilt, degrees, opposite each side. | 33 |
| d-slider | The form, then any option words. |  |

## `d-cover`

Something that lifts away from what it covers. The value says which kind, as `d-cover="guard"`.

Forms: `guard`, `clear`, `cap`, `lid`.

### `[d-cover~="guard"]`

A hinged safety cover over another control. A checkbox opens it. Shut, it takes every click meant for what is under it.

Import `device-ui/controls`. Write `<div d-cover="guard">`.
Wraps: `<input type="checkbox">` as a direct child, then the control it guards.
Use: Click the cover to open it, and the strip at the hinge to shut it. Space does both from the keyboard. While shut, the guarded control takes no clicks and Tab skips it.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the cover. | `plastic-red` |
| checked | On the `<input>`. Checked is open. | shut |
| d-cover | The form, then any option words. |  |

```html
<d-device material="anodised-graphite" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:16px">
  <div d-cover="guard" style="width:90px;height:110px;display:grid;place-items:center">
    <input type="checkbox" aria-label="Open guard">
    <button d-key="arcade" material="plastic-red" aria-label="Scram" style="width:70px;height:70px"></button>
  </div>
  <div d-cover="guard" style="width:90px;height:110px;display:grid;place-items:center">
    <input type="checkbox" checked aria-label="Open guard">
    <button d-key="arcade" material="plastic-yellow" aria-label="Purge" style="width:70px;height:70px"></button>
  </div>
</d-device>
```

### `[d-cover~="clear"]`

A clear acrylic lid hinged along its top, seen from above. Goes last, over what it covers. From the `audio` pack.

Import `device-ui/audio`. Write `<div d-cover="clear"><button></button></div>`.
Wraps: button.
Use: Click or drag to lift it. Shut, it is in the way. Open, only the strip of it standing up can be reached.

| Attribute | Does | Default |
| --- | --- | --- |
| open | Boolean. Set by a click. | off |
| d-cover | The form, then any option words. |  |

```html
<d-device material="hull-white" radius="3" style="display:inline-block;padding:14px">
  <div d-cover="clear" style="width:300px;height:180px"><button aria-label="Lid"></button></div>
</d-device>
```

### `[d-cover~="cap"]`

A shallow cap in a frame with a panel let into its top. Click it and it lifts clear on its hinge. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-cover="cap"><button></button></div>`.
Wraps: None.
Use: A native button: Tab to focus, Space or Enter to throw.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the frame. | `brushed-chrome` |
| inset | Material of the panel. | `leather-saddle` |
| radius | Corner radius in mm. | 1.5 |
| height | Height at rest in mm. | 2.4 |
| lift | How far it rises in mm. | 2.4 |
| margin | Frame width round the panel, mm: top, right, bottom, left. | 4 on all sides |
| open | Boolean. | off |
| d-cover | The form, then any option words. |  |

```html
<d-device material="brushed-chrome" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <div d-cover="cap" style="width:180px;height:100px"><button aria-label="Cap"></button></div>
</d-device>
```

### `[d-cover~="lid"]`

A cap that fits the top of a case, square where they meet, on a pin at its bottom left corner.

Import `device-ui/pocket`. Write `<div d-cover="lid">`.

| Attribute | Does | Default |
| --- | --- | --- |
| open | Boolean. | off |
| material | What it's made of, a name from the materials list. | `satin-steel` |
| radius | Corner radius, in mm. | 3 |
| height | How far it stands, in mm. | 2 |
| d-cover | The form, then any option words. |  |
