import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { createDungeonTraversalWorld } from './dungeonTraversal.ts';

const createWorld = () => {
  const document = migrateDungeonMapToDocumentV2({
    presetKey: 'traversal-test',
    name: 'Traversal Test',
    map: createDungeonMapData({ id: 'traversal-test', width: 5, height: 5 }),
  }).document;
  return createDungeonTraversalWorld(createDungeonRuntimeMap(document));
};

test('共享通行世界统一维护动态占位、移动和注销', () => {
  const world = createWorld();
  world.registerActor({
    id: 'player', kind: 'player', tileIndex: 0,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  world.registerActor({
    id: 'agent', kind: 'agent', tileIndex: 1,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  assert.equal(world.inspectStep('player', 0, 'east').blockedReason, 'occupied');
  world.moveActor('agent', 2);
  assert.equal(world.inspectStep('player', 0, 'east').blockedReason, undefined);
  world.unregisterActor('agent');
  assert.deepEqual([...world.occupantIdsByTile[2]], []);
});

test('路径预约是软代价数据，不会变成硬阻挡', () => {
  const world = createWorld();
  world.registerActor({
    id: 'agent:a', kind: 'agent', tileIndex: 0,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  world.replaceReservations('agent:b', [0, 1, 2], 1);
  assert.equal(world.reservationCount(1, 'agent:a'), 1);
  assert.equal(world.inspectStep('agent:a', 0, 'east').blockedReason, undefined);
  world.clearReservations('agent:b');
  assert.equal(world.reservationCount(1), 0);
});

test('可以查询连续移动 X 格的结果与完整合法方向集合', () => {
  const world = createWorld();
  world.registerActor({
    id: 'agent:mover', kind: 'agent', tileIndex: 12,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  world.registerActor({
    id: 'agent:blocker', kind: 'agent', tileIndex: 14,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });

  const east = world.inspectDirection('agent:mover', 12, 'east', 2);
  assert.equal(east.traversedSteps, 1);
  assert.deepEqual(east.tileIndices, [12, 13]);
  assert.equal(east.blockedReason, 'occupied');
  assert.deepEqual(east.blockingEntityIds, ['agent:blocker']);
  assert.deepEqual(world.getLegalDirections('agent:mover', 12, 2), ['north', 'south', 'west']);
  assert.throws(() => world.getLegalDirections('agent:mover', 12, 0), /正整数/);
});
