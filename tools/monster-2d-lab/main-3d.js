import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  TransformNode,
  Vector3
} from '@babylonjs/core';
import { createAtlasSpritePlane } from '/core/sprite/render/createAtlasSpritePlane.ts';
import { createStripeMaskMaterial } from '/core/sprite/render/createStripeMaskMaterial.ts';
import { createCameraLabController } from '/core/camera/cameraLabController.ts';
import { createRoadSceneEnvironment } from '/core/scene/createCameraLabScene.ts';
import { createFloatingCameraControlPanel } from '/core/ui/FloatingCameraControlPanel.ts';
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
  normalizeMonsterConfigLibrary as normalizeCoreMonsterConfigLibrary,
  normalizeMonsterResourcePath,
  normalizeMonsterStripePresetLibrary as normalizeCoreMonsterStripePresetLibrary,
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
const CAMERA_HOME_TARGET = new Vector3(0, -0.15, -18);
const CAMERA_HOME_ALPHA = Math.PI / 2;
const CAMERA_HOME_BETA = 1.36;
const CAMERA_HOME_RADIUS = 42;
const CAMERA_DEFAULTS = {
  moveSpeed: 18,
  mouseSensitivity: 0.003,
  firstPersonHeight: 1.8,
  yaw: Math.PI,
  pitch: -0.08,
  dronePosition: new Vector3(0, 7, 16),
  firstPersonPosition: new Vector3(0, 1.8, 12),
  orbitCenter: CAMERA_HOME_TARGET.clone(),
  orbitYaw: 0,
  orbitPitchDeg: 12,
  orbitRadius: CAMERA_HOME_RADIUS,
  lockPlaneY: 6,
  lockPosition: new Vector3(0, 6, 20),
  lockTarget: new Vector3(0, -0.15, -520)
};

const state = {
  presets: {},
  monsterStripePresets: {},
  activeMonsterStripePresetKey: DEFAULT_MONSTER_STRIPE_PRESET_KEY,
  monsterConfigs: {},
  activeMonsterConfigId: '',
  animTimeSec: 0,
  layers: {
    line: { path: DEFAULT_ASSETS.line, stripePresetKey: STRIPE_NONE, visible: true },
    body: { path: DEFAULT_ASSETS.body, stripePresetKey: STRIPE_NONE, visible: true },
    bottomBorder: { path: DEFAULT_ASSETS.bottomBorder, stripePresetKey: STRIPE_NONE, visible: true },
    bottomFillMask: { path: DEFAULT_ASSETS.bottomFillMask, stripePresetKey: STRIPE_NONE, visible: true }
  },
  resourceImageOptions: [],
  babylon: {
    engine: null,
    scene: null,
    camera: null,
    cameraController: null,
    cameraPanel: null,
    root: null,
    layerHandles: new Map(),
    stripeHandles: new Map(),
    layerDebugHandles: new Map(),
    spriteDebugEnabled: false,
    spriteFacingAxis: '+Z',
    drag: {
      active: false,
      pointerId: -1,
      lastClientX: 0,
      lastClientY: 0
    },
    cameraControl: {
      mode: 'orbit',
      lookControlMode: 'pointerLock',
      keys: new Set(),
      pointerLocked: false,
      moveSpeed: CAMERA_DEFAULTS.moveSpeed,
      mouseSensitivity: CAMERA_DEFAULTS.mouseSensitivity,
      firstPersonHeight: CAMERA_DEFAULTS.firstPersonHeight,
      yaw: CAMERA_DEFAULTS.yaw,
      pitch: CAMERA_DEFAULTS.pitch,
      firstPersonPosition: CAMERA_DEFAULTS.firstPersonPosition.clone(),
      dronePosition: CAMERA_DEFAULTS.dronePosition.clone(),
      orbitCenter: CAMERA_DEFAULTS.orbitCenter.clone(),
      orbitYaw: CAMERA_DEFAULTS.orbitYaw,
      orbitPitchDeg: CAMERA_DEFAULTS.orbitPitchDeg,
      orbitRadius: CAMERA_DEFAULTS.orbitRadius,
      lockPlaneY: CAMERA_DEFAULTS.lockPlaneY,
      lockPosition: CAMERA_DEFAULTS.lockPosition.clone(),
      lockTarget: CAMERA_DEFAULTS.lockTarget.clone()
    }
  }
};

