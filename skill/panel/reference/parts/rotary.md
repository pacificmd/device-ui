# Rotary

Things you turn. Each keeps its value in a native input, which stays focusable while hidden.

## `d-wheel`

Something you roll round by its edge or its face. The value says which kind, as `d-wheel="thumb"`.

Forms: `ring`, `scroll`, `pad`, `ball`, `roller`, `thumb`, `rotary`, `dial`, `click`, `spin`, `key`, `tuning`, `lens`, `drum`, `balance`, `crank`, `edge`, `crown`, `spoke`.

### `[d-wheel~="ring"]`

A turning ring that draws nothing, for a bezel or face that is drawn by something else. Lay it over what turns.

Import `device-ui/controls`. Write `<div d-wheel="ring"><input type="range"></div>`.
Wraps: `input type="range"`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from, to | Where its stops are, in degrees. | -135, 135 |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="anodised-graphite" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-wheel="ring" style="width:90px;height:90px"><input type="range" min="0" max="100" value="40" aria-label="Ring"></div>
</d-device>
```

### `[d-wheel~="scroll"]`

A disc on a bearing with a button in its middle and four more in a ring round it, as on a first music player. It runs on after a flick, and fires `detent` with the steps it passed.

Import `device-ui/controls`. Write `<div d-wheel="scroll"><button></button><button rim="top"></button>...</div>`.
Wraps: `button`.
Use: Drag round the disc to turn it, flick it to let it run. Click a button. Arrow keys turn it.

| Attribute | Does | Default |
| --- | --- | --- |
| disc | How wide the disc is, mm. | 78% of the part |
| hub | How wide the middle button is, mm. | 27.5% of the part |
| step | Degrees between ticks. | 15 |
| labels | What the ring says, clockwise from the top. `next`, `prev` and `play` are glyphs. | none |
| legend | How tall its legends stand, mm. | 1.5 |
| height | How far the ring stands, mm. | 0.9 |
| material | Material of the wheel. | `gloss-white` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| turn |  | 0 |
| rim (on the button) |  |  |
| ink |  |  |
| center |  | `gloss-white` |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="gloss-white" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-wheel="scroll" labels="menu,next,play,prev" tabindex="0" aria-label="Scroll wheel" style="width:120px;height:120px"><button aria-label="Select"></button><button rim="top" aria-label="Menu"></button><button rim="right" aria-label="Next"></button><button rim="bottom" aria-label="Play"></button><button rim="left" aria-label="Previous"></button></div>
</d-device>
```

### `[d-wheel~="pad"]`

A fixed disc that feels a finger go round it, with a button in its middle and four more in a ring round it. Nothing on it moves, and it fires `detent` with the steps it passed.

Import `device-ui/controls`. Write `<div d-wheel="pad"><button></button><button rim="top"></button>...</div>`.
Wraps: `button`.
Use: Drag round the disc. Click a button. Arrow keys turn it.

| Attribute | Does | Default |
| --- | --- | --- |
| disc | How wide the disc is, mm. | 78% of the part |
| hub | How wide the middle button is, mm. | 27.5% of the part |
| step | Degrees between ticks. | 15 |
| labels | What the ring says, clockwise from the top. `next`, `prev` and `play` are glyphs. | none |
| legend | How tall its legends stand, mm. | 1.5 |
| height | How far the ring stands, mm. | 0.9 |
| material | Material of the wheel. | `gloss-white` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| turn |  | 0 |
| rim (on the button) |  |  |
| ink |  |  |
| center |  | `gloss-white` |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="gloss-white" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-wheel="pad" labels="menu,next,play,prev" tabindex="0" aria-label="Touch wheel" style="width:120px;height:120px"><button aria-label="Select"></button><button rim="top" aria-label="Menu"></button><button rim="right" aria-label="Next"></button><button rim="bottom" aria-label="Play"></button><button rim="left" aria-label="Previous"></button></div>
</d-device>
```

### `[d-wheel~="ball"]`

A trackball: a glass ball in a ring, rolled any way and pressed to click. It fires `roll-x` and `roll-y` with the steps rolled, right and up positive.

Import `device-ui/controls`. Write `<button d-wheel="ball">`.
Wraps: `<button>`.
Use: Drag across it to roll, click to press. Arrow keys roll it, Enter or Space presses it.

| Attribute | Does | Default |
| --- | --- | --- |
| steps | Steps in one turn of the ball. | 16 |
| ring | What the ring round it is made of. | `satin-chrome` |
| material | Material of the ball. | `polished-frosted-glass` |
| on, color | Lights it from below, in this colour. | off, white |
| turn |  | 0 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| gain |  | 0.5 |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="gloss-slate" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <button d-wheel="ball" on aria-label="Trackball" style="width:48px;height:48px"></button>
</d-device>
```

### `[d-wheel~="roller"]`

A roller: a ribbed wheel across a slot, rolled up and down for ever with a thumb and pressed in to select, as under a phone's screen. It fires `roll-y` with the ribs rolled, up positive.

Import `device-ui/controls`. Write `<button d-wheel="roller">`.
Wraps: `<button>`.
Use: Drag up or down across it to roll, click to press. Up and down arrows roll it, Enter or Space presses it.

