import {
  ArcRotateCamera,
  Engine,
  Scene,
  Vector3,
} from '@babylonjs/core';
import type { ISceneEnvironmentComponent } from '@/core/entity';
import { createCameraLabController } from '@/core/camera/cameraLabController';
import { createFloatingCameraControlPanel } from '@/core/ui/FloatingCameraControlPanel';
import {
  createSceneEnvironment,
  parseSceneEnvironmentPresetLibrary,
  parseShadowQualityPresetLibrary,
  resolveShadowQuality,
  type SceneEnvironmentInstance,
  type SceneEnvironmentPresetLibrary,
  type ShadowQualityPresetLibrary,
} from '@/core/scene';
import { loadConfig } from '@/core/config';

const requireElement = <T extends Element>(selector: string, constructor: { new(): T }): T => {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor)) throw new Error(`缺少页面元素：${selector}`);
  return element;
};

const canvas = requireElement('#preview', HTMLCanvasElement);
const stage = requireElement('#stage', HTMLElement);
const presetSelect = requireElement('#preset', HTMLSelectElement);
const loadButton = requireElement('#load', HTMLButtonElement);
const csmDebugToggle = requireElement('#csm-debug', HTMLInputElement);
const csmDebugHint = requireElement('#csm-debug-hint', HTMLDivElement);
const statusElement = requireElement('#status', HTMLDivElement);
const componentJson = requireElement('#component-json', HTMLPreElement);
const presetJson = requireElement('#preset-json', HTMLPreElement);

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
const babylonCamera = new ArcRotateCamera('sceneEnvironmentLabCamera', -Math.PI / 4, 1.05, 105, Vector3.Zero(), scene);
const cameraController = createCameraLabController(babylonCamera);
const cameraPanel = createFloatingCameraControlPanel(stage, cameraController);

const drag = { active: false, pointerId: -1, x: 0, y: 0 };
const pointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return;
  if (cameraController.state.lookControlMode === 'pointerLock') {
    void canvas.requestPointerLock?.();
    return;
  }
  drag.active = true;
  drag.pointerId = event.pointerId;
  drag.x = event.clientX;
  drag.y = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = 'grabbing';
};
const pointerMove = (event: PointerEvent) => {
  if (!drag.active || drag.pointerId !== event.pointerId) return;
  cameraController.handlePointerDelta(event.clientX - drag.x, event.clientY - drag.y);
  drag.x = event.clientX;
  drag.y = event.clientY;
  cameraPanel.syncFromController();
};
const pointerEnd = (event: PointerEvent) => {
  if (!drag.active || drag.pointerId !== event.pointerId) return;
  drag.active = false;
  drag.pointerId = -1;
  canvas.style.cursor = 'grab';
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
};
const lockedPointerMove = (event: MouseEvent) => {
  if (document.pointerLockElement === canvas) cameraController.handlePointerDelta(event.movementX, event.movementY);
};
const pointerLockChange = () => {
  canvas.style.cursor = document.pointerLockElement === canvas ? 'none' : 'grab';
};
const isTypingTarget = (target: EventTarget | null): boolean => (
  target instanceof HTMLInputElement
  || target instanceof HTMLSelectElement
  || target instanceof HTMLTextAreaElement
  || (target instanceof HTMLElement && target.isContentEditable)
);
const keyDown = (event: KeyboardEvent) => {
  if (isTypingTarget(event.target) || !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) return;
  cameraController.keys.add(event.code);
  event.preventDefault();
};
const keyUp = (event: KeyboardEvent) => cameraController.keys.delete(event.code);
const wheel = (event: WheelEvent) => {
  if (cameraController.state.mode !== 'orbit') return;
  event.preventDefault();
  cameraController.handleWheel(event.deltaY);
  cameraPanel.syncFromController();
};
const resize = () => engine.resize();

canvas.style.cursor = 'grab';
canvas.addEventListener('pointerdown', pointerDown);
canvas.addEventListener('pointermove', pointerMove);
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('wheel', wheel, { passive: false });
document.addEventListener('mousemove', lockedPointerMove);
document.addEventListener('pointerlockchange', pointerLockChange);
window.addEventListener('keydown', keyDown);
window.addEventListener('keyup', keyUp);
window.addEventListener('resize', resize);

let library: SceneEnvironmentPresetLibrary = {};
let shadowQualityLibrary: ShadowQualityPresetLibrary = {};
let currentInstance: SceneEnvironmentInstance | null = null;

const component: ISceneEnvironmentComponent = {
  id: 'scene-environment-lab-component',
  type: 'scene-environment',
  version: 1,
  enabled: true,
  presetKey: '',
};

const setStatus = (message: string, error = false) => {
  statusElement.textContent = message;
  statusElement.style.color = error ? '#ff9d9d' : '#8db6a5';
};

