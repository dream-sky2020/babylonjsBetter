import {
  ArcRotateCamera, Color3, Engine, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3,
} from '@babylonjs/core';
import { loadConfig } from '@/core/config';
import {
  initializeDungeonObstacleStates,
  resolveDungeonObstacleDebugLayout,
  setDungeonObstacleActive,
  type DungeonObstacleBinding,
} from '@/core/dungeon-obstacle';
import { resolveDungeonPlayerSpawn } from '@/core/dungeon-player-spawn';
import { createDungeonRuntime, type DungeonRuntime } from '@/core/dungeon-runtime';
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
const obstacleDebugToggle = requireElement('#obstacle-debug', HTMLInputElement);
const obstacleList = requireElement('#obstacle-list', HTMLDivElement);
const bindingJson = requireElement('#binding-json', HTMLPreElement);
const sceneJson = requireElement('#scene-json', HTMLPreElement);

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
const camera = new ArcRotateCamera('dungeonObstacleCamera', -Math.PI / 4, 1.08, 105, Vector3.Zero(), scene);
camera.lowerRadiusLimit = 3;
camera.upperRadiusLimit = 500;
camera.wheelPrecision = 8;
camera.attachControl(canvas, true);

let mapLibrary: DungeonMapPresetLibrary = {};
let sceneLibrary: SceneEnvironmentPresetLibrary = {};
let shadowLibrary: ShadowQualityPresetLibrary = {};
let currentScene: DungeonMapSceneEnvironmentInstance | null = null;
let currentRuntime: DungeonRuntime | null = null;
let currentObstacles: DungeonObstacleBinding[] = [];
let mapDebugRoot: TransformNode | null = null;
let obstacleDebugRoot: TransformNode | null = null;
let loadGeneration = 0;

const setStatus = (message: string, error = false) => {
  statusElement.textContent = message;
  statusElement.style.color = error ? '#ff9d9d' : '#e2aa9f';
};

const parseMapLibrary = (value: unknown): DungeonMapPresetLibrary => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('地图预设配置必须是对象。');
  return Object.fromEntries(Object.entries(value).filter(([, candidate]) => {
    if (!candidate || typeof candidate !== 'object') return false;
    const preset = candidate as Partial<DungeonMapPreset>;
    return typeof preset.presetKey === 'string' && typeof preset.name === 'string' && !!preset.map;
  })) as DungeonMapPresetLibrary;
};