const el = {
  go2dPageBtn: document.getElementById('go2dPageBtn'),
  go3dPageBtn: document.getElementById('go3dPageBtn'),
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
  scene3dScaleInput: document.getElementById('scene3dScaleInput'),
  scene3dHeightInput: document.getElementById('scene3dHeightInput'),
  scene3dOffsetXInput: document.getElementById('scene3dOffsetXInput'),
  resetPositionBtn: document.getElementById('resetPositionBtn'),
  spriteFacingAxisSelect: document.getElementById('spriteFacingAxisSelect'),
  spriteDebugCheckbox: document.getElementById('spriteDebugCheckbox'),
  preview: document.getElementById('preview'),
  monsterAssetList: document.getElementById('monsterAssetList'),
  cameraModeSelect: document.getElementById('cameraModeSelect'),
  lookControlModeSelect: document.getElementById('lookControlModeSelect'),
  cameraSpeedInput: document.getElementById('cameraSpeedInput'),
  mouseSensitivityInput: document.getElementById('mouseSensitivityInput'),
  cameraHeightInput: document.getElementById('cameraHeightInput'),
  lockPlaneYInput: document.getElementById('lockPlaneYInput'),
  orbitCenterXInput: document.getElementById('orbitCenterXInput'),
  orbitCenterYInput: document.getElementById('orbitCenterYInput'),
  orbitCenterZInput: document.getElementById('orbitCenterZInput'),
  orbitRadiusInput: document.getElementById('orbitRadiusInput'),
  orbitPitchInput: document.getElementById('orbitPitchInput'),
  lockTargetXInput: document.getElementById('lockTargetXInput'),
  lockTargetYInput: document.getElementById('lockTargetYInput'),
  lockTargetZInput: document.getElementById('lockTargetZInput'),
  applyCameraParamsBtn: document.getElementById('applyCameraParamsBtn'),
  cameraStatusText: document.getElementById('cameraStatusText'),
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

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const isTypingTarget = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
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
  syncStripeMaterialsForAllLayers();
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
  config.scene3dScale = Math.max(0.01, toNumber(el.scene3dScaleInput?.value, config.scene3dScale || 1));
  config.scene3dHeight = toNumber(el.scene3dHeightInput?.value, config.scene3dHeight || 0);
  config.scene3dOffsetX = toNumber(el.scene3dOffsetXInput?.value, config.scene3dOffsetX || 0);
  config.spriteFacingAxis = el.spriteFacingAxisSelect?.value === '-Z' ? '-Z' : '+Z';
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
  el.scene3dScaleInput.value = String(Math.max(0.01, toNumber(config.scene3dScale, 1)));
  el.scene3dHeightInput.value = String(toNumber(config.scene3dHeight, 0));
  if (el.scene3dOffsetXInput) {
    el.scene3dOffsetXInput.value = String(toNumber(config.scene3dOffsetX, 0));
  }
  state.babylon.spriteFacingAxis = config.spriteFacingAxis === '-Z' ? '-Z' : '+Z';
  if (el.spriteFacingAxisSelect) {
    el.spriteFacingAxisSelect.value = state.babylon.spriteFacingAxis;
  }
  syncAllLayerFacingAxis();
  applyMonsterTransformFromInputs();
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
      void loadAllLayerMeshes();
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
        void loadAllLayerMeshes();
      }
    });
  });
};

const getLayerHandle = (layerKey) => state.babylon.layerHandles.get(layerKey) || null;

const applyFacingAxisToMesh = (mesh) => {
  if (!mesh) return;
  mesh.rotation.x = 0;
  mesh.rotation.z = 0;
  mesh.rotation.y = state.babylon.spriteFacingAxis === '+Z' ? Math.PI : 0;
};

const syncAllLayerFacingAxis = () => {
  for (const handle of state.babylon.layerHandles.values()) {
    applyFacingAxisToMesh(handle.controller.mesh);
  }
};

const disposeLayerDebugHandle = (layerKey) => {
  const debugMeshes = state.babylon.layerDebugHandles.get(layerKey);
  if (!debugMeshes) return;
  debugMeshes.forEach((mesh) => mesh.dispose());
  state.babylon.layerDebugHandles.delete(layerKey);
};

