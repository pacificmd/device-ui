# Hardware

Everything that holds a device together. None of these take input.

## `d-pen`

The half of a turned pen that twists off: drag up or down across it and it runs off its thread, then slides off what it hides. From the `pocket` pack.

Forms: `barrel`, `clicker`, `cap`, `clip`, `refill`.

### `[d-pen~="barrel"]`

The half of a turned pen that twists off: drag up or down across it and it runs off its thread, then slides off what it hides. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-pen="barrel" profile="3 2, 65 4.8, 76.8 4.8"><input type="range" min="0" max="1" step="0.01" value="0"></div>`.
Wraps: A range input..

| Attribute | Does | Default |
| --- | --- | --- |
| profile | Its section, as stations of `x r` in mm from its left. |  |
| thread, off | How far the thread carries it, and how far off it goes, mm. | 5, 76 |
| sweep, travel | Degrees it turns in all, and mm of drag that takes. | 2520, 65 |
| lay | How its brushing runs, degrees from along it. | 90 |
| material | Material of the steel. | `satin-steel` |
| d-pen | The form, then any option words. |  |

```html
<d-device bare style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-pen="barrel" profile="3 2, 65 4.8, 76.8 4.8" material="brushed-chrome" style="width:308px;height:48px"><input type="range" min="0" max="1" step="0.01" value="0" aria-label="Twist"></div>
</d-device>
```

### `[d-pen~="clicker"]`

The button on the end of a pen, on a push-push cam: press it and it stays in, press it again and it comes back. `aria-pressed` on its button says which. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-pen="clicker" profile="-5 2.75, 9.5 2.75"><button aria-pressed="false"></button></div>`.
Wraps: A button..

| Attribute | Does | Default |
| --- | --- | --- |
| profile | Its section, as stations of `x r` in mm from its left. |  |
| travel | How far it goes to the bottom, mm. | 3.5 |
| of | The barrel it opens with. | none, shut |
| material | Material of the steel. | `satin-steel` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| thread (on the element) |  | 5 |
| off (on the element) |  | 76 |
| lay |  | 90 |
| d-pen | The form, then any option words. |  |

```html
<d-device bare style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-pen="clicker" profile="-5 2.75, 9.5 2.75" material="brushed-chrome" style="width:38px;height:48px"><button aria-label="Tip" aria-pressed="false"></button></div>
</d-device>
```

### `[d-pen~="cap"]`

The half of a pen that holds the clip: a straight tube with its end rolled over, a ring on the end of it and a legend cut round it. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-pen="cap" profile="0 4.8, 40.7 4.8" collar="39.7 3.7, 43.7 3.7"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| profile, collar | Its section and the ring's, as stations of `x r` in mm from its left. |  |
| legend, legend-at, legend-size | What's cut round it, how far along and how high, mm. | none, 2, 1.7 |
| lay | How its brushing runs, degrees from along it. | 90 |
| of | The barrel it opens with. | none, shut |
| material | Material of the steel. | `satin-steel` |
| thread (on the element) |  | 5 |
| off (on the element) |  | 76 |
| ring |  | `chrome` |
| d-pen | The form, then any option words. |  |

```html
<d-device bare style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-pen="cap" profile="0 4.8, 40.7 4.8" collar="39.7 3.7, 43.7 3.7" legend="PARKER" material="brushed-chrome" style="width:175px;height:48px"></div>
</d-device>
```

### `[d-pen~="clip"]`

A pressed spring clip seen from its face: any outline, with a spine down it and feathers cut across it. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-pen="clip" path="..."></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| path | Its outline, in mm on its box. |  |
| feathers | Where its feathers are cut, as `x half` in mm. | none |
| spine | Where the line down it runs, `from to` in mm. | none |
| height | How far it stands, mm. | 6 |
| of | The barrel it opens with. | none, shut |
| material | Material of the metal. | `chrome` |
| thread (on the element) |  | 5 |
| off (on the element) |  | 76 |
| d-pen | The form, then any option words. |  |

```html
<d-device material="satin-steel" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-pen="clip" spine="7 35" path="M0 14L25 7L150 10L150 18L25 21Z" style="width:150px;height:28px"></div>
</d-device>
```

### `[d-pen~="refill"]`

What a pen's barrel hides: a refill, its spring and the thread the barrel runs on. A click pushes it out, and the spring compresses as it does. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-pen="refill" nose="1.6 0.45, 9 1.3, 16 1.3" tube="16 2.9, 113 2.9" spring="6 14 1.9"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| nose, tube | Its section, as stations of `x r` in mm from its left. |  |
| thread | Where the thread is, `x x r` in mm. | none |
| spring | The seat for it, its free length and its radius, mm. | none |
| clicker, travel | The button that pushes it and how far that moves it, mm. | none, 3.5 |
| of | The barrel it opens with. | none, shut |
| off (on the element) |  | 76 |
| material | What it's made of, a name from the materials list. | `satin-steel` |
| tip |  | `brass` |
| d-pen | The form, then any option words. |  |

```html
<d-device bare style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-pen="refill" nose="1.6 0.45, 9 1.3, 16 1.3" tube="16 2.9, 113 2.9" style="width:452px;height:28px"></div>
</d-device>
```

## `d-fixing`

Something that holds parts together. The value says which kind, as `d-fixing="rivet"`.

Forms: `rivet`, `staple`, `corner`, `hinge`, `cap`, `turned`, `crank`, `screw`, `lug`, `ring`, `eyelet`, `socket`.

### `[d-fixing~="rivet"]`

The domed head of a rivet, filling its box. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-fixing="rivet">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the head. | `chrome` |
| height | How far it stands, mm. | 0.5 |
| d-fixing | The form, then any option words. |  |

```html
<d-device material="satin-steel" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-fixing="rivet" style="width:16px;height:16px"></div>
  <div d-fixing="rivet" style="width:16px;height:16px"></div>
</d-device>
```

### `[d-fixing~="staple"]`

The crown of a staple through a stack of card, with the dent it pulls round it. It runs along its box. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-fixing="staple">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the wire. | `satin-steel` |
| height | How far it stands, mm. | 0.28 |
| d-fixing | The form, then any option words. |  |

```html
<d-device material="card-green" radius="1" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-fixing="staple" style="width:30px;height:3px"></div>
</d-device>
```

### `[d-fixing~="corner"]`

A moulded corner on a covered cabinet, as on an amp or a flight case, with a stud through it. From the `audio` pack.

Import `device-ui/audio`. Write `<div d-fixing="corner" at="tl">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the corner. | `gloss-black` |
| at | Which corner of the box is the cabinet's: `tl`, `tr`, `bl` or `br`. | `tl` |
| height | How far it stands, mm. | 5 |
| stud | The material of the stud. | `brass` |
| d-fixing | The form, then any option words. |  |

```html
<d-device material="tolex-black" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-fixing="corner" at="tl" style="width:90px;height:90px"></div>
  <div d-fixing="corner" at="br" style="width:90px;height:90px"></div>
</d-device>
```

### `[d-fixing~="hinge"]`

A long metal hinge, its knuckles along the box, for a panel that folds up. From the `synth` pack.

Import `device-ui/synth`. Write `<div d-fixing="hinge">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the hinge. | `satin-steel` |
| pitch | Mm between knuckles. | 8 |
| d-fixing | The form, then any option words. |  |

```html
<d-device material="plastic-black" radius="1.5" style="display:block;padding:16px">
  <div d-fixing="hinge" style="display:block;width:240px;height:16px"></div>
</d-device>
```

### `[d-fixing~="cap"]`

A round milled cap screwed into a case, with a panel let into its top. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-fixing="cap"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the rim. | `black-oxide` |
| inset | Material of the panel. | the rim |
| teeth | Milling round the edge. | 90 |
| height | Height in mm. | 0.9 |
| d-fixing | The form, then any option words. |  |

```html
<d-device material="vulcanite-black" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <div d-fixing="cap" inset="vulcanite-black" teeth="90" style="width:72px;height:72px"></div>
</d-device>
```

### `[d-fixing~="turned"]`

Something turned on a lathe and stood on an upright axis, seen from the side: a collar, a counter or a stack of rings on the top of a camera. As deep as it is wide, so with `back` it stays round when you look down on it. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-fixing="turned" profile="16 1, 11 1.5"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the whole stack. | `satin-chrome` |
| profile | Each step going up, as diameter and height in mm, comma separated. | the box |
| d-fixing | The form, then any option words. |  |

```html
<d-device material="satin-chrome" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <div d-fixing="turned" profile="16.4 1, 14 0.5, 15.4 1.2, 8 2" style="display:block;width:66px;height:19px"></div>
</d-device>
```

### `[d-fixing~="crank"]`

A rewind crank folded down on its knob: a short drum on a leaning shaft, tipped towards you so its top shows as an ellipse, with the crank across it and its handle in a notch at the rim. The box is the drum's width by all you see of it. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-fixing="crank" tilt="32" wall="4.6"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the drum and the crank. | `satin-chrome` |
| tilt | How far the shaft leans, in degrees. | 0 |
| wall | The height of the drum's side, in mm. | 4 |
| height | How far it stands, in mm. | 6 |
| d-fixing | The form, then any option words. |  |

```html
<d-device material="satin-chrome" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <div d-fixing="crank" tilt="32" wall="4.6" style="display:block;width:70px;height:44px"></div>
</d-device>
```

### `[d-fixing~="screw"]`

A screw head filling its box, in the ISO proportions of the nearest size, its drive at any `angle`.

Import `device-ui/controls`. Write `<div d-fixing="screw"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the head. | `satin-chrome` |
| head | `pan`, `countersunk`, `button` or `cheese`. | `pan` |
| drive | `slot`, `cross`, `hex` or `star`. | `slot` |
| angle | How the drive lies, in degrees. | 20 |
| socket | Boolean. A hex drive, as `drive="hex"`. | off |
| d-fixing | The form, then any option words. |  |

```html
<d-device material="powder-coat" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <div d-fixing="screw" angle="30" style="width:24px;height:24px"></div>
  <div d-fixing="screw" head="countersunk" drive="cross" style="width:24px;height:24px"></div>
  <div d-fixing="screw" head="button" drive="hex" material="black-oxide" style="width:24px;height:24px"></div>
  <div d-fixing="screw" head="cheese" drive="star" style="width:24px;height:24px"></div>
</d-device>
```

### `[d-fixing~="lug"]`

The eyelet a strap goes through, standing off the edge of a case. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-fixing="lug" side="left"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the lug. | `satin-chrome` |
| side | `left` or `right`. | `left` |
| height | Height in mm. | 1.4 |
| d-fixing | The form, then any option words. |  |

```html
<d-device material="satin-chrome" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <div d-fixing="lug" side="left" style="width:32px;height:36px"></div>
</d-device>
```

### `[d-fixing~="ring"]`

A key ring of flat wire, fills its box. From `device-ui/tool`.

Import `device-ui/tool`. Write `<div d-fixing="ring">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the wire. | `satin-steel` |
| height | Mm it stands. | 0.8 |
| from | Start, degrees clockwise from the right. | 0 |
| to | End, degrees clockwise from the right. | 360 |
| d-fixing | The form, then any option words. |  |

```html
<d-device material="plastic-red" radius="3.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-fixing="ring" style="width:48px;height:48px"></div>
</d-device>
```

### `[d-fixing~="eyelet"]`

A flat tab of steel with a hole through it, standing out of whatever it's riveted into. Its hole is at the far end of its box.

Import `device-ui/tool`. Write `<div d-fixing="eyelet">`.

| Attribute | Does | Default |
| --- | --- | --- |
| hole | Hole radius, mm. | 55% of half the box height |
| rotate | Turns the tab, degrees. | 0 |
| material | What it's made of, a name from the materials list. | `satin-steel` |
| height | How far it stands, in mm. | 0.5 |
| d-fixing | The form, then any option words. |  |

### `[d-fixing~="socket"]`

A socket head sunk in a steel collar, as a shell is screwed together from the front.

Import `device-ui/tool`. Write `<div d-fixing="socket">`.

| Attribute | Does | Default |
| --- | --- | --- |
| hole | Hole radius, mm. | 26% of the head's radius |
| material | What it's made of, a name from the materials list. | `aluminium-pale` |
| d-fixing | The form, then any option words. |  |

## `d-clip`

A sprung clip on the back of a thing, filling its box: one sheet standing off the back, pinned across at one end. A press on its button lifts it. From the `pocket` pack.

Forms: `spring`.

### `[d-clip~="spring"]`

A sprung clip on the back of a thing, filling its box: one sheet standing off the back, pinned across at one end. A press on its button lifts it. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-clip="spring"><button></button></div>`.
Wraps: `button`.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the sheet. | `polished-steel` |
| hinge | Which end it is pinned at, `top` or `bottom`. | `top` |
| radius | Its corners, mm. | 1 |
| height | How far it stands, mm. | 2 |
| mark | A path engraved across its middle, in `viewbox`, `mark-size` wide, mm. | none |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| mark-size |  | 6 |
| viewbox | The box `path` is drawn in, as in SVG. | `0 0 24 24` |
| d-clip | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-clip="spring" style="width:80px;height:50px"><button aria-label="Clip"></button></div>
</d-device>
```

