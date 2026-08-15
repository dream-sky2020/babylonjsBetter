import {
  getResolvedDevServerPort,
  probeDevServerConnection,
  requestDevServer
} from '/core/network/devServerPortResolver.ts';
import {
  DEFAULT_MONSTER_STRIPE_PRESET_KEY,
  MONSTER_LAYER_KEYS,
  MONSTER_RENDER_ORDER,
  STRIPE_NONE,
  collectMonsterResourceImages,
  createDefaultMonsterConfig as createCoreDefaultMonsterConfig,
  createDefaultMonsterStripePreset as createCoreDefaultMonsterStripePreset,
  createDefaultStripePreset as createCoreDefaultStripePreset,
  normalizeMonsterConfig as normalizeCoreMonsterConfig,
  normalizeMonsterConfigLibrary as normalizeCoreMonsterConfigLibrary,
  normalizeMonsterResourcePath,
  normalizeMonsterStripePreset as normalizeCoreMonsterStripePreset,
  normalizeMonsterStripePresetLibrary as normalizeCoreMonsterStripePresetLibrary,
  normalizeStripePreset as normalizeCoreStripePreset,
  normalizeStripePresetLibrary as normalizeCoreStripePresetLibrary,
  toMonsterResourceUrl
} from '/core/monster/index.ts';

const CONFIG_URL = '/config/stripePresets.json';
const MONSTER_STRIPE_PRESET_URL = '/config/monsterStripePresets.json';
const MONSTER_CONFIG_API_PATH = '/api/monster-display-configs';
const STRIPE_CONFIG_API_PATH = '/api/stripe-presets';
const MONSTER_STRIPE_PRESET_API_PATH = '/api/monster-stripe-presets';
const LAYER_KEYS = MONSTER_LAYER_KEYS;
const FIXED_RENDER_ORDER = MONSTER_RENDER_ORDER;
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
  monsterStripePresets: {},
  activeMonsterStripePresetKey: DEFAULT_MONSTER_STRIPE_PRESET_KEY,
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
    line: { path: DEFAULT_ASSETS.line, stripePresetKey: STRIPE_NONE, visible: true },
    body: { path: DEFAULT_ASSETS.body, stripePresetKey: STRIPE_NONE, visible: true },
    bottomBorder: { path: DEFAULT_ASSETS.bottomBorder, stripePresetKey: STRIPE_NONE, visible: true },
    bottomFillMask: { path: DEFAULT_ASSETS.bottomFillMask, stripePresetKey: STRIPE_NONE, visible: true }
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
  loadMonsterConfigsBtn: document.getElementById('loadMonsterConfigsBtn'),
  saveMonsterConfigsBtn: document.getElementById('saveMonsterConfigsBtn'),
  newMonsterConfigBtn: document.getElementById('newMonsterConfigBtn'),
  duplicateMonsterConfigBtn: document.getElementById('duplicateMonsterConfigBtn'),
  deleteMonsterConfigBtn: document.getElementById('deleteMonsterConfigBtn'),
  monsterConfigSelect: document.getElementById('monsterConfigSelect'),
  monsterIdInput: document.getElementById('monsterIdInput'),
  monsterNameInput: document.getElementById('monsterNameInput'),
  monsterStripePresetBindingSelect: document.getElementById('monsterStripePresetBindingSelect'),
  reloadImagesBtn: document.getElementById('reloadImagesBtn'),
  statusText: document.getElementById('statusText'),
  layersBox: document.getElementById('layersBox'),
  sizeInput: document.getElementById('sizeInput'),
  previewBgInput: document.getElementById('previewBgInput'),
  resetPositionBtn: document.getElementById('resetPositionBtn'),
  preview: document.getElementById('preview'),
  monsterAssetList: document.getElementById('monsterAssetList'),
  reloadStripeBtn: document.getElementById('reloadStripeBtn'),
  reloadMonsterStripePresetBtn: document.getElementById('reloadMonsterStripePresetBtn'),
  saveMonsterStripePresetBtn: document.getElementById('saveMonsterStripePresetBtn'),
  monsterStripePresetSelect: document.getElementById('monsterStripePresetSelect'),
  monsterStripePresetKeyInput: document.getElementById('monsterStripePresetKeyInput'),
  renameMonsterStripePresetBtn: document.getElementById('renameMonsterStripePresetBtn'),
  newMonsterStripePresetBtn: document.getElementById('newMonsterStripePresetBtn'),
  duplicateMonsterStripePresetBtn: document.getElementById('duplicateMonsterStripePresetBtn'),
  deleteMonsterStripePresetBtn: document.getElementById('deleteMonsterStripePresetBtn'),
  monsterStripePresetNameInput: document.getElementById('monsterStripePresetNameInput'),
  layerStripeBox: document.getElementById('layerStripeBox')
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