const syncLayerDebugHandle = (layerKey) => {
  disposeLayerDebugHandle(layerKey);
  const handle = getLayerHandle(layerKey);
  if (!handle) return;
  const layerVisible = state.layers[layerKey]?.visible !== false;
  const shouldShowDebug = state.babylon.spriteDebugEnabled && layerVisible;
  handle.controller.mesh.showBoundingBox = shouldShowDebug;
  if (!shouldShowDebug) return;

  const z = -0.015;
  const pTL = new Vector3(-0.5, 0.5, z);
  const pTR = new Vector3(0.5, 0.5, z);
  const pBR = new Vector3(0.5, -0.5, z);
  const pBL = new Vector3(-0.5, -0.5, z);
  const hL = new Vector3(-0.5, 0, z);
  const hR = new Vector3(0.5, 0, z);
  const vT = new Vector3(0, 0.5, z);
  const vB = new Vector3(0, -0.5, z);

  const edgeColor = new Color3(0.98, 0.78, 0.2);
  const axisColor = new Color3(0.35, 0.78, 1);
  const bounds = MeshBuilder.CreateLines(
    `monster_layer_debug_bounds_${layerKey}`,
    { points: [pTL, pTR, pBR, pBL, pTL] },
    state.babylon.scene
  );
  bounds.color = edgeColor;
  bounds.parent = handle.controller.mesh;
  bounds.isPickable = false;

  const axisH = MeshBuilder.CreateLines(
    `monster_layer_debug_axis_h_${layerKey}`,
    { points: [hL, hR] },
    state.babylon.scene
  );
  axisH.color = axisColor;
  axisH.parent = handle.controller.mesh;
  axisH.isPickable = false;

  const axisV = MeshBuilder.CreateLines(
    `monster_layer_debug_axis_v_${layerKey}`,
    { points: [vT, vB] },
    state.babylon.scene
  );
  axisV.color = axisColor;
  axisV.parent = handle.controller.mesh;
  axisV.isPickable = false;

  state.babylon.layerDebugHandles.set(layerKey, [bounds, axisH, axisV]);
};

const syncAllLayerDebugHandles = () => {
  for (const layerKey of FIXED_RENDER_ORDER) {
    syncLayerDebugHandle(layerKey);
  }
};

const disposeLayerHandle = (layerKey) => {
  disposeLayerDebugHandle(layerKey);
  const stripe = state.babylon.stripeHandles.get(layerKey);
  stripe?.controller?.dispose();
  state.babylon.stripeHandles.delete(layerKey);

  const handle = state.babylon.layerHandles.get(layerKey);
  if (!handle) return;
  handle.controller.dispose();
  state.babylon.layerHandles.delete(layerKey);
};

const applyMonsterTransformFromInputs = () => {
  const root = state.babylon.root;
  if (!root) return;
  const sizeRatio = Math.max(0.2, toNumber(el.sizeInput.value, 560) / 560);
  const scene3dScale = Math.max(0.01, toNumber(el.scene3dScaleInput?.value, 1));
  const finalScale = sizeRatio * scene3dScale;
  const scene3dHeight = toNumber(el.scene3dHeightInput?.value, 0);
  const scene3dOffsetX = toNumber(el.scene3dOffsetXInput?.value, 0);
  root.scaling.set(finalScale, finalScale, finalScale);
  root.position.x = scene3dOffsetX;
  root.position.y = scene3dHeight;
};

const updateCameraProjection = () => {
  const camera = state.babylon.camera;
  if (!camera) return;
  camera.fov = 0.43;
  camera.minZ = 0.05;
  camera.maxZ = 1500;
};

const applyCameraHomePose = () => {
  const camera = state.babylon.camera;
  if (!camera) return;
  const control = state.babylon.cameraControl;
  control.mode = 'orbit';
  control.orbitCenter = CAMERA_DEFAULTS.orbitCenter.clone();
  control.orbitYaw = CAMERA_DEFAULTS.orbitYaw;
  control.orbitPitchDeg = CAMERA_DEFAULTS.orbitPitchDeg;
  control.orbitRadius = CAMERA_DEFAULTS.orbitRadius;
  syncCameraControlInputs();
  applyCameraControlPose();
  updateCameraProjection();
  state.babylon.cameraPanel?.syncFromController();
  state.babylon.cameraPanel?.updateStatus();
};

