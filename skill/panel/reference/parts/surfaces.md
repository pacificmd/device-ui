# Surfaces

The two elements from base, which every pack builds on.

## `d-surface`

A raised shape drawn from CSS size and attributes, with no script. Nested surfaces stack on the one below. Its own text becomes a legend.

### `d-surface`

A raised shape drawn from CSS size and attributes, with no script. Nested surfaces stack on the one below. Its own text becomes a legend.

Comes with `device-ui`. Write `<d-surface>`.
Wraps: None. It can hold text and other parts..

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the shape. | the device's |
| height | Height above what is under it: `2`, `2mm` or `0.2cm`. | 1 mm |
| shape | `circle`. Anything else is a rounded box. | box |
| path | SVG path data. Takes priority over `shape`. | none |
| viewbox | Four numbers for `path`, with spaces or commas. | `0 0 100 100` |
| stop | A second SVG path to end at. The bevel still comes from `path`, so one side can slope wider than the others. | none |
| rotate | Degrees. Boxes and paths. | 0 |
| radius | Corner radius of a box in mm. | 0.75 |
| bevel | Width of the edge in mm. | 0.625 |
| edge | `rolled`, `round`, `chamfer`, `flat` or `dome`. | `rolled` |
| wear | Edge wear for this surface, 0 to 1. | the device's |
| lay | Which way its grain runs, in degrees clockwise from level. Brushing, wood, weave. | the material's |
| label | How its text is applied: `engrave`, `print` or `emboss`. | `engrave` |
| crown | Swell of the top, mm: one value for both axes, or x and y. | 0 |
| clear | See through it to what is under it, with its reflection on top. Its value is how cloudy it is, 0 to 1. Give it a clear `material` such as `polycarbonate`. | off |
| curve | With `clear`, how far its top tilts by its edge for what it reflects, as a slope. A dead flat front only reflects what is straight ahead, so a little brings the edge of a light across it. | 0 |
| sheet | It's a sheet this thick, mm, as card or tin: its cut edges show the stock. | none |
| fold | With `sheet`, which edges are folded and roll away instead of cut: `top`, `bottom`, `left`, `right`. | none |
| score | Grooves pressed across it, mm from its top. | none |
| rule | `evenodd` makes a path's inner shapes holes. |  |
| radial | Boolean. | off |
| fit | Boolean. | off |
| twist |  |  |

```html
<d-device material="anodised-graphite" radius="3" style="display:inline-flex;align-items:center;gap:18px;padding:18px;font-size:13px">
  <d-surface material="brass" height="1.2mm" bevel="0.75" viewbox="0 0 100 100" path="M50 2 L98 50 L50 98 L2 50 Z" style="width:110px;height:110px;display:grid;place-items:center">Rated</d-surface>
  <d-surface shape="circle" material="plastic-red" height="2" edge="dome" label="print" style="width:80px;height:80px;display:grid;place-items:center">Stop</d-surface>
  <d-surface material="keycap-ivory" radius="2" label="emboss" style="padding:14px 16px">Box</d-surface>
</d-device>
```
