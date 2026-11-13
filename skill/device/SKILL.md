---
name: device
description: Make a real physical device or object (a Walkman, a calculator, a camera, a remote, a synth, a watch) in Device UI, at its real size in mm, from reference photos. Use when asked to "make me a <device>", or to recreate, replicate or model a real product or gadget with Device UI.
---

# Make a device

You build one real thing as a Device UI device: its body, every control on it and its print, at real size in mm, measured off photos. The library draws. You only compose: parts from its packs, materials from its list, sizes and options. This skill is the method. The [panel skill](../panel/SKILL.md) beside it is the library: its `reference/parts.md` lists every part and `reference/materials.md` every material.

[reference/method.md](reference/method.md) has each step in depth, with what each tool prints. Read it once before your first device.

## Set up

```bash
npm i device-ui
npm i -D playwright && npx playwright install chromium
npx device-ui
```

The last line lists the tools: `new`, `ref`, `measure`, `trace`, `look`, `serve`. `ref`, `measure`, `trace` and `look` need Playwright; without it they say so and stop. Photos go in `reference/` and pictures in `.look/`. Both folders hold a `.gitignore` of `*`: photos belong to whoever took them, so never commit or publish them.

## The steps, in order

1. **Pick the exact model.** "A Walkman" is many things. Choose the best-known one (say which: "Sony WM-2, 1981") unless the user named one. Find its real width, height and depth in mm with a web search (the maker's spec page, a manual, a retailer listing); no tool here does it. Those are `spec`. Reissues, revisions and regional versions often differ in size and detail: sizes and photos must all be of the one you chose, and the straight-on photo's width to height must match the spec's.
2. **Look at 5 to 10 photos.** `npx device-ui ref <id> "<maker> <model> <what it is>"`, then read `reference/<id>/sheet.jpg`, then open the best photos one by one. Search again with other words if fewer than 5 are useful.
3. **Pick the straight-on photo**: the face square to the camera, no tilt, the whole outline in frame. `npx device-ui ref <id> --front <n>` makes it `front.jpg`. Layout is measured on it. Form is read off the angled and side photos.
4. **Say the form, in writing, before any code.** The body's outline and section: which edges round over and by how much, what steps up from what, what is recessed, how far each control stands proud, what each region is made of (substance, finish, colour). Then list every feature on the face and the library part that is it: grep `../device-ui/reference/parts.md`, then read that part's section in `reference/parts/<group>.md`. A feature with no part: see *When the library lacks a part*.
5. **Measure.** `npx device-ui measure reference/<id>/front.jpg <W>x<H>` gives a pixel grid to read the four corners off. Run it again with `--corners x,y x,y x,y x,y` (clockwise from top left) and read every position and size off `.look/measure.png` in mm. `--zoom x,y,w,h` for small things, `--list` for print, `--circle` for round ones, `--colour x,y` for colours. Curved outlines: `npx device-ui trace`, or `measure --outline`.
6. **Start the page.** `npx device-ui new <id> <W> <H>` writes `devices/<id>.html`. The page has every pack already: no imports. Write the mm block at its top: every size a named constant, each marked `// spec`, `// measured` or `// guess`. Repeats come from a pitch, not a list of guesses.
7. **Compose.** One `d-device` for the body, `d-surface` for every raised or sunk region, the parts you listed, `d-mark="print ..."` for every word and logo. Nest as the real thing is: what sits in a recess or on a plate goes inside that `d-surface`. Place each with `place="x y w h"` in mm from its holder's top left.
8. **Look.** `npx device-ui look devices/<id>.html`. Read `.look/<id>.png` (every state, heights, close-ups, the photo) and `.look/<id>.txt` (each part's box in mm, what it runs into, what each state changed). Fix every `!` error by fixing its cause, never by changing a measured size to quiet it. Read every `~` warning. Add a state in `window.look` for each control, so every one is pressed, turned or slid once.
9. **Compare to the photo and fix.** Put `.look/<id>.png` beside `reference/<id>/front.jpg`. Write down the three biggest differences: proportions first, then form, then material, then print. Fix them from measurements, not by eye. Look again. Two or three rounds is normal.
10. **Report.** The page and how to open it (`npx device-ui serve`), the sheet, which sizes are still `guess`, and anything the library lacked.

## Rules

- **Composition only.** The page holds library tags, sizes, materials and options. Never draw: no CSS colour, background, gradient, border or shadow on anything inside the device, no `<img>`, SVG picture or canvas drawing of the body, no copy of the photo, no `definePart` or `defineMaterial`. A part's colour is its `material`, or its `color` where its table has one.
- **Real millimetres.** Every size comes from the real thing. 1 css px is 0.25 mm (`MM` is 4 px per mm). Never scale a size to make it look right: the page shows the device as large as fits with `scale="fit 3"`.
- **Straight-on, one body.** Draw the face as seen square-on. No painted perspective, no trapezoid, no band copied from a photo's angle, no stacked views of one object. A back or side is `<d-device reverse>` or `side="left"` inside the body (see the library skill), never a second device.
- **Never draw past a part that exists.** Before making anything out of `d-surface`s, grep the parts list for what it is: a grille is `d-opening`, a screw `d-fixing`, an LED `d-lamp`, a window `d-glass`, a jack `d-port`, text `d-mark`. A `d-surface` is for the body's own shapes: plates, steps, recesses, wells.
- **Pick parts by what they are, not whose they are.** The Walkman's play key is a `d-key` form, a camera's mode dial a `d-knob` or `d-wheel` form. Choose the form whose mechanism and section match the real one.
- **Materials from the list.** Pick by substance and finish first (matte or gloss, plastic or metal or rubber, as the photo shows it), then the colour. If no colour is close, take the nearest in the right finish and report the gap. An unknown name warns in the console.

## When the library lacks a part

Stop and tell the user before you build round it. Say what the real thing has, the nearest part and why it doesn't fit, and what the library would need (a new part, a new form, or an option on one that exists). Don't fake it with stacked surfaces, CSS or a picture. If the user says to go on without it, leave that place empty and list it in your report.

The same goes for anything else the library can't do: a curve, a material, a face the turn can't reach. Say so; don't route round it.

## Done means

The page loads with no errors in `look`, every control has a state that works, the sheet next to the photo reads as the same object at a glance, and every number in the mm block is marked.