| Attribute | Does | Default |
| --- | --- | --- |
| ribs | Ribs round the wheel, one click each. | 18 |
| height | How far it stands out of the slot, mm. | 1.6 |
| material | Material of the wheel. | `plastic-black` |
| turn |  | 0 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="paint-metallic-grey" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <button d-wheel="roller" material="rubber" aria-label="Roller" style="width:40px;height:24px"></button>
</d-device>
```

### `[d-wheel~="thumb"]`

A ribbed wheel showing through a slot, turned with a thumb.

Import `device-ui/controls`. Write `<div d-wheel="thumb">`.
Wraps: `<input type="range">`.
Use: Drag up or down: 180px covers the range. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| turns | Turns of the wheel across the whole range. | 3 |
| ribs | How many ribs round the wheel. | 26 |
| crown | Mm the wheel stands out at its middle. Set, it reads as a long wheel out of a slot, narrowing to its ends. | off |
| notch | Boolean. A dip at the middle of the range, to find it by feel. | off |
| material | Material of the wheel. | `rubber` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| height | How far it stands, in mm. | 3.2 |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="plastic-black" radius="2.5" style="display:inline-block;padding:16px">
  <div d-wheel="thumb" style="width:44px;height:90px"><input type="range" min="0" max="9" value="3" aria-label="Digit"></div>
</d-device>
```

### `[d-wheel~="rotary"]`

A rotary telephone dial. The input collects the digits.

Import `device-ui/controls`. Write `<div d-wheel="rotary">`.
Wraps: `<input>`, a text field.
Use: Drag a hole clockwise to the stop and let go: the digit is added. A short drag adds nothing. With focus, digit keys dial and Backspace edits the input.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the finger plate. | `chrome` |
| value | On the `<input>`. The digits so far. Clear it to start again. | empty |
| turn | No effect. The dial keeps its place in its spring. | none |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="enamel-cream" radius="3" style="display:inline-block;padding:12px">
  <div d-wheel="rotary" style="width:210px;height:210px"><input value="" aria-label="Number"></div>
</d-device>
```

### `[d-wheel~="dial"]`

A flat disc, with a toothed edge you turn it by. The `d-mark="scale"` and `d-mark="print"` nested in it are printed on it and go round with it.

Import `device-ui/controls`. Write `<div d-wheel="dial"><input type="range"></div>`.
Wraps: `input type="range"`.
Use: Drag round its edge. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| from, to | Where its stops are, in degrees. | -135, 135 |
| teeth, tooth | How many teeth, and how deep they are in mm. | 60, 0.5 |
| rim | How much of its edge stands bare of the face, in mm. | 1.2 |
| height | How far it stands, in mm. | 3 |
| edge | What the toothed edge is made of. | `plastic-black` |
| material | Material of the face. | `dial-black` |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="anodised-graphite" radius="3" style="display:inline-block;padding:18px">
  <div d-wheel="dial" style="width:160px;height:160px"><input type="range" min="-90" max="90" value="0" aria-label="Disc"><div d-mark="scale" labels="-60:1,-30:2,0:4,30:8,60:16" radius="15.5" size="3.25" color="#efeee8" style="position:absolute;inset:0"></div></div>
</d-device>
```

### `[d-wheel~="click"]`

A touch ring around a centre button. Stroking it steps a range input. It draws no value of its own, so show the value somewhere else.

Import `device-ui/controls`. Write `<div d-wheel="click">`.
Wraps: `<input type="range">` for the ring, and a `<button>` for the centre.
Use: Stroke the ring: every 15 degrees is one step of the input. The centre is a native button. A legend of `next`, `prev` or `play` draws that transport mark. Add a `<button rim="top">`, `right`, `bottom` or `left` and a press on that side of the ring with no stroke in it clicks it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| labels | Comma-separated legends, spaced evenly clockwise from the top. Leave one empty to skip it. | none |
| material | Material of the ring. | `soft-touch-white` |
| center | Material of the centre button. | same as `material` |
| flush | Boolean. Let into the face and level with it, with a hair of a gap, in place of a dished ring. | off |
| hub | With `flush`, how wide the centre button is, in mm. Size the centre `<button>` to match in CSS. | a little over a third of the ring |
| groove | With `flush`, moulds the ring out of the face, with a groove this wide round it and the hub, in mm, and no gap. | off |
| legend | How tall the legends stand, words and glyphs alike, in mm. | in step with the ring |
| ink | The colour the legends are printed in. | the material's own legend colour |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| turn | No effect. The wheel keeps its place in the `<input>`. | none |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="soft-touch-sand" radius="5" style="display:inline-block;padding:16px">
  <div d-wheel="click" labels="MENU,NEXT,PLAY,BACK" center="gloss-white" style="width:200px;height:200px">
    <input type="range" min="0" max="100" value="30" aria-label="Scroll">
    <button aria-label="Select"></button>
  </div>
</d-device>
```

### `[d-wheel~="spin"]`

A heavy disc on a bearing, driven by a small motor and free to be caught. Flick it and it runs on. Hold it and the motor gives way. From the `synth` pack.

Import `device-ui/synth`. Write `<div d-wheel="spin" tabindex="0" rpm="33">`.
Wraps: None.
Use: Drag it round, or flick it and let go.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the disc. | `aluminium-silver` |
| rpm | Where the motor is headed. | 0 |
| hub | Radius of the dished centre, mm. | 26% of the radius |
| pins | How many screws are in the centre. | 3 |
| path, viewbox | Art printed across the whole disc. | none |
| marks | Words on it, as `angle:out:turn:text`, with commas between. `size` sets their size. | none |
| turn | Radians the hand has put on it, on top of the motor. | 0 |
| size | Letter height of `marks`, mm. | 1.75 |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-wheel="spin" tabindex="0" role="slider" aria-label="Disc" rpm="33" marks="-45:0.62:45:96 / 24" style="width:140px;height:140px"></div>
</d-device>
```

