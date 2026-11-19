// Draws the whole cover: the panel collage — each panel its own shot, cropped to its own focus, mirrored when the
// plan asks for it and graded in its own colour — the dark gutters between the prints, the lettered title band that
// borrows its colour from the collage, and one last warm cast, light leak, vignette and grain over everything so
// the collage reads as a single piece of art.

import { applyGrade } from './grades.js';
import { cropFrame } from './crop.js';
import { drawTitle, drawTrackedText, fitBandTitle, measureTracked, measureWordmark, TITLE_TRACKING } from './lettering.js';
import { getLayout } from './layouts.js';
import { panelLayer } from './panelcache.js';
import { planPanels } from './shotplan.js';
import { makeRandom, panelGrade, primaryGrade } from './state.js';
import { wordmarkLayer } from './wordmarkcache.js';

const BASE = '#07050c';
const DEEP = '#04030a';

/** Clamps a number into a range. */
function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
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

/** A one-pixel lit edge along the top and left of a panel, and a dark one along its foot: the print's thickness. */
function printEdge(ctx, w, h) {
  const hair = Math.max(1, Math.round(Math.min(w, h) * 0.0035));
  ctx.fillStyle = 'rgba(255,238,214,0.13)';
  ctx.fillRect(0, 0, w, hair);
  ctx.fillRect(0, 0, hair, h);
  ctx.fillStyle = 'rgba(2,1,5,0.5)';
  ctx.fillRect(0, h - hair, w, hair);
  ctx.fillRect(w - hair, 0, hair, h);
}

/**
 * Paints one panel into its own bitmap: crop to the plan's shot, mirror it when the plan asks, grade it, then the
 * print's edges. The bitmap is cached, so a panel is only painted again when its shot, crop or grade changes.
 */
function paintPanel(ctx, rect, panel, grade, photo) {
  let drawn = false;
  if (photo && photo.image) {
    const frame = cropFrame(photo.image, rect, panel);
    if (frame.ok) {
      ctx.save();
      if (frame.flip) {
        ctx.translate(rect.w, 0);
        ctx.scale(-1, 1);
      }
      try {
        ctx.drawImage(photo.image, frame.dx, frame.dy, frame.dw, frame.dh);
        drawn = true;
      } catch {
        // A half-decoded or broken file falls back to a graded panel rather than a hole.
      }
      ctx.restore();
    }
  }
  if (!drawn) drawEmptyPanel(ctx, rect, grade);

  applyGrade(ctx, rect.w, rect.h, grade);

  // The supporting panels sit a shade back, so the hero panel is where the eye lands first.
  if (!panel.hero) {
    ctx.fillStyle = 'rgba(6,3,12,0.1)';
    ctx.fillRect(0, 0, rect.w, rect.h);
  }
  insetShadow(ctx, rect.w, rect.h);
  printEdge(ctx, rect.w, rect.h);
}