## `d-chip`

The gold contacts of a smart card or SIM, filling its box: a plate split by fine channels into pads round a middle. From the `pocket` pack.

Forms: `contacts`, `wafer`.

### `[d-chip~="contacts"]`

The gold contacts of a smart card or SIM, filling its box: a plate split by fine channels into pads round a middle. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-chip="contacts">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the plate. | `gold` |
| height | How far it stands, mm. | 0.1 |
| gap |  | 0.25 |
| radius | Corner radius, in mm. | 1.25 |
| d-chip | The form, then any option words. |  |

```html
<d-device material="film-navy" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-chip="contacts" style="width:52px;height:47px"></div>
</d-device>
```

### `[d-chip~="wafer"]`

The chips on a wafer before it's sawn, as many whole ones as fit a disc as wide as the box and inside the box. Each has memory arrays ruled so fine they split a lamp into its colours, a block of logic and pads round its edge. From the `computer` pack.

Import `device-ui/computer`. Write `<div d-chip="wafer"></div>`.
Wraps: None.
Use: Move over it and the lamp slides the arrays through their colours.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of each chip's oxide. | `thermal-oxide` |
| array | Material of the memory arrays. | `silicon-array` |
| logic | Material of the logic block. | `silicon` |
| pads | Material of the pads. | `aluminium-silver` |
| die | A chip's `w h`, in mm. | 8 |
| street | The gap sawn away between chips, in mm. | 0.2 |
| edge | How far in from the rim they stop, in mm. | 3 |
| d-chip | The form, then any option words. |  |

```html
<d-device material="thermal-oxide" radius="25" style="display:inline-block">
  <div d-chip="wafer" die="5" style="width:200px;height:200px"></div>
</d-device>
```

## `d-match`

A book of paper matches: `tooth` in the comb, `loose` in the hand and `striker` to strike it on. Each piece is a form, as `d-match="tooth"`.

Forms: `striker`, `tooth`, `loose`.

### `[d-match~="striker"]`

A strip of grit glued on, that a match is struck on, and shows it. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-match="striker">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the grit. | `striker` |
| height | How far it stands, mm. | 0.06 |
| struck | Where it's been struck, mm from its top left: x y x y, four numbers to a stroke. Each scrapes it pale. | none |
| d-match | The form, then any option words. |  |

```html
<d-device material="card-green" radius="1" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-match="striker" struck="8 8 34 12" style="width:152px;height:24px"></div>
</d-device>
```

### `[d-match~="tooth"]`

One paper match in a comb, standing where it's stapled at the foot of its box, or the ragged stub left when it's torn out. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-match="tooth">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the stick. | `pulp-coral` |
| head | Material of the head. | `head-tan` |
| torn | How far from the foot it was torn out, mm. | not torn |
| seed | A number that decides how its tear goes. | 1 |
| height | How far it stands, mm. | 0.18 |
| d-match | The form, then any option words. |  |

```html
<d-device material="card-white" radius="1" style="display:inline-flex;align-items:center;gap:14px;padding:0px">
  <div d-match="tooth" style="width:15px;height:140px"></div>
  <div d-match="tooth" seed="4" style="width:15px;height:140px"></div>
  <div d-match="tooth" seed="7" torn="8" style="width:15px;height:140px"></div>
</d-device>
```

### `[d-match~="loose"]`

A paper match out of its comb, head at the top of its box and torn at the foot, that burns down. From the `pocket` pack.

Import `device-ui/pocket`. Write `<div d-match="loose">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the stick. | `pulp-coral` |
| head | Material of the head. | `head-tan` |
| burn | How far it's burnt from the head, 0 to 1. | 0 |
| spent | Its head has gone. | off |
| lit | An ember at the burn. | off |
| seed | A number that decides how its tear goes. | 1 |
| height | How far it stands, mm. | 0.18 |
| d-match | The form, then any option words. |  |

```html
<d-device material="card-white" radius="1" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-match="loose" style="width:15px;height:120px"></div>
  <div d-match="loose" spent burn="0.5" lit style="width:15px;height:120px"></div>
</d-device>
```

## `d-glass`

Something clear you look through. The value says which kind, as `d-glass="smoked"`.

Forms: `flash`, `crystal`, `lens`, `window`, `frosted`, `smoked`, `clear`, `cover`.

### `[d-glass~="flash"]`

A camera flash: a stepped lens over a yellow phosphor, behind a flush window. From the `phone` pack.

Import `device-ui/phone`. Write `<div d-glass="flash">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the lens. | `keycap-ivory` |
| d-glass | The form, then any option words. |  |

```html
<d-device material="frosted-glass" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-glass="flash" style="width:28px;height:28px"></div>
</d-device>
```

### `[d-glass~="flash"][d-glass~="bar"]`

A compact camera's xenon flash: a long window ribbed into a fresnel, over a reflector with the tube lying along it. From the `phone` pack.

Import `device-ui/phone`. Write `<div d-glass="flash bar">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the window. | `keycap-ivory` |
| d-glass | The form, then any option words. |  |

```html
<d-device material="satin-steel" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-glass="flash bar" style="width:70px;height:21px"></div>
</d-device>
```

### `[d-glass~="crystal"]`

A clear round dome over what is under it, such as a dial. Goes after what it covers. From the `audio` pack.

Import `device-ui/audio`. Write `<div d-glass="crystal">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| height | Height of the dome in mm. | 1.4 |
| dome | How far in the curve reaches, 0 to 1 of the radius. | 0.7 |
| curve | How far it tilts at its edge for what it reflects, as a slope. | 0.6 |
| coat | Strength of the shine, 0 to 1. | 0.7 |
| d-glass | The form, then any option words. |  |

```html
<d-device material="dial-black" radius="3" style="display:inline-block;padding:14px">
  <div d-glass="crystal" style="width:160px;height:160px"></div>
</d-device>
```

### `[d-glass~="lens"]`

A camera lens: rings of black metal round a dark well, and two coated elements that each show the room.

Import `device-ui/controls`. Write `<div d-glass="lens">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the outer ring. | `titanium-black` |
| rim | How much of its radius the outer ring takes, 0 to 1. | 0.2 |
| pupil | Size of the coated glass, 0 to 1 of the radius. | 0.62 |
| core | How far the iris is open, 0 to 1 of the glass. It never closes past half. | 0.48 |
| height | How far it stands, in mm. | 2.4 |
| baffles |  | 0 |
| d-glass | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="4" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <div d-glass="lens" style="width:110px;height:110px"></div>
  <div d-glass="lens" material="titanium" style="width:66px;height:66px"></div>
  <div d-glass="lens" material="aluminium-midnight" style="width:40px;height:40px"></div>
</d-device>
```

### `[d-glass~="window"]`

A flat coated window into a body, as on a viewfinder: a pane over whatever is inside it, which shows through as it is, and the room in the colour of its coating.

Import `device-ui/controls`. Write `<div d-glass="window">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| film | The coating, 0 for bare glass. It sets the colour of what the window reflects. | 0.3 |
| coat | How strongly the glass reflects, 0 to 1. | 1 |
| radius | Corner radius, mm. | 1 |
| height | How far it stands over what is inside, mm. | 0.3 |
| material | What it's made of, a name from the materials list. |  |
| d-glass | The form, then any option words. |  |

```html
<d-device material="satin-chrome" radius="3" style="display:inline-flex;align-items:center;gap:16px;padding:18px">
  <d-surface material="finder-glass" height="-0.4" radius="1" bevel="0.25" style="width:120px;height:72px"><div d-glass="window" style="position:absolute;inset:0"></div></d-surface>
</d-device>
```

### `[d-glass~="frosted"]`

A pane laid over what is below it. It paints above other parts, so place it on top with CSS. Frosted glass blurs what is under it.

Import `device-ui/controls`. Write `<div d-glass="frosted">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| tint | Colour of the pane, as `#rrggbb`. | by form |
| height | Height above the panel in mm. | 1.6 |
| radius | Corner radius in mm. | 2.5 |
| blur | Blur in px. | frosted 14, smoked 0, clear 0 |
| opacity | How much the pane covers, 0 to 1. | frosted 0.14, smoked 0.97, clear 0.04 |
| d-glass | The form, then any option words. |  |

```html
<d-device material="aluminium-midnight" radius="4" style="display:block;position:relative;width:320px;height:150px">
  <div d-readout color="cyan" style="position:absolute;left:30px;top:35px;width:260px;height:80px;font:500 72px/80px 'Barlow Semi Condensed',sans-serif;letter-spacing:0;text-align:center">88:88</div>
  <div d-glass="frosted" style="position:absolute;left:12px;top:12px;width:296px;height:126px"></div>
</d-device>
```

### `[d-glass~="smoked"]`

A pane laid over what is below it. It paints above other parts, so place it on top with CSS.

Import `device-ui/controls`. Write `<div d-glass="smoked">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| tint | Colour of the pane. | near black |
| blur | Blur of what is under it, css px. | 0 |
| opacity | How much it hides, 0 to 1. | 0.97 |
| height | How far it stands, in mm. | 1.6 |
| radius | Corner radius, in mm. | 2.5 |
| d-glass | The form, then any option words. |  |

```html
<d-device material="aluminium-midnight" radius="4" style="display:block;position:relative;width:320px;height:150px">
  <div d-readout color="cyan" style="position:absolute;left:30px;top:35px;width:260px;height:80px;font:500 72px/80px 'Barlow Semi Condensed',sans-serif">12:34</div>
  <div d-glass="smoked" style="position:absolute;left:12px;top:12px;width:296px;height:126px"></div>
</d-device>
```

### `[d-glass~="clear"]`

A pane laid over what is below it. It paints above other parts, so place it on top with CSS.

Import `device-ui/controls`. Write `<div d-glass="clear">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| tint | Colour of the pane. | none |
| blur | Blur of what is under it, css px. | 0 |
| opacity | How much it hides, 0 to 1. | 0.04 |
| height | How far it stands, in mm. | 1.6 |
| radius | Corner radius, in mm. | 2.5 |
| d-glass | The form, then any option words. |  |

```html
<d-device material="aluminium-midnight" radius="4" style="display:block;position:relative;width:320px;height:150px">
  <div d-readout color="cyan" style="position:absolute;left:30px;top:35px;width:260px;height:80px;font:500 72px/80px 'Barlow Semi Condensed',sans-serif">12:34</div>
  <div d-glass="clear" style="position:absolute;left:12px;top:12px;width:296px;height:126px"></div>
</d-device>
```

### `[d-glass~="cover"]`

A crystal over everything so far, the shape of its box, with a magnifier on it if asked. The lens enlarges what really lies under it. Goes last. From the `watch` pack.

Import `device-ui/watch`. Write `<div d-glass="cover"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| flat | Boolean. A flat sapphire, not a dome. | off |
| square | As for `d-watch="bezel"`. | 2 |
| coat | How much it shines, less if it is bloomed. | 1 |
| lens | A magnifier, as `x y w h` in mm from the middle. | none |
| zoom | How strong the lens is. | 2.5 |
| path | An SVG path for its outline, in `viewbox` units. |  |
| viewbox | The box `path` is drawn in, as in SVG. |  |
| chamfer |  | `0 0` |
| material | What it's made of, a name from the materials list. | `mineral-glass` |
| d-glass | The form, then any option words. |  |

```html
<d-device material="dial-lacquer" radius="14.5" style="position:relative;width:116px;height:116px;display:block">
  <div d-watch="dial" material="dial-lacquer" date="3" style="position:absolute;inset:0"></div>
  <div d-glass="cover" coat="0.3" lens="7 0 7 5" style="position:absolute;inset:0"></div>
</d-device>
```

## `d-port`

Somewhere a cable or card goes in. The value says which kind, as `d-port="usbc"`.

Forms: `binding`, `banana`, `header`, `disk`, `cartridge`, `usbc`, `usba`, `hdmi`, `jack`, `sd`, `modular`, `edge`, `bnc`.

### `[d-port~="binding"]`

A binding post from above: a knurled head on a stem, screwed down on a wire.

Import `device-ui/lab`. Write `<div d-port="binding">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the post. | `brass` |
| height | How far the stem stands, mm. | 14 |
| d-port | The form, then any option words. |  |

```html
<d-device material="gloss-black" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-port="binding" style="width:40px;height:40px"></div>
</d-device>
```

### `[d-port~="banana"]`

A shrouded 4mm socket, as a meter's leads go in: a black collar standing proud, and in it a coloured insert round a deep hole with a brass contact down it.

Import `device-ui/lab`. Write `<div d-port="banana">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the insert. | `plastic-red` |
| d-port | The form, then any option words. |  |

```html
<d-device material="shell-slate" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-port="banana" style="width:54px;height:54px"></div><div d-port="banana" material="plastic-black" style="width:54px;height:54px"></div>
</d-device>
```

### `[d-port~="header"]`

A row of socket pins, as on the edge of a dev board: square holes on a 2.54mm pitch, as many as fit its long side.

Import `device-ui/controls`. Write `<div d-port="header">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| hole | Width of each hole, mm. | 1 |
| d-port | The form, then any option words. |  |

