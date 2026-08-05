import {
  ArcRotateCamera,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  Vector3
} from '@babylonjs/core';
import {
  createStripeShaderMaterial
} from '/core/sprite/render/createStripeMaskMaterial.ts';
import {
  getResolvedDevServerPort,
  probeDevServerConnection,
  requestDevServer
} from '/core/network/devServerPortResolver.ts';

const API_PATH = '/api/stripe-presets';
const preferredPresetFromQuery = (new URLSearchParams(window.location.search).get('preset') || '').trim();
const state = {
  presets: {},
  activeKey: '',
  lastTimeSec: performance.now() / 1000,
  phase: 0,
  presetKeyDraft: '',
  previewMode: 'canvas2d',
  progress: {
    mode: 'none',
    value: 0.6,
    startAngleDeg: 0,
    filled: { source: 'texture', color: '#ffffff', opacity: 1 },
    unfilled: { source: 'color', color: '#101827', opacity: 0.25 }
  },
  progressScope: 'composite',
  layerProgress: {
    stripe: {
      mode: 'left-to-right', value: 0.7, startAngleDeg: 0,
      filled: { source: 'texture', color: '#ffffff', opacity: 1 },
      unfilled: { source: 'texture', color: '#5b6472', opacity: 0.2 }
    },
    background: {
      mode: 'sector-clockwise', value: 0.4, startAngleDeg: 0,
      filled: { source: 'texture', color: '#18253a', opacity: 1 },
      unfilled: { source: 'texture', color: '#05070b', opacity: 0.15 }
    }
  },
  babylon: {
    engine: null,
    scene: null,
    camera: null,
    plane: null,
    stripeController: null,
    timeSec: 0
  }
};

const el = {
  presetSelect: document.getElementById('presetSelect'),
  previewModeSelect: document.getElementById('previewModeSelect'),
  newPresetBtn: document.getElementById('newPresetBtn'),
  duplicatePresetBtn: document.getElementById('duplicatePresetBtn'),
  deletePresetBtn: document.getElementById('deletePresetBtn'),
  reloadBtn: document.getElementById('reloadBtn'),
  presetKeyInput: document.getElementById('presetKeyInput'),
  renamePresetBtn: document.getElementById('renamePresetBtn'),
  openGalleryBtn: document.getElementById('openGalleryBtn'),
  nameInput: document.getElementById('nameInput'),
  angleInput: document.getElementById('angleInput'),
  speedInput: document.getElementById('speedInput'),
  backgroundInput: document.getElementById('backgroundInput'),
  backgroundOpacityInput: document.getElementById('backgroundOpacityInput'),
  modeInput: document.getElementById('modeInput'),
  solidColorRow: document.getElementById('solidColorRow'),
  solidColorInput: document.getElementById('solidColorInput'),
  solidOpacityRow: document.getElementById('solidOpacityRow'),
  solidOpacityInput: document.getElementById('solidOpacityInput'),
  segmentsBox: document.getElementById('segmentsBox'),
  addSegmentBtn: document.getElementById('addSegmentBtn'),
  progressScopeInput: document.getElementById('progressScopeInput'),
  compositeProgressControls: document.getElementById('compositeProgressControls'),
  layerProgressControls: document.getElementById('layerProgressControls'),
  progressModeInput: document.getElementById('progressModeInput'),
  progressValueInput: document.getElementById('progressValueInput'),
  progressValueLabel: document.getElementById('progressValueLabel'),
  progressStartAngleRow: document.getElementById('progressStartAngleRow'),
  progressStartAngleInput: document.getElementById('progressStartAngleInput'),
  progressFilledSourceInput: document.getElementById('progressFilledSourceInput'),
  progressFilledColorInput: document.getElementById('progressFilledColorInput'),
  progressFilledOpacityInput: document.getElementById('progressFilledOpacityInput'),
  progressUnfilledSourceInput: document.getElementById('progressUnfilledSourceInput'),
  progressUnfilledColorInput: document.getElementById('progressUnfilledColorInput'),
  progressUnfilledOpacityInput: document.getElementById('progressUnfilledOpacityInput'),
  stripeProgressModeInput: document.getElementById('stripeProgressModeInput'),
  stripeProgressValueInput: document.getElementById('stripeProgressValueInput'),
  stripeProgressValueLabel: document.getElementById('stripeProgressValueLabel'),
  stripeProgressStartAngleRow: document.getElementById('stripeProgressStartAngleRow'),
  stripeProgressStartAngleInput: document.getElementById('stripeProgressStartAngleInput'),
  stripeProgressFilledSourceInput: document.getElementById('stripeProgressFilledSourceInput'),
  stripeProgressFilledColorInput: document.getElementById('stripeProgressFilledColorInput'),
  stripeProgressFilledOpacityInput: document.getElementById('stripeProgressFilledOpacityInput'),
  stripeProgressUnfilledSourceInput: document.getElementById('stripeProgressUnfilledSourceInput'),
  stripeProgressUnfilledColorInput: document.getElementById('stripeProgressUnfilledColorInput'),
  stripeProgressUnfilledOpacityInput: document.getElementById('stripeProgressUnfilledOpacityInput'),
  backgroundProgressModeInput: document.getElementById('backgroundProgressModeInput'),
  backgroundProgressValueInput: document.getElementById('backgroundProgressValueInput'),
  backgroundProgressValueLabel: document.getElementById('backgroundProgressValueLabel'),
  backgroundProgressStartAngleRow: document.getElementById('backgroundProgressStartAngleRow'),
  backgroundProgressStartAngleInput: document.getElementById('backgroundProgressStartAngleInput'),
  backgroundProgressFilledSourceInput: document.getElementById('backgroundProgressFilledSourceInput'),
  backgroundProgressFilledColorInput: document.getElementById('backgroundProgressFilledColorInput'),
  backgroundProgressFilledOpacityInput: document.getElementById('backgroundProgressFilledOpacityInput'),
  backgroundProgressUnfilledSourceInput: document.getElementById('backgroundProgressUnfilledSourceInput'),
  backgroundProgressUnfilledColorInput: document.getElementById('backgroundProgressUnfilledColorInput'),
  backgroundProgressUnfilledOpacityInput: document.getElementById('backgroundProgressUnfilledOpacityInput'),
  saveBtn: document.getElementById('saveBtn'),
  statusText: document.getElementById('statusText'),
  jsonView: document.getElementById('jsonView'),
  preview: document.getElementById('preview'),
  babylonPreview: document.getElementById('babylonPreview')
};

