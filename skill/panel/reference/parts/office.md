# Office

More from `device-ui/office`, with what the source says about them.

## `d-typewriter`

A typewriter: carriage, typebars and bell. Each piece is a form, as `d-typewriter="carriage"`.

Forms: `carriage`, `typebars`, `bell`.

### `[d-typewriter~="carriage"]`

The moving top of a typewriter: platen, paper, lever and knobs. `col` and `row` drive it. `pitch` and `leading` are the mm a letter and a line move, `cols` how many letters fit, and the element's `lines` what's typed.

Import `device-ui/office`. Write `<div d-typewriter="carriage">`.

| Attribute | Does | Default |
| --- | --- | --- |
| col | Column at the print point. | 0 |
| row | Line at the print point. Paper feeds as it rises. | 0 |
| pitch | How far a letter moves, mm. | 2.5 |
| leading | How far a line moves, mm. | 4.5 |
| cols | Letters that fit on a line. | 30 |
| d-typewriter | The form, then any option words. |  |

### `[d-typewriter~="typebars"]`

The basket of type bars. `bar` says which one is flying up to the paper.

Import `device-ui/office`. Write `<div d-typewriter="typebars">`.

| Attribute | Does | Default |
| --- | --- | --- |
| bars | How many bars in the basket. | 41 |
| bar | Index of the bar that flies up on `strike`. | 0 |
| strike | Boolean. | off |
| d-typewriter | The form, then any option words. |  |

### `[d-typewriter~="bell"]`

A small bell with a hammer. `ring` swings it, and `lit` is there for when motion is off.

Import `device-ui/office`. Write `<div d-typewriter="bell">`.

| Attribute | Does | Default |
| --- | --- | --- |
| ring | Any change of value swings the hammer and rings. | none |
| lit | Boolean. | off |
| d-typewriter | The form, then any option words. |  |

## `d-telephone`

A telephone: the body, and the handset on it. Each piece is a form, as `d-telephone="handset"`.

Forms: `handset`.

### `[d-telephone=""]`

The moulded case, dished around the dial, with the cradle and its two hook plungers. `dial` and `cord` are where those sit, mm from the case's corner.

Import `device-ui/office`. Write `<div d-telephone>`.

| Attribute | Does | Default |
| --- | --- | --- |
| dial | x y of the dial's centre, mm from the case's corner. | `57.5 81.5` |
| cord | x y of the cord socket, same. | `3.75 119` |
| lifted | Boolean. | off |
| d-telephone | The form, then any option words. |  |

### `[d-telephone~="handset"]`

The handset and its coiled cord. Drawn from circles and rotated bars, so swinging it costs no fields. It covers the whole desk. `cradle`, `rest` and `cord` are the points it hangs on, lies at and runs back to, mm from the part's corner.

Import `device-ui/office`. Write `<div d-telephone="handset">`.

| Attribute | Does | Default |
| --- | --- | --- |
| cradle | x y it hangs on, mm from the part's corner. | `122.5 24` |
| rest | x y it lies at when `lifted`. | `31 67.5` |
| cord | x y the cord runs back to. | `68.75 125` |
| lifted | Boolean. | off |
| d-telephone | The form, then any option words. |  |
