import { requestDevServer } from '/core/network/devServerPortResolver.ts';
import { loadConfigFromUrl } from '/core/config/index.ts';

const CONFIG_URL = '/config/stripePresets.json';
const API_PATH = '/api/stripe-presets';
const preferredPresetFromQuery = (new URLSearchParams(window.location.search).get('preset') || '').trim();

const el = {
  cardsGrid: document.getElementById('cardsGrid'),
  reloadBtn: document.getElementById('reloadBtn'),
  saveBtn: document.getElementById('saveBtn'),
  searchInput: document.getElementById('searchInput'),
  statusText: document.getElementById('statusText'),
  backToEditorBtn: document.getElementById('backToEditorBtn'),
  pendingList: document.getElementById('pendingList'),
  pendingOk: document.getElementById('pendingOk'),
  issuesList: document.getElementById('issuesList'),
  issuesOk: document.getElementById('issuesOk')
};

const state = {
  presets: {},
  filterText: '',
  cards: [],
  lastTimeSec: performance.now() / 1000,
  saving: false,
  dirty: false,
  baselinePresets: {}
};

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const setStatus = (message, isError = false) => {
  el.statusText.textContent = message;
  el.statusText.style.color = isError ? '#e07474' : '#9fb0c5';
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const setListItems = (listEl, values) => {
  if (!listEl) return;
  listEl.innerHTML = '';
  for (const text of values) {
    const li = document.createElement('li');
    li.textContent = text;
    listEl.appendChild(li);
  }
};

const buildPendingChanges = () => {
  const changes = [];
  const current = state.presets;
  const baseline = state.baselinePresets;
  const currentKeys = Object.keys(current);
  const baselineKeys = Object.keys(baseline);

  for (const key of currentKeys) {
    if (!baseline[key]) {
      changes.push(`新增：${key}`);
      continue;
    }
    const now = stableStringify(current[key]);
    const old = stableStringify(baseline[key]);
    if (now !== old) {
      changes.push(`修改：${key}`);
    }
  }

  for (const key of baselineKeys) {
    if (!current[key]) {
      changes.push(`删除：${key}`);
    }
  }

  return changes.sort((a, b) => a.localeCompare(b, 'zh-CN'));
};

const buildValidationIssues = () => {
  const issues = [];
  for (const [key, preset] of Object.entries(state.presets)) {
    if (!key.trim()) issues.push('存在空 presetKey');
    if (typeof preset.name !== 'string' || !preset.name.trim()) issues.push(`${key}: name 为空`);
    if (typeof preset.background !== 'string' || !preset.background.trim()) issues.push(`${key}: background 为空`);
    if (!Number.isFinite(Number(preset.angleDeg))) issues.push(`${key}: angleDeg 不是数字`);
    if (!Number.isFinite(Number(preset.speed))) issues.push(`${key}: speed 不是数字`);
    if (preset.mode !== 'solid' && preset.mode !== 'stripes') issues.push(`${key}: mode 非法`);
    if (preset.mode === 'solid') {
      if (typeof preset.solidColor !== 'string' || !preset.solidColor.trim()) issues.push(`${key}: solidColor 为空`);
      continue;
    }
    if (!Array.isArray(preset.segments) || preset.segments.length === 0) {
      issues.push(`${key}: segments 为空`);
      continue;
    }
    preset.segments.forEach((segment, idx) => {
      const prefix = `${key}.segments[${idx}]`;
      if (!Number.isFinite(Number(segment.width)) || Number(segment.width) <= 0) {
        issues.push(`${prefix}: width 必须大于 0`);
      }
      if (!segment.fillType || (segment.fillType !== 'solid' && segment.fillType !== 'gradient')) {
        issues.push(`${prefix}: fillType 非法`);
      } else if (segment.fillType === 'solid') {
        if (typeof segment.color !== 'string' || !segment.color.trim()) issues.push(`${prefix}: color 为空`);
      } else {
        if (typeof segment.fromColor !== 'string' || !segment.fromColor.trim()) issues.push(`${prefix}: fromColor 为空`);
        if (typeof segment.toColor !== 'string' || !segment.toColor.trim()) issues.push(`${prefix}: toColor 为空`);
      }
    });
  }
  return issues;
};

const refreshPreSavePanel = () => {
  const pending = buildPendingChanges();
  const issues = buildValidationIssues();
  setListItems(el.pendingList, pending);
  setListItems(el.issuesList, issues);
  if (el.pendingOk) el.pendingOk.style.display = pending.length === 0 ? 'block' : 'none';
  if (el.issuesOk) el.issuesOk.style.display = issues.length === 0 ? 'block' : 'none';
};

const setDirty = (dirty) => {
  state.dirty = dirty;
  if (el.saveBtn) {
    el.saveBtn.textContent = dirty ? '保存到服务器（有未保存改动）' : '保存到服务器';
  }
  refreshPreSavePanel();
};

const normalizePreset = (key, preset) => {
  const source = preset && typeof preset === 'object' ? preset : {};
  const segmentsRaw = Array.isArray(source.segments) ? source.segments : [];
  const segments = segmentsRaw
    .filter((seg) => seg && typeof seg === 'object')
    .map((seg) => {
      const fillType = seg.fillType === 'gradient' ? 'gradient' : 'solid';
      return {
        width: Math.max(0.01, toNumber(seg.width, 20)),
        fillType,
        color: typeof seg.color === 'string' ? seg.color : '#ffffff',
        fromColor: typeof seg.fromColor === 'string' ? seg.fromColor : '#ffffff',
        toColor: typeof seg.toColor === 'string' ? seg.toColor : '#000000',
        opacity: Math.max(0, Math.min(1, toNumber(seg.opacity, 1)))
      };
    });

  return {
    presetKey: key,
    name: typeof source.name === 'string' && source.name.trim() ? source.name : key,
    mode: source.mode === 'solid' ? 'solid' : 'stripes',
    solidColor: typeof source.solidColor === 'string' ? source.solidColor : '#ffffff',
    angleDeg: Math.max(-360, Math.min(360, toNumber(source.angleDeg, 45))),
    speed: Math.max(-5000, Math.min(5000, toNumber(source.speed, 90))),
    background: typeof source.background === 'string' ? source.background : '#000000',
    segments: segments.length > 0 ? segments : [{ width: 20, fillType: 'solid', color: '#ffffff', opacity: 1 }]
  };
};

const loadConfig = async () => {
  const data = await loadConfigFromUrl(CONFIG_URL);
  if (!data || typeof data !== 'object') {
    throw new Error('stripePresets.json 不是对象');
  }
  const normalized = {};
  for (const [key, preset] of Object.entries(data)) {
    if (!key.trim()) continue;
    normalized[key] = normalizePreset(key, preset);
  }
  return normalized;
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

const savePresetsToServer = async () => {
  const response = await requestDevServer(API_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state.presets)
  });
  const payload = await parseJsonPayload(response);
  if (!response.ok || payload.success === false) {
    const detail = Array.isArray(payload.errors) && payload.errors.length > 0 ? `：${payload.errors[0]}` : '';
    throw new Error(`${payload.message || `HTTP ${response.status}`}${detail}`);
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
    ctx.globalAlpha = seg.opacity;
    if (seg.fillType === 'gradient') {
      const grad = ctx.createLinearGradient(cursor, 0, cursor + w, 0);
      grad.addColorStop(0, seg.fromColor);
      grad.addColorStop(1, seg.toColor);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = seg.color;
    }
    ctx.fillRect(cursor, 0, w, off.height);
    cursor += w;
  }
  ctx.globalAlpha = 1;
  return { image: off, period: Math.max(1, cursor) };
};

