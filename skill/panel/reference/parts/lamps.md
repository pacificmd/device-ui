# Lamps

Things that light up. Attribute changes are cheap, so drive them from a script as often as you like.

## `d-lamp`

Something that lights up to say so. The value says which kind, as `d-lamp="led"`.

Forms: `led`, `neon`, `pin`, `window`, `bar`, `annunciator`, `bulb`, `halo`, `backlight`, `arrow`.

### `[d-lamp=""]`

An indicator lamp. A jewel in a chrome bezel by default, a small LED with `d-lamp="led"`, a flat bar LED with `d-lamp="bar"`, a pinhole in the panel with `d-lamp="pin"`, or frosted glass lit from behind with `d-lamp="window"`.

Import `device-ui/controls`. Write `<div d-lamp>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| on | Lights it. Boolean. Change it from a script at any time. | off |
| color | Lamp colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `amber` |
| level | How bright while `on`, 0 to 1, for a lamp lit part of the time. Change it from a script at any time. | 1 |
| lens | How the plain lamp's glass is cut: `jewel` in facets, `dome`, `flat` or `fresnel` in rings. | `jewel` |
| square | Boolean. A square pilot light: a flat lens in a square bezel. | off |
| bezel | Material of the bezel. | `chrome` |
| d-lamp | The form, then any option words. |  |

```html
<d-device material="paint-olive" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:18px">
  <div d-lamp color="green" on></div>
  <div d-lamp color="red" lens="fresnel" on></div>
  <div d-lamp="led" color="amber" on style="width:16px;height:16px"></div>
  <div d-lamp="pin" color="green" on style="width:6px;height:6px"></div>
</d-device>
```

### `[d-lamp~="led"]`

A small domed LED on a black seat.

Import `device-ui/controls`. Write `<div d-lamp="led">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| on | Lights it. Boolean. Change it from a script at any time. | off |
| color | Lamp colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `amber` |
| level | How bright while `on`, 0 to 1, for a lamp lit part of the time. Change it from a script at any time. | 1 |
| d-lamp | The form, then any option words. |  |

```html
<d-device material="paint-olive" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:18px">
  <div d-lamp="led" color="green" on style="width:16px;height:16px"></div>
  <div d-lamp="led" color="amber" on style="width:16px;height:16px"></div>
  <div d-lamp="led" color="red" style="width:16px;height:16px"></div>
</d-device>
```

### `[d-lamp~="neon"]`

A neon indicator: a clear bulb in a black sleeve with two electrodes inside. Lit, the gas glows orange round them and nowhere else.

Import `device-ui/controls`. Write `<div d-lamp="neon">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| on | Lights it. Boolean. Change it from a script at any time. | off |
| level | How bright while `on`, 0 to 1, for a lamp lit part of the time. Change it from a script at any time. | 1 |
| color | Glow colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `neon` |
| d-lamp | The form, then any option words. |  |

```html
<d-device material="paint-charcoal" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:18px">
  <div d-lamp="neon" on style="width:28px;height:28px"></div>
  <div d-lamp="neon" style="width:28px;height:28px"></div>
</d-device>
```

### `[d-lamp~="pin"]`

A pinhole in the panel. It cannot be seen until it is lit.

Import `device-ui/controls`. Write `<div d-lamp="pin">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| on | Lights it. Boolean. Change it from a script at any time. | off |
| color | Lamp colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `amber` |
| level | How bright while `on`, 0 to 1, for a lamp lit part of the time. Change it from a script at any time. | 1 |
| hole | Boolean. The lamp sits behind a small drilled hole in what it's on. | off |
| d-lamp | The form, then any option words. |  |

```html
<d-device material="paint-olive" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:18px">
  <div d-lamp="pin" color="green" on style="width:6px;height:6px"></div>
  <div d-lamp="pin" color="red" on style="width:6px;height:6px"></div>
</d-device>
```

### `[d-lamp~="window"]`

Frosted glass with a lamp behind it: whatever it sits on, lit through.

