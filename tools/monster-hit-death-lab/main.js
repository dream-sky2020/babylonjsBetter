import { createCameraLabController } from '/core/camera/cameraLabController.ts';
import { createCameraLabScene } from '/core/scene/createCameraLabScene.ts';
import { createFloatingCameraControlPanel } from '/core/ui/FloatingCameraControlPanel.ts';
import { createPopNumberEffect } from '/core/effects/pop-number/index.ts';
import { createBurstCapsuleEffect } from '/core/effects/burst-capsule/index.ts';
import { Color3 } from '@babylonjs/core';
import {
  MONSTER_STRIPE_PRESET_URL,
  MONSTER_RENDER_ORDER,
  STRIPE_PRESET_URL,
  createLayeredMonster,
  normalizeMonsterConfigLibrary,
  normalizeMonsterStripePresetLibrary,
  normalizeStripePresetLibrary
} from '/core/monster/index.ts';

const MONSTER_DISPLAY_CONFIG_URL = '/config/monsterDisplayConfigs.json';
const POP_NUMBER_PRESET_URL = '/config/popNumberPresets.json';
const BURST_CAPSULE_PRESET_URL = '/config/burstCapsulePresets.json';
const EFFECT_COLORS = ['#38bdf8', '#4ade80', '#f43f5e', '#a855f7', '#f59e0b'];
const LAYER_SHAKE_PROFILES = {
  bottomFillMask: { amplitude: 0.42, phase: 0.15, vertical: 0.1 },
  bottomBorder: { amplitude: 0.68, phase: 1.35, vertical: 0.14 },
  body: { amplitude: 1, phase: 2.6, vertical: 0.18 },
  line: { amplitude: 1.28, phase: 4.05, vertical: 0.22 }
};

const stage = document.getElementById('stage');
const canvas = document.getElementById('preview');
const monsterConfigSelect = document.getElementById('monsterConfigSelect');
const monsterStripePresetSelect = document.getElementById('monsterStripePresetSelect');
const effectModeSelect = document.getElementById('effectModeSelect');
const popNumberPresetSelect = document.getElementById('popNumberPresetSelect');
const burstCapsulePresetSelect = document.getElementById('burstCapsulePresetSelect');
const popNumberEffectLayer = document.getElementById('popNumberEffectLayer');
const burstEffectCanvas = document.getElementById('burstEffectCanvas');
const hitDurationInput = document.getElementById('hitDurationInput');
const shakeAmplitudeInput = document.getElementById('shakeAmplitudeInput');
const shakeFrequencyInput = document.getElementById('shakeFrequencyInput');
const redStrengthInput = document.getElementById('redStrengthInput');
const hitColorInput = document.getElementById('hitColorInput');
const hitDurationValue = document.getElementById('hitDurationValue');
const shakeAmplitudeValue = document.getElementById('shakeAmplitudeValue');
const shakeFrequencyValue = document.getElementById('shakeFrequencyValue');
const redStrengthValue = document.getElementById('redStrengthValue');
const statusText = document.getElementById('statusText');

if (!(stage instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)
  || !(monsterConfigSelect instanceof HTMLSelectElement)
  || !(monsterStripePresetSelect instanceof HTMLSelectElement)
  || !(effectModeSelect instanceof HTMLSelectElement)
  || !(popNumberPresetSelect instanceof HTMLSelectElement)
  || !(burstCapsulePresetSelect instanceof HTMLSelectElement)
  || !(popNumberEffectLayer instanceof HTMLElement)
  || !(burstEffectCanvas instanceof HTMLCanvasElement)
  || !(hitDurationInput instanceof HTMLInputElement)
  || !(shakeAmplitudeInput instanceof HTMLInputElement)
  || !(shakeFrequencyInput instanceof HTMLInputElement)
  || !(redStrengthInput instanceof HTMLInputElement)
  || !(hitColorInput instanceof HTMLInputElement)
  || !(statusText instanceof HTMLElement)) {
  throw new Error('Monster Hit & Death Lab 初始化失败：页面元素不完整');
}