const requestStripeConfigApi = async (method, body) => {
  const response = await requestDevServer(
    method === 'GET' ? `${STRIPE_CONFIG_API_PATH}?t=${Date.now()}` : STRIPE_CONFIG_API_PATH,
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

const requestMonsterStripePresetApi = async (method, body) => {
  const response = await requestDevServer(
    method === 'GET' ? `${MONSTER_STRIPE_PRESET_API_PATH}?t=${Date.now()}` : MONSTER_STRIPE_PRESET_API_PATH,
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

const createDefaultPreset = createCoreDefaultStripePreset;

const createDefaultMonsterConfig = createCoreDefaultMonsterConfig;

const createDefaultMonsterStripePreset = createCoreDefaultMonsterStripePreset;

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
    solidOpacity: Math.max(0, Math.min(1, toNumber(source.solidOpacity, 1))),
    angleDeg: Math.max(-360, Math.min(360, toNumber(source.angleDeg, 45))),
    speed: Math.max(-5000, Math.min(5000, toNumber(source.speed, 90))),
    background: typeof source.background === 'string' ? source.background : '#000000',
    backgroundOpacity: Math.max(0, Math.min(1, toNumber(source.backgroundOpacity, 1))),
    segments: segments.length > 0 ? segments : createDefaultPreset(key).segments
  };
};

const normalizeLibrary = (library) => {
  return normalizeCoreStripePresetLibrary(library);
};

const normalizeMonsterLayer = (layer, fallbackPath) => {
  const source = layer && typeof layer === 'object' ? layer : {};
  const path = typeof source.path === 'string' && source.path.trim() ? source.path : fallbackPath;
  return { path };
};

const normalizeMonsterConfig = (key, config) => {
  const fallback = createDefaultMonsterConfig(key);
  const source = config && typeof config === 'object' ? config : {};
  const id = typeof source.id === 'string' && source.id.trim() ? source.id : key;
  const name = typeof source.name === 'string' && source.name.trim() ? source.name : id;
  const scaleSize = Math.max(1, toNumber(source.scaleSize, fallback.scaleSize));
  const scene3dScale = Math.max(0.01, toNumber(source.scene3dScale, fallback.scene3dScale));
  const scene3dHeight = toNumber(source.scene3dHeight, fallback.scene3dHeight);
  const scene3dOffsetX = toNumber(source.scene3dOffsetX, fallback.scene3dOffsetX);
  const spriteFacingAxis = source.spriteFacingAxis === '-Z' ? '-Z' : '+Z';
  const monsterStripePresetKey = typeof source.monsterStripePresetKey === 'string' && source.monsterStripePresetKey.trim()
    ? source.monsterStripePresetKey
    : DEFAULT_MONSTER_STRIPE_PRESET_KEY;

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
    scene3dScale,
    scene3dHeight,
    scene3dOffsetX,
    spriteFacingAxis,
    renderOrder: [...FIXED_RENDER_ORDER],
    monsterStripePresetKey,
    layers
  };
};

const normalizeMonsterStripePresetLayer = (layer) => {
  const source = layer && typeof layer === 'object' ? layer : {};
  const stripePresetKey = typeof source.stripePresetKey === 'string' && source.stripePresetKey.trim()
    ? source.stripePresetKey
    : STRIPE_NONE;
  const visible = source.visible !== false;
  return { stripePresetKey, visible };
};

const normalizeMonsterStripePreset = (key, preset) => {
  const fallback = createDefaultMonsterStripePreset(key);
  const source = preset && typeof preset === 'object' ? preset : {};
  const id = typeof source.id === 'string' && source.id.trim() ? source.id : key;
  const name = typeof source.name === 'string' && source.name.trim() ? source.name : id;
  const layersRaw = source.layers && typeof source.layers === 'object' ? source.layers : {};
  return {
    id,
    name,
    layers: {
      line: normalizeMonsterStripePresetLayer(layersRaw.line || fallback.layers.line),
      body: normalizeMonsterStripePresetLayer(layersRaw.body || fallback.layers.body),
      bottomBorder: normalizeMonsterStripePresetLayer(layersRaw.bottomBorder || fallback.layers.bottomBorder),
      bottomFillMask: normalizeMonsterStripePresetLayer(layersRaw.bottomFillMask || fallback.layers.bottomFillMask)
    }
  };
};

const normalizeMonsterStripePresetLibrary = (library) => {
  return normalizeCoreMonsterStripePresetLibrary(library);
};

const normalizeMonsterConfigLibrary = (library) => {
  return normalizeCoreMonsterConfigLibrary(library);
};

const sortedPresetEntries = () =>
  Object.entries(state.presets).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));

