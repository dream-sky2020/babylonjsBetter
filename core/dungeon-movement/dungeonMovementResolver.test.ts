import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { createDungeonTraversalWorld } from '../dungeon-traversal/index.ts';
import { createDungeonMovementResolver } from './dungeonMovementResolver.ts';

const createResolver = () => {
  const document = migrateDungeonMapToDocumentV2({
    presetKey: 'movement-resolver-test',
    name: 'Movement Resolver Test',
    map: createDungeonMapData({ id: 'movement-resolver-test', width: 3, height: 1 }),
  }).document;
  const traversal = createDungeonTraversalWorld(createDungeonRuntimeMap(document));
  traversal.registerActor({
    id: 'agent:left', kind: 'agent', tileIndex: 0,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  traversal.registerActor({
    id: 'agent:right', kind: 'agent', tileIndex: 2,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  return { traversal, resolver: createDungeonMovementResolver(traversal) };
};

test('申请虚占位后立即开始 Forward，但实占位留在起点直到 Commit', () => {
  const { traversal, resolver } = createResolver();
  const requested = resolver.requestMove({
    actorId: 'agent:left', direction: 'east', durationSeconds: 1,
    commitProgress: 0.5, basePriority: 0, progressWeight: 1,
  });
  assert.equal(requested.accepted, true);
  assert.deepEqual([...traversal.occupantIdsByTile[0]], ['agent:left']);
  assert.deepEqual([...traversal.occupantIdsByTile[1]], []);
  assert.equal(resolver.movementReservationsByTile[1].has('agent:left'), true);

  const beforeCommit = resolver.advanceActor('agent:left', 0.49);
  assert.equal(beforeCommit.visualProgress, 0.49);
  assert.equal(beforeCommit.committed, false);
  assert.deepEqual([...traversal.occupantIdsByTile[0]], ['agent:left']);

  const atCommit = resolver.advanceActor('agent:left', 0.01);
  assert.equal(atCommit.committed, true);
  assert.deepEqual([...traversal.occupantIdsByTile[0]], []);
  assert.deepEqual([...traversal.occupantIdsByTile[1]], ['agent:left']);
  assert.equal(resolver.movementReservationsByTile[1].has('agent:left'), false);
});

test('高优先级请求抢走虚占位后，原 Forward 从当前视觉进度生成 Rollback', () => {
  const { traversal, resolver } = createResolver();
  resolver.requestMove({
    actorId: 'agent:left', direction: 'east', durationSeconds: 1,
    commitProgress: 0.5, basePriority: 0, progressWeight: 1,
  });
  resolver.advanceActor('agent:left', 0.3);

  const stolen = resolver.requestMove({
    actorId: 'agent:right', direction: 'west', durationSeconds: 1,
    commitProgress: 0.5, basePriority: 10, progressWeight: 1,
  });
  assert.equal(stolen.accepted, true);
  assert.equal(resolver.getActiveRequest('agent:left')?.state, 'rollback');
  assert.equal(resolver.movementReservationsByTile[1].has('agent:left'), false);
  assert.equal(resolver.movementReservationsByTile[1].has('agent:right'), true);
  assert.deepEqual([...traversal.occupantIdsByTile[0]], ['agent:left']);

  const rollback = resolver.advanceActor('agent:left', 0.15);
  assert.equal(rollback.state, 'rollback');
  assert.ok(Math.abs(rollback.visualProgress - 0.15) < 1e-9);
  const finished = resolver.advanceActor('agent:left', 0.15);
  assert.equal(finished.rolledBack, true);
  assert.equal(finished.visualProgress, 0);
  assert.deepEqual([...traversal.occupantIdsByTile[0]], ['agent:left']);
});

test('Commit 后目标成为实占位，不再允许普通请求抢占', () => {
  const { resolver } = createResolver();
  resolver.requestMove({
    actorId: 'agent:left', direction: 'east', durationSeconds: 1,
    commitProgress: 0.5, basePriority: 0, progressWeight: 1,
  });
  resolver.advanceActor('agent:left', 0.5);
  const rejected = resolver.requestMove({
    actorId: 'agent:right', direction: 'west', durationSeconds: 1,
    basePriority: 100,
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.blockedReason, 'occupied');
});

test('同一目标的最终虚占位所有者由优先级决定，而不是请求调用顺序', () => {
  const firstOrder = createResolver();
  firstOrder.resolver.requestMove({
    actorId: 'agent:left', direction: 'east', durationSeconds: 1, basePriority: 1,
  });
  firstOrder.resolver.requestMove({
    actorId: 'agent:right', direction: 'west', durationSeconds: 1, basePriority: 10,
  });
  assert.deepEqual(
    [...firstOrder.resolver.movementReservationsByTile[1].keys()],
    ['agent:right'],
  );

  const reverseOrder = createResolver();
  reverseOrder.resolver.requestMove({
    actorId: 'agent:right', direction: 'west', durationSeconds: 1, basePriority: 10,
  });
  const lower = reverseOrder.resolver.requestMove({
    actorId: 'agent:left', direction: 'east', durationSeconds: 1, basePriority: 1,
  });
  assert.equal(lower.accepted, false);
  assert.deepEqual(
    [...reverseOrder.resolver.movementReservationsByTile[1].keys()],
    ['agent:right'],
  );
});

test('可在运行时更新移动进度权重 X', () => {
  const { resolver } = createResolver();
  resolver.updateConfig({ progressWeight: 3.5 });
  assert.equal(resolver.config.progressWeight, 3.5);
  assert.throws(() => resolver.updateConfig({ progressWeight: -1 }), /非负有限数/);
});

test('相交的两条斜向路径通过共享 Point 预约参与优先级仲裁', () => {
  const document = migrateDungeonMapToDocumentV2({
    presetKey: 'diagonal-crossing-test',
    name: 'Diagonal Crossing Test',
    map: createDungeonMapData({ id: 'diagonal-crossing-test', width: 2, height: 2 }),
  }).document;
  const traversal = createDungeonTraversalWorld(createDungeonRuntimeMap(document));
  traversal.registerActor({
    id: 'agent:nw', kind: 'agent', tileIndex: 0,
    enabled: true, blocksMovement: true, movementProfileId: 'ground-eight-way',
  });
  traversal.registerActor({
    id: 'agent:ne', kind: 'agent', tileIndex: 1,
    enabled: true, blocksMovement: true, movementProfileId: 'ground-eight-way',
  });
  const resolver = createDungeonMovementResolver(traversal);
  const first = resolver.requestMove({
    actorId: 'agent:nw', direction: 'south-east', durationSeconds: 1, basePriority: 10,
  });
  const second = resolver.requestMove({
    actorId: 'agent:ne', direction: 'south-west', durationSeconds: 1, basePriority: 1,
  });
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(second.blockedReason, 'reservation-conflict');
  const pointIndex = first.request?.crossingPointIndex;
  assert.equal(pointIndex === undefined ? false : resolver.movementReservationsByPoint[pointIndex].has('agent:nw'), true);
});
