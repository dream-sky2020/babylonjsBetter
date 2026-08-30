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
import { resolveDungeonPlayerSpawn, type DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';
import { createDungeonRuntime } from '@/core/dungeon-runtime';
import type { DungeonMapPreset, DungeonMapPresetLibrary } from '@/core/map';
import {
  createDungeonMapSceneEnvironmentAsync,
  parseSceneEnvironmentPresetLibrary,
  parseShadowQualityPresetLibrary,
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
const mapDebugToggle = requireElement('#map-debug', HTMLInputElement);
const spawnDebugToggle = requireElement('#spawn-debug', HTMLInputElement);
const statusElement = requireElement('#status', HTMLDivElement);
const spawnJson = requireElement('#spawn-json', HTMLPreElement);
const mapJson = requireElement('#map-json', HTMLPreElement);

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
const camera = new ArcRotateCamera('dungeonPlayerSpawnCamera', -Math.PI / 4, 1.08, 105, Vector3.Zero(), scene);
camera.lowerRadiusLimit = 3;
camera.upperRadiusLimit = 500;
camera.wheelPrecision = 8;
camera.attachControl(canvas, true);

let mapLibrary: DungeonMapPresetLibrary = {};
let sceneLibrary: SceneEnvironmentPresetLibrary = {};
let shadowLibrary: ShadowQualityPresetLibrary = {};
let currentScene: DungeonMapSceneEnvironmentInstance | null = null;
let currentSpawn: DungeonPlayerSpawnBinding | null = null;
let mapDebugRoot: TransformNode | null = null;
let spawnDebugRoot: TransformNode | null = null;
let loadGeneration = 0;

const setStatus = (message: string, error = false) => {
  statusElement.textContent = message;
  statusElement.style.color = error ? '#ff9d9d' : '#e4ca79';
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

const disposeSpawnDebug = () => {
  spawnDebugRoot?.dispose(false, true);
  spawnDebugRoot = null;
};

const disposeMapDebug = () => {
  mapDebugRoot?.dispose(false, true);
  mapDebugRoot = null;
};

const renderMapDebug = () => {
  disposeMapDebug();
  if (!mapDebugToggle.checked || !currentSpawn) return;
  const preset = mapLibrary[mapSelect.value];
  if (!preset) return;
  const root = new TransformNode(`dungeon_player_spawn_map_debug_${preset.presetKey}`, scene);
  const material = new StandardMaterial(`dungeon_player_spawn_map_debug_${preset.presetKey}_material`, scene);
  material.diffuseColor = Color3.FromHexString('#36bff2');
  material.emissiveColor = Color3.FromHexString('#17698a');
  material.alpha = 0.2;
  material.wireframe = true;
  preset.map.tiles.forEach((tile) => {
    const layout = resolveDungeonMapTileWorldLayout(
      currentSpawn!.sceneEnvironmentComponent,
      preset.map.width,
      preset.map.height,
      tile.x,
      tile.y,
    );
    const box = MeshBuilder.CreateBox(`player_spawn_map_tile_debug_${tile.x}_${tile.y}`, {
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

const renderSpawnDebug = () => {
  disposeSpawnDebug();
  if (!spawnDebugToggle.checked || !currentSpawn) return;
  const root = new TransformNode('dungeon_player_spawn_debug', scene);
  const material = new StandardMaterial('dungeon_player_spawn_debug_material', scene);
  material.diffuseColor = Color3.FromHexString('#ffd34e');
  material.emissiveColor = Color3.FromHexString('#8b5f00');
  material.alpha = 0.36;
  material.wireframe = true;
  const box = MeshBuilder.CreateBox('dungeon_player_spawn_tile_debug', {
    width: currentSpawn.tileWorldLayout.size[0],
    height: currentSpawn.tileWorldLayout.size[1],
    depth: currentSpawn.tileWorldLayout.size[2],
  }, scene);
  box.position.set(...currentSpawn.tileWorldLayout.center);
  box.material = material;
  box.parent = root;
  box.isPickable = false;
  box.enableEdgesRendering();
  box.edgesColor.set(1, 0.82, 0.18, 1);
  box.edgesWidth = 5;
  spawnDebugRoot = root;
};

const inspectSpawn = (preset: DungeonMapPreset): DungeonPlayerSpawnBinding => {
  const binding = resolveDungeonPlayerSpawn(preset.map, sceneLibrary);
  const runtime = createDungeonRuntime(preset.map, binding);
  spawnJson.textContent = JSON.stringify({
    spawnPointEntity: binding.spawnPointEntity,
    actorSpawnComponent: binding.actorSpawnComponent,
    tilePosition: binding.tilePosition,
    worldPosition: binding.worldPosition,
    tileWorldLayout: binding.tileWorldLayout,
    dungeonRuntime: {
      mapId: runtime.map.id,
      playerPosition: runtime.playerPosition,
    },
  }, null, 2);
  mapJson.textContent = JSON.stringify({
    mapEntity: binding.mapEntity,
    sceneEnvironmentComponent: binding.sceneEnvironmentComponent,
  }, null, 2);
  return binding;
};

const loadSelectedMap = async () => {
  const generation = ++loadGeneration;
  try {
    const preset = mapLibrary[mapSelect.value];
    if (!preset) throw new Error(`找不到地图预设“${mapSelect.value}”。`);
    loadButton.disabled = true;
    setStatus(`正在加载地图“${preset.name}”并解析出生点……`);
    const spawn = inspectSpawn(preset);
    const nextScene = await createDungeonMapSceneEnvironmentAsync(scene, preset.map, sceneLibrary, {
      shadowQualityPresets: shadowLibrary,
    });
    if (generation !== loadGeneration) { nextScene.dispose(); return; }
    currentScene?.dispose();
    currentScene = nextScene;
    currentSpawn = spawn;
    renderMapDebug();
    renderSpawnDebug();
    setStatus(`出生格 (${spawn.tilePosition.x}, ${spawn.tilePosition.y}) → 世界坐标 (${spawn.worldPosition.map((value) => value.toFixed(2)).join(', ')})${mapDebugToggle.checked ? `；已显示 ${preset.map.tiles.length} 个格子盒` : ''}${spawnDebugToggle.checked ? '；出生格已高亮' : ''}。`);
  } catch (error) {
    if (generation !== loadGeneration) return;
    currentSpawn = null;
    disposeMapDebug();
    disposeSpawnDebug();
    spawnJson.textContent = '解析失败';
    mapJson.textContent = '解析失败';
    setStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    if (generation === loadGeneration) loadButton.disabled = false;
  }
};

mapSelect.addEventListener('change', () => { void loadSelectedMap(); });
loadButton.addEventListener('click', () => { void loadSelectedMap(); });
mapDebugToggle.addEventListener('change', () => {
  renderMapDebug();
  const tileCount = mapLibrary[mapSelect.value]?.map.tiles.length ?? 0;
  setStatus(mapDebugToggle.checked
    ? currentSpawn ? `全部格子 Debug 已开启，共绘制 ${tileCount} 个蓝色格子盒。` : '尚未解析地图和玩家出生点。'
    : '全部格子 Debug 已关闭。');
});
spawnDebugToggle.addEventListener('change', () => {
  renderSpawnDebug();
  setStatus(spawnDebugToggle.checked
    ? currentSpawn ? `玩家出生格 Debug 已开启：(${currentSpawn.tilePosition.x}, ${currentSpawn.tilePosition.y})。` : '尚未解析玩家出生点。'
    : '玩家出生格 Debug 已关闭。');
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
  void loadSelectedMap();
}).catch((error: unknown) => setStatus(`配置加载失败：${error instanceof Error ? error.message : String(error)}`, true));

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
window.addEventListener('beforeunload', () => {
  currentScene?.dispose();
  disposeMapDebug();
  disposeSpawnDebug();
  camera.detachControl();
  scene.dispose();
  engine.dispose();
}, { once: true });
