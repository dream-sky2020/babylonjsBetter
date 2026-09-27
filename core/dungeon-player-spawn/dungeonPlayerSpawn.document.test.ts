import { createDungeonRuntime } from '../dungeon-runtime/dungeonRuntime.ts';
import { entityTypeDefinition as spawnDefinition } from '../entity/entity-types/spawn-point.entity-type.ts';
import { componentDefinition as actorSpawnDefinition } from '../entity/components/actor-spawn.component.ts';
import { EntityTypeRegistry } from '../entity/entity-type.registry.ts';
import { resolveDungeonPlayerSpawn } from './dungeonPlayerSpawn.ts';
import { parseDungeonMapDocumentV2, encodeDungeonMapDocumentLibraryV2 } from '../map-document/dungeonMapDocument.codec.ts';
import { encodeDungeonMapDocumentV3, parseDungeonMapDocumentV3 } from '../map-document/dungeonMapDocument.storageV3.ts';
import { projectDungeonMapDocumentToLegacyMap } from '../map-document/dungeonMapDocument.projection.ts';
import { DungeonMapDocumentStore } from '../map-document/dungeonMapDocument.store.ts';
import { validateDungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.validation.ts';
import type { DungeonMapDocumentV2, DungeonMapSpatialAttachmentComponent } from '../map-document/dungeonMapDocument.types.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntityContainer } from '../entity/entity.utils.ts';
import type { IEntity } from '../entity/entity.types.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { resolveDungeonDocumentSceneEnvironment } from '../scene/dungeonDocumentSceneEnvironment.ts';
import type { SceneEnvironmentPresetLibrary } from '../scene/sceneEnvironment.types.ts';
import { resolveDungeonDocumentPlayerSpawn } from './dungeonPlayerSpawn.document.ts';

const sceneEntity = (): IEntity => ({
  id: 'map:entity',
  entityType: 'map',
  components: [{
    id: 'map:scene',
    type: 'scene-environment',
    version: 3,
    presetKey: 'test-scene',
    mapAnchorMode: 'first-tile',
    mapOffset: [10, 2, 20],
    tileSpacing: [8, 6],
    tileSize: [7.5, 2, 5.5],
  }],
});

const spawnEntity = (id = 'spawn:player', tileX = 1, tileY = 1): IEntity => ({
  id,
  entityType: 'spawn-point',
  components: [{ id: `${id}:actor`, type: 'actor-spawn', version: 1, tileX, tileY }],
});

const presets: SceneEnvironmentPresetLibrary = {
  'test-scene': {
    presetKey: 'test-scene',
    name: 'Test Scene',
    clearColor: '#000000',
    lights: [],
    objects: [],
    models: [],
  },
};

const createDocument = (...entities: IEntity[]) => migrateDungeonMapToDocumentV2({
  presetKey: 'document-scene',
  name: 'Document Scene',
  map: createDungeonMapData({
    id: 'map:document-scene',
    width: 2,
    height: 2,
    createMapData: () => createEntityContainer(...entities),
  }),
}).document;

test('V1 地图级出生点迁移为 V2 tile 挂载并解析世界位置', () => {
  const document = createDocument(sceneEntity(), spawnEntity());
  const scene = resolveDungeonDocumentSceneEnvironment(document, presets);
  assert.equal(scene.mapEntity.id, 'map:entity');
  assert.equal(scene.component.id, 'map:scene');
  assert.equal(scene.preset.presetKey, 'test-scene');

  const spawn = resolveDungeonDocumentPlayerSpawn(document, presets);
  assert.equal(spawn.spawnPointEntity.id, 'spawn:player');
  assert.deepEqual(spawn.tilePosition, { x: 1, y: 1 });
  assert.deepEqual(spawn.worldPosition, [18, 3, 26]);
});

test('V2 出生点解析拒绝多个出生声明和越界坐标', () => {
  assert.throws(() => resolveDungeonDocumentPlayerSpawn(
    createDocument(sceneEntity(), spawnEntity('spawn:a'), spawnEntity('spawn:b')),
    presets,
  ), /多个启用的 actor-spawn/);
  assert.throws(() => resolveDungeonDocumentPlayerSpawn(
    createDocument(sceneEntity(), spawnEntity('spawn:outside', 2, 0)),
    presets,
  ), /超出地图/);
});

const attachment = (document: DungeonMapDocumentV2) => (
  document.components['spatial-attachment'] as DungeonMapSpatialAttachmentComponent[]
).find(({ entityId }) => entityId === 'spawn:player')!;

const nativeDocument = () => {
  const document = createDocument(sceneEntity());
  const entity = spawnEntity();
  delete entity.components[0].tileX;
  delete entity.components[0].tileY;
  const store = new DungeonMapDocumentStore(document);
  store.addEntityAt({ kind: 'tile', tileId: document.grid.tileIds[1] }, entity);
  return store.getDocument();
};

test('原生 tile 出生点不需要坐标字段；移动后以挂载位置解析', () => {
  const document = nativeDocument();
  assert.deepEqual(resolveDungeonDocumentPlayerSpawn(document, presets).tilePosition, { x: 1, y: 0 });
  attachment(document).targets = [{ kind: 'tile', tileId: document.grid.tileIds[2] }];
  // 即使收到陈旧字段，运行时也不能把它当作位置来源。
  document.components['actor-spawn'][0].tileX = 1;
  document.components['actor-spawn'][0].tileY = 1;
  const spawn = resolveDungeonDocumentPlayerSpawn(document, presets);
  assert.deepEqual(spawn.tilePosition, { x: 0, y: 1 });
  assert.deepEqual(spawn.worldPosition, [10, 3, 26]);
});

test('零个声明、禁用 Entity/Component 不会生成玩家', () => {
  assert.throws(() => resolveDungeonDocumentPlayerSpawn(createDocument(sceneEntity()), presets), /没有可用/);
  for (const disabled of ['entity', 'component']) {
    const document = nativeDocument();
    if (disabled === 'entity') document.entities.find(({ id }) => id === 'spawn:player')!.enabled = false;
    else document.components['actor-spawn'][0].enabled = false;
    assert.throws(() => resolveDungeonDocumentPlayerSpawn(document, presets), /没有可用/);
  }
  const document = createDocument(sceneEntity(), spawnEntity(), { ...spawnEntity('disabled'), enabled: false });
  assert.equal(resolveDungeonDocumentPlayerSpawn(document, presets).spawnPointEntity.id, 'spawn:player');
  document.entities.find(({ id }) => id === 'disabled')!.enabled = true;
  document.components['actor-spawn'].find(({ entityId }) => entityId === 'disabled')!.enabled = false;
  assert.equal(resolveDungeonDocumentPlayerSpawn(document, presets).spawnPointEntity.id, 'spawn:player');
});

test('同一个 Entity 的多个启用声明也必须拒绝', () => {
  const document = nativeDocument();
  document.components['actor-spawn'].push({ ...document.components['actor-spawn'][0], id: 'second' });
  assert.throws(() => resolveDungeonDocumentPlayerSpawn(document, presets), /多个启用/);
});

test('失效、地图级、多目标和禁用挂载均拒绝，不能回退到默认格', () => {
  for (const targets of [[], [{ kind: 'map' }], [{ kind: 'tile', tileId: 'missing' }],
    [{ kind: 'tile', tileId: 'tile:0,0' }, { kind: 'tile', tileId: 'tile:1,0' }]] as DungeonMapSpatialAttachmentComponent['targets'][]) {
    const document = nativeDocument();
    attachment(document).targets = targets;
    assert.throws(() => resolveDungeonDocumentPlayerSpawn(document, presets), /挂载/);
    assert.ok(validateDungeonMapDocumentV2(document).length > 0);
  }
  const document = nativeDocument();
  attachment(document).enabled = false;
  assert.throws(() => resolveDungeonDocumentPlayerSpawn(document, presets), /挂载/);
  const outside = nativeDocument();
  outside.grid.tileIds.push('outside-grid');
  attachment(outside).targets = [{ kind: 'tile', tileId: 'outside-grid' }];
  assert.throws(() => resolveDungeonDocumentPlayerSpawn(outside, presets), /挂载失效/);
});

test('旧地图级出生坐标必须完整合法，且同一 Entity 的声明不能冲突', () => {
  for (const value of [undefined, null, '1', -1, 0.5, 2, NaN]) {
    const entity = spawnEntity();
    entity.components[0].tileX = value;
    assert.throws(() => createDocument(sceneEntity(), entity), /迁移失败.*缺失、非法或超出地图/);
  }
  const entity = spawnEntity();
  entity.components.push({ ...entity.components[0], id: 'conflict', tileX: 0 });
  assert.throws(() => createDocument(sceneEntity(), entity), /迁移失败.*冲突/);
});

test('旧 V2/V3 文件读取升级，保存和 V1 投影往返只有挂载位置', () => {
  const oldV2 = nativeDocument();
  attachment(oldV2).targets = [{ kind: 'map' }];
  oldV2.components['actor-spawn'][0].tileX = 1;
  oldV2.components['actor-spawn'][0].tileY = 1;
  const upgraded = parseDungeonMapDocumentV2(oldV2);
  assert.deepEqual(attachment(upgraded).targets, [{ kind: 'tile', tileId: upgraded.grid.tileIds[3] }]);
  assert.equal(upgraded.components['actor-spawn'][0].tileX, undefined);
  assert.equal(oldV2.components['actor-spawn'][0].tileX, 1);
  const oldV3 = encodeDungeonMapDocumentV3(upgraded);
  oldV3.components = structuredClone(oldV2.components);
  assert.deepEqual(resolveDungeonDocumentPlayerSpawn(parseDungeonMapDocumentV3(oldV3), presets).tilePosition, { x: 1, y: 1 });
  let current = upgraded;
  for (let i = 0; i < 2; i++) {
    current = parseDungeonMapDocumentV3(encodeDungeonMapDocumentV3(current));
    current = encodeDungeonMapDocumentLibraryV2({ [current.identity.presetKey]: current })[current.identity.presetKey];
    const legacy = projectDungeonMapDocumentToLegacyMap(current);
    assert.ok(!legacy.data?.entities.some(({ entityType }) => entityType === 'spawn-point'));
    assert.equal(legacy.tiles[3].data?.entities.find(({ id }) => id === 'spawn:player')?.components[0].tileX, undefined);
    assert.deepEqual(resolveDungeonPlayerSpawn(legacy, presets).worldPosition, [18, 3, 26]);
    current = migrateDungeonMapToDocumentV2({ presetKey: current.identity.presetKey, name: 'Roundtrip', map: legacy }).document;
  }
});

test('直接读取旧 V1 使用同一迁移与解析链路', () => {
  const map = createDungeonMapData({ id: 'legacy', width: 2, height: 2,
    createMapData: () => createEntityContainer(sceneEntity(), spawnEntity()),
  });
  assert.deepEqual(resolveDungeonPlayerSpawn(map, presets).worldPosition, [18, 3, 26]);
  assert.equal(map.data?.entities[1].components[0].tileX, 1);
});


test('编辑器容器规则与组件默认值只允许 tile 空间出生位置', () => {
  const registry = new EntityTypeRegistry();
  registry.register(spawnDefinition);
  assert.equal(registry.canCreateIn('spawn-point', 'tile'), true);
  assert.equal(registry.canCreateIn('spawn-point', 'map'), false);
  assert.equal(registry.canCreateIn('spawn-point', 'tile-edge'), false);
  const component = actorSpawnDefinition.createDefault();
  assert.deepEqual(actorSpawnDefinition.fields, []);
  assert.equal('tileX' in component, false);
  assert.equal('tileY' in component, false);
  assert.deepEqual(actorSpawnDefinition.validate?.(component), []);
  const document = nativeDocument();
  const store = new DungeonMapDocumentStore(document);
  store.moveEntity('spawn:player', { kind: 'tile', tileId: document.grid.tileIds[1] }, { kind: 'tile', tileId: document.grid.tileIds[2] });
  assert.deepEqual(resolveDungeonDocumentPlayerSpawn(store.getDocument(), presets).tilePosition, { x: 0, y: 1 });
  store.undo();
  assert.deepEqual(resolveDungeonDocumentPlayerSpawn(store.getDocument(), presets).tilePosition, { x: 1, y: 0 });
  store.redo();
  assert.deepEqual(resolveDungeonDocumentPlayerSpawn(store.getDocument(), presets).tilePosition, { x: 0, y: 1 });
});

test('玩家初始格子、实占位和世界位置均来自解析后的 binding', () => {
  const document = nativeDocument();
  const spawn = resolveDungeonDocumentPlayerSpawn(document, presets);
  const runtime = createDungeonRuntime(document, spawn);
  assert.deepEqual(runtime.playerPosition, { tileX: 1, tileY: 0 });
  assert.deepEqual(runtime.playerWorldPosition, spawn.worldPosition);
  assert.equal(runtime.traversal.actors.get('$dungeon-player')?.tileIndex, 1);
});


test('V1 坐标按真实格子迁移，不依赖数组顺序；缺格时拒绝迁移', () => {
  const map = createDungeonMapData({ id: 'legacy-order', width: 2, height: 2,
    createMapData: () => createEntityContainer(sceneEntity(), spawnEntity('spawn:player', 1, 0)),
  });
  map.tiles = [...map.tiles].reverse();
  assert.deepEqual(resolveDungeonPlayerSpawn(map, presets).tilePosition, { x: 1, y: 0 });
  assert.deepEqual(map.tiles.map(({ x, y }) => [x, y]), [[1, 1], [0, 1], [1, 0], [0, 0]]);
  map.tiles = map.tiles.filter((_, index) => index !== 2);
  assert.throws(() => resolveDungeonPlayerSpawn(map, presets), /迁移失败.*格子坐标/);
});