const goEditor = (presetKey) => {
  const query = presetKey ? `?preset=${encodeURIComponent(presetKey)}` : '';
  window.location.href = `./index.html${query}`;
};

const renderCards = () => {
  const filter = state.filterText.trim().toLowerCase();
  const entries = Object.entries(state.presets)
    .filter(([key, preset]) => {
      if (!filter) return true;
      return key.toLowerCase().includes(filter) || String(preset.name || '').toLowerCase().includes(filter);
    })
    .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));

  el.cardsGrid.innerHTML = '';
  state.cards = [];

  if (entries.length === 0) {
    const div = document.createElement('div');
    div.className = 'empty';
    div.textContent = '没有匹配到任何条纹预设。';
    el.cardsGrid.appendChild(div);
    refreshPreSavePanel();
    return;
  }

  for (const [key, preset] of entries) {
    const card = document.createElement('article');
    card.className = 'card';
    card.tabIndex = 0;
    card.innerHTML = `
      <canvas class="card-canvas"></canvas>
      <div class="card-id">${key}</div>
      <div class="card-name">${preset.name || key}</div>
      <div class="rename-row">
        <input class="rename-input" value="${key}" data-role="rename-input" />
        <button class="rename-btn" data-role="rename-btn">确认改ID</button>
      </div>
      <div class="rename-row">
        <input class="rename-input" value="${preset.name || ''}" data-role="name-input" />
        <button class="rename-btn" data-role="name-btn">确认改名</button>
      </div>
      <div class="action-row">
        <button class="rename-btn" data-role="copy-btn">复制预设</button>
        <button class="rename-btn btn warn" data-role="delete-btn">删除预设</button>
      </div>
    `;
    card.addEventListener('click', () => goEditor(key));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goEditor(key);
      }
    });
    const renameInput = card.querySelector('[data-role="rename-input"]');
    const renameBtn = card.querySelector('[data-role="rename-btn"]');
    const nameInput = card.querySelector('[data-role="name-input"]');
    const nameBtn = card.querySelector('[data-role="name-btn"]');
    const copyBtn = card.querySelector('[data-role="copy-btn"]');
    const deleteBtn = card.querySelector('[data-role="delete-btn"]');
    const doRename = async () => {
      if (state.saving) return;
      const fromKey = key;
      const toKey = String(renameInput?.value || '').trim();
      if (!toKey) {
        setStatus('presetKey 不能为空', true);
        if (renameInput) renameInput.value = fromKey;
        return;
      }
      if (toKey === fromKey) {
        setStatus('presetKey 未变化');
        return;
      }
      if (state.presets[toKey]) {
        setStatus(`重名错误：presetKey 已存在（${toKey}）`, true);
        if (renameInput) renameInput.value = fromKey;
        return;
      }
      const moved = state.presets[fromKey];
      if (!moved) return;
      delete state.presets[fromKey];
      state.presets[toKey] = { ...moved, presetKey: toKey };
      setDirty(true);
      renderCards();
      setStatus(`已修改 presetKey：${fromKey} -> ${toKey}（待保存）`);
    };
    const doRenameName = () => {
      const target = state.presets[key];
      if (!target) return;
      const nextName = String(nameInput?.value || '').trim();
      if (!nextName) {
        setStatus('名称不能为空', true);
        if (nameInput) nameInput.value = target.name || key;
        return;
      }
      if (nextName === (target.name || '')) {
        setStatus('名称未变化');
        return;
      }
      target.name = nextName;
      setDirty(true);
      renderCards();
      setStatus(`已修改名称：${key} -> ${nextName}（待保存）`);
    };
    const doCopy = () => {
      const source = state.presets[key];
      if (!source) return;
      const nextKey = (window.prompt('输入复制后的 presetKey（唯一）', `${key}_copy`) || '').trim();
      if (!nextKey) return;
      if (state.presets[nextKey]) {
        setStatus(`重名错误：presetKey 已存在（${nextKey}）`, true);
        return;
      }
      const cloned = JSON.parse(JSON.stringify(source));
      cloned.presetKey = nextKey;
      cloned.name = `${source.name || key} (copy)`;
      state.presets[nextKey] = normalizePreset(nextKey, cloned);
      setDirty(true);
      renderCards();
      setStatus(`已复制预设：${key} -> ${nextKey}（待保存）`);
    };
    const doDelete = () => {
      if (!state.presets[key]) return;
      if (!window.confirm(`确认删除预设：${key} ?`)) return;
      delete state.presets[key];
      setDirty(true);
      renderCards();
      setStatus(`已删除预设：${key}（待保存）`);
    };
    renameInput?.addEventListener('click', (event) => event.stopPropagation());
    nameInput?.addEventListener('click', (event) => event.stopPropagation());
    renameInput?.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        void doRename();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.currentTarget.value = key;
      }
    });
    nameInput?.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        doRenameName();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        const current = state.presets[key];
        event.currentTarget.value = current?.name || '';
      }
    });
    renameBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      void doRename();
    });
    nameBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      doRenameName();
    });
    copyBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      doCopy();
    });
    deleteBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      doDelete();
    });
    el.cardsGrid.appendChild(card);

    const canvas = card.querySelector('canvas');
    state.cards.push({
      key,
      preset,
      canvas,
      phase: 0,
      pattern: buildPatternCanvas(preset)
    });
  }
  refreshPreSavePanel();
};