Import `device-ui/controls`. Write `<div d-lamp="window">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| on | Lights it. Boolean. Change it from a script at any time. | off |
| color | Lamp colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `amber` |
| level | How bright while `on`, 0 to 1, for a lamp lit part of the time. Change it from a script at any time. | 1 |
| d-lamp | The form, then any option words. |  |

```html
<d-device material="paint-olive" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:18px">
  <div d-lamp="window" color="amber" on style="width:26px;height:26px"></div>
</d-device>
```

### `[d-lamp~="bar"]`

A flat bar of an LED, set level with what it sits in. It fills its box.

Import `device-ui/controls`. Write `<div d-lamp="bar">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| on | Lights it. Boolean. Change it from a script at any time. | off |
| color | Lamp colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `amber` |
| level | How bright while `on`, 0 to 1, for a lamp lit part of the time. Change it from a script at any time. | 1 |
| d-lamp | The form, then any option words. |  |

```html
<d-device material="paint-olive" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:18px">
  <div d-lamp="bar" color="green" on style="width:40px;height:8px"></div>
</d-device>
```

### `[d-lamp~="annunciator"]`

A warning tile: dark until it is on, with its legend lit through it.

Import `device-ui/controls`. Write `<div d-lamp="annunciator">`.
Wraps: None. Any block element, with the legend as its text..

| Attribute | Does | Default |
| --- | --- | --- |
| on | Lights it. Boolean. | off |
| color | Lamp colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `amber` |
| material | A tile of this material, seen unlit, with its legend always printed on it. | dark tile |
| frame | Material of the surround. | none |
| bare | Boolean. A patch of phosphor with no tile: nothing to see until it is on. | off |
| gain | Brightness of a `material` or `bare` tile. | 0.2, or 0.1 bare |
| d-lamp | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="anodised-graphite" radius="2.5" style="display:inline-flex;align-items:center;gap:8px;padding:16px">
  <div d-lamp="annunciator" color="red" on style="width:130px;padding:14px 8px;text-align:center">Coolant low</div>
  <div d-lamp="annunciator" color="amber" on style="width:130px;padding:14px 8px;text-align:center">Door ajar</div>
</d-device>
```

### `[d-lamp~="bulb"]`

A glass bulb in a hood, seen from the side, which lights what's around it when `on`. From the `sewing` pack.

Import `device-ui/sewing`. Write `<div d-lamp="bulb" on></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| on | Lights it. It warms up and cools down. | off |
| reach, gain | How far its light goes in mm, and how strong it is. | 90, 1.4 |
| material | The lip. | `chrome` |
| d-lamp | The form, then any option words. |  |

```html
<d-device material="japan-black" radius="2" style="display:inline-flex;align-items:center;gap:24px;padding:16px">
  <div d-lamp="bulb" on style="width:192px;height:56px"></div>
</d-device>
```

### `[d-lamp~="halo"]`

A ring of LEDs under a diffuser. `mode` says what it is doing, `level` how much of it is lit.

Import `device-ui/audio`. Write `<div d-lamp="halo">`.

| Attribute | Does | Default |
| --- | --- | --- |
| mode | `idle`, `mute` (red), `pair` (pulsing blue), `vol`, `next` (white sweep). Anything else, as `play`, is cyan and violet running round. `play`, `pair` and `next` animate. | `idle` |
| level | With `mode="vol"`, how far round it's lit, 0 to 1. | 0 |
| d-lamp | The form, then any option words. |  |

### `[d-lamp~="backlight"]`

The light under a board of keys, one element in the device. `level` eases to its brightness, 0 to 1. `mode` is `wave`, `pulse`, `solid` or `off`, and `phase` is how far the colours have run. Paints first, so the keys read it as they paint.

Import `device-ui/keyboard`. Write `<div d-lamp="backlight">`.

| Attribute | Does | Default |
| --- | --- | --- |
| level | Brightness it eases to, 0 to 1. | 0.6 |
| mode | `wave`, `pulse`, `solid` or `off`. | `wave` |
| phase | How far the colours have run. | 0 |
| d-lamp | The form, then any option words. |  |

### `[d-lamp~="arrow"]`

