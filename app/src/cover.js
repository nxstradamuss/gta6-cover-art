// Draws the whole cover: the panel collage, each photograph cropped to its focus point and graded, the dark
// gutters, the lettered title band, and one last warm cast and vignette over everything so the collage reads as a
// single piece of art.

import { applyGrade } from './grades.js';
import { drawTitle, drawTrackedText, fitTitleBlock, measureTracked } from './lettering.js';
import { getLayout } from './layouts.js';
import { makeRandom, panelGrade, primaryGrade } from './state.js';

const BASE = '#07050c';
const DEEP = '#04030a';

/** Clamps a number into a range. */
function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** Fits `image` into the rect currently clipped and translated to the panel origin. */
function coverPhoto(ctx, image, rect, panel) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return false;
  try {
    const zoom = clamp(panel.zoom ?? 1, 1, 3);
    const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = clamp(rect.w * 0.5 - (panel.focusX ?? 0.5) * dw, rect.w - dw, 0);
    const dy = clamp(rect.h * 0.4 - (panel.focusY ?? 0.42) * dh, rect.h - dh, 0);
    ctx.drawImage(image, dx, dy, dw, dh);
    return true;
  } catch {
    // An image the browser refuses to draw (a broken file, a half-decoded blob) falls back to a graded panel.
    return false;
  }
}

/** A panel with no photograph: a graded gradient that still looks like a frame of film, never a blank hole. */
function drawEmptyPanel(ctx, rect, grade) {
  const wash = ctx.createLinearGradient(0, 0, rect.w * 0.6, rect.h);
  wash.addColorStop(0, grade.palette.outline);
  wash.addColorStop(0.55, '#1b0f28');
  wash.addColorStop(1, '#0a0612');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, rect.w, rect.h);

  const glow = ctx.createRadialGradient(rect.w * 0.5, rect.h * 0.38, 0, rect.w * 0.5, rect.h * 0.38, Math.max(rect.w, rect.h) * 0.62);
  glow.addColorStop(0, grade.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, rect.w, rect.h);
  ctx.restore();
}

/** A soft dark shadow hugging the inside of every panel edge, so panels sit behind the frame rather than on it. */
function insetShadow(ctx, w, h) {
  const depth = Math.min(w, h) * 0.12;
  const dark = 'rgba(4,2,8,0.55)';
  const clear = 'rgba(4,2,8,0)';
  const bands = [
    [0, 0, w, depth, 0, 0, 0, depth],
    [0, h - depth, w, depth, 0, h, 0, h - depth],
    [0, 0, depth, h, 0, 0, depth, 0],
    [w - depth, 0, depth, h, w, 0, w - depth, 0],
  ];
  for (const [x, y, width, height, x0, y0, x1, y1] of bands) {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, dark);
    gradient.addColorStop(1, clear);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  }
}

/** Draws every panel: clip, crop, grade, then the inner shadow. */
function drawPanels(ctx, state, geo) {
  geo.panels.forEach((rect, index) => {
    const panel = state.panels[index] ?? { photoIndex: -1, focusX: 0.5, focusY: 0.42, zoom: 1, gradeIndex: index };
    const grade = panelGrade(state, panel);
    const photo = state.photos[panel.photoIndex];

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.translate(rect.x, rect.y);

    const drawn = photo && photo.image ? coverPhoto(ctx, photo.image, rect, panel) : false;
    if (!drawn) drawEmptyPanel(ctx, rect, grade);

    applyGrade(ctx, rect.w, rect.h, grade, { x: rect.x, y: rect.y });
    insetShadow(ctx, rect.w, rect.h);
    ctx.restore();
  });
}

/** A crisp dark keyline on every panel edge, so the gutters read as gaps between prints. */
function drawGutters(ctx, geo, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(3,2,6,0.92)';
  ctx.lineWidth = Math.max(1, Math.min(geo.gutter, Math.round(Math.min(w, h) * 0.006)));
  for (const rect of geo.panels) {
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(1, rect.w - 1), Math.max(1, rect.h - 1));
  }
  ctx.restore();
}

/** A hairline, used either side of the kicker. */
function hairline(ctx, x0, x1, y, colour, thickness = 1) {
  if (x1 <= x0) return;
  ctx.fillStyle = colour;
  ctx.fillRect(x0, Math.round(y), Math.max(1, x1 - x0), Math.max(1, Math.round(thickness)));
}

/**
 * The title band: dark glass, a bright accent rule, the kicker in tracked capitals, the logo, then the subtitle.
 * With `floating` (the hero layout) it becomes a scrim over the photograph instead of an opaque band.
 */
