// The Vice City colour grades. Each grade is a stack of compositing passes over the photograph already drawn in the
// panel: a duotone pass in `color` blend mode (which keeps the photograph's light and swaps its hue), then gradients
// in overlay / soft-light / screen / multiply / color-dodge, plus a saturation pass through ctx.filter where the
// browser supports it. Every grade closes with a vignette so the eye falls to the middle.

/** Fills the panel with a paint (a gradient, usually) under a blend mode. */
function paint(ctx, w, h, style, mode = 'source-over', alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = style;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Recolours the panel: `color` blend takes the hue and saturation of the paint and keeps the photograph's
 * luminance, which is what turns an ordinary snapshot into a poster's two-colour print.
 */
function duotone(ctx, w, h, style, alpha) {
  paint(ctx, w, h, style, 'color', alpha);
}

/** A vertical or diagonal gradient built from [offset, colour] stops. */
function linear(ctx, x0, y0, x1, y1, stops) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  return gradient;
}

/** A radial glow built from [offset, colour] stops. */
function radial(ctx, cx, cy, inner, outer, stops) {
  const gradient = ctx.createRadialGradient(cx, cy, Math.max(0, inner), cx, cy, Math.max(inner + 1, outer));
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  return gradient;
}

/** The corner darkening every grade ends with. */
function vignette(ctx, w, h, strength = 0.55, tint = '0,0,0') {
  const cx = w * 0.5;
  const cy = h * 0.46;
  const inner = Math.min(w, h) * 0.3;
  const outer = Math.hypot(w, h) * 0.62;
  const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  gradient.addColorStop(0, `rgba(${tint},0)`);
  gradient.addColorStop(0.55, `rgba(${tint},${(strength * 0.18).toFixed(3)})`);
  gradient.addColorStop(0.82, `rgba(${tint},${(strength * 0.55).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(${tint},${strength.toFixed(3)})`);
  paint(ctx, w, h, gradient);
}

// A single scratch canvas is reused for the saturation passes: cheaper than allocating one per panel per redraw.
let scratchCanvas = null;

/**
 * Runs the panel's pixels through a CSS filter (saturate, contrast, sepia, hue-rotate) and draws them back.
 * `origin` is the panel's position on the canvas, since the context is already translated to the panel.
 */
function filterPass(ctx, w, h, origin, filter) {
  if (!filter || typeof document === 'undefined') return;
  try {
    const width = Math.max(1, Math.round(w));
    const height = Math.max(1, Math.round(h));
    if (!scratchCanvas) scratchCanvas = document.createElement('canvas');
    if (scratchCanvas.width !== width) scratchCanvas.width = width;
    if (scratchCanvas.height !== height) scratchCanvas.height = height;
    const scratch = scratchCanvas.getContext('2d');
    if (!scratch) return;
    scratch.clearRect(0, 0, width, height);
    scratch.drawImage(ctx.canvas, origin.x, origin.y, width, height, 0, 0, width, height);
    ctx.save();
    ctx.filter = filter;
    ctx.drawImage(scratchCanvas, 0, 0, w, h);
    ctx.restore();
  } catch {
    // A browser without canvas filters simply gets the gradient layers, which carry the look on their own.
  }
}

// 1. Sunset: magenta in the sky, amber climbing out of the horizon, the water left cool so the heat reads hotter.
function sunset(ctx, w, h) {
  paint(ctx, w, h, linear(ctx, 0, h * 0.1, 0, h, [
    [0, 'rgba(255,96,32,0)'],
    [0.4, 'rgba(255,132,44,0.32)'],
    [0.78, 'rgba(255,178,72,0.56)'],
    [1, 'rgba(255,216,124,0.66)'],
  ]), 'overlay', 0.95);
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h * 0.62, [
    [0, 'rgba(214,24,120,0.6)'],
    [0.5, 'rgba(168,26,110,0.2)'],
    [1, 'rgba(0,0,0,0)'],
  ]), 'soft-light', 1);
  paint(ctx, w, h, radial(ctx, w * 0.5, h * 1.02, 0, Math.max(w, h) * 0.8, [
    [0, 'rgba(255,206,120,0.78)'],
    [0.4, 'rgba(255,140,50,0.3)'],
    [1, 'rgba(255,90,20,0)'],
  ]), 'screen', 0.85);
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, 'rgba(38,10,48,0.4)'],
    [0.5, 'rgba(0,0,0,0)'],
    [1, 'rgba(70,14,26,0.22)'],
  ]), 'multiply', 1);
  vignette(ctx, w, h, 0.56, '18,4,14');
}