const createDefaultPreset = (key) => ({
  presetKey: key,
  name: key,
  mode: 'stripes',
  solidColor: '#ffffff',
  solidOpacity: 1,
  angleDeg: 45,
  speed: 90,
  background: '#000000',
  backgroundOpacity: 1,
  segments: [
    { width: 28, fillType: 'solid', color: '#111827', opacity: 1 },
    { width: 28, fillType: 'solid', color: '#89c2ff', opacity: 1 }
  ]
});

const createDefaultSegment = () => ({
  width: 24,
  fillType: 'solid',
  color: '#ffffff',
  opacity: 1
});

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const activePreset = () => state.presets[state.activeKey] || null;

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

const requestApi = async (method, body) => {
  const response = await requestDevServer(method === 'GET' ? `${API_PATH}?t=${Date.now()}` : API_PATH, {
    method,
    headers: method === 'PUT' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'PUT' ? JSON.stringify(body) : undefined
  });
  const payload = await parseJsonPayload(response);
  if (!response.ok || payload.success === false) {
    const detail = Array.isArray(payload.errors) && payload.errors.length > 0 ? `：${payload.errors[0]}` : '';
    throw new Error(`${payload.message || `HTTP ${response.status}`}${detail}`);
  }
  return payload;
};

const normalizePreset = (key, preset) => {
  const source = preset && typeof preset === 'object' ? preset : {};
  const segmentsRaw = Array.isArray(source.segments) ? source.segments : [];
  const segments = segmentsRaw
    .filter((seg) => seg && typeof seg === 'object')
    .map((seg) => {
      const fillType = seg.fillType === 'gradient' ? 'gradient' : 'solid';
      const normalized = {
        width: Math.max(0.01, toNumber(seg.width, 20)),
        fillType,
        opacity: Math.max(0, Math.min(1, toNumber(seg.opacity, 1)))
      };
      if (fillType === 'gradient') {
        normalized.fromColor = typeof seg.fromColor === 'string' ? seg.fromColor : '#ffffff';
        normalized.toColor = typeof seg.toColor === 'string' ? seg.toColor : '#000000';
      } else {
        normalized.color = typeof seg.color === 'string' ? seg.color : '#ffffff';
      }
      return normalized;
    });
  if (segments.length === 0) {
    segments.push(createDefaultSegment());
  }
  return {
    presetKey: key,
    name: typeof source.name === 'string' && source.name.trim() ? source.name : key,
    mode: source.mode === 'solid' ? 'solid' : 'stripes',
    solidColor: typeof source.solidColor === 'string' ? source.solidColor : '#ffffff',
    solidOpacity: Math.max(0, Math.min(1, toNumber(source.solidOpacity, 1))),
    angleDeg: Math.max(-360, Math.min(360, toNumber(source.angleDeg, 45))),
    speed: Math.max(-5000, Math.min(5000, toNumber(source.speed, 90))),
    background: typeof source.background === 'string' ? source.background : '#000000',
    backgroundOpacity: Math.max(0, Math.min(1, toNumber(source.backgroundOpacity, 1))),
    segments
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

const refreshPresetSelect = () => {
  const keys = Object.keys(state.presets).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (keys.length === 0) {
    const fallbackKey = 'default';
    state.presets[fallbackKey] = createDefaultPreset(fallbackKey);
    state.activeKey = fallbackKey;
  } else if (!state.activeKey || !state.presets[state.activeKey]) {
    state.activeKey = keys[0];
  }

  el.presetSelect.innerHTML = '';
  const sorted = Object.keys(state.presets).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  for (const key of sorted) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${key} · ${state.presets[key].name || ''}`;
    el.presetSelect.appendChild(option);
  }
  el.presetSelect.value = state.activeKey;
};

const refreshForm = () => {
  const preset = activePreset();
  if (!preset) return;
  state.presetKeyDraft = state.activeKey;
  if (el.presetKeyInput) {
    el.presetKeyInput.value = state.presetKeyDraft;
  }
  el.nameInput.value = preset.name || '';
  el.angleInput.value = String(preset.angleDeg);
  el.speedInput.value = String(preset.speed);
  el.backgroundInput.value = preset.background || '#000000';
  if (el.backgroundOpacityInput) {
    el.backgroundOpacityInput.value = String(preset.backgroundOpacity ?? 1);
  }
  if (el.modeInput) {
    el.modeInput.value = preset.mode === 'solid' ? 'solid' : 'stripes';
  }
  if (el.solidColorInput) {
    el.solidColorInput.value = preset.solidColor || '#ffffff';
  }
  if (el.solidOpacityInput) {
    el.solidOpacityInput.value = String(preset.solidOpacity ?? 1);
  }
  if (el.solidColorRow) {
    el.solidColorRow.style.display = preset.mode === 'solid' ? 'block' : 'none';
  }
  if (el.solidOpacityRow) {
    el.solidOpacityRow.style.display = preset.mode === 'solid' ? 'block' : 'none';
  }
  if (el.addSegmentBtn) {
    el.addSegmentBtn.style.display = preset.mode === 'solid' ? 'none' : 'block';
  }
  renderSegmentsEditor();
  refreshJsonView();
};

const renameActivePresetKey = () => {
  const fromKey = state.activeKey;
  const toKey = (el.presetKeyInput?.value || '').trim();
  if (!fromKey || !state.presets[fromKey]) {
    setStatus('当前没有可修改的预设', true);
    return;
  }
  if (!toKey) {
    setStatus('presetKey 不能为空', true);
    if (el.presetKeyInput) el.presetKeyInput.value = fromKey;
    return;
  }
  if (toKey === fromKey) {
    setStatus('presetKey 未变化');
    return;
  }
  if (state.presets[toKey]) {
    setStatus(`重名错误：presetKey 已存在（${toKey}）`, true);
    if (el.presetKeyInput) el.presetKeyInput.value = fromKey;
    return;
  }

  const moved = state.presets[fromKey];
  delete state.presets[fromKey];
  state.presets[toKey] = {
    ...moved,
    presetKey: toKey
  };
  state.activeKey = toKey;
  state.presetKeyDraft = toKey;
  refreshPresetSelect();
  refreshForm();
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('preset', toKey);
  window.history.replaceState(null, '', nextUrl.toString());
  setStatus(`已修改 presetKey：${fromKey} -> ${toKey}`);
};

const refreshJsonView = () => {
  el.jsonView.value = JSON.stringify(state.presets, null, 2);
};

const renderSegmentsEditor = () => {
  const preset = activePreset();
  if (!preset) return;
  if (preset.mode === 'solid') {
    el.segmentsBox.innerHTML = '<div class="label">纯色模式下不使用条纹段（segments）。</div>';
    return;
  }

  el.segmentsBox.innerHTML = '';
  preset.segments.forEach((segment, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'segment';
    wrap.innerHTML = `
      <div class="label">段 #${index + 1}</div>
      <div class="segment-grid">
        <div>
          <div class="label">宽度 width</div>
          <input data-role="width" data-index="${index}" type="number" min="0.01" step="0.1" value="${segment.width}">
        </div>
        <div>
          <div class="label">类型 fillType</div>
          <select data-role="fillType" data-index="${index}">
            <option value="solid" ${segment.fillType === 'solid' ? 'selected' : ''}>solid</option>
            <option value="gradient" ${segment.fillType === 'gradient' ? 'selected' : ''}>gradient</option>
          </select>
        </div>
      </div>
      <div class="segment-grid-3" style="margin-top:8px">
        <div>
          <div class="label">opacity</div>
          <input data-role="opacity" data-index="${index}" type="number" min="0" max="1" step="0.05" value="${segment.opacity ?? 1}">
        </div>
        <div>
          <div class="label">${segment.fillType === 'gradient' ? 'fromColor' : 'color'}</div>
          <input data-role="colorA" data-index="${index}" type="color" value="${segment.fillType === 'gradient' ? segment.fromColor : segment.color}">
        </div>
        <div>
          <div class="label">${segment.fillType === 'gradient' ? 'toColor' : '（solid无第二色）'}</div>
          <input data-role="colorB" data-index="${index}" type="color" value="${segment.fillType === 'gradient' ? segment.toColor : '#000000'}" ${segment.fillType === 'solid' ? 'disabled' : ''}>
        </div>
      </div>
      <button data-role="remove" data-index="${index}" class="warn" style="margin-top:8px">删除该段</button>
    `;
    el.segmentsBox.appendChild(wrap);
  });
};

const bindFormEvents = () => {
  const progressModeOptions = el.progressModeInput?.innerHTML || '';
  if (el.stripeProgressModeInput) {
    el.stripeProgressModeInput.innerHTML = progressModeOptions;
    el.stripeProgressModeInput.value = state.layerProgress.stripe.mode;
  }
  if (el.backgroundProgressModeInput) {
    el.backgroundProgressModeInput.innerHTML = progressModeOptions;
    el.backgroundProgressModeInput.value = state.layerProgress.background.mode;
  }

  const updateLayerProgressPart = (prefix, progress) => {
    const modeInput = el[`${prefix}ProgressModeInput`];
    const valueInput = el[`${prefix}ProgressValueInput`];
    const startAngleInput = el[`${prefix}ProgressStartAngleInput`];
    const valueLabel = el[`${prefix}ProgressValueLabel`];
    const startAngleRow = el[`${prefix}ProgressStartAngleRow`];
    progress.mode = modeInput?.value || 'none';
    progress.value = Math.max(0, Math.min(1, toNumber(valueInput?.value, progress.value)));
    progress.startAngleDeg = Math.max(-360, Math.min(360, toNumber(startAngleInput?.value, progress.startAngleDeg)));
    progress.filled.source = el[`${prefix}ProgressFilledSourceInput`]?.value === 'color' ? 'color' : 'texture';
    progress.filled.color = el[`${prefix}ProgressFilledColorInput`]?.value || '#ffffff';
    progress.filled.opacity = Math.max(0, Math.min(1, toNumber(el[`${prefix}ProgressFilledOpacityInput`]?.value, progress.filled.opacity)));
    progress.unfilled.source = el[`${prefix}ProgressUnfilledSourceInput`]?.value === 'color' ? 'color' : 'texture';
    progress.unfilled.color = el[`${prefix}ProgressUnfilledColorInput`]?.value || '#000000';
    progress.unfilled.opacity = Math.max(0, Math.min(1, toNumber(el[`${prefix}ProgressUnfilledOpacityInput`]?.value, progress.unfilled.opacity)));
    if (valueLabel) valueLabel.textContent = `${Math.round(progress.value * 100)}%`;
    if (startAngleRow) startAngleRow.style.display = progress.mode.startsWith('sector-') ? 'block' : 'none';
  };

  const updateLayerProgressForm = () => {
    state.progressScope = el.progressScopeInput?.value === 'layers' ? 'layers' : 'composite';
    if (el.compositeProgressControls) el.compositeProgressControls.style.display = state.progressScope === 'composite' ? 'block' : 'none';
    if (el.layerProgressControls) el.layerProgressControls.style.display = state.progressScope === 'layers' ? 'block' : 'none';
    updateLayerProgressPart('stripe', state.layerProgress.stripe);
    updateLayerProgressPart('background', state.layerProgress.background);
  };

  const layerProgressInputs = [
    el.progressScopeInput,
    ...['stripe', 'background'].flatMap((prefix) => [
      el[`${prefix}ProgressModeInput`], el[`${prefix}ProgressValueInput`], el[`${prefix}ProgressStartAngleInput`],
      el[`${prefix}ProgressFilledSourceInput`], el[`${prefix}ProgressFilledColorInput`], el[`${prefix}ProgressFilledOpacityInput`],
      el[`${prefix}ProgressUnfilledSourceInput`], el[`${prefix}ProgressUnfilledColorInput`], el[`${prefix}ProgressUnfilledOpacityInput`]
    ])
  ];
  layerProgressInputs.forEach((input) => input?.addEventListener('input', updateLayerProgressForm));
  updateLayerProgressForm();

  const updateProgressForm = () => {
    const progress = state.progress;
    progress.mode = el.progressModeInput?.value || 'none';
    progress.value = Math.max(0, Math.min(1, toNumber(el.progressValueInput?.value, progress.value)));
    progress.startAngleDeg = Math.max(-360, Math.min(360, toNumber(el.progressStartAngleInput?.value, progress.startAngleDeg)));
    progress.filled.source = el.progressFilledSourceInput?.value === 'color' ? 'color' : 'texture';
    progress.filled.color = el.progressFilledColorInput?.value || '#ffffff';
    progress.filled.opacity = Math.max(0, Math.min(1, toNumber(el.progressFilledOpacityInput?.value, progress.filled.opacity)));
    progress.unfilled.source = el.progressUnfilledSourceInput?.value === 'color' ? 'color' : 'texture';
    progress.unfilled.color = el.progressUnfilledColorInput?.value || '#101827';
    progress.unfilled.opacity = Math.max(0, Math.min(1, toNumber(el.progressUnfilledOpacityInput?.value, progress.unfilled.opacity)));
    if (el.progressValueLabel) el.progressValueLabel.textContent = `${Math.round(progress.value * 100)}%`;
    if (el.progressStartAngleRow) el.progressStartAngleRow.style.display = progress.mode.startsWith('sector-') ? 'block' : 'none';
  };

  [
    el.progressModeInput,
    el.progressValueInput,
    el.progressStartAngleInput,
    el.progressFilledSourceInput,
    el.progressFilledColorInput,
    el.progressFilledOpacityInput,
    el.progressUnfilledSourceInput,
    el.progressUnfilledColorInput,
    el.progressUnfilledOpacityInput
  ].forEach((input) => input?.addEventListener('input', updateProgressForm));
  updateProgressForm();

  el.previewModeSelect?.addEventListener('change', () => {
    state.previewMode = el.previewModeSelect.value === 'babylon' ? 'babylon' : 'canvas2d';
    updatePreviewVisibility();
    setStatus(state.previewMode === 'babylon' ? '已切换到 Babylon.js shader 预览。' : '已切换到 Canvas 2D 参考预览。');
  });

  el.presetSelect.addEventListener('change', () => {
    state.activeKey = el.presetSelect.value;
    refreshPresetSelect();
    refreshForm();
    setStatus(`已切换预设：${state.activeKey}`);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('preset', state.activeKey);
    window.history.replaceState(null, '', nextUrl.toString());
  });

  el.renamePresetBtn?.addEventListener('click', () => {
    renameActivePresetKey();
  });

  el.presetKeyInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      renameActivePresetKey();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.currentTarget.value = state.activeKey;
    }
  });

  el.openGalleryBtn?.addEventListener('click', () => {
    window.location.href = './gallery.html';
  });

  el.nameInput.addEventListener('input', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.name = el.nameInput.value;
    refreshPresetSelect();
    refreshJsonView();
  });

  el.angleInput.addEventListener('input', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.angleDeg = Math.max(-360, Math.min(360, toNumber(el.angleInput.value, preset.angleDeg)));
    refreshJsonView();
  });

  el.speedInput.addEventListener('input', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.speed = Math.max(-5000, Math.min(5000, toNumber(el.speedInput.value, preset.speed)));
    refreshJsonView();
  });

  el.backgroundInput.addEventListener('input', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.background = el.backgroundInput.value;
    refreshJsonView();
  });
  el.backgroundOpacityInput?.addEventListener('input', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.backgroundOpacity = Math.max(0, Math.min(1, toNumber(el.backgroundOpacityInput.value, preset.backgroundOpacity ?? 1)));
    refreshJsonView();
  });

  el.modeInput?.addEventListener('change', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.mode = el.modeInput.value === 'solid' ? 'solid' : 'stripes';
    if (el.solidColorRow) {
      el.solidColorRow.style.display = preset.mode === 'solid' ? 'block' : 'none';
    }
    if (el.solidOpacityRow) {
      el.solidOpacityRow.style.display = preset.mode === 'solid' ? 'block' : 'none';
    }
    if (el.addSegmentBtn) {
      el.addSegmentBtn.style.display = preset.mode === 'solid' ? 'none' : 'block';
    }
    renderSegmentsEditor();
    refreshJsonView();
  });

  el.solidColorInput?.addEventListener('input', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.solidColor = el.solidColorInput.value;
    refreshJsonView();
  });
  el.solidOpacityInput?.addEventListener('input', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.solidOpacity = Math.max(0, Math.min(1, toNumber(el.solidOpacityInput.value, preset.solidOpacity ?? 1)));
    refreshJsonView();
  });

  el.segmentsBox.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const role = target.getAttribute('data-role');
    const idxRaw = target.getAttribute('data-index');
    if (!role || idxRaw == null) return;
    const index = Number(idxRaw);
    const preset = activePreset();
    if (!preset) return;
    const segment = preset.segments[index];
    if (!segment) return;

    if (role === 'width') {
      segment.width = Math.max(0.01, toNumber(target.value, segment.width));
    } else if (role === 'fillType') {
      const fillType = target.value === 'gradient' ? 'gradient' : 'solid';
      segment.fillType = fillType;
      if (fillType === 'gradient') {
        segment.fromColor = segment.fromColor || segment.color || '#ffffff';
        segment.toColor = segment.toColor || '#000000';
        delete segment.color;
      } else {
        segment.color = segment.color || segment.fromColor || '#ffffff';
        delete segment.fromColor;
        delete segment.toColor;
      }
      renderSegmentsEditor();
    } else if (role === 'opacity') {
      segment.opacity = Math.max(0, Math.min(1, toNumber(target.value, segment.opacity ?? 1)));
    } else if (role === 'colorA') {
      if (segment.fillType === 'gradient') segment.fromColor = target.value;
      else segment.color = target.value;
    } else if (role === 'colorB') {
      if (segment.fillType === 'gradient') segment.toColor = target.value;
    }
    refreshJsonView();
  });

  el.segmentsBox.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const role = target.getAttribute('data-role');
    const idxRaw = target.getAttribute('data-index');
    if (role !== 'remove' || idxRaw == null) return;
    const index = Number(idxRaw);
    const preset = activePreset();
    if (!preset) return;
    if (preset.segments.length <= 1) {
      setStatus('至少保留 1 段条纹', true);
      return;
    }
    preset.segments.splice(index, 1);
    renderSegmentsEditor();
    refreshJsonView();
  });

  el.addSegmentBtn.addEventListener('click', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.segments.push(createDefaultSegment());
    renderSegmentsEditor();
    refreshJsonView();
  });

  el.newPresetBtn.addEventListener('click', () => {
    const key = (window.prompt('输入新的 presetKey（唯一）', 'monster_blessing_new') || '').trim();
    if (!key) return;
    if (state.presets[key]) {
      setStatus(`presetKey 已存在：${key}`, true);
      return;
    }
    state.presets[key] = createDefaultPreset(key);
    state.activeKey = key;
    refreshPresetSelect();
    refreshForm();
    setStatus(`已创建预设：${key}`);
  });

  el.duplicatePresetBtn.addEventListener('click', () => {
    const source = activePreset();
    if (!source) return;
    const key = (window.prompt('输入复制后的 presetKey（唯一）', `${state.activeKey}_copy`) || '').trim();
    if (!key) return;
    if (state.presets[key]) {
      setStatus(`presetKey 已存在：${key}`, true);
      return;
    }
    const cloned = JSON.parse(JSON.stringify(source));
    cloned.presetKey = key;
    cloned.name = `${source.name} (copy)`;
    state.presets[key] = normalizePreset(key, cloned);
    state.activeKey = key;
    refreshPresetSelect();
    refreshForm();
    setStatus(`已复制为：${key}`);
  });

  el.deletePresetBtn.addEventListener('click', () => {
    if (!state.activeKey || !state.presets[state.activeKey]) return;
    if (!window.confirm(`确认删除预设：${state.activeKey} ?`)) return;
    delete state.presets[state.activeKey];
    const keys = Object.keys(state.presets);
    state.activeKey = keys[0] || '';
    refreshPresetSelect();
    refreshForm();
    setStatus('已删除当前预设');
  });

  el.reloadBtn.addEventListener('click', () => {
    void loadFromServer();
  });

  el.saveBtn.addEventListener('click', () => {
    void saveToServer();
  });
};

const loadFromServer = async () => {
  setStatus('正在加载服务器配置...');
  try {
    const payload = await requestApi('GET');
    const data = normalizeLibrary(payload.data);
    state.presets = data;
    const keys = Object.keys(state.presets).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    if (preferredPresetFromQuery && state.presets[preferredPresetFromQuery]) {
      state.activeKey = preferredPresetFromQuery;
    } else {
      state.activeKey = keys[0] || '';
    }
    refreshPresetSelect();
    refreshForm();
    if (state.activeKey) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('preset', state.activeKey);
      window.history.replaceState(null, '', nextUrl.toString());
    }
    const valid = payload.valid !== false;
    const port = getResolvedDevServerPort();
    const hostLabel = port ? `127.0.0.1:${port}` : '未知端口';
    setStatus(valid ? `已从服务器加载配置（${hostLabel}）` : `配置已加载，但存在校验错误：${(payload.errors || []).join('；')}`, !valid);
  } catch (error) {
    setStatus(`加载失败：${String(error)}`, true);
  }
};

const saveToServer = async () => {
  setStatus('正在保存...');
  try {
    const payload = normalizeLibrary(state.presets);
    const data = await requestApi('PUT', payload);
    const port = getResolvedDevServerPort();
    const hostLabel = port ? `127.0.0.1:${port}` : '未知端口';
    setStatus(`保存成功：${data.path || 'config/stripePresets.json'}（${hostLabel}）`);
  } catch (error) {
    setStatus(`保存失败：${String(error)}`, true);
  }
};

const updatePreviewVisibility = () => {
  const isBabylon = state.previewMode === 'babylon';
  el.preview.style.display = isBabylon ? 'none' : 'block';
  el.babylonPreview.style.display = isBabylon ? 'block' : 'none';
  if (isBabylon) {
    initBabylonPreview();
    resizeBabylonPreview();
  } else {
    resizeCanvas();
  }
};

const resizeBabylonPreview = () => {
  const { engine, camera, plane, stripeController } = state.babylon;
  if (!engine || !camera || !plane || !stripeController) return;
  engine.resize();
  const width = Math.max(1, engine.getRenderWidth());
  const height = Math.max(1, engine.getRenderHeight());
  const aspect = width / height;
  const halfHeight = 3;
  const halfWidth = halfHeight * aspect;
  camera.orthoLeft = -halfWidth;
  camera.orthoRight = halfWidth;
  camera.orthoTop = halfHeight;
  camera.orthoBottom = -halfHeight;
  plane.scaling.set(halfWidth * 2, halfHeight * 2, 1);
  stripeController.updateRenderSize(width, height);
};

const initBabylonPreview = () => {
  if (state.babylon.engine) return;
  const engine = new Engine(el.babylonPreview, true, {
    preserveDrawingBuffer: true,
    stencil: true
  });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.02, 0.03, 0.05, 1);

  const camera = new ArcRotateCamera('stripesLabShaderCamera', -Math.PI / 2, Math.PI / 2, 10, Vector3.Zero(), scene);
  camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
  camera.inputs.clear();
  camera.setTarget(Vector3.Zero());

  const light = new HemisphericLight('stripesLabShaderLight', new Vector3(0, 1, 0), scene);
  light.intensity = 1;

  const plane = MeshBuilder.CreatePlane('stripesLabShaderPlane', { size: 1 }, scene);
  const stripeController = createStripeShaderMaterial(
    scene,
    'stripes_lab_shader_material',
    activePreset() || createDefaultPreset('preview'),
    {
      renderSizePx: {
        width: Math.max(1, engine.getRenderWidth()),
        height: Math.max(1, engine.getRenderHeight())
      }
    }
  );
  plane.material = stripeController.material;
  plane.isPickable = false;

  state.babylon.engine = engine;
  state.babylon.scene = scene;
  state.babylon.camera = camera;
  state.babylon.plane = plane;
  state.babylon.stripeController = stripeController;
  resizeBabylonPreview();
};

const renderBabylonPreview = (dt) => {
  initBabylonPreview();
  const preset = activePreset();
  const { engine, scene, stripeController } = state.babylon;
  if (!engine || !scene || !stripeController || !preset) return;
  resizeBabylonPreview();
  state.babylon.timeSec += dt;
  stripeController.updatePreset(preset);
  stripeController.updateProgress({
    enabled: state.progressScope === 'composite' && state.progress.mode !== 'none',
    ...state.progress
  });
  stripeController.updateLayerProgress({
    enabled: state.progressScope === 'layers',
    stripe: { enabled: state.layerProgress.stripe.mode !== 'none', ...state.layerProgress.stripe },
    background: { enabled: state.layerProgress.background.mode !== 'none', ...state.layerProgress.background }
  });
  stripeController.updateTime(state.babylon.timeSec);
  scene.render();
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
};

const buildPatternCanvas = (preset) => {
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
  return { patternCanvas: off, period: Math.max(1, cursor) };
};

const renderPreview = (dt) => {
  if (state.previewMode === 'babylon') {
    renderBabylonPreview(dt);
    return;
  }

  resizeCanvas();
  const preset = activePreset();
  const ctx = el.preview.getContext('2d');
  if (!preset) {
    ctx.clearRect(0, 0, el.preview.width, el.preview.height);
    return;
  }

  if (preset.mode === 'solid') {
    ctx.globalAlpha = Math.max(0, Math.min(1, toNumber(preset.solidOpacity, 1)));
    ctx.fillStyle = preset.solidColor || '#ffffff';
    ctx.fillRect(0, 0, el.preview.width, el.preview.height);
    ctx.globalAlpha = 1;
    return;
  }

  state.phase += toNumber(preset.speed, 0) * dt;
  const { patternCanvas, period } = buildPatternCanvas(preset);
  const shift = ((state.phase % period) + period) % period;
  const w = el.preview.width;
  const h = el.preview.height;
  const diag = Math.ceil(Math.sqrt(w * w + h * h));

  ctx.globalAlpha = Math.max(0, Math.min(1, toNumber(preset.backgroundOpacity, 1)));
  ctx.fillStyle = preset.background || '#000000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((toNumber(preset.angleDeg, 45) * Math.PI) / 180);

  for (let x = -diag - period * 2; x < diag + period * 2; x += period) {
    ctx.drawImage(patternCanvas, x - shift, -diag, period, diag * 2);
  }
  ctx.restore();
};

const tick = () => {
  const nowSec = performance.now() / 1000;
  const dt = Math.max(0, nowSec - state.lastTimeSec);
  state.lastTimeSec = nowSec;
  renderPreview(dt);
  requestAnimationFrame(tick);
};

const boot = async () => {
  bindFormEvents();
  window.addEventListener('resize', () => {
    if (state.previewMode === 'babylon') resizeBabylonPreview();
    else resizeCanvas();
  });
  updatePreviewVisibility();

  const connection = await probeDevServerConnection(API_PATH);
  if (!connection.connected) {
    setStatus('开发服务器未连接（请启动 python/server.py）', true);
  }

  await loadFromServer();
  resizeCanvas();
  requestAnimationFrame(tick);
};

void boot();