```html
<d-device material="plastic-black" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-port="header" style="width:122px;height:16px"></div>
</d-device>
```

### `[d-port~="disk"]`

The mouth of a floppy drive, filling its box: a stepped shallow recess, a pale door at the thumb end, the slit through both and a pinhole beside it. From `device-ui/computer`.

Import `device-ui/computer`. Write `<div d-port="disk">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the walls. | what it sits on |
| d-port | The form, then any option words. |  |

```html
<d-device material="shell-beige" radius="3.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-port="disk" style="width:436px;height:84px"></div>
</d-device>
```

### `[d-port~="cartridge"]`

The mouth of a cartridge slot, filling its box: a square-cut step in the case with a slit along its floor. From `device-ui/computer`.

Import `device-ui/computer`. Write `<div d-port="cartridge">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the walls. | what it sits on |
| d-port | The form, then any option words. |  |

```html
<d-device material="paint-panel-umber" radius="3.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-port="cartridge" style="width:228px;height:52px"></div>
</d-device>
```

### `[d-port~="usbc"]`

A socket on the side of something. It draws only: nothing plugs in.

Import `device-ui/controls`. Write `<div d-port="usbc">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | What it's made of, a name from the materials list. | `brushed-steel` |
| plug |  | `plastic-black` |
| nut | Boolean. | off |
| d-port | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:20px">
  <div d-port="usbc" style="width:36px;height:13px"></div>
  <div d-port="usba" style="width:54px;height:20px"></div>
  <div d-port="hdmi" style="width:58px;height:20px"></div>
  <div d-port="jack" style="width:22px;height:22px"></div>
  <div d-port="sd" style="width:60px;height:10px"></div>
</d-device>
```

### `[d-port~="usba"]`

A socket on the side of something. It draws only: nothing plugs in.

Import `device-ui/controls`. Write `<div d-port="usba">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | What it's made of, a name from the materials list. | `brushed-steel` |
| plug |  | `plastic-black` |
| nut | Boolean. | off |
| d-port | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:20px">
  <div d-port="usba" style="width:54px;height:20px"></div>
</d-device>
```

### `[d-port~="hdmi"]`

A socket on the side of something. It draws only: nothing plugs in.

Import `device-ui/controls`. Write `<div d-port="hdmi">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | What it's made of, a name from the materials list. | `brushed-steel` |
| plug |  | `plastic-black` |
| nut | Boolean. | off |
| d-port | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:20px">
  <div d-port="hdmi" style="width:58px;height:20px"></div>
</d-device>
```

### `[d-port~="jack"]`

A socket on the side of something. `nut` holds it to a panel, and `plug` shows a lead in it. Wrap a checkbox for the plug to come and go.

Import `device-ui/controls`. Write `<div d-port="jack">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | What it's made of, a name from the materials list. | `brushed-steel` |
| plug |  | `plastic-black` |
| nut | Boolean. | off |
| d-port | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:20px">
  <div d-port="jack" style="width:22px;height:22px"></div>
</d-device>
```

### `[d-port~="sd"]`

A socket on the side of something. It draws only: nothing plugs in.

Import `device-ui/controls`. Write `<div d-port="sd">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | What it's made of, a name from the materials list. | `brushed-steel` |
| plug |  | `plastic-black` |
| nut | Boolean. | off |
| d-port | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:20px">
  <div d-port="sd" style="width:60px;height:10px"></div>
</d-device>
```

### `[d-port~="modular"]`

A socket on the side of something. It draws only: nothing plugs in.

Import `device-ui/controls`. Write `<div d-port="modular">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | What it's made of, a name from the materials list. | `brushed-steel` |
| plug |  | `plastic-black` |
| nut | Boolean. | off |
| d-port | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:20px">
  <div d-port="modular" style="width:44px;height:36px"></div>
</d-device>
```

### `[d-port~="edge"]`

A port seen from above, cut into the very edge of the case.

Import `device-ui/keyboard`. Write `<div d-port="edge">`.

| Attribute | Does | Default |
| --- | --- | --- |
| d-port | The form, then any option words. |  |

### `[d-port~="bnc"]`

A panel-mounted BNC socket. The checkbox says whether a cable is plugged in.

Import `device-ui/lab`. Write `<div d-port="bnc">`.

| Attribute | Does | Default |
| --- | --- | --- |
| d-port | The form, then any option words. |  |

## `d-pendulum`

A rod swinging on a pin below it, kept going by a wound spring, with a weight clipped to it that sets how fast. Click the rod to set it going or catch it, and drag the weight between the marks. Each beat is heard in the case round it. Put what hides its foot after it.

### `[d-pendulum]`

A rod swinging on a pin below it, kept going by a wound spring, with a weight clipped to it that sets how fast. Click the rod to set it going or catch it, and drag the weight between the marks. Each beat is heard in the case round it. Put what hides its foot after it.

Import `device-ui/clockwork`. Write `<div d-pendulum marks="60:20,120:60"><input type="range"><input type="checkbox"></div>`.
Wraps: A range, for the mark the weight is on, and a checkbox, for whether it is going.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the rod. | `polished-steel` |
| weight | What the weight is made of. | `satin-steel` |
| marks | Beats a minute and mm down the box for each mark, top first. They need not be even. | `60:10,120:20` |
| x, pivot | Where the pin is in the box, mm. | the middle of its bottom edge |
| reach | The length of the rod, mm. | up to the box's top |
| swing | Degrees it goes each way. | 26 |
| wound | Seconds of spring left, counted down as it goes. Without it, it never runs down. | none |
| height | How far the rod stands off what it is on, mm. | 10 |
| d-pendulum | The form, then any option words. |  |

```html
<d-device material="gloss-black" radius="2" style="padding:20px" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-pendulum marks="60:40,90:120,120:200" style="width:300px;height:320px"><input type="range" min="0" max="2" step="1" value="1" aria-label="Weight"><input type="checkbox" aria-label="Going"></div>
</d-device>
```

## `d-telegraph`

A telegraph key: the frame it stands in, the lever and knob, and the circuit closer. Each piece is a form, as `d-telegraph="lever"`.

Forms: `frame`, `lever`, `short`.

### `[d-telegraph~="frame"]`

What a telegraph key stands in: a brass plate with its middle out, two posts, the leaf carrying the fixed contact, and the trunnion screws either side. The box is the plate.

Import `device-ui/office`. Write `<div d-telegraph="frame">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the plate. | `brass` |
| axis | How far the trunnion is from the middle of the plate, mm. | 6 |
| d-telegraph | The form, then any option words. |  |

```html
<d-device material="gloss-black" radius="2" style="padding:50px 60px" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-telegraph="frame" style="width:216px;height:144px"></div>
</d-device>
```

### `[d-telegraph~="lever"]`

A telegraph key's lever and knob, which rocks on the trunnion and comes back on its spring. The box is the knob, and the lever runs off it to the right.

Import `device-ui/office`. Write `<button d-telegraph="lever">`.
Wraps: Itself, a button.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the knob. | `gloss-black` |
| arm | What the lever is made of. | `brass` |
| reach | How far the axis is from the middle of the knob, mm. | 68 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| d-telegraph | The form, then any option words. |  |

```html
<d-device material="gloss-black" radius="2" style="padding:60px 400px 60px 20px" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <button d-telegraph="lever" aria-label="Key" style="width:100px;height:100px"></button>
</d-device>
```

### `[d-telegraph~="short"]`

A telegraph key's circuit closer: a curved brass strip on a pin with a ball on its end, thrown across to hold the line closed. The box runs from the ball at its bottom left to just past the pin at its top right.

Import `device-ui/office`. Write `<div d-telegraph="short"><button></button></div>`.
Wraps: A button.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the strip. | `brass` |
| ball | What the ball is made of. | `gloss-black` |
| throw | How far it swings, degrees. | 11 |
| open | Boolean. | off |
| d-telegraph | The form, then any option words. |  |

```html
<d-device material="gloss-black" radius="2" style="padding:30px" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-telegraph="short" style="width:256px;height:164px"><button aria-label="Circuit closer"></button></div>
</d-device>
```

## `d-cell`

A round battery lying on its side: a steel can in a printed sleeve, with the nub on its plus end. Its box is the whole cell, nub included. An AA is 14.5 by 50.5mm.

Forms: `cylinder`.

### `[d-cell~="cylinder"]`

A round battery lying on its side: a steel can in a printed sleeve, with the nub on its plus end. Its box is the whole cell, nub included. An AA is 14.5 by 50.5mm.

Import `device-ui/controls`. Write `<div d-cell="cylinder">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| plus | Which end the nub is on: `up`, `down`, `left` or `right`. | `up` standing, `right` lying |
| material | Material of the sleeve. | `gloss-black` |
| d-cell | The form, then any option words. |  |

```html
<d-device material="shell-grey" radius="2" style="display:inline-flex;align-items:center;gap:14px;padding:12px">
  <div d-cell="cylinder" plus="up" style="width:58px;height:202px"></div>
  <div d-cell="cylinder" plus="down" style="width:58px;height:202px"></div>
</d-device>
```

## `d-mark`

Something put on a surface to be read. The value says which kind, as `d-mark="plate"`.

Forms: `label`, `plate`, `dymo`, `symbol`, `stamp`, `scale`, `ring`, `print`, `sticker`.

### `[d-mark~="label"]`

Lettering on the panel, engraved, or flat ink with `d-mark="label flat"`. The ink is the legend colour of the `d-surface` it sits on, or else the device.

Import `device-ui/controls`. Write `<span d-mark="label">`.
Wraps: None. The text inside is the label..

| Attribute | Does | Default |
| --- | --- | --- |
| ink | Colour of the text. | the legend colour of what it's on |
| material (on the d-surface) | What it's made of, a name from the materials list. |  |
| d-mark | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="brushed-steel" radius="2.5" style="display:inline-flex;align-items:center;gap:24px;padding:18px;font-size:15px">
  <span d-mark="label">Engraved</span>
  <span d-mark="label flat">Printed</span>
</d-device>
```

### `[d-mark~="plate"]`

A metal nameplate with the text stamped into it. Size it with padding.

Import `device-ui/controls`. Write `<div d-mark="plate">`.
Wraps: None. The text inside is the legend..

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the plate. | `brass` |
| rivets | Boolean. A rivet at each end, 8px in. Leave padding for them. | off |
| d-mark | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="anodised-graphite" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-mark="plate" material="brass" rivets style="padding:8px 24px">Model 7</div>
  <div d-mark="plate" material="chrome" style="padding:8px 18px">Serial 4412</div>
</d-device>
```

### `[d-mark~="dymo"]`

Punched label tape: raised white letters on coloured plastic.

Import `device-ui/controls`. Write `<div d-mark="dymo">`.
Wraps: None. The text inside is the legend..

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the tape: `dymo-black`, `dymo-red` or `dymo-blue`. | `dymo-black` |
| d-mark | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="enamel-cream" radius="2.5" style="display:inline-flex;align-items:center;gap:14px;padding:18px">
  <div d-mark="dymo" style="padding:6px 12px">Do not touch</div>
  <div d-mark="dymo" material="dymo-red" style="padding:6px 12px">Fuse 3A</div>
</d-device>
```

### `[d-mark~="symbol"]`

A symbol from the icon set, printed on what it is on, as test gear and circuits have: `ac`, `dc`, `ohm`, `diode`, `continuity`, `capacitor`, `resistor`, `ground`, `fuse`, `warning` and the rest.

Import `device-ui/controls`. Write `<div d-mark="symbol" icon="diode">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| icon | Which one. | none |
| weight | Its stroke, on the icon's 24 unit grid. | 2 |
| color | Ink, as a hex colour. | legend colour for the surface |
| material (on the d-surface) | What it's made of, a name from the materials list. |  |
| d-mark | The form, then any option words. |  |

```html
<d-device material="anodised-graphite" radius="1.5" style="display:inline-flex;align-items:center;gap:14px;padding:14px">
  <div d-mark="symbol" icon="ac" style="width:32px;height:32px"></div>
  <div d-mark="symbol" icon="ohm" style="width:32px;height:32px"></div>
  <div d-mark="symbol" icon="diode" style="width:32px;height:32px"></div>
  <div d-mark="symbol" icon="warning" color="#e8ad1c" style="width:32px;height:32px"></div>
</d-device>
```

### `[d-mark~="stamp"]`

What a die stamps: words, or an image, in foil on whatever is under it. What is see-through in an image stays off it, so any picture with a clear background can be foil.

Import `device-ui/controls`. Write `<img d-mark="stamp" src="die.svg" alt="">`.
Wraps: `img`, or none, and the text inside is what gets pressed..

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the foil. | `foil-gold` |
| d-mark | The form, then any option words. |  |
| fit | Boolean. | off |

