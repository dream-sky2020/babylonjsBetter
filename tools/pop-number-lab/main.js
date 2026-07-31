import {
  getResolvedDevServerPort,
  requestDevServer
} from '/core/network/devServerPortResolver.ts';
import {
  createPopNumberEffect
} from '/core/effects/pop-number/index.ts';

const POP_NUMBER_PRESET_URL = '/config/popNumberPresets.json';
const POP_NUMBER_PRESET_API_PATH = '/api/pop-number-presets';
const DEFAULT_POP_PRESET_KEY = 'pop_default';
const COLORS = ['#38bdf8', '#4ade80', '#f43f5e', '#a855f7', '#f59e0b'];

const state = {
  activePresetKey: DEFAULT_POP_PRESET_KEY,
  presets: {},
  presetDirty: false,

  numberMode: 'range',
  popMode: 'float',

  minValue: 1000,
  maxValue: 9999,
  fixedValue: 7777,

  lifeMs: 800,
  enableGlow: true,

  directionMinDeg: -120,
  directionMaxDeg: -60,

  speedMin: 260,
  speedMax: 460,
  gravity: 900
};

const el = {
  stage: document.getElementById('stage'),
  status: document.getElementById('status'),
  loadPopPresetBtn: document.getElementById('loadPopPresetBtn'),
  savePopPresetBtn: document.getElementById('savePopPresetBtn'),
  popPresetSelect: document.getElementById('popPresetSelect'),
  popPresetKeyInput: document.getElementById('popPresetKeyInput'),
  popPresetNameInput: document.getElementById('popPresetNameInput'),
  renamePopPresetBtn: document.getElementById('renamePopPresetBtn'),
  newPopPresetBtn: document.getElementById('newPopPresetBtn'),
  duplicatePopPresetBtn: document.getElementById('duplicatePopPresetBtn'),
  deletePopPresetBtn: document.getElementById('deletePopPresetBtn'),
  numberMode: document.getElementById('numberMode'),
  popMode: document.getElementById('popMode'),
  rangeControls: document.getElementById('rangeControls'),
  fixedControls: document.getElementById('fixedControls'),
  projectileControls: document.getElementById('projectileControls'),
  minValue: document.getElementById('minValue'),
  maxValue: document.getElementById('maxValue'),
  fixedValue: document.getElementById('fixedValue'),
  lifeMs: document.getElementById('lifeMs'),
  lifeMsValue: document.getElementById('lifeMsValue'),
  enableGlow: document.getElementById('enableGlow'),
  directionMinDeg: document.getElementById('directionMinDeg'),
  directionMaxDeg: document.getElementById('directionMaxDeg'),
  speedMin: document.getElementById('speedMin'),
  speedMax: document.getElementById('speedMax'),
  gravity: document.getElementById('gravity'),
  directionRangeSector: document.getElementById('directionRangeSector'),
  directionRangeStart: document.getElementById('directionRangeStart'),
  directionRangeEnd: document.getElementById('directionRangeEnd'),
  directionRangeLabel: document.getElementById('directionRangeLabel'),
  spawnCenterBtn: document.getElementById('spawnCenterBtn'),
  clearBtn: document.getElementById('clearBtn')
};

if (!el.stage) {
  throw new Error('Pop Number Lab stage element not found');
}

const popNumberEffect = createPopNumberEffect(el.stage);

const clampInt = (value, fallback) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.round(parsed);
};

const setStatus = (text, isError = false) => {
  el.status.textContent = text;
  el.status.style.color = isError ? '#fca5a5' : '#93c5fd';
};

const parseJsonPayload = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`接口返回非 JSON 内容：${text.slice(0, 120)}`);
  }
};