const selectDevData = (payload: unknown) => (payload as Record<string, unknown>).data;
const fetchLibraries = async () => {
  const [maps, environments, shadows] = await Promise.all([
    loadConfig<unknown>('dungeonMapPresets.json', { devApiPath: '/api/dungeon-map-presets', selectDevPayload: selectDevData }),
    loadConfig<unknown>('sceneEnvironmentPresets.json', { devApiPath: '/api/scene-environment-presets', selectDevPayload: selectDevData }),
    loadConfig<unknown>('shadowQualityPresets.json', { devApiPath: '/api/shadow-quality-presets', selectDevPayload: selectDevData }),
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
  const sceneBinding = resolveDungeonMapSceneEnvironment(preset.map, sceneLibrary);
  sceneKeyInput.value = sceneBinding.component.presetKey;
  sceneJson.textContent = JSON.stringify(sceneBinding.preset, null, 2);
  return { preset, sceneBinding };
};

const disposeObstacleDebug = () => {
  obstacleDebugRoot?.dispose(false, true);
  obstacleDebugRoot = null;
};

const disposeMapDebug = () => {
  mapDebugRoot?.dispose(false, true);
  mapDebugRoot = null;
};

const renderMapDebug = () => {
  disposeMapDebug();
  if (!mapDebugToggle.checked) return;
  const { preset, sceneBinding } = inspectSelectedMap();
  const root = new TransformNode(`dungeon_map_debug_${preset.presetKey}`, scene);
  const material = new StandardMaterial(`dungeon_map_debug_${preset.presetKey}_material`, scene);
  material.diffuseColor = Color3.FromHexString('#36bff2');
  material.emissiveColor = Color3.FromHexString('#17698a');
  material.alpha = 0.22;
  material.wireframe = true;
  preset.map.tiles.forEach((tile) => {
    const layout = resolveDungeonMapTileWorldLayout(
      sceneBinding.component,
      preset.map.width,
      preset.map.height,
      tile.x,
      tile.y,
    );
    const box = MeshBuilder.CreateBox(`map_tile_debug_${tile.x}_${tile.y}`, {
      width: layout.size[0], height: layout.size[1], depth: layout.size[2],
    }, scene);
    box.position.set(...layout.center);
    box.material = material;
    box.parent = root;
    box.isPickable = false;
    box.enableEdgesRendering();
    box.edgesColor.set(0.25, 0.82, 1, 1);
    box.edgesWidth = 2;
  });
  mapDebugRoot = root;
};

const placementLabel = (binding: DungeonObstacleBinding): string => {
  const placement = binding.placement;
  if (placement.kind === 'tile') return `格子 (${placement.tileX}, ${placement.tileY})`;
  if (placement.kind === 'tile-edge') return `独立边 (${placement.tileX}, ${placement.tileY}) ${placement.direction}`;
  return `公用边 ${placement.sharedEdgeId}`;
};

const renderObstacleDebug = () => {
  disposeObstacleDebug();
  const runtime = currentRuntime;
  if (!obstacleDebugToggle.checked || !runtime) return;
  const { preset, sceneBinding } = inspectSelectedMap();
  const root = new TransformNode(`dungeon_obstacle_debug_${preset.presetKey}`, scene);
  const activeMaterial = new StandardMaterial('dungeon_obstacle_debug_active', scene);
  activeMaterial.diffuseColor = Color3.FromHexString('#e24c3d');
  activeMaterial.emissiveColor = Color3.FromHexString('#7c211b');
  activeMaterial.alpha = 0.42;
  const inactiveMaterial = new StandardMaterial('dungeon_obstacle_debug_inactive', scene);
  inactiveMaterial.diffuseColor = Color3.FromHexString('#71808c');
  inactiveMaterial.emissiveColor = Color3.FromHexString('#273039');
  inactiveMaterial.alpha = 0.14;
  inactiveMaterial.wireframe = true;
  currentObstacles.forEach((binding) => {
    const active = runtime.obstacleStates.get(binding.entity.id) === true;
    const layout = resolveDungeonObstacleDebugLayout(binding, sceneBinding.component, preset.map.width, preset.map.height);
    const box = MeshBuilder.CreateBox(`obstacle_debug_${binding.entity.id}`, {
      width: layout.size[0], height: layout.size[1], depth: layout.size[2],
    }, scene);
    box.position.set(...layout.center);
    box.material = active ? activeMaterial : inactiveMaterial;
    box.parent = root;
    box.isPickable = false;
    box.enableEdgesRendering();
    box.edgesColor.set(active ? 1 : 0.45, active ? 0.25 : 0.55, active ? 0.18 : 0.62, active ? 1 : 0.5);
    box.edgesWidth = active ? 4 : 2;
  });
  obstacleDebugRoot = root;
};

const updateBindingJson = () => {
  const runtime = currentRuntime;
  if (!runtime) return;
  const { preset, sceneBinding } = inspectSelectedMap();
  bindingJson.textContent = JSON.stringify({
    mapPresetKey: preset.presetKey,
    mapEntity: sceneBinding.mapEntity,
    sceneEnvironmentComponent: sceneBinding.component,
    obstacleStates: Object.fromEntries(runtime.obstacleStates),
    obstacles: currentObstacles.map((binding) => ({
      entityId: binding.entity.id,
      name: binding.entity.name,
      placement: binding.placement,
      active: runtime.obstacleStates.get(binding.entity.id),
    })),
  }, null, 2);
};

const renderObstacleList = () => {
  const runtime = currentRuntime;
  if (!runtime) {
    obstacleList.textContent = '尚未加载';
    return;
  }
  obstacleList.replaceChildren(...currentObstacles.map((binding) => {
    const item = document.createElement('div');
    item.className = 'obstacle-item';
    const label = document.createElement('label');
    const text = document.createElement('span');
    text.textContent = binding.entity.name ?? binding.entity.id;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = runtime.obstacleStates.get(binding.entity.id) === true;
    checkbox.addEventListener('change', () => {
      setDungeonObstacleActive(runtime, binding.entity.id, checkbox.checked);
      renderObstacleDebug();
      updateBindingJson();
      setStatus(`阻碍“${binding.entity.name ?? binding.entity.id}”已${checkbox.checked ? '启用' : '停用'}。`);
    });
    const detail = document.createElement('small');
    detail.textContent = `${placementLabel(binding)} · ${binding.entity.id}`;
    label.append(text, checkbox);
    item.append(label, detail);
    return item;
  }));
};

const loadSelectedMapScene = async () => {
  const generation = ++loadGeneration;
  try {
    const { preset, sceneBinding } = inspectSelectedMap();
    loadButton.disabled = true;
    setStatus(`正在加载地图“${preset.name}”并扫描阻碍……`);
    const playerSpawn = resolveDungeonPlayerSpawn(preset.map, sceneLibrary);
    const runtime = createDungeonRuntime(preset.map, playerSpawn);
    const obstacles = initializeDungeonObstacleStates(runtime);
    const nextScene = await createDungeonMapSceneEnvironmentAsync(scene, preset.map, sceneLibrary, {
      shadowQualityPresets: shadowLibrary,
    });
    if (generation !== loadGeneration) {
      nextScene.dispose();
      return;
    }
    currentScene?.dispose();
    currentScene = nextScene;
    currentRuntime = runtime;
    currentObstacles = obstacles;
    renderObstacleList();
    updateBindingJson();
    renderMapDebug();
    renderObstacleDebug();
    const activeCount = [...runtime.obstacleStates.values()].filter(Boolean).length;
    setStatus(`已从地图加载 ${obstacles.length} 个阻碍，其中 ${activeCount} 个当前启用；场景 key“${sceneBinding.component.presetKey}”。`);
  } catch (error) {
    if (generation !== loadGeneration) return;
    currentRuntime = null;
    currentObstacles = [];
    disposeObstacleDebug();
    obstacleList.textContent = '加载失败';
    bindingJson.textContent = '解析失败';
    setStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    if (generation === loadGeneration) loadButton.disabled = false;
  }
};

mapSelect.addEventListener('change', () => { void loadSelectedMapScene(); });
loadButton.addEventListener('click', () => { void loadSelectedMapScene(); });
mapDebugToggle.addEventListener('change', () => {
  try {
    renderMapDebug();
    setStatus(mapDebugToggle.checked
      ? `格子 Debug 已开启，共绘制 ${mapLibrary[mapSelect.value]?.map.tiles.length ?? 0} 个格子盒。`
      : '格子 Debug 已关闭。');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
});
obstacleDebugToggle.addEventListener('change', () => {
  renderObstacleDebug();
  setStatus(obstacleDebugToggle.checked
    ? `阻碍 Debug 已开启：红色为启用，灰色线框为停用，共 ${currentObstacles.length} 个。`
    : '阻碍 Debug 已关闭。');
});
sceneKeyInput.addEventListener('click', () => sceneKeyInput.select());
copyKeyButton.addEventListener('click', () => {
  if (!sceneKeyInput.value) return;
  void navigator.clipboard.writeText(sceneKeyInput.value);
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
  if (!mapSelect.options.length) throw new Error('配置中没有可用地图预设。');
  void loadSelectedMapScene();
}).catch((error: unknown) => setStatus(`配置加载失败：${error instanceof Error ? error.message : String(error)}`, true));

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
window.addEventListener('beforeunload', () => {
  currentScene?.dispose();
  disposeMapDebug();
  disposeObstacleDebug();
  camera.detachControl();
  scene.dispose();
  engine.dispose();
}, { once: true });
