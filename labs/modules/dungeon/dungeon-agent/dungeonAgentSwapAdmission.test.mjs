import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntityContainer } from '../../../../core/entity/entity.utils.ts';
import { createDungeonMapData } from '../../../../core/map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntime, setDungeonRuntimePlayerPosition } from '../../../../core/dungeon-runtime/dungeonRuntime.ts';
import { createDungeonAgentRuntimeState, startDungeonAgentMovement, updateDungeonAgentMovements } from '../../../../core/dungeon-agent/dungeonAgent.runtime.ts';
import { startDungeonPlayerMovement } from '../../../../core/dungeon-player-movement/dungeonPlayerMovement.ts';
import { allocateDungeonAgentStorage } from './dungeonAgentStorage.memory.ts';

const movementOptions = { movementTimingMode: 'seconds-per-tile', movementSecondsPerTile: 1,
  resolveWorldPosition: position => [position.tileX, 0, position.tileY] };

function fixture(diagonal = false) {
  const entity = { id: 'guard', name: 'Guard', entityType: 'dungeon-agent', components: [
    { id: 'guard:grid', type: 'grid-agent', version: 1, initialFacing: 'east', blocksMovement: true,
      actionPeriod: 1, priority: 7, movementProfileId: 'ground' },
    { id: 'guard:controller', type: 'agent-controller', version: 1, controllerId: 'stationary', parameters: {} },
  ] };
  const document = migrateDungeonMapToDocumentV2({ presetKey: 'shared-swap', name: 'Shared swap',
    map: createDungeonMapData({ id: 'shared-swap', width: 4, height: diagonal ? 4 : 1,
      createTileData: ({ x, y }) => x === (diagonal ? 2 : 1) && y === (diagonal ? 2 : 0) ? createEntityContainer(entity) : undefined }) }).document;
  const start = diagonal ? 1 : 0;
  const runtime = createDungeonRuntime(document, { tilePosition: { x: start, y: start }, worldPosition: [start, 0, start] }, 'east');
  if (diagonal) runtime.traversal.setActorMovementProfile('$dungeon-player', 'ground-eight-way');
  const engine = runtime.movementResolver;
  engine.externallyDriven = true;
  const storage = allocateDungeonAgentStorage(1, 'shared-swap', runtime);
  const state = createDungeonAgentRuntimeState(runtime.map, runtime.traversal, engine, storage.storage);
  runtime.traversal.body('guard').onPlayerPush = 'swap';
  return { runtime, engine, state, storage };
}

for (const progress of [.2, .6]) test(`shared Agent move at ${progress} progress can be overtaken by player swap`, () => {
  const { runtime, engine, state, storage } = fixture();
  const started = startDungeonAgentMovement(state, runtime.map, 'guard', 'east', { durationSeconds: 1 });
  assert.equal(started.started, true);
  const oldId = state.agents[0].movement.requestId;
  assert.equal(engine.actionStateOf('guard').kind, 'move');
  assert.equal(storage.state.agents.get('guard').requestId, oldId);
  engine.tick(progress, delta => updateDungeonAgentMovements(state, delta));
  if (progress > .5) setDungeonRuntimePlayerPosition(runtime, { tileX: 1, tileY: 0 });
  const guard = runtime.traversal.body('guard');
  const visual = { ...guard.pose }, committed = guard.tileIndex;
  const result = startDungeonPlayerMovement(runtime, 'east', movementOptions);
  assert.equal(result.actionKind, 'swap');
  assert.equal(result.started, true);
  assert.equal(runtime.playerMovement, null);
  assert.deepEqual(guard.pose, visual);
  assert.equal(guard.tileIndex, committed);
  assert.equal(engine.getActiveRequest('guard'), undefined);
  assert.equal(storage.state.agents.get('guard').movementKind, null);
  assert.equal(state.agents[0].navigationPlan, undefined);
  engine.tick(result.actionDurationSeconds, delta => updateDungeonAgentMovements(state, delta));
  assert.equal(guard.tileIndex, progress > .5 ? 1 : 0);
  assert.equal(state.agents[0].tileIndex, guard.tileIndex);
});

test('an unrelated Agent track does not masquerade as an interruptible move', () => {
  const { runtime, engine, state } = fixture();
  assert.equal(startDungeonAgentMovement(state, runtime.map, 'guard', 'east', { durationSeconds: 1 }).started, true);
  const old = engine.getActiveRequest('guard');
  state.agents[0].movement = { kind: 'turn', fromTileIndex: 1, toTileIndex: 1,
    fromFacing: 'east', toFacing: 'north', elapsedSeconds: 0, durationSeconds: 1 };
  assert.equal(engine.actionStateOf('guard').kind, 'track');
  const result = engine.requestSwap('$dungeon-player', 'guard', 0, 1, true, { basePriority: 1000 });
  assert.equal(result.reason, 'movement-in-progress');
  assert.equal(engine.getActiveRequest('guard')?.id, old.id);
});

test('diagonal player swap overtakes a four-way Agent and clears its shared movement track', () => {
  const { runtime, engine, state, storage } = fixture(true);
  assert.equal(startDungeonAgentMovement(state, runtime.map, 'guard', 'east', { durationSeconds: 1 }).started, true);
  engine.tick(.2, delta => updateDungeonAgentMovements(state, delta));
  const guard = runtime.traversal.body('guard'), pose = { ...guard.pose };
  const result = startDungeonPlayerMovement(runtime, 'south-east', movementOptions);
  assert.equal(result.actionKind, 'swap');
  assert.deepEqual(guard.pose, pose);
  assert.equal(engine.getActiveRequest('guard'), undefined);
  assert.equal(storage.state.agents.get('guard').movementKind, null);
  engine.tick(result.actionDurationSeconds, delta => updateDungeonAgentMovements(state, delta));
  assert.deepEqual(runtime.playerPosition, { tileX: 2, tileY: 2 });
  assert.equal(guard.tileIndex, 5);
  assert.equal(state.agents[0].tileIndex, 5);
  assert.equal(guard.movementProfileId, 'ground');
});
