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
  createSceneEnvironmentAsync,
  parseSceneEnvironmentPresetLibrary,
  parseShadowQualityPresetLibrary,
  resolveShadowQuality,
  type SceneEnvironmentInstance,
  type SceneEnvironmentPresetLibrary,
  type ShadowQualityPresetLibrary,
} from '@/core/scene';
import { loadConfig, downloadConfigJson } from '@/core/config';
import { SceneEditor, DocumentHistory } from '@/core/scene-editor';
import { createEnvironmentAdapter } from './sceneEnvironmentAdapter';
import { mountEnvironmentEditor } from './sceneEnvironmentEditorView';
import './scene-environment-editor.css';

const requireElement = <T extends Element>(selector: string, constructor: { new(): T }): T => {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor)) throw new Error(`缺少页面元素：${selector}`);
  return element;
};

const canvas = requireElement('#preview', HTMLCanvasElement);
const stage = requireElement('#stage', HTMLElement);
const presetSelect = requireElement('#preset', HTMLSelectElement);
const loadButton = requireElement('#load', HTMLButtonElement);
const currentSceneKeyInput = requireElement('#current-scene-key', HTMLInputElement);
const copySceneKeyButton = requireElement('#copy-scene-key', HTMLButtonElement);
const csmDebugToggle = requireElement('#csm-debug', HTMLInputElement);
const csmDebugHint = requireElement('#csm-debug-hint', HTMLDivElement);
const statusElement = requireElement('#status', HTMLDivElement);
const componentJson = requireElement('#component-json', HTMLPreElement);
const presetJson = requireElement('#preset-json', HTMLPreElement);

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
const babylonCamera = new ArcRotateCamera('sceneEnvironmentLabCamera', -Math.PI / 4, 1.05, 105, Vector3.Zero(), scene);
const cameraController = createCameraLabController(babylonCamera);
const cameraPanel = createFloatingCameraControlPanel(stage, cameraController, { initialCollapsed: true });
cameraPanel.element.style.top = "72px";
cameraPanel.element.style.borderRadius = "2px";
cameraPanel.element.style.background = "var(--panel)";

const drag = { active: false, pointerId: -1, x: 0, y: 0 };
const pointerDown = (event: PointerEvent) => {
  if (editor.editing || event.button !== 0) return;
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
  if (editor.editing || !drag.active || drag.pointerId !== event.pointerId) return;
  cameraController.handlePointerDelta(event.clientX - drag.x, event.clientY - drag.y);
  drag.x = event.clientX;
  drag.y = event.clientY;
  cameraPanel.syncFromController();
};
const pointerEnd = (event: PointerEvent) => {
  if (editor.editing || !drag.active || drag.pointerId !== event.pointerId) return;
  drag.active = false;
  drag.pointerId = -1;
  canvas.style.cursor = 'grab';
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
};
const lockedPointerMove = (event: MouseEvent) => {
  if (!editor.editing && document.pointerLockElement === canvas) cameraController.handlePointerDelta(event.movementX, event.movementY);
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
  if (editor.editing || cameraController.state.mode !== 'orbit') return;
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
let loadGeneration = 0;
let loadAbort: AbortController | null = null;
let binding: ReturnType<typeof createEnvironmentAdapter> | null = null;
let savedSnapshot = '';
let rawLibrary: Record<string, unknown> = {};
let loadedSnapshot: SceneEnvironmentPresetLibrary = {};
const history = new DocumentHistory<SceneEnvironmentPresetLibrary>({}, value => {
  library = value;
  presetJson.textContent = JSON.stringify(library[currentInstance?.presetKey ?? ''], null, 2);
  setStatus('场景预设草稿已更新；点击保存预设写入配置');
});
const editor = new SceneEditor(scene, {
  objects: () => binding?.adapter.objects() ?? [],
  preview: (edit, value) => binding?.adapter.preview?.(edit, value),
  commit: (edit, value) => binding?.adapter.commit(edit, value),
  cancel: edit => binding?.adapter.cancel?.(edit),
  sync: id => binding?.adapter.sync?.(id),
  undo: () => binding?.adapter.undo?.(), redo: () => binding?.adapter.redo?.(),
}, { cameraInput: suspended => { drag.active = false; cameraController.keys.clear(); cameraController.setInputEnabled(!suspended); }, resetView: () => cameraController.resetInitialPose() });
const unmountEditor = mountEnvironmentEditor(editor);


const component: ISceneEnvironmentComponent = {
  id: 'scene-environment-lab-component',
  type: 'scene-environment',
  version: 3,
  enabled: true,
  presetKey: '',
  mapAnchorMode: 'first-tile',
  mapOffset: [0, 0, 0],
  tileSpacing: [8, 8],
  tileSize: [7.5, 0.5, 7.5],
};

const setStatus = (message: string, error = false) => {
  statusElement.textContent = message;
  statusElement.style.color = error ? '#ff9d9d' : '#8db6a5';
};

const fetchPresetLibraries = async (): Promise<{
  library: SceneEnvironmentPresetLibrary;
  shadowQualityLibrary: ShadowQualityPresetLibrary;
  source: string;
  rawLibrary: Record<string, unknown>;
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
    rawLibrary: scenePresets as Record<string, unknown>,
    library: parseSceneEnvironmentPresetLibrary(scenePresets),
    shadowQualityLibrary: parseShadowQualityPresetLibrary(shadowPresets),
    source: import.meta.env.DEV ? '统一配置入口（开发时优先 Python API）' : '应用内置配置'
  };
};