const readCameraControlInputs = () => {
  const control = state.babylon.cameraControl;
  control.mode = el.cameraModeSelect?.value || control.mode;
  control.lookControlMode = el.lookControlModeSelect?.value === 'drag' ? 'drag' : 'pointerLock';
  control.moveSpeed = Math.max(0.1, toNumber(el.cameraSpeedInput?.value, control.moveSpeed));
  control.mouseSensitivity = clamp(toNumber(el.mouseSensitivityInput?.value, control.mouseSensitivity), 0.0005, 0.02);
  control.firstPersonHeight = toNumber(el.cameraHeightInput?.value, control.firstPersonHeight);
  control.lockPlaneY = toNumber(el.lockPlaneYInput?.value, control.lockPlaneY);
  control.orbitCenter = new Vector3(
    toNumber(el.orbitCenterXInput?.value, control.orbitCenter.x),
    toNumber(el.orbitCenterYInput?.value, control.orbitCenter.y),
    toNumber(el.orbitCenterZInput?.value, control.orbitCenter.z)
  );
  control.orbitRadius = Math.max(1, toNumber(el.orbitRadiusInput?.value, control.orbitRadius));
  control.orbitPitchDeg = clamp(toNumber(el.orbitPitchInput?.value, control.orbitPitchDeg), -80, 80);
  control.lockTarget = new Vector3(
    toNumber(el.lockTargetXInput?.value, control.lockTarget.x),
    toNumber(el.lockTargetYInput?.value, control.lockTarget.y),
    toNumber(el.lockTargetZInput?.value, control.lockTarget.z)
  );
};

const syncCameraControlInputs = () => {
  const control = state.babylon.cameraControl;
  if (el.cameraModeSelect) el.cameraModeSelect.value = control.mode;
  if (el.lookControlModeSelect) el.lookControlModeSelect.value = control.lookControlMode;
  if (el.cameraSpeedInput) el.cameraSpeedInput.value = String(control.moveSpeed);
  if (el.mouseSensitivityInput) el.mouseSensitivityInput.value = String(control.mouseSensitivity);
  if (el.cameraHeightInput) el.cameraHeightInput.value = String(control.firstPersonHeight);
  if (el.lockPlaneYInput) el.lockPlaneYInput.value = String(control.lockPlaneY);
  if (el.orbitCenterXInput) el.orbitCenterXInput.value = String(control.orbitCenter.x);
  if (el.orbitCenterYInput) el.orbitCenterYInput.value = String(control.orbitCenter.y);
  if (el.orbitCenterZInput) el.orbitCenterZInput.value = String(control.orbitCenter.z);
  if (el.orbitRadiusInput) el.orbitRadiusInput.value = String(control.orbitRadius);
  if (el.orbitPitchInput) el.orbitPitchInput.value = String(control.orbitPitchDeg);
  if (el.lockTargetXInput) el.lockTargetXInput.value = String(control.lockTarget.x);
  if (el.lockTargetYInput) el.lockTargetYInput.value = String(control.lockTarget.y);
  if (el.lockTargetZInput) el.lockTargetZInput.value = String(control.lockTarget.z);
};

const applyCameraControlPose = () => {
  const controller = state.babylon.cameraController;
  if (!controller) return;
  controller.applyPose();
};

const updateCameraStatus = () => {
  const controller = state.babylon.cameraController;
  if (!controller || !el.cameraStatusText) return;
  el.cameraStatusText.value = controller.getStatusText();
};

const updateCameraControl = (dt) => {
  const controller = state.babylon.cameraController;
  if (!controller) return;
  controller.update(dt);
  updateCameraStatus();
};

const handleCameraPointerDelta = (dx, dy) => {
  const controller = state.babylon.cameraController;
  if (!controller) return;
  controller.handlePointerDelta(dx, dy);
  if (controller.state.mode === 'orbit') {
    syncCameraControlInputs();
  }
  updateCameraStatus();
  state.babylon.cameraPanel?.syncFromController();
  state.babylon.cameraPanel?.updateStatus();
};

