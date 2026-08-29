import {
  ArcRotateCamera,
  Color3,
  Engine,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { loadConfig } from '@/core/config';
import type { DungeonMapPreset, DungeonMapPresetLibrary } from '@/core/map';
import {
  createDungeonMapSceneEnvironmentAsync,
  parseSceneEnvironmentPresetLibrary,
  parseShadowQualityPresetLibrary,
  resolveDungeonMapSceneEnvironment,
  resolveDungeonMapTileWorldLayout,
  type DungeonMapSceneEnvironmentInstance,
  type SceneEnvironmentPresetLibrary,
  type ShadowQualityPresetLibrary,
} from '@/core/scene';

const requireElement = <T extends Element>(selector: string, constructor: { new(): T }): T => {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor)) throw new Error(`缺少页面元素：${selector}`);
  return element;
};

const canvas = requireElement('#preview', HTMLCanvasElement);
const mapSelect = requireElement('#map-preset', HTMLSelectElement);
const loadButton = requireElement('#load', HTMLButtonElement);
const statusElement = requireElement('#status', HTMLDivElement);
const sceneKeyInput = requireElement('#scene-key', HTMLInputElement);
const copyKeyButton = requireElement('#copy-key', HTMLButtonElement);
const mapDebugToggle = requireElement('#map-debug', HTMLInputElement);
const bindingJson = requireElement('#binding-json', HTMLPreElement);
const sceneJson = requireElement('#scene-json', HTMLPreElement);

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
const camera = new ArcRotateCamera('dungeonSceneLoaderCamera', -Math.PI / 4, 1.08, 105, Vector3.Zero(), scene);
camera.lowerRadiusLimit = 3;
camera.upperRadiusLimit = 500;
camera.wheelPrecision = 8;
camera.attachControl(canvas, true);

let mapLibrary: DungeonMapPresetLibrary = {};
let sceneLibrary: SceneEnvironmentPresetLibrary = {};
let shadowLibrary: ShadowQualityPresetLibrary = {};
let currentInstance: DungeonMapSceneEnvironmentInstance | null = null;
let debugRoot: TransformNode | null = null;
let loadGeneration = 0;

const setStatus = (message: string, error = false) => {
  statusElement.textContent = message;
  statusElement.style.color = error ? '#ff9d9d' : '#91c8af';
};

const parseMapLibrary = (value: unknown): DungeonMapPresetLibrary => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('地图预设配置必须是对象。');
  const result: DungeonMapPresetLibrary = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (!candidate || typeof candidate !== 'object') continue;
    const preset = candidate as Partial<DungeonMapPreset>;
    if (typeof preset.presetKey !== 'string' || typeof preset.name !== 'string' || !preset.map) continue;
    if (preset.presetKey !== key) throw new Error(`地图预设“${key}”的 presetKey 不一致。`);
    result[key] = preset as DungeonMapPreset;
  }
  return result;
};

const selectDevData = (payload: unknown) => (payload as Record<string, unknown>).data;

const fetchLibraries = async () => {
  const [maps, environments, shadows] = await Promise.all([
    loadConfig<unknown>('dungeonMapPresets.json', {
      devApiPath: '/api/dungeon-map-presets',
      selectDevPayload: selectDevData,
    }),
    loadConfig<unknown>('sceneEnvironmentPresets.json', {
      devApiPath: '/api/scene-environment-presets',
      selectDevPayload: selectDevData,
    }),
    loadConfig<unknown>('shadowQualityPresets.json', {
      devApiPath: '/api/shadow-quality-presets',
      selectDevPayload: selectDevData,
    }),
  ]);
  return {
    maps: parseMapLibrary(maps),
    environments: parseSceneEnvironmentPresetLibrary(environments),
    shadows: parseShadowQualityPresetLibrary(shadows),
  };
};

const inspectSelectedMap = () => {
  const preset = mapLibrary[mapSelect.value];
  if (!preset) throw new Error(`找不到地图预设“${mapSelect.value}”。`);
  const binding = resolveDungeonMapSceneEnvironment(preset.map, sceneLibrary);
  sceneKeyInput.value = binding.component.presetKey;
  bindingJson.textContent = JSON.stringify({
    mapPresetKey: preset.presetKey,
    mapId: preset.map.id,
    mapEntity: binding.mapEntity,
    sceneEnvironmentComponent: binding.component,
  }, null, 2);
  sceneJson.textContent = JSON.stringify(binding.preset, null, 2);
  return { preset, binding };
};