/** Blits every panel from its cached bitmap, painting only the ones that changed since the last frame. */
function drawPanels(ctx, state, geo) {
  geo.panels.forEach((rect, index) => {
    const panel = state.panels[index];
    if (!panel) return;
    const grade = panelGrade(state, panel);
    const photo = state.photos[panel.photoIndex];
    const layer = panelLayer(panel, rect, grade, photo, (pctx) => paintPanel(pctx, rect, panel, grade, photo));
    ctx.drawImage(layer, rect.x, rect.y);
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

/** A hairline, used either side of the kicker and under the title. */
function hairline(ctx, x0, x1, y, colour, thickness = 1) {
  if (x1 <= x0) return;
  ctx.fillStyle = colour;
  ctx.fillRect(x0, Math.round(y), Math.max(1, x1 - x0), Math.max(1, Math.round(thickness)));
}

/** The hue of an RGB triple, in degrees. */
function hueOf(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (!delta) return 0;
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

// A scratch canvas for reading the collage's colour back off the finished panels.
let sampleCanvas = null;

/**
 * Reads the colour of the collage itself: the mean tone, and the hue the most saturated pixels agree on. The title
 * band is built from this, so it belongs to the picture instead of sitting under it like a black bar.
 */
function sampleCollage(canvas, w, artH) {
  const fallback = { hue: 24, sat: 0.62, rgb: [110, 74, 70] };
  try {
    if (typeof document === 'undefined' || !canvas) return fallback;
    if (!sampleCanvas) sampleCanvas = document.createElement('canvas');
    const grid = 32;
    if (sampleCanvas.width !== grid) sampleCanvas.width = grid;
    if (sampleCanvas.height !== grid) sampleCanvas.height = grid;
    const sctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sctx) return fallback;
    sctx.clearRect(0, 0, grid, grid);
    sctx.drawImage(canvas, 0, 0, w, Math.max(1, artH), 0, 0, grid, grid);
    const { data } = sctx.getImageData(0, 0, grid, grid);
    const buckets = new Array(24).fill(0);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const R = data[i];
      const G = data[i + 1];
      const B = data[i + 2];
      r += R;
      g += G;
      b += B;
      n += 1;
      const max = Math.max(R, G, B);
      const min = Math.min(R, G, B);
      const sat = (max - min) / 255;
      const lum = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
      if (sat > 0.18 && lum > 0.1) {
        const bucket = Math.floor(hueOf(R, G, B) / 15) % 24;
        buckets[bucket] += sat * sat * (0.35 + lum);
      }
    }
    if (!n) return fallback;
    let best = 0;
    for (let i = 1; i < buckets.length; i += 1) if (buckets[i] > buckets[best]) best = i;
    const weight = buckets.reduce((sum, value) => sum + value, 0);
    const dominance = weight > 0 ? buckets[best] / weight : 0;
    // A neighbouring bucket pulls the hue a little, so the band never reads as a single flat swatch.
    const left = buckets[(best + 23) % 24];
    const right = buckets[(best + 1) % 24];
    const hue = (best * 15 + 7.5) + ((right - left) / Math.max(1, buckets[best])) * 4;
    return {
      hue: (hue + 360) % 360,
      sat: clamp(0.3 + dominance * 1.6, 0.28, 0.78),
      rgb: [Math.round(r / n), Math.round(g / n), Math.round(b / n)],
    };
  } catch {
    return fallback;
  }
}

/**
 * The title band. It is built out of the collage's own colour: a gradient in the dominant hue, a scrim that lets
 * the art melt into it, an accent rule above and a fainter one under the title, the kicker and the subtitle in the
 * grade's accent, and a grain overlay so the band has the texture of printed card rather than a flat rectangle.
 */
function drawTitleBand(ctx, state, geo, w, h, canvas, floating = false) {
  const band = geo.titleBox;
  const grade = primaryGrade(state);
  const palette = grade.palette;
  const margin = Math.round(w * 0.055);
  const tone = sampleCollage(canvas, w, geo.artH);
  const hue = Math.round(tone.hue);
  const sat = Math.round(tone.sat * 100);
  const bandTop = band.y;
  const bandH = band.h;

  const deep = `hsl(${hue}, ${Math.round(sat * 0.9)}%, 5%)`;
  const mid = `hsl(${hue}, ${sat}%, 12%)`;

  if (floating) {
    const scrim = ctx.createLinearGradient(0, bandTop - bandH * 0.4, 0, h);
    scrim.addColorStop(0, 'rgba(4,2,10,0)');
    scrim.addColorStop(0.45, 'rgba(4,2,10,0.52)');
    scrim.addColorStop(1, 'rgba(3,2,8,0.94)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, bandTop - bandH * 0.4, w, h - (bandTop - bandH * 0.4));
  } else {
    // The art fades into the band instead of stopping at it: a scrim over the last strip of the collage.
    const bleed = Math.max(6, geo.artH * 0.09);
    const scrim = ctx.createLinearGradient(0, bandTop - bleed, 0, bandTop + 2);
    scrim.addColorStop(0, `hsla(${hue}, ${sat}%, 6%, 0)`);
    scrim.addColorStop(1, `hsla(${hue}, ${sat}%, 6%, 0.92)`);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, bandTop - bleed, w, bleed + 2);

    // One diagonal gradient carries both the falloff down the band and the warmth across it, so the band is never
    // a single even tone and never costs a second full-width pass.
    const glass = ctx.createLinearGradient(0, bandTop, w * 0.9, h);
    glass.addColorStop(0, `hsl(${hue}, ${Math.min(92, sat + 16)}%, 14%)`);
    glass.addColorStop(0.38, mid);
    glass.addColorStop(0.76, `hsl(${hue}, ${Math.round(sat * 0.8)}%, 7%)`);
    glass.addColorStop(1, deep);
    ctx.fillStyle = glass;
    ctx.fillRect(0, bandTop, w, h - bandTop);

    // The thin accent rule above the band, with a soft bloom bleeding up into the art.
    ctx.fillStyle = palette.mid;
    ctx.fillRect(0, bandTop, w, Math.max(2, Math.round(h * 0.0035)));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bloom = ctx.createLinearGradient(0, bandTop - h * 0.028, 0, bandTop + h * 0.03);
    bloom.addColorStop(0, 'rgba(0,0,0,0)');
    bloom.addColorStop(0.45, grade.glow);
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, bandTop - h * 0.028, w, h * 0.058);
    ctx.restore();

    // Grain, clipped to the band, so it reads as printed card.
    const grain = grainPattern(ctx, state.seed);
    if (grain) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, bandTop, w, h - bandTop);
      ctx.clip();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = grain;
      ctx.fillRect(0, bandTop, w, h - bandTop);
      ctx.restore();
    }
  }

  // The type stack, measured from the top of the band down so nothing can overflow it.
  const pad = bandH * (floating ? 0.08 : 0.06);
  const kickerSize = Math.max(9, Math.round(bandH * 0.062));
  const kickerBaseline = bandTop + pad + kickerSize * 0.84;
  const rule1Y = kickerBaseline + kickerSize * 0.62;
  const subtitleSize = Math.max(8, Math.round(bandH * 0.052));
  const subtitleBaseline = bandTop + bandH - pad;
  const rule2Y = subtitleBaseline - subtitleSize * 1.3;
  const titleTop = rule1Y + bandH * 0.03;
  const titleBottom = rule2Y - bandH * 0.025;
  const available = Math.max(1, titleBottom - titleTop);

  const kickerText = (state.caption.kicker || '').trim();
  if (kickerText) {
    const run = measureTracked(ctx, kickerText, kickerSize, 0.32, 600);
    drawTrackedText(ctx, kickerText, {
      x: w / 2,
      y: kickerBaseline,
      size: kickerSize,
      tracking: 0.32,
      weight: 600,
      colour: palette.mid,
      shadow: 'rgba(0,0,0,0.55)',
    });
    const gap = run / 2 + kickerSize * 1.5;
    const ruleY = Math.round(kickerBaseline - kickerSize * 0.34);
    const thickness = Math.max(1, Math.round(h * 0.0016));
    hairline(ctx, margin, w / 2 - gap, ruleY, hexToRgba(grade.accent, 0.55), thickness);
    hairline(ctx, w / 2 + gap, w - margin, ruleY, hexToRgba(grade.accent, 0.55), thickness);
  }

  // The wordmark: as large as the band allows, on one line if it can stay big, on two if it cannot. It is the
  // costly part of the band — a few hundred glyph rasterisations — so it is painted once into a bitmap and
  // blitted after that, which keeps a drag or a reshuffle off the type.
  const titleText = (state.caption.title || 'Untitled').trim();
  const suffix = (state.caption.suffix || 'II').trim();
  const maxWidth = w - margin * 2;
  const fitted = fitBandTitle(ctx, titleText, maxWidth, available, suffix);
  const lineHeight = 0.94;
  const blockHeight = fitted.size * lineHeight * fitted.lines.length;
  const size = blockHeight > available ? fitted.size * (available / blockHeight) : fitted.size;
  const titleCentre = (titleTop + titleBottom) / 2 + size * 0.02;
  const blockWidth = fitted.lines.reduce((widest, line, index) => Math.max(
    widest,
    measureWordmark(ctx, line, size, index === fitted.lines.length - 1 ? suffix : '', TITLE_TRACKING, fitted.condense).width,
  ), 0);

  const wordmarkKey = [
    titleText, size, fitted.condense, lineHeight, suffix,
    palette.top, palette.mid, palette.bottom, palette.outline, grade.glow,
    fitted.lines.join(' / '),
  ].join('|');
  const wordmark = wordmarkLayer(wordmarkKey, size, blockWidth, blockHeight, (wctx, bitmapW, bitmapH) => {
    drawTitle(wctx, titleText, {
      x: bitmapW / 2,
      y: bitmapH / 2,
      size,
      lines: fitted.lines,
      lineHeight,
      condense: fitted.condense,
      palette,
      glow: grade.glow,
      suffix,
    });
  });
  ctx.drawImage(wordmark, Math.round(w / 2 - wordmark.width / 2), Math.round(titleCentre - wordmark.height / 2));
  drawCover.metrics = { size, condense: fitted.condense, lines: fitted.lines, available, titleTop, titleBottom };

  // The second, fainter rule under the title, then the subtitle in a lighter weight.
  hairline(ctx, margin, w - margin, rule2Y, hexToRgba(grade.accent, 0.22), Math.max(1, Math.round(h * 0.0014)));

  const subtitleText = (state.caption.subtitle || '').trim();
  if (subtitleText) {
    drawTrackedText(ctx, subtitleText, {
      x: w / 2,
      y: subtitleBaseline,
      size: subtitleSize,
      tracking: 0.26,
      weight: 400,
      colour: hexToRgba(grade.accent, 0.9),
      shadow: 'rgba(0,0,0,0.6)',
    });
  }
}