const loadByComponentPresetKey = async () => {
  if (disposed) return;
  editor.cancel(); editor.enabled = false; editor.refresh();
  loadAbort?.abort(); loadAbort = new AbortController();
  const generation = ++loadGeneration;
  component.presetKey = presetSelect.value;
  componentJson.textContent = JSON.stringify(component, null, 2);
  const preset = library[component.presetKey];
  if (!preset) {
    editor.enabled = true; editor.refresh();
    setStatus(`找不到 presetKey：${component.presetKey}`, true);
    return;
  }
  loadButton.disabled = true;
  setStatus(`正在加载场景“${component.presetKey}”及 ${preset.models.length} 个本地模型……`);
  let nextInstance: SceneEnvironmentInstance;
  try {
    nextInstance = await createSceneEnvironmentAsync(scene, preset, {
      signal: loadAbort.signal,
      shadowQualityPresets: shadowQualityLibrary,
      cascadedShadowDebug: csmDebugToggle.checked,
    });
  } catch (error) {
    if (generation === loadGeneration) setStatus(`加载失败：${error instanceof Error ? error.message : String(error)}`, true);
    return;
  } finally {
    if (generation === loadGeneration) { loadButton.disabled = false; editor.enabled = true; editor.refresh(); }
  }
  if (disposed || generation !== loadGeneration) {
    nextInstance.dispose();
    return;
  }
  editor.select(null); binding?.dispose(); binding = null;
  currentInstance?.dispose();
  currentInstance = nextInstance;
  const key = nextInstance.presetKey;
  binding = createEnvironmentAdapter(nextInstance, {
    read: () => library[key], write: value => history.set({ ...library, [key]: value }),
    undo: () => history.undo(), redo: () => history.redo(),
  });
  editor.refresh();
  currentSceneKeyInput.value = currentInstance.presetKey;
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
  setStatus(`已通过 presetKey “${component.presetKey}” 创建 ${preset.objects.length} 个几何体、${currentInstance.models.length} 个本地模型和 ${preset.lights.length} 个光源，其中 ${enabledShadowSettings.length} 个启用阴影（${generatorLabels.join('、')}）${hasCascadedShadow && csmDebugToggle.checked ? '；级联 Debug 已开启' : ''}。`);
};

