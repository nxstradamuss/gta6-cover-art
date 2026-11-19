// The Vice City colour grades. Each grade is a stack of compositing passes over the photograph already drawn in the
// panel: a duotone pass in `color` blend mode (which keeps the photograph's light and swaps its hue), then gradients
// in overlay / soft-light / screen / multiply / color-dodge. The grade's `filter` is applied by the caller as the
// photograph is drawn, so the saturation and contrast of the source are part of the same single draw instead of a
// second pass over the pixels.
//
// A grade is worn in a *tone*: the same recipe with its hues moved a few degrees round the wheel and its washes run
// hotter or deeper. That is what lets one cover use one grade five times and still show variety — variety of
// intensity, not of hue family. The light is not part of any grade: every panel ends with the same sun and the same
// vignette (see `sharedLight`), so the prints read as one photograph cut into pieces.

import { formatColour, hueGap, hueOfColour, parseColour, rotateColour, setAlpha } from './colour.js';

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

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/**
 * A tone is how a grade is worn: `shift` moves every hue in the recipe this many degrees, `heat` scales every
 * wash's strength, and `depth` sinks the shadows. `c()` returns the tone's version of a colour, `a()` its version
 * of an alpha. Tones are immutable, so one can be handed round freely.
 */
export function makeTone(options = {}) {
  const shift = Number.isFinite(options.shift) ? options.shift : 0;
  const heat = Number.isFinite(options.heat) ? options.heat : 1;
  const depth = Number.isFinite(options.depth) ? clamp01(options.depth) : 0;
  const memory = new Map();

  return {
    shift,
    heat,
    depth,
    /** The tone's version of a colour: the hue moved, the alpha untouched (the pass alpha carries the heat). */
    c(colour) {
      if (!shift) return typeof colour === 'string' ? colour : formatColour(colour);
      const key = typeof colour === 'string' ? colour : formatColour(colour);
      const hit = memory.get(key);
      if (hit) return hit;
      const toned = formatColour(rotateColour(colour, shift));
      memory.set(key, toned);
      return toned;
    },
    /** The tone's version of a pass alpha. */
    a(alpha) {
      return clamp01(alpha * heat);
    },
  };
}

/** The neutral tone: the grade exactly as it is written, worn at full heat. */
export const NEUTRAL_TONE = makeTone();

// 1. Sunset: magenta in the sky, amber climbing out of the horizon, the water left cool so the heat reads hotter.
function sunset(ctx, w, h, tone) {
  paint(ctx, w, h, linear(ctx, 0, h * 0.1, 0, h, [
    [0, tone.c('rgba(255,96,32,0)')],
    [0.4, tone.c('rgba(255,132,44,0.32)')],
    [0.78, tone.c('rgba(255,178,72,0.56)')],
    [1, tone.c('rgba(255,216,124,0.66)')],
  ]), 'overlay', tone.a(0.95));
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h * 0.62, [
    [0, tone.c('rgba(214,24,120,0.6)')],
    [0.5, tone.c('rgba(168,26,110,0.2)')],
    [1, tone.c('rgba(0,0,0,0)')],
  ]), 'soft-light', tone.a(1));
  paint(ctx, w, h, radial(ctx, w * 0.5, h * 1.02, 0, Math.max(w, h) * 0.8, [
    [0, tone.c('rgba(255,206,120,0.78)')],
    [0.4, tone.c('rgba(255,140,50,0.3)')],
    [1, tone.c('rgba(255,90,20,0)')],
  ]), 'screen', tone.a(0.85));
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, tone.c('rgba(38,10,48,0.4)')],
    [0.5, tone.c('rgba(0,0,0,0)')],
    [1, tone.c('rgba(70,14,26,0.22)')],
  ]), 'multiply', tone.a(1));
}

// 2. Neon: hot pink light in the highlights, electric cyan down in the shadows.
function neon(ctx, w, h, tone) {
  duotone(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, tone.c('#ff2fb4')],
    [0.4, tone.c('#ff2fb4')],
    [0.52, tone.c('#7a2cff')],
    [0.66, tone.c('#00c8ff')],
    [1, tone.c('#00e5ff')],
  ]), tone.a(0.5));
  paint(ctx, w, h, radial(ctx, w * 0.74, h * 0.14, 0, Math.max(w, h) * 0.74, [
    [0, tone.c('rgba(255,80,214,0.6)')],
    [1, tone.c('rgba(255,40,180,0)')],
  ]), 'screen', tone.a(0.9));
  paint(ctx, w, h, radial(ctx, w * 0.18, h, 0, Math.max(w, h) * 0.72, [
    [0, tone.c('rgba(0,226,255,0.5)')],
    [1, tone.c('rgba(0,180,255,0)')],
  ]), 'screen', tone.a(0.8));
  paint(ctx, w, h, linear(ctx, 0, h * 0.5, w, h, [
    [0, tone.c('rgba(0,0,0,0)')],
    [0.7, tone.c('rgba(120,60,255,0.16)')],
    [1, tone.c('rgba(255,90,200,0.3)')],
  ]), 'color-dodge', tone.a(0.45));
}