const activeMonsterStripePreset = () => state.monsterStripePresets[state.activeMonsterStripePresetKey] || null;

const decodePublicPath = (input) => decodeURI(String(input || '')).replace(/^\/+/, '').replace(/^\.\/+/, '');

const getScannedResourceImages = () => {
  return collectMonsterResourceImages(
    Object.values(RESOURCE_IMAGE_MODULES),
    LAYER_KEYS.map((layerKey) => state.layers[layerKey].path)
  );
};

const normalizeResourcePath = (pathText) => {
  return normalizeMonsterResourcePath(pathText);
};

const toResourceUrl = (pathText) => {
  return toMonsterResourceUrl(pathText);
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

const sanitizeMonsterStripePresets = () => {
  for (const preset of Object.values(state.monsterStripePresets)) {
    if (!preset || typeof preset !== 'object' || !preset.layers) continue;
    for (const layerKey of LAYER_KEYS) {
      const key = preset.layers[layerKey]?.stripePresetKey || STRIPE_NONE;
      if (key !== STRIPE_NONE && !state.presets[key]) {
        preset.layers[layerKey].stripePresetKey = STRIPE_NONE;
      }
      preset.layers[layerKey].visible = preset.layers[layerKey]?.visible !== false;
    }
  }
};

const ensureActiveMonsterStripePreset = () => {
  const keys = Object.keys(state.monsterStripePresets).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (keys.length === 0) {
    state.monsterStripePresets[DEFAULT_MONSTER_STRIPE_PRESET_KEY] = createDefaultMonsterStripePreset(DEFAULT_MONSTER_STRIPE_PRESET_KEY);
    state.activeMonsterStripePresetKey = DEFAULT_MONSTER_STRIPE_PRESET_KEY;
    return;
  }
  if (!state.activeMonsterStripePresetKey || !state.monsterStripePresets[state.activeMonsterStripePresetKey]) {
    state.activeMonsterStripePresetKey = keys[0];
  }
};

const applyActiveMonsterStripePresetToDisplay = () => {
  const preset = activeMonsterStripePreset();
  if (!preset) {
    for (const layerKey of LAYER_KEYS) {
      state.layers[layerKey].stripePresetKey = STRIPE_NONE;
      state.layers[layerKey].visible = true;
    }
    return;
  }
  for (const layerKey of LAYER_KEYS) {
    state.layers[layerKey].stripePresetKey = preset.layers[layerKey]?.stripePresetKey || STRIPE_NONE;
    state.layers[layerKey].visible = preset.layers[layerKey]?.visible !== false;
  }
  sanitizeLayerPresetKeys();
};

const refreshMonsterStripePresetBindingSelect = () => {
  if (!el.monsterStripePresetBindingSelect) return;
  const sorted = Object.keys(state.monsterStripePresets).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  el.monsterStripePresetBindingSelect.innerHTML = '';
  for (const key of sorted) {
    const option = document.createElement('option');
    option.value = key;
    const preset = state.monsterStripePresets[key];
    option.textContent = `${key} · ${preset?.name || key}`;
    el.monsterStripePresetBindingSelect.appendChild(option);
  }
  el.monsterStripePresetBindingSelect.value = state.activeMonsterStripePresetKey;
};

const refreshMonsterStripePresetSelect = () => {
  ensureActiveMonsterStripePreset();
  const sorted = Object.keys(state.monsterStripePresets).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  el.monsterStripePresetSelect.innerHTML = '';
  for (const key of sorted) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${key} · ${state.monsterStripePresets[key].name || key}`;
    el.monsterStripePresetSelect.appendChild(option);
  }
  el.monsterStripePresetSelect.value = state.activeMonsterStripePresetKey;
  refreshMonsterStripePresetBindingSelect();
};

const refreshMonsterStripePresetEditor = () => {
  const preset = activeMonsterStripePreset();
  if (!preset) return;
  el.monsterStripePresetKeyInput.value = state.activeMonsterStripePresetKey;
  el.monsterStripePresetNameInput.value = preset.name || preset.id || state.activeMonsterStripePresetKey;
  renderLayerStripeBindingsControls();
  refreshMonsterStripePresetBindingSelect();
};

const renderLayerStripeBindingsControls = () => {
  const presetOptions = [
    `<option value="${STRIPE_NONE}">不使用条纹（原图）</option>`,
    ...sortedPresetEntries().map(([key, preset]) => `<option value="${key}">${key} · ${preset.name || key}</option>`)
  ].join('');
  el.layerStripeBox.innerHTML = LAYER_KEYS.map((layerKey) => `
      <div class="sub-card">
        <div class="label">${LAYER_LABELS[layerKey]}</div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <label class="label" style="display:flex;align-items:center;gap:6px;margin:0;white-space:nowrap;">
            <input data-role="layer-visible" data-layer="${layerKey}" type="checkbox" />
            显示该图层
          </label>
          <select data-role="layer-stripe" data-layer="${layerKey}" style="flex:1;min-width:220px;">
            ${presetOptions}
          </select>
        </div>
      </div>
    `).join('');

  LAYER_KEYS.forEach((layerKey) => {
    const stripeSelect = el.layerStripeBox.querySelector(`select[data-role="layer-stripe"][data-layer="${layerKey}"]`);
    const visibleCheckbox = el.layerStripeBox.querySelector(`input[data-role="layer-visible"][data-layer="${layerKey}"]`);
    if (!stripeSelect) return;
    const preset = activeMonsterStripePreset();
    stripeSelect.value = preset?.layers?.[layerKey]?.stripePresetKey || STRIPE_NONE;
    if (visibleCheckbox) {
      visibleCheckbox.checked = preset?.layers?.[layerKey]?.visible !== false;
    }
  });

  el.layerStripeBox.querySelectorAll('select[data-role="layer-stripe"]').forEach((select) => {
    select.addEventListener('change', (event) => {
      const layerKey = event.currentTarget.getAttribute('data-layer');
      const preset = activeMonsterStripePreset();
      if (!layerKey || !preset || !preset.layers[layerKey]) return;
      preset.layers[layerKey].stripePresetKey = event.currentTarget.value || STRIPE_NONE;
      applyActiveMonsterStripePresetToDisplay();
      syncActiveConfigFromCurrentDisplay();
      refreshMonsterConfigSelect();
      setStatus(`${LAYER_LABELS[layerKey]} 条纹配置已更新（怪物条纹预设）。`);
    });
  });
  el.layerStripeBox.querySelectorAll('input[data-role="layer-visible"]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const layerKey = event.currentTarget.getAttribute('data-layer');
      const preset = activeMonsterStripePreset();
      if (!layerKey || !preset || !preset.layers[layerKey]) return;
      preset.layers[layerKey].visible = event.currentTarget.checked;
      applyActiveMonsterStripePresetToDisplay();
      syncActiveConfigFromCurrentDisplay();
      refreshMonsterConfigSelect();
      setStatus(`${LAYER_LABELS[layerKey]} 显示状态已更新（怪物条纹预设）。`);
    });
  });
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
  config.scene3dScale = Math.max(0.01, toNumber(config.scene3dScale, 1));
  config.scene3dHeight = toNumber(config.scene3dHeight, 0);
  config.scene3dOffsetX = toNumber(config.scene3dOffsetX, 0);
  config.spriteFacingAxis = config.spriteFacingAxis === '-Z' ? '-Z' : '+Z';
  config.renderOrder = [...FIXED_RENDER_ORDER];
  config.monsterStripePresetKey = state.activeMonsterStripePresetKey || DEFAULT_MONSTER_STRIPE_PRESET_KEY;
  for (const layerKey of LAYER_KEYS) {
    config.layers[layerKey] = {
      path: state.layers[layerKey].path
    };
  }
};

const applyDisplayFromConfig = (config) => {
  if (!config) return;
  for (const layerKey of LAYER_KEYS) {
    const configLayer = config.layers?.[layerKey] || {};
    state.layers[layerKey].path = configLayer.path || DEFAULT_ASSETS[layerKey];
  }
  state.activeMonsterStripePresetKey = config.monsterStripePresetKey || DEFAULT_MONSTER_STRIPE_PRESET_KEY;
  ensureActiveMonsterStripePreset();
  applyActiveMonsterStripePresetToDisplay();
  refreshMonsterStripePresetSelect();
  refreshMonsterStripePresetEditor();
  el.sizeInput.value = String(Math.max(1, toNumber(config.scaleSize, 560)));
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
    if (el.monsterStripePresetBindingSelect) {
      el.monsterStripePresetBindingSelect.value = config.monsterStripePresetKey || state.activeMonsterStripePresetKey;
    }
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
  el.layersBox.innerHTML = LAYER_KEYS.map((layerKey) => {
    const layer = state.layers[layerKey];
    return `
      <div class="sub-card" data-layer="${layerKey}">
        <div class="label">${LAYER_LABELS[layerKey]}</div>
        <div class="label">图片列表（自动扫描 public/resources）</div>
        <select data-role="path-select" data-layer="${layerKey}"></select>
        <div class="label" style="margin-top:8px">图片路径（可手动修正）</div>
        <input data-role="path-input" data-layer="${layerKey}" type="text" list="monsterAssetList" value="${layer.path}" />
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
    const rawData = payload.data && typeof payload.data === 'object' ? payload.data : {};
    const data = normalizeMonsterConfigLibrary(payload.data);
    state.monsterConfigs = data;

    // 兼容旧 monsterDisplayConfigs：如果历史数据把 stripePresetKey 存在各层里，自动迁移到“怪物条纹预设”。
    for (const [configKey, rawConfig] of Object.entries(rawData)) {
      const normalized = state.monsterConfigs[configKey];
      if (!normalized || !rawConfig || typeof rawConfig !== 'object') continue;
      if (typeof rawConfig.monsterStripePresetKey === 'string' && rawConfig.monsterStripePresetKey.trim()) continue;
      const rawLayers = rawConfig.layers && typeof rawConfig.layers === 'object' ? rawConfig.layers : {};
      const hasLegacyStripe = LAYER_KEYS.some((layerKey) => typeof rawLayers[layerKey]?.stripePresetKey === 'string');
      if (!hasLegacyStripe) continue;

      const presetKey = `${normalized.id || configKey}_stripe`;
      const migrated = createDefaultMonsterStripePreset(presetKey);
      migrated.name = `${normalized.name || normalized.id || configKey} 条纹预设`;
      for (const layerKey of LAYER_KEYS) {
        const legacyKey = rawLayers[layerKey]?.stripePresetKey;
        migrated.layers[layerKey].stripePresetKey = typeof legacyKey === 'string' && legacyKey.trim()
          ? legacyKey
          : STRIPE_NONE;
        migrated.layers[layerKey].visible = rawLayers[layerKey]?.visible !== false;
      }
      state.monsterStripePresets[presetKey] = normalizeMonsterStripePreset(presetKey, migrated);
      normalized.monsterStripePresetKey = presetKey;
    }
    sanitizeMonsterStripePresets();

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
    let data;
    try {
      const payload = await requestStripeConfigApi('GET');
      data = payload.data;
    } catch {
      const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    }
    state.presets = normalizeLibrary(data);
    state.patternCache.clear();
    sanitizeMonsterStripePresets();
    sanitizeLayerPresetKeys();
    applyActiveMonsterStripePresetToDisplay();
    renderLayerStripeBindingsControls();
    renderLayerControls();
    setStatus(`条纹配置加载成功，共 ${Object.keys(state.presets).length} 个预设。`);
  } catch (error) {
    setStatus(`条纹配置加载失败：${String(error)}`, true);
  }
};

