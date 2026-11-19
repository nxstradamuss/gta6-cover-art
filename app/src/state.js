// The cover document. Everything the drawing needs lives here: the loaded photos, the panels that show them, the
// caption, the layout, the optional global grade and the export size. All variety comes from a seeded generator, so
// the same document always paints the same pixels.

import { GRADES, getGrade } from './grades.js';
import { getLayout, LAYOUT_IDS } from './layouts.js';

export const DEFAULT_CAPTION = {
  title: 'Sunset Heist',
  subtitle: 'Coming Soon',
  kicker: 'A Makefun Picture',
};

export const DEFAULT_SIZE = { w: 1080, h: 1080 };

/** The three post sizes the app exports, plus the label each one wears in the editor. */
export const SIZES = [
  { id: 'square', w: 1080, h: 1080, label: '1:1', hint: '1080 x 1080' },
  { id: 'portrait', w: 1080, h: 1350, label: '4:5', hint: '1080 x 1350' },
  { id: 'landscape', w: 1920, h: 1080, label: '16:9', hint: '1920 x 1080' },
];

// The grade each panel wears: a warm hero, then a cool panel beside it, so the collage has colour contrast
// instead of one flat orange wash.
const PANEL_GRADES = ['sunset', 'dusk', 'gold', 'vice', 'neon', 'noir'];

/** A small deterministic generator (mulberry32). Same seed, same numbers, every run and every machine. */
export function makeRandom(seed = 1) {
  let state = (Number(seed) || 1) >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** How many panels a layout asks for at a given size. */
export function panelCount(layout, size) {
  return getLayout(layout, size.w, size.h).panels.length;
}

function gradeIndexFor(index) {
  const id = PANEL_GRADES[index % PANEL_GRADES.length];
  const found = GRADES.findIndex((grade) => grade.id === id);
  return found < 0 ? 0 : found;
}

/**
 * Grows or trims the panel list to match the layout. New panels take the next photo in the set (so one photo fills
 * every panel, and several photos spread across them) and the next grade in the warm-first cycle.
 */
export function syncPanels(state) {
  const wanted = panelCount(state.layout, state.size);
  while (state.panels.length < wanted) {
    const index = state.panels.length;
    const photos = state.photos.length;
    state.panels.push({
      photoIndex: photos ? index % photos : -1,
      focusX: 0.5,
      focusY: 0.42,
      zoom: 1,
      gradeIndex: gradeIndexFor(index),
    });
  }
  if (state.panels.length > wanted) state.panels.length = wanted;
  return state;
}

/** A fresh cover document. */
export function createState(overrides = {}) {
  const layout = LAYOUT_IDS.includes(overrides.layout) ? overrides.layout : 'vice';
  const state = {
    photos: [],
    panels: [],
    caption: { ...DEFAULT_CAPTION, ...(overrides.caption || {}) },
    layout,
    grade: overrides.grade ?? null,
    size: { ...DEFAULT_SIZE, ...(overrides.size || {}) },
    seed: overrides.seed ?? 20261119,
  };
  syncPanels(state);
  return state;
}

/** A copy safe to hand to a renderer or an undo stack; the photo images are shared, not copied. */
export function cloneState(state) {
  return {
    photos: state.photos.slice(),
    panels: state.panels.map((panel) => ({ ...panel })),
    caption: { ...state.caption },
    layout: state.layout,
    grade: state.grade,
    size: { ...state.size },
    seed: state.seed,
  };
}

/**
 * Adds a loaded photo. Empty panels take it immediately, so the first photo fills the whole cover and later photos
 * land in the panels still waiting for one.
 */
export function addPhoto(state, image, name = 'photo', focus = null) {
  state.photos.push({ image, name, focus });
  const index = state.photos.length - 1;
  for (const panel of state.panels) {
    if (panel.photoIndex < 0) {
      panel.photoIndex = index;
      if (focus) {
        panel.focusX = focus.x;
        panel.focusY = focus.y;
      }
    }
  }
  return index;
}

/**
 * Points every panel at a subject found by the saliency pass, with a little seeded jitter and zoom so several
 * panels cut from one photograph read as several shots rather than one image sliced up.
 */
export function applyFocus(state, focus) {
  if (!focus) return;
  const random = makeRandom(state.seed + 37);
  for (const panel of state.panels) {
    panel.focusX = clamp01(focus.x + (random() - 0.5) * 0.09);
    panel.focusY = clamp01(focus.y + (random() - 0.5) * 0.07);
    panel.zoom = 1 + random() * 0.2;
  }
}

/** Switches layout, keeping as many photos and grades as the new panel count allows. */
export function setLayout(state, layout) {
  if (!LAYOUT_IDS.includes(layout)) return state;
  state.layout = layout;
  syncPanels(state);
  return state;
}

/** Switches export size, re-measuring the panels for the new aspect. */
export function setSize(state, w, h) {
  state.size = { w: Math.round(w), h: Math.round(h) };
  syncPanels(state);
  return state;
}

/** A global grade override, or null to let each panel wear its own. */
export function setGrade(state, grade) {
  state.grade = grade && getGrade(grade) ? grade : null;
  return state;
}

/** The grade the type and the frame borrow their colour from: the override, else the hero panel's. */
export function primaryGrade(state) {
  if (state.grade) return getGrade(state.grade);
  const hero = state.panels[0];
  return getGrade(GRADES[hero?.gradeIndex % GRADES.length]?.id ?? 'sunset');
}

/** The grade a panel wears, honouring the global override. */
export function panelGrade(state, panel) {
  if (state.grade) return getGrade(state.grade);
  return getGrade(GRADES[(panel?.gradeIndex ?? 0) % GRADES.length]?.id ?? 'sunset');
}
