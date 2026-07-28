const COLORS = ['#38bdf8', '#4ade80', '#f43f5e', '#a855f7', '#f59e0b'];

const state = {
  numberMode: 'range',
  minValue: 1000,
  maxValue: 9999,
  fixedValue: 7777,
  lifeMs: 800,
  enableGlow: true
};

const el = {
  stage: document.getElementById('stage'),
  status: document.getElementById('status'),
  numberMode: document.getElementById('numberMode'),
  rangeControls: document.getElementById('rangeControls'),
  fixedControls: document.getElementById('fixedControls'),
  minValue: document.getElementById('minValue'),
  maxValue: document.getElementById('maxValue'),
  fixedValue: document.getElementById('fixedValue'),
  lifeMs: document.getElementById('lifeMs'),
  lifeMsValue: document.getElementById('lifeMsValue'),
  enableGlow: document.getElementById('enableGlow'),
  spawnCenterBtn: document.getElementById('spawnCenterBtn'),
  clearBtn: document.getElementById('clearBtn')
};

const clampInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
};

const setStatus = (text, isError = false) => {
  el.status.textContent = text;
  el.status.style.color = isError ? '#fca5a5' : '#93c5fd';
};

const normalizeRange = () => {
  state.minValue = clampInt(state.minValue, 0);
  state.maxValue = clampInt(state.maxValue, state.minValue);
  if (state.minValue > state.maxValue) {
    state.maxValue = state.minValue;
  }
};

const updateUiFromState = () => {
  el.numberMode.value = state.numberMode;
  el.rangeControls.style.display = state.numberMode === 'range' ? 'flex' : 'none';
  el.fixedControls.style.display = state.numberMode === 'fixed' ? 'flex' : 'none';
  el.minValue.value = String(state.minValue);
  el.maxValue.value = String(state.maxValue);
  el.fixedValue.value = String(state.fixedValue);
  el.lifeMs.value = String(state.lifeMs);
  el.lifeMsValue.textContent = String(state.lifeMs);
  el.enableGlow.checked = state.enableGlow;
};

const getDisplayNumber = () => {
  if (state.numberMode === 'fixed') {
    return clampInt(state.fixedValue, 0);
  }
  normalizeRange();
  const span = state.maxValue - state.minValue + 1;
  return state.minValue + Math.floor(Math.random() * Math.max(1, span));
};

const spawnAt = (x, y) => {
  const box = document.createElement('div');
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  box.className = 'number-box';
  if (!state.enableGlow) {
    box.classList.add('no-glow');
  }
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  box.style.setProperty('--num-color', color);
  box.style.setProperty('--life-ms', `${state.lifeMs}ms`);
  box.textContent = String(getDisplayNumber());

  el.stage.appendChild(box);
  window.setTimeout(() => {
    box.remove();
  }, state.lifeMs + 50);
};

const clearAll = () => {
  const all = el.stage.querySelectorAll('.number-box');
  all.forEach((node) => node.remove());
};

const bindEvents = () => {
  el.numberMode.addEventListener('change', (event) => {
    state.numberMode = event.target.value === 'fixed' ? 'fixed' : 'range';
    updateUiFromState();
    setStatus(`已切换模式：${state.numberMode === 'fixed' ? '固定数值' : '随机范围'}`);
  });

  el.minValue.addEventListener('input', (event) => {
    state.minValue = clampInt(event.target.value, state.minValue);
    normalizeRange();
    updateUiFromState();
  });

  el.maxValue.addEventListener('input', (event) => {
    state.maxValue = clampInt(event.target.value, state.maxValue);
    normalizeRange();
    updateUiFromState();
  });

  el.fixedValue.addEventListener('input', (event) => {
    state.fixedValue = clampInt(event.target.value, state.fixedValue);
  });

  el.lifeMs.addEventListener('input', (event) => {
    state.lifeMs = clampInt(event.target.value, 800);
    updateUiFromState();
  });

  el.enableGlow.addEventListener('change', (event) => {
    state.enableGlow = Boolean(event.target.checked);
    setStatus(`发光：${state.enableGlow ? '开启' : '关闭'}`);
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

const boot = () => {
  normalizeRange();
  updateUiFromState();
  bindEvents();
  setStatus('就绪：点击右侧区域开始测试。');
};

boot();
