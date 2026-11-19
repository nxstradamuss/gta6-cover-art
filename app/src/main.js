// Wires the page: load a photo, pick a layout, write the caption, choose a grade and an export size, and download
// the finished PNG. A `?shot=` query turns the page into a fixed scene for a screenshot instead (./shots.js).

import { drawCover } from './cover.js';
import { GRADES } from './grades.js';
import { LAYOUT_IDS, LAYOUT_NAMES } from './layouts.js';
import { findFocus } from './saliency.js';
import { addPhoto, applyFocus, createState, setGrade, setLayout, setSize, SIZES } from './state.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const captionInput = document.getElementById('caption');
const kickerInput = document.getElementById('kicker');
const subtitleInput = document.getElementById('subtitle');
const layoutRow = document.getElementById('layouts');
const gradeRow = document.getElementById('grades');
const sizeRow = document.getElementById('sizes');
const sampleButtons = Array.from(document.querySelectorAll('[data-sample]'));

const state = createState();
let activeSample = 'pier';

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

/** Repaints the cover and refreshes the readout under the export button. */
function render() {
  drawCover(canvas, state);
  if (statusEl) {
    const { w, h } = state.size;
    statusEl.textContent = `${w} x ${h} · ${LAYOUT_NAMES[state.layout]} layout · PNG ready`;
  }
  markSelected();
}

// One paint per animation frame at most: typing a caption must not queue a render for every keystroke.
let framePending = false;
function scheduleRender() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(() => {
    framePending = false;
    render();
  });
}

/** Adds the `is-on` class to the chips matching the current document. */
function markSelected() {
  const mark = (row, attribute, value) => {
    if (!row) return;
    for (const chip of row.children) {
      chip.classList.toggle('is-on', chip.dataset[attribute] === String(value ?? 'auto'));
    }
  };
  mark(layoutRow, 'layout', state.layout);
  mark(gradeRow, 'grade', state.grade ?? 'auto');
  mark(sizeRow, 'size', `${state.size.w}x${state.size.h}`);
  for (const button of sampleButtons) {
    button.classList.toggle('is-on', button.dataset.sample === activeSample);
  }
}

/** The little diagram of each layout that the chips wear. */
const LAYOUT_DIAGRAM = {
  vice: [[2, 1, 1, 2], [1, 1, 1, 1], [1, 2, 1, 1], [3, 1, 1, 1], [3, 2, 1, 1]],
  duo: [[1, 1, 1, 2], [2, 1, 1, 2]],
  triptych: [[1, 1, 1, 2], [2, 1, 1, 2], [3, 1, 1, 2]],
  hero: [[1, 1, 3, 2]],
};

/** Builds the small layout diagram used inside a chip. */
function buildDiagram(id) {
  const diagram = document.createElement('span');
  diagram.className = 'mini';
  for (const [column, row, spanX, spanY] of LAYOUT_DIAGRAM[id] ?? LAYOUT_DIAGRAM.hero) {
    const cell = document.createElement('i');
    cell.style.gridArea = `${row} / ${column} / ${row + spanY} / ${column + spanX}`;
    diagram.append(cell);
  }
  return diagram;
}

/** Builds the layout chips. */
function buildLayoutChips() {
  if (!layoutRow) return;
  for (const id of LAYOUT_IDS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip chip-layout';
    chip.dataset.layout = id;
    chip.append(buildDiagram(id));
    const name = document.createElement('span');
    name.textContent = LAYOUT_NAMES[id];
    chip.append(name);
    chip.addEventListener('click', () => {
      setLayout(state, id);
      render();
    });
    layoutRow.append(chip);
  }
}

/** Builds the grade chips: Auto plus every named grade, each wearing its own accent colour. */
function buildGradeChips() {
  if (!gradeRow) return;
  const auto = document.createElement('button');
  auto.type = 'button';
  auto.className = 'chip chip-grade';
  auto.dataset.grade = 'auto';
  auto.textContent = 'Auto';
  auto.addEventListener('click', () => {
    setGrade(state, null);
    render();
  });
  gradeRow.append(auto);

  for (const grade of GRADES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip chip-grade';
    chip.dataset.grade = grade.id;
    chip.style.setProperty('--accent', grade.accent);
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    const name = document.createElement('span');
    name.textContent = grade.name;
    chip.append(swatch, name);
    chip.title = grade.hint;
    chip.addEventListener('click', () => {
      setGrade(state, grade.id);
      render();
    });
    gradeRow.append(chip);
  }
}