// 2. Neon: hot pink light in the highlights, electric cyan down in the shadows.
function neon(ctx, w, h) {
  duotone(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, '#ff2fb4'],
    [0.4, '#ff2fb4'],
    [0.52, '#7a2cff'],
    [0.66, '#00c8ff'],
    [1, '#00e5ff'],
  ]), 0.5);
  paint(ctx, w, h, radial(ctx, w * 0.74, h * 0.14, 0, Math.max(w, h) * 0.74, [
    [0, 'rgba(255,80,214,0.6)'],
    [1, 'rgba(255,40,180,0)'],
  ]), 'screen', 0.9);
  paint(ctx, w, h, radial(ctx, w * 0.18, h, 0, Math.max(w, h) * 0.72, [
    [0, 'rgba(0,226,255,0.5)'],
    [1, 'rgba(0,180,255,0)'],
  ]), 'screen', 0.8);
  paint(ctx, w, h, linear(ctx, 0, h * 0.5, w, h, [
    [0, 'rgba(0,0,0,0)'],
    [0.7, 'rgba(120,60,255,0.16)'],
    [1, 'rgba(255,90,200,0.3)'],
  ]), 'color-dodge', 0.45);
  vignette(ctx, w, h, 0.64, '8,0,24');
}

// 3. Dusk: deep violet and indigo, cool and moody.
function dusk(ctx, w, h) {
  duotone(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, '#9a6bff'],
    [0.48, '#4c3cb8'],
    [1, '#141a5e'],
  ]), 0.44);
  paint(ctx, w, h, radial(ctx, w * 0.3, h * 0.02, 0, Math.max(w, h) * 0.86, [
    [0, 'rgba(160,132,255,0.5)'],
    [0.5, 'rgba(96,66,205,0.16)'],
    [1, 'rgba(40,20,120,0)'],
  ]), 'screen', 0.85);
  paint(ctx, w, h, linear(ctx, 0, h * 0.5, 0, h, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(88,44,190,0.28)'],
  ]), 'overlay', 0.8);
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, 'rgba(30,20,80,0.25)'],
    [0.6, 'rgba(0,0,0,0)'],
    [1, 'rgba(10,10,50,0.35)'],
  ]), 'multiply', 1);
  vignette(ctx, w, h, 0.6, '6,4,30');
}

// 4. Gold: amber and honey, high warmth, the blacks lifted into a faded film print.
function gold(ctx, w, h) {
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, 'rgba(120,84,30,0.3)'],
    [1, 'rgba(255,196,110,0.42)'],
  ]), 'screen', 0.55);
  paint(ctx, w, h, linear(ctx, 0, 0, w * 0.3, h, [
    [0, 'rgba(255,214,132,0.52)'],
    [0.55, 'rgba(230,158,60,0.28)'],
    [1, 'rgba(160,88,20,0.4)'],
  ]), 'overlay', 0.9);
  paint(ctx, w, h, radial(ctx, w * 0.66, h * 0.24, 0, Math.max(w, h) * 0.64, [
    [0, 'rgba(255,240,186,0.52)'],
    [1, 'rgba(255,190,90,0)'],
  ]), 'screen', 0.65);
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, 'rgba(90,60,20,0.22)'],
    [0.55, 'rgba(0,0,0,0)'],
    [1, 'rgba(120,70,10,0.26)'],
  ]), 'multiply', 1);
  vignette(ctx, w, h, 0.46, '34,20,4');
}

// 5. Vice: pink from the west, turquoise from the east, a hard split across the frame.
function vice(ctx, w, h) {
  duotone(ctx, w, h, linear(ctx, 0, 0, w, 0, [
    [0, '#ff3d92'],
    [0.38, '#ff3d92'],
    [0.5, '#c02a8a'],
    [0.62, '#00c8cc'],
    [1, '#00d8d8'],
  ]), 0.5);
  paint(ctx, w, h, linear(ctx, 0, 0, w, h, [
    [0, 'rgba(255,60,140,0.5)'],
    [0.48, 'rgba(255,60,140,0)'],
    [1, 'rgba(0,220,230,0.5)'],
  ]), 'soft-light', 0.95);
  paint(ctx, w, h, radial(ctx, w * 0.12, h * 0.12, 0, Math.max(w, h) * 0.6, [
    [0, 'rgba(255,80,150,0.5)'],
    [1, 'rgba(255,60,140,0)'],
  ]), 'screen', 0.7);
  paint(ctx, w, h, radial(ctx, w, h, 0, Math.max(w, h) * 0.62, [
    [0, 'rgba(0,226,232,0.42)'],
    [1, 'rgba(0,200,220,0)'],
  ]), 'screen', 0.65);
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, 'rgba(40,4,50,0.3)'],
    [0.55, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,40,60,0.24)'],
  ]), 'multiply', 1);
  vignette(ctx, w, h, 0.56, '10,2,26');
}