### `[d-wheel~="key"]`

A winding key seen from the front, coming out of the side of a case: a collar, a shaft and a flat thumbpiece across the end of it. Drag up to wind it, one way only, against its pawl. The box starts at the side of the case and is as tall as the thumbpiece.

Import `device-ui/clockwork`. Write `<div d-wheel="key"><input type="range" min="0" max="360"></div>`.
Wraps: A range, the angle from 0 to 360.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the key. | `brass` |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="gloss-black" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-wheel="key" style="width:76px;height:56px"><input type="range" min="0" max="360" value="40" aria-label="Winding key"></div>
</d-device>
```

### `[d-wheel~="tuning"]`

A thumb disc let into a case, on a fixed hub, carrying a pointer and raised pins. From the `audio` pack.

Import `device-ui/audio`. Write `<div d-wheel="tuning"><input type="range"></div>`.
Wraps: input[type=range].
Use: Drag it round its centre, drag straight on the hub, or use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| from | Degrees clockwise from the top at the input's minimum. | -135 |
| to | Degrees at the input's maximum. | 135 |
| pins | Comma list of raised pins, degrees either side of the pointer. | none |
| hub | Hub radius, mm. | 31% of the radius |
| hubmaterial | Material of the fixed hub. | `aluminium-silver` |
| material | Material of the disc. | the surface it sits on |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="plastic-white" radius="3" style="display:inline-block;padding:24px">
  <div d-wheel="tuning" pins="120,-120" style="width:160px;height:160px"><input type="range" aria-label="Tuning"></div>
</d-device>
```

### `[d-wheel~="lens"]`

A grooved ring round a lens, turned by a hand on its edge. Heavy and damped in grease, or light and sprung with `clicks`. Stack them narrowest last. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-wheel="lens"><input type="range"></div>`.
Wraps: input[type=range].
Use: Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| material | Material of the ring. | `black-oxide` |
| clicks | A sprung ball in a notch at each step, as on an aperture ring. | off |
| from, to | Where the ends of its travel are, in degrees. | -45, 45 |
| teeth | Grooves round the edge. | 120 |
| height | Height in mm. | 6 |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="vulcanite-black" radius="3" style="display:inline-block;padding:14px">
  <div d-wheel="lens" clicks teeth="72" style="width:150px;height:150px"><input type="range" min="0" max="8" value="3" aria-label="Aperture"></div>
</d-device>
```

### `[d-wheel~="drum"]`

A knurled drum seen from the side, on an upright axle, rolled sideways under a thumb through its stops. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-wheel="drum"><input type="range"></div>`.
Wraps: input[type=range].
Use: Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| material | Material of the drum. | `satin-chrome` |
| sweep | How far it can turn, in degrees. | 300 |
| ribs | How many ribs run round it. | 60 |
| cap | Height of the plain top, mm. | 30% of its height |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="satin-chrome" radius="3" style="display:inline-block;padding:18px">
  <div d-wheel="drum" style="width:112px;height:40px"><input type="range" min="0" max="10" value="4" aria-label="Speed"></div>
</d-device>
```

### `[d-wheel~="drum"][sprung]`

The same drum turned either way against a spring, as a zoom ring round a shutter. Let go, it goes back to the middle of its input. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-wheel="drum" sprung><input type="range"></div>`.
Wraps: input[type=range].
Use: Drag it either way and let go, or hold an arrow key.

| Attribute | Does | Default |
| --- | --- | --- |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| sweep | All of its throw, end to end, in degrees. | 40 |
| material | What it's made of, a name from the materials list. | `satin-chrome` |
| ribs |  | 60 |
| cap |  | 0 |
| d-wheel | The form, then any option words. |  |
| sprung | Boolean. | off |

```html
<d-device material="satin-chrome" radius="3" style="display:inline-block;padding:18px">
  <div d-wheel="drum" sprung style="width:112px;height:24px"><input type="range" min="-1" max="1" step="0.01" value="0" aria-label="Zoom"></div>
</d-device>
```

### `[d-wheel~="drum"][across]`

The drum with its axle along its box, rolled up or down under a thumb, or with `sprung` twisted either way in a fist and let go, as a grip on a handlebar. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-wheel="drum" across><input type="range"></div>`.
Wraps: input[type=range].
Use: Drag it up or down, or use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| material | Material of the drum. | `satin-chrome` |
| profile | Each step from the left, diameter and length in mm, comma separated, for a grip turned down in stages. | fills its box |
| sweep | How far it can turn, in degrees, or with `sprung` all of its throw. | 300, or 40 with `sprung` |
| ribs | How many ribs run along it. | 60 |
| sprung | Goes back to the middle of its input when let go. Boolean. | off |
| d-wheel | The form, then any option words. |  |
| across | Boolean. | off |

```html
<d-device material="satin-chrome" radius="3" style="display:inline-block;padding:18px">
  <div d-wheel="drum" across material="plastic-sunflower" profile="20 6, 18 6, 16 6, 14 6" ribs="24" style="width:96px;height:80px"><input type="range" min="0" max="10" value="4" aria-label="Roll"></div>
</d-device>
```

### `[d-wheel~="drum"][across][sprung]`

