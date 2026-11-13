# Displays and screens

Things that show text or pictures.

## `d-readout`

Something that shows characters. The value says which kind, as `d-readout="seven"`.

Forms: `lcd`, `seven`, `nixie`, `flip`, `odometer`, `matrix`, `segments`, `starburst`.

### `[d-readout~="lcd"]`

An LCD window around a real text field. The text you see is the input, in whatever font you give it, so it selects and copies.

Import `device-ui/controls`. Write `<div d-readout="lcd">`.
Wraps: `<input>`, shown as is.
Use: A normal text field: click and type.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Panel. `lcd-amber`, `lcd-green` and `lcd-blue` also set the text colour. | `lcd-amber` |
| value | On the `<input>`. The text. | empty |
| d-readout | The form, then any option words. |  |

```html
<d-device material="anodised-graphite" radius="3" style="display:inline-flex;flex-direction:column;gap:10px;padding:16px;font:30px/1 VT323,monospace">
  <div d-readout="lcd" material="lcd-amber" style="width:200px;height:62px"><input value="4120" aria-label="Number" style="height:100%;padding:8px 14px"></div>
  <div d-readout="lcd" material="lcd-green" style="width:200px;height:62px"><input value="96.4 MHz" aria-label="Frequency" style="height:100%;padding:8px 14px"></div>
</d-device>
```

### `[d-readout~="seven"]`

A seven-segment display. The text is real, so it reads out and copies. `:` and `.` sit on the digit before them.

Import `device-ui/controls`. Write `<div d-readout="seven">`.
Wraps: None. The text inside is the value..

| Attribute | Does | Default |
| --- | --- | --- |
| gain | Brightness of the lit segments. | 0.62 |
| color | Segment colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `red` |
| digits | Minimum number of digits. Blanks pad the left. | length of the text |
| dead | Boolean. Leaves out the faint unlit segments, so a dark digit cannot be seen. | off |
| bare | Boolean. No panel or glass of its own, for segments laid on another surface. | off |
| slant | Lean of the digits, degrees. | 0 |
| text inside | Digits, `-`, `_` and the letters A B C D E F G H I J L N O P R S T U Y. Anything else is blank. | empty |
| point-cell | Boolean. | off |
| d-readout | The form, then any option words. |  |

```html
<d-device material="anodised-graphite" radius="3" style="display:inline-block;padding:16px">
  <div d-readout="seven" color="red" digits="4" style="width:230px;height:84px">12:34</div>
</d-device>
```

### `[d-readout~="nixie"]`

Numerals of glowing wire in glass tubes, one tube per character. The colour is fixed.

Import `device-ui/controls`. Write `<div d-readout="nixie">`.
Wraps: None. The text inside is the value..

| Attribute | Does | Default |
| --- | --- | --- |
| digits | Minimum number of tubes. Empty tubes pad the left. | length of the text |
| text inside | Any characters. One per tube. | empty |
| d-readout | The form, then any option words. |  |

```html
<d-device material="walnut" radius="3" style="display:inline-block;padding:16px">
  <div d-readout="nixie" style="width:230px;height:130px">1984</div>
</d-device>
```

### `[d-readout~="flip"]`

A departure board. Flaps run through the alphabet to reach each new letter. Reduced motion jumps straight there.

Import `device-ui/controls`. Write `<div d-readout="flip">`.
Wraps: None. The text inside is the value..

| Attribute | Does | Default |
| --- | --- | --- |
| cells | Number of flaps. | length of the text |
| text inside | A to Z, 0 to 9, space and `- . : /`. Lower case is raised. Anything else is blank. | empty |
| d-readout | The form, then any option words. |  |

```html
<d-device material="anodised-graphite" radius="2.5" style="display:inline-block;padding:14px">
  <div d-readout="flip" cells="8" style="width:340px;height:60px">PARIS 09</div>
</d-device>
```

### `[d-readout~="odometer"]`

Number wheels behind a window. Each wheel carries into the next as the number changes.

Import `device-ui/controls`. Write `<div d-readout="odometer">`.
Wraps: None. The text inside is the value..

| Attribute | Does | Default |
| --- | --- | --- |
| digits | Minimum number of wheels. | length of the text |
| material | Material of the wheels. | `keycap-ivory` |
| text inside | A number. Anything else reads as 0, and below 0 stops at 0. | 0 |
| d-readout | The form, then any option words. |  |