// 6. Noir: desaturated, cold blue, a heavy vignette closing in from every corner.
function noir(ctx, w, h) {
  duotone(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, '#a8c8ec'],
    [0.55, '#5c7797'],
    [1, '#22314a'],
  ]), 0.34);
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, 'rgba(60,96,140,0.4)'],
    [0.5, 'rgba(30,52,86,0.22)'],
    [1, 'rgba(10,20,40,0.5)'],
  ]), 'multiply', 1);
  paint(ctx, w, h, radial(ctx, w * 0.5, h * 0.38, 0, Math.max(w, h) * 0.6, [
    [0, 'rgba(150,190,235,0.3)'],
    [1, 'rgba(60,90,140,0)'],
  ]), 'screen', 0.7);
  paint(ctx, w, h, radial(ctx, w * 0.5, h * 0.42, Math.min(w, h) * 0.16, Math.max(w, h) * 0.72, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.5)'],
  ]), 'multiply', 1);
  vignette(ctx, w, h, 0.82, '0,4,12');
}

/**
 * The named grades. `accent`, `glow` and `palette` are what the lettering and the title band borrow, so a cover's
 * type always belongs to the grade under it.
 */
export const GRADES = [
  {
    id: 'sunset',
    name: 'Sunset',
    hint: 'Magenta sky into amber heat',
    accent: '#ff8a3d',
    glow: 'rgba(255,120,40,0.60)',
    filter: 'saturate(1.3) contrast(1.06)',
    palette: { top: '#fff6da', bottom: '#ffa32b', outline: '#2b0710' },
    apply: sunset,
  },
  {
    id: 'neon',
    name: 'Neon',
    hint: 'Cyan shadows, hot pink light',
    accent: '#ff4fd8',
    glow: 'rgba(255,60,200,0.60)',
    filter: 'saturate(1.42) contrast(1.12) hue-rotate(-8deg)',
    palette: { top: '#fff0fb', bottom: '#ff3fae', outline: '#22002e' },
    apply: neon,
  },
  {
    id: 'dusk',
    name: 'Dusk',
    hint: 'Violet and indigo',
    accent: '#9b86ff',
    glow: 'rgba(120,90,255,0.55)',
    filter: 'saturate(1.08) contrast(1.1) brightness(0.96)',
    palette: { top: '#f2eeff', bottom: '#7f5cff', outline: '#0d0730' },
    apply: dusk,
  },
  {
    id: 'gold',
    name: 'Gold',
    hint: 'Honey light, faded blacks',
    accent: '#ffcc55',
    glow: 'rgba(255,190,70,0.55)',
    filter: 'sepia(0.24) saturate(1.26) contrast(1.02) brightness(1.05)',
    palette: { top: '#fffbe6', bottom: '#e3a12a', outline: '#2a1606' },
    apply: gold,
  },
  {
    id: 'vice',
    name: 'Vice',
    hint: 'Pink and turquoise',
    accent: '#ff6fa8',
    glow: 'rgba(255,90,150,0.60)',
    filter: 'saturate(1.36) contrast(1.08)',
    palette: { top: '#fff4e2', bottom: '#ff5f9e', outline: '#2a0318' },
    apply: vice,
  },
  {
    id: 'noir',
    name: 'Noir',
    hint: 'Cold, desaturated, heavy',
    accent: '#bcd8ef',
    glow: 'rgba(150,190,225,0.45)',
    filter: 'saturate(0.1) contrast(1.26) brightness(1.02)',
    palette: { top: '#ffffff', bottom: '#a9c2d8', outline: '#04070d' },
    apply: noir,
  },
];

export const GRADE_IDS = GRADES.map((grade) => grade.id);

/** Looks a grade up by id, falling back to the first one. */
export function getGrade(id) {
  return GRADES.find((grade) => grade.id === id) ?? GRADES[0];
}

/** Grades a panel: a saturation pass first, then the gradient layers, then the vignette. */
export function applyGrade(ctx, w, h, grade, origin) {
  const chosen = typeof grade === 'string' ? getGrade(grade) : (grade ?? GRADES[0]);
  if (origin) filterPass(ctx, w, h, origin, chosen.filter);
  chosen.apply(ctx, w, h);
}
