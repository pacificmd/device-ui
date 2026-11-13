# Appliance

More from `device-ui/appliance`, with what the source says about them.

## `d-hob`

A glass hob: rings, the plan of them, and the digits that light. Each piece is a form, as `d-hob="ring"`.

Forms: `ring`, `plan`, `digit`.

### `[d-hob~="ring"]`

A cooking ring: printed on the glass, with a coil under it that shows through as it heats.

Import `device-ui/appliance`. Write `<div d-hob="ring">`.

| Attribute | Does | Default |
| --- | --- | --- |
| heat | How hot the coil shows, 0 to 1. Above 0.004 the coil glows red. | 0 |
| d-hob | The form, then any option words. |  |

### `[d-hob~="plan"]`

Which ring a row of controls belongs to: a small printed plan of the top.

Import `device-ui/appliance`. Write `<div d-hob="plan">`.

| Attribute | Does | Default |
| --- | --- | --- |
| zone | Which ring is filled in: 0 to 3. The others stay outlines. | 0 |
| d-hob | The form, then any option words. |  |

### `[d-hob~="digit"]`

A digit that is not there until it is lit. Nothing prints on the glass when `value` is empty.

Import `device-ui/appliance`. Write `<div d-hob="digit">`.

| Attribute | Does | Default |
| --- | --- | --- |
| value | One character to light: 0 to 9, `H`, `L` or `-`. Empty or anything else draws nothing. | none |
| d-hob | The form, then any option words. |  |

## `d-barhandle`

A bar handle on two posts. Pressing it pulls the door out of its seal, and again closes it.

### `[d-barhandle]`

A bar handle on two posts. Pressing it pulls the door out of its seal, and again closes it.

Import `device-ui/appliance`. Write `<div d-barhandle>`.

| Attribute | Does | Default |
| --- | --- | --- |
| aria-pressed | `true` pulls the bar out 5mm. | not set |
| d-barhandle | The form, then any option words. |  |

## `d-lift`

A lift: the doors and the landing behind them, as `d-lift="doors"`.

Forms: `doors`.

### `[d-lift~="doors"]`

The doors, with the landing behind them. `open` slides them apart, `floor` names the landing.

Import `device-ui/appliance`. Write `<div d-lift="doors">`.

| Attribute | Does | Default |
| --- | --- | --- |
| floor | Text shown on the landing wall behind the doors. | empty |
| open | Boolean. | off |
| d-lift | The form, then any option words. |  |