```html
<d-device material="bookcloth-bottle" radius="1.5" style="display:inline-flex;align-items:center;gap:18px;padding:18px">
  <span d-mark="stamp" style="font:600 28px Georgia,serif">Gold</span>
  <span d-mark="stamp" material="foil-silver" style="font:600 28px Georgia,serif">Silver</span>
</d-device>
```

### `[d-mark~="scale"]`

A scale printed round a centre: numbers, ticks or both. `d-mark="scale straight"` runs along its box instead, down one that is taller than it is wide, as a radio dial or ruler does: `labels` is then `mm:text` from its start, `marks` a list of mm for ticks with no words, `tick-at` and `text-at` how far across its box they start, `tick-width` the tick, and `legend` the size of the words, all in mm.

Import `device-ui/controls`. Write `<div d-mark="scale">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| labels | Comma list of `angle:text`, degrees clockwise from the top. | none |
| radius | Radius of the labels in mm. | 2 in from the edge |
| size | Letter height, mm. | 3 |
| weight | Font weight. | 500 |
| upright | Labels stay level and don't turn with their angle. | off |
| ticks | Even divisions marked at the edge of the box. | 0 |
| dots | A list of degrees clockwise from the top, with a printed dot at each, as a stepped switch has. | none |
| dot-radius, dot-size | How far out the dots sit and how wide they are, in mm. | the edge of the box, 1 |
| major | Every this many ticks is a long one. | 5 |
| sweep | Degrees each side of the top the ticks cover. | all the way round |
| tick-radius, tick-length | Where the ticks start, and how long the long ones are, in mm. | the edge of the box |
| tick-width | How wide the long ticks are, in mm. | worked out from the box |
| minor-radius, minor-length, minor-width | Where the short ticks end, how long and how wide they are, in mm, for dots of their own. `major="0"` makes every tick short. | in line with the long ones |
| color | Ink, as a hex colour. | legend colour for the surface |
| d-key | The form, then any option words. |  |
| tick-at |  | 0 |
| legend |  | 2.2 |
| text-at |  |  |
| marks |  |  |
| material (on the d-surface) | What it's made of, a name from the materials list. |  |
| inward | Boolean. | off |
| d-mark | The form, then any option words. |  |

```html
<d-device material="plastic-white" radius="3" style="display:inline-block;padding:14px">
  <div d-mark="scale" labels="0:12,90:3,180:6,270:9" upright ticks="60" radius="14" size="4" style="width:160px;height:160px"></div>
</d-device>
```

### `[d-mark~="ring"]`

Lettering engraved round a circle, in the colour that shows on what it sits on. From the `camera` pack.

Import `device-ui/camera`. Write `<div d-mark="ring" text="50mm"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| text | What it says. | none |
| start | Where it starts, in degrees. | 0 |
| radius | Radius in mm. | 2 in from its box |
| size | Letter height, mm. | 2.25 |
| spread | Letter spacing, as a multiple. | 1.15 |
| at | Centres it on this many degrees, in place of `start`. | none |
| under | Reads along the bottom of the circle, with its tops to the middle. | off |
| height | How far the letters stand, cast, in mm. Without it they're engraved. | none |
| material (on the d-surface) | What it's made of, a name from the materials list. |  |
| d-mark | The form, then any option words. |  |

```html
<d-device material="black-oxide" radius="15" style="display:inline-block;padding:0">
  <div d-mark="ring" text="LENS 1:2/50" radius="11" size="2.25" style="width:120px;height:120px"></div>
</d-device>
```

### `[d-mark~="print"]`

A graphic put on a thing the way a factory would. Pass your own text, or `path` and `viewbox`, and pick the process: the mark stays the same and how it sits on the surface changes. `pad` is a thin ink that lets the surface through, as on a plastic case. `offset` is how a label is printed on paper or card, at the full colour of the ink. No logos are included.

Import `device-ui/print`. Write `<div d-mark="print silk">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| color | Ink, as `#rrggbb`. `pad`, `offset` and `silk`. | the legend colour of what it's on |
| material | What the mark is made of. `mould` and `foil`. | what it's on, or `foil-gold` for foil |
| depth | In mm. Positive sinks, negative raises. | set by `kind` |
| wear | How worn, 0 to 1. Each process wears at its own rate. | the device's |
| rotate | Degrees. | 0 |
| path | SVG path data, drawn as well as any text. | none |
| viewbox | Four numbers for `path`, with spaces or commas. | none |
| rule | `evenodd` for a path with holes in it. | nonzero |
| die | Set the text in a card embosser's steel characters, as tall as the box. `mirror` is the same line seen from behind. | none |
| pitch | With `die`, mm from one character to the next. | the box's height |
| crown (on the d-surface) | Read from the surface it sits on. The higher on the crown, the more it rubs: exposure is 0.25 + 0.75 × height. | none |
| d-mark | The form, then any option words. |  |
| reach |  | 0 |
| hold |  | 0 |
| stop |  |  |
| fit | Boolean. | off |

```html
<d-device material="soft-touch-grey" radius="2.5" style="display:inline-flex;align-items:center;gap:20px;padding:20px;font:700 15px sans-serif">
  <div d-mark="print pad" color="#f1efe8">Pad</div>
  <div d-mark="print offset" color="#c23b2b">Offset</div>
  <div d-mark="print silk" color="#f1efe8">Silk</div>
  <div d-mark="print etch">Etch</div>
  <div d-mark="print mould">Mould</div>
  <div d-mark="print foil">Foil</div>
  <div d-mark="print emboss">Emboss</div>
  <div d-mark="print silk" color="#f1efe8" path="M50 4L62 37L97 38L69 59L79 93L50 73L21 93L31 59L3 38L38 37Z" viewbox="0 0 100 100"></div>
</d-device>
```

### `[d-mark~="sticker"]`

A thin sheet stuck on, with an edge you can see and a shadow under any corner that has come away. Text inside prints on it, and so does a nested `d-mark="print"`. `path` die-cuts it to a shape.

Import `device-ui/print`. Write `<div d-mark="sticker" lift="0.5">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the sheet. | `sticker-paper` |
| color | Colour of its text, as `#rrggbb`. | the legend colour of the sheet |
| lift | How far a corner has peeled, 0 to 1. Plain rectangles only. | 0 |
| corner | Which corner lifts: `tl`, `tr`, `br` or `bl`. | `tr` |
| wear | How worn, 0 to 1. | the device's |
| rotate | Degrees. | 0 |
| radius | Corner radius in mm. | 0.75 |
| path | SVG path data that die-cuts the sheet. | none |
| viewbox | Four numbers for `path`, with spaces or commas. | none |
| rule | `evenodd` makes a path's inner shapes holes. |  |
| reach |  | 0 |
| border |  | 0 |
| rim |  | 0 |
| d-mark | The form, then any option words. |  |
| die |  |  |
| pitch |  |  |
| fit | Boolean. | off |

```html
<d-device material="plastic-black" radius="2.5" style="display:inline-flex;align-items:center;gap:22px;padding:22px;font:600 13px sans-serif">
  <div d-mark="sticker">Paper</div>
  <div d-mark="sticker" material="sticker-vinyl" lift="0.6" rotate="-4">Vinyl</div>
</d-device>
```

## `d-library`

Books and what holds them. Each piece is a form, as `d-library="shelf wall"` and `d-library="book spine"`.

Forms: `shelf`, `book`.

### `[d-library~="shelf"]`

Boards under whatever stands in it, one to a line, however the page wraps it. It takes the width of what holds it and needs no styles, so it works on a plain page, on its own, with no device. From the `library` pack.

Import `device-ui/library`. Write `<div d-library="shelf wall">`.
Wraps: Whatever stands on it. It lays them out as a wrapping flex row..

| Attribute | Does | Default |
| --- | --- | --- |
| d-library | `shelf case` for a bookcase with a top, two sides, a bottom and empty boards down to it. `shelf wall` for boards alone. | `shelf case` |
| material | Material of the boards. | the device |
| board | How thick a board is, mm. | 20 |
| side | How wide the sides of a case are, mm. | 18 |
| height | How far the boards stand off the back, mm. | 14 |

```html
<div d-library="shelf wall" material="oak" scale="0.5">
  <a d-library="book spine" href="#" material="bookcloth-oxblood" style="width:140px;height:560px">Dracula</a>
  <a d-library="book spine" href="#" material="bookcloth-moss" style="width:110px;height:520px">Walden</a>
  <a d-library="book spine" href="#" material="bookcloth-bone" foil="foil-black" style="width:120px;height:540px">Emma</a>
</div>
```

### `[d-library~="book"]`

A hardback, filling its box. `spine` stands with its back out and the text inside up it. `face` shows its cover, with whatever is stamped on it nested inside. It draws out toward you under a hand. It works in a `d-library="shelf"`, in a device or alone in a page of text. From the `library` pack.

Import `device-ui/library`. Write `<a d-library="book spine" href="#">`.
Wraps: Any element. Use `a` or `button` to open something..
Use: Rest a hand on it and it comes out a little. Hold it and it comes further. Whatever holds it opens it, as with any link or button.

| Attribute | Does | Default |
| --- | --- | --- |
| d-library | `book spine` or `book face`. | `book face` |
| material | Material of the cloth. | `bookcloth-oxblood` |
| foil | Material of what a spine has stamped on it. Use `foil-black` on pale cloth. | `foil-gold` |
| height | How far it stands, mm. | 11 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |

```html
<a d-library="book face" href="#" material="bookcloth-ink" style="width:200px;height:300px;font:600 26px Georgia,serif">
  <span d-mark="stamp" style="position:absolute;left:44px;top:60px;width:130px;text-align:center">A Title</span>
</a>
```

## `d-opening`

A hole for air or sound. The value says which kind, as `d-opening="grille"`.

Forms: `grille`, `cone`, `vent`, `speaker`.

### `[d-opening~="grille"]`

A field of round holes for a speaker or air.

Import `device-ui/controls`. Write `<div d-opening="grille">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| pitch | Distance between holes, mm. | 2 |
| hole | Hole radius, mm. | 0.6 |
| square | Straight rows and columns, with a hole on the middle, in place of staggered rows. | off |
| round | Boolean. | off |
| d-opening | The form, then any option words. |  |

```html
<d-device material="brushed-steel" radius="2.5" style="display:inline-flex;flex-direction:column;gap:12px;padding:16px">
  <div d-opening="grille" style="width:200px;height:50px"></div>
  <div d-opening="grille" pitch="3" hole="1" style="width:200px;height:50px"></div>
</d-device>
```

### `[d-opening~="cone"]`

A speaker cone. `level` pushes it out. Set it from a script. From the `audio` pack.

Import `device-ui/audio`. Write `<div d-opening="cone">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| level | How far out the cone sits, 0 to 1. | 0 |
| d-opening | The form, then any option words. |  |

```html
<d-device material="fabric-charcoal" radius="3" style="display:inline-block;padding:14px">
  <div d-opening="cone" style="width:150px;height:150px"></div>
</d-device>
```

### `[d-opening~="vent"]`

Slots milled in a row, for air or sound. The row runs along the longer side of the box.

Import `device-ui/controls`. Write `<div d-opening="vent">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| pitch | Distance between slots, mm. | 2 |
| slot | Width of each slot, mm. | 45% of `pitch` |
| rotate | Degrees. Turns the row about its middle. | 0 |
| wall | How far a chamfer runs out round each slot, mm. | 0 |
| recess | Moulds each slot as a crisp stadium this wide, mm, in the surface's own stuff, with a slit `slot` wide along one side of a sloping floor. | 0 |
| deep | With `recess`: how deep the floor is at the slit, mm. A third of that at the far side. | 0.8 |
| run | With `recess`: how far along the slit runs, 0 to 1. | 1 |
| blind | With `recess`: how many at the start of the row have no slit. | 0 |
| rows | Boolean. | off |
| d-opening | The form, then any option words. |  |

```html
<d-device material="aluminium-silver" radius="3" style="display:inline-flex;align-items:center;gap:22px;padding:18px">
  <div d-opening="vent" style="width:180px;height:30px"></div>
  <div d-opening="vent" pitch="2.5" style="width:70px;height:70px"></div>
  <div d-opening="vent" pitch="5" recess="2.25" slot="0.5" deep="1.8" run="0.76" blind="1" style="width:90px;height:60px"></div>
</d-device>
```

### `[d-opening~="speaker"]`

A pressed speaker disc: a whole circle of holes, which d-opening="grille" cannot do.

Import `device-ui/audio`. Write `<div d-opening="speaker">`.

| Attribute | Does | Default |
| --- | --- | --- |
| d-opening | The form, then any option words. |  |

## `d-seam`

A thin groove, where two panels would meet. It comes 2px tall. Give it a width, and change the height with CSS for a vertical one.

### `[d-seam]`

A thin groove, where two panels would meet. It comes 2px tall. Give it a width, and change the height with CSS for a vertical one.

Import `device-ui/controls`. Write `<div d-seam>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| d-seam | Presence only. The value is not read. | none |