One lit arrow for each way the car can go.

Import `device-ui/appliance`. Write `<div d-lamp="arrow">`.

| Attribute | Does | Default |
| --- | --- | --- |
| on | Boolean. | off |
| down | Boolean. | off |
| d-lamp | The form, then any option words. |  |

## `d-meter`

Something that moves to show a value. The value says which kind, as `d-meter="gauge"`.

Forms: `lightbar`, `gauge`, `panel`, `vu`, `needle`, `bargraph`, `clock`, `compass`, `ring`, `hands`, `timer`, `strip`, `tuner`.

### `[d-meter~="lightbar"]`

A strip of LEDs behind a diffuser. It fills from the left, and can blend between two colours or pulse.

Import `device-ui/controls`. Write `<div d-meter="lightbar">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| value | How far along it is lit, 0 to 1. | 1 |
| color | Colour at the left end. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `white` |
| color2 | Colour at the right end. | same as `color` |
| pulse | Speed of a wave running along it, in cycles per second. Off with reduced motion. | 0 |
| d-meter | The form, then any option words. |  |

```html
<d-device material="ceramic-black" radius="3.5" style="display:inline-block;padding:22px">
  <div d-meter="lightbar" color="cyan" color2="pink" value="0.7" style="width:300px;height:14px"></div>
</d-device>
```

### `[d-meter~="gauge"]`

A round gauge with a needle, printed scale and optional coloured zones. The scale numbers come from the meter.

Import `device-ui/controls`. Write `<div d-meter="gauge">`.
Wraps: `<meter>`.

| Attribute | Does | Default |
| --- | --- | --- |
| ticks | Major divisions. | 10 |
| minor | Steps per major division. | 5 |
| nolabels | Boolean. Leaves off the numbers. | off |
| label | Text printed under the pivot. | none |
| zones | Coloured arcs in meter units, comma-separated: `80-100 red, 40-60 green`. Colours are red, amber, green and blue. | none |
| start, end | Ends of the scale, in degrees clockwise from straight up. | -135, 135 |
| material | Material of the face. | `dial-black` |
| bezel | Material of the rim. | `chrome` |
| flush | Boolean. Sets the bezel in flat and chamfered, in place of the rolled rim. | off |
| needle | How the needle is cut: `bar`, tapering to a narrow tip, `lance` to a point, `spade` with a leaf near its tip, or `baton`, a flat bar. | `bar` |
| min, max, value | On the `<meter>`. The range, and the reading. Change `value` and the part follows. | 0, 1, 0 |
| d-meter | The form, then any option words. |  |

```html
<d-device material="lacquer-black" radius="3.5" style="display:inline-block;padding:14px">
  <div d-meter="gauge" ticks="10" zones="80-100 red" label="Pressure" style="width:200px;height:200px"><meter min="0" max="100" value="62"></meter></div>
</d-device>
```

### `[d-meter~="panel"]`

A panel meter: a moving coil behind a clear square front, its needle swinging through 90 degrees from a pivot low on the face. The scale numbers come from the meter.

Import `device-ui/controls`. Write `<div d-meter="panel">`.
Wraps: `<meter>`.

| Attribute | Does | Default |
| --- | --- | --- |
| ticks | Major divisions. | 5 |
| minor | Steps per major division. | 5 |
| label | The unit, printed over the pivot. | none |
| material | Material of the face. | `dial-cream` |
| min, max, value | On the `<meter>`. The range, and the reading. Change `value` and the part follows. | 0, 1, 0 |
| d-meter | The form, then any option words. |  |

```html
<d-device material="powder-coat" radius="3" style="display:inline-block;padding:14px">
  <div d-meter="panel" label="A" style="width:200px;height:200px"><meter min="0" max="10" value="6.5"></meter></div>
