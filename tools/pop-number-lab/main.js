const COLORS = ['#38bdf8', '#4ade80', '#f43f5e', '#a855f7', '#f59e0b'];

const state = {
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
  gravity: 900,
  projectiles: [],
  animFrameId: 0,
  lastFrameMs: 0
};

const el = {
  stage: document.getElementById('stage'),
  status: document.getElementById('status'),
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

const randRange = (min, max) => min + Math.random() * (max - min);
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
  box.textContent = String(getDisplayNumber());
  box.style.setProperty('--life-ms', `${state.lifeMs}ms`);

  el.stage.appendChild(box);
  if (state.popMode === 'projectile') {
    box.classList.add('projectile');
    normalizeProjectileRange();
    const deg = randRange(state.directionMinDeg, state.directionMaxDeg);
    const speed = randRange(state.speedMin, state.speedMax);
    const rad = (deg * Math.PI) / 180;
    state.projectiles.push({
      node: box,
      x,
      y,
      vx: Math.cos(rad) * speed,
      vy: Math.sin(rad) * speed,
      ageMs: 0
    });
    ensureProjectileLoop();
    return;
  }

  window.setTimeout(() => {
    box.remove();
  }, state.lifeMs + 50);
};

const clearAll = () => {
  state.projectiles.length = 0;
  state.lastFrameMs = 0;
  if (state.animFrameId) {
    cancelAnimationFrame(state.animFrameId);
    state.animFrameId = 0;
  }
  const all = el.stage.querySelectorAll('.number-box');
  all.forEach((node) => node.remove());
};

const tickProjectiles = (nowMs) => {
  if (state.projectiles.length === 0) {
    state.animFrameId = 0;
    state.lastFrameMs = 0;
    return;
  }

  if (state.lastFrameMs <= 0) {
    state.lastFrameMs = nowMs;
  }
  const dtSec = Math.max(0, Math.min(0.05, (nowMs - state.lastFrameMs) / 1000));
  state.lastFrameMs = nowMs;
  const width = el.stage.clientWidth;
  const height = el.stage.clientHeight;
  const margin = 120;

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const projectile = state.projectiles[i];
    projectile.ageMs += dtSec * 1000;
    projectile.vy += state.gravity * dtSec;
    projectile.x += projectile.vx * dtSec;
    projectile.y += projectile.vy * dtSec;

    const life = Math.max(0, 1 - projectile.ageMs / Math.max(1, state.lifeMs));
    projectile.node.style.left = `${projectile.x}px`;
    projectile.node.style.top = `${projectile.y}px`;
    projectile.node.style.opacity = life.toFixed(3);

    if (
      life <= 0 ||
      projectile.x < -margin ||
      projectile.x > width + margin ||
      projectile.y < -margin ||
      projectile.y > height + margin
    ) {
      projectile.node.remove();
      state.projectiles.splice(i, 1);
    }
  }

  state.animFrameId = requestAnimationFrame(tickProjectiles);
};

const ensureProjectileLoop = () => {
  if (state.animFrameId) return;
  state.lastFrameMs = 0;
  state.animFrameId = requestAnimationFrame(tickProjectiles);
};

const bindEvents = () => {
  el.numberMode.addEventListener('change', (event) => {
    state.numberMode = event.target.value === 'fixed' ? 'fixed' : 'range';
    updateUiFromState();
    setStatus(`已切换模式：${state.numberMode === 'fixed' ? '固定数值' : '随机范围'}`);
  });

  el.popMode.addEventListener('change', (event) => {
    state.popMode = event.target.value === 'projectile' ? 'projectile' : 'float';
    updateUiFromState();
    setStatus(`已切换弹出模式：${state.popMode === 'projectile' ? '随机方向抛射' : '原始上浮'}`);
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

  el.directionMinDeg.addEventListener('input', (event) => {
    state.directionMinDeg = Number(event.target.value);
    normalizeProjectileRange();
    updateUiFromState();
  });

  el.directionMaxDeg.addEventListener('input', (event) => {
    state.directionMaxDeg = Number(event.target.value);
    normalizeProjectileRange();
    updateUiFromState();
  });

  el.speedMin.addEventListener('input', (event) => {
    state.speedMin = Number(event.target.value);
    normalizeProjectileRange();
    updateUiFromState();
  });

  el.speedMax.addEventListener('input', (event) => {
    state.speedMax = Number(event.target.value);
    normalizeProjectileRange();
    updateUiFromState();
  });

  el.gravity.addEventListener('input', (event) => {
    state.gravity = Number(event.target.value);
    normalizeProjectileRange();
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

const boot = () => {
  normalizeRange();
  normalizeProjectileRange();
  updateUiFromState();
  bindEvents();
  setStatus('就绪：点击右侧区域开始测试。');
};

boot();
