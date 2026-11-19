// Fixed scenes for screenshots: ?shot=editor shows the studio with photos
// loaded; ?shot=cover shows one exported cover alone, full frame, at the
// export size named by `size`. `layout`, `grade`, `title`, `subtitle`,
// `photos` (comma-separated sample names) and `panels` tune the scene.
// window.__shotReady is set once the cover is painted and fonts are in.
import { SIZES, panelCount } from './cover.js';

const SAMPLE_BY_NAME = {
  'sunset-drive': 'samples/sunset-drive.jpg',
  rooftop: 'samples/rooftop.jpg',
  'neon-street': 'samples/neon-street.jpg',
};

function applyQueryToState(query, state) {
  const layout = query.get('layout');
  if (layout) state.layout = layout;
  const grade = query.get('grade');
  if (grade) state.grade = grade;
  const size = query.get('size');
  if (size && SIZES[size]) state.size = size;
  const title = query.get('title');
  if (title !== null) state.title = title;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;
  const panels = query.get('panels');
  if (panels) state.panels = panels.split(',').map((n) => Number(n) || 0);
}

async function loadScenePhotos(query, state, loadImage) {
  const names = (query.get('photos') ?? 'sunset-drive,rooftop,neon-street').split(',');
  state.photos = [];
  for (const name of names) {
    const url = SAMPLE_BY_NAME[name.trim()];
    if (!url) continue;
    try {
      const img = await loadImage(url);
      state.photos.push({ img, zoom: 1, ox: 0, oy: 0 });
    } catch {
      // A photo that fails to load leaves its panel as a placeholder.
    }
  }
  const count = panelCount(state.layout);
  while (state.panels.length < count) state.panels.push(state.panels.length % Math.max(1, state.photos.length));
}

function markReady() {
  const done = () => requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
  if (document.fonts?.ready) document.fonts.ready.then(done);
  else done();
}

export async function runShot(shot, query, api) {
  const { state, loadImage, redraw, renderTray } = api;
  applyQueryToState(query, state);
  await loadScenePhotos(query, state, loadImage);
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.getElementById('titleInput').value = state.title;
    document.getElementById('subtitleInput').value = state.subtitle;
  } else {
    document.getElementById('titleInput').value = state.title;
    document.getElementById('subtitleInput').value = state.subtitle;
    renderTray();
  }
  redraw();
  markReady();
}