</d-device>
```

### `[d-meter~="vu"]`

A backlit level meter. The needle swings from a pivot hidden below the window. The top of the scale is marked red.

Import `device-ui/controls`. Write `<div d-meter="vu">`.
Wraps: `<meter>`.

| Attribute | Does | Default |
| --- | --- | --- |
| label | Text on the face. | `VU` |
| material | Material of the face. | `dial-cream` |
| dark | Boolean. Turns the warm backlight off. | off |
| min, max, value | On the `<meter>`. The range, and the reading. Change `value` and the part follows. | 0, 1, 0 |
| d-meter | The form, then any option words. |  |

```html
<d-device material="lacquer-black" radius="3" style="display:inline-block;padding:14px">
  <div d-meter="vu" style="width:200px;height:120px"><meter min="0" max="1" value="0.6"></meter></div>
</d-device>
```

### `[d-meter~="needle"]`

A moving-coil needle and nothing else, to swing over a face printed with `d-mark="scale"`, as in a panel meter. It jumps and overshoots.

Import `device-ui/controls`. Write `<div d-meter="needle"><meter></meter></div>`.
Wraps: `<meter>`.

| Attribute | Does | Default |
| --- | --- | --- |
| pivot | Where it turns, as `x y` in mm from the corner of its box. | the middle |
| length | Pivot to tip, in mm. | to the edge of its box |
| hub | How much of that near the pivot is left out, for a hood to hide, in mm. | 0 |
| from, to | Its ends, in degrees clockwise from straight up. | -45, 45 |
| width, height | How wide it is at its foot and how far it stands, in mm. | in proportion, 0.5 |
| color | Its colour, over its material's. |  |
| material | Material of the needle. | `lacquer-black` |
| min, max, value | On the `<meter>`. The range, and the reading. Change `value` and the part follows. | 0, 1, 0 |
| d-meter | The form, then any option words. |  |

```html
<d-device material="dial-white" radius="1.5" style="display:inline-block;padding:14px">
  <div d-meter="needle" pivot="25 28" length="26" style="width:200px;height:112px"><meter min="0" max="1" value="0.6"></meter></div>
</d-device>
```

### `[d-meter~="bargraph"]`

A row of lit segments. Green, then amber above 66%, then red above 86%, unless `color` sets one colour. A tall box fills upward and a wide box fills to the right.

Import `device-ui/controls`. Write `<div d-meter="bargraph">`.
Wraps: `<meter>`.

| Attribute | Does | Default |
| --- | --- | --- |
| segments | Number of segments. | 12 |
| color | One colour for every segment. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | green, amber, red by position |
| from | `end` fills from the far end: down a tall box, leftward along a wide one. | start |
| min, max, value | On the `<meter>`. The range, and the reading. Change `value` and the part follows. | 0, 1, 0 |
| d-meter | The form, then any option words. |  |

```html
<d-device material="lacquer-black" radius="3" style="display:inline-flex;align-items:center;gap:20px;padding:16px">
  <div d-meter="bargraph" style="width:28px;height:150px"><meter min="0" max="1" value="0.7"></meter></div>
  <div d-meter="bargraph" segments="20" color="cyan" style="width:240px;height:26px"><meter min="0" max="1" value="0.7"></meter></div>
</d-device>
```

### `[d-meter~="clock"]`

A wall clock. It follows the computer's clock, or stops at `time` if that is set.

Import `device-ui/controls`. Write `<div d-meter="clock">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| time | Fixed time as `h:m:s` or `h:m`. | the computer's clock |
| material | Material of the face. | `dial-white` |
| bezel | Material of the rim. | `brass` |
| start, end | No effect on this form. | none |
| d-meter | The form, then any option words. |  |

```html
<d-device material="walnut" radius="3.5" style="display:inline-block;padding:14px">
  <div d-meter="clock" style="width:180px;height:180px"></div>
</d-device>
```

### `[d-meter~="compass"]`

A compass card that swings and settles on a heading. Set `value` from a script.

Import `device-ui/controls`. Write `<div d-meter="compass">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| value | Heading in degrees. | 0 |
| start, end | No effect on this form. | none |
| d-meter | The form, then any option words. |  |

```html
<d-device material="walnut" radius="3.5" style="display:inline-block;padding:14px">
  <div d-meter="compass" value="30" style="width:150px;height:150px"></div>
