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
import {
  initializeDungeonObstacleStates,
  resolveDungeonObstacleDebugLayout,
  setDungeonObstacleActive,
  type DungeonObstacleBinding,
} from '@/core/dungeon-obstacle';
import { resolveDungeonPlayerSpawn, type DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';
import { moveDungeonPlayer } from '@/core/dungeon-player-movement';
import { createDungeonRuntime, type DungeonRuntime } from '@/core/dungeon-runtime';
import type { DungeonMapDirection, DungeonMapPreset, DungeonMapPresetLibrary } from '@/core/map';
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
const obstacleDebugToggle = requireElement('#obstacle-debug', HTMLInputElement);
const mapBoundsLimitToggle = requireElement('#map-bounds-limit', HTMLInputElement);
const obstacleLimitToggle = requireElement('#obstacle-limit', HTMLInputElement);
const statusElement = requireElement('#status', HTMLDivElement);
const movementStatus = requireElement('#movement-status', HTMLDivElement);
const obstacleList = requireElement('#obstacle-list', HTMLDivElement);
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
let currentRuntime: DungeonRuntime | null = null;
let currentObstacles: DungeonObstacleBinding[] = [];
let mapDebugRoot: TransformNode | null = null;
let spawnDebugRoot: TransformNode | null = null;
let playerPositionRoot: TransformNode | null = null;
let obstacleDebugRoot: TransformNode | null = null;
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

const disposePlayerPositionDebug = () => {
  playerPositionRoot?.dispose(false, true);
  playerPositionRoot = null;
};

const disposeMapDebug = () => {
  mapDebugRoot?.dispose(false, true);
  mapDebugRoot = null;
};

const disposeObstacleDebug = () => {
  obstacleDebugRoot?.dispose(false, true);
  obstacleDebugRoot = null;
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
  const spawn = currentSpawn;
  if (!obstacleDebugToggle.checked || !runtime || !spawn) return;
  const root = new TransformNode('dungeon_player_movement_obstacle_debug', scene);
  const activeMaterial = new StandardMaterial('movement_obstacle_debug_active', scene);
  activeMaterial.diffuseColor = Color3.FromHexString('#e24c3d');
  activeMaterial.emissiveColor = Color3.FromHexString('#7c211b');
  activeMaterial.alpha = 0.42;
  const inactiveMaterial = new StandardMaterial('movement_obstacle_debug_inactive', scene);
  inactiveMaterial.diffuseColor = Color3.FromHexString('#71808c');
  inactiveMaterial.emissiveColor = Color3.FromHexString('#273039');
  inactiveMaterial.alpha = 0.14;
  inactiveMaterial.wireframe = true;
  currentObstacles.forEach((binding) => {
    const active = runtime.obstacleStates.get(binding.entity.id) === true;
    const layout = resolveDungeonObstacleDebugLayout(
      binding, spawn.sceneEnvironmentComponent, runtime.map.width, runtime.map.height,
    );
    const box = MeshBuilder.CreateBox(`movement_obstacle_debug_${binding.entity.id}`, {
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
      refreshRuntimeJson();
      movementStatus.textContent = `阻碍“${binding.entity.name ?? binding.entity.id}”已${checkbox.checked ? '启用' : '停用'}。`;
    });
    const detail = document.createElement('small');
    detail.textContent = `${placementLabel(binding)} · ${binding.entity.id}`;
    label.append(text, checkbox);
    item.append(label, detail);
    return item;
  }));
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

const resolveCurrentPlayerLayout = () => {
  if (!currentRuntime || !currentSpawn) return null;
  return resolveDungeonMapTileWorldLayout(
    currentSpawn.sceneEnvironmentComponent,
    currentRuntime.map.width,
    currentRuntime.map.height,
    currentRuntime.playerPosition.tileX,
    currentRuntime.playerPosition.tileY,
  );
};

const renderPlayerPositionDebug = () => {
  disposePlayerPositionDebug();
  const layout = resolveCurrentPlayerLayout();
  if (!layout) return;
  const root = new TransformNode('dungeon_player_current_position_debug', scene);
  const material = new StandardMaterial('dungeon_player_current_position_debug_material', scene);
  material.diffuseColor = Color3.FromHexString('#3dde83');
  material.emissiveColor = Color3.FromHexString('#12683a');
  const marker = MeshBuilder.CreateCylinder('dungeon_player_current_position_marker', {
    diameter: Math.min(layout.size[0], layout.size[2]) * 0.18,
    height: Math.max(layout.size[1] * 1.5, 1.2),
  }, scene);
  marker.position.set(
    layout.center[0],
    layout.center[1] + layout.size[1] / 2 + Math.max(layout.size[1] * 0.75, 0.6),
    layout.center[2],
  );
  marker.material = material;
  marker.parent = root;
  marker.isPickable = false;
  playerPositionRoot = root;
};

const refreshRuntimeJson = () => {
  if (!currentSpawn || !currentRuntime) return;
  spawnJson.textContent = JSON.stringify({
    spawnPointEntity: currentSpawn.spawnPointEntity,
    actorSpawnComponent: currentSpawn.actorSpawnComponent,
    tilePosition: currentSpawn.tilePosition,
    worldPosition: currentSpawn.worldPosition,
    tileWorldLayout: currentSpawn.tileWorldLayout,
    dungeonRuntime: {
      mapId: currentRuntime.map.id,
      playerPosition: currentRuntime.playerPosition,
      obstacleStates: Object.fromEntries(currentRuntime.obstacleStates),
    },
  }, null, 2);
};

const inspectSpawn = (preset: DungeonMapPreset): DungeonPlayerSpawnBinding => {
  const binding = resolveDungeonPlayerSpawn(preset.map, sceneLibrary);
  currentSpawn = binding;
  currentRuntime = createDungeonRuntime(preset.map, binding);
  currentObstacles = initializeDungeonObstacleStates(currentRuntime);
  renderObstacleList();
  refreshRuntimeJson();
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
    renderObstacleDebug();
    renderPlayerPositionDebug();
    movementStatus.textContent = `玩家已在出生格 (${currentRuntime?.playerPosition.tileX}, ${currentRuntime?.playerPosition.tileY}) 创建。`;
    setStatus(`出生格 (${spawn.tilePosition.x}, ${spawn.tilePosition.y}) → 世界坐标 (${spawn.worldPosition.map((value) => value.toFixed(2)).join(', ')})${mapDebugToggle.checked ? `；已显示 ${preset.map.tiles.length} 个格子盒` : ''}${spawnDebugToggle.checked ? '；出生格已高亮' : ''}。`);
  } catch (error) {
    if (generation !== loadGeneration) return;
    currentSpawn = null;
    currentRuntime = null;
    currentObstacles = [];
    disposeMapDebug();
    disposeSpawnDebug();
    disposePlayerPositionDebug();
    disposeObstacleDebug();
    obstacleList.textContent = '加载失败';
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
obstacleDebugToggle.addEventListener('change', () => {
  renderObstacleDebug();
  setStatus(obstacleDebugToggle.checked
    ? `阻碍 Debug 已开启：红色为启用，灰色线框为停用，共 ${currentObstacles.length} 个。`
    : '阻碍 Debug 已关闭。');
});

const movePlayer = (direction: DungeonMapDirection) => {
  if (!currentRuntime) {
    movementStatus.textContent = '尚未创建 DungeonRuntime。';
    return;
  }
  const result = moveDungeonPlayer(currentRuntime, direction, {
    restrictToMapBounds: mapBoundsLimitToggle.checked,
    restrictMovementObstacles: obstacleLimitToggle.checked,
  });
  if (!result.moved) {
    movementStatus.textContent = result.blockedReason === 'movement-obstacle'
      ? `移动被阻碍挡住：${result.blockedObstacleIds?.join('、') ?? '未知阻碍'}。`
      : `移动被地图边界阻挡：目标格 (${result.to.tileX}, ${result.to.tileY})。`;
    return;
  }
  refreshRuntimeJson();
  renderPlayerPositionDebug();
  const layout = resolveCurrentPlayerLayout();
  movementStatus.textContent = `玩家移动到 (${result.to.tileX}, ${result.to.tileY})${layout ? `，世界坐标 (${layout.center.map((value) => value.toFixed(2)).join(', ')})` : ''}。`;
};

document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
  button.addEventListener('click', () => movePlayer(button.dataset.move as DungeonMapDirection));
});
mapBoundsLimitToggle.addEventListener('change', () => {
  movementStatus.textContent = mapBoundsLimitToggle.checked
    ? '地图边界限制已开启。'
    : '地图边界限制已关闭，玩家可以移动到地图坐标范围外。';
});
obstacleLimitToggle.addEventListener('change', () => {
  movementStatus.textContent = obstacleLimitToggle.checked
    ? '阻碍限制已开启，玩家不能进入阻碍格或跨越启用的阻碍边。'
    : '阻碍限制已关闭，移动系统暂时忽略所有 movement-obstacle。';
});
const KEY_DIRECTIONS: Readonly<Record<string, DungeonMapDirection>> = {
  ArrowUp: 'north', w: 'north', W: 'north',
  ArrowRight: 'east', d: 'east', D: 'east',
  ArrowDown: 'south', s: 'south', S: 'south',
  ArrowLeft: 'west', a: 'west', A: 'west',
};
window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
  const direction = KEY_DIRECTIONS[event.key];
  if (!direction) return;
  event.preventDefault();
  movePlayer(direction);
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
  disposePlayerPositionDebug();
  disposeObstacleDebug();
  camera.detachControl();
  scene.dispose();
  engine.dispose();
}, { once: true });
