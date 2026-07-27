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
  presetKeyDraft: ''
};

const el = {
  presetSelect: document.getElementById('presetSelect'),
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
  modeInput: document.getElementById('modeInput'),
  solidColorRow: document.getElementById('solidColorRow'),
  solidColorInput: document.getElementById('solidColorInput'),
  segmentsBox: document.getElementById('segmentsBox'),
  addSegmentBtn: document.getElementById('addSegmentBtn'),
  saveBtn: document.getElementById('saveBtn'),
  statusText: document.getElementById('statusText'),
  jsonView: document.getElementById('jsonView'),
  preview: document.getElementById('preview')
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
    angleDeg: Math.max(-360, Math.min(360, toNumber(source.angleDeg, 45))),
    speed: Math.max(-5000, Math.min(5000, toNumber(source.speed, 90))),
    background: typeof source.background === 'string' ? source.background : '#000000',
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
  if (el.modeInput) {
    el.modeInput.value = preset.mode === 'solid' ? 'solid' : 'stripes';
  }
  if (el.solidColorInput) {
    el.solidColorInput.value = preset.solidColor || '#ffffff';
  }
  if (el.solidColorRow) {
    el.solidColorRow.style.display = preset.mode === 'solid' ? 'block' : 'none';
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

  el.modeInput?.addEventListener('change', () => {
    const preset = activePreset();
    if (!preset) return;
    preset.mode = el.modeInput.value === 'solid' ? 'solid' : 'stripes';
    if (el.solidColorRow) {
      el.solidColorRow.style.display = preset.mode === 'solid' ? 'block' : 'none';
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
  resizeCanvas();
  const preset = activePreset();
  const ctx = el.preview.getContext('2d');
  if (!preset) {
    ctx.clearRect(0, 0, el.preview.width, el.preview.height);
    return;
  }

  if (preset.mode === 'solid') {
    ctx.fillStyle = preset.solidColor || '#ffffff';
    ctx.fillRect(0, 0, el.preview.width, el.preview.height);
    return;
  }

  state.phase += toNumber(preset.speed, 0) * dt;
  const { patternCanvas, period } = buildPatternCanvas(preset);
  const shift = ((state.phase % period) + period) % period;
  const w = el.preview.width;
  const h = el.preview.height;
  const diag = Math.ceil(Math.sqrt(w * w + h * h));

  ctx.fillStyle = preset.background || '#000000';
  ctx.fillRect(0, 0, w, h);
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
  window.addEventListener('resize', resizeCanvas);

  const connection = await probeDevServerConnection(API_PATH);
  if (!connection.connected) {
    setStatus('开发服务器未连接（请启动 python/server.py）', true);
  }

  await loadFromServer();
  resizeCanvas();
  requestAnimationFrame(tick);
};

void boot();
