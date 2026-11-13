# Breaking changes

What to do to code written against an older version.

## Glass says how it breaks and how thick it is

`glass()` commands carry `breaks` (`'glass' | 'crystal' | 'split' | 'craze'`, or null for a pane that can't break) and `thick` in mm, in
place of `brittle`. A material sets `breaks`, through its substance by default, and `glass({ thick })` overrides the thickness. `shatter`
takes `{ breaks, thick }` in place of `{ glass }`.

## Renamed to device-ui

- The package `diegetic-ui` is now `device-ui`: change every import and dependency from `diegetic-ui` and `diegetic-ui/*` to `device-ui` and `device-ui/*`, `npx diegetic-ui` to `npx device-ui`, the global `DiegeticUI` to `DeviceUI` and `DIEGETIC_GL` to `DEVICE_UI_GL`. The skills `diegetic-ui` and `diegetic-device` are now `panel` and `device`. Tags and attributes are unchanged. Entries below keep the old name.


## A lighting's `camera` is gone

- `defineLighting` no longer takes `camera`. Drop it; TypeScript flags it.
- The room no longer has a dark disc straight back along the view, and the lamp's highlight is no longer cut where a flat face mirrors it straight back. That disc was wider than a whole plate's view of the room, so every flat polished face had a dark blot in its middle.


## The engine's own light pass is gone

- The player lights every device. The engine's renderer only makes maps for it, as `make: 'maps'` did.
- These are gone: `configure({ light })`, `configure({ make })` and `configure({ debug })`, and with them `?light=engine`, `?player=off`, `?make=all` and `?make=maps`. Drop them; TypeScript now flags them.
- `engine.player.fallbacks()`, `engine.player.why` and `engine.player.stats.fell` are gone, because nothing is left to another light. `engine.renderer.mapsOnly`, `renderer.owed()`, `plate.full`, `plate.wide`, `plate.bake` and `plate.hold` are gone too. So are `stats.bakes` and `stats.glows`.
- A debug view is the player's: the map as it is.
- Where the player's programs don't link, the page stays plain styled elements, as with no WebGL2.
- Code that read the working maps off a plate (`plate.tex.H`, `N`, `S`, `M`) after a paint finds them given back. Use `engine.maps(el)`, which holds them while it reads.
- What glows is kept only over the maps, never spread over the whole canvas: `plate.tex.G` is gone.
- `shaders/light.ts` keeps only what the player and the stage's camera share: `TONE`, `LIGHT_VIEW`, `FULL_VS` and the sizes. `LIGHT_FS`, `LIGHT_CORE` and their pieces are gone.
- `audio` adds `soon()`. Anything that will sound calls it as it's made, so the device opens when the page is idle and not inside the first press. Instruments, the contact add-on and the site's beeper already do.


## The raster is gone

- `packages/diegetic-ui/src/base/raster/` is deleted. `configure({ raster })`, `?raster=on` and `?raster=off` are gone, and so are `configure({ shade })` and `configure({ bake })`, which only the raster read. Drop them: TypeScript now flags them.
- `engine.settling` is gone: the player has nothing left to settle after a frame. Wait on `window.flushed()` or `engine.flushed()` instead.
- `window.seats` is never set.
- The site's judge page is one object up close, with no tricks to switch.


## The page's address reaches the engine only when the page says so

- `?light=engine`, `?player=off`, `?make=all` and `?make=maps` do nothing unless the page calls `configure({ debug: true })` before the engine's first frame, which its own code after its imports always is. A host's own query string no longer switches the engine. The site opts in.

## With the player, the engine keeps only the maps a light reads

- The engine's renderer paints a device's maps, the player packs them, and what the paint worked in (heights, facing, shade, roughness, metal, coat, depth) is given back. A light reads the device's colour, what glows and the pack. `engine.renderer.mapsOnly` says so.
- `configure({ make: 'all' })` before the first device, or `?make=all`, has it keep all it paints in, as before. Use it for code that reads those maps off a plate (`plate.tex.H`, `N`, `S`, `M`), which finds them gone otherwise.
- Only a debug view is still lit by the engine's own light pass, which keeps that device's maps while it does. A torch, flashes, flames and what glows on the devices round one are the player's, and a device made for the player alone gives off its glow to the others too. A device on a stage is the player's: it gives light for the stage's camera, and a stage layer's `StageShot.height` is then the player's own heights, at half the maps' size, over the same place.
- A device's back and sides say what they'd draw before they're painted, so the front is sized for them from its first paint. Nothing to change, but a face's `plate.painted` no longer says whether its shape is known.


## The player lights every device, and the raster is not installed

- A device is lit each frame by the player: one light pass over maps packed from the engine's own, on the engine's own canvas, where the raster drew it or the engine's light pass did. Pictures change by about a level on a face and more at its outline and in its shadow on the page, so anything compared against a stored picture needs it recorded again.
- The raster is no longer installed. `configure({ raster: true })` before the first device, or `?raster=on`, still puts it behind the engine. Its options, `shade` among them, do nothing without it, and `engine.maps` works without `raster: false`.
- `configure({ light: 'engine' })` before the first device, or `?light=engine`, has the engine's own light pass light everything, for comparing. `engine.player.stats` counts what the player lit and `engine.player.fallbacks()` lists what the engine's pass still lights for it and why: a body turning over or leaning, one set at an angle, a torch, a flash or a flame, something standing clear of the ground, coated glass.
- Code that counted the raster's work (`window.seats`, its bakes and coarse frames) finds none.


## A device's maps, for a renderer of its own

`engine.maps(el, { pxPerMm })` gives what the material pass makes of a device as plain arrays, for a renderer that lights it each frame. It works as a page is by default: the player is the renderer and the raster is off, so there's nothing to turn off first (`configure({ raster: true })` brings the raster back). `configure({ make: 'all' })` keeps everything a paint works in, and `configure({ light: 'engine' })` uses the engine's own light. Nothing existing changes.

`maps.moves` holds each spring that changes what's drawn, with its maps at the spring's far end cropped to a box, to lerp by its value. `maps.screens` holds each screen's box and settings: screens are blank in every map, and their picture is the page's. `{ moves: false }` skips the probing. A part its joint carries whole (a slide, a hinge, a turn) has `rigid`: the part alone, the body under it, and `per` and `ends` to move it by. Joints say their stops as `PartDef.ends`. `{ face: 'back' | 'left' | 'right' }` reads that face without turning the body. `{ box: { x, y, w, h } }` in mm reads part of it at any `pxPerMm`, in tiles past one canvas. `pxPerMm` alone is now the size you get, whatever the page shows it at, and throws past one canvas. `maps.surface` is straight now, its a coverage, where it was blended by coverage. `maps.gaps` lists what the maps can't carry.

## On a touch screen, one device is live

- `configure({ live })` says how much of the page relights as it's touched: `full`, every device shown; `one`, the device in focus; `fixed`, none. A touch screen is `one` by default. Focus goes to the device last pressed while it's shown, and otherwise to the one nearest the window's middle; `engine.focused()` says which. Every other device keeps its final picture, lit where the lamp rests, and what changes on it still shows. On a touch screen the lamp now follows a finger while it's down, and rests when it lifts. Code that moves the lamp over a device out of focus on a phone and expects it to relight should set `configure({ live: 'full' })`. On the site, `?live=full|one|fixed` does the same. The GPU running short of room for a while, at rest, steps `full` to `one` and `one` to `fixed` before anything is drawn coarser.

## A device's markup has its own corners

- A device's markup has its own corners: `border-radius` comes from its `radius`, so an outline or focus ring round it follows the body, where every device had 8 px. With the engine's `cards` off, a turn waits at each face it comes to until that face is drawn.

## A moving lamp is drawn from what was learnt of its light

- Once a hand has moved a device's lamp, the raster learns how its light moves while nothing else is drawn, about half a second of GPU time, and draws a moving lamp from that in one pass, every frame, where it was learnt closely enough. Where it wasn't, or there's no room for it, the lamp is lit as before, coarse and 30 times a second. Where it stops is lit in full, as before. Code that counts GPU work at rest should wait for `engine.settling` to go false after a hand moves a lamp, as learning is part of settling. `configure({ bake: false })` turns it off. On the site, `?bake=off` does the same.

## A turn holds at the lean until its shadow is in and the next face is drawn

- A body set off for another face leans, with its shadow going in under it, before it whips, and lands only on a face that has been drawn: about 0.15 s, up to 0.6 s more the first time a face is turned to. Code that sets `turned` and reads the face on the next frame should wait for `data-turning` to go.

## A moving lamp's frames are shaded coarse

- While a lamp moves, the raster lights one pixel in four, a different one each frame, and moves the other three by how their lit neighbours changed. Where it stops is lit in full, so anything that waits for the page to settle gets the same picture. Code that compares a moving lamp's frames pixel for pixel should set `configure({ shade: 'full' })`. On the site, `?shade=full` does the same.

## A moving lamp relights 30 times a second

- A lamp following the pointer relights what it's over 30 times a second, not every frame. The pointer still eases every frame, and where it stops is lit as before, so anything that waits for the page to settle gets the same picture. Code that moves the pointer and counts relights on the next frame should set `configure({ lampHz: 0 })`, which relights every frame again. On the site, `?lamp=every` does the same.

## A laser etch has no depth, and bare steel shows itself under it

- `d-mark="print etch"` cuts no depth unless given one: it shows as a matte frost, with no walls to catch a light. Give `depth` in mm only for a cut deep enough to have walls.
- A metal material that names no `sub` is the same metal all through, so an etch or a scratch on it shows that metal gone matte, not grey. It wears by `polish`, scratches and rubbed spots rather than chips, unless it gives `wears` or a coat. A material that wants grey underneath should name its `sub`.

## The raster draws

- Where the GPU has `EXT_float_blend` and `OES_texture_float_linear`, every device is drawn by the raster in `base/raster/`, not the old renderer. Markup, parts, materials and options are unchanged. Elsewhere the old renderer draws, as before.
- No device keeps a picture on the GPU: `plate.picture` and the renderer's `store` say nothing about what's on screen. Code that read them should wait on `window.flushed()` or the `pictured` event and read the page.
- Nothing is drawn in tiles any more, by the raster or the old renderer. Where the old renderer draws, a device shown bigger than its light bench is drawn whole, coarser, at what fits. `d.tiles`, `d.coarse`, `PlateSpec.whole` and `PlateSpec.origin` are gone, and the store no longer holds `near` or `far`.
- On a camera's world the stage is a `div[data-d="stage"]` holding one canvas, not a `canvas[data-d="stage"]`.
- A part's `mask(ctx, part)` gets an `OffscreenCanvasRenderingContext2D`: the mask is drawn off the page, as one on it cost 15-20 ms of the main thread for each paint to take. A `mask` typed with `CanvasRenderingContext2D` should take the offscreen one; what it draws is unchanged.

## Knobs take stops, and a few more lengths are mm

- Every `d-knob` form takes `from` and `to`, the stops in degrees from straight up, as main's skirt knob did. A flat `skirt` with `pointer` moulds a wedge out to the edge, as on a range switch, and its body shrinks to give it room.
- `gap` and `radius` on `d-chip="contacts"`, `pin` on `d-switch="bar"` and `pivot` on `d-turntable="tonearm"` are mm. Divide old px values by 4.
- Main's `[d-knob~="cap"]` with a ring of level lamps is the anatomy's `cap` now. For a ring of lamps give `leds="N"`; `on` no longer lights it as a level meter.

## Screws come from the ISO table

- `d-fixing="screw"` no longer takes `height`: its head stands as far as an ISO head of that size does, picked from the box. Drop `height=`.
- New `head` (pan, cheese, button, countersunk) and `drive` (slot, cross, hex, star). `socket` still means a hex drive.

## Lit lenses keep their form

- What glows is brightest where it faces you and dims down its slopes, so a lit jewel, dome or cap still shows its shape. Flat glowing surfaces are as they were; a domed one reads a little darker at its rim.
- Gauges draw their bezel from the shared anatomy, with a stop pin just short of zero, and take `flush`. New `d-meter="panel"`, a square moving-coil panel meter.
- New lamp colour `neon`, and `d-lamp="neon"`, a neon indicator. The plain lamp takes `square` and `bezel`.

## Mechanical keys are cut to a profile

- `d-key="mech"` and `d-key="switch"` take `profile`: `cherry`, `oem`, `sa`, `dsa` or `xda`, each with its own height, top and dish. A mech key is `cherry` unless it says, which is close to what it was. A switch key is `oem`, which stands taller than it did, so its shadow falls further: set `profile="cherry"` for the old height.
- `dish` on a mech key now overrides the profile's, and with no `dish` it's the profile's.
- New forms: `d-key="tact"`, a tactile switch, and `d-key="mushroom"`, an emergency stop that locks down.

## Ripples have a wave, dishes have two axes, and tops can tilt

- A `RectShape`'s `ripple` is `[count, depth, wave]` now, with `wave` 0 for sine, 1 for vee and 2 for scoop. A scoop used to be a negative count. `circle(..., { vee: [n, d] })` cuts sharp vees, as a knurl is rolled. Code that builds the tuple by hand needs the third number.
- `dish` on a surface takes `[x, y]` as well as one number, so `[d, 0]` is a cylindrical trough. A `SurfaceCommand`'s `dish` is always the pair.
- Surfaces take `tilt`, how far the top falls across its whole width each way, mm, as `[x, y]` or one number, with `pivot` saying where it doesn't move.
- `d-key="mech"` is dished cylindrically by default, as a Cherry-style cap is. `dish="spherical"` gives the old bowl.

## Every length is mm

Lengths on elements used to be a mix of css px, mm and shares of the box. Now every one is real mm, like `height` always was. Divide an old px value by 4.

- `radius` and `bevel` on `d-device`, `d-surface` and `d-screen`, and on the parts that take them: `d-key` (`slab`, `membrane`, `bumper`, `step`, `lamp`, `side`, `mat`), `d-mark` (`scale`, `ring`), `d-glass`, `d-stick="dpad"`, `d-cover` (`lid`, `cap`) and `d-tape="cassette"`.
- `gap` on `d-key` (`tab`, `face`) and `d-stick="dpad"`; `frame` on `d-screen` and the matrix; `pitch` and `hole` on grilles, headers and vents, with a vent's `slot`, `wall` and `recess`; `width` on a meter ring; `size` on `d-mark` (`scale`, `ring`) and a spin wheel's marks; `travel` on a plunger; `margin` on `d-cover="cap"`; `hub` on a tuning wheel; `pin` on a bar switch.
- In packs: `reels`, `line`, `axle`, `pivot` and `length` on tape, cassette and tonearm; `pitch` and `leading` on the carriage; `dial`, `cord`, `cradle` and `rest` on the telephone; `hole` on the chimney.
- These were shares of the box and are now mm too: `size` on `d-knob` is its diameter, `cap` on `d-wheel="drum"` is the plain top's height, `hole` on `d-fixing` (`eyelet`, `socket`), `hub` on a spin wheel and `travel` on `d-key="edge"`. Left out, each keeps its old default.
- Blur on glass stays px: it's how the glass looks, not how big anything is.

## Every knob is built the same way

A `d-knob` form is now its body, its section from the side: plain, `skirt`, `collet`, `flared`, `cap`, `stem`, `bar`, plus `pointer` and `jog` as before. Everything else is an option every form takes, in real mm: `grip` (`smooth`, `knurled`, `ribbed`, `fluted`, `lobed`, each cut at its real pitch), `ribs`, `top` (`flat`, `spun`, `cap`, `dished`, `domed`), `mark` (`line`, `dot`, `arrow`, `slot`, `skirt`, `none`), `mark-color`, `height`, `body`, `taper`, `edge`, `leds` and `ring`. `detents` works on every form but stem, and `free` on cap.

To move:

- `d-knob="encoder"` is `d-knob="cap" detents grip="knurled" top="spun" mark="dot"`, plus `leds` or `leds="N"` for its ring. The React `Encoder` writes that for you.
- `d-knob="mode"` (the camera dial) is a `cap` with `detents`, `grip="knurled"` and `top="spun"` in the material you want.
- `d-knob="fluted"` is `d-knob="cap" free grip="ribbed" top="domed"`.
- `mark="#hex"` is `mark-color`. `mark` now says which kind of mark.
- `slot="dot"` is `mark="dot"`, and `flutes` is `ribs`.
- `stem` (the width of an OP-style stem) and `cap-size` are `body`, the body's share of the knob across. `body` is the width at the top, so for an old `cap-size` give about 1.2× its value.
- Styles that matched `[d-knob~="encoder"]` or `[d-knob~="mode"]` now need a class or `[d-knob~="cap"]`.
- `plastic-grey` and `plastic-brown` were never materials. Use `keycap-grey` and `bakelite`.

## The key lock fills its box

`d-switch="key"` is now drawn from the front, with its collar filling its box and `labels` printed outside it. It used to fill 62% of its box, so to keep a lock the same size, make its box 0.62 of what it was and put the rest in a margin. The key's only material is now `key`: the black bow is gone. `key="none"` takes the key out.

## `still()` is a promise

`engine.still(root)` now returns a promise of the picture, which comes once the GPU has drawn what it holds, rather than the picture itself. Reading it back at once waited on the GPU for everything sent before it. Code that used its result straight away awaits it, and checks that what it was for is still there.
## Pale materials print dark unless they say

A material with no `legend` of its own used to print in pale ink whatever its colour, which couldn't be read on a pale body. It now prints dark on anything pale. If you relied on the pale ink, set `legend` on the material or `color` on the mark.

`words(p)` now reads the part's own tag rather than always `d-key`. Pass the tag, as `words(p, 'd-mark')`, to read another.

## `place` puts things in mm

Nothing breaks, but a hand-written `at(x, y, w, h)` that builds `left`, `top`, `width` and `height` can go. `place="x y w h"` is the centre, in mm, from the holder's top left, and `place="corner x y w h"` is the top left. No `h` means square. It makes the thing `position: absolute`. `mm(n)` from `diegetic-ui` is the same conversion for a stylesheet.

## One way to draw a device: no crop, and the bench is the window

A device shown bigger than the light bench, on the stage or off it, is now drawn in tiles. The crop is gone: `PlateSpec.crop` and the engine's `maxPixels` no longer exist, and a device's `crop` is `bounds`, the part of it in the window, set only while it's tiled. Off the stage, a tiled device's canvas covers only the tiles it wants, so its size and place follow the window, not the whole device. The bench is the window and a shadow's margin round it, at the px to the css px something shown at its own size draws. A device drawn whole is as sharp as that allows, never less than it's shown at, and one that doesn't fit even at that is tiled. `fill` is no exemption: a device filling a huge box is tiled like any other. Code that set `maxPixels` to cap sharpness sets `maxRatio`, or `keep` for memory.

## `frame()` fits in a batch

`frame(el, view)` used to set the element's zoom before it returned. Now it fits with everything else arriving that turn, in a microtask, before the page is next drawn, and `fitted` fires then. Code that read the element's size or zoom straight after `frame()` waits for `fitted`, or for a microtask.

## Markup shown too small to use is hidden while it sleeps

In a camera's world, a device whose markup paints nothing of its own and is shown too small to work by hand (`data-asleep`) now has that markup `visibility: hidden`, all of it, where it used to be clipped. The browser went on painting what it clipped every frame the camera moved. Its box, place and parts hold as before, and a hand coming over it wakes it. Until then the keyboard and a screen reader pass it by. A page that needs every control reachable from the keyboard at any zoom keeps its devices out of a camera's world, or shown large enough to use.

## A part's `tick` runs while it moves something, and is told to run again

`tick(part, dt)` used to be called every frame for as long as its device was on the page, whatever it returned. Now a tick that returns false and asks for nothing isn't called again until something tells its device: one of its springs moving, its markup or attributes changing, or a frame asked for it. A tick that returns true runs again next frame, as before. A tick waiting on something the page doesn't hear, such as the clock or a video, calls `getEngine().schedule()` while it runs, and runs again on the next frame. Outside a tick, `getEngine().schedule(el)` asks for a frame for the device `el` is in, so a pack whose state changes without markup, such as a canvas drawn on, says where.

## One audio device per page, and one mute

`diegetic-ui/sound` now opens one `AudioContext` for the whole page, and everything it plays goes through one output. `audio()` returns that context and `output()` the node to connect to in place of `audio().destination`. `mute(on)`, `isMuted()` and `onMute(f)` silence the whole page or let it be heard. A muted page goes on playing, silently, so what plays keeps its time. `sound()`, `instrument()`, `drums()`, `mono()`, `polyphonic()` and `tape()` all use that device. `sound({ muted })` and `sound().muted` are now the page's mute rather than the clips' own, so setting them silences everything else too. `close()` on an instrument lets go of its own nodes and leaves the device open for the rest of the page. Code that made its own `new AudioContext()` and connected to its `destination` still plays, but nothing mutes it. Use `audio()` and `output()`. `worklet(name, code)` loads a worklet's code once per page, since a processor name can only be registered once in a context.

## A camera can leave its world off the stage, and a page can be framed with `<body camera>`

Nothing written before breaks. `camera(world, { stage: false })` is a closer look at a page rather than a camera of its own: each device keeps its own canvas, and there's no stage, lens or exposure. `<body camera="x y w h">` puts that camera on the whole page and fills the window with that rect, in css px as the page shows it with no camera. The engine draws it at the density it's now shown at, and taking the attribute off puts the page back. `pnpm shoot <page> --frame <selector|x,y,w,h> --size 1920x1080 [--video seconds --fps 30]` uses it to shoot part of a page as a still or a film at any size. The air's own canvas now stays over the window when it sits in something a camera moves.

## A camera's world goes through a camera: exposure, adaptation and glare

The shared canvas in a camera's world is drawn as linear light and shown through a camera, which exposes it to the light in the room, adapts to changes in it over a few tenths of a second, and spreads what's brighter than white into glare. A flash now overexposes and the view stops down after it. A dark room is shown brighter than it is, though not as bright as a lit one. Light added over the bare page, a spark or the glare round something, goes onto the colour of the page behind the stage, read from the first opaque background up from the world. A page or test that needs light measured as it is, not as an eye sees it, holds the exposure with `configure({ exposure: 1 })`, where 1 shows the studio as before.

A stage layer (`stageLayer`) draws onto `frame.target`, the camera's float target, not the canvas's own framebuffer, and draws light as bright as it is, premultiplied: no curve and no clip of its own. A layer that bound framebuffer `null` to draw is now drawn under the camera's picture and lost. Bind `frame.target`. A layer that fakes exposure with `1 - exp(-x)` should draw `x`.

## What's drawn on a surface stops at its edge, and a glow lights only what faces it

What a part cuts, prints or lights inside a surface's `on` now stops at that surface's outline, where it used to carry on over whatever was beside it. A lamp drawn bigger than the pad it's under, so its corners light, no longer lays a halo on the panel round it. A part that meant a mark to run past the surface it sits on should draw it outside that surface's `on`.

The light a screen or lit key gives to what's round it now depends on how that faces it. A glowing face lights up out of its own plane, so a flat panel level with it or below it gets none, and nor does the glowing face itself. Walls and sides above it that face it still get its light. Screens and backlit keys come out a little darker than before, by the share they used to give themselves, and the panels round them don't glow.

## In a camera's world, a device shown too small to use sleeps

A device in a world a `camera` shows, shown under 100 css px on its longer side and with markup that paints nothing of its own, gets `data-asleep` once the camera stops. Its children, its own canvas aside, are clipped to nothing (`clip-path: inset(50%)`), so the browser neither paints nor hit-tests them. They stay laid out, keyboard focus and screen readers still reach them, and a pointer over the device or focus in it wakes it. A page that put its own `clip-path` on a device's direct children loses it while the device sleeps. Code that hit-tests a small device's parts in a camera world (`elementFromPoint`, or a test clicking a part) should move the pointer over the device first.

## One light list: flashes and flames light the hardware, and air is lit by what the hardware gives off

`light({ at, reach, color })` from `diegetic-ui` puts a light in the room until it's removed, and `lights()` lists them, the torch first. Hardware is lit by the strongest four on each device, and the air by all of them. A room's `light()` and the recipes go through it, so a flash lights the knobs next to it as well as the smoke.

On `air()`, `shine`, `shineGain` and the `Shine` type are gone, and so is `lights` on the room. Air is lit by what the hardware really gives off, read from base: screens, lit lamps and readouts, as they're drawn. Drop `shine` and any colours you gave it. For a light of your own, use a recipe, or `room.light()`, or base's `light()`.

`impact`'s flash is on for the tenth of a second the arc burns and then out, where it used to die away by e each tenth. It gives the same light in all and no longer lingers.

## A camera's world is drawn on one canvas, and what's far off isn't painted

In a world a `camera` shows, devices are drawn by one shared canvas (`canvas[data-d=stage]`), not each by its own. A device's own `canvas[data-d]` there is empty and hidden. Code that read a device's pixels from its canvas in a camera world gets nothing. Devices it can't draw yet keep their own canvas: ones turned, faded, clipped or filtered by something round them, bodies with faces, and devices inside devices.

On every page, a device more than a window away from the window has `data-far` and is clipped to nothing on screen (`contain: paint; clip-path: inset(50%)`), so the browser neither paints nor hit-tests it. It keeps its size and place, and the keyboard and screen readers still reach it. A page that put its own `clip-path` or `contain` on devices loses them while they're far.

Under `.d-gl`, a canvas directly in a `d-screen` is `display: none`. Its drawing reaches the screen through the lit picture as before. Code that measured that canvas's box should measure the `d-screen`.

## Air: recipes, a burning source holds its heat, and plumes take in the room's air

`impact`, `shake`, `fire` and `vent` from `diegetic-ui/air` say what happens in joules, g, watts and m/s. Build effects from them, not from `plume`, `puff` and `sparks`; the site's one-way test now fails a demo that does. `room.light(l, seconds)` puts in a light that dies away, and `room.stir(k)` thickens the haze for a while; use them in place of decaying `lights` and `haze` by hand. A `Light` can give `candela` and `kelvin` in place of `color`.

A source's `heat` now holds the air in its opening at that heat instead of warming it a share a frame, and every plume takes in still air as a real one does, so jets and flames slow and cool within their own height. A source that relied on a big `heat` or `jet` reaching far wants a recipe, or less.

## Air: smoke lasts as long as the room takes to carry it off

`smoke` on `air()`, seconds, is gone. Use `draught`, how fast the room's air moves, m/s (0.1 by default): a plume's smoke lasts its longer side over that, so a 600 mm plume lasts 6 s. A page that set `smoke: 6` on room-sized plumes needs nothing.

## Air: heat lifts as hard as it really does, and sparks are smaller and faster

`rise` on `air()` is gone: heat now lifts the air by g ΔT / T, about 30 times what `rise: 0.5` gave, so smoke rises at real speeds. Drop `rise`. A source that used a large `heat` to get a visible rise can use a smaller one.

Sparks default to 0.25 mm drops thrown at 3 m/s, not 0.5 mm at 1.5, and are drawn over a 120th of a second, not a 30th. A burst that looked right as 30 big sparks wants about four times as many. Burning sparks now go out when their metal is used up.

## Air: a plume's cells come from its shape, and air finds its own quality

`cells` on a plume is gone. A plume's flow cells now come from its shape alone, 64 across its narrower side, so it moves the same at every zoom; the zoom only changes how finely it's drawn. Drop `cells` from plume calls.

The air canvas now runs at the device's own resolution and steps its quality down when frames run late and back up when they don't. `quality` on `air()` (0 to 3) holds one level, for tests, and `Air.quality` reads the current one.

## Air: a source's heat is its temperature, and a spark's size is the drop

A plume source's `heat` used to be added to the air every second it ran. Now it's how hot what the source puts in is, in units of 450 K over the room, and the air there comes to that heat, so hot gas glows as a black body at its temperature. Smoke off something smouldering is about 0.5, a flame 2.5 to 3. A number that used to give a gentle rise now lifts hard and glows, so divide old smoke values by about three.

`sparks(at, n, { size })` used to scale a streak's width. Now it's the drop's diameter in mm, half a millimetre by default. Sparks fall at real gravity, slow in the air, cool by what they radiate and lose to the air, glow as hot as they are, and land on `floor` (css px down the page, the bottom of the window by default). `kelvin` sets how hot they start and `metal` what they're made of. `white` on `air()` says how bright, cd/m², shows as white.

## Loose pieces go on a shelf, and `at` is gone

A `d-device loose` that's out used to lie where `at="x y"` put it. Now every piece that's out lies on the body's shelf, a column of outlined places beside it, and anything let go of away from the way in goes back there. The body takes a right margin to keep room for the shelf, and a framed body is scaled to fit with it. Drop `at` from spares, and leave room to the right of a body that has loose pieces.

## A surface without a material is made of what it's on

A `d-surface` with no `material` used to take its device's. Now it takes the nearest `d-surface` above it that has one, and the device's only when there is none. A groove or recess cut into a label or a panel of another material now shows that material. Give it a `material` of its own where it should be the device's.

## A back can carry layers of the body

A `d-surface` straight inside `<d-device reverse>`, with a `path`, a positive `height` and no box of its own, is now a layer of the body on its back, as a panel standing off a case's back is. The sides grow by its height and show it side on, and the middle of the body moves to stay halfway through all of it. Give its `path` in the body's coordinates with the body's `viewbox`. Take its height off the body's own `height`, as the Game Boy's is `DEPTH - SHELL - PANEL_UP`, so the whole stays as deep as the real thing.

## A body is a stack of layers, and its sides are worked out from it

A `d-surface` straight inside a body, with a `path`, a positive `height` and no box of its own, is now a layer of the body: the body is as deep as its own `height` and its layers' together, and throws its shadow from there unless `shadow` says otherwise. A side with no `path` shows the stack side on, each layer as far as its outline reaches at each row and set in where its edge rounds, so it ends where the front's corners curve away. Give a body's `height` without its layers, as the Game Boy's is `DEPTH - SHELL`, and drop the `path`, `viewbox` and `bevel` from its sides. A side with a `path` still draws that outline.

## A body turns as cards, and each face shows the others edge-on

A body with sides or a back used to be lit again at every angle on its way round. Now each face is lit once, straight on, rocks a little under a drag and whips round to the next face past a third of the way. A drag no longer holds it part way between two faces. Each face also draws the others where they stand past its edges, so a side shows the lens, the dials along the top and the back's thickness. Code that set `spun` part way between faces now shows the nearest face rocked toward the next, not the body turned that far. Set `engine.cards = false` for the old turn.

## A real mouse holds a pilot, and only a press stops it

Moving the real mouse used to stop a pilot. Now it holds the hand where it is, with whatever it has down, and the run's clock stops with it. `paused(on)` in the options hears it, and the flight's `resume()` lets it go on, or `pause()` holds it yourself. A press anywhere but `own`, a scroll or Esc still stop it, and a stop no longer waits out the step it was on. For the whole run the real mouse keeps its own arrow and never moves the glove. Code that waited on `done` after a mouse move should show a way to go on or stop.

## A body has sides, and `turned` says which face is up

`<d-device side="left">` and `side="right"` inside a body are its ends, and a drag lands on any face it has, a quarter turn at a time. `turned` now holds the face that's up: `left`, `right` or `back`, and bare still means the back, so `toggleAttribute('turned')` works as before. Code that read `turned` as a flag should read its value. A body resting on a side is `data-over` as it is on its back, and `data-up` names the face. Loose parts seated in the back show only with the back up.

## The hand only stays on what captured it

A pilot's hand used to send every move of a press to whatever it pressed. Now it does what a browser does: the moves go to whatever captured the pointer, and otherwise to whatever is under the hand, with `pointerover` and `pointerout` on the way, so a drag across keys goes over each one. A browser can't capture a pointer it didn't make, so code that captures calls `capture(el, e)` from `diegetic-ui` in place of `el.setPointerCapture(e.pointerId)`. It does the same for a real pointer and keeps the hand's. Drop any `if (e.isTrusted)` around a capture as you change it, or the hand's drags slide off.

A pilot also has a second hand now. A step can say `hand: 'left'`, and `with` gives the other hand steps to do while this one holds its press.

## `lean` turns on a drag, not a hover

A device with `lean` used to turn as the pointer crossed it. Hovering now only moves the light. Press its body and drag to turn it: it stays turned while the pointer is on it, and comes back when the pointer leaves. A drag that starts on a control still works the control, and a tilted phone still turns it. There's nothing to change in markup. Code that hovered to show a side now has to drag, and a page that sets its own `cursor` on the device overrides the grab cursor.

## Holographic foil is ruled

`holo-foil` is a metal with `grating: 1` on the `hot-foil` finish now, and shows one wide band of colour that slides with the lamp. It no longer has the embossed texture. `holo-foil-red` is the same foil in red. To rule your own, set `grating`, 0 to 1, on a metal.

## One package, with a path for each pack

There is one install now, `diegetic-ui`. Base is the package itself, the old kit is the `controls` pack, and every old family is a pack with its own path. Parts, tags, attributes and materials keep their names, so markup doesn't change. Only imports and the install do.

To move:

1. Replace every `@diegetic-ui/*` dependency with one on `diegetic-ui`.
2. Change each import with the table below.
3. Joints moved down to base, along with `limits` and `setValue`. `FOCUS` was already there and now comes from base only. Take them from `diegetic-ui`. Importing them from there doesn't load any parts, so a file that took only joints from the kit and relied on that import to load the parts now needs `import 'diegetic-ui/controls'` as well.
4. The materials `brick-red`, `brick-buff` and `mortar-lime` left `diegetic-ui/materials` for the masonry pack. `import 'diegetic-ui/masonry'` registers them, and its `materials` export lists them.
5. In `parts.json`, each part's `family` is now `pack`, and the values `core` and `kit` are now `base` and `controls`.

| Old | New |
|---|---|
| `@diegetic-ui/core` | `diegetic-ui` |
| `@diegetic-ui/kit` | `diegetic-ui/controls` |
| `@diegetic-ui/kit/watch` and every other family | `diegetic-ui/watch`, by the same name |
| `@diegetic-ui/kit/parts.json` | `diegetic-ui/parts.json` |
| `@diegetic-ui/materials` | `diegetic-ui/materials` |
| `@diegetic-ui/materials/catalogue` | `diegetic-ui/materials/catalogue` |
| `@diegetic-ui/print` | `diegetic-ui/print` |
| `@diegetic-ui/sound` | `diegetic-ui/sound` |
| `@diegetic-ui/hand` | `diegetic-ui/hand` |
| `@diegetic-ui/react` | `diegetic-ui/react` |
| `@diegetic-ui/script` | `diegetic-ui/script` |
| `spring`, `hinge`, `slide`, `turn`, `press`, `follow`, `held`, `mechanism`, `together`, from the kit | the same names, from `diegetic-ui` |
| `FOCUS`, `limits`, `setValue`, from the kit | the same names, from `diegetic-ui` |

`key`, `legend`, `words`, `letter`, `present`, `Pixels`, `haptics`, `icon`, `icons`, `lamp`, `scale`, `ground`, `fraction`, `controlStyles` and `keyStyles` stay with controls.

## Assemblies are one tag with their pieces as forms

A part stands alone. An assembly is one whole thing with one tag, and its pieces are that tag's forms: `d-watch="case"`, `d-telephone="handset"`, `d-tape="reel"`. A piece may need its assembly, inside that one family only, and still draws in any interface or loose on a page. A piece useful alone moved up to being a form of a part.

To move:

1. Change each old name in the tables below. As before, these are attributes on plain elements, and `[d-watch~="case"]` is the selector for one piece.
2. `kind` on a watch's hands and a pull tool is now a word: `d-watch="hands baton"`, `d-tool="pull pick"`. Leave it out as before.
3. `d-tape="reel"` lives in the `audio` family now, with the rest of tape. Add `import '@diegetic-ui/kit/audio'` wherever you use one.
4. The `w-` prefix is gone. A leftover `<w-case>` or `w-case` is now plain HTML and draws nothing, with no warning, so search for `w-` yourself. Old `d-` names still warn.

| Old | New |
|---|---|
| `d-telephone` | `d-telephone` |
| `d-handset` | `d-telephone="handset"` |
| `d-carriage` | `d-typewriter="carriage"` |
| `d-typebars` | `d-typewriter="typebars"` |
| `d-bell` | `d-typewriter="bell"` |
| `d-cassette` | `d-tape="cassette"` |
| `d-tapepath` | `d-tape="path"` |
| `d-reel` | `d-tape="reel"` |
| `d-platter` | `d-turntable="platter"` |
| `d-tonearm` | `d-turntable="tonearm"` |
| `d-liftdoors` | `d-lift="doors"` |
| `d-vaultdoor` | `d-vault="door"` |
| `d-hobring` | `d-hob="ring"` |
| `d-hobplan` | `d-hob="plan"` |
| `d-hobdigit` | `d-hob="digit"` |
| `d-chimney` | `d-lighter="chimney"` |
| `d-flintwheel` | `d-lighter="flintwheel"` |
| `d-camlever` | `d-lighter="camlever"` |
| `d-foldblade` | `d-tool="blade"` |
| `d-pulltool kind="pick"` | `d-tool="pull pick"` |
| `w-cushion` | `d-watch="cushion"` |
| `w-strap` | `d-watch="strap"` |
| `w-band` | `d-watch="band"` |
| `w-bracelet` | `d-watch="bracelet"` |
| `w-case` | `d-watch="case"` |
| `w-bezel` | `d-watch="bezel"` |
| `w-turnbezel` | `d-watch="turnbezel"` |
| `w-dial` | `d-watch="dial"` |
| `w-hands kind="spoke"` | `d-watch="hands spoke"` |
| `d-brickwork="soldier"` | `d-wall="brickwork soldier"` |
| `d-reveal` | `d-wall="reveal"` |
| `d-casement` | `d-wall="casement"` |
| `d-sill` | `d-wall="sill"` |
| `d-shelf="wall"` | `d-library="shelf wall"` |
| `d-book="spine"` | `d-library="book spine"` |

These are now forms of a part, because they don't need the thing they came from. Each stays in the family it was in, so `d-wheel="crown"`, `d-glass="cover"` and `d-key="pusher"` import `@diegetic-ui/kit/watch`, and `d-wheel="rotary"` stays in the base kit.

| Old | New |
|---|---|
| `d-dial` | `d-wheel="rotary"` |
| `w-crown` | `d-wheel="crown"` |
| `w-crystal` | `d-glass="cover"` |
| `[w-pusher]` | `d-key="pusher"` |

## Parts are one tag per mechanism

A part is a mechanism, and its shape is a value. About 120 tags became a few parts, each an attribute on a plain element: `<d-fader>` is now `<div d-slider="fader">`. What each one draws has not changed.

To move:

1. For each old tag in the tables below, change the opening tag to `<div part="form" ...>` and its closing tag to `</div>`. A plain form has no value, so `<d-knob>` is `<div d-knob>`. Everything else on the tag stays.
2. In JSX write the empty value, `d-knob=""`. A bare `d-knob` is `true` in JSX, not an empty string, and React wants `className` on a `div`.
3. In a stylesheet or a query, `d-fader` becomes `[d-slider~="fader"]`, `d-knob` becomes `[d-knob=""]`, and `[d-stick]` is every stick, as `d-stick` was. An attribute selector is stronger than a tag, so check rules that used to lose to a class.
4. Look for rules on `div` that now catch a part, such as `.row > div`. Exclude it: `.row > div:not([d-knob])`.
5. `document.createElement('d-fader')` becomes a `div` with `setAttribute('d-slider', 'fader')`.
6. A value that names no form warns in the console and draws nothing, as an unknown tag does. Words after the form are options, and `d-stick="dpad disc"` is one. A misspelt option warns too, on forms that list their words.

Old tags are not kept as aliases. An old tag warns that it matches no part.

From `@diegetic-ui/react`, `Knob`, `Fader`, `Toggle` and the rest keep their names and props.

| Old | New |
|---|---|
| `<d-knob>` | `d-knob` |
| `<d-selector>` | `d-knob="pointer"` |
| `<d-fluted>` | `d-knob="fluted"` |
| `<d-fluteknob>` | `d-knob="flared"` |
| `<d-capknob>` | `d-knob="cap"` |
| `<d-encoder>` | `d-knob="encoder"` |
| `<d-skirtknob>` | `d-knob="skirt"` |
| `<d-stemknob>` | `d-knob="stem"` |
| `<d-modedial>` | `d-knob="mode"` |
| `<d-jog>` | `d-knob="jog"` |
| `<d-thumbwheel>` | `d-wheel="thumb"` |
| `<d-edgewheel>` | `d-wheel="edge"` |
| `<d-drumdial>` | `d-wheel="drum"` |
| `<d-turnring>` | `d-wheel="ring"` |
| `<d-lensring>` | `d-wheel="lens"` |
| `<d-tuningdisc>` | `d-wheel="tuning"` |
| `<d-spindisc>` | `d-wheel="spin"` |
| `<d-wheel>` | `d-wheel="click"` |
| `<d-crank>` | `d-wheel="crank"` |
| `<d-spokewheel>` | `d-wheel="spoke"` |
| `<d-fader>` | `d-slider="fader"` |
| `<d-lever>` | `d-slider="lever"` |
| `<d-slide>` | `d-slider="nub"` |
| `<d-touchstrip>` | `d-slider="strip"` |
| `<d-edgeslide>` | `d-slider="edge"` |
| `<d-trigger>` | `d-slider="trigger"` |
| `<d-toggle>` | `d-switch="toggle"` |
| `<d-springtoggle>` | `d-switch="spring"` |
| `<d-rocker>` | `d-switch="rocker"` |
| `<d-keyswitch>` | `d-switch="key"` |
| `<d-rockerkey>` | `d-switch="seesaw"` |
| `<d-flicklever>` | `d-switch="flick"` |
| `<d-rockbar>` | `d-switch="bar"` |
| `<d-stick>` | `d-stick` |
| `<d-xypad>` | `d-stick="pad"` |
| `<d-dpad>` | `d-stick="dpad"` |
| `<d-mouse>` | `d-stick="mouse"` |
| `<d-guard>` | `d-cover="guard"` |
| `<d-lid>` | `d-cover="lid"` |
| `<d-liftcap>` | `d-cover="cap"` |
| `<d-clearlid>` | `d-cover="clear"` |
| `<d-stick kind="analog">` | `d-stick="analog"`, and `gimbal`, `hat` the same way |
| `<d-dpad kind="disc">` | `d-stick="dpad disc"`, and `ring`, `cross` the same way |
| `<d-lamp>` | `d-lamp` |
| `<d-annunciator>` | `d-lamp="annunciator"` |
| `<d-arrow>` | `d-lamp="arrow"` |
| `<d-halo>` | `d-lamp="halo"` |
| `<d-backlight>` | `d-lamp="backlight"` |
| `<d-gauge>` | `d-meter="gauge"` |
| `<d-vu>` | `d-meter="vu"` |
| `<d-bargraph>` | `d-meter="bargraph"` |
| `<d-ring>` | `d-meter="ring"` |
| `<d-lightbar>` | `d-meter="lightbar"` |
| `<d-compass>` | `d-meter="compass"` |
| `<d-dialstrip>` | `d-meter="strip"` |
| `<d-tuner>` | `d-meter="tuner"` |
| `<d-clock>` | `d-meter="clock"` |
| `<d-clockhands>` | `d-meter="hands"` |
| `<d-lcd>` | `d-readout="lcd"` |
| `<d-seven>` | `d-readout="seven"` |
| `<d-segments>` | `d-readout="segments"` |
| `<d-starburst>` | `d-readout="starburst"` |
| `<d-nixie>` | `d-readout="nixie"` |
| `<d-flip>` | `d-readout="flip"` |
| `<d-odometer>` | `d-readout="odometer"` |
| `<d-matrix>` | `d-readout="matrix"` |
| `<d-lamp kind="led">` | `d-lamp="led"`, and `pin`, `bar`, `window` the same way |
| `[d-readout]` | `d-readout`, unchanged, but a selector for the plain one is now `[d-readout=""]` |
| `<d-clockdigits>` | `d-readout="seven clock"`, from `@diegetic-ui/kit/audio` |
| `[d-glow]`, `[d-bar]` | Removed. Glows and bar charts are software: draw them on a `d-screen`. A screen ignores alpha, so fade to black |
| `<d-glass kind="smoked">` | `d-glass="smoked"`. No `kind` is `d-glass="frosted"`, and `clear` goes the same way |
| `<d-crystal>` | `d-glass="crystal"` |
| `<d-lens>` | `d-glass="lens"` |
| `<d-flash>` | `d-glass="flash"` |
| `d-label` | `d-mark="label"` |
| `d-label="print"` | `d-mark="label flat"` |
| `d-stamp` | `d-mark="stamp"` |
| `d-plate` | `d-mark="plate"` |
| `d-dymo` | `d-mark="dymo"` |
| `<d-print kind="pad">` | `d-mark="print pad"`, and `silk`, `etch`, `mould`, `foil`, `emboss`, `deboss` the same way. No `kind` is `d-mark="print"`, silk |
| `<d-sticker>` | `d-mark="sticker"` |
| `<d-ringtext>` | `d-mark="ring"` |
| `<d-dialscale>` | `d-mark="scale"` |
| `<d-grille>` | `d-opening="grille"` |
| `<d-vent>` | `d-opening="vent"` |
| `<d-speakerdisc>` | `d-opening="speaker"` |
| `<d-cone>` | `d-opening="cone"` |
| `<d-port kind="hdmi">` | `d-port="hdmi"`. No `kind` is `d-port="usbc"`, and `usba`, `jack`, `sd`, `modular` go the same way |
| `<d-bnc>` | `d-port="bnc"` |
| `<d-header>` | `d-port="header"` |
| `d-slot="jack"` | `d-port="edge jack"`, and `usbc`, `usba` the same way |
| `<d-diskslot>` | `d-port="disk"` |
| `<d-screwhead>` | `d-fixing="screw"` |
| `<d-socketscrew>` | `d-fixing="socket"` |
| `<d-rivet>` | `d-fixing="rivet"` |
| `<d-screwcap>` | `d-fixing="cap"` |
| `<d-eyelet>` | `d-fixing="eyelet"` |
| `<d-stronglug>` | `d-fixing="lug"` |
| `<d-splitring>` | `d-fixing="ring"` |
| `<d-pianohinge>` | `d-fixing="hinge"` |
| `<d-icon>` | Removed. A software icon set is not a part. Draw one with `icon()` from the kit, or print it with `d-mark="print"` and `path` |
| `Icon` from `@diegetic-ui/react` | Removed with it |

Keys went first, from attributes on a `<button>`:

| Old | New |
|---|---|
| `[d-key]` | `d-key` |
| `[d-arcade]` | `d-key="arcade"` |
| `[d-button]` | `d-key="flush"` |
| `[d-tab]` | `d-key="tab"` |
| `[d-chiclet]` | `d-key="chiclet"` |
| `[d-mech]` | `d-key="mech"` |
| `[d-face]` | `d-key="face"` |
| `[d-slabkey]` | `d-key="slab"` |
| `[d-membranekey]` | `d-key="membrane"` |
| `[d-softkey]` | `d-key="soft"` |
| `[d-sensor]` | `d-key="sensor"` |
| `[d-switchkey]` | `d-key="switch"` |
| `[d-laptopkey]` | `d-key="scissor"` |
| `[d-sculptkey]` | `d-key="sculpt"` |
| `[d-screenkey]` | `d-key="screen"` |
| `[d-sidekey]` | `d-key="side"` |
| `[d-keymat]` | `d-key="mat"` |
| `[d-bumper]` | `d-key="bumper"` |
| `[d-guide]` | `d-key="guide"` |
| `[d-pillkey]` | `d-key="pill"` |
| `[d-ringkey]` | `d-key="ring"` |
| `[d-touchkey]` | `d-key="touch"` |
| `[d-edgekey]` | `d-key="edge"` |
| `[d-step]` | `d-key="step"` |
| `[d-plunger]` | `d-key="plunger"` |
| `[d-lampkey]` | `d-key="lamp"` |
| `[d-typekey]` | `d-key="type"` |
| `[d-drumpad]` | `d-key="drum"` |
| `[d-tilekey]` | `d-key="tile"` |
| `[d-pianokey]` | `d-key="piano"` |

## `scale` replaces hand-set `zoom`

`scale` is one attribute on a `d-device` or a loose part. A device that used `zoom` still works, but nothing owns it, so it won't follow the page and it can fight `scale`. To move:

1. Search for `zoom` in your CSS, inline styles and scripts, and for any fit-to-width code of your own, such as a `ResizeObserver` that sets a zoom.
2. Ask what each one is.
   - It has one shape and got smaller to fit: remove the `zoom` and write `scale="fit"`. If it was shown bigger than its size, write `scale="fit 2"` with the most it may be.
   - People work in it, and it keeps its scale and rearranges: replace `zoom: 0.3` with `scale="0.3"`. Add a phone layout in your CSS if it has none.
   - A `zoom` that changed in a media query: set a width on the element holding it in that media query, and put `scale="fit"` on the part.
3. Remove the observer or the event listener that set the zoom. A `fitted` event still bubbles from the element after each fit, so code that follows a fit keeps working.
4. A page that frames what it shows, with its own rule for how big, calls `frame(el, view)` from `@diegetic-ui/core`. `view` gets the element's width and height and gives the most it may be shown at. `frame` returns what stops it.
5. Load the page at 390 and at your widest width. Check that `document.documentElement.scrollWidth` equals `innerWidth`.

`scale` is read from the attribute, and changing or removing it takes effect at once. Removing it clears the zoom.

## `pitch` on `d-screen`

Not breaking. A `d-screen` that shows a page of HTML can take `pitch`, in mm between pixels, and leave out its `<canvas>`. The panel then gets as many pixels as fit it, however its size changes.