const resizeCardCanvas = (canvas) => {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * ratio));
  const h = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
};

const renderFrame = (dt) => {
  for (const item of state.cards) {
    resizeCardCanvas(item.canvas);
    const { canvas, preset, pattern } = item;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    if (preset.mode === 'solid') {
      ctx.fillStyle = preset.solidColor || '#ffffff';
      ctx.fillRect(0, 0, w, h);
      continue;
    }
    const diag = Math.ceil(Math.sqrt(w * w + h * h));
    item.phase += preset.speed * dt;
    const shift = ((item.phase % pattern.period) + pattern.period) % pattern.period;

    ctx.fillStyle = preset.background || '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((preset.angleDeg * Math.PI) / 180);
    for (let x = -diag - pattern.period * 2; x < diag + pattern.period * 2; x += pattern.period) {
      ctx.drawImage(pattern.image, x - shift, -diag, pattern.period, diag * 2);
    }
    ctx.restore();
  }
};

const tick = () => {
  const nowSec = performance.now() / 1000;
  const dt = Math.max(0, nowSec - state.lastTimeSec);
  state.lastTimeSec = nowSec;
  renderFrame(dt);
  requestAnimationFrame(tick);
};

const reload = async () => {
  if (state.dirty) {
    const confirmed = window.confirm('当前有未保存改动，重载将丢失这些改动。是否继续？');
    if (!confirmed) return;
  }
  setStatus('正在加载条纹配置...');
  try {
    state.presets = await loadConfig();
    state.baselinePresets = deepClone(state.presets);
    setDirty(false);
    renderCards();
    const total = Object.keys(state.presets).length;
    setStatus(`加载完成，共 ${total} 个预设。点击卡片进入编辑器。`);
  } catch (error) {
    setStatus(`加载失败：${String(error)}`, true);
  }
};

