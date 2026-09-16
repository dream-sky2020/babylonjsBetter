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

test('V2 map 空间挂载直接解析场景环境与玩家出生点', () => {
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
