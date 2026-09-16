import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectDungeonPlayerMovement } from '../dungeon-player-movement/dungeonPlayerMovement.ts';
import { scanDungeonDocumentObstacles, scanDungeonObstacles } from '../dungeon-obstacle/dungeonObstacle.ts';
import type { DungeonRuntime } from './dungeonRuntime.types.ts';
import { createEntityContainer } from '../entity/entity.utils.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import type { DungeonMapPreset } from '../map/dungeonMap.types.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap, getDungeonRuntimeNeighbor } from './dungeonRuntimeMap.ts';

const documentFrom = (map: DungeonMapPreset['map']) => migrateDungeonMapToDocumentV2({
  presetKey: 'runtime-test',
  name: 'Runtime Test',
  map,
}).document;

const runtimeFor = (map: DungeonRuntime['map']): DungeonRuntime => ({
  map,
  obstacles: [],
  playerPosition: { tileX: 0, tileY: 0 },
  playerFacing: 'east',
  playerWorldPosition: [0, 0, 0],
  playerWorldRotationY: 0,
  playerMovement: null,
  obstacleStates: new Map(),
});

test('编译拓扑直接解析普通相邻格和循环接缝', () => {
  const bounded = createDungeonRuntimeMap(documentFrom(createDungeonMapData({
    id: 'bounded', width: 2, height: 1, mode: 'bounded',
  })));
  assert.deepEqual(getDungeonRuntimeNeighbor(bounded, { tileX: 0, tileY: 0 }, 'east'), {
    tileX: 1, tileY: 0,
  });
  assert.equal(getDungeonRuntimeNeighbor(bounded, { tileX: 1, tileY: 0 }, 'east'), undefined);

  const loop = createDungeonRuntimeMap(documentFrom(createDungeonMapData({
    id: 'loop', width: 2, height: 1, mode: 'loop',
  })));
  assert.deepEqual(getDungeonRuntimeNeighbor(loop, { tileX: 1, tileY: 0 }, 'east'), {
    tileX: 0, tileY: 0,
  });
  const runtime = runtimeFor(loop);
  runtime.playerPosition = { tileX: 1, tileY: 0 };
  const movement = inspectDungeonPlayerMovement(runtime, 'east');
  assert.equal(movement.blockedReason, undefined);
  assert.deepEqual(movement.to, { tileX: 0, tileY: 0 });
});

test('V2 ECS 阻碍扫描与旧嵌套地图产生相同绑定', () => {
  const map = createDungeonMapData({
    id: 'obstacles',
    width: 2,
    height: 1,
    createTileData: ({ x }) => x !== 1 ? undefined : createEntityContainer({
      id: 'obstacle:tile',
      entityType: 'obstacle',
      components: [{
        id: 'obstacle:tile:movement',
        type: 'movement-obstacle',
        version: 1,
        activeByDefault: true,
      }],
    }),
  });
  const legacy = scanDungeonObstacles(map);
  const document = documentFrom(map);
  const native = scanDungeonDocumentObstacles(document);
  assert.deepEqual(native, legacy);

  const runtime: DungeonRuntime = {
    ...runtimeFor(createDungeonRuntimeMap(document)),
    obstacles: native,
    obstacleStates: new Map(native.map(({ entity, component }) => [entity.id, component.activeByDefault])),
  };
  const movement = inspectDungeonPlayerMovement(runtime, 'east');
  assert.equal(movement.blockedReason, 'movement-obstacle');
  assert.deepEqual(movement.blockedObstacleIds, ['obstacle:tile']);
});