const fetchPresetLibraries = async (): Promise<{
  library: SceneEnvironmentPresetLibrary;
  shadowQualityLibrary: ShadowQualityPresetLibrary;
  source: string;
}> => {
  const selectData = (payload: unknown) => (payload as Record<string, unknown>).data;
  const [scenePresets, shadowPresets] = await Promise.all([
    loadConfig<unknown>('sceneEnvironmentPresets.json', {
      devApiPath: '/api/scene-environment-presets',
      selectDevPayload: selectData
    }),
    loadConfig<unknown>('shadowQualityPresets.json', {
      devApiPath: '/api/shadow-quality-presets',
      selectDevPayload: selectData
    })
  ]);
  return {
    library: parseSceneEnvironmentPresetLibrary(scenePresets),
    shadowQualityLibrary: parseShadowQualityPresetLibrary(shadowPresets),
    source: import.meta.env.DEV ? '统一配置入口（开发时优先 Python API）' : '应用内置配置'
  };
};

const loadByComponentPresetKey = () => {
  component.presetKey = presetSelect.value;
  componentJson.textContent = JSON.stringify(component, null, 2);
  const preset = library[component.presetKey];
  if (!preset) {
    setStatus(`找不到 presetKey：${component.presetKey}`, true);
    return;
  }
  currentInstance?.dispose();
  currentInstance = createSceneEnvironment(scene, preset, {
    shadowQualityPresets: shadowQualityLibrary,
    cascadedShadowDebug: csmDebugToggle.checked,
  });
  const referencedShadowPresets = Object.fromEntries(preset.lights.flatMap((light) => {
    if (!('shadow' in light) || !light.shadow) return [];
    const shadowPreset = shadowQualityLibrary[light.shadow.qualityPresetKey];
    return shadowPreset ? [[shadowPreset.presetKey, shadowPreset]] : [];
  }));
  presetJson.textContent = JSON.stringify({ scene: preset, shadowQualityPresets: referencedShadowPresets }, null, 2);
  const enabledShadowSettings = preset.lights.flatMap((light) => {
    if (!('shadow' in light) || !light.shadow) return [];
    const settings = resolveShadowQuality(light.shadow, shadowQualityLibrary);
    return settings.enabled ? [settings] : [];
  });
  const generatorLabels = enabledShadowSettings.map((settings) => (
    settings.generator.type === 'cascaded'
      ? `CSM ${settings.generator.cascadeCount ?? 4} 级联`
      : '标准阴影'
  ));
  const hasCascadedShadow = enabledShadowSettings.some((settings) => settings.generator.type === 'cascaded');
  csmDebugHint.textContent = hasCascadedShadow
    ? `当前场景包含 CSM；级联着色调试${csmDebugToggle.checked ? '已开启' : '未开启'}。`
    : '当前场景使用标准阴影，级联 Debug 不会产生效果。';
  setStatus(`已通过 presetKey “${component.presetKey}” 创建 ${preset.objects.length} 个几何体和 ${preset.lights.length} 个光源，其中 ${enabledShadowSettings.length} 个启用阴影（${generatorLabels.join('、')}）${hasCascadedShadow && csmDebugToggle.checked ? '；级联 Debug 已开启' : ''}。`);
};

loadButton.addEventListener('click', loadByComponentPresetKey);
csmDebugToggle.addEventListener('change', loadByComponentPresetKey);
presetSelect.addEventListener('change', () => {
  component.presetKey = presetSelect.value;
  componentJson.textContent = JSON.stringify(component, null, 2);
});

void fetchPresetLibraries().then((result) => {
  library = result.library;
  shadowQualityLibrary = result.shadowQualityLibrary;
  presetSelect.replaceChildren(...Object.values(library).map((preset) => {
    const option = document.createElement('option');
    option.value = preset.presetKey;
    option.textContent = `${preset.name} · ${preset.presetKey}`;
    return option;
  }));
  if (Object.keys(library).length === 0) {
    setStatus('配置中没有场景预设。', true);
    return;
  }
  loadByComponentPresetKey();
  setStatus(`${statusElement.textContent} 来源：${result.source}`);
}).catch((error: unknown) => setStatus(`加载失败：${error instanceof Error ? error.message : String(error)}`, true));

engine.runRenderLoop(() => {
  cameraController.update(engine.getDeltaTime() / 1000);
  cameraPanel.updateStatus();
  scene.render();
});

let disposed = false;
const dispose = () => {
  if (disposed) return;
  disposed = true;
  canvas.removeEventListener('pointerdown', pointerDown);
  canvas.removeEventListener('pointermove', pointerMove);
  canvas.removeEventListener('pointerup', pointerEnd);
  canvas.removeEventListener('pointercancel', pointerEnd);
  canvas.removeEventListener('wheel', wheel);
  document.removeEventListener('mousemove', lockedPointerMove);
  document.removeEventListener('pointerlockchange', pointerLockChange);
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  window.removeEventListener('resize', resize);
  currentInstance?.dispose();
  cameraPanel.dispose();
  scene.dispose();
  engine.dispose();
};
window.addEventListener('beforeunload', dispose, { once: true });
