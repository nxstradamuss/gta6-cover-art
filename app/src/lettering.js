// The title lettering. A heavy condensed display face drawn glyph by glyph, so the tracking, the forward lean and
// every layer of the wordmark are ours: a wide soft glow, a hard offset shadow, two keylines (the thick outer edge
// and the thinner machined line inside it), a three-stop cream-to-amber fill with a gloss across the top, a lit top
// edge and a hot bottom edge. The fill is built in a glyph mask so the highlights are clipped to the letters
// themselves rather than to a rectangle around them.
//
// No game font is used or shipped. The face is a system stack squeezed into a condensed cut, set as one run of
// capitals: the title is exactly the caption text, with no numeral or suffix tacked on beside it.

export const TITLE_STACK = "'Impact', 'Haettenschweiler', 'Arial Narrow Bold', 'Arial Black', sans-serif";
export const BODY_STACK = "'Helvetica Neue', Helvetica, Arial, 'DejaVu Sans', sans-serif";

/** Tight tracking, in ems, so the letters sit shoulder to shoulder. */
export const TITLE_TRACKING = -0.032;
/** How far the face is squeezed horizontally to read as condensed. */
export const TITLE_CONDENSE = 0.72;
/** The forward lean, in degrees; the shear below is its tangent. */
export const TITLE_LEAN = 8;

const LEAN_SHEAR = Math.tan((TITLE_LEAN * Math.PI) / 180);

const DEFAULT_PALETTE = { top: '#fff6da', mid: '#ffc247', bottom: '#ff8f1f', outline: '#2b0710' };

/** The wordmark's font, at a given size. */
export function titleFont(size, weight = 900) {
  return `${weight} ${Math.max(4, Math.round(size))}px ${TITLE_STACK}`;
}

/** The glow is painted at this fraction of full size and blown back up: a blur is soft, so nobody can tell. */
const GLOW_SCALE = 0.3;

/** An offscreen canvas that works in a page and in an offscreen context, or null where neither exists. */
function blankCanvas(width, height) {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  try {
    if (typeof document !== 'undefined' && document.createElement) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      return canvas;
    }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  } catch {
    // Fall through to the caller's fallback path.
  }
  return null;
}

/** Measures one line of tracked capitals: the per-character widths and the total run. */
export function measureLine(ctx, text, size, tracking = TITLE_TRACKING) {
  ctx.save();
  ctx.font = titleFont(size);
  const chars = Array.from(String(text ?? '').toUpperCase());
  const widths = chars.map((ch) => (ch === ' ' ? ctx.measureText('M').width * 0.36 : ctx.measureText(ch).width));
  ctx.restore();
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * size * Math.max(0, chars.length - 1);
  return { chars, widths, width: total };
}

/** The whole wordmark's width in canvas pixels: the condensed run of the line, and nothing after it. */
export function measureWordmark(ctx, text, size, tracking = TITLE_TRACKING, condense = TITLE_CONDENSE) {
  const line = measureLine(ctx, text, size, tracking);
  const run = line.width * condense;
  return { run, width: run };
}

/** How far the face may be squeezed to fill the band, and how wide it may be set before it stops being condensed. */
const MIN_CONDENSE = 0.58;
const MAX_CONDENSE = 0.96;
/** The block's line height, so the fitted size and the drawn block agree. */
const LINE_HEIGHT = 0.94;

/**
 * Fits one line to the band: the size comes from the height, then the horizontal squeeze is chosen so the word
 * reaches across the band. Only when even the tightest squeeze would overflow does the size come down.
 */
function fitLine(ctx, text, maxWidth, maxHeight, tracking) {
  const byHeight = Math.max(8, maxHeight / LINE_HEIGHT);
  const natural = Math.max(1, measureWordmark(ctx, text, byHeight, tracking, 1).width);
  let condense = maxWidth / natural;
  let size = byHeight;
  if (condense < MIN_CONDENSE) {
    size = byHeight * (maxWidth / (natural * MIN_CONDENSE));
    condense = MIN_CONDENSE;
  }
  return { size: Math.max(8, Math.floor(size)), condense: Math.min(MAX_CONDENSE, condense) };
}

/** Greedy word wrap, so a long caption breaks into balanced lines instead of shrinking away. */
function wrapTitle(ctx, text, maxWidth, size) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [String(text ?? '').trim().toUpperCase()];
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measureWordmark(ctx, next, size, TITLE_TRACKING, MIN_CONDENSE).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.map((entry) => entry.toUpperCase());
}

/** The most lines the band will ever break a caption into. Past this the type stops being a wordmark. */
const MAX_TITLE_LINES = 4;