```html
<d-device material="hull-white" radius="2.5" style="display:inline-flex;flex-direction:column;gap:16px;padding:20px 22px">
  <span d-mark="label">Upper</span>
  <div d-seam style="width:220px"></div>
  <span d-mark="label">Lower</span>
</d-device>
```

## `d-set`

Parts that belong together, out on a page with no device round them. It draws nothing, and they share one canvas however many there are.

### `d-set`

Parts that belong together, out on a page with no device round them. It draws nothing, and they share one canvas however many there are.

Comes with `device-ui`. Write `<d-set>`.
Wraps: Any parts.

```html
<div style="padding:12px 20px"><d-set><button d-key="tab" style="width:72px;height:40px;font-size:14px">One</button><button d-key="tab" style="width:72px;height:40px;font-size:14px">Two</button></d-set></div>
```

## `d-device`

Four screws, one in each corner of the device, at real sizes, their heads 1.25mm clear of the corner. Each drive sits at its own angle.

### `d-device[screws]`

Four screws, one in each corner of the device, at real sizes, their heads 1.25mm clear of the corner. Each drive sits at its own angle.

Import `device-ui/controls`. Write `<d-device screws>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| screws | On the `d-device`: a head (`pan`, `countersunk`, `button`, `cheese`), a drive (`slot`, `cross`, `hex`, `star`) and a size (`M2`, `M3`, `M4`), in any order. Bare, it's slotted M2 pan heads. Leave room for them with padding. | off |

```html
<d-device material="brushed-aluminium" screws radius="3" style="display:inline-block;padding:44px 66px;font-size:14px">
  <span d-mark="label">Access panel</span>
</d-device>
```

### `d-device`

The body everything else sits on, and the element that draws them. Parts outside a device stay plain HTML.

Comes with `device-ui`. Write `<d-device>`.
Wraps: None. Its children are ordinary DOM, so lay them out with CSS..

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the body. | `plain` |
| radius | Corner radius in mm. | 2.5 |
| path | An SVG path for the outline, for a body that is not a rectangle. Fitted to the box, and `radius` is ignored. | none |
| viewbox | The coordinates of `path`. | `0 0 100 100` |
| age | 0 is new, 1 is thirty years in a shed. Brings patina, grime and rubbed spots. | from `condition`: 0, 0, 0.1, 0.3, 0.7 |
| wear | Chipped edges and scratches, 0 to 1. | the larger of `condition` and 60% of `age` |
| seed | A number. The same seed gives the same marks. | order on the page |
| fill | Boolean. For an app rather than an object: it takes the size of what holds it, and casts nothing outside it. | off |
| scale | `fit` shrinks it whole to fit what holds it, `fit 2` also lets it grow to twice its size, and a number such as `0.3` keeps that scale at every width. The same on a loose part. | none |
| screws | Boolean. See `<d-device screws>` under Hardware. | off |
| keycap | Default cap for the keys on it, any form that has a keycap. | each part's own |
| backlight | Default light for `d-key="chiclet"`, `d-key="mech"` and the legends on `d-key="tab"`. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | unlit |
| debug | Shows one channel: `albedo`, `height`, `normal`, `roughness`, `metal`, `emissive` or `occlusion`. | off |
| split | With `debug`, shows the channel only past this point, 0 to 1 across the device, and the finished object before it. | off |
| condition | `mint`, `new`, `used`, `worn` or `abused`. Sets defaults for `age`, `wear` and the marks below. Unknown names act as `new`. Any you set wins. | `new` |
| prints | Fingerprints and smears, 0 to 1. | from `condition`: 0, 0.14, 0.42, 0.7, 1 |
| dust | Dust and fibres, 0 to 1. | from `condition`: 0, 0.14, 0.35, 0.6, 0.9 |
| scuff | Hairline scratches, 0 to 1. | from `condition`: 0, 0.12, 0.42, 0.75, 1 |
| haze | Slow changes in smoothness, 0 to 1. | from `condition`: 0, 0.35, 0.6, 0.8, 1 |
| grime | Dirt in recesses and runs below fixings, 0 to 1. | the larger of `condition` and `age` |
| dents | Shallow knocks that bend reflections, 0 to 1. | from `condition`: 0, 0, 0.1, 0.35, 0.75 |
| fade | Colour lost to sunlight, 0 to 1. | the larger of `condition` and half of `age` |
| angle | How it is set in a room with depth: degrees about its upright, then across it, as `rotateY` and `rotateX` would turn it, 75 at most. It is turned for you, and lit and seen as set: the lamp stays where it is in the room, and its sides show as far as its relief can. Off to one side of the eye in a `perspective`, it is seen from that side even unturned. | 0 0 |
| lean | Degrees the viewer moves as a hand crosses it, 0 to 8. A part sits off its box by its height over the face times the tangent, and what leans is seen down a long lens, so a body with real `height` shows its sides. While it moves the device gives up its fast lamp. | 0 |
| bevel | How wide the body's edge rolls over, in mm. Set it on a deep body, or its edge grows with its height. | 1.5 times its height |
| shadow | How tall a shadow the body throws on the page, in mm, so a deep body needn't throw a long one. Parts on it still throw theirs. | its height |
| roll | Turns a rigid body at its ends: `rx ry ix iy fall` in mm. Radius at left and right, radius at top and bottom (the first non-zero one is used), inset on each axis, and how far the ends fall. | none, `fall` is its height |
| lay | Grain direction of the body, degrees clockwise from level. | the material's |
| lighting | A setup name: `studio`, `desk`, `window`, `outdoors`, or one from `defineLighting`. | `studio`, or what `configure` sets |
| bare | Boolean. No body. Its parts sit straight on the page. | off |
| height | How far the body stands, in mm. | 4 |
| turned |  |  |
| style |  |  |
| reverse |  |  |
| side |  |  |
| cracks |  | 0 |
| loose |  |  |
| rule | `evenodd` makes a path's inner shapes holes. |  |
| pin |  |  |
| folded |  |  |
| swung |  |  |
| fold |  |  |
| seated |  |  |
| moving |  |  |
| at |  |  |
| twist |  |  |
| carried |  |  |

```html
<d-device material="enamel-cream" keycap="keycap-black" radius="3.5" wear="0.15" style="display:inline-flex;align-items:center;gap:16px;padding:18px;font-size:14px">
  <button d-key style="width:70px;height:46px">Tune</button>
  <div d-lamp color="green" on></div>
  <span d-mark="label">Standby</span>
</d-device>
```

## `d-tape`

Tape: a cassette, a reel, and the path between them. Each piece is a form, as `d-tape="reel"`.

Forms: `reel`, `cassette`, `path`.

### `[d-tape~="reel"]`

A tape reel with three windows.

Import `device-ui/audio`. Write `<div d-tape="reel">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| spin | Turns per second. Negative runs backward. Off with reduced motion. | 0 |
| fill | How much tape it holds, 0 to 1. The tape never draws smaller than 30% of the radius. | 0.7 |
| material | Material of the flange. | `brushed-aluminium` |
| d-tape | The form, then any option words. |  |

```html
<d-device material="anodised-graphite" radius="3" style="display:inline-block;padding:14px">
  <div d-tape="reel" fill="0.9" style="width:160px;height:160px"></div>
</d-device>
```

### `[d-tape~="cassette"]`

A cassette seen through a window, hubs one above the other, spinning up and down like tape. From the `audio` pack.

Import `device-ui/audio`. Write `<div d-tape="cassette">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| spin | Turns per second. Negative runs backward. Off with reduced motion. | 0 |
| axle | How far in from the left the hubs sit, mm. | the middle |
| radius | Window corner radius in mm. | 1.5 |
| d-tape | The form, then any option words. |  |

```html
<d-device material="aluminium-space" radius="3" style="display:inline-block;padding:14px">
  <div d-tape="cassette" spin="0.4" style="width:104px;height:260px"></div>
</d-device>
```

### `[d-tape~="path"]`

The tape's whole route: tension arms, guides, three heads, the capstan and its pinch roller. `reels` is the left x, right x, y and radius of the two reels, and `line` the height of the tape past the heads, all mm from the part's corner. `left` and `right` are how full each reel is, and `play` and `moving` what the transport is doing.

Import `device-ui/audio`. Write `<div d-tape="path">`.

| Attribute | Does | Default |
| --- | --- | --- |
| reels | Left x, right x, y and radius of the two reels, mm from the corner. | `48 147 46 37.5` |
| line | Height of the tape past the heads, mm. | 100.5 |
| left | How full the left reel is, 0 to 1. | 0.6 |
| right | How full the right reel is, 0 to 1. | 0.6 |
| play | Boolean. | off |
| moving | Boolean. | off |
| d-tape | The form, then any option words. |  |

## `d-turntable`

A record player: platter and tonearm. Each piece is a form, as `d-turntable="platter"`.

Forms: `platter`, `tonearm`.

### `[d-turntable~="platter"]`

A turntable platter with a three armed spindle and marks, slow to start and stop. `d-turntable="platter strobe"` is a deck's platter, with strobe dots, a mat and a record. From the `audio` pack.

Import `device-ui/audio`. Write `<div d-turntable="platter">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| rpm | Where it is headed. Off with reduced motion. | 0 |
| marks | How many marks round the edge. | 5 |
| rise | Seconds its motor takes to reach `rpm`, for one that does not coast. | heavy and slow |
| strobe | On `strobe`, each row of dots as radius:count:dot radius in mm, by commas. | none |
| mat | On `strobe`, the mat's radius in mm. | 149 |
| label | On `strobe`, the material of a record's label. Without it there is no record, only the ribbed mat. | none |
| words | On `strobe`, the label's two lines, by a comma. | none |
| material | Material of the platter. | `hull-white` |
| d-turntable | The form, then any option words. |  |

```html
<d-device material="hull-white" radius="3" style="display:inline-block;padding:14px">
  <div d-turntable="platter" rpm="33" style="width:200px;height:200px"></div>
</d-device>
```

### `[d-turntable~="tonearm"]`

A moulded pickup arm on a pin. `d-turntable="tonearm s"` is a deck's bent arm, with a headshell and counterweight. From the `audio` pack.

Import `device-ui/audio`. Write `<div d-turntable="tonearm"><input type="range"></div>`.
Wraps: input[type=range].
Use: Drag it round its pin, or use the arrow keys.

| Attribute | Does | Default |
| --- | --- | --- |
| pivot | The pin, x and y in mm from the top left. | top right |
| length | Pin to stylus, mm. | its height |
| sweep | Degrees from rest to the end of its travel. | 62 |
| material | Material of the arm. | `gloss-white` |
| d-turntable | The form, then any option words. |  |

```html
<d-device material="hull-white" radius="3" style="display:inline-block;padding:14px">
  <div d-turntable="tonearm" pivot="70,5" length="50" style="width:300px;height:250px"><input type="range" aria-label="Arm" value="0"></div>
</d-device>
```

## `d-disk`

The sprung steel sheet over a floppy disk's head opening, filling its box at rest. A hole through it sits over solid case until the sheet is pushed along, when the hole comes over an opening onto the film inside. Let go, it springs shut. From the `computer` pack.

Forms: `shutter`, `hub`.

### `[d-disk~="shutter"]`

The sprung steel sheet over a floppy disk's head opening, filling its box at rest. A hole through it sits over solid case until the sheet is pushed along, when the hole comes over an opening onto the film inside. Let go, it springs shut. From the `computer` pack.

Import `device-ui/computer`. Write `<div d-disk="shutter"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag it along and let go.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the sheet. | `satin-steel` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| window | The hole, in mm from the box's top left, as `x y w h`. | none |
| travel | How far it runs, in mm. Negative runs left. | 12 |
| height | How far it stands, in mm. | 0.2 |
| d-disk | The form, then any option words. |  |

```html
<d-device material="plastic-black" radius="1" style="display:inline-block;padding:0 60px 12px 12px">
  <div d-disk="shutter" window="6 3 8 18" travel="12" style="width:120px;height:96px"><input type="range" min="0" max="1" step="0.01" value="0" aria-label="Shutter"></div>
</d-device>
```

### `[d-disk~="hub"]`

The steel hub of a floppy disk in its round opening in the case, which fills the box. It turns with a hand, with a square hole for the spindle and an oblong one for the drive pin. From the `computer` pack.

Import `device-ui/computer`. Write `<div d-disk="hub"><input type="range"></div>`.
Wraps: `<input type="range">`.
Use: Drag round it.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the hub. | `satin-steel` |
| min, max, step, value | On the `<input>`. The range, and where it sits. | 0, 100, 1, middle of the range |
| hub | The steel's diameter, in mm. | 23.5 |
| d-disk | The form, then any option words. |  |

```html
<d-device material="plastic-black" radius="1" style="display:inline-block;padding:12px">
  <div d-disk="hub" style="width:106px;height:106px"><input type="range" min="0" max="360" value="0" aria-label="Hub"></div>