function drawTitleBand(ctx, state, geo, w, h, floating = false) {
  const band = geo.titleBox;
  const grade = primaryGrade(state);
  const palette = grade.palette;
  const margin = Math.round(w * 0.055);

  if (floating) {
    const scrim = ctx.createLinearGradient(0, band.y - band.h * 0.35, 0, h);
    scrim.addColorStop(0, 'rgba(4,2,10,0)');
    scrim.addColorStop(0.45, 'rgba(4,2,10,0.55)');
    scrim.addColorStop(1, 'rgba(3,2,8,0.94)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, band.y - band.h * 0.35, w, h - (band.y - band.h * 0.35));
  } else {
    const glass = ctx.createLinearGradient(0, band.y, 0, h);
    glass.addColorStop(0, 'rgba(14,7,20,0.9)');
    glass.addColorStop(0.16, 'rgba(8,4,13,0.98)');
    glass.addColorStop(1, DEEP);
    ctx.fillStyle = glass;
    ctx.fillRect(0, band.y, w, h - band.y);

    // The bright rule across the top of the band, with a soft bloom bleeding above it.
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, band.y, w, Math.max(2, Math.round(h * 0.0035)));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bloom = ctx.createLinearGradient(0, band.y - h * 0.03, 0, band.y + h * 0.035);
    bloom.addColorStop(0, 'rgba(0,0,0,0)');
    bloom.addColorStop(0.45, grade.glow);
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, band.y - h * 0.03, w, h * 0.065);
    ctx.restore();
  }

  // Kicker: small capitals, tracked out, with hairlines running to the margins.
  const kickerText = (state.caption.kicker || '').trim();
  const kickerSize = Math.max(10, Math.round(Math.min(w, h) * 0.025));
  const kickerY = band.y + band.h * (floating ? 0.16 : 0.19);
  if (kickerText) {
    const run = measureTracked(ctx, kickerText, kickerSize, 0.3, 600);
    drawTrackedText(ctx, kickerText, {
      x: w / 2,
      y: kickerY,
      size: kickerSize,
      tracking: 0.3,
      weight: 600,
      colour: palette.accent,
      shadow: 'rgba(0,0,0,0.6)',
    });
    const gap = run / 2 + kickerSize * 1.6;
    const ruleY = Math.round(kickerY - kickerSize * 0.36);
    const ruleThickness = Math.max(1, Math.round(h * 0.0016));
    hairline(ctx, margin, w / 2 - gap, ruleY, 'rgba(255,255,255,0.32)', ruleThickness);
    hairline(ctx, w / 2 + gap, w - margin, ruleY, 'rgba(255,255,255,0.32)', ruleThickness);
  }

  // The logo itself: as large as the band allows, broken into two lines only when one line would shrink away.
  const titleText = (state.caption.title || 'Untitled').trim();
  const maxWidth = w - margin * 2;
  const startSize = band.h * (floating ? 0.5 : 0.6);
  const fitted = fitTitleBlock(ctx, titleText, maxWidth, startSize);
  const lineHeight = 0.94;
  const blockHeight = fitted.size * lineHeight * fitted.lines.length;
  const ceiling = band.h * (floating ? 0.52 : 0.62);
  const size = blockHeight > ceiling ? fitted.size * (ceiling / blockHeight) : fitted.size;
  const titleCentre = band.y + band.h * (floating ? 0.5 : 0.53);

  drawTitle(ctx, titleText, {
    x: w / 2,
    y: titleCentre,
    size,
    lines: fitted.lines,
    lineHeight,
    palette,
    glow: grade.glow,
  });

  // Subtitle, under the logo, tracked out and lighter than the kicker.
  const subtitleText = (state.caption.subtitle || '').trim();
  if (subtitleText) {
    const subtitleSize = Math.max(10, Math.round(Math.min(w, h) * 0.0225));
    drawTrackedText(ctx, subtitleText, {
      x: w / 2,
      y: band.y + band.h * 0.9,
      size: subtitleSize,
      tracking: 0.24,
      weight: 500,
      colour: 'rgba(255,255,255,0.82)',
      shadow: 'rgba(0,0,0,0.65)',
    });
  }
}

/** A cached tile of monochrome noise, the film grain laid over the finished cover. */
let grainTile = null;
let grainTileSeed = 0;

function grainPattern(ctx, seed) {
  if (typeof document === 'undefined') return null;
  if (!grainTile || grainTileSeed !== seed) {
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const tileCtx = canvas.getContext('2d');
    if (!tileCtx) return null;
    const pixels = tileCtx.createImageData(size, size);
    const random = makeRandom(seed);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const value = 128 + (random() - 0.5) * 116;
      pixels.data[i] = value;
      pixels.data[i + 1] = value;
      pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
    tileCtx.putImageData(pixels, 0, 0);
    grainTile = canvas;
    grainTileSeed = seed;
  }
  return ctx.createPattern(grainTile, 'repeat');
}

/** The last pass: warm cast, a light leak in the top corner, the frame vignette and the grain. */
function drawFrameTreatment(ctx, state, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const cast = ctx.createLinearGradient(0, 0, w, h);
  cast.addColorStop(0, 'rgba(255,150,60,0.12)');
  cast.addColorStop(0.55, 'rgba(255,90,140,0.06)');
  cast.addColorStop(1, 'rgba(60,180,200,0.12)');
  ctx.fillStyle = cast;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const leak = ctx.createRadialGradient(w * 0.93, h * 0.05, 0, w * 0.93, h * 0.05, Math.max(w, h) * 0.52);
  leak.addColorStop(0, 'rgba(255,214,158,0.28)');
  leak.addColorStop(0.5, 'rgba(255,150,90,0.09)');
  leak.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = leak;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const vignette = ctx.createRadialGradient(w / 2, h * 0.44, Math.min(w, h) * 0.34, w / 2, h * 0.5, Math.hypot(w, h) * 0.62);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.62, 'rgba(2,0,6,0.2)');
  vignette.addColorStop(1, 'rgba(2,0,6,0.58)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  const grain = grainPattern(ctx, state.seed);
  if (grain) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

/**
 * Paints `state` onto `canvas` at the state's export size. Deterministic: the same state always paints the same
 * pixels.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const w = Math.max(1, Math.round(state.size.w));
  const h = Math.max(1, Math.round(state.size.h));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, w, h);

  const geo = getLayout(state.layout, w, h);
  drawPanels(ctx, state, geo);
  drawGutters(ctx, geo, w, h);
  drawTitleBand(ctx, state, geo, w, h, state.layout === 'hero');
  drawFrameTreatment(ctx, state, w, h);

  ctx.restore();
  return canvas;
}