The drum lying along its box, twisted either way in a fist against a spring, as a grip on a toy or a throttle. Let go, it goes back to the middle of its input. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-wheel="drum" across sprung><input type="range"></div>`.
Wraps: input[type=range].
Use: Drag it up or down and let go, or hold an arrow key.

| Attribute | Does | Default |
| --- | --- | --- |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| sweep | All of its throw, end to end, in degrees. | 40 |
| profile | Each step from the left, diameter and length in mm, comma separated. | fills its box |
| material | What it's made of, a name from the materials list. | `satin-chrome` |
| ribs |  | 60 |
| d-wheel | The form, then any option words. |  |
| across | Boolean. | off |
| sprung | Boolean. | off |

```html
<d-device material="satin-chrome" radius="3" style="display:inline-block;padding:18px">
  <div d-wheel="drum" across sprung material="plastic-sunflower" profile="20 6, 18 6, 16 6, 14 6" ribs="2" sweep="60" style="width:96px;height:80px"><input type="range" min="-1" max="1" step="0.05" value="0" aria-label="Twist"></div>
</d-device>
```

### `[d-wheel~="balance"]`

A handwheel on a shaft running across the view, seen nearly edge on. Pull the near side down to turn it, and it runs on a little, being heavy. From the `sewing` pack.

Import `device-ui/sewing`. Write `<div d-wheel="balance"><input type="range" min="0" max="360"></div>`.
Wraps: An `<input type="range">` for the shaft's angle, which wraps at the top..
Use: Drag the wheel down. Tab to it and use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| lean | How wide the ellipse is for its height. | 0.36 |
| rim-off | How far the rim stands off the wheel, in mm. | 8 |
| holes | How many holes are cut through the web. | 3 |
| material, rim | The casting, and the ring round it. | `japan-black`, `chrome` |
| d-wheel | The form, then any option words. |  |

```html
<d-device material="plastic-white" radius="2" style="display:inline-flex;align-items:center;gap:24px;padding:16px">
  <div d-wheel="balance" style="width:200px;height:440px"><input type="range" min="0" max="360" value="0" aria-label="Handwheel"></div>
</d-device>
```

### `[d-wheel~="crank"]`

A crank on a shaft coming out of the side of a case, turned round and round. Two inputs: a range holds the angle from 0 to 360, 0 with the arm laid up the side, and a checkbox whether it's folded out. A hand goes round the shaft, and how far it is to the right of it stands for how far the grip has come towards you. Folding it away takes the arm home first. `reach` is the arm and `pivot` the shaft's height in the box, both mm. The box starts at the side of the case and has to take the swing.

Import `device-ui/tool`. Write `<div d-wheel="crank">`.

| Attribute | Does | Default |
| --- | --- | --- |
| pivot | Shaft's height in the box, mm. | half the box height |
| reach | Arm length, mm. | 22 |
| arm | Material of the shaft and arm. | `aluminium-pale` |
| depth | How much the grip's swing toward you lifts it, per mm of swing. | 0.35 |
| material | What it's made of, a name from the materials list. | `plastic-yellow` |
| d-wheel | The form, then any option words. |  |

### `[d-wheel~="edge"]`

A knurled wheel with most of itself behind the edge of a case, rolled along that edge with a thumb. `angle` is how far the edge slopes, degrees.

Import `device-ui/gamepad`. Write `<div d-wheel="edge">`.

| Attribute | Does | Default |
| --- | --- | --- |
| turns | How many full turns its range covers. | 2 |
| angle | How far the edge slopes, degrees. | 0 |
| material | What it's made of, a name from the materials list. | `anodised-graphite` |
| d-wheel | The form, then any option words. |  |

### `[d-wheel~="crown"]`

A knurled crown seen from above, standing out of the case at three o'clock. Drag it up or down to turn it, and out or in to pull it to its positions. The first input is what turning it sets, and the second where it's pulled to, from 0 pushed in: `max="2"` for a crown that winds, sets the date and sets the time. A checkbox after them makes it screw down: ticked, it's screwed to the case and can't be pulled. Turn it back to unscrew it, and it springs out to winding. To screw it down again, push it in as you turn it on.

Import `device-ui/watch`. Write `<div d-wheel="crown">`.

| Attribute | Does | Default |
| --- | --- | --- |
| flutes | Flutes round the barrel. | 26 |
| d-wheel | The form, then any option words. |  |

### `[d-wheel~="lens"][clicks]`

With `clicks` it's a sprung ball in a row of dimples, as on an aperture ring: light, and hard to stop between.

Import `device-ui/camera`. Write `[d-wheel~="lens"][clicks]`.

| Attribute | Does | Default |
| --- | --- | --- |
| from | Start, degrees. | -45 |
| to | End, degrees. | 45 |
| teeth | Teeth round the edge. | 120 |
| material | What it's made of, a name from the materials list. | `black-oxide` |
| height | How far it stands, in mm. | 6 |
| d-wheel | The form, then any option words. |  |
| clicks | Boolean. | off |

### `[d-wheel~="spoke"]`

A handle of five spokes. Held by the lock it gives a little and comes back.

Import `device-ui/vault`. Write `<div d-wheel="spoke">`.

| Attribute | Does | Default |
| --- | --- | --- |
| locked | Boolean. | off |
| d-wheel | The form, then any option words. |  |

## `d-knob`

Something you grip and turn. The value says which kind, as `d-knob="skirt"`.

Forms: `skirt`, `cap`, `collet`, `flared`, `stem`, `bar`, `pointer`, `jog`, `knurled`, `wing`, `ribbed`, `flange`, `selector`, `tension`, `hat`.

### `[d-knob=""]`

The plain knob: turned aluminium over a thin skirt, ribbed, with a spun top, a line to point with and its scale printed round it. Every knob is built the same way: its form is the body, its section from the side, and everything else is an option every form takes.

Import `device-ui/controls`. Write `<div d-knob>`.
Wraps: `<input type="range">`.
Use: Drag round it, or straight on the middle. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| material | Material of the knob. | `brushed-aluminium` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| detents |  | 0 |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| d-knob | The form, then any option words. |  |

```html
<d-device material="paint-panel-black" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob style="width:130px;height:130px"><input type="range" min="0" max="10" value="4" aria-label="Volume"></div>
  <div d-knob grip="knurled" mark="dot" ticks="0" style="width:80px;height:80px"><input type="range" value="30" aria-label="Gain"></div>
  <div d-knob grip="lobed" top="spun" material="plastic-black" ticks="0" style="width:90px;height:90px"><input type="range" value="70" aria-label="Tone"></div>