const context = createCameraLabScene(canvas);
const cameraController = createCameraLabController(context.camera);
const cameraPanel = createFloatingCameraControlPanel(stage, cameraController);
const monster = createLayeredMonster(context.scene, 'hitDeathMonster');
const popNumberEffect = createPopNumberEffect(popNumberEffectLayer);
const burstCapsuleEffect = createBurstCapsuleEffect(burstEffectCanvas);

const state = {
  monsterConfigs: {},
  monsterStripePresets: {},
  stripePresets: {},
  popNumberPresets: {},
  burstCapsulePresets: {},
  activeMonsterConfigId: '',
  activeMonsterStripePresetId: '',
  activePopNumberPresetId: '',
  activeBurstCapsulePresetId: '',
  elapsedSec: 0,
  hitStartedAtMs: -1
};

const setStatus = (message, isError = false) => {
  statusText.textContent = message;
  statusText.classList.toggle('error', isError);
};

const fetchJson = async (url) => {
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}：HTTP ${response.status}`);
  return response.json();
};

const fillSelect = (select, library) => {
  select.innerHTML = '';
  for (const [key, value] of Object.entries(library).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${value.name || value.id || key}（${key}）`;
    select.appendChild(option);
  }
};

const randomInt = (min, max) => Math.round(min + Math.random() * Math.max(0, max - min));

const readHitParameters = () => ({
  durationMs: Math.max(1, Number(hitDurationInput.value) || 360),
  shakeAmplitude: Math.max(0, Number(shakeAmplitudeInput.value) || 0),
  shakeFrequency: Math.max(0, Number(shakeFrequencyInput.value) || 0),
  redStrength: Math.max(0, Math.min(1, Number(redStrengthInput.value) || 0)),
  color: Color3.FromHexString(hitColorInput.value)
});

const refreshHitParameterLabels = () => {
  if (hitDurationValue) hitDurationValue.textContent = `${hitDurationInput.value} ms`;
  if (shakeAmplitudeValue) shakeAmplitudeValue.textContent = shakeAmplitudeInput.value;
  if (shakeFrequencyValue) shakeFrequencyValue.textContent = `${shakeFrequencyInput.value} Hz`;
  if (redStrengthValue) redStrengthValue.textContent = `${Math.round(Number(redStrengthInput.value) * 100)}%`;
};

const clearMonsterHitFeedback = () => {
  state.hitStartedAtMs = -1;
  monster.setEffectOffset(0, 0);
  monster.clearLayerEffectOffsets();
  monster.setColorOverlay(Color3.Red(), 0);
};

const startMonsterHitFeedback = () => {
  state.hitStartedAtMs = performance.now();
};

const updateMonsterHitFeedback = (nowMs) => {
  if (state.hitStartedAtMs < 0) return;
  const params = readHitParameters();
  const progress = Math.max(0, Math.min(1, (nowMs - state.hitStartedAtMs) / params.durationMs));
  if (progress >= 1) {
    clearMonsterHitFeedback();
    return;
  }
  const envelope = Math.pow(1 - progress, 1.35);
  const phase = progress * params.durationMs / 1000 * params.shakeFrequency * Math.PI * 2;
  const flashEnvelope = progress < 0.18 ? 1 : Math.pow(1 - (progress - 0.18) / 0.82, 1.6);
  for (const layerKey of MONSTER_RENDER_ORDER) {
    const profile = LAYER_SHAKE_PROFILES[layerKey];
    const layerPhase = phase + profile.phase;
    monster.setLayerEffectOffset(
      layerKey,
      Math.sin(layerPhase) * params.shakeAmplitude * profile.amplitude * envelope,
      Math.sin(layerPhase * 1.73 + 0.8) * params.shakeAmplitude * profile.vertical * envelope
    );
  }
  monster.setColorOverlay(params.color, params.redStrength * flashEnvelope);
};