const requestPopNumberPresetApi = async (method, body) => {
  const response = await requestDevServer(
    method === 'GET' ? `${POP_NUMBER_PRESET_API_PATH}?t=${Date.now()}` : POP_NUMBER_PRESET_API_PATH,
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

const createDefaultPopPreset = (key) => ({
  presetKey: key,
  name: key,
  numberMode: 'range',
  popMode: 'float',
  minValue: 1000,
  maxValue: 9999,
  fixedValue: 7777,
  lifeMs: 800,
  enableGlow: true,
  directionMinDeg: -120,
  directionMaxDeg: -60,
  speedMin: 260,
  speedMax: 460,
  gravity: 900
});

const normalizePopPreset = (key, preset) => {
  const fallback = createDefaultPopPreset(key);
  const source = preset && typeof preset === 'object' ? preset : {};
  const normalized = {
    ...fallback,
    ...source,
    presetKey: key,
    name: typeof source.name === 'string' && source.name.trim() ? source.name : key,
    numberMode: source.numberMode === 'fixed' ? 'fixed' : 'range',
    popMode: source.popMode === 'projectile' ? 'projectile' : 'float',
    minValue: clampInt(source.minValue, fallback.minValue),
    maxValue: clampInt(source.maxValue, fallback.maxValue),
    fixedValue: clampInt(source.fixedValue, fallback.fixedValue),
    lifeMs: Math.max(200, clampInt(source.lifeMs, fallback.lifeMs)),
    enableGlow: source.enableGlow !== false,
    directionMinDeg: Number.isFinite(Number(source.directionMinDeg)) ? Number(source.directionMinDeg) : fallback.directionMinDeg,
    directionMaxDeg: Number.isFinite(Number(source.directionMaxDeg)) ? Number(source.directionMaxDeg) : fallback.directionMaxDeg,
    speedMin: Math.max(0, Number.isFinite(Number(source.speedMin)) ? Number(source.speedMin) : fallback.speedMin),
    speedMax: Math.max(0, Number.isFinite(Number(source.speedMax)) ? Number(source.speedMax) : fallback.speedMax),
    gravity: Number.isFinite(Number(source.gravity)) ? Number(source.gravity) : fallback.gravity
  };
  if (normalized.minValue > normalized.maxValue) normalized.maxValue = normalized.minValue;
  if (normalized.directionMinDeg > normalized.directionMaxDeg) normalized.directionMaxDeg = normalized.directionMinDeg;
  if (normalized.speedMin > normalized.speedMax) normalized.speedMax = normalized.speedMin;
  return normalized;
};

const normalizePopPresetLibrary = (library) => {
  if (!library || typeof library !== 'object') return {};
  const out = {};
  for (const [key, preset] of Object.entries(library)) {
    if (!String(key).trim()) continue;
    out[key] = normalizePopPreset(key, preset);
  }
  return out;
};

const activePreset = () => state.presets[state.activePresetKey] || null;

const copyStateFromPreset = (preset) => {
  if (!preset) return;
  state.numberMode = preset.numberMode === 'fixed' ? 'fixed' : 'range';
  state.popMode = preset.popMode === 'projectile' ? 'projectile' : 'float';
  state.minValue = clampInt(preset.minValue, state.minValue);
  state.maxValue = clampInt(preset.maxValue, state.maxValue);
  state.fixedValue = clampInt(preset.fixedValue, state.fixedValue);
  state.lifeMs = Math.max(200, clampInt(preset.lifeMs, state.lifeMs));
  state.enableGlow = preset.enableGlow !== false;
  state.directionMinDeg = Number(preset.directionMinDeg);
  state.directionMaxDeg = Number(preset.directionMaxDeg);
  state.speedMin = Number(preset.speedMin);
  state.speedMax = Number(preset.speedMax);
  state.gravity = Number(preset.gravity);
  normalizeRange();
  normalizeProjectileRange();
};

const syncActivePresetFromState = () => {
  const preset = activePreset();
  if (!preset) return;
  preset.name = typeof el.popPresetNameInput.value === 'string' && el.popPresetNameInput.value.trim()
    ? el.popPresetNameInput.value.trim()
    : preset.name;
  preset.numberMode = state.numberMode;
  preset.popMode = state.popMode;
  preset.minValue = state.minValue;
  preset.maxValue = state.maxValue;
  preset.fixedValue = state.fixedValue;
  preset.lifeMs = state.lifeMs;
  preset.enableGlow = state.enableGlow;
  preset.directionMinDeg = state.directionMinDeg;
  preset.directionMaxDeg = state.directionMaxDeg;
  preset.speedMin = state.speedMin;
  preset.speedMax = state.speedMax;
  preset.gravity = state.gravity;
  state.presetDirty = true;
};

const ensureActivePreset = () => {
  const keys = Object.keys(state.presets).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (keys.length === 0) {
    state.presets[DEFAULT_POP_PRESET_KEY] = createDefaultPopPreset(DEFAULT_POP_PRESET_KEY);
    state.activePresetKey = DEFAULT_POP_PRESET_KEY;
    return;
  }
  if (!state.activePresetKey || !state.presets[state.activePresetKey]) {
    state.activePresetKey = keys[0];
  }
};

const refreshPresetSelect = () => {
  ensureActivePreset();
  const keys = Object.keys(state.presets).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  el.popPresetSelect.innerHTML = '';
  keys.forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${key} · ${state.presets[key].name || key}`;
    el.popPresetSelect.appendChild(option);
  });
  el.popPresetSelect.value = state.activePresetKey;
  el.popPresetKeyInput.value = state.activePresetKey;
  const preset = activePreset();
  el.popPresetNameInput.value = preset?.name || state.activePresetKey;
};

const normalizeRange = () => {
  state.minValue = clampInt(state.minValue, 0);
  state.maxValue = clampInt(state.maxValue, state.minValue);
  if (state.minValue > state.maxValue) {
    state.maxValue = state.minValue;
  }
};

const normalizeProjectileRange = () => {
  state.directionMinDeg = Number.isFinite(Number(state.directionMinDeg)) ? Number(state.directionMinDeg) : -120;
  state.directionMaxDeg = Number.isFinite(Number(state.directionMaxDeg)) ? Number(state.directionMaxDeg) : -60;
  if (state.directionMinDeg > state.directionMaxDeg) {
    state.directionMaxDeg = state.directionMinDeg;
  }

  state.speedMin = Math.max(0, Number.isFinite(Number(state.speedMin)) ? Number(state.speedMin) : 260);
  state.speedMax = Math.max(0, Number.isFinite(Number(state.speedMax)) ? Number(state.speedMax) : state.speedMin);
  if (state.speedMin > state.speedMax) {
    state.speedMax = state.speedMin;
  }

  state.gravity = Number.isFinite(Number(state.gravity)) ? Number(state.gravity) : 900;
};

const toNormDeg = (deg) => ((deg % 360) + 360) % 360;

const pointOnCircle = (cx, cy, r, deg) => {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + Math.cos(rad) * r,
    y: cy + Math.sin(rad) * r
  };
};

const updateDirectionPreview = () => {
  const cx = 100;
  const cy = 100;
  const r = 72;
  const rawStart = state.directionMinDeg;
  const rawSpan = Math.max(0, state.directionMaxDeg - state.directionMinDeg);
  const span = Math.min(360, rawSpan);
  const startDeg = toNormDeg(rawStart);
  const endDeg = startDeg + span;
  const startPoint = pointOnCircle(cx, cy, r, startDeg);
  const endPoint = pointOnCircle(cx, cy, r, endDeg);
  const largeArc = span > 180 ? 1 : 0;

  el.directionRangeStart.setAttribute('x1', String(cx));
  el.directionRangeStart.setAttribute('y1', String(cy));
  el.directionRangeStart.setAttribute('x2', startPoint.x.toFixed(2));
  el.directionRangeStart.setAttribute('y2', startPoint.y.toFixed(2));
  el.directionRangeEnd.setAttribute('x1', String(cx));
  el.directionRangeEnd.setAttribute('y1', String(cy));
  el.directionRangeEnd.setAttribute('x2', endPoint.x.toFixed(2));
  el.directionRangeEnd.setAttribute('y2', endPoint.y.toFixed(2));

  if (span <= 0.001) {
    el.directionRangeSector.setAttribute('d', '');
  } else if (span >= 359.999) {
    el.directionRangeSector.setAttribute(
      'd',
      [
        `M ${cx} ${cy}`,
        `m ${-r} 0`,
        `a ${r} ${r} 0 1 0 ${r * 2} 0`,
        `a ${r} ${r} 0 1 0 ${-r * 2} 0`,
        'Z'
      ].join(' ')
    );
  } else {
    el.directionRangeSector.setAttribute(
      'd',
      `M ${cx} ${cy} L ${startPoint.x.toFixed(2)} ${startPoint.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${endPoint.x.toFixed(2)} ${endPoint.y.toFixed(2)} Z`
    );
  }

  el.directionRangeLabel.textContent = `范围：${state.directionMinDeg.toFixed(0)}° ~ ${state.directionMaxDeg.toFixed(0)}°（扇形 ${span.toFixed(0)}°）`;
};

const updateUiFromState = () => {
  el.numberMode.value = state.numberMode;
  el.popMode.value = state.popMode;
  el.rangeControls.style.display = state.numberMode === 'range' ? 'flex' : 'none';
  el.fixedControls.style.display = state.numberMode === 'fixed' ? 'flex' : 'none';
  el.projectileControls.style.display = state.popMode === 'projectile' ? 'block' : 'none';
  el.minValue.value = String(state.minValue);
  el.maxValue.value = String(state.maxValue);
  el.fixedValue.value = String(state.fixedValue);
  el.lifeMs.value = String(state.lifeMs);
  el.lifeMsValue.textContent = String(state.lifeMs);
  el.enableGlow.checked = state.enableGlow;
  el.directionMinDeg.value = String(state.directionMinDeg);
  el.directionMaxDeg.value = String(state.directionMaxDeg);
  el.speedMin.value = String(state.speedMin);
  el.speedMax.value = String(state.speedMax);
  el.gravity.value = String(state.gravity);
  updateDirectionPreview();
};

const getDisplayNumber = () => {
  if (state.numberMode === 'fixed') {
    return clampInt(state.fixedValue, 0);
  }

  normalizeRange();

  const span = state.maxValue - state.minValue + 1;

  return (
      state.minValue +
      Math.floor(Math.random() * Math.max(1, span))
  );
};

const getCurrentEffectPreset = () => {
  normalizeProjectileRange();

  return {
    popMode: state.popMode,
    lifeMs: state.lifeMs,
    enableGlow: state.enableGlow,

    directionMinDeg: state.directionMinDeg,
    directionMaxDeg: state.directionMaxDeg,

    speedMin: state.speedMin,
    speedMax: state.speedMax,

    gravity: state.gravity
  };
};

const spawnAt = (x, y) => {
  const color =
      COLORS[Math.floor(Math.random() * COLORS.length)];

  popNumberEffect.play({
    value: getDisplayNumber(),
    x,
    y,
    color,
    preset: getCurrentEffectPreset()
  });
};

const clearAll = () => {
  popNumberEffect.clear();
};

const applyActivePresetToState = () => {
  const preset = activePreset();
  if (!preset) return;
  copyStateFromPreset(preset);
  updateUiFromState();
};

const loadPopPresets = async () => {
  try {
    let data;
    try {
      const payload = await requestPopNumberPresetApi('GET');
      data = payload.data;
    } catch {
      const response = await fetch(`${POP_NUMBER_PRESET_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    }
    state.presets = normalizePopPresetLibrary(data);
    ensureActivePreset();
    refreshPresetSelect();
    applyActivePresetToState();
    state.presetDirty = false;
    const port = getResolvedDevServerPort();
    const hostLabel = port ? `127.0.0.1:${port}` : '本地文件';
    setStatus(`弹出数字预设已读取，共 ${Object.keys(state.presets).length} 个（${hostLabel}）。`);
  } catch (error) {
    setStatus(`读取弹出数字预设失败：${String(error)}`, true);
  }
};

const savePopPresets = async () => {
  try {
    syncActivePresetFromState();
    const payload = normalizePopPresetLibrary(state.presets);
    const response = await requestPopNumberPresetApi('PUT', payload);
    state.presetDirty = false;
    setStatus(`弹出数字预设保存成功：${response.path || 'config/popNumberPresets.json'}`);
  } catch (error) {
    setStatus(`保存弹出数字预设失败：${String(error)}`, true);
  }
};

const bindEvents = () => {
  el.loadPopPresetBtn.addEventListener('click', () => {
    void loadPopPresets();
  });

  el.savePopPresetBtn.addEventListener('click', () => {
    void savePopPresets();
  });

  el.popPresetSelect.addEventListener('change', () => {
    state.activePresetKey = el.popPresetSelect.value;
    ensureActivePreset();
    refreshPresetSelect();
    applyActivePresetToState();
    setStatus(`已切换弹出数字预设：${state.activePresetKey}`);
  });

  el.popPresetNameInput.addEventListener('input', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.name = el.popPresetNameInput.value || preset.presetKey;
    state.presetDirty = true;
    refreshPresetSelect();
  });

  el.renamePopPresetBtn.addEventListener('click', () => {
    const fromKey = state.activePresetKey;
    const toKey = String(el.popPresetKeyInput.value || '').trim();
    if (!fromKey || !state.presets[fromKey]) return;
    if (!toKey) {
      setStatus('预设 Key 不能为空。', true);
      el.popPresetKeyInput.value = fromKey;
      return;
    }
    if (toKey === fromKey) return;
    if (state.presets[toKey]) {
      setStatus(`预设 Key 已存在：${toKey}`, true);
      el.popPresetKeyInput.value = fromKey;
      return;
    }
    const moved = state.presets[fromKey];
    delete state.presets[fromKey];
    state.presets[toKey] = { ...moved, presetKey: toKey };
    state.activePresetKey = toKey;
    state.presetDirty = true;
    refreshPresetSelect();
    setStatus(`已修改预设 Key：${fromKey} -> ${toKey}`);
  });

  el.newPopPresetBtn.addEventListener('click', () => {
    const key = (window.prompt('输入新的弹出数字预设 Key（唯一）', 'pop_new') || '').trim();
    if (!key) return;
    if (state.presets[key]) {
      setStatus(`预设 Key 已存在：${key}`, true);
      return;
    }
    state.presets[key] = createDefaultPopPreset(key);
    state.activePresetKey = key;
    state.presetDirty = true;
    refreshPresetSelect();
    applyActivePresetToState();
    setStatus(`已新建弹出数字预设：${key}`);
  });

  el.duplicatePopPresetBtn.addEventListener('click', () => {
    const source = activePreset();
    if (!source) return;
    const key = (window.prompt('输入复制后的预设 Key（唯一）', `${state.activePresetKey}_copy`) || '').trim();
    if (!key) return;
    if (state.presets[key]) {
      setStatus(`预设 Key 已存在：${key}`, true);
      return;
    }
    state.presets[key] = normalizePopPreset(key, { ...source, presetKey: key, name: `${source.name} (copy)` });
    state.activePresetKey = key;
    state.presetDirty = true;
    refreshPresetSelect();
    applyActivePresetToState();
    setStatus(`已复制预设：${key}`);
  });

  el.deletePopPresetBtn.addEventListener('click', () => {
    const key = state.activePresetKey;
    if (!key || !state.presets[key]) return;
    if (!window.confirm(`确认删除弹出数字预设：${key} ?`)) return;
    delete state.presets[key];
    ensureActivePreset();
    refreshPresetSelect();
    applyActivePresetToState();
    state.presetDirty = true;
    setStatus('已删除当前弹出数字预设。');
  });

  el.numberMode.addEventListener('change', (event) => {
    state.numberMode = event.target.value === 'fixed' ? 'fixed' : 'range';
    syncActivePresetFromState();
    updateUiFromState();
    setStatus(`已切换模式：${state.numberMode === 'fixed' ? '固定数值' : '随机范围'}`);
  });

  el.popMode.addEventListener('change', (event) => {
    state.popMode = event.target.value === 'projectile' ? 'projectile' : 'float';
    syncActivePresetFromState();
    updateUiFromState();
    setStatus(`已切换弹出模式：${state.popMode === 'projectile' ? '随机方向抛射' : '原始上浮'}`);
  });

  el.minValue.addEventListener('input', (event) => {
    state.minValue = clampInt(event.target.value, state.minValue);
    normalizeRange();
    syncActivePresetFromState();
    updateUiFromState();
  });

  el.maxValue.addEventListener('input', (event) => {
    state.maxValue = clampInt(event.target.value, state.maxValue);
    normalizeRange();
    syncActivePresetFromState();
    updateUiFromState();
  });

  el.fixedValue.addEventListener('input', (event) => {
    state.fixedValue = clampInt(event.target.value, state.fixedValue);
    syncActivePresetFromState();
  });

  el.lifeMs.addEventListener('input', (event) => {
    state.lifeMs = clampInt(event.target.value, 800);
    syncActivePresetFromState();
    updateUiFromState();
  });

  el.enableGlow.addEventListener('change', (event) => {
    state.enableGlow = Boolean(event.target.checked);
    syncActivePresetFromState();
    setStatus(`发光：${state.enableGlow ? '开启' : '关闭'}`);
  });

  el.directionMinDeg.addEventListener('input', (event) => {
    state.directionMinDeg = Number(event.target.value);
    normalizeProjectileRange();
    syncActivePresetFromState();
    updateUiFromState();
  });

  el.directionMaxDeg.addEventListener('input', (event) => {
    state.directionMaxDeg = Number(event.target.value);
    normalizeProjectileRange();
    syncActivePresetFromState();
    updateUiFromState();
  });

  el.speedMin.addEventListener('input', (event) => {
    state.speedMin = Number(event.target.value);
    normalizeProjectileRange();
    syncActivePresetFromState();
    updateUiFromState();
  });

  el.speedMax.addEventListener('input', (event) => {
    state.speedMax = Number(event.target.value);
    normalizeProjectileRange();
    syncActivePresetFromState();
    updateUiFromState();
  });

  el.gravity.addEventListener('input', (event) => {
    state.gravity = Number(event.target.value);
    normalizeProjectileRange();
    syncActivePresetFromState();
    updateUiFromState();
  });

  el.stage.addEventListener('click', (event) => {
    const rect = el.stage.getBoundingClientRect();
    spawnAt(event.clientX - rect.left, event.clientY - rect.top);
  });

  el.spawnCenterBtn.addEventListener('click', () => {
    spawnAt(el.stage.clientWidth * 0.5, el.stage.clientHeight * 0.5);
  });

  el.clearBtn.addEventListener('click', () => {
    clearAll();
    setStatus('已清空当前数字。');
  });
};

const boot = async () => {
  normalizeRange();
  normalizeProjectileRange();

  state.presets = {
    [DEFAULT_POP_PRESET_KEY]:
        createDefaultPopPreset(DEFAULT_POP_PRESET_KEY)
  };

  state.activePresetKey = DEFAULT_POP_PRESET_KEY;

  refreshPresetSelect();
  applyActivePresetToState();
  updateUiFromState();
  bindEvents();

  setStatus('就绪：点击右侧区域开始测试。');

  await loadPopPresets();
};

window.addEventListener(
    'beforeunload',
    () => {
      popNumberEffect.dispose();
    },
    { once: true }
);

void boot();