</d-device>
```

### `[d-knob~="skirt"]`

A moulded instrument knob: a fluted body over a flat skirt with a line across it, and an aluminium disc let into its top.

Import `device-ui/controls`. Write `<div d-knob="skirt"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| material | Material of the knob. | `plastic-black` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| detents |  | 0 |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| d-knob | The form, then any option words. |  |

```html
<d-device material="paint-panel-black" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="skirt" style="width:88px;height:88px"><input type="range" value="60" aria-label="Cutoff"></div>
  <div d-knob="skirt" material="bakelite" grip="ribbed" style="width:88px;height:88px"><input type="range" value="20" aria-label="Fine"></div>
</d-device>
```

### `[d-knob~="skirt"][detents]`

The same knob on a click-stop switch: one click for each of `detents`, each label, each tick, or else each step of its input.

Import `device-ui/controls`. Write `<div d-knob="skirt" detents>`.
Wraps: `<input type="range">`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| detents | How many clicks. Empty counts its labels, its ticks, or its input's steps. | empty |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| material | What it's made of, a name from the materials list. | `plastic-black` |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| material (on the d-surface) | What it's made of, a name from the materials list. |  |
| d-knob | The form, then any option words. |  |

```html
<d-device material="paint-panel-black" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="skirt" detents sweep="90" style="width:88px;height:88px"><input type="range" min="0" max="5" step="1" value="2" aria-label="Range"></div>
</d-device>
```

### `[d-knob~="cap"]`

A plain straight-sided moulded knob with a chamfered top and nothing printed on it.

Import `device-ui/controls`. Write `<div d-knob="cap"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag it round, drag straight on the middle, or use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| material | Material of the knob. | `keycap-grey` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| detents |  | 0 |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| d-knob | The form, then any option words. |  |

```html
<d-device material="hull-white" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="cap" style="width:60px;height:60px"><input type="range" aria-label="Level"></div>
  <div d-knob="cap" material="aluminium-silver" grip="knurled" top="spun" mark="arrow" height="10" edge="0.4" style="width:72px;height:72px"><input type="range" aria-label="Volume"></div>
</d-device>
```

### `[d-knob~="cap"][detents]`

The same knob on a click-stop switch, as a mode dial or a stepped encoder is. With `leds` it is an encoder in a ring of lamps.

Import `device-ui/controls`. Write `<div d-knob="cap" detents>`.
Wraps: `<input type="range">`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| detents | How many clicks. Empty counts its labels, its ticks, or its input's steps. | empty |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| material | What it's made of, a name from the materials list. | `keycap-grey` |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| material (on the d-surface) | What it's made of, a name from the materials list. |  |
| d-knob | The form, then any option words. |  |

```html
<d-device material="glass-black" radius="4" style="display:inline-flex;align-items:center;gap:22px;padding:18px">
  <div d-knob="cap" detents leds color="cyan" material="aluminium-silver" grip="knurled" top="spun" mark="dot" style="width:130px;height:130px"><input type="range" value="55" aria-label="Volume"></div>
  <div d-knob="cap" detents leds="21" color="amber" material="aluminium-midnight" grip="knurled" top="spun" mark="dot" style="width:130px;height:130px"><input type="range" value="35" aria-label="Gain"></div>
</d-device>
```

### `[d-knob~="cap"][free]`

The same knob on a shaft with no ends and no input, as on a toy. Its `turn` attribute holds the angle in radians, for whatever it drives to read.

Import `device-ui/controls`. Write `<div d-knob="cap" free tabindex="0" role="slider">`.
Wraps: None. The element is the control.
Use: Drag around the centre. With focus, the arrow keys turn it.

| Attribute | Does | Default |
| --- | --- | --- |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| turn |  | 0 |
| from |  |  |
| sweep |  | 135 |
| to |  |  |
| detents |  | 0 |
| labels |  |  |
| ticks |  | 0 |
| size |  |  |
| leds |  | 0 |
| major |  | 5 |
| material | What it's made of, a name from the materials list. | `keycap-grey` |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| material (on the d-surface) | What it's made of, a name from the materials list. |  |
| color | A hex colour, or a colour name. | `white` |
| d-knob | The form, then any option words. |  |
| free | Boolean. | off |

```html
<d-device material="gloss-scarlet" radius="3" style="display:inline-block;padding:24px">
  <div d-knob="cap" free material="plastic-white" grip="ribbed" top="domed" height="9" edge="3" tabindex="0" role="slider" aria-label="Tuning" style="width:120px;height:120px"></div>