// 3. Dusk: deep violet and indigo, cool and moody.
function dusk(ctx, w, h, tone) {
  duotone(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, tone.c('#9a6bff')],
    [0.48, tone.c('#4c3cb8')],
    [1, tone.c('#141a5e')],
  ]), tone.a(0.44));
  paint(ctx, w, h, radial(ctx, w * 0.3, h * 0.02, 0, Math.max(w, h) * 0.86, [
    [0, tone.c('rgba(160,132,255,0.5)')],
    [0.5, tone.c('rgba(96,66,205,0.16)')],
    [1, tone.c('rgba(40,20,120,0)')],
  ]), 'screen', tone.a(0.85));
  paint(ctx, w, h, linear(ctx, 0, h * 0.5, 0, h, [
    [0, tone.c('rgba(0,0,0,0)')],
    [1, tone.c('rgba(88,44,190,0.28)')],
  ]), 'overlay', tone.a(0.8));
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, tone.c('rgba(30,20,80,0.25)')],
    [0.6, tone.c('rgba(0,0,0,0)')],
    [1, tone.c('rgba(10,10,50,0.35)')],
  ]), 'multiply', tone.a(1));
}

// 4. Gold: amber and honey, high warmth, the blacks lifted into a faded film print.
function gold(ctx, w, h, tone) {
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, tone.c('rgba(120,84,30,0.3)')],
    [1, tone.c('rgba(255,196,110,0.42)')],
  ]), 'screen', tone.a(0.55));
  paint(ctx, w, h, linear(ctx, 0, 0, w * 0.3, h, [
    [0, tone.c('rgba(255,214,132,0.52)')],
    [0.55, tone.c('rgba(230,158,60,0.28)')],
    [1, tone.c('rgba(160,88,20,0.4)')],
  ]), 'overlay', tone.a(0.9));
  paint(ctx, w, h, radial(ctx, w * 0.66, h * 0.24, 0, Math.max(w, h) * 0.64, [
    [0, tone.c('rgba(255,240,186,0.52)')],
    [1, tone.c('rgba(255,190,90,0)')],
  ]), 'screen', tone.a(0.65));
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, tone.c('rgba(90,60,20,0.22)')],
    [0.55, tone.c('rgba(0,0,0,0)')],
    [1, tone.c('rgba(120,70,10,0.26)')],
  ]), 'multiply', tone.a(1));
}

// 5. Vice: pink from the west, turquoise from the east, a hard split across the frame.
function vice(ctx, w, h, tone) {
  duotone(ctx, w, h, linear(ctx, 0, 0, w, 0, [
    [0, tone.c('#ff3d92')],
    [0.38, tone.c('#ff3d92')],
    [0.5, tone.c('#c02a8a')],
    [0.62, tone.c('#00c8cc')],
    [1, tone.c('#00d8d8')],
  ]), tone.a(0.5));
  paint(ctx, w, h, linear(ctx, 0, 0, w, h, [
    [0, tone.c('rgba(255,60,140,0.5)')],
    [0.48, tone.c('rgba(255,60,140,0)')],
    [1, tone.c('rgba(0,220,230,0.5)')],
  ]), 'soft-light', tone.a(0.95));
  paint(ctx, w, h, radial(ctx, w * 0.12, h * 0.12, 0, Math.max(w, h) * 0.6, [
    [0, tone.c('rgba(255,80,150,0.5)')],
    [1, tone.c('rgba(255,60,140,0)')],
  ]), 'screen', tone.a(0.7));
  paint(ctx, w, h, radial(ctx, w, h, 0, Math.max(w, h) * 0.62, [
    [0, tone.c('rgba(0,226,232,0.42)')],
    [1, tone.c('rgba(0,200,220,0)')],
  ]), 'screen', tone.a(0.65));
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, tone.c('rgba(40,4,50,0.3)')],
    [0.55, tone.c('rgba(0,0,0,0)')],
    [1, tone.c('rgba(0,40,60,0.24)')],
  ]), 'multiply', tone.a(1));
}

