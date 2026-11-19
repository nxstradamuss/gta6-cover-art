// The title lettering. A heavy condensed display face, drawn glyph by glyph so the tracking, the slight italic
// lean and the stacked poster treatment (glow, drop shadow, keyline, gradient fill, lit top edge) are all ours.
// No game font is used or shipped: this is a system face squeezed into a condensed cut.

export const TITLE_STACK = "'Impact', 'Haettenschweiler', 'Arial Narrow Bold', 'Arial Black', 'DejaVu Sans', sans-serif";
export const BODY_STACK = "'Helvetica Neue', Helvetica, Arial, 'DejaVu Sans', sans-serif";

/** Tight tracking, in ems, so the letters sit shoulder to shoulder. */
export const TITLE_TRACKING = -0.03;
/** How far the face is squeezed horizontally to read as condensed. */
export const TITLE_CONDENSE = 0.74;
/** The italic lean, as a shear on the y axis. */
const TITLE_SKEW = 0.1;

const DEFAULT_PALETTE = { top: '#fff6da', bottom: '#ffa32b', outline: '#2b0710' };

export function titleFont(size, weight = 900) {
  return `${weight} ${Math.max(4, Math.round(size))}px ${TITLE_STACK}`;
}

/** Measures one line of tracked capitals: the per-character widths and the total run. */
export function measureLine(ctx, text, size, tracking = TITLE_TRACKING) {
  ctx.save();
  ctx.font = titleFont(size);
  const chars = Array.from(String(text).toUpperCase());
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  ctx.restore();
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * size * Math.max(0, chars.length - 1);
  return { chars, widths, width: total };
}

/** The largest size at which `text` fits `maxWidth` on one line. Never overflows; shrinks in small steps. */
export function fitTitle(ctx, text, maxWidth, startSize) {
  const floor = Math.max(8, startSize * 0.16);
  let size = Math.max(8, startSize);
  while (size > floor) {
    const { width } = measureLine(ctx, text, size);
    if (width * TITLE_CONDENSE <= maxWidth) return Math.floor(size);
    size *= 0.94;
  }
  return Math.floor(floor);
}

/** Greedy word wrap at a given size, so long captions break into two balanced lines instead of shrinking away. */
export function wrapTitle(ctx, text, maxWidth, size) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [String(text).trim().toUpperCase()];
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measureLine(ctx, next, size).width * TITLE_CONDENSE > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.map((entry) => entry.toUpperCase());
}

/**
 * Chooses the size and the line breaks together: one line if it can stay big, otherwise two lines at a size that
 * still fills the band.
 */
export function fitTitleBlock(ctx, text, maxWidth, startSize) {
  const single = fitTitle(ctx, text, maxWidth, startSize);
  if (single >= startSize * 0.62) return { size: single, lines: [String(text).toUpperCase()] };
  const lines = wrapTitle(ctx, text, maxWidth, startSize * 0.82);
  const size = lines.reduce((smallest, line) => Math.min(smallest, fitTitle(ctx, line, maxWidth, startSize * 0.82)), startSize);
  return { size, lines };
}

/** Draws one line of the logo, centred on `centerX` with its baseline at `baseline`. */
function drawLine(ctx, text, centerX, baseline, size, options) {
  const { tracking, condense, skew, palette, glow } = options;
  const { chars, widths, width } = measureLine(ctx, text, size, tracking);
  const run = width * condense;
  const pad = size;

  ctx.save();
  ctx.translate(centerX - run / 2, baseline);
  ctx.transform(condense, 0, -skew, 1, 0, 0);
  ctx.font = titleFont(size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.miterLimit = 2;

  const eachGlyph = (draw) => {
    let x = 0;
    for (let i = 0; i < chars.length; i += 1) {
      draw(chars[i], x);
      x += widths[i] + tracking * size;
    }
  };

  // 1. Outer glow in the grade's accent colour, laid down first so it sits behind everything else.
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = size * 0.62;
  ctx.fillStyle = glow;
  eachGlyph((ch, x) => ctx.fillText(ch, x, 0));
  ctx.restore();

  // 2. Heavy drop shadow, offset down and right, with the dark body it belongs to.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowOffsetX = size * 0.05;
  ctx.shadowOffsetY = size * 0.075;
  ctx.shadowBlur = size * 0.1;
  ctx.fillStyle = '#0d0510';
  eachGlyph((ch, x) => ctx.fillText(ch, x, 0));
  ctx.restore();

  // 3. Thick keyline: a near-black outer edge, then the grade-tinted inner edge.
  ctx.strokeStyle = '#070309';
  ctx.lineWidth = size * 0.15;
  eachGlyph((ch, x) => ctx.strokeText(ch, x, 0));
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = size * 0.085;
  eachGlyph((ch, x) => ctx.strokeText(ch, x, 0));

  // 4. The fill: cream at the top of the letters into the hot colour at their feet.
  const fill = ctx.createLinearGradient(0, -size * 0.76, 0, size * 0.18);
  fill.addColorStop(0, palette.top);
  fill.addColorStop(0.5, palette.top);
  fill.addColorStop(1, palette.bottom);
  ctx.fillStyle = fill;
  eachGlyph((ch, x) => ctx.fillText(ch, x, 0));

  // 5. A thin bright highlight along the lit top edge, clipped to the upper half of the letters.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-pad, -size * 1.06, width + pad * 2, size * 0.66);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth = size * 0.03;
  eachGlyph((ch, x) => ctx.strokeText(ch, x, 0));
  ctx.restore();

  // 6. A dark inner shadow along the bottom edge, so the letters read as cut metal rather than flat paint.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-pad, -size * 0.16, width + pad * 2, size * 0.42);
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,0,20,0.32)';
  ctx.lineWidth = size * 0.028;
  eachGlyph((ch, x) => ctx.strokeText(ch, x, 0));
  ctx.restore();

  ctx.restore();
  return { width: run, height: size };
}

/**
 * Draws the logo. `text` may hold newlines; `opts.lines` overrides that with an explicit set of lines.
 * `x` and `y` are the centre of the whole block. Returns the block's measurements.
 */
export function drawTitle(ctx, text, opts = {}) {
  const size = Math.max(8, opts.size ?? 120);
  const tracking = opts.tracking ?? TITLE_TRACKING;
  const condense = opts.condense ?? TITLE_CONDENSE;
  const skew = opts.skew ?? TITLE_SKEW;
  const lineHeight = opts.lineHeight ?? 0.95;
  const palette = opts.palette ?? DEFAULT_PALETTE;
  const glow = opts.glow ?? 'rgba(255,120,40,0.55)';
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;

  const lines = (opts.lines ?? String(text ?? '').split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { width: 0, height: 0, size, lines: [] };

  const widest = lines.reduce((max, line) => Math.max(max, measureLine(ctx, line, size, tracking).width), 0);
  const blockHeight = size * lineHeight * lines.length;
  const top = y - blockHeight / 2;

  lines.forEach((line, index) => {
    const baseline = top + size * lineHeight * (index + 0.5) + size * 0.34;
    drawLine(ctx, line, x, baseline, size, { tracking, condense, skew, palette, glow });
  });

  return { width: widest * condense, height: blockHeight, size, lines };
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
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], cursor, y);
    cursor += widths[i] + tracking * size;
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