const bindEvents = () => {
  el.reloadBtn.addEventListener('click', () => {
    void reload();
  });

  el.searchInput.addEventListener('input', () => {
    state.filterText = el.searchInput.value;
    renderCards();
  });

  el.saveBtn.addEventListener('click', async () => {
    if (state.saving) return;
    if (!state.dirty) {
      setStatus('没有待保存改动');
      return;
    }
    state.saving = true;
    setStatus('正在保存到服务器...');
    try {
      await savePresetsToServer();
      state.saving = false;
      state.baselinePresets = deepClone(state.presets);
      setDirty(false);
      setStatus('保存成功：已写入 config/stripePresets.json');
    } catch (error) {
      state.saving = false;
      setStatus(`保存失败：${String(error)}`, true);
    }
  });

  el.backToEditorBtn.addEventListener('click', (event) => {
    event.preventDefault();
    const key = preferredPresetFromQuery || '';
    goEditor(key);
  });
};

const boot = async () => {
  bindEvents();
  window.addEventListener('resize', () => renderCards());
  await reload();
  setDirty(false);
  if (preferredPresetFromQuery) {
    el.searchInput.value = preferredPresetFromQuery;
    state.filterText = preferredPresetFromQuery;
    renderCards();
  }
  requestAnimationFrame(tick);
};

void boot();