```html
<d-device material="anodised-graphite" radius="2.5" style="display:inline-block;padding:14px">
  <div d-readout="odometer" digits="6" style="width:170px;height:48px">12485</div>
</d-device>
```

### `[d-readout=""]`

Lit text set straight onto a panel. It takes its font, size, spacing and left, right or centre alignment from CSS.

Import `device-ui/controls`. Write `<div d-readout>`.
Wraps: None. The text inside is the value..

| Attribute | Does | Default |
| --- | --- | --- |
| color | Text colour. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `white` |
| gain | Brightness. | 0.2 |
| d-readout | The form, then any option words. |  |

```html
<d-device material="ceramic-black" radius="3.5" style="display:inline-block;padding:14px 24px">
  <div d-readout color="cyan" style="width:200px;height:72px;font:500 64px/72px 'Barlow Semi Condensed',sans-serif;letter-spacing:0;text-align:center">12:34</div>
</d-device>
```

### `[d-readout~="matrix"]`

A dot-matrix LED display with a five-by-seven alphabet: capitals, digits and common punctuation. The text is real, so it reads out and copies. It gets taller letters when there is room for them. For pictures, use `<d-screen kind="led">`.

Import `device-ui/controls`. Write `<div d-readout="matrix">`.
Wraps: Text.

| Attribute | Does | Default |
| --- | --- | --- |
| scroll | Boolean. Runs text that does not fit past the window, unless the reader prefers reduced motion. | off |
| pitch | Spacing of the LEDs, mm. | 1 |
| color | The LEDs. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `red` |
| gain | Brightness. | 1.4 |
| frame | Width of the frame, mm. | 1 |
| material | Material of the frame. | `black-oxide` |
| d-readout | The form, then any option words. |  |

```html
<d-device material="gloss-black" radius="4" style="display:grid;gap:12px;padding:16px;width:340px">
  <div d-readout="matrix" color="amber" style="width:340px;height:52px">HELLO 42</div>
  <div d-readout="matrix" color="white" pitch="0.75" scroll style="width:340px;height:40px">NEXT TRAIN 4 MIN  PLATFORM 2</div>
</d-device>
```

### `[d-readout~="segments"]`

`<d-seg name box stroke lean stems>` children are digits, and `<d-seg name box path viewbox>` or `<d-seg name box text weight>` fixed shapes, `box` being x y w h in mm from the glass's corner. `on` lists what's driven: a digit as `name=5`, or `name=*` for every stroke, and a shape by its name. `ghost` shows what's off, 0 to 1, as a slant of the light does. `light` is a lamp beside the glass at `light-at` in mm, spreading `light-size` mm across, in `color`.

Import `device-ui/controls`. Write `<div d-readout="segments">`.

| Attribute | Does | Default |
| --- | --- | --- |
| box (on the d-seg) | x y w h in mm from the glass's corner. | none |
| name (on the d-seg) | What `on` calls it. | none |
| stroke (on the d-seg) | Stroke thickness of a digit, mm. | 0.5 |
| lean (on the d-seg) | How far a digit's top runs right, per unit of height. | 0 |
| ghost | Shows the off segments, 0 to 1. Ignored with `light`. | 0 |
| light-at | The lamp's x y in mm from the corner. | 0 0 |
| light-size | How wide the light spreads, mm. | 20 |
| on | Space-separated list of what's driven: `name=5` for a digit, `name=*` for every stroke, or a shape's name. | none |
| material | What it's made of, a name from the materials list. | `lcd-grey` |
| path (on the d-seg) | An SVG path for its outline, in `viewbox` units. |  |
| text (on the d-seg) |  |  |
| stems (on the d-seg) | Boolean. | off |
| weight (on the d-seg) |  | 500 |
| viewbox (on the d-seg) | The box `path` is drawn in, as in SVG. |  |
| radius | Corner radius, in mm. | 1 |
| light | Boolean. | off |
| color | A hex colour, or a colour name. | `green` |
| d-readout | The form, then any option words. |  |

### `[d-readout~="starburst"]`

`<div d-readout="starburst" color="phosphor" digits="8">SPELL</div>`: an alphanumeric tube, each character out of fourteen strokes, as on a vacuum fluorescent display. The text is real, and fills from the left. `weight` is a stroke's width as a share of the character's height, and `slant` leans it, degrees. It has no panel of its own: it sits under whatever glass holds it.

