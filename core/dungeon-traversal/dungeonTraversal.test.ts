import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { createDungeonTraversalWorld } from './dungeonTraversal.ts';
import type { DungeonObstacleBinding } from '../dungeon-obstacle/dungeonObstacle.ts';

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
  world.replaceReservations('agent:b', [2, 3, 4], 1);
  assert.equal(world.reservationCount(1), 0);
  assert.equal(world.reservationCount(3), 1);
  assert.equal(world.reservationCount(4), 1);
  world.clearReservations('agent:b');
  assert.equal(world.reservationCount(3), 0);
  assert.equal(world.reservationCount(4), 0);
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

test('八方向能力按 Actor 独立生效，并只检查斜向目标格的动态占位', () => {
  const world = createWorld();
  world.registerActor({
    id: 'agent:four', kind: 'agent', tileIndex: 0,
    enabled: true, blocksMovement: true, movementProfileId: 'ground-four-way',
  });
  world.registerActor({
    id: 'agent:eight', kind: 'agent', tileIndex: 4,
    enabled: true, blocksMovement: true, movementProfileId: 'ground-eight-way',
  });
  assert.equal(world.inspectStep('agent:four', 0, 'south-east').blockedReason, 'direction-not-supported');
  assert.equal(world.inspectStep('agent:eight', 4, 'south-west').toTileIndex, 8);
  world.registerActor({
    id: 'agent:blocker', kind: 'agent', tileIndex: 8,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  assert.equal(world.inspectStep('agent:eight', 4, 'south-west').blockedReason, 'occupied');
});

test('中心 Actor 只阻挡目标格，整格 Actor 还会阻挡侧邻格斜向切角', () => {
  const world = createWorld();
  world.registerActor({
    id: 'agent:mover', kind: 'agent', tileIndex: 0,
    enabled: true, blocksMovement: true, spatialFootprint: 'center',
    movementProfileId: 'ground-eight-way',
  });
  world.registerActor({
    id: 'agent:blocker', kind: 'agent', tileIndex: 1,
    enabled: true, blocksMovement: true, spatialFootprint: 'center',
    movementProfileId: 'ground',
  });
  assert.equal(world.inspectStep('agent:mover', 0, 'south-east').blockedReason, undefined);
  world.actors.get('agent:blocker')!.spatialFootprint = 'full-tile';
  const blocked = world.inspectStep('agent:mover', 0, 'south-east');
  assert.equal(blocked.blockedReason, 'corner-blocked');
  assert.deepEqual(blocked.blockingEntityIds, ['agent:blocker']);
});

test('Tile 障碍按空间占位区分中心和整格，但目标格始终阻挡', () => {
  const document = migrateDungeonMapToDocumentV2({
    presetKey: 'traversal-obstacle-footprint-test',
    name: 'Traversal Obstacle Footprint Test',
    map: createDungeonMapData({ id: 'traversal-obstacle-footprint-test', width: 3, height: 3 }),
  }).document;
  const map = createDungeonRuntimeMap(document);
  const obstacle = (
    id: string,
    tileX: number,
    tileY: number,
    spatialFootprint?: 'center' | 'full-tile',
  ): DungeonObstacleBinding => ({
    entity: { id, entityType: 'obstacle', enabled: true, components: [] },
    component: {
      id: `${id}:movement`, type: 'movement-obstacle', version: 1,
      activeByDefault: true, ...(spatialFootprint ? { spatialFootprint } : {}),
    },
    placement: { kind: 'tile', tileX, tileY },
  });
  const inspect = (binding: DungeonObstacleBinding) => {
    const world = createDungeonTraversalWorld(map, [binding], new Map([[binding.entity.id, true]]));
    world.registerActor({
      id: 'agent:mover', kind: 'agent', tileIndex: 0,
      enabled: true, blocksMovement: true, movementProfileId: 'ground-eight-way',
    });
    return world.inspectStep('agent:mover', 0, 'south-east');
  };

  assert.equal(inspect(obstacle('center-side', 1, 0, 'center')).blockedReason, undefined);
  assert.equal(inspect(obstacle('full-side', 1, 0, 'full-tile')).blockedReason, 'corner-blocked');
  assert.equal(inspect(obstacle('legacy-side', 1, 0)).blockedReason, 'corner-blocked');
  assert.equal(inspect(obstacle('center-target', 1, 1, 'center')).blockedReason, 'movement-obstacle');
});