</d-device>
```

### `[d-knob~="collet"]`

A tapered soft-touch knob with a coloured cap pressed on its top, held to its shaft by a collet.

Import `device-ui/controls`. Write `<div d-knob="collet"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| material | Material of the knob. | `plastic-black` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| detents |  | 0 |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| d-knob | The form, then any option words. |  |

```html
<d-device material="paint-panel-black" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="collet" cap="plastic-flame" style="width:64px;height:64px"><input type="range" aria-label="Level"></div>
  <div d-knob="collet" cap="plastic-sky" style="width:64px;height:64px"><input type="range" aria-label="Level"></div>
  <div d-knob="collet" cap="plastic-white" style="width:64px;height:64px"><input type="range" aria-label="Level"></div>
</d-device>
```

### `[d-knob~="collet"][detents]`

The same knob on a click-stop switch.

Import `device-ui/controls`. Write `<div d-knob="collet" detents>`.
Wraps: `<input type="range">`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| detents | How many clicks. Empty counts its labels, its ticks, or its input's steps. | empty |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| material | What it's made of, a name from the materials list. | `plastic-black` |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| material (on the d-surface) | What it's made of, a name from the materials list. |  |
| d-knob | The form, then any option words. |  |

```html
<d-device material="paint-panel-black" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="collet" detents cap="plastic-sky" style="width:64px;height:64px"><input type="range" min="0" max="4" value="1" aria-label="Wave"></div>
</d-device>
```

### `[d-knob~="flared"]`

A fluted knob flaring into a cone at its foot, with a ray of ticks printed round it, as on a drum machine.

Import `device-ui/controls`. Write `<div d-knob="flared"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| material | Material of the knob. | `plastic-black` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| detents |  | 0 |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| d-knob | The form, then any option words. |  |

```html
<d-device material="paint-charcoal" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="flared" cap="plastic-flame" style="width:88px;height:88px"><input type="range" value="60" aria-label="Level"></div>
  <div d-knob="flared" size="21.1" ticks="0" ribs="30" mark-color="#ea4a14" style="width:88px;height:88px"><input type="range" value="30" aria-label="Tempo"></div>
</d-device>
```

### `[d-knob~="stem"]`

An endless encoder: a slim ribbed stem with a domed top and a slot across it. It clicks at each step of its input. `ring` sets a groove round a low boss in the panel.

Import `device-ui/controls`. Write `<div d-knob="stem"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag round it. It has no ends. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| ring | Boolean. A groove round a low boss in the panel. | off |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| material | Material of the stem. | `plastic-white` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| detents |  | 0 |
| pointer | Boolean. | off |
| d-knob | The form, then any option words. |  |

```html
<d-device material="plastic-white" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="stem" cap="plastic-sky" ring mark-color="#f4f3ee" style="width:72px;height:72px"><input type="range" min="0" max="31" value="9" aria-label="Encoder"></div>
</d-device>
```

### `[d-knob~="bar"]`

A bar across a round foot, with a line along it to point with, turned by its ends.

Import `device-ui/controls`. Write `<div d-knob="bar"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| material | Material of the knob. | `plastic-black` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| detents |  | 0 |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| d-knob | The form, then any option words. |  |

```html
<d-device material="hull-white" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="bar" style="width:80px;height:80px"><input type="range" aria-label="Tone"></div>
  <div d-knob="bar" material="bakelite" style="width:80px;height:80px"><input type="range" value="20" aria-label="Bass"></div>
</d-device>
```

### `[d-knob~="bar"][detents]`

The same knob on a click-stop switch, as a selector is. Print its positions with `labels`.

Import `device-ui/controls`. Write `<div d-knob="bar" detents>`.
Wraps: `<input type="range">`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| detents | How many clicks. Empty counts its labels, its ticks, or its input's steps. | empty |
| grip | `smooth`, `knurled`, `ribbed`, `fluted` or `lobed`: how its side is cut, each at the pitch it is made at, so a bigger knob has more. | per form |
| ribs | How many grips go round it, in place of what the pitch gives. | from the pitch |
| top | `flat`, `spun` (a metal disc spun in circles), `cap` (a coloured cap), `dished` or `domed`. | per form |
| cap, face | What its cap is made of, and what its top face or spun disc is. | per form |
| mark | `line`, `dot`, `arrow`, `slot` (a groove across), `skirt` (a line across the skirt) or `none`. | per form |
| mark-color | What its mark is filled with. | the legend colour of what it is on |
| height, taper, edge | How tall it stands in mm, how far its side leans in in degrees, and the round or chamfer of its top edge in mm. | per form |
| body | On a skirted knob, the body's share of the whole diameter. | per form |
| ticks, major, sweep, labels | Its scale printed on the panel round it: how many ticks, every how many is long, degrees each side of the top, and comma-separated labels. | per form, 5, per form, none |
| size | Diameter of the knob, mm. Without it, it gives up 3.75mm for ticks, 3.25mm for LEDs and room for labels. | what is left |
| leds, color | A ring of that many lamps round it, or one lit arc if empty, lit up to where it points, and their colour. | none, `white` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| from |  |  |
| to |  |  |
| material | What it's made of, a name from the materials list. | `plastic-black` |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| material (on the d-surface) | What it's made of, a name from the materials list. |  |
| d-knob | The form, then any option words. |  |

```html
<d-device material="hull-white" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="bar" detents labels="1,2,3,4" style="width:120px;height:120px"><input type="range" min="0" max="3" value="1" aria-label="Input"></div>
</d-device>
```

### `[d-knob~="pointer"]`

A pointer knob that clicks between named positions. The input decides how many positions there are.

Import `device-ui/controls`. Write `<div d-knob="pointer">`.
Wraps: `<input type="range">`.
Use: Drag up or down: 150px covers the range. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| labels | Comma-separated legends, one per position, printed around the knob. | none |
| sweep | Degrees either side of straight up. | 135 |
| material | Material of the pointer. | `bakelite` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| leds | Boolean. | off |
| color | A hex colour, or a colour name. | `amber` |
| on | Boolean. | off |
| d-knob | The form, then any option words. |  |

```html
<d-device material="enamel-cream" radius="3" style="display:inline-block;padding:12px">
  <div d-knob="pointer" labels="OFF,LOW,MID,HIGH,MAX" style="width:140px;height:140px"><input type="range" min="0" max="4" value="2" aria-label="Mode"></div>
