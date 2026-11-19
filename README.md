# Vice Cover — photo to game-cover art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/nxstradamuss/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/nxstradamuss/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Cover turns a person's photo and a short caption into cover art laid out like a
multi-panel crime-game poster: the photograph is cut into a grid of frames, each frame is
cropped to the subject and printed in a neon colour grade, and a heavy wordmark is lettered
underneath it. The whole thing runs offline in the browser — the page reads photos from the
visitor's own machine, paints the cover on a canvas, and exports it as a PNG at 1080x1080,
1080x1350 or 1920x1080. There is no server, no build step and no library.

## What it does

- **Four panel layouts.** `Vice` is five panels — a tall hero flanked by two columns of two
  stacked frames. `Duo` is two equal frames, `Triptych` three, and `Hero` a single full-bleed
  frame with the title floating over the art instead of in a band beneath it. Every layout is
  measured in pixels for the exact canvas it is drawn on, so the design holds at all three
  export sizes.
- **Six colour grades.** Sunset, Neon, Dusk, Gold, Vice and Noir. Each is a stack of
  compositing passes over the photograph: a duotone or a true gradient map keyed to each
  pixel's own luminance, then gradients in overlay, soft-light, screen, multiply and
  color-dodge, with the source's saturation and contrast baked into the same draw. The light
  — sun, vignette, grain — is shared by every panel, so the grid reads as one photograph cut
  into pieces rather than six unrelated pictures.
- **Auto grading.** Left on `Auto`, the shot plan picks a key grade for the whole cover from
  the hero photo's dominant hue, then deals each panel a member of that grade's family at its
  own tone (shifted a few degrees, hotter or deeper). Two touching panels never wear the same
  member. Choosing a grade by hand overrides the plan for every panel.
- **Smart cropping per panel.** Before a photo is used, a saliency pass shrinks it to a 48x48
  grid, scores each cell by luminance gradient and colour, with a mild bias toward the centre,
  and takes the centroid of the strongest cluster as the subject's position. Panels are then
  framed around that point, so a crop does not cut a face off. The plan gives each panel its
  own shot — wide, hero, close, detail or low angle — at distinct magnifications, and mirrors
  some of them, so the same person never appears in the same crop twice.
- **An auto-fitting wordmark.** The title is drawn glyph by glyph in a condensed, forward-leaning
  display face assembled from system fonts: glow, offset shadow, two keylines, a cream-to-amber
  fill with a gloss across the top. It is fitted to the band, set on one line if it can stay
  large and wrapped onto two if it cannot, and cached as a bitmap so typing and dragging stay
  responsive. The kicker and subtitle are tracked and fitted the same way, and the whole band
  takes its colour from the collage it sits under.
- **Editor controls.** Drop or choose one or several photos (the whole page accepts a drop),
  load any of the five bundled sample shots, pick a layout, pick a size, type a title, kicker
  and subtitle, pick a grade, reshuffle the composition, and click a panel to select it and drag
  inside it to reposition that panel's crop by hand.
- **PNG export.** One button paints the cover at the chosen size and saves it as a PNG named
  for its title, layout and dimensions. The selection outline and panel tags are drawn on a
  separate overlay canvas and never appear in the exported file.

## Run it

Serve the static app with the tiny Node server in the repository (Node 22, standard library
only) and open the address it prints:

```sh
node serve.ts
# then open http://localhost:8080
```

To produce the graded dossier — the app, the screenshots and `dossier.json` written into an
output directory:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` beside itself into the output directory unchanged
and writes `dossier.json` there with the entry's file and byte counts.

## Offline, and free of dependencies

The app makes no network request: no CDN, no web font, no analytics, no library. It is plain
static files — one HTML page, its ES modules and one stylesheet — and there is no build step,
so what is in `app/` is exactly what the browser runs. Everything is drawn with the Canvas 2D
API and the fonts already on the machine; no game artwork, logo or font is shipped or
reproduced. The five sample photographs under `app/samples/` are CC0 or supplied by make.fun
and are free to use.

## Licence

MIT. See [LICENSE](LICENSE).

<sub>Entered on [make.fun](https://make.fun/?ref=17v52qxt&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
