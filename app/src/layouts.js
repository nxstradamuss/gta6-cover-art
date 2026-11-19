// Panel geometry for the four cover layouts. Every layout is measured in pixels for the exact canvas it will be
// drawn on, so the same design holds at 1080 x 1080, 1080 x 1350 and 1920 x 1080.

export const LAYOUT_IDS = ['vice', 'duo', 'triptych', 'hero'];

export const LAYOUT_NAMES = { vice: 'Vice', duo: 'Duo', triptych: 'Triptych', hero: 'Hero' };

export const LAYOUT_HINTS = {
  vice: 'Five panels, tall hero',
  duo: 'Two equal frames',
  triptych: 'Three equal frames',
  hero: 'One full-bleed frame',
};

/** The dark gap between panels, scaled with the canvas but never thinner than 6 px or fatter than 14 px. */
export function gutterFor(w, h) {
  return Math.min(14, Math.max(6, Math.min(w, h) * 0.009));
}

/**
 * The title band's height. It is generous on purpose: the wordmark has to sit in it at poster scale, so the band
 * takes close to a third of the frame. The hero layout has no band: its title sits over the photograph.
 */
function titleBandHeight(id, w, h) {
  if (id === 'hero') return 0;
  return Math.round(h * (w > h ? 0.32 : 0.31));
}

/** Keeps a rectangle sane on very small canvases. */
function panel(x, y, w, h, seed) {
  return { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)), seed };
}

/**
 * Returns the panels and the title band for a layout id at a given canvas size.
 * Panels never overlap and never reach into the title band (except in `hero`, where the title floats over the art).
 */
export function getLayout(id, w, h) {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const gutter = Math.round(gutterFor(W, H));
  const bandH = titleBandHeight(id, W, H);
  const artH = Math.max(1, H - bandH);
  const panels = [];

  if (id === 'duo' || id === 'triptych') {
    const columns = id === 'duo' ? 2 : 3;
    const columnWidth = (W - gutter * (columns - 1)) / columns;
    for (let i = 0; i < columns; i += 1) {
      const x = Math.round(i * (columnWidth + gutter));
      const right = i === columns - 1 ? W : Math.round(x + columnWidth);
      panels.push(panel(x, 0, right - x, artH, 11 + i * 37));
    }
  } else if (id === 'hero') {
    panels.push(panel(0, 0, W, H, 11));
  } else {
    // vice: two narrow columns of two stacked panels around one tall hero panel
    const sideWidth = Math.round((W - gutter * 2) * 0.285);
    const centreX = sideWidth + gutter;
    const centreWidth = Math.max(1, W - sideWidth * 2 - gutter * 2);
    const rightX = centreX + centreWidth + gutter;
    const splitLeft = Math.round((artH - gutter) * 0.54);
    const splitRight = Math.round((artH - gutter) * 0.46);
    panels.push(panel(centreX, 0, centreWidth, artH, 11));
    panels.push(panel(0, 0, sideWidth, splitLeft, 48));
    panels.push(panel(0, splitLeft + gutter, sideWidth, artH - splitLeft - gutter, 85));
    panels.push(panel(rightX, 0, sideWidth, splitRight, 122));
    panels.push(panel(rightX, splitRight + gutter, sideWidth, artH - splitRight - gutter, 159));
  }

  const titleBox = id === 'hero'
    ? {
      x: Math.round(W * 0.05),
      y: Math.round(H * 0.58),
      w: Math.round(W * 0.9),
      h: Math.round(H * 0.34),
    }
    : { x: 0, y: artH, w: W, h: Math.max(1, bandH) };

  return { panels, titleBox, gutter, artH };
}