</d-device>
```

### `[d-knob~="jog"]`

A big free-spinning wheel with a finger dimple, turned in circles.

Import `device-ui/controls`. Write `<div d-knob="jog">`.
Wraps: `<input type="range">`.
Use: Drag around the centre. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| turns | Turns of the wheel across the whole range. | 1 |
| wrap | Boolean. Runs past either end and comes round the other side, instead of stopping. | off |
| material | Material of the plate. | `brushed-aluminium` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| d-knob | The form, then any option words. |  |

```html
<d-device material="anodised-graphite" radius="3" style="display:inline-block;padding:16px">
  <div d-knob="jog" style="width:150px;height:150px"><input type="range" min="0" max="100" value="30" aria-label="Scrub"></div>
</d-device>
```

### `[d-knob~="knurled"]`

A round knob with a knurled skirt and a smooth cap. Its input runs from `from` to `to` degrees clockwise of straight up, which can be many turns, as an interval timer's is.

Import `device-ui/controls`. Write `<div d-knob="knurled"><input type="range"></div>`.
Wraps: `input type="range"`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| material | Material of the knob. | `plastic-black` |
| from, to | The angle at each end of the input, in degrees. | 0, 360 |
| height, pitch | How far it stands and the distance between teeth, in mm. | 10, 1.3 |
| cap | How much of it the cap fills. | 0.8 |
| rings | Grooves cut round the cap. | 0 |
| legend, size, color | Printed on the cap, a slash starting a line a step to the right, its size in mm, and its ink. | none, 5, `#e6e6dc` |
| pointer | A dot at the edge of the cap. | off |
| d-knob | The form, then any option words. |  |

```html
<d-device material="dial-black" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:16px">
  <div d-knob="knurled" legend="SET" size="4" style="width:100px;height:100px"><input type="range" min="0" max="100" value="20" aria-label="Time"></div>
  <div d-knob="knurled" rings="3" pointer from="-90" to="90" height="6" style="width:60px;height:60px"><input type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Level"></div>
</d-device>
```

### `[d-knob~="wing"]`

A winged pointer knob on a rotary switch: a round head with a pair of moulded wings under it, the longer one pointing, on a turned collar. It clicks at each step of its input. From the `synth` pack.

Import `device-ui/synth`. Write `<div d-knob="wing"><input type="range"></div>`.
Wraps: `input type="range"`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| material | Material of the moulding. | `plastic-red` |
| collar | The metal round it. | `satin-chrome` |
| mark | The colour of the line in its pointing wing. | `#e8e6dd` |
| size | How much of the box the wings span. | 0.96 |
| from, to | Where its stops are, in degrees from straight up. | -135, 135 |
| height | How far it stands, in mm. | 18 |
| d-knob | The form, then any option words. |  |

```html
<d-device material="paint-panel-bluegrey" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="wing" material="plastic-oxblood" from="-120" to="120" style="width:112px;height:112px"><input type="range" min="0" max="8" step="1" value="3" aria-label="Gain"></div>
</d-device>
```

### `[d-knob~="ribbed"]`

A ribbed moulded knob with a smooth domed top and a short line at its foot to point with, on a stepped switch. On its own with a `collar`, or with `lift` as the inner knob of a concentric pair, standing on a `flange`. From the `synth` pack.

Import `device-ui/synth`. Write `<div d-knob="ribbed"><input type="range"></div>`.
Wraps: `input type="range"`.
Use: Drag round it. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| material | Material of the ribs. | `keycap-grey` |
| cap | The material of its top. | the ribs |
| mark | The colour of the line at its foot. | `#e8e6dd` |
| size | How much of the box it fills. What is left shows the collar. | 1 |
| collar | The metal round it, if it has one. | none |
| lift | How far up it stands, in mm, on what is under it. | 0 |
| ribs | How many ribs. | 22 |
| from, to | Where its stops are, in degrees from straight up. | -135, 135 |
| height | How far it rises, in mm. | 15 |
| d-knob | The form, then any option words. |  |