const saveButton = requireElement('#save-preset', HTMLButtonElement);
saveButton.addEventListener('click', () => { void (async () => {
  editor.commit();
  parseSceneEnvironmentPresetLibrary(library);
  const snapshot = JSON.stringify(library);
  // Preserve untouched inherited declarations. Only an edited preset becomes an explicit standalone preset.
  const storage = Object.fromEntries(Object.entries(library).map(([key, value]) => [key, JSON.stringify(value) === JSON.stringify(loadedSnapshot[key]) ? rawLibrary[key] ?? value : value]));
  const body = JSON.stringify(storage);
  if (!import.meta.env.DEV) { downloadConfigJson('sceneEnvironmentPresets.json', storage); return; }
  saveButton.disabled = true;
  try {
    const response = await fetch('/api/scene-environment-presets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message ?? response.statusText);
    savedSnapshot = snapshot; rawLibrary = storage; loadedSnapshot = JSON.parse(snapshot); setStatus('已保存到 config/sceneEnvironmentPresets.json；重新加载后保留变换');
  } catch (error) { setStatus(String(error), true); }
  finally { saveButton.disabled = false; }
})(); });
const beforeUnload = (event: BeforeUnloadEvent) => {
  if (JSON.stringify(library) !== savedSnapshot) { event.preventDefault(); event.returnValue = ''; }
};
window.addEventListener('beforeunload', beforeUnload);
const historyKey = (event: KeyboardEvent) => {
  if (isTypingTarget(event.target) || !(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) editor.redo(); else editor.undo(); }
  else if (event.key.toLowerCase() === 'y') { event.preventDefault(); editor.redo(); }
};
window.addEventListener('keydown', historyKey);
loadButton.addEventListener('click', () => { void loadByComponentPresetKey(); });
currentSceneKeyInput.addEventListener('click', () => currentSceneKeyInput.select());
copySceneKeyButton.addEventListener('click', () => {
  const sceneKey = currentSceneKeyInput.value;
  if (!sceneKey) return;
  const copy = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(sceneKey)
    : Promise.reject(new Error('Clipboard API unavailable'));
  void copy.catch(() => {
    currentSceneKeyInput.select();
    document.execCommand('copy');
  }).finally(() => {
    copySceneKeyButton.textContent = '已复制';
    window.setTimeout(() => { copySceneKeyButton.textContent = '复制'; }, 1200);
  });
});
csmDebugToggle.addEventListener('change', () => { void loadByComponentPresetKey(); });
presetSelect.addEventListener('change', () => {
  component.presetKey = presetSelect.value;
  componentJson.textContent = JSON.stringify(component, null, 2);
});

void fetchPresetLibraries().then((result) => {
  if (disposed) return;
  library = result.library; history.value = library; savedSnapshot = JSON.stringify(library); rawLibrary = result.rawLibrary; loadedSnapshot = structuredClone(library);
  shadowQualityLibrary = result.shadowQualityLibrary;
  presetSelect.replaceChildren(...Object.values(library).map((preset) => {
    const option = document.createElement('option');
    option.value = preset.presetKey;
    option.textContent = `${preset.name} · ${preset.presetKey}`;
    return option;
  }));
  const modelTestPresetKey = library['local-model-loading-test']
    ? 'local-model-loading-test'
    : Object.values(library).find((preset) => preset.models.length > 0)?.presetKey;
  if (modelTestPresetKey) presetSelect.value = modelTestPresetKey;
  if (Object.keys(library).length === 0) {
    setStatus('配置中没有场景预设。', true);
    return;
  }
  void loadByComponentPresetKey().then(() => setStatus(`${statusElement.textContent} 来源：${result.source}`));
}).catch((error: unknown) => setStatus(`加载失败：${error instanceof Error ? error.message : String(error)}`, true));

engine.runRenderLoop(() => {
  if (!editor.editing) cameraController.update(engine.getDeltaTime() / 1000);
  cameraPanel.updateStatus();
  scene.render();
});

let disposed = false;
const dispose = () => {
  if (disposed) return;
  disposed = true; loadGeneration++; loadAbort?.abort();
  editor.dispose(); binding?.dispose(); unmountEditor();
  canvas.removeEventListener('pointerdown', pointerDown);
  canvas.removeEventListener('pointermove', pointerMove);
  canvas.removeEventListener('pointerup', pointerEnd);
  canvas.removeEventListener('pointercancel', pointerEnd);
  canvas.removeEventListener('wheel', wheel);
  document.removeEventListener('mousemove', lockedPointerMove);
  document.removeEventListener('pointerlockchange', pointerLockChange);
  window.removeEventListener('beforeunload', beforeUnload);
  window.removeEventListener('keydown', historyKey);
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  window.removeEventListener('resize', resize);
  currentInstance?.dispose();
  cameraPanel.dispose();
  cameraController.dispose();
  scene.dispose();
  engine.dispose();
};
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