/**
 * The wordmark's fit for the band: one line if it can stay big, otherwise the fewest lines that let the type
 * stay large, with the squeeze chosen so each line reaches the margins. Returns the size, the squeeze and the
 * lines. Never overflows the band, and the whole of the caption is set — nothing is added beside it.
 */
export function fitBandTitle(ctx, text, maxWidth, maxHeight, tracking = TITLE_TRACKING) {
  const one = fitLine(ctx, text, maxWidth, maxHeight, tracking);
  if (one.size >= (maxHeight / LINE_HEIGHT) * 0.55) {
    return { ...one, lines: [String(text ?? '').toUpperCase()] };
  }

  // Too long for one line at a readable size. Try the band broken into two lines, then three, then four: the
  // first count the caption actually wraps into wins, so the type stays as large as the band allows rather than
  // shrinking to whatever a single line would cost.
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const most = Math.max(1, Math.min(MAX_TITLE_LINES, words.length));
  for (let count = 2; count <= most; count += 1) {
    const guess = (maxHeight / LINE_HEIGHT) / count;
    const lines = wrapTitle(ctx, text, maxWidth, guess);
    if (lines.length > count) continue;
    let size = Number.POSITIVE_INFINITY;
    let condense = MAX_CONDENSE;
    for (const line of lines) {
      const fit = fitLine(ctx, line, maxWidth, maxHeight / lines.length, tracking);
      size = Math.min(size, fit.size);
      condense = Math.min(condense, fit.condense);
    }
    return { size: Math.max(8, Math.floor(size)), condense, lines };
  }
  return { ...one, lines: [String(text ?? '').toUpperCase()] };
}

/** Runs a drawing callback once per glyph, at its x offset, with the tracking applied. */
function eachGlyph(chars, widths, size, tracking, draw) {
  let x = 0;
  for (let index = 0; index < chars.length; index += 1) {
    draw(chars[index], x, index);
    x += widths[index] + tracking * size;
  }
}

/**
 * Builds the letters as a mask and paints the fill inside them: the three-stop gradient, the diagonal gloss over
 * the top third, the lit top edge and the hot bottom edge. Returns the canvas plus where its baseline sits.
 */
