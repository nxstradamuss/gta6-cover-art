# Vice Cover — a portrait, printed as a crime-poster cover

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/nxstradamuss/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/nxstradamuss/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Hand it a photograph and a few words and it hands back a sleeve: the picture is broken
into a set of hard-edged frames, every frame is printed in a saturated colour wash, and a
heavy display wordmark is set in the band below — or, in the one-panel layout, laid
straight across the art. It is a browser page and nothing else. The files are read from
your own disk, the composition is painted with the Canvas 2D API, and the result comes
back as a PNG you can post.

## What it does

- **An editor, not a form.** Drop one photo or a dozen anywhere on the page, or click the
  drop zone; the whole window is a target. A strip of five bundled shots sits under it for
  when you have nothing to hand. Below that: layout chips drawn as little diagrams of
  their own grid, size chips, a title field with a kicker and a subtitle, grade swatches,
  a reshuffle button, and an export button. Click a panel to select it and drag inside it
  to move where that panel's crop is centred; a tag over the frame names the shot you are
  moving and the outline stays on its own overlay canvas, so neither ever reaches the PNG.
- **Four arrangements.** `Vice` is the full poster: five frames, a tall hero up the middle
  with two stacked frames down each side, the side columns split 54/46 so the four
  supporting prints are not carbon copies of one another. `Duo` and `Triptych` divide the
  art area into two and three equal columns. `Hero` throws the grid away for a single
  full-bleed frame with the title floating over the picture instead of sitting under it.
  Geometry is computed in pixels for the canvas it is about to be drawn on, so nothing
  drifts between the three export shapes.
- **Six colour grades.** Sunset (magenta sky over amber heat), Neon (cyan in the shadows,
  hot pink in the light), Dusk (violet and indigo), Gold (honey, with the blacks lifted),
  Vice (pink from one side of the frame, turquoise from the other, a hard seam between
  them) and Noir (cold and nearly colourless). Each is a recipe of compositing passes over
  the photo: a duotone or a real gradient map that reads every pixel's own luminance and
  looks it up in a two- or three-ink ramp, then gradients in overlay, soft-light, screen
  and multiply, with a squashed radial bloom screened across the frame where a street's
  signs would smear their light. The ramp is levelled against the picture's own 2nd and 98th
  percentiles, so a hazy shot still reaches both inks instead of flattening into one
  violet wash.
- **Automatic grading that keeps one story.** On `Auto` the cover is keyed to the hero
  photo's dominant hue: of the two neon-family grades, whichever accent sits *furthest*
  from that hue wins, so the grade carries the picture somewhere new rather than nudging
  it a few degrees. Every panel then draws a member from that grade's narrow family —
  grades within 45 degrees of the key, or the key itself rotated ±12 and ±24 degrees — each
  with its own heat and depth. Two panels that share an edge never wear the same member,
  and the least-worn members are handed out first. The whole collage varies in intensity,
  never in hue family. Pick a grade by hand and it is worn straight, on every panel.
- **Framing that knows where the subject is.** A saliency pass shrinks the photo to 48 by
  48 cells, scores each cell by luminance gradient weighted by its chroma and a mild
  centre bias, and takes the centroid of the cells above 60% of the peak as the subject's
  position. Crops are then built around that point, so a face does not end up half out of
  frame. Five shot types carry five magnifications — wide, hero, close, detail, low angle —
  and any of them may be mirrored. When one photo has to fill more than one panel it is
  given a shot at least 0.35 apart in zoom from every earlier use, stepped across the
  frame, and flipped, so the same person is never cropped the same way twice.
- **A wordmark that fits itself.** The title is drawn letter by letter from a condensed cut
  of the system display stack, leaning forward eight degrees with tight tracking: a wide
  glow, a hard offset shadow, an outer keyline and a thinner machined line inside it, a
  cream-to-amber fill with a gloss clipped to the glyphs. It goes on one line while it can
  stay big and wraps to two when it cannot, is centred in whatever room the band leaves,
  and is rasterised once into a cached bitmap so typing and dragging stay responsive. The
  kicker is set small and tracked wide above it, the subtitle larger below, both with
  hairline rules and both in the grade's accent. The band's own colour is sampled back off
  the finished collage, so it belongs to the picture rather than sitting under it as a
  black bar.
- **A final exposure pass.** A panel that came out far darker than the rest is lifted
  toward the composition's median, so the grid has no hole in it, and one shared wash of
  the key accent, a corner light, a vignette and a grain tile are laid over the whole
  canvas — the panels read as one photograph cut into pieces, not six unrelated prints.
- **Export at three sizes, or your own.** 1080 × 1080, 1080 × 1350 and 1920 × 1080, with a
  custom width and height from 320 to 4096. The file is named for the title, the layout and
  the dimensions. Every change repaints at most once per animation frame, and the whole
  document is seeded, so the same inputs always produce the same pixels.

## Run it

The app is static, so a plain file server is all it needs. The repository ships a small one
(Node 22, standard library only):

```sh
node serve.ts
# then open http://localhost:8080
```

To produce the graded dossier — the app and the screenshots copied into an output
directory beside a `dossier.json` that records the entry's file and byte counts against the
scorer's caps:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Nothing leaves the browser

There is no network request anywhere in the page: no CDN, no web font, no analytics, no
library, and no build step, so what sits in `app/` is exactly what the browser executes —
one HTML file, its ES modules, one stylesheet. Type is set from fonts already installed on
the machine and every mark is drawn with Canvas 2D; no game artwork, logo or font is
shipped or reproduced. The five photographs in `app/samples/` are CC0 or supplied by
make.fun, and are free to use.

## Licence

MIT — see [LICENSE](LICENSE).

<sub>Entered on [make.fun](https://make.fun/?ref=17v52qxt&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
