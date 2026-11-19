// Neon Coast cover engine: draws a multi-panel GTA-poster-style cover onto a
// 2D canvas. Everything is drawn from the state the editor hands in — layout,
// colour grade, photos with their crop and position, title and subtitle — so the
// live preview and the exported PNG are the same drawing at different sizes.

export const SIZES = {
  square: { label: 'Square 1080 × 1080', width: 1080, height: 1080 },
  portrait: { label: 'Portrait 1080 × 1350', width: 1080, height: 1350 },
  wide: { label: 'Wide 1920 × 1080', width: 1920, height: 1080 },
};

export const LAYOUTS = {
  grid: { label: 'Vice Grid', panels: 4 },
  nine: { label: 'Nine Panel', panels: 9 },
  hero: { label: 'Full Bleed', panels: 1 },
  tilt: { label: 'Tilted Snaps', panels: 3 },
};

export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.25) contrast(1.08)',
    overlay: [[0, 'rgba(255,120,60,0)'], [0.55, 'rgba(255,90,90,0.10)'], [1, 'rgba(214,40,120,0.30)']],
    tint: 'rgba(255,150,70,0.10)',
    blend: 'soft-light',
  },
  neon: {
    label: 'Neon Night',
    filter: 'saturate(1.35) contrast(1.1)',
    overlay: [[0, 'rgba(255,45,149,0.30)'], [1, 'rgba(0,229,255,0.30)']],
    tint: 'rgba(255,0,160,0.08)',
    blend: 'overlay',
  },
  vice: {
    label: 'Vice Pink',
    filter: 'saturate(1.3) contrast(1.05)',
    overlay: [[0, 'rgba(168,85,247,0.24)'], [1, 'rgba(236,72,153,0.32)']],
    tint: 'rgba(150,60,255,0.10)',
    blend: 'overlay',
  },
  palm: {
    label: 'Palm Teal',
    filter: 'saturate(1.2) contrast(1.06)',
    overlay: [[0, 'rgba(45,212,191,0.22)'], [1, 'rgba(255,179,71,0.28)']],
    tint: 'rgba(20,180,160,0.08)',
    blend: 'soft-light',
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(1) contrast(1.25) brightness(1.06)',
    overlay: [],
    tint: null,
    blend: 'source-over',
  },
};

export function panelCount(layout) {
  return (LAYOUTS[layout] ?? LAYOUTS.grid).panels;
}

/** Panel rectangles for a layout, in canvas pixels. `rot` is a tilt in degrees. */
export function panelRects(layout, w, h) {
  const frame = Math.round(w * 0.014);
  const g = Math.max(4, Math.round(w * 0.008));
  const x0 = frame;
  const y0 = frame;
  const iw = w - frame * 2;
  const ih = h - frame * 2;
  const cell = (x, y, cw, ch, rot = 0) => ({ x, y, w: cw, h: ch, rot });

  if (layout === 'nine') {
    const cw = (iw - g * 2) / 3;
    const ch = (ih - g * 2) / 3;
    const rects = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        rects.push(cell(x0 + c * (cw + g), y0 + r * (ch + g), cw, ch));
      }
    }
    return rects;
  }
  if (layout === 'hero') return [cell(x0, y0, iw, ih)];
  if (layout === 'tilt') {
    const th = ih * 0.74;
    return [
      cell(x0 + iw * 0.04, y0 + ih * 0.02, iw * 0.44, th * 0.82, -5),
      cell(x0 + iw * 0.50, y0 + ih * 0.10, iw * 0.46, th * 0.78, 3.5),
      cell(x0 + iw * 0.13, y0 + ih * 0.42, iw * 0.42, th * 0.55, -2),
    ];
  }
  // grid: one hero panel left, three stacked panels right.
  const heroW = Math.round(iw * 0.615);
  const sideW = iw - heroW - g;
  const sideH = (ih - g * 2) / 3;
  return [
    cell(x0, y0, heroW, ih),
    cell(x0 + heroW + g, y0, sideW, sideH),
    cell(x0 + heroW + g, y0 + sideH + g, sideW, sideH),
    cell(x0 + heroW + g, y0 + (sideH + g) * 2, sideW, sideH),
  ];
}

/** Draws one photo into a panel rect, cover-fit, with its zoom and pan. */
export function drawPhotoInPanel(ctx, img, rect, photo, grade) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const s = base * (photo.zoom || 1);
  const pw = img.naturalWidth * s;
  const ph = img.naturalHeight * s;
  const cx = rect.x + rect.w / 2 + (photo.ox || 0) * rect.w;
  const cy = rect.y + rect.h / 2 + (photo.oy || 0) * rect.h;
  ctx.save();
  ctx.filter = grade.filter || 'none';
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.restore();
}