</d-device>
```

## `d-tool`

A pocket tool: a folding blade and the tools pulled from its scales. Each piece is a form, as `d-tool="blade"`.

Forms: `blade`, `pull`.

### `[d-tool~="blade"]`

A spear blade on a pin. It lies along its box, tang to tip, and swings half a turn in the plane of the face. Paint a handle after it and the handle closes over the tang. From `device-ui/tool`.

Import `device-ui/tool`. Write `<div d-tool="blade">`.
Wraps: Nothing.
Use: Click it, or drag it round the pin.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the blade. | `satin-steel` |
| height | Mm the blade stands. | 0.9 |
| stamp | What is struck in the tang, with `\|` between lines. | nothing |
| open | Set when it is out. | off |
| d-tool | The form, then any option words. |  |

```html
<div style="padding:12px 20px"><d-device material="satin-steel" path="M4 4 H36 V36 H4 Z" viewbox="0 0 200 200" style="width:200px;height:200px"><div d-tool="blade" style="position:absolute;left:90px;top:12px;width:30px;height:130px"><button aria-label="Blade"></button></div></d-device></div>
```

### `[d-tool~="pull"]`

A small tool drawn out of a slot in the end of a handle, tweezers or a pick. It stops part way and at full reach. Paint the handle after it. From `device-ui/tool`.

Import `device-ui/tool`. Write `<div d-tool="pull">`.
Wraps: Nothing.
Use: Click it, or drag it.

| Attribute | Does | Default |
| --- | --- | --- |
| d-tool | `pull tweezers` or `pull pick`. | `pull tweezers` |
| material | Material of the tool. | `satin-steel`, or `keycap-ivory` for a pick |
| travel | Mm it draws out. | 20 |
| height | Mm it stands. | 0.7 |
| slide | How far out, 0 to 1. The joint writes it. | 0 |
| end | Radius of its head, mm. | 0.3 |

```html
<div style="padding:12px 20px"><d-device material="satin-steel" path="M4 4 H36 V36 H4 Z" viewbox="0 0 120 200" style="width:120px;height:200px"><div d-tool="pull tweezers" style="position:absolute;left:50px;top:30px;width:20px;height:150px"><button aria-label="Tweezers"></button></div></d-device></div>
```

## `d-slope`

A plane of a case falling away towards one edge of its box, for a band wider than a chamfer can be. It carves what it sits on, so put it on the surface before anything that sits on the band. From `device-ui/computer`.

### `d-slope`

A plane of a case falling away towards one edge of its box, for a band wider than a chamfer can be. It carves what it sits on, so put it on the surface before anything that sits on the band. From `device-ui/computer`.

Import `device-ui/computer`. Write `<d-slope>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| side | `top`, `right`, `bottom` or `left`. | `top` |
| drop | Mm it has fallen by the edge. | 2 |

```html
<d-device material="shell-beige" radius="3.5" style="display:block;width:240px;height:110px">
  <d-slope side="top" drop="3" style="position:absolute;left:0;top:0;width:240px;height:60px"></d-slope>
</d-device>
```

## `d-watch`

A wristwatch, down to the cushion it sits on. Each piece is a form, as `d-watch="case"`.

Forms: `bracelet`, `bezel`, `turnbezel`, `dial`, `cushion`, `strap`, `band`, `case`, `hands`.

### `[d-watch~="bracelet"]`

A metal bracelet, running from a case and rolled over what it lies on. From the `watch` pack.

Import `device-ui/watch`. Write `<div d-watch="bracelet" end="16" pitch="7.6"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| links | `rows`, three pieces a row with the middle one half a link out of step, or `bars`, wide bars with a polished link across each joint. | `rows` |
| pitch | A link, in mm. | 8 |
| end | How wide it narrows to, in mm. | its width |
| tail | Boolean. Runs down the page from the case, not up. | off |
| fold | A radius in mm. Past `flat` it goes over that curve and away, its links shortening as they turn. | off |
| flat, roll, fall | Where it starts to roll away, how long that takes, and how far it drops, from the case end in mm. | 8, 26, as a cushion |
| rise |  | 0 |
| d-watch | The form, then any option words. |  |

```html
<d-device material="felt-slate" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:14px">
  <div d-watch="bracelet" end="16" pitch="7.6" flat="60" style="width:80px;height:160px"></div>
  <div d-watch="bracelet" links="bars" end="20" pitch="7" flat="60" style="width:96px;height:160px"></div>
</d-device>
```

### `[d-watch~="bezel"]`

A bezel that stays put, round or a rounded square, with a wall down to a floor for what is nested in it. From the `watch` pack.

Import `device-ui/watch`. Write `<div d-watch="bezel" opening="26"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| opening | The hole in it, in mm: one size, or width and height. | 80% of its width |
| square, inner | How square the outside and the opening are. 2 is a circle, higher is squarer. | 2, 2 |
| height, floor | Height of the ring, and how far the floor lies from what it sits on, in mm. | 2.5, -2.9 |
| wall | Width of the slope down to the floor, in mm. | 1 |
| wall-material | Material of the slope. | `satin-steel`, radial |
| edge, top | A polished edge in mm, and a flat band of some material inside it. | 2.55, none |
| material | What it's made of, a name from the materials list. | `polished-steel` |
| flat | Boolean. | off |
| d-watch | The form, then any option words. |  |

```html
<d-device material="satin-steel" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:14px">
  <div d-watch="bezel" opening="20" style="width:100px;height:100px"></div>
  <div d-watch="bezel" square="4" inner="4" opening="19" top="satin-steel" style="width:100px;height:100px"></div>
</d-device>
```

### `[d-watch~="turnbezel"]`

A bezel with a coin edge and a printed insert of minutes, clicking round one way only. What is nested in it stays still. From the `watch` pack.

Import `device-ui/watch`. Write `<div d-watch="turnbezel" clicks="120" tabindex="0" role="slider" aria-label="Bezel"></div>`.
Wraps: None.
Use: Drag it round, anticlockwise only. Left Arrow steps a click. The other way does nothing.

| Attribute | Does | Default |
| --- | --- | --- |
| clicks | Detents in a full turn. | 120 |
| material | Material of the insert. | `ceramic-black` |
| opening, wall, height, floor | As for `d-watch="bezel"`. | as for `d-watch="bezel"` |
| turn | Angle in radians, kept by the joint. Goes one way only. | 0 |
| inner | Roundness of the opening: 2 is a circle, higher is squarer. | 2 |
| wall-material | Material of the wall down to the dial. Set, it's not brushed round. | `satin-steel` |
| teeth |  | 60 |
| ready | Boolean. | off |
| d-watch | The form, then any option words. |  |

```html
<d-device material="satin-steel" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:14px">
  <div d-watch="turnbezel" tabindex="0" role="slider" aria-label="Bezel" opening="29" style="width:164px;height:164px"></div>
</d-device>
```

### `[d-watch~="dial"]`

A watch dial, the shape of the opening it lies in. Markers, track, date and registers come from its options. What is nested in it sits on it. From the `watch` pack.

Import `device-ui/watch`. Write `<div d-watch="dial" markers="round"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| date-size | How big the date window is cut, as a multiple. | 1 |
| material | Material of the dial. | `dial-silver` |
| square | As for `d-watch="bezel"`. | 2 |
| markers | `batons`, or `round` with a triangle at 12 and bars at 6 and 9. | `batons` |
| index | Length and width of a baton, in units of 206 across. | 22 5.6 |
| skip | Hours left without a marker. | none |
| lume | Boolean. Lume let into the markers. | off |
| track | `ticks` or `beads`. | `ticks` |
| date, date-at | The hour a date window sits at, and how far out from 0 to 1. | none, 0.61 |
| ribs | Embossed lines across it, their pitch in mm. | none |
| bright | A colour shading out from the middle, over a darker `material`. | none |
| radial | Boolean. Brushed round the middle. | off |
| registers | Boolean. Two small dials. | off |
| ready | Boolean. | off |
| d-watch | The form, then any option words. |  |

```html
<d-device material="satin-steel" radius="3" style="display:inline-flex;align-items:center;gap:14px;padding:14px">
  <div d-watch="dial" material="dial-lacquer" markers="round" skip="3" date="3" style="width:116px;height:116px"></div>
  <div d-watch="dial" material="dial-navy" bright="#2b64ad" square="4" ribs="1" lume track="beads" style="width:116px;height:116px"></div>
</d-device>
```

### `[d-watch~="cushion"]`

The cushion a watch sits on in a box, rolling away at both ends. `flat` and `roll` are mm from its middle, and `fall` is how far it drops. What's nested in it sits on top.

Import `device-ui/watch`. Write `<div d-watch="cushion">`.

| Attribute | Does | Default |
| --- | --- | --- |
| flat | Mm from its middle to where it starts to roll. | 36.5 |
| roll | Mm the roll runs. | 26 |
| fall | Mm it drops. | 14.5 |
| d-watch | The form, then any option words. |  |

### `[d-watch~="strap"]`

A padded strap, drawn flat and rolled over the cushion. The edge is painted, the flange holds the stitching, and the pad swells up inside it.

Import `device-ui/watch`. Write `<div d-watch="strap">`.

| Attribute | Does | Default |
| --- | --- | --- |
| tail | Boolean. | off |
| d-watch | The form, then any option words. |  |

### `[d-watch~="band"]`

A strap moulded in one piece of resin or rubber, rolled away past `flat` mm from the case over `roll` mm, falling `fall` mm. It runs up the page, or down with `tail`. `pitch` is mm between its ribs, `slot` the length and width in mm of the slot across the middle of each. `edge` is the rounded edge in mm, `height` mm.

Import `device-ui/watch`. Write `<div d-watch="band">`.

| Attribute | Does | Default |
| --- | --- | --- |
| flat | Mm from the case end to where it rolls away. | 10 |
| roll | Mm the roll runs. | 26 |
| pitch | Mm between ribs. | 6 |
| slot | Length and width in mm of the slot across each rib. | `11 0.8` |
| edge | Rounded edge, mm. | 1 |
| fall | Mm it falls. | 12 |
| tail | Boolean. | off |
| material | What it's made of, a name from the materials list. | `rubber` |
| height | How far it stands, in mm. | 2 |
| d-watch | The form, then any option words. |  |

### `[d-watch~="case"]`

One piece of steel: the barrel and whatever holds the strap. `path` and `viewbox` give its outline, or it's a round barrel with curved lugs. `height` is mm over what it sits on, `camber` how far the lugs fall along the wrist, and `polished` a bright edge in mm. `lugs` is the gap between them in mm, for a strap running up and down the page: the sides facing it are cut sharp and brushed to the edge. It's brushed round the dial, unless `lay` says otherwise.

Import `device-ui/watch`. Write `<div d-watch="case">`.

| Attribute | Does | Default |
| --- | --- | --- |
| polished | Width of a bright edge, mm. 0 is none. | 0 |
| lay | Brushing direction, degrees clockwise from level. Unset, it's brushed round the dial. | round the dial |
| camber | How far the ends fall along the wrist, mm. | 5 |
| path | An SVG path for its outline, in `viewbox` units. |  |
| viewbox | The box `path` is drawn in, as in SVG. |  |
| height | How far it stands, in mm. | 6 |
| lugs |  | 0 |
| d-watch | The form, then any option words. |  |

### `[d-watch~="hands"]`

Hands on real heights above the dial, which follow the clock. `d-watch="hands spoke"` or `hands baton` tell the time, and the seconds sweep at eight beats a second. Without one they're a chronograph's: blued, with a red hand and two small registers, driven by `since` and `spent`. `offset` is minutes ahead of the clock. `hands stop` are a stopwatch's, also driven by `since` and `spent`: no time of day, just a long hand that beats five times a second, ticking as it goes, and a small one on a register. `lap` is seconds for the long hand's turn, `minutes` minutes for the small hand's, and `register` where that one's centre is, `x y` in mm from the long hand's. The box is the sweep of the long hand's tip, and `reach` the small hand in mm. With neither `since` nor `spent` they fly back by the short way, as a heart cam sends them.

Import `device-ui/watch`. Write `<div d-watch="hands">`.

| Attribute | Does | Default |
| --- | --- | --- |
| offset | Minutes ahead of the clock. | 0 |
| since | A `Date.now()` time. While set, the chronograph hands run from it. | 0 |
| spent | Ms already on the chronograph, added to `since`. | 0 |
| lap | With `hands stop`, seconds for a turn of the long hand. | 60 |
| minutes | With `hands stop`, minutes for a turn of the small hand. | 30 |
| register | With `hands stop`, the small hand's centre from the long hand's, `x y` in mm. | none |
| reach | With `hands stop`, the small hand's length, mm. | 6.6 |
| d-watch | The form, then any option words. |  |
| material | What it's made of, a name from the materials list. | `black-oxide` |

## `d-sewing`

A sewing machine's works: needle, take-up, feed and presser foot. Each piece is a form, as `d-sewing="needle"`.

Forms: `needle`, `takeup`, `feed`, `foot`.

### `[d-sewing~="needle"]`

A needle on its bar, driven up and down by the angle of the part named in `of`. From the `sewing` pack.

Import `device-ui/sewing`. Write `<div d-sewing="needle" of=".wheel"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| of | A selector for the part that drives it, in the same device. | none |
| stroke | How far it travels, in mm. | 30 |
| bar, length | The bar's reach at the top of its stroke and the needle's length, in mm. | 12, 36 |
| plate | How far down its box the plate is, in mm. It goes behind that. | its height |
| thread, cotton | Where the thread comes from, x y in mm from the part, and what it is. | none, `plastic-white` |
| d-sewing | The form, then any option words. |  |