const playEffectsAt = (x, y) => {
  startMonsterHitFeedback();
  const mode = effectModeSelect.value;
  if (mode === 'pop' || mode === 'both') {
    const preset = state.popNumberPresets[state.activePopNumberPresetId];
    if (preset) {
      const min = Number.isFinite(Number(preset.minValue)) ? Number(preset.minValue) : 1000;
      const max = Math.max(min, Number.isFinite(Number(preset.maxValue)) ? Number(preset.maxValue) : min);
      const value = preset.numberMode === 'fixed' ? preset.fixedValue : randomInt(min, max);
      popNumberEffect.play({
        value,
        x,
        y,
        color: EFFECT_COLORS[Math.floor(Math.random() * EFFECT_COLORS.length)],
        preset
      });
    }
  }
  if (mode === 'burst' || mode === 'both') {
    const preset = state.burstCapsulePresets[state.activeBurstCapsulePresetId];
    if (preset) burstCapsuleEffect.play({ x, y, preset });
  }
};

const renderSelectedMonster = () => {
  clearMonsterHitFeedback();
  const config = state.monsterConfigs[state.activeMonsterConfigId];
  const stripePreset = state.monsterStripePresets[state.activeMonsterStripePresetId] || null;
  if (!config) return;
  monster.load(config, stripePreset, state.stripePresets);
  const url = new URL(window.location.href);
  url.searchParams.set('monsterConfig', state.activeMonsterConfigId);
  if (state.activeMonsterStripePresetId) url.searchParams.set('monsterStripePreset', state.activeMonsterStripePresetId);
  window.history.replaceState(null, '', url);
  const finalScale = Math.max(0.01, config.scaleSize / 560) * Math.max(0.01, config.scene3dScale);
  setStatus(
    `正在显示：${config.name} / ${stripePreset?.name || '无条纹配置'}\n`
    + `已应用：X=${config.scene3dOffsetX}，Y=${config.scene3dHeight}，缩放=${finalScale.toFixed(3)}，面向=${config.spriteFacingAxis}`
  );
};

const selectMonsterConfig = (id) => {
  const config = state.monsterConfigs[id];
  if (!config) return;
  state.activeMonsterConfigId = id;
  monsterConfigSelect.value = id;
  renderSelectedMonster();
};

monsterConfigSelect.addEventListener('change', () => selectMonsterConfig(monsterConfigSelect.value));
monsterStripePresetSelect.addEventListener('change', () => {
  state.activeMonsterStripePresetId = monsterStripePresetSelect.value;
  renderSelectedMonster();
});
popNumberPresetSelect.addEventListener('change', () => {
  state.activePopNumberPresetId = popNumberPresetSelect.value;
});
burstCapsulePresetSelect.addEventListener('change', () => {
  state.activeBurstCapsulePresetId = burstCapsulePresetSelect.value;
});
[hitDurationInput, shakeAmplitudeInput, shakeFrequencyInput, redStrengthInput, hitColorInput]
  .forEach((input) => input.addEventListener('input', refreshHitParameterLabels));
refreshHitParameterLabels();

const drag = { active: false, pointerId: -1, x: 0, y: 0, startX: 0, startY: 0, moved: false };
const isTypingTarget = (target) => target instanceof HTMLElement
  && ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase());

const beginDrag = (event) => {
  drag.active = true;
  drag.pointerId = event.pointerId;
  drag.x = event.clientX;
  drag.y = event.clientY;
  drag.startX = event.clientX;
  drag.startY = event.clientY;
  drag.moved = false;
  canvas.style.cursor = 'grabbing';
  canvas.setPointerCapture(event.pointerId);
};

const endDrag = (event) => {
  if (!drag.active || event.pointerId !== drag.pointerId) return;
  drag.active = false;
  drag.pointerId = -1;
  canvas.style.cursor = 'grab';
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
};

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (cameraController.state.lookControlMode === 'pointerLock') {
    canvas.requestPointerLock?.();
    return;
  }
  beginDrag(event);
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag.active || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  drag.x = event.clientX;
  drag.y = event.clientY;
  drag.moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4;
  cameraController.handlePointerDelta(dx, dy);
  cameraPanel.syncFromController();
});
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('click', (event) => {
  if (drag.moved || document.pointerLockElement === canvas) return;
  const rect = canvas.getBoundingClientRect();
  playEffectsAt(event.clientX - rect.left, event.clientY - rect.top);
});
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === canvas) cameraController.handlePointerDelta(event.movementX || 0, event.movementY || 0);
});
document.addEventListener('pointerlockchange', () => {
  canvas.style.cursor = document.pointerLockElement === canvas ? 'none' : 'grab';
});
window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) return;
  if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) return;
  cameraController.keys.add(event.code);
  event.preventDefault();
});
window.addEventListener('keyup', (event) => cameraController.keys.delete(event.code));
canvas.addEventListener('wheel', (event) => {
  if (cameraController.state.mode !== 'orbit') return;
  event.preventDefault();
  cameraController.handleWheel(event.deltaY);
  cameraPanel.syncFromController();
}, { passive: false });
window.addEventListener('resize', () => context.engine.resize());

