const CONFIG_URL = '/config/stripePresets.json';
const STRIPE_NONE = '__none__';
const LAYER_KEYS = ['bottomFillMask', 'bottomBorder', 'body', 'line'];
const LAYER_LABELS = {
  bottomFillMask: '底部边框内填色图',
  bottomBorder: '底部边框图',
  body: '内部填色图',
  line: '线条图'
};
const DEFAULT_ASSETS = {
  line: 'Monster/尖锐文件_1_线条.png',
  body: 'Monster/尖锐文件_1_内部填色.png',
  bottomBorder: 'Monster/尖锐文件_1_底部边框.png',
  bottomFillMask: 'Monster/尖锐文件_1_底部边框内填色.png'
};

const state = {
  presets: {},
  lastTimeSec: performance.now() / 1000,
  animTimeSec: 0,
  offsetCssPx: { x: 0, y: 0 },
  drag: {
    active: false,
    pointerId: -1,
    lastClientX: 0,
    lastClientY: 0
  },
  renderOrder: ['bottomFillMask', 'bottomBorder', 'body', 'line'],
  layers: {
    line: { path: DEFAULT_ASSETS.line, stripePresetKey: STRIPE_NONE },
    body: { path: DEFAULT_ASSETS.body, stripePresetKey: STRIPE_NONE },
    bottomBorder: { path: DEFAULT_ASSETS.bottomBorder, stripePresetKey: STRIPE_NONE },
    bottomFillMask: { path: DEFAULT_ASSETS.bottomFillMask, stripePresetKey: STRIPE_NONE }
  },
  images: {
    line: null,
    body: null,
    bottomBorder: null,
    bottomFillMask: null
  },
  patternCache: new Map(),
  maskCanvas: document.createElement('canvas')
};

const el = {
  reloadBtn: document.getElementById('reloadBtn'),
  reloadImagesBtn: document.getElementById('reloadImagesBtn'),
  statusText: document.getElementById('statusText'),
  orderBox: document.getElementById('orderBox'),
  layersBox: document.getElementById('layersBox'),
  sizeInput: document.getElementById('sizeInput'),
  resetPositionBtn: document.getElementById('resetPositionBtn'),
  preview: document.getElementById('preview'),
  monsterAssetList: document.getElementById('monsterAssetList')
};

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const setStatus = (message, isError = false) => {
  el.statusText.textContent = message;
  el.statusText.style.color = isError ? '#e07474' : '#9fb0c5';
};

const createDefaultPreset = (key) => ({
  presetKey: key,
  name: key,
  mode: 'stripes',
  solidColor: '#ffffff',
  angleDeg: 45,
  speed: 90,
  background: '#000000',
  segments: [
    { width: 24, fillType: 'solid', color: '#101218', opacity: 1 },
    { width: 24, fillType: 'solid', color: '#9fd3ff', opacity: 1 }
  ]
});

const normalizePreset = (key, preset) => {
  const source = preset && typeof preset === 'object' ? preset : {};
  const fillMode = source.mode === 'solid' ? 'solid' : 'stripes';
  const segmentsRaw = Array.isArray(source.segments) ? source.segments : [];
  const segments = segmentsRaw
    .filter((segment) => segment && typeof segment === 'object')
    .map((segment) => {
      const fillType = segment.fillType === 'gradient' ? 'gradient' : 'solid';
      return {
        width: Math.max(0.01, toNumber(segment.width, 20)),
        fillType,
        color: typeof segment.color === 'string' ? segment.color : '#ffffff',
        fromColor: typeof segment.fromColor === 'string' ? segment.fromColor : '#ffffff',
        toColor: typeof segment.toColor === 'string' ? segment.toColor : '#000000',
        opacity: Math.max(0, Math.min(1, toNumber(segment.opacity, 1)))
      };
    });
  return {
    presetKey: key,
    name: typeof source.name === 'string' && source.name.trim() ? source.name : key,
    mode: fillMode,
    solidColor: typeof source.solidColor === 'string' ? source.solidColor : '#ffffff',
    angleDeg: Math.max(-360, Math.min(360, toNumber(source.angleDeg, 45))),
    speed: Math.max(-5000, Math.min(5000, toNumber(source.speed, 90))),
    background: typeof source.background === 'string' ? source.background : '#000000',
    segments: segments.length > 0 ? segments : createDefaultPreset(key).segments
  };
};