const syncStripeMaterialsForAllLayers = () => {
  for (const layerKey of FIXED_RENDER_ORDER) {
    const handle = getLayerHandle(layerKey);
    if (!handle) continue;

    const stripePresetKey = state.layers[layerKey].stripePresetKey;
    const layerVisible = state.layers[layerKey].visible !== false;
    const preset = state.presets[stripePresetKey];
    const currentStripe = state.babylon.stripeHandles.get(layerKey);

    if (!layerVisible) {
      handle.controller.mesh.setEnabled(false);
      handle.controller.mesh.showBoundingBox = false;
      if (currentStripe) {
        currentStripe.controller.dispose();
        state.babylon.stripeHandles.delete(layerKey);
      }
      handle.controller.mesh.material = handle.baseMaterial;
      continue;
    }
    handle.controller.mesh.setEnabled(true);
    handle.controller.mesh.showBoundingBox = state.babylon.spriteDebugEnabled;

    if (stripePresetKey === STRIPE_NONE || !preset) {
      if (currentStripe) {
        currentStripe.controller.dispose();
        state.babylon.stripeHandles.delete(layerKey);
      }
      handle.controller.mesh.material = handle.baseMaterial;
      continue;
    }

    if (currentStripe && currentStripe.presetKey === stripePresetKey) {
      currentStripe.controller.updatePreset(preset);
      currentStripe.controller.updateRenderSize(handle.renderSizePx.width, handle.renderSizePx.height);
      continue;
    }

    currentStripe?.controller.dispose();
    const shader = createStripeMaskMaterial(
      state.babylon.scene,
      `monster_stripe_${layerKey}`,
      handle.textureUrl,
      preset,
      handle.renderSizePx
    );
    shader.updateTime(state.animTimeSec);
    state.babylon.stripeHandles.set(layerKey, {
      presetKey: stripePresetKey,
      controller: shader
    });
    handle.controller.mesh.material = shader.material;
  }
  syncAllLayerDebugHandles();
};

