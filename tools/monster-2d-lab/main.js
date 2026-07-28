import {
  getResolvedDevServerPort,
  probeDevServerConnection,
  requestDevServer
} from '/core/network/devServerPortResolver.ts';

const CONFIG_URL = '/config/stripePresets.json';
const MONSTER_CONFIG_API_PATH = '/api/monster-display-configs';
const STRIPE_NONE = '__none__';
const LAYER_KEYS = ['bottomFillMask', 'bottomBorder', 'body', 'line'];
const FIXED_RENDER_ORDER = [...LAYER_KEYS];
const preferredMonsterConfigFromQuery = (new URLSearchParams(window.location.search).get('monsterConfig') || '').trim();
const RESOURCE_IMAGE_MODULES = import.meta.glob('/public/resources/**/*.{png,jpg,jpeg,webp,gif,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default'
});
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
  monsterConfigs: {},
  activeMonsterConfigId: '',
  lastTimeSec: performance.now() / 1000,
  animTimeSec: 0,
  offsetCssPx: { x: 0, y: 0 },
  drag: {
    active: false,
    pointerId: -1,
    lastClientX: 0,
    lastClientY: 0
  },
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
  maskCanvas: document.createElement('canvas'),
  resourceImageOptions: []
};

const el = {
  reloadBtn: document.getElementById('reloadBtn'),
  loadMonsterConfigsBtn: document.getElementById('loadMonsterConfigsBtn'),
  saveMonsterConfigsBtn: document.getElementById('saveMonsterConfigsBtn'),
  newMonsterConfigBtn: document.getElementById('newMonsterConfigBtn'),
  duplicateMonsterConfigBtn: document.getElementById('duplicateMonsterConfigBtn'),
  deleteMonsterConfigBtn: document.getElementById('deleteMonsterConfigBtn'),
  monsterConfigSelect: document.getElementById('monsterConfigSelect'),
  monsterIdInput: document.getElementById('monsterIdInput'),
  monsterNameInput: document.getElementById('monsterNameInput'),
  reloadImagesBtn: document.getElementById('reloadImagesBtn'),
  statusText: document.getElementById('statusText'),
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

const parseJsonPayload = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    const head = text.slice(0, 120).trim().toLowerCase();
    if (head.startsWith('<!doctype') || head.startsWith('<html')) {
      throw new Error('接口返回了 HTML，而不是 JSON（通常是 API 地址未连到 python/server.py）');
    }
    throw new Error(`接口返回非 JSON 内容：${text.slice(0, 120)}`);
  }
};