/** Washes a clipped panel with the grade's gradient and tint. */
export function applyGradeOverlay(ctx, rect, grade) {
  if (grade.tint) {
    ctx.save();
    ctx.globalCompositeOperation = grade.blend;
    ctx.fillStyle = grade.tint;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
  if (grade.overlay.length) {
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    for (const [stop, color] of grade.overlay) grad.addColorStop(stop, color);
    ctx.save();
    ctx.globalCompositeOperation = grade.blend;
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}

function drawPlaceholderPanel(ctx, rect, index) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, '#3d2358');
  grad.addColorStop(1, '#1c1126');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = 'rgba(244,238,247,0.75)';
  ctx.font = `700 ${Math.max(14, rect.w * 0.055)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`PANEL ${index + 1}`, rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.textBaseline = 'alphabetic';
}

/** A sunset sky with a low sun, the backdrop of the tilted-snaps layout. */
export function drawSunsetBackdrop(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2b1055');
  sky.addColorStop(0.45, '#7597de');
  sky.addColorStop(0.62, '#ff7e5f');
  sky.addColorStop(0.8, '#feb47b');
  sky.addColorStop(1, '#ff5da2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sunR = w * 0.16;
  const sun = ctx.createRadialGradient(w * 0.72, h * 0.42, sunR * 0.1, w * 0.72, h * 0.42, sunR);
  sun.addColorStop(0, 'rgba(255,244,200,0.95)');
  sun.addColorStop(0.6, 'rgba(255,190,90,0.75)');
  sun.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.42, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Distant skyline silhouette along the bottom of the sky.
  ctx.fillStyle = 'rgba(30,10,45,0.5)';
  const base = h * 0.78;
  let bx = 0;
  while (bx < w) {
    const bw = w * (0.04 + (((bx * 13) % 7) / 100));
    const bh = h * (0.04 + (((bx * 29) % 9) / 100));
    ctx.fillRect(bx, base - bh, bw, bh);
    bx += bw + w * 0.015;
  }
  ctx.fillRect(0, base, w, h * 0.02);
}

let grainPattern = null;
function grainTile() {
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(128, 128);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  return tile;
}

export function drawGrain(ctx, w, h) {
  if (!grainPattern) grainPattern = ctx.createPattern(grainTile(), 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function drawVignette(ctx, w, h) {
  const grad = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  grad.addColorStop(0, 'rgba(16,4,32,0)');
  grad.addColorStop(1, 'rgba(16,4,32,0.34)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/** Shrinks the title font until it fits the cover width. */
export function fitTitleFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 18) {
    size -= 2;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

export function drawTitleBlock(ctx, w, h, title, subtitle) {
  const text = (title || '').trim().toUpperCase();
  const sub = (subtitle || '').trim();
  // Size the title first: the subtitle sits just above its cap height, so the
  // two lines can never collide whatever the cover size.
  const titleY = h - h * 0.05;
  const titleSize = text ? fitTitleFont(ctx, text, w * 0.88, Math.round(w * 0.115)) : 0;
  if (sub) {
    const subSize = Math.max(20, Math.round(w * 0.032));
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5da2';
    ctx.shadowColor = '#ff2d92';
    ctx.shadowBlur = subSize * 0.5;
    ctx.fillText(sub, w / 2, titleSize ? titleY - titleSize * 0.98 : h - h * 0.1);
    ctx.shadowBlur = 0;
  }
  if (text) {
    const size = titleSize;
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#160a24';
    ctx.lineWidth = Math.max(4, size * 0.14);
    const y = titleY;
    ctx.strokeText(text, w / 2, y);
    const fill = ctx.createLinearGradient(0, y - size, 0, y);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(1, '#ffe1f0');
    ctx.fillStyle = fill;
    ctx.fillText(text, w / 2, y);
  }
  // Small original-brand pill in the top corner.
  const pill = 'NEON COAST';
  const pillSize = Math.max(13, Math.round(w * 0.016));
  ctx.font = `${pillSize}px Anton, sans-serif`;
  const pillW = ctx.measureText(pill).width + pillSize * 1.6;
  const pillH = pillSize * 2.1;
  const px = w * 0.014 + pillSize * 0.4;
  const py = h * 0.014 + pillSize * 0.4;
  ctx.fillStyle = 'rgba(20,8,32,0.78)';
  ctx.beginPath();
  ctx.roundRect(px, py, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = '#ffb347';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pill, px + pillW / 2, py + pillH / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

/**
 * Draws the whole cover onto `canvas` at its own size.
 * state: { layout, grade, title, subtitle, photos: [{img, zoom, ox, oy}], panels: [photoIndex] }
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const rects = panelRects(state.layout, w, h);
  const gutter = Math.max(4, Math.round(w * 0.008));

  // Poster frame and backdrop.
  ctx.fillStyle = '#f7f2ea';
  ctx.fillRect(0, 0, w, h);
  if (state.layout === 'tilt') {
    const frame = Math.round(w * 0.014);
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame, frame, w - frame * 2, h - frame * 2);
    ctx.clip();
    drawSunsetBackdrop(ctx, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = '#f7f2ea';
    ctx.fillRect(0, 0, w, h);
  }

  rects.forEach((rect, i) => {
    const photoIndex = (state.panels ?? [])[i] ?? i;
    const photo = (state.photos ?? [])[photoIndex] ?? null;
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    if (rect.rot) ctx.rotate((rect.rot * Math.PI) / 180);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    if (state.layout === 'tilt') {
      // Polaroid-style white border with a deeper foot, plus a drop shadow.
      ctx.shadowColor = 'rgba(20,5,35,0.45)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = h * 0.008;
      ctx.fillStyle = '#fffdf8';
      const bw = gutter * 1.6;
      ctx.fillRect(-bw, -bw, rect.w + bw * 2, rect.h + bw * 2 + h * 0.045);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.beginPath();
    ctx.rect(0, 0, rect.w, rect.h);
    ctx.clip();
    if (photo?.img) {
      drawPhotoInPanel(ctx, photo.img, { x: 0, y: 0, w: rect.w, h: rect.h }, photo, grade);
      applyGradeOverlay(ctx, { x: 0, y: 0, w: rect.w, h: rect.h }, grade);
    } else {
      drawPlaceholderPanel(ctx, { x: 0, y: 0, w: rect.w, h: rect.h }, i);
    }
    ctx.restore();
    if (state.layout !== 'tilt') {
      ctx.strokeStyle = '#f7f2ea';
      ctx.lineWidth = gutter;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  });

  drawGrain(ctx, w, h);
  drawVignette(ctx, w, h);
  drawTitleBlock(ctx, w, h, state.title, state.subtitle);
}