const loadAllLayerMeshes = async () => {
  if (!state.babylon.scene || !state.babylon.root) return;
  setStatus('正在加载分层图片...');
  const errors = [];
  const loadedLayerKeys = new Set();
  const loadedLayerImages = new Map();

  for (const layerKey of LAYER_KEYS) {
    const layer = state.layers[layerKey];
    layer.path = normalizeResourcePath(layer.path) || DEFAULT_ASSETS[layerKey];
  }
  state.resourceImageOptions = getScannedResourceImages();
  renderLayerControls();
  buildAssetDatalist();

  const preloads = await Promise.allSettled(
    LAYER_KEYS.map((layerKey) => loadImage(toResourceUrl(state.layers[layerKey].path)))
  );

  preloads.forEach((result, idx) => {
    const layerKey = LAYER_KEYS[idx];
    if (result.status === 'rejected') {
      errors.push(`${LAYER_LABELS[layerKey]}: ${String(result.reason)}`);
      return;
    }
    loadedLayerKeys.add(layerKey);
    loadedLayerImages.set(layerKey, result.value);
  });

  for (const layerKey of FIXED_RENDER_ORDER) {
    disposeLayerHandle(layerKey);
  }

  for (let index = 0; index < FIXED_RENDER_ORDER.length; index += 1) {
    const layerKey = FIXED_RENDER_ORDER[index];
    if (!loadedLayerKeys.has(layerKey)) continue;
    const path = state.layers[layerKey].path;
    const textureUrl = toResourceUrl(path);
    const sourceImage = loadedLayerImages.get(layerKey);
    const controller = createAtlasSpritePlane(state.babylon.scene, textureUrl, 2.8, { shareTexture: false });
    controller.mesh.parent = state.babylon.root;
    applyFacingAxisToMesh(controller.mesh);
    controller.mesh.position = new Vector3(0, 0, index * 0.01);
    controller.mesh.isPickable = false;
    const baseMaterial = controller.mesh.material;
    state.babylon.layerHandles.set(layerKey, {
      controller,
      textureUrl,
      baseMaterial,
      renderSizePx: {
        width: Math.max(1, sourceImage?.naturalWidth || sourceImage?.width || 1),
        height: Math.max(1, sourceImage?.naturalHeight || sourceImage?.height || 1)
      }
    });
  }

  syncStripeMaterialsForAllLayers();
  applyMonsterTransformFromInputs();

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
      await loadAllLayerMeshes();
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

const bindEvents = () => {
  if (el.go3dPageBtn) {
    el.go3dPageBtn.disabled = true;
  }
  el.go2dPageBtn?.addEventListener('click', () => {
    window.location.href = './index.html';
  });
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
    void loadAllLayerMeshes();
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
    void loadAllLayerMeshes();
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
      void loadAllLayerMeshes();
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
      void loadAllLayerMeshes();
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
    void loadAllLayerMeshes();
  });
  el.resetPositionBtn.addEventListener('click', () => {
    applyCameraHomePose();
    setStatus('已恢复到默认镜头位置。');
  });
  el.spriteFacingAxisSelect?.addEventListener('change', () => {
    state.babylon.spriteFacingAxis = el.spriteFacingAxisSelect.value === '-Z' ? '-Z' : '+Z';
    syncAllLayerFacingAxis();
    syncActiveConfigFromCurrentDisplay();
    setStatus(`精灵面向轴已切换为 ${state.babylon.spriteFacingAxis}。`);
  });
  el.spriteDebugCheckbox?.addEventListener('change', () => {
    state.babylon.spriteDebugEnabled = el.spriteDebugCheckbox.checked;
    syncAllLayerDebugHandles();
    setStatus(`精灵 Debug ${state.babylon.spriteDebugEnabled ? '已开启' : '已关闭'}。`);
  });

  const cameraParamInputs = [
    el.lookControlModeSelect,
    el.cameraSpeedInput,
    el.mouseSensitivityInput,
    el.cameraHeightInput,
    el.lockPlaneYInput,
    el.orbitCenterXInput,
    el.orbitCenterYInput,
    el.orbitCenterZInput,
    el.orbitRadiusInput,
    el.orbitPitchInput,
    el.lockTargetXInput,
    el.lockTargetYInput,
    el.lockTargetZInput
  ].filter(Boolean);

  const applyCameraParamsFromPanel = () => {
    readCameraControlInputs();
    applyCameraControlPose();
    updateCameraStatus();
  };

  el.cameraModeSelect?.addEventListener('change', () => {
    readCameraControlInputs();
    applyCameraControlPose();
    updateCameraStatus();
    setStatus(`已切换摄像机模式：${state.babylon.cameraControl.mode}`);
  });
  cameraParamInputs.forEach((input) => {
    input.addEventListener('input', applyCameraParamsFromPanel);
  });
  el.applyCameraParamsBtn?.addEventListener('click', () => {
    applyCameraParamsFromPanel();
    setStatus('摄像机参数已应用。');
  });

  el.preview.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    state.babylon.drag.active = true;
    state.babylon.drag.pointerId = event.pointerId;
    state.babylon.drag.lastClientX = event.clientX;
    state.babylon.drag.lastClientY = event.clientY;
    el.preview.style.cursor = 'grabbing';
    el.preview.setPointerCapture(event.pointerId);
    const mode = state.babylon.cameraControl.mode;
    const shouldLockPointer = state.babylon.cameraControl.lookControlMode === 'pointerLock';
    if ((mode === 'firstPerson' || mode === 'drone') && shouldLockPointer && document.pointerLockElement !== el.preview) {
      el.preview.requestPointerLock?.();
    }
  });

  el.preview.addEventListener('pointermove', (event) => {
    if (!state.babylon.drag.active || event.pointerId !== state.babylon.drag.pointerId) return;
    const dx = event.clientX - state.babylon.drag.lastClientX;
    const dy = event.clientY - state.babylon.drag.lastClientY;
    state.babylon.drag.lastClientX = event.clientX;
    state.babylon.drag.lastClientY = event.clientY;
    handleCameraPointerDelta(dx, dy);
  });

  const stopDrag = (event) => {
    if (!state.babylon.drag.active || event.pointerId !== state.babylon.drag.pointerId) return;
    state.babylon.drag.active = false;
    state.babylon.drag.pointerId = -1;
    el.preview.style.cursor = 'grab';
    if (el.preview.hasPointerCapture(event.pointerId)) {
      el.preview.releasePointerCapture(event.pointerId);
    }
  };
  el.preview.addEventListener('pointerup', stopDrag);
  el.preview.addEventListener('pointercancel', stopDrag);
  document.addEventListener('pointerlockchange', () => {
    state.babylon.cameraControl.pointerLocked = document.pointerLockElement === el.preview;
    el.preview.style.cursor = state.babylon.cameraControl.pointerLocked ? 'none' : 'grab';
    updateCameraStatus();
    state.babylon.cameraPanel?.updateStatus();
  });
  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== el.preview) return;
    handleCameraPointerDelta(event.movementX || 0, event.movementY || 0);
  });
  window.addEventListener('keydown', (event) => {
    if (isTypingTarget(event.target)) return;
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) return;
    state.babylon.cameraControl.keys.add(event.code);
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    state.babylon.cameraControl.keys.delete(event.code);
  });
  el.preview.addEventListener('wheel', (event) => {
    const controller = state.babylon.cameraController;
    if (!controller || controller.state.mode !== 'orbit') return;
    event.preventDefault();
    controller.handleWheel(event.deltaY);
    syncCameraControlInputs();
    updateCameraStatus();
    state.babylon.cameraPanel?.syncFromController();
    state.babylon.cameraPanel?.updateStatus();
  }, { passive: false });

  window.addEventListener('resize', () => {
    if (!state.babylon.engine) return;
    state.babylon.engine.resize();
    updateCameraProjection();
  });
  el.sizeInput.addEventListener('input', () => {
    applyMonsterTransformFromInputs();
    syncActiveConfigFromCurrentDisplay();
  });
  el.scene3dScaleInput?.addEventListener('input', () => {
    applyMonsterTransformFromInputs();
    syncActiveConfigFromCurrentDisplay();
  });
  el.scene3dHeightInput?.addEventListener('input', () => {
    applyMonsterTransformFromInputs();
    syncActiveConfigFromCurrentDisplay();
  });
  el.scene3dOffsetXInput?.addEventListener('input', () => {
    applyMonsterTransformFromInputs();
    syncActiveConfigFromCurrentDisplay();
  });
};

