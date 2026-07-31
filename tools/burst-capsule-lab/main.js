import {
  getResolvedDevServerPort,
  requestDevServer
} from '/core/network/devServerPortResolver.ts';
import {
  createBurstCapsuleEffect
} from '/core/effects/burst-capsule/index.ts';

const BURST_PRESET_URL = '/config/burstCapsulePresets.json';
const BURST_PRESET_API_PATH = '/api/burst-capsule-presets';
const DEFAULT_BURST_PRESET_KEY = 'burst_capsule_default';

const canvas = document.getElementById('canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Burst Capsule Lab canvas not found.');
}

const state = {
  activePresetKey: DEFAULT_BURST_PRESET_KEY,
  presets: {},
  presetDirty: false,
  controls: {
    spawnCount: 36,
    spawnJitter: 0.1,
    speedMin: 15,
    speedMax: 40,
    friction: 0.92,
    decayMin: 0.03,
    decayMax: 0.06,
    lengthMin: 60,
    lengthMax: 140,
    thicknessMin: 4,
    thicknessMax: 7,
    outlineWidth: 3,
    trailAlpha: 1,
    decayVisualMode: 'fade',
    shrinkPower: 1.6,
    colorMode: 'random',
    singleMainColor: '#00f0ff',
    singleStrokeColor: '#ffffff'
  }
};

const burstCapsuleEffect = createBurstCapsuleEffect(canvas);

const el = {
  burstPresetSelect: document.getElementById('burstPresetSelect'),
  burstPresetKeyInput: document.getElementById('burstPresetKeyInput'),
  burstPresetNameInput: document.getElementById('burstPresetNameInput'),
  loadPresetBtn: document.getElementById('loadPresetBtn'),
  savePresetBtn: document.getElementById('savePresetBtn'),
  renamePresetBtn: document.getElementById('renamePresetBtn'),
  newPresetBtn: document.getElementById('newPresetBtn'),
  duplicatePresetBtn: document.getElementById('duplicatePresetBtn'),
  deletePresetBtn: document.getElementById('deletePresetBtn'),
  presetStatus: document.getElementById('presetStatus')
};

const bindings = [
  ['spawnCount', 0],
  ['spawnJitter', 2],
  ['speedMin', 1],
  ['speedMax', 1],
  ['friction', 3],
  ['decayMin', 3],
  ['decayMax', 3],
  ['lengthMin', 0],
  ['lengthMax', 0],
  ['thicknessMin', 1],
  ['thicknessMax', 1],
  ['outlineWidth', 1],
  ['trailAlpha', 2],
  ['shrinkPower', 2]
];

function setStatus(message, isError = false) {
  if (!el.presetStatus) return;
  el.presetStatus.textContent = message;
  el.presetStatus.style.color = isError ? '#fca5a5' : '#93c5fd';
}

async function parseJsonPayload(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`接口返回非 JSON 内容：${text.slice(0, 120)}`);
  }
}

