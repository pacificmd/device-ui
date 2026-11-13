# Pocket

More from `device-ui/pocket`, with what the source says about them.

## `d-lighter`

A petrol lighter: chimney, flint wheel and cam lever. Each piece is a form, as `d-lighter="chimney"`.

Forms: `chimney`, `flintwheel`, `camlever`.

### `[d-lighter~="chimney"]`

The holes of a wind guard, pressed through whatever it's on, and the two folds down its sides. `rows` is how many holes in each row, and the rows sit half a pitch out of step.

Import `device-ui/pocket`. Write `<div d-lighter="chimney">`.

| Attribute | Does | Default |
| --- | --- | --- |
| hole | Hole radius, mm. | 0.95 |
| rows | Holes in each row, comma list. Rows sit half a pitch out of step. | `3,2,3` |
| d-lighter | The form, then any option words. |  |

### `[d-lighter~="flintwheel"]`

A knurled wheel, filling its box. It turns on an axle held by whatever passes in front of it.

Import `device-ui/pocket`. Write `<div d-lighter="flintwheel">`.

| Attribute | Does | Default |
| --- | --- | --- |
| material | What it's made of, a name from the materials list. | `black-oxide` |
| height | How far it stands, in mm. | 2 |
| d-lighter | The form, then any option words. |  |

### `[d-lighter~="camlever"]`

A leaf of sprung steel riveted through the middle of its box. It rides the joint named by `of`, and tips over as that opens.

Import `device-ui/pocket`. Write `<div d-lighter="camlever">`.

| Attribute | Does | Default |
| --- | --- | --- |
| of | Selector of the part it rides, in the same device. Its spring goes after that part's value, so it lags. | none |
| material | What it's made of, a name from the materials list. | `brushed-steel` |
| height | How far it stands, in mm. | 1 |
| d-lighter | The form, then any option words. |  |