const loadMonsterStripePresetsFromServer = async () => {
  setStatus('正在加载怪物条纹预设...');
  try {
    let data;
    try {
      const payload = await requestMonsterStripePresetApi('GET');
      data = payload.data;
    } catch {
      const response = await fetch(`${MONSTER_STRIPE_PRESET_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    }
    state.monsterStripePresets = normalizeMonsterStripePresetLibrary(data);
    ensureActiveMonsterStripePreset();
    sanitizeMonsterStripePresets();
    applyActiveMonsterStripePresetToDisplay();
    refreshMonsterStripePresetSelect();
    refreshMonsterStripePresetEditor();
    refreshMonsterConfigSelect();
    setStatus(`怪物条纹预设加载成功，共 ${Object.keys(state.monsterStripePresets).length} 个。`);
  } catch (error) {
    setStatus(`怪物条纹预设加载失败：${String(error)}`, true);
  }
};

const saveMonsterStripePresetsToServer = async () => {
  setStatus('正在保存怪物条纹预设...');
  try {
    const payload = normalizeMonsterStripePresetLibrary(state.monsterStripePresets);
    const data = await requestMonsterStripePresetApi('PUT', payload);
    const port = getResolvedDevServerPort();
    const hostLabel = port ? `127.0.0.1:${port}` : '未知端口';
    setStatus(`怪物条纹预设保存成功：${data.path || 'config/monsterStripePresets.json'}（${hostLabel}）`);
  } catch (error) {
    setStatus(`怪物条纹预设保存失败：${String(error)}`, true);
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
    ctx.globalAlpha = Math.max(0, Math.min(1, toNumber(preset.solidOpacity, 1)));
    ctx.fillStyle = preset.solidColor || '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    return;
  }
  const { image, period } = getPatternCanvas(cacheKey, preset);
  const shift = ((phasePx % period) + period) % period;
  const diag = Math.ceil(Math.sqrt(w * w + h * h));
  ctx.globalAlpha = Math.max(0, Math.min(1, toNumber(preset.backgroundOpacity, 1)));
  ctx.fillStyle = preset.background || '#000000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
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
  if (state.layers[layerKey].visible === false) return;
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
  ctx.fillStyle = el.previewBgInput?.value || '#0b0f16';
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
  el.loadMonsterConfigsBtn.addEventListener('click', () => {
    void loadMonsterConfigsFromServer();
  });
  el.saveMonsterConfigsBtn.addEventListener('click', () => {
    void saveMonsterConfigsToServer();
  });
  el.reloadStripeBtn.addEventListener('click', () => {
    void loadStripePresets();
  });
  el.reloadMonsterStripePresetBtn.addEventListener('click', () => {
    void loadMonsterStripePresetsFromServer();
  });
  el.saveMonsterStripePresetBtn.addEventListener('click', () => {
    void saveMonsterStripePresetsToServer();
  });

  el.monsterStripePresetSelect.addEventListener('change', () => {
    state.activeMonsterStripePresetKey = el.monsterStripePresetSelect.value;
    ensureActiveMonsterStripePreset();
    applyActiveMonsterStripePresetToDisplay();
    syncActiveConfigFromCurrentDisplay();
    refreshMonsterConfigSelect();
    refreshMonsterStripePresetSelect();
    refreshMonsterStripePresetEditor();
    setStatus(`已切换怪物条纹预设：${state.activeMonsterStripePresetKey}`);
  });
  el.monsterStripePresetNameInput.addEventListener('input', () => {
    const preset = activeMonsterStripePreset();
    if (!preset) return;
    preset.name = el.monsterStripePresetNameInput.value;
    refreshMonsterStripePresetSelect();
  });
  const renameActiveMonsterStripePresetKey = () => {
    const fromKey = state.activeMonsterStripePresetKey;
    const toKey = String(el.monsterStripePresetKeyInput.value || '').trim();
    if (!fromKey || !state.monsterStripePresets[fromKey]) return;
    if (!toKey) {
      setStatus('怪物条纹 presetKey 不能为空', true);
      el.monsterStripePresetKeyInput.value = fromKey;
      return;
    }
    if (toKey === fromKey) return;
    if (state.monsterStripePresets[toKey]) {
      setStatus(`怪物条纹 presetKey 已存在：${toKey}`, true);
      el.monsterStripePresetKeyInput.value = fromKey;
      return;
    }
    const moved = state.monsterStripePresets[fromKey];
    delete state.monsterStripePresets[fromKey];
    state.monsterStripePresets[toKey] = { ...moved, id: toKey };
    state.activeMonsterStripePresetKey = toKey;
    for (const config of Object.values(state.monsterConfigs)) {
      if (config.monsterStripePresetKey === fromKey) config.monsterStripePresetKey = toKey;
    }
    applyActiveMonsterStripePresetToDisplay();
    syncActiveConfigFromCurrentDisplay();
    refreshMonsterConfigSelect();
    refreshMonsterStripePresetSelect();
    refreshMonsterStripePresetEditor();
    setStatus(`已修改怪物条纹 presetKey：${fromKey} -> ${toKey}`);
  };
  el.renameMonsterStripePresetBtn.addEventListener('click', renameActiveMonsterStripePresetKey);
  el.monsterStripePresetKeyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      renameActiveMonsterStripePresetKey();
    }
  });
  el.newMonsterStripePresetBtn.addEventListener('click', () => {
    const key = (window.prompt('输入新的怪物条纹 presetKey（唯一）', 'monster_stripe_new') || '').trim();
    if (!key) return;
    if (state.monsterStripePresets[key]) {
      setStatus(`怪物条纹 presetKey 已存在：${key}`, true);
      return;
    }
    state.monsterStripePresets[key] = createDefaultMonsterStripePreset(key);
    state.activeMonsterStripePresetKey = key;
    applyActiveMonsterStripePresetToDisplay();
    syncActiveConfigFromCurrentDisplay();
    refreshMonsterConfigSelect();
    refreshMonsterStripePresetSelect();
    refreshMonsterStripePresetEditor();
    setStatus(`已创建怪物条纹预设：${key}`);
  });
  el.duplicateMonsterStripePresetBtn.addEventListener('click', () => {
    const source = activeMonsterStripePreset();
    if (!source) return;
    const key = (window.prompt('输入复制后的怪物条纹 presetKey（唯一）', `${state.activeMonsterStripePresetKey}_copy`) || '').trim();
    if (!key) return;
    if (state.monsterStripePresets[key]) {
      setStatus(`怪物条纹 presetKey 已存在：${key}`, true);
      return;
    }
    const cloned = JSON.parse(JSON.stringify(source));
    cloned.id = key;
    cloned.name = `${source.name} (copy)`;
    state.monsterStripePresets[key] = normalizeMonsterStripePreset(key, cloned);
    state.activeMonsterStripePresetKey = key;
    applyActiveMonsterStripePresetToDisplay();
    syncActiveConfigFromCurrentDisplay();
    refreshMonsterConfigSelect();
    refreshMonsterStripePresetSelect();
    refreshMonsterStripePresetEditor();
    setStatus(`已复制怪物条纹预设：${key}`);
  });
  el.deleteMonsterStripePresetBtn.addEventListener('click', () => {
    const key = state.activeMonsterStripePresetKey;
    if (!key || !state.monsterStripePresets[key]) return;
    if (!window.confirm(`确认删除怪物条纹预设：${key} ?`)) return;
    delete state.monsterStripePresets[key];
    ensureActiveMonsterStripePreset();
    for (const config of Object.values(state.monsterConfigs)) {
      if (!state.monsterStripePresets[config.monsterStripePresetKey]) {
        config.monsterStripePresetKey = state.activeMonsterStripePresetKey;
      }
    }
    applyActiveMonsterStripePresetToDisplay();
    syncActiveConfigFromCurrentDisplay();
    refreshMonsterConfigSelect();
    refreshMonsterStripePresetSelect();
    refreshMonsterStripePresetEditor();
    setStatus('已删除当前怪物条纹预设。');
  });
  el.monsterStripePresetBindingSelect?.addEventListener('change', () => {
    const key = el.monsterStripePresetBindingSelect.value;
    if (!state.monsterStripePresets[key]) return;
    state.activeMonsterStripePresetKey = key;
    applyActiveMonsterStripePresetToDisplay();
    syncActiveConfigFromCurrentDisplay();
    refreshMonsterConfigSelect();
    refreshMonsterStripePresetSelect();
    refreshMonsterStripePresetEditor();
    setStatus(`当前怪物已绑定怪物条纹预设：${key}`);
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
  state.monsterStripePresets = {
    [DEFAULT_MONSTER_STRIPE_PRESET_KEY]: createDefaultMonsterStripePreset(DEFAULT_MONSTER_STRIPE_PRESET_KEY)
  };
  state.activeMonsterStripePresetKey = DEFAULT_MONSTER_STRIPE_PRESET_KEY;
  state.monsterConfigs = {
    monster_default: createDefaultMonsterConfig('monster_default')
  };
  state.activeMonsterConfigId = 'monster_default';
  buildAssetDatalist();
  refreshMonsterConfigSelect();
  applyDisplayFromConfig(activeMonsterConfig());
  renderLayerControls();
  refreshMonsterStripePresetSelect();
  refreshMonsterStripePresetEditor();
  renderLayerStripeBindingsControls();
  bindEvents();

  const connection = await probeDevServerConnection(MONSTER_CONFIG_API_PATH);
  if (!connection.connected) {
    setStatus('开发服务器未连接（请启动 python/server.py）', true);
  }

  await loadStripePresets();
  await loadMonsterStripePresetsFromServer();
  if (connection.connected) {
    await loadMonsterConfigsFromServer();
  } else {
    await loadAllLayerImages();
  }
  resizeCanvas();
  requestAnimationFrame(tick);
};

void boot();