// 6. Noir: desaturated, cold blue, the blacks dropped out of the frame.
function noir(ctx, w, h, tone) {
  duotone(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, tone.c('#a8c8ec')],
    [0.55, tone.c('#5c7797')],
    [1, tone.c('#22314a')],
  ]), tone.a(0.34));
  paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
    [0, tone.c('rgba(60,96,140,0.4)')],
    [0.5, tone.c('rgba(30,52,86,0.22)')],
    [1, tone.c('rgba(10,20,40,0.5)')],
  ]), 'multiply', tone.a(1));
  paint(ctx, w, h, radial(ctx, w * 0.5, h * 0.38, 0, Math.max(w, h) * 0.6, [
    [0, tone.c('rgba(150,190,235,0.3)')],
    [1, tone.c('rgba(60,90,140,0)')],
  ]), 'screen', tone.a(0.7));
}

/**
 * The named grades. `accent`, `glow` and `palette` are what the lettering and the title band borrow, so a cover's
 * type always belongs to the grade under it. `heat` is how saturated the grade is, which is what the shot plan
 * reads when it hands the hero panel the strongest colour.
 */
export const GRADES = [
  {
    id: 'sunset',
    name: 'Sunset',
    hint: 'Magenta sky into amber heat',
    accent: '#ff8a3d',
    glow: 'rgba(255,120,40,0.60)',
    heat: 0.86,
    filter: 'saturate(1.3) contrast(1.06)',
    palette: { top: '#fff6da', mid: '#ffc247', bottom: '#ff8f1f', outline: '#2b0710' },
    apply: sunset,
  },
  {
    id: 'neon',
    name: 'Neon',
    hint: 'Cyan shadows, hot pink light',
    accent: '#ff4fd8',
    glow: 'rgba(255,60,200,0.60)',
    heat: 1,
    filter: 'saturate(1.42) contrast(1.12) hue-rotate(-8deg)',
    palette: { top: '#fff0fb', mid: '#ff7ac8', bottom: '#ff2f9e', outline: '#22002e' },
    apply: neon,
  },
  {
    id: 'dusk',
    name: 'Dusk',
    hint: 'Violet and indigo',
    accent: '#9b86ff',
    glow: 'rgba(120,90,255,0.55)',
    heat: 0.62,
    filter: 'saturate(1.08) contrast(1.1) brightness(0.96)',
    palette: { top: '#f2eeff', mid: '#b9a6ff', bottom: '#6b46e0', outline: '#0d0730' },
    apply: dusk,
  },
  {
    id: 'gold',
    name: 'Gold',
    hint: 'Honey light, faded blacks',
    accent: '#ffcc55',
    glow: 'rgba(255,190,70,0.55)',
    heat: 0.78,
    filter: 'sepia(0.24) saturate(1.26) contrast(1.02) brightness(1.05)',
    palette: { top: '#fffbe6', mid: '#ffd479', bottom: '#c8861a', outline: '#2a1606' },
    apply: gold,
  },
  {
    id: 'vice',
    name: 'Vice',
    hint: 'Pink and turquoise',
    accent: '#ff6fa8',
    glow: 'rgba(255,90,150,0.60)',
    heat: 0.94,
    filter: 'saturate(1.36) contrast(1.08)',
    palette: { top: '#fff4e2', mid: '#ffb1c9', bottom: '#ff4f92', outline: '#2a0318' },
    apply: vice,
  },
  {
    id: 'noir',
    name: 'Noir',
    hint: 'Cold, desaturated, heavy',
    accent: '#bcd8ef',
    glow: 'rgba(150,190,225,0.45)',
    heat: 0.12,
    filter: 'saturate(0.1) contrast(1.26) brightness(1.02)',
    palette: { top: '#ffffff', mid: '#cfe0f0', bottom: '#93aec6', outline: '#04070d' },
    apply: noir,
  },
];

export const GRADE_IDS = GRADES.map((grade) => grade.id);

/** Looks a grade up by id, falling back to the first one. */
export function getGrade(id) {
  return GRADES.find((grade) => grade.id === id) ?? GRADES[0];
}

/** The grades the shot plan chooses between: the colourful ones. The desaturated grade is the editor's to apply. */
const AUTO_GRADE_IDS = ['sunset', 'vice', 'gold', 'dusk', 'neon'];

export const AUTO_GRADES = AUTO_GRADE_IDS.map((id) => getGrade(id));

/**
 * The key grade for a cover: of the colourful grades, the one whose accent hue sits closest to `hue` — the hero
 * photograph's own dominant hue. The whole cover is graded in this one grade, so the choice decides the colour
 * story for every panel and for the title band.
 */