```html
<d-device material="japan-black" radius="2" style="display:inline-flex;align-items:center;gap:24px;padding:16px">
  <div class="wheel" d-wheel="balance" style="width:120px;height:280px"><input type="range" min="0" max="360" value="60" aria-label="Handwheel"></div>
  <div d-sewing="needle" of=".wheel" stroke="30" bar="11" length="36" plate="60" style="width:56px;height:280px"></div>
</d-device>
```

### `[d-sewing~="takeup"]`

A take-up lever nodding in a slot in time with the part named in `of`, carrying the thread from one point to another. From the `sewing` pack.

Import `device-ui/sewing`. Write `<div d-sewing="takeup" of=".wheel" from="23 8" to="24 88"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| of, lead | A selector for the part that drives it, and how many degrees it runs ahead. | none, 60 |
| reach | How far it travels each way, in mm. | 6 |
| from, to | Where the thread goes, x y in mm from the part. | none |
| cotton, material | The thread, and the lever. | `plastic-white`, `chrome` |
| d-sewing | The form, then any option words. |  |

```html
<d-device material="japan-black" radius="2" style="display:inline-flex;align-items:center;gap:24px;padding:16px">
  <div class="wheel" d-wheel="balance" style="width:120px;height:280px"><input type="range" min="0" max="360" value="60" aria-label="Handwheel"></div>
  <div d-sewing="takeup" of=".wheel" from="23 8" to="24 62" reach="4.5" style="width:20px;height:248px"></div>
</d-device>
```

### `[d-sewing~="feed"]`

Feed dogs in a slot: rows of teeth that rise, walk and drop as the part named in `of` turns. From the `sewing` pack.

Import `device-ui/sewing`. Write `<div d-sewing="feed" of=".wheel" by=".stitch"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| of, by | A selector for the part that drives it, and for the input that sets how far it walks. | none |
| walk | The longest walk, in mm. | 3.2 |
| teeth | How many rows. | 6 |
| d-sewing | The form, then any option words. |  |

```html
<d-device material="satin-chrome" radius="2" style="display:inline-flex;align-items:center;gap:24px;padding:16px">
  <div class="wheel" d-wheel="balance" style="width:120px;height:280px"><input type="range" min="0" max="360" value="60" aria-label="Handwheel"></div>
  <div d-sewing="feed" of=".wheel" style="width:36px;height:76px"></div>
</d-device>
```

### `[d-sewing~="foot"]`

A presser foot on its bar, with a lever that lifts it off the plate or lets it down. From the `sewing` pack.

Import `device-ui/sewing`. Write `<div d-sewing="foot"><button></button></div>`.
Wraps: A `<button>` for the lever..
Use: Press the lever. Tab to it and press Enter or Space.

| Attribute | Does | Default |
| --- | --- | --- |
| lift | How far it lifts, in mm. | 6 |
| bar, shank | Where the bar and the shank run across its box, in mm. | 22, 12 |
| shin, sole | How far down the sole starts and ends, in mm. | 26, 56 |
| material | What it's made of. | `satin-chrome` |
| slide |  | 0 or `0` |
| d-sewing | The form, then any option words. |  |

```html
<d-device material="japan-black" radius="2" style="display:inline-flex;align-items:center;gap:24px;padding:16px">
  <div d-sewing="foot" lift="6" bar="22" shank="11" shin="18" sole="48" style="width:112px;height:296px"><button aria-label="Presser foot"></button></div>
</d-device>
```

## `d-cards`

A deck of playing cards and its box. The deck is one part with every card a button in it, and the box and its flap are its forms, as `d-cards="box"`.

Forms: `deck`, `box`, `flap`.

### `[d-cards~="deck"]`

A whole deck of cards. It draws every one itself, in the order they lie, so they cost one face and the edges of the rest. Deal them, turn them, cut them, fan them. From the `cards` pack.

Import `device-ui/cards`. Write `<div d-cards="deck" deal="72 0 106 0"><button leaf card="Q hearts"></button>...</div>`.
Wraps: A `<button leaf card="Q hearts">` for each card, bottom first, and the `grip`s a hand takes the stack by: a button each for `cut`, `over`, `take` and `away`, and a range for `spread`. Say where each goes with `place`..
Use: Tap the top card to deal it, tap a loose one to turn it over, drag one anywhere, and let it go over the deck to put it back. Tab to a card and press Enter or Space.

| Attribute | Does | Default |
| --- | --- | --- |
| deal | Where cards are dealt to, x y pairs in mm from the deck's middle. The last takes all that's left. | none |
| card (on the element) |  |  |
| open (on the element) | Boolean. | off |
| grip (on the :scope > [grip]) |  |  |
| grip (on the [leaf], [grip]) |  | `leaf` |
| open | Boolean. | off |
| card |  |  |
| d-cards | The form, then any option words. |  |

```html
<d-device material="felt-green" radius="2" style="position:relative;display:block;width:360px;height:380px">
  <div d-cards="deck" deal="160 0" style="position:absolute;left:40px;top:12px;width:254px;height:356px"><button leaf card="3 clubs"></button><button leaf card="Q hearts"></button><button leaf card="A spades"></button></div>
</d-device>
```

### `[d-cards~="box"]`

The carton a deck comes in, with a half moon cut out of its front for a thumb. Inside a `d-cards="deck"` the cards start in it and the deck draws it. From the `cards` pack.

Import `device-ui/cards`. Write `<div d-cards="box"><div d-cards="flap"><button></button></div></div>`.
Wraps: A `d-cards="flap"` along its top, if it opens..

| Attribute | Does | Default |
| --- | --- | --- |
| d-cards | The form, then any option words. |  |

```html
<d-device material="felt-green" radius="2" style="position:relative;display:block;width:300px;height:390px">
  <div d-cards="box" style="position:absolute;left:18px;top:13px;width:264px;height:364px"></div>
</d-device>
```

### `[d-cards~="flap"]`

The end of a box, tucked in. A tap pulls it out and it lies flat past the box, and another shuts it. From the `cards` pack.

Import `device-ui/cards`. Write `<div d-cards="flap"><button></button></div>`.
Wraps: A `<button>`. `open` says it's out..
Use: Click it, or tab to it and press Enter or Space.

| Attribute | Does | Default |
| --- | --- | --- |
| open | Boolean. | off |
| d-cards | The form, then any option words. |  |

```html
<d-device material="felt-green" radius="2" style="position:relative;display:block;width:300px;height:200px">
  <div d-cards="flap" open style="position:absolute;left:18px;top:175px;width:264px;height:20px"><button aria-label="Flap"></button></div>
</d-device>
```

## `d-strings`

A course of strings over a bridge and a nut. Catch one and let go, or sweep across them: each says so with a `pluck` event, with `string`, `at` and `force`. From the `guitar` pack.

### `[d-strings]`

A course of strings over a bridge and a nut. Catch one and let go, or sweep across them: each says so with a `pluck` event, with `string`, `at` and `force`. From the `guitar` pack.

Import `device-ui/guitar`. Write `<div d-strings bridge="..." nut="..."></div>`.
Wraps: A `<button>` for each string, for the keyboard..
Use: Press near a string, pull and let go, or drag across several. Tab to a string and press Enter or Space.

| Attribute | Does | Default |
| --- | --- | --- |
| bridge, nut | Where each string leaves off, x y pairs in mm from its top left. | none |
| heads | Where each string goes past the nut, x y pairs in mm. | none |
| gauges | How thick each string is, in mm. | `1.17 0.91 0.66 0.43 0.33 0.25` |
| wound, wrap | How many of them are wound, and what in. | 3, `satin-steel` |
| height | How far it stands, in mm. | 2.5 |
| material | What it's made of, a name from the materials list. | `polished-steel` |
| d-strings | The form, then any option words. |  |

```html
<d-device material="maple-gloss" radius="2" style="position:relative;display:block;width:600px;height:100px">
  <div d-strings bridge="4 4 4 7.4 4 10.8 4 14.2 4 17.6 4 21" nut="146 7 146 9.2 146 11.4 146 13.6 146 15.8 146 18" style="position:absolute;inset:0"><button aria-label="String"></button><button aria-label="String"></button><button aria-label="String"></button><button aria-label="String"></button><button aria-label="String"></button><button aria-label="String"></button></div>
</d-device>
```

## `d-brass`

Drawn tubing, round all the way, along a path with its corners bent. From the `brass` pack.

Forms: `tube`, `bell`, `piston`, `mouthpiece`, `waterkey`, `ring`, `brace`.

### `[d-brass~="tube"]`

Drawn tubing, round all the way, along a path with its corners bent. From the `brass` pack.

Import `device-ui/brass`. Write `<div d-brass="tube" size="10" points="5 5 0 95 5 12 95 40 12 5 40 0"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| points | x y r for each corner in mm from its top left, r the radius of the bend. | none |
| size, height | Outside diameter, and how far its top stands, in mm. | 11, 12 |
| rings, ring, ring-material | Ferrules at distances along the path, their `width proud` in mm, and what they are made of. | none, `2.5 0.5`, its own |
| material | What it's made of, a name from the materials list. | `lacquered-brass` |
| d-brass | The form, then any option words. |  |

```html
<div d-brass="tube" size="10" points="5 5 0 95 5 12 95 40 12 5 40 0" rings="50" material="lacquered-brass" style="width:400px;height:180px"></div>
```

### `[d-brass~="bell"]`

The flare of a horn, turned on an axis along the middle of its box. What is nested in it sits on its curve. From the `brass` pack.

Import `device-ui/brass`. Write `<div d-brass="bell" profile="0 5 60 8 100 30"></div>`.
Wraps: Marks and print..

| Attribute | Does | Default |
| --- | --- | --- |
| profile | Pairs of `distance radius` in mm from its left edge. | `0 5 100 30` |
| height | How far its widest stands, in mm. | its radius |
| material | What it's made of, a name from the materials list. | `lacquered-brass` |
| d-brass | The form, then any option words. |  |

```html
<div d-brass="bell" profile="0 5 60 8 85 16 100 30" material="lacquered-brass" style="width:400px;height:240px"></div>
```

### `[d-brass~="piston"]`

A piston valve side on: a button on a stem, a domed cap, the casing and a knurled foot. Press it and the button runs down, with a `valve` event with `down`. From the `brass` pack.

Import `device-ui/brass`. Write `<button d-brass="piston" aria-label="Valve"></button>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| size, travel, height | Casing diameter, how far it goes, how far the casing stands, in mm. | 17.7, 10, 26 |
| cap, band, foot, stem, button-size | Where each sits down the box, the foot being its depth, and the stem and button diameters, in mm. | 16, 57, 7, 4.4, 15 |
| foot-material, button, pearl, rod | Materials of the bottom cap, the button rim, the inlay and the stem. | its own, its own, `mother-of-pearl`, `nickel-silver` |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| material | What it's made of, a name from the materials list. | `lacquered-brass` |
| d-brass | The form, then any option words. |  |

```html
<button d-brass="piston" aria-label="Valve" material="lacquered-brass" foot-material="nickel-silver" style="width:88px;height:536px"></button>
```

### `[d-brass~="mouthpiece"]`

A mouthpiece with its cup at the left. Hold it to blow, which says so with `blow` events with `on`, and drag up and down to move its input, which is how tight the lips are. Space blows and the arrows move it from the keyboard. From the `brass` pack.

Import `device-ui/brass`. Write `<div d-brass="mouthpiece"><input type="range" min="2" max="8" value="4" aria-label="Lips"></div>`.
Wraps: A range `<input>`..

| Attribute | Does | Default |
| --- | --- | --- |
| profile, height | Pairs of `distance radius` in mm, and how far its widest stands. | `0 12 4 13 20 9 28 4.5 80 5`, its radius |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| material | What it's made of, a name from the materials list. | `silver-plate` |
| d-brass | The form, then any option words. |  |

```html
<div d-brass="mouthpiece" profile="0 11.8 1.2 13.45 8 12 22 5.8 28 3.9 60 4.7" style="width:240px;height:108px"><input type="range" min="2" max="8" value="4" aria-label="Lips"></div>
```

### `[d-brass~="waterkey"]`

A sprung lever holding a cork against a hole in the tube. Press it and it lifts, with a `valve` event with `down`. From the `brass` pack.

