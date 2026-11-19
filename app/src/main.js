// Neon Coast editor wiring: photos, layouts, grades, caption, sizes, panel
// cropping by drag and zoom, and PNG export. A `?shot=` query hands the page
// to ./shots.js, which stages a fixed scene for a screenshot instead.
import { SIZES, LAYOUTS, GRADES, panelCount, panelRects, drawCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const titleInput = document.getElementById('titleInput');
const subtitleInput = document.getElementById('subtitleInput');
const zoomInput = document.getElementById('zoomInput');
const statusEl = document.getElementById('status');
const stageLabel = document.getElementById('stageLabel');
const panelLabel = document.getElementById('panelLabel');
const tray = document.getElementById('photoTray');

const SAMPLE_PHOTOS = ['samples/sunset-drive.jpg', 'samples/rooftop.jpg', 'samples/neon-street.jpg'];

const state = {
  layout: 'grid',
  grade: 'sunset',
  size: 'square',
  title: 'Sunset Run',
  subtitle: 'neon coast nights',
  photos: [],
  panels: [0, 1, 2, 0],
  selectedPanel: 0,
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  const size = SIZES[state.size];
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  drawCover(canvas, state);
  stageLabel.textContent = `Live preview · ${size.label}`;
  panelLabel.textContent = `Panel ${state.selectedPanel + 1} of ${panelCount(state.layout)}`;
  const photo = selectedPhoto();
  if (photo) zoomInput.value = String(photo.zoom || 1);
}

function selectedPhoto() {
  const index = state.panels[state.selectedPanel] ?? 0;
  return state.photos[index] ?? null;
}

/** Rebuilds the photo tray thumbnails from state.photos. */
function renderTray() {
  tray.innerHTML = '';
  if (!state.photos.length) {
    const empty = document.createElement('span');
    empty.className = 'empty';
    empty.textContent = 'No photos yet — add some, or use the samples.';
    tray.appendChild(empty);
    return;
  }
  state.photos.forEach((photo, i) => {
    const thumb = document.createElement('img');
    thumb.src = photo.img.src;
    thumb.alt = `Photo ${i + 1}`;
    thumb.title = `Use photo ${i + 1} in the selected panel`;
    if (state.panels[state.selectedPanel] === i) thumb.classList.add('assigned');
    thumb.addEventListener('click', () => {
      state.panels[state.selectedPanel] = i;
      renderTray();
      redraw();
    });
    tray.appendChild(thumb);
  });
}

/** Which panel, if any, holds canvas point (x, y) — topmost first. */
function hitPanel(x, y) {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rad = (-(r.rot || 0) * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return i;
  }
  return -1;
}

function canvasPoint(event) {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * canvas.width,
    y: ((event.clientY - box.top) / box.height) * canvas.height,
  };
}

let dragging = null;
canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const panel = hitPanel(point.x, point.y);
  if (panel === -1) return;
  state.selectedPanel = panel;
  renderTray();
  redraw();
  const photo = selectedPhoto();
  if (!photo) return;
  dragging = { startX: point.x, startY: point.y, ox: photo.ox || 0, oy: photo.oy || 0 };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const photo = selectedPhoto();
  if (!photo) return;
  const point = canvasPoint(event);
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const rect = rects[state.selectedPanel];
  const zoom = photo.zoom || 1;
  photo.ox = Math.max(-0.4, Math.min(0.4, dragging.ox + (point.x - dragging.startX) / rect.w / zoom));
  photo.oy = Math.max(-0.4, Math.min(0.4, dragging.oy + (point.y - dragging.startY) / rect.h / zoom));
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const photo = selectedPhoto();
  if (!photo) return;
  photo.zoom = Math.max(1, Math.min(2.5, (photo.zoom || 1) * Math.exp(-event.deltaY * 0.0012)));
  redraw();
}, { passive: false });

document.getElementById('photoInput').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  for (const file of files) {
    if (state.photos.length >= 6) break;
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos.push({ img, zoom: 1, ox: 0, oy: 0 });
      state.panels[state.selectedPanel] = state.photos.length - 1;
    } catch {
      statusEl.textContent = `Could not read ${file.name}.`;
    }
  }
  event.target.value = '';
  renderTray();
  redraw();
  statusEl.textContent = files.length ? `${files.length} photo(s) added.` : '';
});

function wirePicker(id, key, onPick) {
  document.getElementById(id).addEventListener('click', (event) => {
    const button = event.target.closest('button[data-' + key + ']');
    if (!button) return;
    for (const b of event.currentTarget.querySelectorAll('button')) b.classList.remove('active');
    button.classList.add('active');
    onPick(button.dataset[key]);
  });
}
wirePicker('layoutPicker', 'layout', (layout) => {
  state.layout = layout;
  state.selectedPanel = 0;
  while (state.panels.length < panelCount(layout)) state.panels.push(state.panels.length % Math.max(1, state.photos.length));
  renderTray();
  redraw();
});
wirePicker('gradePicker', 'grade', (grade) => { state.grade = grade; redraw(); });
wirePicker('sizePicker', 'size', (size) => { state.size = size; redraw(); });

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
zoomInput.addEventListener('input', () => {
  const photo = selectedPhoto();
  if (!photo) return;
  photo.zoom = Number(zoomInput.value);
  redraw();
});
document.getElementById('centerPhoto').addEventListener('click', () => {
  const photo = selectedPhoto();
  if (!photo) return;
  photo.zoom = 1;
  photo.ox = 0;
  photo.oy = 0;
  redraw();
});
document.getElementById('shufflePanels').addEventListener('click', () => {
  const count = panelCount(state.layout);
  const bag = state.photos.map((_, i) => i);
  if (!bag.length) return;
  state.panels = Array.from({ length: count }, () => bag[Math.floor(Math.random() * bag.length)]);
  renderTray();
  redraw();
});

document.getElementById('export').addEventListener('click', () => {
  const size = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = size.width;
  off.height = size.height;
  drawCover(off, state);
  off.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = 'Export failed — try again.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-cover-${size.width}x${size.height}.png`;
    a.click();
    statusEl.textContent = `Saved neon-coast-cover-${size.width}x${size.height}.png`;
  }, 'image/png');
});

/** Loads the bundled sample photos so the studio opens with art in it. */
async function loadSamplePhotos() {
  for (const url of SAMPLE_PHOTOS) {
    try {
      const img = await loadImage(url);
      state.photos.push({ img, zoom: 1, ox: 0, oy: 0 });
    } catch {
      // A missing sample just leaves its slot empty; the editor still works.
    }
  }
}

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, { state, loadImage, redraw, renderTray });
} else {
  await loadSamplePhotos();
  renderTray();
  redraw();
}