</d-device>
```

### `[d-meter~="ring"]`

A lit ring that closes as the value rises. The rest of the ring shows faintly.

Import `device-ui/controls`. Write `<div d-meter="ring">`.
Wraps: `<meter>`.

| Attribute | Does | Default |
| --- | --- | --- |
| color | Ring colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `green` |
| width | Thickness, mm. | 14% of the radius |
| start, end | Ends of the ring, in degrees clockwise from straight up. | 0, 360 |
| gain | Brightness of the lit part. | 0.12 |
| min, max, value | On the `<meter>`. The range, and the reading. Change `value` and the part follows. | 0, 1, 0 |
| d-meter | The form, then any option words. |  |

```html
<d-device material="ceramic-black" radius="3.5" style="display:inline-flex;align-items:center;gap:22px;padding:18px">
  <div d-meter="ring" color="green" style="width:120px;height:120px"><meter value="0.72"></meter></div>
  <div d-meter="ring" color="red" start="-130" end="130" width="2" style="width:120px;height:120px"><meter value="0.72"></meter></div>
</d-device>
```

### `[d-meter~="hands"]`

The hands of a travel clock, with a sweep second hand and a settable alarm hand. Goes over a `d-mark="scale"`. From the `audio` pack.

Import `device-ui/audio`. Write `<div d-meter="hands"><input type="range"></div>`.
Wraps: input[type=range].
Use: Drag anywhere round the dial to set the alarm hand, or use the arrow keys. The input is minutes, 0 to 720.

| Attribute | Does | Default |
| --- | --- | --- |
| time | Fixed time, as `10:08:30`. Without it, the computer's clock. | none |
| tick | Material of the second hand and centre. | `plastic-yellow` |
| lume | Strip on the hour and minute hands, as a hex colour. | `#c9d6ae` |
| alarm | Tip of the alarm hand, as a hex colour. | `#2f9e3c` |
| material | Material of the hour and minute hands. | `dial-white` |
| d-meter | The form, then any option words. |  |

```html
<d-device material="dial-black" radius="3" style="display:inline-block;padding:14px">
  <div d-meter="hands" style="width:160px;height:160px"><input type="range" min="0" max="720" value="360" aria-label="Alarm"></div>
</d-device>
```

### `[d-meter~="timer"]`

The two hands of an interval timer on one shaft: a sweep hand going round once a minute and a minute hand going round once an hour. Goes over a `d-mark="scale"` and under the knob that turns it. From the `lab` pack.

Import `device-ui/lab`. Write `<div d-meter="timer" value="150">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| value | The time showing, in seconds. Set it from a script, and the hands follow. | 0 |
| material | Material of the hands. | `satin-steel` |
| lume | The material painted on their outer ends. | `lume` |
| reach | How far the minute hand gets, of the box. | 0.97 |
| width, height | The hands at the hub, and how far they stand off the dial, in mm. | 4.2, 5 |
| d-meter | The form, then any option words. |  |

```html
<d-device material="dial-black" radius="3" style="display:inline-block;padding:14px">
  <div d-meter="timer" value="150" style="width:160px;height:160px"></div>
</d-device>
```

### `[d-meter~="strip"]`

A paper tuning scale behind a narrow window, with a needle that follows a value. From the `audio` pack.

Import `device-ui/audio`. Write `<div d-meter="strip">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| value | Where the needle is, 0 to 1. | 0.5 |
| rows | Lines on the scale. | 13 |
| material | Material of the paper. | `keycap-ivory` |
| needle |  | `plastic-red` |
| d-meter | The form, then any option words. |  |
| height | How far it stands, in mm. | 1.6 |

```html
<d-device material="hull-white" radius="3" style="display:inline-block;padding:14px">
  <div d-meter="strip" style="width:100px;height:300px"></div>
</d-device>
```

### `[d-meter~="tuner"]`

A printed tuning scale on black glass, lit from behind while the radio plays.

Import `device-ui/audio`. Write `<div d-meter="tuner">`.

| Attribute | Does | Default |
| --- | --- | --- |
| lit | Boolean. | off |
| d-meter | The form, then any option words. |  |