const initBabylon = () => {
  const engine = new Engine(el.preview, true, {
    preserveDrawingBuffer: true,
    stencil: true
  });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.57, 0.78, 0.98, 1);

  const camera = new ArcRotateCamera(
    'monsterLabCamera',
    CAMERA_HOME_ALPHA,
    CAMERA_HOME_BETA,
    CAMERA_HOME_RADIUS,
    CAMERA_HOME_TARGET.clone(),
    scene
  );
  camera.inputs.clear();

  const light = new HemisphericLight('monsterLabLight', new Vector3(0, 1, 0), scene);
  light.intensity = 0.95;
  light.groundColor = new Color3(0.32, 0.35, 0.3);

  const root = new TransformNode('monsterRoot', scene);
  createRoadSceneEnvironment(scene);
  const cameraController = createCameraLabController(camera);
  cameraController.state.keys = cameraController.keys;
  cameraController.state.pointerLocked = false;
  const cameraPanel = el.preview.parentElement
    ? createFloatingCameraControlPanel(el.preview.parentElement, cameraController)
    : null;

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    state.animTimeSec += dt;
    updateCameraControl(dt);
    state.babylon.cameraPanel?.updateStatus();
    for (const stripeHandle of state.babylon.stripeHandles.values()) {
      stripeHandle.controller.updateTime(state.animTimeSec);
    }
  });

  engine.runRenderLoop(() => {
    scene.render();
  });

  state.babylon.engine = engine;
  state.babylon.scene = scene;
  state.babylon.camera = camera;
  state.babylon.cameraController = cameraController;
  state.babylon.cameraPanel = cameraPanel;
  state.babylon.cameraControl = cameraController.state;
  state.babylon.root = root;
  state.babylon.spriteFacingAxis = el.spriteFacingAxisSelect?.value === '-Z' ? '-Z' : '+Z';
  if (el.spriteFacingAxisSelect) {
    el.spriteFacingAxisSelect.value = state.babylon.spriteFacingAxis;
  }
  state.babylon.spriteDebugEnabled = Boolean(el.spriteDebugCheckbox?.checked);
  applyCameraHomePose();
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
  initBabylon();

  const connection = await probeDevServerConnection(MONSTER_CONFIG_API_PATH);
  if (!connection.connected) {
    setStatus('开发服务器未连接（请启动 python/server.py）', true);
  }

  await loadStripePresets();
  await loadMonsterStripePresetsFromServer();
  if (connection.connected) {
    await loadMonsterConfigsFromServer();
  } else {
    await loadAllLayerMeshes();
  }
};

void boot();