const requestMonsterConfigApi = async (method, body) => {
  const response = await requestDevServer(
    method === 'GET' ? `${MONSTER_CONFIG_API_PATH}?t=${Date.now()}` : MONSTER_CONFIG_API_PATH,
    {
      method,
      headers: method === 'PUT' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'PUT' ? JSON.stringify(body) : undefined
    }
  );
  const payload = await parseJsonPayload(response);
  if (!response.ok || payload.success === false) {
    const detail = Array.isArray(payload.errors) && payload.errors.length > 0 ? `：${payload.errors[0]}` : '';
    throw new Error(`${payload.message || `HTTP ${response.status}`}${detail}`);
  }
  return payload;
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

const createDefaultMonsterConfig = (id) => ({
  id,
  name: id,
  scaleSize: 560,
  renderOrder: [...FIXED_RENDER_ORDER],
  layers: {
    line: { path: DEFAULT_ASSETS.line, stripePresetKey: STRIPE_NONE },
    body: { path: DEFAULT_ASSETS.body, stripePresetKey: STRIPE_NONE },
    bottomBorder: { path: DEFAULT_ASSETS.bottomBorder, stripePresetKey: STRIPE_NONE },
    bottomFillMask: { path: DEFAULT_ASSETS.bottomFillMask, stripePresetKey: STRIPE_NONE }
  }
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

const normalizeMonsterLayer = (layer, fallbackPath) => {
  const source = layer && typeof layer === 'object' ? layer : {};
  const path = typeof source.path === 'string' && source.path.trim() ? source.path : fallbackPath;
  const stripePresetKey = typeof source.stripePresetKey === 'string' && source.stripePresetKey.trim()
    ? source.stripePresetKey
    : STRIPE_NONE;
  return { path, stripePresetKey };
};

const normalizeMonsterConfig = (key, config) => {
  const fallback = createDefaultMonsterConfig(key);
  const source = config && typeof config === 'object' ? config : {};
  const id = typeof source.id === 'string' && source.id.trim() ? source.id : key;
  const name = typeof source.name === 'string' && source.name.trim() ? source.name : id;
  const scaleSize = Math.max(1, toNumber(source.scaleSize, fallback.scaleSize));

  const layersRaw = source.layers && typeof source.layers === 'object' ? source.layers : {};
  const layers = {
    line: normalizeMonsterLayer(layersRaw.line, fallback.layers.line.path),
    body: normalizeMonsterLayer(layersRaw.body, fallback.layers.body.path),
    bottomBorder: normalizeMonsterLayer(layersRaw.bottomBorder, fallback.layers.bottomBorder.path),
    bottomFillMask: normalizeMonsterLayer(layersRaw.bottomFillMask, fallback.layers.bottomFillMask.path)
  };

  return {
    id,
    name,
    scaleSize,
    renderOrder: [...FIXED_RENDER_ORDER],
    layers
  };
};

const normalizeMonsterConfigLibrary = (library) => {
  if (!library || typeof library !== 'object') return {};
  const out = {};
  for (const [key, config] of Object.entries(library)) {
    if (!key.trim()) continue;
    out[key] = normalizeMonsterConfig(key, config);
  }
  return out;
};

const sortedPresetEntries = () =>
  Object.entries(state.presets).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));

const decodePublicPath = (input) => decodeURI(String(input || '')).replace(/^\/+/, '').replace(/^\.\/+/, '');

const getScannedResourceImages = () => {
  const fromModules = Object.values(RESOURCE_IMAGE_MODULES)
    .map((assetUrl) => decodePublicPath(assetUrl))
    .map((path) => path.replace(/^public\/+/, ''))
    .filter((path) => path.startsWith('resources/'));
  const merged = new Set(fromModules);
  for (const layerKey of LAYER_KEYS) {
    const raw = normalizeResourcePath(state.layers[layerKey].path);
    if (raw) merged.add(`resources/${raw}`);
  }
  return [...merged].sort((a, b) => a.localeCompare(b, 'zh-CN'));
};

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
  for (const fullPath of state.resourceImageOptions) {
    const option = document.createElement('option');
    option.value = fullPath.replace(/^resources\//, '');
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

const activeMonsterConfig = () => state.monsterConfigs[state.activeMonsterConfigId] || null;

const findDuplicateMonsterIds = (library) => {
  const seen = new Map();
  const duplicates = [];
  for (const [key, config] of Object.entries(library || {})) {
    const rawId = String(config?.id || key).trim();
    const normalized = rawId.toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) {
      duplicates.push({
        id: rawId,
        firstKey: seen.get(normalized),
        currentKey: key
      });
      continue;
    }
    seen.set(normalized, key);
  }
  return duplicates;
};

const syncActiveConfigFromCurrentDisplay = () => {
  const config = activeMonsterConfig();
  if (!config) return;
  config.scaleSize = Math.max(1, toNumber(el.sizeInput.value, config.scaleSize || 560));
  config.renderOrder = [...FIXED_RENDER_ORDER];
  for (const layerKey of LAYER_KEYS) {
    config.layers[layerKey] = {
      path: state.layers[layerKey].path,
      stripePresetKey: state.layers[layerKey].stripePresetKey
    };
  }
};

const applyDisplayFromConfig = (config) => {
  if (!config) return;
  for (const layerKey of LAYER_KEYS) {
    state.layers[layerKey] = {
      path: config.layers[layerKey].path,
      stripePresetKey: config.layers[layerKey].stripePresetKey
    };
  }
  el.sizeInput.value = String(Math.max(1, toNumber(config.scaleSize, 560)));
  sanitizeLayerPresetKeys();
  syncActiveConfigFromCurrentDisplay();
};

const refreshMonsterConfigSelect = () => {
  const keys = Object.keys(state.monsterConfigs).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (keys.length === 0) {
    const fallbackId = 'monster_default';
    state.monsterConfigs[fallbackId] = createDefaultMonsterConfig(fallbackId);
  }

  const sorted = Object.keys(state.monsterConfigs).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (!state.activeMonsterConfigId || !state.monsterConfigs[state.activeMonsterConfigId]) {
    state.activeMonsterConfigId = sorted[0];
  }

  el.monsterConfigSelect.innerHTML = '';
  for (const id of sorted) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${id} · ${state.monsterConfigs[id].name || id}`;
    el.monsterConfigSelect.appendChild(option);
  }
  el.monsterConfigSelect.value = state.activeMonsterConfigId;

  const config = activeMonsterConfig();
  if (config) {
    el.monsterIdInput.value = config.id;
    el.monsterNameInput.value = config.name || config.id;
  }
};

const renameActiveMonsterConfigId = () => {
  const currentId = state.activeMonsterConfigId;
  const config = activeMonsterConfig();
  if (!currentId || !config) return;
  const nextId = String(el.monsterIdInput.value || '').trim();
  if (!nextId) {
    setStatus('配置 ID 不能为空', true);
    el.monsterIdInput.value = currentId;
    return;
  }
  if (nextId === currentId) {
    config.id = nextId;
    return;
  }
  const normalizedNextId = nextId.toLowerCase();
  const hasConflict = Object.keys(state.monsterConfigs).some((existingKey) => {
    if (existingKey === currentId) return false;
    return String(existingKey).toLowerCase() === normalizedNextId;
  });
  if (hasConflict) {
    setStatus(`配置 ID 冲突（忽略大小写后重复）：${nextId}`, true);
    el.monsterIdInput.value = currentId;
    return;
  }
  if (state.monsterConfigs[nextId]) {
    setStatus(`配置 ID 已存在：${nextId}`, true);
    el.monsterIdInput.value = currentId;
    return;
  }

  delete state.monsterConfigs[currentId];
  config.id = nextId;
  state.monsterConfigs[nextId] = config;
  state.activeMonsterConfigId = nextId;
  refreshMonsterConfigSelect();
  setStatus(`已修改配置 ID：${currentId} -> ${nextId}`);
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
        <div class="label">图片列表（自动扫描 public/resources）</div>
        <select data-role="path-select" data-layer="${layerKey}"></select>
        <div class="label" style="margin-top:8px">图片路径（可手动修正）</div>
        <input data-role="path-input" data-layer="${layerKey}" type="text" list="monsterAssetList" value="${layer.path}" />
        <div class="label" style="margin-top:8px">条纹配置</div>
        <select data-role="stripe" data-layer="${layerKey}">
          ${presetOptions}
        </select>
      </div>
    `;
  }).join('');

  LAYER_KEYS.forEach((layerKey) => {
    const layer = state.layers[layerKey];
    const pathSelect = el.layersBox.querySelector(`select[data-role="path-select"][data-layer="${layerKey}"]`);
    if (pathSelect) {
      const optionsHtml = state.resourceImageOptions
        .map((fullPath) => {
          const relativePath = fullPath.replace(/^resources\//, '');
          return `<option value="${relativePath}">${relativePath}</option>`;
        })
        .join('');
      pathSelect.innerHTML = optionsHtml;
      const currentPath = normalizeResourcePath(layer.path);
      if (state.resourceImageOptions.some((fullPath) => fullPath.replace(/^resources\//, '') === currentPath)) {
        pathSelect.value = currentPath;
      } else if (state.resourceImageOptions.length > 0) {
        pathSelect.value = state.resourceImageOptions[0].replace(/^resources\//, '');
      }
    }
    const stripeSelect = el.layersBox.querySelector(`select[data-role="stripe"][data-layer="${layerKey}"]`);
    if (stripeSelect) stripeSelect.value = layer.stripePresetKey;
  });

  el.layersBox.querySelectorAll('select[data-role="path-select"]').forEach((select) => {
    select.addEventListener('change', (event) => {
      const layerKey = event.currentTarget.getAttribute('data-layer');
      if (!layerKey || !state.layers[layerKey]) return;
      state.layers[layerKey].path = event.currentTarget.value;
      const input = el.layersBox.querySelector(`input[data-role="path-input"][data-layer="${layerKey}"]`);
      if (input) input.value = event.currentTarget.value;
      syncActiveConfigFromCurrentDisplay();
      refreshMonsterConfigSelect();
      void loadAllLayerImages();
    });
  });

  el.layersBox.querySelectorAll('input[data-role="path-input"]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const layerKey = event.currentTarget.getAttribute('data-layer');
      if (!layerKey || !state.layers[layerKey]) return;
      state.layers[layerKey].path = event.currentTarget.value;
      syncActiveConfigFromCurrentDisplay();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        syncActiveConfigFromCurrentDisplay();
        refreshMonsterConfigSelect();
        void loadAllLayerImages();
      }
    });
  });

  el.layersBox.querySelectorAll('select[data-role="stripe"]').forEach((select) => {
    select.addEventListener('change', (event) => {
      const layerKey = event.currentTarget.getAttribute('data-layer');
      if (!layerKey || !state.layers[layerKey]) return;
      state.layers[layerKey].stripePresetKey = event.currentTarget.value || STRIPE_NONE;
      syncActiveConfigFromCurrentDisplay();
      refreshMonsterConfigSelect();
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
  state.resourceImageOptions = getScannedResourceImages();
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

const loadMonsterConfigsFromServer = async () => {
  setStatus('正在读取怪物显示配置...');
  try {
    const payload = await requestMonsterConfigApi('GET');
    const data = normalizeMonsterConfigLibrary(payload.data);
    state.monsterConfigs = data;

    const sorted = Object.keys(state.monsterConfigs).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    if (preferredMonsterConfigFromQuery && state.monsterConfigs[preferredMonsterConfigFromQuery]) {
      state.activeMonsterConfigId = preferredMonsterConfigFromQuery;
    } else {
      state.activeMonsterConfigId = sorted[0] || '';
    }

    refreshMonsterConfigSelect();
    const activeConfig = activeMonsterConfig();
    if (activeConfig) {
      applyDisplayFromConfig(activeConfig);
      renderLayerControls();
      await loadAllLayerImages();
    }
    const valid = payload.valid !== false;
    const port = getResolvedDevServerPort();
    const hostLabel = port ? `127.0.0.1:${port}` : '未知端口';
    setStatus(valid ? `已读取怪物配置（${hostLabel}）` : `怪物配置已读取，但存在校验错误：${(payload.errors || []).join('；')}`, !valid);
  } catch (error) {
    setStatus(`读取怪物配置失败：${String(error)}`, true);
  }
};

const saveMonsterConfigsToServer = async () => {
  setStatus('正在保存怪物显示配置...');
  try {
    syncActiveConfigFromCurrentDisplay();
    const payload = normalizeMonsterConfigLibrary(state.monsterConfigs);
    const duplicateIds = findDuplicateMonsterIds(payload);
    if (duplicateIds.length > 0) {
      const first = duplicateIds[0];
      throw new Error(`存在重复 ID（忽略大小写）：${first.id}（${first.firstKey} / ${first.currentKey}）`);
    }
    const data = await requestMonsterConfigApi('PUT', payload);
    const port = getResolvedDevServerPort();
    const hostLabel = port ? `127.0.0.1:${port}` : '未知端口';
    setStatus(`怪物配置保存成功：${data.path || 'config/monsterDisplayConfigs.json'}（${hostLabel}）`);
  } catch (error) {
    setStatus(`保存怪物配置失败：${String(error)}`, true);
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

  for (const layerKey of FIXED_RENDER_ORDER) {
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
  el.loadMonsterConfigsBtn.addEventListener('click', () => {
    void loadMonsterConfigsFromServer();
  });
  el.saveMonsterConfigsBtn.addEventListener('click', () => {
    void saveMonsterConfigsToServer();
  });
  el.newMonsterConfigBtn.addEventListener('click', () => {
    const id = (window.prompt('输入新的怪物配置 ID（唯一）', 'monster_new') || '').trim();
    if (!id) return;
    if (state.monsterConfigs[id]) {
      setStatus(`配置 ID 已存在：${id}`, true);
      return;
    }
    syncActiveConfigFromCurrentDisplay();
    state.monsterConfigs[id] = createDefaultMonsterConfig(id);
    state.activeMonsterConfigId = id;
    refreshMonsterConfigSelect();
    applyDisplayFromConfig(state.monsterConfigs[id]);
    renderLayerControls();
    void loadAllLayerImages();
    setStatus(`已创建怪物配置：${id}`);
  });
  el.duplicateMonsterConfigBtn.addEventListener('click', () => {
    const source = activeMonsterConfig();
    if (!source) return;
    const id = (window.prompt('输入复制后的怪物配置 ID（唯一）', `${source.id}_copy`) || '').trim();
    if (!id) return;
    if (state.monsterConfigs[id]) {
      setStatus(`配置 ID 已存在：${id}`, true);
      return;
    }
    syncActiveConfigFromCurrentDisplay();
    const copied = normalizeMonsterConfig(id, {
      ...JSON.parse(JSON.stringify(source)),
      id,
      name: `${source.name} (copy)`
    });
    state.monsterConfigs[id] = copied;
    state.activeMonsterConfigId = id;
    refreshMonsterConfigSelect();
    applyDisplayFromConfig(copied);
    renderLayerControls();
    void loadAllLayerImages();
    setStatus(`已复制怪物配置：${id}`);
  });
  el.deleteMonsterConfigBtn.addEventListener('click', () => {
    const config = activeMonsterConfig();
    if (!config) return;
    if (!window.confirm(`确认删除怪物配置：${config.id} ?`)) return;
    delete state.monsterConfigs[config.id];
    const sorted = Object.keys(state.monsterConfigs).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    state.activeMonsterConfigId = sorted[0] || '';
    refreshMonsterConfigSelect();
    const nextConfig = activeMonsterConfig();
    if (nextConfig) {
      applyDisplayFromConfig(nextConfig);
      renderLayerControls();
      void loadAllLayerImages();
    }
    setStatus('已删除当前怪物配置。');
  });
  el.monsterConfigSelect.addEventListener('change', () => {
    syncActiveConfigFromCurrentDisplay();
    state.activeMonsterConfigId = el.monsterConfigSelect.value;
    refreshMonsterConfigSelect();
    const config = activeMonsterConfig();
    if (config) {
      applyDisplayFromConfig(config);
      renderLayerControls();
      void loadAllLayerImages();
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('monsterConfig', config.id);
      window.history.replaceState(null, '', nextUrl.toString());
    }
  });
  el.monsterIdInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    renameActiveMonsterConfigId();
  });
  el.monsterIdInput.addEventListener('blur', () => {
    renameActiveMonsterConfigId();
  });
  el.monsterNameInput.addEventListener('input', () => {
    const config = activeMonsterConfig();
    if (!config) return;
    config.name = el.monsterNameInput.value || config.id;
    refreshMonsterConfigSelect();
  });
  el.reloadImagesBtn.addEventListener('click', () => {
    syncActiveConfigFromCurrentDisplay();
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
  el.sizeInput.addEventListener('input', () => {
    syncActiveConfigFromCurrentDisplay();
  });
};

const boot = async () => {
  state.resourceImageOptions = getScannedResourceImages();
  state.monsterConfigs = {
    monster_default: createDefaultMonsterConfig('monster_default')
  };
  state.activeMonsterConfigId = 'monster_default';
  buildAssetDatalist();
  refreshMonsterConfigSelect();
  applyDisplayFromConfig(activeMonsterConfig());
  renderLayerControls();
  bindEvents();

  const connection = await probeDevServerConnection(MONSTER_CONFIG_API_PATH);
  if (!connection.connected) {
    setStatus('开发服务器未连接（请启动 python/server.py）', true);
  }

  await loadStripePresets();
  if (connection.connected) {
    await loadMonsterConfigsFromServer();
  } else {
    await loadAllLayerImages();
  }
  resizeCanvas();
  requestAnimationFrame(tick);
};

void boot();