const normalizeLibrary = (library) => {
  if (!library || typeof library !== 'object') return {};
  const out = {};
  for (const [key, preset] of Object.entries(library)) {
    if (!key.trim()) continue;
    out[key] = normalizePreset(key, preset);
  }
  return out;
};

const sortedPresetEntries = () =>
  Object.entries(state.presets).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));

const normalizeResourcePath = (pathText) => {
  const raw = String(pathText || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (raw.startsWith('/resources/')) return raw.slice('/resources/'.length);
  if (raw.startsWith('resources/')) return raw.slice('resources/'.length);
  return raw;
};

const toResourceUrl = (pathText) => {
  const relative = normalizeResourcePath(pathText);
  if (!relative) return '';
  return encodeURI(`/resources/${relative}`);
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败：${src}`));
    img.src = src;
  });

const buildAssetDatalist = () => {
  el.monsterAssetList.innerHTML = '';
  for (const layerKey of LAYER_KEYS) {
    const option = document.createElement('option');
    option.value = state.layers[layerKey].path;
    el.monsterAssetList.appendChild(option);
  }
};

const sanitizeLayerPresetKeys = () => {
  for (const layerKey of LAYER_KEYS) {
    const key = state.layers[layerKey].stripePresetKey;
    if (key !== STRIPE_NONE && !state.presets[key]) {
      state.layers[layerKey].stripePresetKey = STRIPE_NONE;
    }
  }
};

const renderOrderControls = () => {
  const options = LAYER_KEYS.map((layerKey) => `<option value="${layerKey}">${LAYER_LABELS[layerKey]}</option>`).join('');
  el.orderBox.innerHTML = state.renderOrder
    .map((layerKey, idx) => {
      const slotLabel = `第 ${idx + 1} 层（${idx === 0 ? '最下层' : idx === state.renderOrder.length - 1 ? '最上层' : '中间层'}）`;
      return `
        <div class="sub-card">
          <div class="label">${slotLabel}</div>
          <select data-role="order-slot" data-slot="${idx}">
            ${options}
          </select>
        </div>
      `;
    })
    .join('');
  const selects = el.orderBox.querySelectorAll('[data-role="order-slot"]');
  selects.forEach((select, idx) => {
    select.value = state.renderOrder[idx];
    select.addEventListener('change', (event) => {
      const slot = Number(event.currentTarget.getAttribute('data-slot'));
      const nextLayer = event.currentTarget.value;
      const currentIndex = state.renderOrder.indexOf(nextLayer);
      if (currentIndex >= 0 && currentIndex !== slot) {
        const oldLayer = state.renderOrder[slot];
        state.renderOrder[slot] = nextLayer;
        state.renderOrder[currentIndex] = oldLayer;
      } else {
        state.renderOrder[slot] = nextLayer;
      }
      renderOrderControls();
      setStatus('渲染顺序已更新。');
    });
  });
};

const renderLayerControls = () => {
  const presetOptions = [
    `<option value="${STRIPE_NONE}">不使用条纹（原图）</option>`,
    ...sortedPresetEntries().map(([key, preset]) => `<option value="${key}">${key} · ${preset.name || key}</option>`)
  ].join('');

  el.layersBox.innerHTML = LAYER_KEYS.map((layerKey) => {
    const layer = state.layers[layerKey];
    return `
      <div class="sub-card" data-layer="${layerKey}">
        <div class="label">${LAYER_LABELS[layerKey]}</div>
        <div class="label">图片路径（public/resources 下相对路径）</div>
        <input data-role="path" data-layer="${layerKey}" type="text" list="monsterAssetList" value="${layer.path}" />
        <div class="label" style="margin-top:8px">条纹配置</div>
        <select data-role="stripe" data-layer="${layerKey}">
          ${presetOptions}
        </select>
      </div>
    `;
  }).join('');

  LAYER_KEYS.forEach((layerKey) => {
    const layer = state.layers[layerKey];
    const stripeSelect = el.layersBox.querySelector(`select[data-role="stripe"][data-layer="${layerKey}"]`);
    if (stripeSelect) stripeSelect.value = layer.stripePresetKey;
  });

  el.layersBox.querySelectorAll('input[data-role="path"]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const layerKey = event.currentTarget.getAttribute('data-layer');
      if (!layerKey || !state.layers[layerKey]) return;
      state.layers[layerKey].path = event.currentTarget.value;
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void loadAllLayerImages();
      }
    });
  });

  el.layersBox.querySelectorAll('select[data-role="stripe"]').forEach((select) => {
    select.addEventListener('change', (event) => {
      const layerKey = event.currentTarget.getAttribute('data-layer');
      if (!layerKey || !state.layers[layerKey]) return;
      state.layers[layerKey].stripePresetKey = event.currentTarget.value || STRIPE_NONE;
      setStatus(`${LAYER_LABELS[layerKey]} 条纹配置已更新。`);
    });
  });
};

const loadAllLayerImages = async () => {
  setStatus('正在加载分层图片...');
  const errors = [];

  for (const layerKey of LAYER_KEYS) {
    const layer = state.layers[layerKey];
    layer.path = normalizeResourcePath(layer.path) || DEFAULT_ASSETS[layerKey];
  }
  renderLayerControls();
  buildAssetDatalist();

  const results = await Promise.allSettled(
    LAYER_KEYS.map((layerKey) => loadImage(toResourceUrl(state.layers[layerKey].path)))
  );

  results.forEach((result, idx) => {
    const layerKey = LAYER_KEYS[idx];
    if (result.status === 'fulfilled') {
      state.images[layerKey] = result.value;
    } else {
      state.images[layerKey] = null;
      errors.push(`${LAYER_LABELS[layerKey]}: ${String(result.reason)}`);
    }
  });

  if (errors.length > 0) {
    setStatus(`部分图片加载失败：${errors.join('；')}`, true);
  } else {
    setStatus('分层图片加载成功。');
  }
};

const loadStripePresets = async () => {
  setStatus('正在加载条纹配置...');
  try {
    const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.presets = normalizeLibrary(data);
    state.patternCache.clear();
    sanitizeLayerPresetKeys();
    renderLayerControls();
    setStatus(`条纹配置加载成功，共 ${Object.keys(state.presets).length} 个预设。`);
  } catch (error) {
    setStatus(`条纹配置加载失败：${String(error)}`, true);
  }
};

const resizeCanvas = () => {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const rect = el.preview.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * ratio));
  const h = Math.max(1, Math.floor(rect.height * ratio));
  if (el.preview.width !== w || el.preview.height !== h) {
    el.preview.width = w;
    el.preview.height = h;
  }
  if (state.maskCanvas.width !== w || state.maskCanvas.height !== h) {
    state.maskCanvas.width = w;
    state.maskCanvas.height = h;
  }
};

const getPatternCanvas = (presetKey, preset) => {
  const cacheKey = `${presetKey}:${JSON.stringify(preset)}`;
  const hit = state.patternCache.get(cacheKey);
  if (hit) return hit;
  const period = Math.max(1, Math.round(preset.segments.reduce((sum, seg) => sum + Math.max(0.01, seg.width), 0)));
  const off = document.createElement('canvas');
  off.width = period;
  off.height = 64;
  const ctx = off.getContext('2d');
  let cursor = 0;
  for (const seg of preset.segments) {
    const w = Math.max(1, Math.round(seg.width));
    const opacity = Math.max(0, Math.min(1, toNumber(seg.opacity, 1)));
    ctx.globalAlpha = opacity;
    if (seg.fillType === 'gradient') {
      const grad = ctx.createLinearGradient(cursor, 0, cursor + w, 0);
      grad.addColorStop(0, seg.fromColor || '#ffffff');
      grad.addColorStop(1, seg.toColor || '#000000');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = seg.color || '#ffffff';
    }
    ctx.fillRect(cursor, 0, w, off.height);
    cursor += w;
  }
  ctx.globalAlpha = 1;
  const built = { image: off, period: Math.max(1, cursor) };
  state.patternCache.clear();
  state.patternCache.set(cacheKey, built);
  return built;
};

const calcDrawRect = (img, centerX, centerY, targetMaxSize) => {
  const srcW = Math.max(1, img.naturalWidth || img.width || 1);
  const srcH = Math.max(1, img.naturalHeight || img.height || 1);
  const scale = targetMaxSize / Math.max(srcW, srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  return {
    x: centerX - drawW * 0.5,
    y: centerY - drawH * 0.5,
    w: drawW,
    h: drawH
  };
};

const renderStripesToContext = (ctx, preset, phasePx, w, h, cacheKey) => {
  if (preset.mode === 'solid') {
    ctx.fillStyle = preset.solidColor || '#ffffff';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const { image, period } = getPatternCanvas(cacheKey, preset);
  const shift = ((phasePx % period) + period) % period;
  const diag = Math.ceil(Math.sqrt(w * w + h * h));
  ctx.fillStyle = preset.background || '#000000';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate((toNumber(preset.angleDeg, 45) * Math.PI) / 180);
  for (let x = -diag - period * 2; x < diag + period * 2; x += period) {
    ctx.drawImage(image, x - shift, -diag, period, diag * 2);
  }
  ctx.restore();
};

const drawStripeMaskedLayer = (ctx, layerImg, drawRect, presetKey, preset) => {
  const maskCtx = state.maskCanvas.getContext('2d');
  const w = state.maskCanvas.width;
  const h = state.maskCanvas.height;
  const phasePx = state.animTimeSec * toNumber(preset.speed, 0);
  maskCtx.clearRect(0, 0, w, h);
  renderStripesToContext(maskCtx, preset, phasePx, w, h, presetKey);
  maskCtx.globalCompositeOperation = 'destination-in';
  maskCtx.drawImage(layerImg, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
  maskCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(state.maskCanvas, 0, 0);
};

const drawOneLayer = (ctx, layerKey, drawRect) => {
  const img = state.images[layerKey];
  if (!img) return;
  const stripePresetKey = state.layers[layerKey].stripePresetKey;
  if (stripePresetKey !== STRIPE_NONE && state.presets[stripePresetKey]) {
    drawStripeMaskedLayer(ctx, img, drawRect, stripePresetKey, state.presets[stripePresetKey]);
    return;
  }
  ctx.drawImage(img, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
};

const renderPreview = (dt) => {
  resizeCanvas();
  state.animTimeSec += dt;
  const ctx = el.preview.getContext('2d');
  const w = el.preview.width;
  const h = el.preview.height;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b0f16';
  ctx.fillRect(0, 0, w, h);

  const referenceImg =
    state.images.body || state.images.line || state.images.bottomBorder || state.images.bottomFillMask;
  if (!referenceImg) return;

  const size = toNumber(el.sizeInput.value, 560) * ratio;
  const centerX = w * 0.5 + state.offsetCssPx.x * ratio;
  const centerY = h * 0.5 + state.offsetCssPx.y * ratio;
  const drawRect = calcDrawRect(referenceImg, centerX, centerY, size);

  for (const layerKey of state.renderOrder) {
    drawOneLayer(ctx, layerKey, drawRect);
  }
};

const tick = () => {
  const nowSec = performance.now() / 1000;
  const dt = Math.max(0, nowSec - state.lastTimeSec);
  state.lastTimeSec = nowSec;
  renderPreview(dt);
  requestAnimationFrame(tick);
};

const bindEvents = () => {
  el.reloadBtn.addEventListener('click', () => {
    void loadStripePresets();
  });
  el.reloadImagesBtn.addEventListener('click', () => {
    void loadAllLayerImages();
  });
  el.resetPositionBtn.addEventListener('click', () => {
    state.offsetCssPx.x = 0;
    state.offsetCssPx.y = 0;
    setStatus('已恢复到画布中心位置。');
  });
  el.preview.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    state.drag.active = true;
    state.drag.pointerId = event.pointerId;
    state.drag.lastClientX = event.clientX;
    state.drag.lastClientY = event.clientY;
    el.preview.style.cursor = 'grabbing';
    el.preview.setPointerCapture(event.pointerId);
  });
  el.preview.addEventListener('pointermove', (event) => {
    if (!state.drag.active || event.pointerId !== state.drag.pointerId) return;
    const dx = event.clientX - state.drag.lastClientX;
    const dy = event.clientY - state.drag.lastClientY;
    state.drag.lastClientX = event.clientX;
    state.drag.lastClientY = event.clientY;
    state.offsetCssPx.x += dx;
    state.offsetCssPx.y += dy;
  });
  const stopDrag = (event) => {
    if (!state.drag.active || event.pointerId !== state.drag.pointerId) return;
    state.drag.active = false;
    state.drag.pointerId = -1;
    el.preview.style.cursor = 'grab';
    if (el.preview.hasPointerCapture(event.pointerId)) {
      el.preview.releasePointerCapture(event.pointerId);
    }
  };
  el.preview.addEventListener('pointerup', stopDrag);
  el.preview.addEventListener('pointercancel', stopDrag);
  window.addEventListener('resize', resizeCanvas);
};

const boot = async () => {
  buildAssetDatalist();
  renderOrderControls();
  renderLayerControls();
  bindEvents();
  await loadStripePresets();
  await loadAllLayerImages();
  resizeCanvas();
  requestAnimationFrame(tick);
};

void boot();