/** Builds the export-size chips. */
function buildSizeChips() {
  if (!sizeRow) return;
  for (const size of SIZES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip chip-size';
    chip.dataset.size = `${size.w}x${size.h}`;
    const label = document.createElement('strong');
    label.textContent = size.label;
    const hint = document.createElement('span');
    hint.textContent = size.hint;
    chip.append(label, hint);
    chip.addEventListener('click', () => {
      setSize(state, size.w, size.h);
      render();
    });
    sizeRow.append(chip);
  }
}

/** Loads one of the bundled sample photos and points every panel at the subject the saliency pass finds. */
async function loadSample(name) {
  const image = await loadImage(`samples/${name}.jpg`);
  state.photos.length = 0;
  for (const panel of state.panels) panel.photoIndex = -1;
  const focus = findFocus(image);
  addPhoto(state, image, name, focus);
  applyFocus(state, focus);
  activeSample = name;
  render();
  return image;
}

/** When several photos are loaded, spreads them across the panels instead of leaving the later ones unseen. */
function spreadPhotos() {
  if (state.photos.length < 2) return;
  state.panels.forEach((panel, index) => {
    panel.photoIndex = index % state.photos.length;
  });
}

/** Sets one or more caption fields from a shot query; undefined leaves a field alone. */
function setCaption(fields = {}) {
  if (typeof fields === 'string') fields = { title: fields };
  if (fields.title !== undefined && captionInput) {
    state.caption.title = fields.title;
    captionInput.value = fields.title;
  }
  if (fields.kicker !== undefined && kickerInput) {
    state.caption.kicker = fields.kicker;
    kickerInput.value = fields.kicker;
  }
  if (fields.subtitle !== undefined && subtitleInput) {
    state.caption.subtitle = fields.subtitle;
    subtitleInput.value = fields.subtitle;
  }
}

/** Saves the current canvas as a PNG named for its size. */
function exportPng() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cover-${state.size.w}x${state.size.h}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    if (statusEl) statusEl.textContent = `Saved cover-${state.size.w}x${state.size.h}.png`;
  }, 'image/png');
}

buildLayoutChips();
buildGradeChips();
buildSizeChips();

for (const button of sampleButtons) {
  button.addEventListener('click', () => {
    loadSample(button.dataset.sample).catch(() => {
      if (statusEl) statusEl.textContent = 'That sample could not be loaded.';
    });
  });
}

const photoInput = document.getElementById('photo');
if (photoInput) {
  photoInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const image = await loadImage(url);
        const focus = findFocus(image);
        addPhoto(state, image, file.name.replace(/\.[^.]+$/, ''), focus);
        if (state.photos.length === 1) applyFocus(state, focus);
      } catch {
        if (statusEl) statusEl.textContent = 'That file is not an image the browser can read.';
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    spreadPhotos();
    activeSample = '';
    render();
  });
}

if (captionInput) {
  captionInput.addEventListener('input', () => {
    state.caption.title = captionInput.value;
    scheduleRender();
  });
}
if (kickerInput) {
  kickerInput.addEventListener('input', () => {
    state.caption.kicker = kickerInput.value;
    scheduleRender();
  });
}
if (subtitleInput) {
  subtitleInput.addEventListener('input', () => {
    state.caption.subtitle = subtitleInput.value;
    scheduleRender();
  });
}

const exportButton = document.getElementById('export');
if (exportButton) exportButton.addEventListener('click', exportPng);

const query = new URLSearchParams(location.search);
const shot = query.get('shot');

if (shot) {
  runShot(shot, query, {
    loadSample,
    setCaption,
    setLayout: (id) => setLayout(state, id),
    setSize: (w, h) => setSize(state, w, h),
    setGrade: (id) => setGrade(state, id),
    render,
  }).catch((error) => {
    if (statusEl) statusEl.textContent = `Scene failed: ${error.message}`;
    window.__shotReady = true;
  });
} else {
  loadSample('pier').catch(() => {
    if (statusEl) statusEl.textContent = 'Could not load the sample photo.';
  });
}
