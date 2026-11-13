# Masonry

What a wall is built of, drawn with base alone. Nothing here moves, and none of it needs a `d-device`: a `d-surface` holds it.

## `d-wall`

A building's wall: brickwork, and the window set in it. Each piece is a form, as `d-wall="casement"`.

Forms: `brickwork`, `reveal`, `casement`, `sill`.

### `[d-wall~="brickwork"]`

Bricks in mortar, filling its box and cut where it cuts them. The value is the bond: `stretcher` or `soldier`. From the `masonry` pack.

Import `device-ui/masonry`. Write `<div d-wall="brickwork stretcher">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the bricks. | `brick-red` |
| mortar | Material of the joints. | `mortar-lime` |
| brick, course, joint | The length and height of a brick and the joint round it, mm. | 215, 65, 10 |
| height | How far a brick stands off the mortar, mm. | 4 |
| d-wall | The form, then any option words. |  |

### `[d-wall~="reveal"]`

A hole in a wall. What's nested in it stands back from the face. From the `masonry` pack.

Import `device-ui/masonry`. Write `<div d-wall="reveal" depth="102.5">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of its floor. | the surface's |
| depth | How far back it goes, mm. | 102.5 |
| d-wall | The form, then any option words. |  |

### `[d-wall~="casement"]`

A window: a fixed frame, a sash in each light and glass behind them, filling its box. From the `masonry` pack.

Import `device-ui/masonry`. Write `<div d-wall="casement">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the frame. | `gloss-white` |
| glass | Material behind the sashes. | `glass-black` |
| lights | How many, side by side. | 2 |
| frame, sash | How wide each is, mm. | 60, 45 |
| height | How far the frame stands off the glass, mm. | 38 |
| d-wall | The form, then any option words. |  |

### `[d-wall~="sill"]`

A sill under an opening, its top falling toward the front and its ends left flat. From the `masonry` pack.

Import `device-ui/masonry`. Write `<div d-wall="sill">`.
Wraps: None.

| Attribute | Does | Default |
| --- | --- | --- |
| material | Material of the sill. | `cast-stone` |
| height | How far it comes out past the wall, mm. | 45 |
| depth | How far back into the opening it goes, mm. | 102.5 |
| stool | How far it runs past the opening at each end, mm. | 110 |
| d-wall | The form, then any option words. |  |