Import `device-ui/controls`. Write `<div d-readout="starburst">`.

| Attribute | Does | Default |
| --- | --- | --- |
| digits | How many characters fit across. | 8 |
| slant | Lean, degrees. | 0 |
| weight | Stroke width as a share of character height. | 0.09 |
| gain | How bright lit strokes are. | 0.62 |
| color | A hex colour, or a colour name. | `phosphor` |
| d-readout | The form, then any option words. |  |

### `[d-readout~="seven"][d-readout~="clock"]`

d-readout="seven" lights too hard for numerals this tall: the bloom comes back as blocks around each digit.

Import `device-ui/audio`. Write `[d-readout~="seven"][d-readout~="clock"]`.

| Attribute | Does | Default |
| --- | --- | --- |
| d-readout | The form, then any option words. |  |

## `d-screen`

A screen showing a canvas, one canvas pixel to one phosphor, LED or cell. `kind` sets the panel. Draw on the canvas however you like, or put real elements on it: one element that fills the panel, laid out by the browser and live as ever, shown through the panel at the canvas's pixels. Write it as it should look, dark on light on a panel lit by the room, light on dark on one that gives light. It draws backgrounds, borders, text, images, fields, selection and focus.

### `d-screen`

A screen showing a canvas, one canvas pixel to one phosphor, LED or cell. `kind` sets the panel. Draw on the canvas however you like, or put real elements on it: one element that fills the panel, laid out by the browser and live as ever, shown through the panel at the canvas's pixels. Write it as it should look, dark on light on a panel lit by the room, light on dark on one that gives light. It draws backgrounds, borders, text, images, fields, selection and focus.

Import `device-ui/controls`. Write `<d-screen>`.
Wraps: `<canvas>`, `<video>` or `<img>`, or an element holding a page.

| Attribute | Does | Default |
| --- | --- | --- |
| kind | `crt`, `led`, `lcd`, `oled`, `tft`, a colour LCD with a reflector, whose picture needs `lit` for its backlight and still shows dimly by the room without it, `eink` or `coat`, a film on the back of glass that gives no light: its material is the film, the material's `text` colour is what shows behind it, and the canvas is how much is left. | `crt` |
| live | Boolean. Redraws from the source every frame. Without it, the picture updates only when the device next repaints. | off |
| bezel | Material of the frame. | `black-oxide` |
| frame | Frame width, mm. 0 for none. | crt 3, led 1.25, lcd 1.25, oled 0.75, eink 2 |
| material | Panel material. Try `lcd-green` with `kind="lcd"`. | `oled-panel` for oled, `tft-panel` for tft, `eink-panel` for eink, otherwise none |
| radius | Corner radius in mm. | 3 for crt, otherwise 1 |
| gain | Brightness. | crt 3, led 3, lcd 0, oled 0.85, tft 0.85, eink 0 |
| mono | Boolean. A crt with one even phosphor, so no colour stripes. | off |
| bulge | How far a crt picture bows outwards, 0 for flat. | 0.24 |
| lit | Boolean. Turns on the backlight. | off |
| backlight | Colour of the backlight. One of red, amber, yellow, green, lime, blue, white, cyan, violet, pink, phosphor or neon. | `white` |
| glow | How strong the backlight is. | 0.1 |
| wash | How far a lit backlight colours the panel, 0 to 1. In a lit room a backlit panel looks more like a coloured sheet than a lamp. | 0 |
| pitch | With real elements on it, the mm between pixels. The canvas then takes as many as fit the panel, and no `<canvas>` is needed, so a panel that changes size keeps its pixels square. | the canvas's own size |
| response | Ms for a pixel to turn, so old pixels hang on. 0 is instant. | 0 |
| rate | Panel frames a second while it settles. | 12 |
| active | w h in mm of the pixels' area. The rest is bare panel. | whole panel |
| depth | How far the picture sits below the face, mm. | 0.9 |
| cabinet | On an led wall, the width and height in mm of the panels it is built of. The seams between them show. | one panel |
| color | A hex colour, or a colour name. | `white` |
| pointer |  |  |

```html
<d-device material="plastic-black" radius="3" style="display:inline-block;padding:14px">
  <d-screen kind="crt" style="width:280px;height:210px"><canvas width="160" height="120"></canvas></d-screen>
</d-device>
```