async function requestBurstPresetApi(method, body) {
  const response = await requestDevServer(
    method === 'GET' ? `${BURST_PRESET_API_PATH}?t=${Date.now()}` : BURST_PRESET_API_PATH,
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
}

function createDefaultBurstPreset(key) {
  return {
    presetKey: key,
    name: key,
    controls: {
      spawnCount: 36,
      spawnJitter: 0.1,
      speedMin: 15,
      speedMax: 40,
      friction: 0.92,
      decayMin: 0.03,
      decayMax: 0.06,
      lengthMin: 60,
      lengthMax: 140,
      thicknessMin: 4,
      thicknessMax: 7,
      outlineWidth: 3,
      trailAlpha: 1,
      decayVisualMode: 'fade',
      shrinkPower: 1.6,
      colorMode: 'random',
      singleMainColor: '#00f0ff',
      singleStrokeColor: '#ffffff'
    }
  };
}

function normalizePresetControls(rawControls = {}) {
  const fallback = createDefaultBurstPreset(DEFAULT_BURST_PRESET_KEY).controls;
  const controls = {
    ...fallback,
    ...rawControls
  };
  controls.spawnCount = Math.round(Number(controls.spawnCount) || fallback.spawnCount);
  controls.spawnJitter = Number(controls.spawnJitter) || 0;
  controls.speedMin = Number(controls.speedMin) || fallback.speedMin;
  controls.speedMax = Number(controls.speedMax) || fallback.speedMax;
  controls.friction = Number(controls.friction) || fallback.friction;
  controls.decayMin = Number(controls.decayMin) || fallback.decayMin;
  controls.decayMax = Number(controls.decayMax) || fallback.decayMax;
  controls.lengthMin = Number(controls.lengthMin) || fallback.lengthMin;
  controls.lengthMax = Number(controls.lengthMax) || fallback.lengthMax;
  controls.thicknessMin = Number(controls.thicknessMin) || fallback.thicknessMin;
  controls.thicknessMax = Number(controls.thicknessMax) || fallback.thicknessMax;
  controls.outlineWidth = Number(controls.outlineWidth) || fallback.outlineWidth;
  controls.trailAlpha = Number(controls.trailAlpha);
  if (!Number.isFinite(controls.trailAlpha)) controls.trailAlpha = fallback.trailAlpha;
  controls.decayVisualMode = controls.decayVisualMode === 'shrink' ? 'shrink' : 'fade';
  controls.shrinkPower = Number(controls.shrinkPower) || fallback.shrinkPower;
  controls.colorMode = controls.colorMode === 'single' ? 'single' : 'random';
  controls.singleMainColor = typeof controls.singleMainColor === 'string' ? controls.singleMainColor : fallback.singleMainColor;
  controls.singleStrokeColor = typeof controls.singleStrokeColor === 'string' ? controls.singleStrokeColor : fallback.singleStrokeColor;
  return controls;
}

function normalizeBurstPreset(key, preset) {
  const source = preset && typeof preset === 'object' ? preset : {};
  return {
    presetKey: key,
    name: typeof source.name === 'string' && source.name.trim() ? source.name : key,
    controls: normalizePresetControls(source.controls)
  };
}

function normalizeBurstPresetLibrary(library) {
  if (!library || typeof library !== 'object') return {};
  const out = {};
  for (const [key, preset] of Object.entries(library)) {
    if (!String(key).trim()) continue;
    out[key] = normalizeBurstPreset(key, preset);
  }
  return out;
}

function ensureActivePreset() {
  const keys = Object.keys(state.presets).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (keys.length === 0) {
    state.presets[DEFAULT_BURST_PRESET_KEY] = createDefaultBurstPreset(DEFAULT_BURST_PRESET_KEY);
    state.activePresetKey = DEFAULT_BURST_PRESET_KEY;
    return;
  }
  if (!state.activePresetKey || !state.presets[state.activePresetKey]) {
    state.activePresetKey = keys[0];
  }
}

function activePreset() {
  return state.presets[state.activePresetKey] || null;
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function normalizeRanges() {
  const c = state.controls;
  if (c.speedMin > c.speedMax) c.speedMax = c.speedMin;
  if (c.decayMin > c.decayMax) c.decayMax = c.decayMin;
  if (c.lengthMin > c.lengthMax) c.lengthMax = c.lengthMin;
  if (c.thicknessMin > c.thicknessMax) c.thicknessMax = c.thicknessMin;
}

function syncActivePresetFromControls() {
  const preset = activePreset();
  if (!preset) return;
  preset.name = (el.burstPresetNameInput?.value || '').trim() || preset.name || preset.presetKey;
  preset.controls = { ...state.controls };
  state.presetDirty = true;
}

function applyActivePresetToControls() {
  const preset = activePreset();
  if (!preset) return;
  state.controls = normalizePresetControls(preset.controls);
  normalizeRanges();
}

function refreshPresetUi() {
  ensureActivePreset();
  if (!el.burstPresetSelect) return;
  const keys = Object.keys(state.presets).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  el.burstPresetSelect.innerHTML = '';
  for (const key of keys) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${key} · ${state.presets[key].name || key}`;
    el.burstPresetSelect.appendChild(option);
  }
  el.burstPresetSelect.value = state.activePresetKey;
  if (el.burstPresetKeyInput) el.burstPresetKeyInput.value = state.activePresetKey;
  const preset = activePreset();
  if (el.burstPresetNameInput) el.burstPresetNameInput.value = preset?.name || state.activePresetKey;
}

async function loadBurstPresets() {
  try {
    let data;
    try {
      const payload = await requestBurstPresetApi('GET');
      data = payload.data;
    } catch {
      const response = await fetch(`${BURST_PRESET_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    }
    state.presets = normalizeBurstPresetLibrary(data);
    ensureActivePreset();
    applyActivePresetToControls();
    refreshPresetUi();
    syncUiFromControls();
    state.presetDirty = false;
    const port = getResolvedDevServerPort();
    const hostLabel = port ? `127.0.0.1:${port}` : '本地文件';
    setStatus(`爆炸胶囊预设已读取，共 ${Object.keys(state.presets).length} 个（${hostLabel}）。`);
  } catch (error) {
    setStatus(`读取爆炸胶囊预设失败：${String(error)}`, true);
  }
}

async function saveBurstPresets() {
  try {
    syncActivePresetFromControls();
    const payload = normalizeBurstPresetLibrary(state.presets);
    const response = await requestBurstPresetApi('PUT', payload);
    state.presetDirty = false;
    setStatus(`爆炸胶囊预设保存成功：${response.path || 'config/burstCapsulePresets.json'}`);
  } catch (error) {
    setStatus(`保存爆炸胶囊预设失败：${String(error)}`, true);
  }
}

function spawnBurst(x, y) {
  normalizeRanges();
  burstCapsuleEffect.play({
    x,
    y,
    preset: {
      controls: state.controls
    }
  });
}

function updateLabel(key, decimals) {
  const label = document.getElementById(`${key}Value`);
  if (!label) return;
  const value = state.controls[key];
  label.textContent = Number(value).toFixed(decimals);
}

function syncUiFromControls() {
  for (const [name, dec] of bindings) {
    const range = document.getElementById(name);
    if (range) range.value = String(state.controls[name]);
    updateLabel(name, dec);
  }
  const colorMode = document.getElementById('colorMode');
  if (colorMode) colorMode.value = state.controls.colorMode;
  const decayVisualMode = document.getElementById('decayVisualMode');
  if (decayVisualMode) decayVisualMode.value = state.controls.decayVisualMode;
  const singleMainColor = document.getElementById('singleMainColor');
  if (singleMainColor) singleMainColor.value = state.controls.singleMainColor;
  const singleStrokeColor = document.getElementById('singleStrokeColor');
  if (singleStrokeColor) singleStrokeColor.value = state.controls.singleStrokeColor;
}

function bindRangeControl(key, decimals) {
  const input = document.getElementById(key);
  if (!input) return;
  input.value = String(state.controls[key]);
  updateLabel(key, decimals);
  input.addEventListener('input', (event) => {
    const target = event.target;
    state.controls[key] = Number(target.value);
    normalizeRanges();
    for (const [name, dec] of bindings) {
      updateLabel(name, dec);
      const range = document.getElementById(name);
      if (range && range !== target) {
        range.value = String(state.controls[name]);
      }
    }
    syncActivePresetFromControls();
  });
}

function randomizeControls() {
  const c = state.controls;
  c.spawnCount = Math.round(randRange(18, 86));
  c.spawnJitter = randRange(0.02, 0.32);
  c.speedMin = randRange(8, 22);
  c.speedMax = randRange(Math.max(c.speedMin + 1, 18), 46);
  c.friction = randRange(0.885, 0.965);
  c.decayMin = randRange(0.01, 0.04);
  c.decayMax = randRange(Math.max(c.decayMin + 0.002, 0.02), 0.09);
  c.lengthMin = randRange(30, 90);
  c.lengthMax = randRange(Math.max(c.lengthMin + 8, 70), 190);
  c.thicknessMin = randRange(2, 6);
  c.thicknessMax = randRange(Math.max(c.thicknessMin + 0.2, 4), 12);
  c.outlineWidth = randRange(1, 5);
  c.trailAlpha = randRange(0.1, 1);
  c.shrinkPower = randRange(0.7, 3.3);
  normalizeRanges();
  syncUiFromControls();
  syncActivePresetFromControls();
}

function setupUi() {
  for (const [key, decimals] of bindings) {
    bindRangeControl(key, decimals);
  }

  const colorMode = document.getElementById('colorMode');
  colorMode.value = state.controls.colorMode;
  colorMode.addEventListener('change', (event) => {
    state.controls.colorMode = event.target.value;
    syncActivePresetFromControls();
  });

  const decayVisualMode = document.getElementById('decayVisualMode');
  decayVisualMode.value = state.controls.decayVisualMode;
  decayVisualMode.addEventListener('change', (event) => {
    state.controls.decayVisualMode = event.target.value;
    syncActivePresetFromControls();
  });

  const singleMainColor = document.getElementById('singleMainColor');
  singleMainColor.value = state.controls.singleMainColor;
  singleMainColor.addEventListener('input', (event) => {
    state.controls.singleMainColor = event.target.value;
    syncActivePresetFromControls();
  });

  const singleStrokeColor = document.getElementById('singleStrokeColor');
  singleStrokeColor.value = state.controls.singleStrokeColor;
  singleStrokeColor.addEventListener('input', (event) => {
    state.controls.singleStrokeColor = event.target.value;
    syncActivePresetFromControls();
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    burstCapsuleEffect.clear();
  });

  document.getElementById('burstCenterBtn').addEventListener('click', () => {
    spawnBurst(canvas.clientWidth * 0.5, canvas.clientHeight * 0.5);
  });

  document.getElementById('burstRingBtn').addEventListener('click', () => {
    const cx = canvas.clientWidth * 0.5;
    const cy = canvas.clientHeight * 0.5;
    const r = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.24;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      spawnBurst(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  });

  document.getElementById('randomizeBtn').addEventListener('click', randomizeControls);

  el.loadPresetBtn?.addEventListener('click', () => {
    void loadBurstPresets();
  });
  el.savePresetBtn?.addEventListener('click', () => {
    void saveBurstPresets();
  });
  el.burstPresetSelect?.addEventListener('change', () => {
    state.activePresetKey = el.burstPresetSelect.value;
    ensureActivePreset();
    applyActivePresetToControls();
    refreshPresetUi();
    syncUiFromControls();
    setStatus(`已切换爆炸胶囊预设：${state.activePresetKey}`);
  });
  el.burstPresetNameInput?.addEventListener('input', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.name = (el.burstPresetNameInput.value || '').trim() || preset.presetKey;
    state.presetDirty = true;
    refreshPresetUi();
  });
  el.renamePresetBtn?.addEventListener('click', () => {
    const fromKey = state.activePresetKey;
    const toKey = String(el.burstPresetKeyInput?.value || '').trim();
    if (!fromKey || !state.presets[fromKey]) return;
    if (!toKey) {
      setStatus('预设 Key 不能为空。', true);
      if (el.burstPresetKeyInput) el.burstPresetKeyInput.value = fromKey;
      return;
    }
    if (toKey === fromKey) return;
    if (state.presets[toKey]) {
      setStatus(`预设 Key 已存在：${toKey}`, true);
      if (el.burstPresetKeyInput) el.burstPresetKeyInput.value = fromKey;
      return;
    }
    const moved = state.presets[fromKey];
    delete state.presets[fromKey];
    state.presets[toKey] = { ...moved, presetKey: toKey };
    state.activePresetKey = toKey;
    state.presetDirty = true;
    refreshPresetUi();
    setStatus(`已修改预设 Key：${fromKey} -> ${toKey}`);
  });
  el.newPresetBtn?.addEventListener('click', () => {
    const key = (window.prompt('输入新的爆炸胶囊预设 Key（唯一）', 'burst_capsule_new') || '').trim();
    if (!key) return;
    if (state.presets[key]) {
      setStatus(`预设 Key 已存在：${key}`, true);
      return;
    }
    state.presets[key] = createDefaultBurstPreset(key);
    state.activePresetKey = key;
    state.presetDirty = true;
    applyActivePresetToControls();
    refreshPresetUi();
    syncUiFromControls();
    setStatus(`已新建爆炸胶囊预设：${key}`);
  });
  el.duplicatePresetBtn?.addEventListener('click', () => {
    const source = activePreset();
    if (!source) return;
    const key = (window.prompt('输入复制后的预设 Key（唯一）', `${state.activePresetKey}_copy`) || '').trim();
    if (!key) return;
    if (state.presets[key]) {
      setStatus(`预设 Key 已存在：${key}`, true);
      return;
    }
    state.presets[key] = normalizeBurstPreset(key, {
      ...source,
      presetKey: key,
      name: `${source.name} (copy)`
    });
    state.activePresetKey = key;
    state.presetDirty = true;
    applyActivePresetToControls();
    refreshPresetUi();
    syncUiFromControls();
    setStatus(`已复制爆炸胶囊预设：${key}`);
  });
  el.deletePresetBtn?.addEventListener('click', () => {
    const key = state.activePresetKey;
    if (!key || !state.presets[key]) return;
    if (!window.confirm(`确认删除爆炸胶囊预设：${key} ?`)) return;
    delete state.presets[key];
    ensureActivePreset();
    applyActivePresetToControls();
    refreshPresetUi();
    syncUiFromControls();
    state.presetDirty = true;
    setStatus('已删除当前爆炸胶囊预设。');
  });
}

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  spawnBurst(event.clientX - rect.left, event.clientY - rect.top);
});

async function boot() {
  state.presets = {
    [DEFAULT_BURST_PRESET_KEY]: createDefaultBurstPreset(DEFAULT_BURST_PRESET_KEY)
  };
  state.activePresetKey = DEFAULT_BURST_PRESET_KEY;
  ensureActivePreset();
  applyActivePresetToControls();
  refreshPresetUi();
  setupUi();
  syncUiFromControls();
  setStatus('就绪：点击画布触发爆发。');
  await loadBurstPresets();
}

window.addEventListener('beforeunload', () => {
  burstCapsuleEffect.dispose();
}, { once: true });

void boot();
