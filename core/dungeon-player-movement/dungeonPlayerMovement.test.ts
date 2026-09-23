import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import type { DungeonRuntime } from '../dungeon-runtime/dungeonRuntime.types.ts';
import { createDungeonTraversalWorld, DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '../dungeon-traversal/index.ts';
import { createDungeonMovementResolver } from '../dungeon-movement/index.ts';
import {
  inspectDungeonPlayerMovement,
  startDungeonPlayerMovement,
  updateDungeonPlayerMovement,
} from './dungeonPlayerMovement.ts';

const runtimeForLine = (): DungeonRuntime => {
  const legacyMap = createDungeonMapData({ id: 'movement-line', width: 4, height: 1, mode: 'bounded' });
  const document = migrateDungeonMapToDocumentV2({
    presetKey: 'movement-line',
    name: 'Movement Line',
    map: legacyMap,
  }).document;
  const map = createDungeonRuntimeMap(document);
  const traversal = createDungeonTraversalWorld(map);
  const movementResolver = createDungeonMovementResolver(traversal);
  traversal.registerActor({
    id: DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID, kind: 'player', tileIndex: 0,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  return {
    map,
    traversal,
    movementResolver,
    obstacles: [],
    playerPosition: { tileX: 0, tileY: 0 },
    playerFacing: 'east',
    playerWorldPosition: [0, 0, 0],
    playerWorldRotationY: Math.PI / 2,
    playerMovement: null,
    obstacleStates: new Map(),
  };
};

const runtimeForSquare = (): DungeonRuntime => {
  const document = migrateDungeonMapToDocumentV2({
    presetKey: 'movement-square',
    name: 'Movement Square',
    map: createDungeonMapData({ id: 'movement-square', width: 3, height: 3, mode: 'bounded' }),
  }).document;
  const map = createDungeonRuntimeMap(document);
  const traversal = createDungeonTraversalWorld(map);
  const movementResolver = createDungeonMovementResolver(traversal);
  traversal.registerActor({
    id: DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID, kind: 'player', tileIndex: 0,
    enabled: true, blocksMovement: true, movementProfileId: 'ground-eight-way',
  });
  return {
    map, traversal, movementResolver, obstacles: [],
    playerPosition: { tileX: 0, tileY: 0 }, playerFacing: 'south',
    playerWorldPosition: [0, 0, 0], playerWorldRotationY: 0,
    playerMovement: null, obstacleStates: new Map(),
  };
};

const startEast = (runtime: DungeonRuntime) => startDungeonPlayerMovement(runtime, 'east', {
  movementTimingMode: 'world-units-per-second',
  movementSpeed: 1,
  turnTimingMode: 'radians-per-second',
  turnSpeed: Math.PI * 2,
  resolveWorldPosition: ({ tileX }) => [tileX, 0, 0],
});

test('完成格步后返回未消费的帧时间供下一格续接', () => {
  const runtime = runtimeForLine();
  assert.equal(startEast(runtime).started, true);

  const first = updateDungeonPlayerMovement(runtime, 1.25);
  assert.equal(first.completed, true);
  assert.equal(first.consumedSeconds, 1);
  assert.equal(first.remainingSeconds, 0.25);
  assert.deepEqual(runtime.playerPosition, { tileX: 1, tileY: 0 });

  assert.equal(startEast(runtime).started, true);
  const second = updateDungeonPlayerMovement(runtime, first.remainingSeconds);
  assert.equal(second.completed, false);
  assert.equal(second.remainingSeconds, 0);
  assert.equal(runtime.playerWorldPosition[0], 1.25);
});

test('没有活动格步时不会吞掉帧时间', () => {
  const runtime = runtimeForLine();
  const result = updateDungeonPlayerMovement(runtime, 0.016);
  assert.equal(result.active, false);
  assert.equal(result.consumedSeconds, 0);
  assert.equal(result.remainingSeconds, 0.016);
});

test('玩家通过共享通行世界被阻挡型 Agent 挡住', () => {
  const runtime = runtimeForLine();
  runtime.traversal.registerActor({
    id: 'agent:blocker', kind: 'agent', tileIndex: 1,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  const inspection = inspectDungeonPlayerMovement(runtime, 'east');
  assert.equal(inspection.blockedReason, 'movement-obstacle');
  assert.deepEqual(inspection.blockedObstacleIds, ['agent:blocker']);
  assert.equal(
    inspectDungeonPlayerMovement(runtime, 'east', { restrictMovementObstacles: false }).blockedReason,
    'movement-obstacle',
  );
});

test('改变朝向的第一格不会在位移完成后等待旋转', () => {
  const runtime = runtimeForLine();
  runtime.playerFacing = 'west';
  runtime.playerWorldRotationY = -Math.PI / 2;
  const started = startDungeonPlayerMovement(runtime, 'east', {
    movementTimingMode: 'world-units-per-second',
    movementSpeed: 1,
    turnTimingMode: 'radians-per-second',
    turnSpeed: Math.PI / 4,
    resolveWorldPosition: ({ tileX }) => [tileX, 0, 0],
  });
  assert.equal(started.started, true);

  const result = updateDungeonPlayerMovement(runtime, 1.25);
  assert.equal(result.completed, true);
  assert.equal(result.consumedSeconds, 1);
  assert.equal(result.remainingSeconds, 0.25);
  assert.deepEqual(runtime.playerPosition, { tileX: 1, tileY: 0 });
  assert.equal(runtime.playerFacing, 'east');
  assert.equal(runtime.playerWorldRotationY, -Math.PI * 3 / 2);
});

test('玩家的虚占位被更高优先级请求抢走时，从当前视觉位置回退到实占位', () => {
  const runtime = runtimeForLine();
  runtime.traversal.registerActor({
    id: 'agent:priority', kind: 'agent', tileIndex: 2,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  assert.equal(startEast(runtime).started, true);
  updateDungeonPlayerMovement(runtime, 0.3);
  assert.equal(runtime.playerWorldPosition[0], 0.3);
  assert.deepEqual(runtime.playerPosition, { tileX: 0, tileY: 0 });

  const stolen = runtime.movementResolver.requestMove({
    actorId: 'agent:priority', direction: 'west', durationSeconds: 1,
    basePriority: 2000, progressWeight: 1, commitProgress: 0.5,
  });
  assert.equal(stolen.accepted, true);
  const rollbackHalfway = updateDungeonPlayerMovement(runtime, 0.15);
  assert.equal(rollbackHalfway.completed, false);
  assert.ok(Math.abs(runtime.playerWorldPosition[0] - 0.15) < 1e-9);
  assert.equal(runtime.playerMovement?.kind, 'rollback');

  const rollbackCompleted = updateDungeonPlayerMovement(runtime, 0.15);
  assert.equal(rollbackCompleted.completed, true);
  assert.equal(runtime.playerWorldPosition[0], 0);
  assert.deepEqual(runtime.playerPosition, { tileX: 0, tileY: 0 });
  assert.deepEqual([...runtime.traversal.occupantIdsByTile[0]], [DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID]);
});

test('玩家八方向格步按真实距离计时，并保留四方向逻辑朝向', () => {
  const runtime = runtimeForSquare();
  const started = startDungeonPlayerMovement(runtime, 'south-east', {
    movementTimingMode: 'world-units-per-second', movementSpeed: 1,
    resolveWorldPosition: ({ tileX, tileY }) => [tileX, 0, tileY],
  });
  assert.equal(started.started, true);
  assert.ok(Math.abs((runtime.playerMovement?.movementDurationSeconds ?? 0) - Math.SQRT2) < 1e-9);
  const completed = updateDungeonPlayerMovement(runtime, Math.SQRT2);
  assert.equal(completed.completed, true);
  assert.deepEqual(runtime.playerPosition, { tileX: 1, tileY: 1 });
  assert.equal(runtime.playerFacing, 'south');
  assert.ok(Math.abs(runtime.playerWorldRotationY - Math.PI / 4) < 1e-9);
});