const disposeMapDebug = () => {
  debugRoot?.dispose(false, true);
  debugRoot = null;
};

const renderMapDebug = () => {
  disposeMapDebug();
  if (!mapDebugToggle.checked) return;
  const { preset, binding } = inspectSelectedMap();
  const root = new TransformNode(`dungeon_map_debug_${preset.presetKey}`, scene);
  const material = new StandardMaterial(`dungeon_map_debug_${preset.presetKey}_material`, scene);
  material.diffuseColor = Color3.FromHexString('#36bff2');
  material.emissiveColor = Color3.FromHexString('#17698a');
  material.alpha = 0.22;
  material.wireframe = true;
  preset.map.tiles.forEach((tile) => {
    const layout = resolveDungeonMapTileWorldLayout(
      binding.component,
      preset.map.width,
      preset.map.height,
      tile.x,
      tile.y,
    );
    const box = MeshBuilder.CreateBox(`map_tile_debug_${tile.x}_${tile.y}`, {
      width: layout.size[0],
      height: layout.size[1],
      depth: layout.size[2],
    }, scene);
    box.position.set(...layout.center);
    box.material = material;
    box.parent = root;
    box.isPickable = false;
    box.enableEdgesRendering();
    box.edgesColor.set(0.25, 0.82, 1, 1);
    box.edgesWidth = 2;
  });
  debugRoot = root;
};

const loadSelectedMapScene = async () => {
  const generation = ++loadGeneration;
  try {
    const { preset, binding } = inspectSelectedMap();
    loadButton.disabled = true;
    setStatus(`正在加载地图“${preset.name}”及 ${binding.preset.models.length} 个本地模型……`);
    const nextInstance = await createDungeonMapSceneEnvironmentAsync(scene, preset.map, sceneLibrary, {
      shadowQualityPresets: shadowLibrary,
    });
    if (generation !== loadGeneration) {
      nextInstance.dispose();
      return;
    }
    currentInstance?.dispose();
    currentInstance = nextInstance;
    renderMapDebug();
    setStatus(`地图“${preset.name}”已通过组件 key“${binding.component.presetKey}”加载场景：${binding.preset.objects.length} 个基础几何体，${nextInstance.models.length} 个本地模型，${binding.preset.lights.length} 个光源${mapDebugToggle.checked ? `，并绘制 ${preset.map.tiles.length} 个格子 Debug 盒` : ''}。`);
  } catch (error) {
    if (generation !== loadGeneration) return;
    sceneKeyInput.value = '';
    bindingJson.textContent = '解析失败';
    sceneJson.textContent = '未加载';
    setStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    if (generation === loadGeneration) loadButton.disabled = false;
  }
};

mapSelect.addEventListener('change', () => {
  void loadSelectedMapScene();
});
loadButton.addEventListener('click', () => { void loadSelectedMapScene(); });
mapDebugToggle.addEventListener('change', () => {
  try {
    renderMapDebug();
    setStatus(mapDebugToggle.checked ? `Debug 已开启，共绘制 ${mapLibrary[mapSelect.value]?.map.tiles.length ?? 0} 个格子盒。` : 'Debug 已关闭。');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
});
sceneKeyInput.addEventListener('click', () => sceneKeyInput.select());
copyKeyButton.addEventListener('click', () => {
  if (!sceneKeyInput.value) return;
  void navigator.clipboard.writeText(sceneKeyInput.value).then(() => {
    copyKeyButton.textContent = '已复制';
    window.setTimeout(() => { copyKeyButton.textContent = '复制'; }, 1200);
  }).catch(() => {
    sceneKeyInput.select();
    document.execCommand('copy');
  });
});

void fetchLibraries().then((libraries) => {
  mapLibrary = libraries.maps;
  sceneLibrary = libraries.environments;
  shadowLibrary = libraries.shadows;
  mapSelect.replaceChildren(...Object.values(mapLibrary).map((preset) => {
    const option = document.createElement('option');
    option.value = preset.presetKey;
    option.textContent = `${preset.name} · ${preset.presetKey}`;
    return option;
  }));
  if (mapSelect.options.length === 0) throw new Error('配置中没有可用地图预设。');
  void loadSelectedMapScene();
}).catch((error: unknown) => setStatus(`配置加载失败：${error instanceof Error ? error.message : String(error)}`, true));

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
window.addEventListener('beforeunload', () => {
  currentInstance?.dispose();
  disposeMapDebug();
  camera.detachControl();
  scene.dispose();
  engine.dispose();
}, { once: true });