export function keyGradeForHue(hue) {
  const target = Number.isFinite(hue) ? ((hue % 360) + 360) % 360 : 28;
  let best = AUTO_GRADES[0];
  let bestGap = Number.POSITIVE_INFINITY;
  for (const grade of AUTO_GRADES) {
    const gap = hueGap(target, hueOfColour(grade.accent));
    if (gap < bestGap) {
      best = grade;
      bestGap = gap;
    }
  }
  return best;
}

/** How far round the wheel a grade may sit from the key and still belong to the same colour story. */
const FAMILY_ARC = 45;
/** How many plates a cover is graded in. */
export const FAMILY_SIZE = 5;
/** How the family's members differ in intensity: one hot, one muted, one deep, and two in between. */
const FAMILY_HEAT = [1, 0.86, 0.94, 0.72, 1.04];
const FAMILY_DEPTH = [0.04, 0.16, 0.3, 0.1, 0.42];

/**
 * The family a cover is graded in, the key grade first. Members are the other colourful grades whose accent hue
 * already sits inside FAMILY_ARC degrees of the key's — the same colour story told in a different print — and then,
 * when that set is too small, the key grade itself moved ±12 and ±24 degrees round the wheel. No member is ever a
 * complement of the key. Each member carries its own heat and depth, so the family varies in intensity rather than
 * in hue family.
 */
export function gradeFamily(keyGrade) {
  const keyHue = hueOfColour(keyGrade.accent);
  const members = [];
  const add = (grade, shift) => {
    if (members.length >= FAMILY_SIZE) return;
    const slot = members.length;
    members.push({
      gradeIndex: Math.max(0, GRADES.findIndex((entry) => entry.id === grade.id)),
      id: grade.id,
      shift,
      heat: FAMILY_HEAT[slot],
      depth: FAMILY_DEPTH[slot],
    });
  };

  add(keyGrade, 0);

  const near = AUTO_GRADES
    .filter((grade) => grade.id !== keyGrade.id)
    .map((grade) => ({ grade, gap: hueGap(keyHue, hueOfColour(grade.accent)) }))
    .filter((entry) => entry.gap <= FAMILY_ARC)
    .sort((a, b) => a.gap - b.gap);
  for (const { grade } of near) add(grade, 0);

  for (const shift of [-12, 12, -24, 24]) add(keyGrade, shift);
  return members;
}

/** Where the light stands, in fractions of a panel. One sun for the whole cover, up and to the right. */
const SUN = { x: 0.68, y: 0.26 };

/** The corner darkening every panel ends with. Same shape everywhere, tinted with the grade's own shadow colour. */
function vignette(ctx, w, h, strength, colour) {
  const { r, g, b } = parseColour(colour);
  const tint = `${r},${g},${b}`;
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

/**
 * The light every panel shares: a warm glow falling from the same point in the frame (so all the prints are lit
 * from the same side and carry the same warmth in their highlights), a multiply wash for the deeper tones, and the
 * one vignette shape. Because the shape never varies, five panels read as one photograph rather than five grades.
 */
function sharedLight(ctx, w, h, grade, tone) {
  const accent = grade.accent;
  paint(ctx, w, h, radial(ctx, w * SUN.x, h * SUN.y, 0, Math.max(w, h) * 0.9, [
    [0, tone.c(setAlpha(accent, 0.2))],
    [0.42, tone.c(setAlpha(accent, 0.08))],
    [1, tone.c(setAlpha(accent, 0))],
  ]), 'screen', tone.a(0.9));

  if (tone.depth > 0.001) {
    paint(ctx, w, h, linear(ctx, 0, 0, 0, h, [
      [0, tone.c(setAlpha(grade.palette.outline, tone.depth * 0.24))],
      [0.55, tone.c(setAlpha(grade.palette.outline, 0))],
      [1, tone.c(setAlpha(grade.palette.outline, tone.depth * 0.36))],
    ]), 'multiply', 1);
  }

  vignette(ctx, w, h, 0.5 + tone.depth * 0.45, grade.palette.outline);
}

/**
 * Grades a panel that already holds its photograph: the grade's own passes, then the shared light. `tone` decides
 * how the grade is worn; leaving it out wears it straight.
 */
export function applyGrade(ctx, w, h, grade, tone) {
  const chosen = typeof grade === 'string' ? getGrade(grade) : (grade ?? GRADES[0]);
  const worn = tone ?? NEUTRAL_TONE;
  chosen.apply(ctx, w, h, worn);
  sharedLight(ctx, w, h, chosen, worn);
}