Import `device-ui/brass`. Write `<button d-brass="waterkey" pin="10 18" cork="4 30" points="17 3 0 11 17 5 4 31 0" aria-label="Water key"></button>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| pin, cork, points | Its pivot, the cork, and the arm as x y r corners, in mm from its top left. | none |
| swing, size, height | How far it lifts in degrees, the arm's thickness and how far it stands, in mm. | 14, 1.8, 16 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| material | What it's made of, a name from the materials list. | `lacquered-brass` |
| d-brass | The form, then any option words. |  |

```html
<button d-brass="waterkey" pin="10 18" cork="4 30" points="17 3 0 11 17 5 4 31 0" material="lacquered-brass" aria-label="Water key" style="width:80px;height:152px"></button>
```

### `[d-brass~="ring"]`

A ring soldered on for a finger to pull a slide by, filling its box. From the `brass` pack.

Import `device-ui/brass`. Write `<div d-brass="ring"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| size, height | The rod, and how far it stands, in mm. | 2, 12 |
| material | What it's made of, a name from the materials list. | `lacquered-brass` |
| d-brass | The form, then any option words. |  |

```html
<div d-brass="ring" material="lacquered-brass" style="width:96px;height:96px"></div>
```

### `[d-brass~="brace"]`

A stay between two tubes: a rod through its box from top to bottom, with a pointed foot at each end. From the `brass` pack.

Import `device-ui/brass`. Write `<div d-brass="brace"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| size, foot, height | The rod, the width of its feet and how far it stands, in mm. | 2.6, 6.4, 14 |
| material | What it's made of, a name from the materials list. | `lacquered-brass` |
| d-brass | The form, then any option words. |  |

```html
<div d-brass="brace" material="lacquered-brass" style="width:28px;height:240px"></div>
```

## `d-guitar`

An electric guitar: frets, pickup, bridge, arm and tuner. Each piece is a form, as `d-guitar="pickup"`.

Forms: `frets`, `pickup`, `bridge`, `arm`, `tuner`.

### `[d-guitar~="frets"]`

The frets, dots and nut on a neck, from a fretboard that fills its box, with the nut along its right edge. From the `guitar` pack.

Import `device-ui/guitar`. Write `<div d-guitar="frets" scale="648"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| scale, count | The string's length in mm, and how many frets. | 648, 21 |
| nut, heel | How wide the board is at each end, in mm. | 43, 57 |
| dot, dot-size, at | The inlays' colour, width in mm, and the frets they mark. | `#14100c`, 6, `3 5 7 9 12 15 17 19 21` |
| nut-material | Material of the nut. | `keycap-ivory` |
| material | What it's made of, a name from the materials list. | `satin-steel` |
| d-guitar | The form, then any option words. |  |

```html
<d-device material="maple-gloss" radius="2" style="position:relative;display:block;width:560px;height:60px">
  <div d-guitar="frets" scale="216" nut="14" heel="15" dot-size="2" style="position:absolute;inset:0"></div>
</d-device>
```

### `[d-guitar~="pickup"]`

A single coil under a moulded cover, its six pole pieces standing through it. From the `guitar` pack.

Import `device-ui/guitar`. Write `<div d-guitar="pickup"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| rotate | Slants it, in degrees. | 0 |
| pole, pitch, pole-size | The poles' metal, spacing and width, in mm. | `chrome`, 10.6, 4.8 |
| stagger | How far each pole stands, in mm. | `0.6 0.6 1 1 0.7 0.5` |
| material | What it's made of, a name from the materials list. | `keycap-ivory` |
| height | How far it stands, in mm. | 4 |
| d-guitar | The form, then any option words. |  |

```html
<d-device material="plastic-white" radius="2" style="display:inline-flex;align-items:center;gap:24px;padding:16px">
  <div d-guitar="pickup" style="width:68px;height:280px"></div>
  <div d-guitar="pickup" rotate="8" style="width:68px;height:280px"></div>
</d-device>
```

### `[d-guitar~="bridge"]`

A vintage tremolo bridge from above: a steel plate stepped back at one corner, six bent saddles, a row of pivot screws and the socket for the arm. From the `guitar` pack.

Import `device-ui/guitar`. Write `<div d-guitar="bridge"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| pitch, first | The distance between strings and where the first one lies, in mm. | 11.2, 8.9 |
| at, screws | How far along the plate the saddles and the row of screws sit, in mm. | 15.5, 34.4 |
| socket-x, socket-y | Where the arm's socket is, in mm. | 10.6, 77.8 |
| material | What it's made of, a name from the materials list. | `satin-chrome` |
| height | How far it stands, in mm. | 8 |
| d-guitar | The form, then any option words. |  |

```html
<d-device material="alder-amber" radius="2" style="display:inline-flex;align-items:center;gap:16px;padding:16px">
  <div d-guitar="bridge" style="width:160px;height:340px"></div>
</d-device>
```

### `[d-guitar~="arm"]`

A bent rod with a tip, out of a tremolo's socket and across the guitar. From the `guitar` pack.

Import `device-ui/guitar`. Write `<div d-guitar="arm" points="0 0 10 7 45 4 112 -6"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| points | Its path, x y in mm from its top left, with the tip on the last stretch. | none |
| tip | Material of its end. | `keycap-ivory` |
| material | What it's made of, a name from the materials list. | `chrome` |
| height | How far it stands, in mm. | 13 |
| d-guitar | The form, then any option words. |  |

```html
<d-device material="plastic-white" radius="2" style="display:inline-flex;align-items:center;gap:16px;padding:28px">
  <div d-guitar="arm" points="0 20 10 27 45 24 112 14" style="width:448px;height:112px"></div>
</d-device>
```

### `[d-guitar~="tuner"]`

A machine head from the front: the post a string winds on, in its bushing, on a box centred on the post. From the `guitar` pack.

Import `device-ui/guitar`. Write `<div d-guitar="tuner" button="12.6 -17"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| button, button-size | Where the button shows past the edge of the headstock, x y in mm from the post, and its width in mm. | none, 11 |
| material | What it's made of, a name from the materials list. | `chrome` |
| height | How far it stands, in mm. | 9 |
| d-guitar | The form, then any option words. |  |

```html
<d-device material="maple-gloss" radius="2" style="display:inline-flex;align-items:center;gap:16px;padding:80px">
  <div d-guitar="tuner" button="12.6 -17" style="width:44px;height:44px"></div>
</d-device>
```

## `d-embosser`

An embossing label maker: wheel, rim, lever, cutter and tape. Each piece is a form, as `d-embosser="wheel"`.

Forms: `wheel`, `rim`, `lever`, `cutter`, `tape`.

### `[d-embosser~="wheel"]`

The letter wheel of an embossing label maker: a ribbed disc with its characters round a printed face, clicking from each to the next and on round past the end. From the `office` pack.

Import `device-ui/office`. Write `<div d-embosser="wheel"><input type="range" min="0" max="39" step="1"></div>`.
Wraps: `<input type="range">`, from 0 to as many characters as there are..
Use: Drag it round, or use the arrow keys, which go on round past the end.

| Attribute | Does | Default |
| --- | --- | --- |
| chars | The characters, clockwise, a space being the blank that spaces words. | `£$0-9A-Z` and a blank |
| index | Where the chosen one sits, in degrees clockwise from the top. | 278 |
| face, face-size, ring, legend | What's printed on, how wide it is, how far out the characters sit and how tall they are, in mm. | `paint-silver`, 60, 26.5, 4.4 |
| ink | The colour of the characters. | `#111114` |
| ribs, rib | How many ribs round the edge, and how deep, in mm. | one per character, 1 |
| height | How far it stands, in mm. | 3 |
| material | What it's made of, a name from the materials list. | `plastic-black-stippled` |
| d-embosser | The form, then any option words. |  |

```html
<d-device material="plastic-black-gloss" radius="2" style="display:inline-flex;align-items:center;gap:90px;padding:90px">
  <div d-embosser="wheel" style="width:316px;height:316px"><input type="range" min="0" max="39" step="1" value="0" aria-label="Letter wheel"></div>
</d-device>
```

### `[d-embosser~="rim"]`

The rim of an embosser's wheel showing through a slot on top of the body, going round with the wheel it follows. From the `office` pack.

Import `device-ui/office`. Write `<div d-embosser="rim" of=".wheel"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| of | A selector for the wheel it follows, within the same embosser. | none |
| face | What's printed on the disc. | `paint-silver` |
| ribs | How many ribs round the edge. | one per character |
| chars |  | `£$0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ` |
| height | How far it stands, in mm. | 1.5 |
| material | What it's made of, a name from the materials list. | `plastic-black-stippled` |
| d-embosser | The form, then any option words. |  |

```html
<d-device material="plastic-black-gloss" radius="2" style="display:inline-flex;align-items:center;gap:16px;padding:30px">
  <div d-embosser="wheel" class="wheel" chars="ABCDEF" style="width:160px;height:160px"><input type="range" min="0" max="6" step="1" value="0" aria-label="Letter wheel"></div>
  <div d-embosser="rim" of=".wheel" style="width:224px;height:56px"></div>
</d-device>
```

### `[d-embosser~="lever"]`

The squeeze handle of an embosser, swinging on a pin at its far end. All the way in and it strikes, firing a bubbling `squeeze`, and on the way home a `squeeze-back`. Short of that nothing happens. From the `office` pack.

Import `device-ui/office`. Write `<button d-embosser="lever" path="..." pin="..."></button>`.
Wraps: A `<button>`.
Use: Press and hold, or Enter and Space. A tap goes all the way.

| Attribute | Does | Default |
| --- | --- | --- |
| path, nose | Its outline in mm from its box's corner, which can run far outside that box, and a narrower piece of it with a tighter edge. | none |
| extent | The x y w h the outline fills, in mm, when it isn't the box. | its box |
| pin, swing | Where it turns, x y in mm, and how many degrees it goes. | `0 0`, 3.5 |
| bevel, crown | How wide its edge is and how much it swells, in mm. | 3, 0.8 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| material | What it's made of, a name from the materials list. | `plastic-black-gloss` |
| height | How far it stands, in mm. | 8 |
| d-embosser | The form, then any option words. |  |

```html
<d-device material="plastic-black-gloss" radius="2" style="display:inline-block;padding:24px">
  <button d-embosser="lever" aria-label="Squeeze the handle" path="M0 0H80V14H0Z" pin="76 7" swing="3.5" style="width:320px;height:56px"></button>
</d-device>
```

### `[d-embosser~="cutter"]`

The cutter of an embosser: a tab you push in, and a blade it drives across the tape at the end of its stroke, firing a bubbling `cut`. From the `office` pack.

Import `device-ui/office`. Write `<button d-embosser="cutter" blade="..."></button>`.
Wraps: A `<button>`.
Use: Press it, or Enter and Space.

| Attribute | Does | Default |
| --- | --- | --- |
| blade | Where the blade goes, x y0 y1 in mm from the tab's corner. | none |
| travel | How far the tab goes in, in mm. | 2 |
| aria-pressed (on the element) |  |  |
| bank | A bank of keys it's one of, by name, in its device. One that latches lets the rest out as it goes in, and one that doesn't lets them all out. |  |
| stage | Makes it two-stage, as a shutter: held, it stops this share of its travel in, and letting go takes it the rest of the way. Fires `stage`. |  |
| run | A run of keys it's one of, by name, in its device, as a keyboard: a hand held down slides from key to key. The key left fires `run`, with `detail.to` the key it went on to. |  |
| long (on the element) | Held this many ms, it fires `long` once, and letting it go then isn't a click. |  |
| repeat (on the element) | Held, it fires `repeat` after the first number of ms and then every second number, as a key that repeats. |  |
| material | What it's made of, a name from the materials list. | `plastic-black-gloss` |
| height | How far it stands, in mm. | 7 |
| d-embosser | The form, then any option words. |  |

```html
<d-device material="plastic-black-gloss" radius="2" style="display:inline-flex;align-items:center;gap:16px;padding:30px">
  <button d-embosser="cutter" aria-label="Cut the tape off" style="width:72px;height:40px"></button>
</d-device>
```

### `[d-embosser~="tape"]`

Embossed tape in its run from the punch to the air outside, its box as wide as the tape and ending on the right at the punch. It wires the embosser up: on a `squeeze` in its device it takes the wheel's character, on `squeeze-back` it feeds on, and on a `cut` it parts at the blade and the end falls away. From the `office` pack.

Import `device-ui/office`. Write `<div d-embosser="tape" letters="LABEL" blade="20"></div>`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| letters | What's been embossed so far. | none |
| lead | How much blank tape comes before the first letter, in mm. | 6 |
| pitch, cap | How far it feeds for each letter and how tall they are, in mm. | 5, 6.4 |
| blade | Where the cutter parts it, in mm from the box's left. | 20 |
| tray | Where a piece falls to, x y in mm. | `0 40` |
| leading | How far apart cut pieces lie, in mm. | 16 |
| chars |  | `£$0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ` |
| material | What it's made of, a name from the materials list. | `dymo-red` |
| d-embosser | The form, then any option words. |  |

```html
<d-device material="plastic-white" radius="2" style="position:relative;display:block;width:520px;height:90px">
  <div d-embosser="tape" letters="DEVICE UI" material="dymo-red" style="position:absolute;left:20px;top:20px;width:480px;height:51px"></div>
</d-device>
```