context.engine.runRenderLoop(() => {
  const dt = context.engine.getDeltaTime() / 1000;
  state.elapsedSec += dt;
  cameraController.update(dt);
  cameraPanel.updateStatus();
  monster.updateTime(state.elapsedSec);
  updateMonsterHitFeedback(performance.now());
  context.scene.render();
});

const boot = async () => {
  try {
    const [rawConfigs, rawMonsterStripePresets, rawStripePresets, rawPopNumberPresets, rawBurstCapsulePresets] = await Promise.all([
      fetchJson(MONSTER_DISPLAY_CONFIG_URL),
      fetchJson(MONSTER_STRIPE_PRESET_URL),
      fetchJson(STRIPE_PRESET_URL),
      fetchJson(POP_NUMBER_PRESET_URL),
      fetchJson(BURST_CAPSULE_PRESET_URL)
    ]);
    state.monsterConfigs = normalizeMonsterConfigLibrary(rawConfigs);
    state.monsterStripePresets = normalizeMonsterStripePresetLibrary(rawMonsterStripePresets);
    state.stripePresets = normalizeStripePresetLibrary(rawStripePresets);
    state.popNumberPresets = rawPopNumberPresets && typeof rawPopNumberPresets === 'object' ? rawPopNumberPresets : {};
    state.burstCapsulePresets = rawBurstCapsulePresets && typeof rawBurstCapsulePresets === 'object' ? rawBurstCapsulePresets : {};
    fillSelect(monsterConfigSelect, state.monsterConfigs);
    fillSelect(monsterStripePresetSelect, state.monsterStripePresets);
    fillSelect(popNumberPresetSelect, state.popNumberPresets);
    fillSelect(burstCapsulePresetSelect, state.burstCapsulePresets);

    const query = new URLSearchParams(window.location.search);
    const configKeys = Object.keys(state.monsterConfigs);
    const stripeKeys = Object.keys(state.monsterStripePresets);
    const popNumberKeys = Object.keys(state.popNumberPresets);
    const burstCapsuleKeys = Object.keys(state.burstCapsulePresets);
    const requestedConfig = query.get('monsterConfig') || '';
    const requestedStripe = query.get('monsterStripePreset') || '';
    state.activeMonsterStripePresetId = state.monsterStripePresets[requestedStripe] ? requestedStripe : stripeKeys[0] || '';
    monsterStripePresetSelect.value = state.activeMonsterStripePresetId;
    state.activePopNumberPresetId = popNumberKeys[0] || '';
    state.activeBurstCapsulePresetId = burstCapsuleKeys[0] || '';
    popNumberPresetSelect.value = state.activePopNumberPresetId;
    burstCapsulePresetSelect.value = state.activeBurstCapsulePresetId;
    monsterConfigSelect.disabled = configKeys.length === 0;
    monsterStripePresetSelect.disabled = stripeKeys.length === 0;
    popNumberPresetSelect.disabled = popNumberKeys.length === 0;
    burstCapsulePresetSelect.disabled = burstCapsuleKeys.length === 0;
    if (!configKeys.length) throw new Error('monsterDisplayConfigs 中没有可用配置');
    selectMonsterConfig(state.monsterConfigs[requestedConfig] ? requestedConfig : configKeys[0]);
  } catch (error) {
    setStatus(`读取配置失败：${error instanceof Error ? error.message : String(error)}`, true);
  }
};

window.addEventListener('beforeunload', () => {
  popNumberEffect.dispose();
  burstCapsuleEffect.dispose();
  monster.dispose();
  cameraPanel.dispose();
  context.dispose();
});

void boot();