/** `#rrggbb` to `rgba(...)` with an alpha, so accents can be laid down at any strength. */
function hexToRgba(hex, alpha) {
  const value = String(hex ?? '#ffffff').replace('#', '');
  const full = value.length === 3 ? value.split('').map((ch) => ch + ch).join('') : value;
  const number = parseInt(full, 16);
  if (!Number.isFinite(number)) return `rgba(255,255,255,${alpha})`;
  const r = (number >> 16) & 255;
  const g = (number >> 8) & 255;
  const b = number & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** A cached tile of monochrome noise, the film grain laid over the finished cover and the band. */
let grainTile = null;
let grainTileSeed = 0;

function grainPattern(ctx, seed) {
  if (typeof document === 'undefined') return null;
  if (!grainTile || grainTileSeed !== seed) {
    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const tileCtx = canvas.getContext('2d');
    if (!tileCtx) return null;
    const pixels = tileCtx.createImageData(size, size);
    const random = makeRandom(seed);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const value = 128 + (random() - 0.5) * 108;
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

// The finished frame treatment is one bitmap: the vignette, the warm light in the corner and the film grain never
// change while the artwork does, so they are painted once per size and blitted in a single draw.
let frameLayer = null;
let frameLayerKey = '';

/** The frame's atmosphere — corner light, vignette and grain — baked into one overlay bitmap. */
function frameOverlay(w, h, seed) {
  const key = `${w}x${h}:${seed}`;
  if (frameLayer && frameLayerKey === key) return frameLayer;
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // A warm light in the top corner and a cool one at the foot, so the frame is not lit evenly.
  const leak = ctx.createRadialGradient(w * 0.93, h * 0.05, 0, w * 0.93, h * 0.05, Math.max(w, h) * 0.52);
  leak.addColorStop(0, 'rgba(255,208,150,0.2)');
  leak.addColorStop(0.5, 'rgba(255,150,90,0.06)');
  leak.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = leak;
  ctx.fillRect(0, 0, w, h);

  const cool = ctx.createRadialGradient(w * 0.08, h * 0.98, 0, w * 0.08, h * 0.98, Math.max(w, h) * 0.46);
  cool.addColorStop(0, 'rgba(70,180,205,0.14)');
  cool.addColorStop(1, 'rgba(60,140,200,0)');
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, w, h);

  const vignette = ctx.createRadialGradient(w / 2, h * 0.44, Math.min(w, h) * 0.34, w / 2, h * 0.5, Math.hypot(w, h) * 0.62);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.62, 'rgba(2,0,6,0.2)');
  vignette.addColorStop(1, 'rgba(2,0,6,0.58)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // Neutral grain, laid over everything: the film's own texture rather than the picture's.
  const grain = grainPattern(ctx, seed);
  if (grain) {
    ctx.save();
    ctx.globalAlpha = 0.075;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  frameLayer = canvas;
  frameLayerKey = key;
  return canvas;
}

/** The last pass: the baked atmosphere, laid over the whole cover in one draw. */
function drawFrameTreatment(ctx, state, w, h) {
  const overlay = frameOverlay(w, h, state.seed);
  if (overlay) ctx.drawImage(overlay, 0, 0);
}

/**
 * Paints `state` onto `canvas` at the state's export size. The panel shots are planned here, so a caller only has to
 * keep the document in order. Deterministic: the same state always paints the same pixels.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const w = Math.max(1, Math.round(state.size.w));
  const h = Math.max(1, Math.round(state.size.h));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  planPanels(state);

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, w, h);

  const geo = getLayout(state.layout, w, h);
  const flush = () => ctx.getImageData(0, 0, 1, 1);
  const t0 = performance.now();
  drawPanels(ctx, state, geo);
  flush();
  const t1 = performance.now();
  drawGutters(ctx, geo, w, h);
  drawTitleBand(ctx, state, geo, w, h, canvas, state.layout === 'hero');
  flush();
  const t2 = performance.now();
  drawFrameTreatment(ctx, state, w, h);
  flush();
  const t3 = performance.now();
  drawCover.timing = { panels: t1 - t0, band: t2 - t1, frame: t3 - t2 };

  ctx.restore();
  return canvas;
}