function paintGlyphFill(size, chars, widths, tracking, palette) {
  const pad = Math.ceil(size * 0.24);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * size * Math.max(0, chars.length - 1);
  const width = total + pad * 2;
  const height = size * 1.94;
  const baseline = size * 1.36;
  const canvas = blankCanvas(width, height);
  if (!canvas) return null;
  const mctx = canvas.getContext('2d');
  if (!mctx) return null;

  mctx.font = titleFont(size);
  mctx.textAlign = 'left';
  mctx.textBaseline = 'alphabetic';
  mctx.fillStyle = '#ffffff';
  eachGlyph(chars, widths, size, tracking, (ch, x) => mctx.fillText(ch, pad + x, baseline));

  // 5a. The three-stop vertical fill: bright cream at the top, warm gold through the middle, deep amber at the feet.
  mctx.globalCompositeOperation = 'source-in';
  const fill = mctx.createLinearGradient(0, baseline - size * 0.8, 0, baseline + size * 0.02);
  fill.addColorStop(0, palette.top ?? DEFAULT_PALETTE.top);
  fill.addColorStop(0.15, palette.top ?? DEFAULT_PALETTE.top);
  fill.addColorStop(0.52, palette.mid ?? palette.bottom ?? DEFAULT_PALETTE.mid);
  fill.addColorStop(1, palette.bottom ?? DEFAULT_PALETTE.bottom);
  mctx.fillStyle = fill;
  mctx.fillRect(0, 0, canvas.width, canvas.height);

  // 5b. The gloss: a diagonal sheen that fades out by the middle of the letters, so only their upper third catches it.
  mctx.globalCompositeOperation = 'source-atop';
  const gloss = mctx.createLinearGradient(0, baseline - size * 0.82, width * 0.55, baseline - size * 0.06);
  gloss.addColorStop(0, 'rgba(255,255,255,0.30)');
  gloss.addColorStop(0.24, 'rgba(255,255,255,0.13)');
  gloss.addColorStop(0.46, 'rgba(255,255,255,0.02)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  mctx.fillStyle = gloss;
  mctx.fillRect(0, 0, canvas.width, canvas.height);


  // 6. The lit top edge: the outline is stroked a few pixels higher, so only the inside of the top edge catches it.
  mctx.save();
  mctx.beginPath();
  mctx.rect(0, 0, canvas.width, baseline - size * 0.06);
  mctx.clip();
  mctx.globalCompositeOperation = 'source-atop';
  mctx.lineJoin = 'round';
  mctx.lineCap = 'round';
  mctx.strokeStyle = 'rgba(255,255,255,0.66)';
  mctx.lineWidth = size * 0.032;
  eachGlyph(chars, widths, size, tracking, (ch, x) => mctx.strokeText(ch, pad + x, baseline - size * 0.022));
  mctx.restore();

  // 7. The hot bottom edge: the same trick at the feet of the letters, so they read as extruded, not painted on.
  mctx.save();
  mctx.beginPath();
  mctx.rect(0, baseline - size * 0.1, canvas.width, size * 0.5);
  mctx.clip();
  mctx.globalCompositeOperation = 'source-atop';
  mctx.lineJoin = 'round';
  mctx.strokeStyle = 'rgba(255,226,164,0.9)';
  mctx.lineWidth = size * 0.026;
  eachGlyph(chars, widths, size, tracking, (ch, x) => mctx.strokeText(ch, pad + x, baseline + size * 0.026));
  mctx.restore();

  return { canvas, baseline, pad, total };
}

/**
 * The outer glow, built small and blitted large. A blurred copy of the letters costs a fraction of a shadow pass at
 * full size, which keeps a redraw inside a single animation frame.
 */
function buildGlow(size, chars, widths, tracking, glow) {
  const pad = Math.ceil(size * 0.26);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * size * Math.max(0, chars.length - 1);
  const width = total + pad * 2;
  const height = size * 2.02;
  const baseline = size * 1.38;
  const canvas = blankCanvas(width * GLOW_SCALE, height * GLOW_SCALE);
  if (!canvas) return null;
  const gctx = canvas.getContext('2d');
  if (!gctx) return null;
  gctx.scale(GLOW_SCALE, GLOW_SCALE);
  gctx.font = titleFont(size);
  gctx.textAlign = 'left';
  gctx.textBaseline = 'alphabetic';
  gctx.shadowColor = glow;
  gctx.shadowBlur = size * 0.5;
  gctx.fillStyle = glow;
  eachGlyph(chars, widths, size, tracking, (ch, x) => gctx.fillText(ch, pad + x, baseline));
  return { canvas, pad, baseline, width, height };
}

/**
 * Draws one line of the wordmark, centred on `centerX` with its baseline at `baseline`.
 * Returns the line's drawn width and height.
 */
function drawWordmarkLine(ctx, text, centerX, baseline, size, options) {
  const { tracking, condense, palette, glow } = options;
  const { chars, widths, width } = measureLine(ctx, text, size, tracking);
  const totalWidth = width * condense;

  ctx.save();
  ctx.translate(centerX - totalWidth / 2, baseline);
  // 8. The forward lean and the condensed cut, applied once to the whole word.
  ctx.transform(condense, 0, -LEAN_SHEAR, 1, 0, 0);
  ctx.font = titleFont(size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.miterLimit = 2;

  // 1. A wide, faint outer glow in the grade's accent colour, painted small and blown up behind everything else.
  const glowLayer = buildGlow(size, chars, widths, tracking, glow);
  if (glowLayer) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8;
    ctx.drawImage(glowLayer.canvas, -glowLayer.pad, -glowLayer.baseline, glowLayer.width, glowLayer.height);
    ctx.restore();
  } else {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * 0.5;
    ctx.fillStyle = glow;
    eachGlyph(chars, widths, size, tracking, (ch, x) => ctx.fillText(ch, x, 0));
    ctx.restore();
  }

  // 2. The hard drop shadow: no blur, down and to the right by about 4% of the letter height.
  ctx.save();
  ctx.shadowColor = 'rgba(5,1,7,0.9)';
  ctx.shadowOffsetX = size * 0.04;
  ctx.shadowOffsetY = size * 0.045;
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0a0410';
  eachGlyph(chars, widths, size, tracking, (ch, x) => ctx.fillText(ch, x, 0));
  ctx.restore();

  // 3. The thick outer keyline: dark warm brown, never black, with round joins so the corners stay soft.
  ctx.strokeStyle = palette.outline ?? DEFAULT_PALETTE.outline;
  ctx.lineWidth = size * 0.09;
  eachGlyph(chars, widths, size, tracking, (ch, x) => ctx.strokeText(ch, x, 0));

  // 4. The second keyline just inside it, half the width: this is what makes the lettering look machined.
  ctx.strokeStyle = palette.mid ?? DEFAULT_PALETTE.mid;
  ctx.lineWidth = size * 0.045;
  ctx.globalAlpha = 0.55;
  eachGlyph(chars, widths, size, tracking, (ch, x) => ctx.strokeText(ch, x, 0));
  ctx.globalAlpha = 1;

  // 5-7. The fill, the gloss, the lit top edge and the hot bottom edge, clipped to the letters themselves.
  const mask = paintGlyphFill(size, chars, widths, tracking, palette);
  if (mask) {
    ctx.drawImage(mask.canvas, -mask.pad, -mask.baseline);
  } else {
    // No offscreen canvas: a plain gradient fill still keeps the wordmark readable.
    const fill = ctx.createLinearGradient(0, -size * 0.8, 0, 0);
    fill.addColorStop(0, palette.top ?? DEFAULT_PALETTE.top);
    fill.addColorStop(0.15, palette.top ?? DEFAULT_PALETTE.top);
    fill.addColorStop(0.52, palette.mid ?? DEFAULT_PALETTE.mid);
    fill.addColorStop(1, palette.bottom ?? DEFAULT_PALETTE.bottom);
    ctx.fillStyle = fill;
    eachGlyph(chars, widths, size, tracking, (ch, x) => ctx.fillText(ch, x, 0));
  }

  ctx.restore();
  return { width: totalWidth, height: size };
}

/**
 * Draws the logo. `text` may hold newlines; `opts.lines` overrides that with an explicit set of lines.
 * `x` and `y` are the centre of the whole block. Returns the block's measurements.
 */
export function drawTitle(ctx, text, opts = {}) {
  const size = Math.max(8, opts.size ?? 120);
  const tracking = opts.tracking ?? TITLE_TRACKING;
  const condense = opts.condense ?? TITLE_CONDENSE;
  const lineHeight = opts.lineHeight ?? 0.94;
  const palette = opts.palette ?? DEFAULT_PALETTE;
  const glow = opts.glow ?? 'rgba(255,120,40,0.55)';
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;

  const lines = (opts.lines ?? String(text ?? '').split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { width: 0, height: 0, size, lines: [] };

  const widest = lines.reduce((max, line) => Math.max(
    max,
    measureWordmark(ctx, line, size, tracking, condense).width,
  ), 0);
  const blockHeight = size * lineHeight * lines.length;
  const top = y - blockHeight / 2;

  lines.forEach((line, index) => {
    const baseline = top + size * lineHeight * (index + 0.5) + size * 0.34;
    drawWordmarkLine(ctx, line, x, baseline, size, {
      tracking,
      condense,
      palette,
      glow,
    });
  });

  return { width: widest, height: blockHeight, size, lines };
}

/**
 * Small tracked-out capitals for the kicker and the subtitle, drawn glyph by glyph so the tracking is real and
 * the words read as printed rather than typed.
 */
export function drawTrackedText(ctx, text, opts = {}) {
  const size = Math.max(6, opts.size ?? 20);
  const tracking = opts.tracking ?? 0.24;
  const weight = opts.weight ?? 600;
  const align = opts.align ?? 'center';
  const colour = opts.colour ?? '#ffffff';
  const font = opts.font ?? `${weight} ${Math.round(size)}px ${BODY_STACK}`;
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;

  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colour;

  const chars = Array.from(String(text ?? '').toUpperCase());
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const run = widths.reduce((sum, width) => sum + width, 0) + tracking * size * Math.max(0, chars.length - 1);
  let cursor = align === 'center' ? x - run / 2 : align === 'right' ? x - run : x;

  if (opts.shadow) {
    ctx.shadowColor = opts.shadow;
    ctx.shadowBlur = size * 0.8;
  }
  for (let index = 0; index < chars.length; index += 1) {
    ctx.fillText(chars[index], cursor, y);
    cursor += widths[index] + tracking * size;
  }
  ctx.restore();
  return run;
}

/** The width `drawTrackedText` would take, so a caller can lay rules beside it. */
export function measureTracked(ctx, text, size, tracking = 0.24, weight = 600) {
  ctx.save();
  ctx.font = `${weight} ${Math.round(size)}px ${BODY_STACK}`;
  const chars = Array.from(String(text ?? '').toUpperCase());
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  ctx.restore();
  return widths.reduce((sum, width) => sum + width, 0) + tracking * size * Math.max(0, chars.length - 1);
}

/** The smallest a line of small type is ever set: below this it stops being readable at a distance. */
const MIN_BODY = 12;

/**
 * The size a tracked line should be set at: `size`, reduced a pixel at a time until the run fits `maxWidth`. Long
 * kickers and subtitles therefore shorten themselves instead of running off the band, and nothing is ever set
 * smaller than MIN_BODY.
 */
export function fitTrackedText(ctx, text, maxWidth, size, tracking = 0.24, weight = 600) {
  if (!String(text ?? '').trim()) return Math.max(MIN_BODY, Math.round(size));
  let fitted = Math.max(MIN_BODY, Math.round(size));
  while (fitted > MIN_BODY && measureTracked(ctx, text, fitted, tracking, weight) > maxWidth) {
    fitted -= 1;
  }
  return fitted;
}