```html
<d-device material="paint-panel-bluegrey" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="ribbed" material="plastic-ash" cap="plastic-dove" collar="satin-chrome" size="0.68" from="60" to="300" style="width:112px;height:112px"><input type="range" min="0" max="16" step="1" value="8" aria-label="Boost"></div>
</d-device>
```

### `[d-knob~="flange"]`

The outer knob of a concentric pair: a low spun metal flange with a knurled rim and a line to point with, on its own stepped switch. A `ribbed` knob with `lift` stands in the middle of it. From the `synth` pack.

Import `device-ui/synth`. Write `<div d-knob="flange"><input type="range"></div>`.
Wraps: `input type="range"`.
Use: Drag round its rim. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| material | Material of the flange. | `satin-chrome` |
| mark | The colour of its line. | `#141414` |
| knurl | How many teeth round its rim. | 120 |
| bore | How much of it the well for the inner knob takes. | 0.62 |
| from, to | Where its stops are, in degrees from straight up. | -135, 135 |
| height | How far it stands, in mm. | 5 |
| d-knob | The form, then any option words. |  |

```html
<d-device material="paint-panel-bluegrey" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="flange" from="90" to="270" style="width:124px;height:124px"><input type="range" min="0" max="6" step="1" value="2" aria-label="Frequency"></div>
</d-device>
```

### `[d-knob~="selector"]`

A meter's function switch: a low ribbed disc with a bar moulded right across it, its long end past the rim and a white line let into the tip. It snaps between positions, and a press on either side of the middle clicks it one that way.

Import `device-ui/lab`. Write `<div d-knob="selector"><input type="range"></div>`.
Wraps: `input type="range"`.
Use: Drag round it, or press either side. Arrow keys, Home, End and Page keys come from the input.

| Attribute | Does | Default |
| --- | --- | --- |
| from, to | Where its stops are, degrees clockwise from straight up. | -135, 135 |
| size | How much of the box the disc fills. The box is the sweep of the tip. | 0.91 |
| ribs | Mm between ribs, 0 for none. | 1 |
| height, grip | How far the disc and the bar on it stand, in mm. | 2.6, 6 |
| material | Material of the disc and bar. | `plastic-black` |
| d-knob | The form, then any option words. |  |

```html
<d-device material="shell-slate" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-knob="selector" from="-120" to="90" style="width:200px;height:200px"><input type="range" min="0" max="7" step="1" value="1" aria-label="Function"></div>
</d-device>
```

### `[d-knob~="tension"]`

A thread tension seen on its axis: a dished cup, a numbered dial and the thumb nut that turns with it and runs in along the stud as it's tightened. From the `sewing` pack.

Import `device-ui/sewing`. Write `<div d-knob="tension"><input type="range" min="0" max="8" step="0.1"></div>`.
Wraps: An `<input type="range">` for the setting..
Use: Drag round it. Tab to it and use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| sweep, count | Degrees either side of straight up, and the highest number. | 150, 8 |
| mark, dial | The numbers' colour, and what the dial is made of. | `#e8e4d8`, `lacquer-black` |
| material | The cup and nut. | `satin-chrome` |
| d-knob | The form, then any option words. |  |

```html
<d-device material="japan-black" radius="2" style="display:inline-flex;align-items:center;gap:24px;padding:16px">
  <div d-knob="tension" style="width:128px;height:128px"><input type="range" min="0" max="8" step="0.1" value="4" aria-label="Thread tension"></div>
</d-device>
```

### `[d-knob~="hat"]`

A top-hat knob as on a guitar: a fine-ribbed barrel with a low domed top, its numbers round the edge of the top and turning with it. From the `guitar` pack.

Import `device-ui/guitar`. Write `<div d-knob="hat"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag it round, or use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| legend | Printed across the middle of the top. | none |
| sweep | How far it turns each way from the middle, in degrees. | 150 |
| material | What it's made of, a name from the materials list. | `keycap-ivory` |
| height | How far it stands, in mm. | 9 |
| mark |  | `#6b5a3c` |
| count |  | 10 |
| d-knob | The form, then any option words. |  |

```html
<d-device material="plastic-white" radius="2" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <div d-knob="hat" legend="VOLUME" style="width:96px;height:96px"><input type="range" min="0" max="10" value="7" aria-label="Volume"></div>
</d-device>
```

### `[d-knob=""][detents]`

The same on a click-stop switch: one click for each of `detents`, or each label, or each tick.

Import `device-ui/controls`. Write `[d-knob=""][detents]`.

| Attribute | Does | Default |
| --- | --- | --- |
| ticks | Tick marks printed round it, over ±135 degrees. Every fifth is longer. Also the number of clicks if `detents` is empty or 0. | 11 |
| detents | Number of click positions. Empty or 0 uses `ticks`. | 0 |
| from |  |  |
| sweep |  | 135 |
| to |  |  |
| labels |  |  |
| size |  |  |
| leds |  | 0 |
| major |  | 5 |
| top |  |  |
| mark |  |  |
| grip |  |  |
| cap |  |  |
| material | What it's made of, a name from the materials list. | `brushed-aluminium` |
| ribs |  | 0 |
| face |  |  |
| mark-color |  |  |
| height | How far it stands, in mm. | 13 |
| body |  | 0.84 |
| taper |  | 2 |
| edge |  | 0.5 |
| pointer | Boolean. | off |
| ring | Boolean. | off |
| material (on the d-surface) | What it's made of, a name from the materials list. |  |
| color | A hex colour, or a colour name. | `white` |
| d-knob | The form, then any option words. |  |
