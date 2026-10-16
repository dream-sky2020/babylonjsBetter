import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../kit/shared-memory/LabMemory.ts';
import { createDungeonMapData } from '../../../../core/map/dungeonMap.create.ts';
import { createEntityContainer } from '../../../../core/entity/entity.utils.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntime } from '../../../../core/dungeon-runtime/dungeonRuntime.ts';
import { applyDungeonRuntimeSaveState, createDungeonRuntimeSaveState } from '../../../../core/dungeon-runtime-save/dungeonRuntimeSave.ts';
import { createDungeonTraversalWorld, DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '../../../../core/dungeon-traversal/index.ts';
import { createDungeonMovementResolver } from '../../../../core/dungeon-movement/index.ts';
import { startDungeonPlayerMovement, updateDungeonPlayerMovement, type DungeonPlayerMovementOptions } from '../../../../core/dungeon-player-movement/dungeonPlayerMovement.ts';
import { DungeonAgentSystem } from '../../../../core/dungeon-agent/dungeonAgentSystem.ts';
import { createDefaultDungeonAgentControllerRegistry } from '../../../../core/dungeon-agent/dungeonAgent.controllers.ts';
import { startDungeonAgentMovement } from '../../../../core/dungeon-agent/dungeonAgent.runtime.ts';
import type { DungeonPlayerSpawnBinding } from '../../../../core/dungeon-player-spawn';
import { allocateDungeonPlayerStateData, allocateDungeonObstacleStateData, DUNGEON_PLAYER_STATE_MEMORY, DUNGEON_OBSTACLE_STATE_MEMORY } from './dungeonRuntime.memory.ts';
import { allocateDungeonTraversalStateData, DUNGEON_TRAVERSAL_STATE_MEMORY, type DungeonTraversalOwnedData } from '../dungeon-traversal/dungeonTraversal.memory.ts';
import { allocateDungeonMovementStateData, DUNGEON_MOVEMENT_STATE_MEMORY, type DungeonMovementOwnedData } from '../dungeon-movement/dungeonMovement.memory.ts';
import { allocateDungeonAgentStorage } from '../dungeon-agent/dungeonAgentStorage.memory.ts';
import { DUNGEON_AGENT_STATE_MEMORY } from '../dungeon-agent/dungeonAgent.memory.ts';
import { DUNGEON_AGENT_CONTROLLER_MEMORY, DUNGEON_AGENT_SETTINGS_MEMORY } from '../dungeon-agent/dungeonAgentController.memory.ts';
import { DUNGEON_AGENT_NAVIGATION_MEMORY } from '../dungeon-agent/dungeonAgentNavigation.memory.ts';

const candidate = (loadId = 1, withAgent = false) => {
  const entity = { id: 'guard', name: 'Guard', entityType: 'dungeon-agent', components: [
    { id: 'grid', type: 'grid-agent', version: 1, initialFacing: 'east', blocksMovement: true,
      actionPeriod: 1, priority: 7, movementProfileId: 'ground' },
    { id: 'controller', type: 'agent-controller', version: 1, controllerId: 'stationary', parameters: {} },
  ] };
  const document = migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'Test',
    map: createDungeonMapData({ id: 'test', width: 4, height: 1,
      createTileData: ({ x }) => withAgent && x === 2 ? createEntityContainer(entity) : undefined }) }).document;
  const spawn = { tilePosition: { x: 0, y: 0 }, worldPosition: [0, 0, 0] } as unknown as DungeonPlayerSpawnBinding;
  const player = allocateDungeonPlayerStateData(loadId, 'test', spawn, 'east');
  const obstacles = allocateDungeonObstacleStateData(loadId, 'test', []);
  let traversal!: DungeonTraversalOwnedData, movement!: DungeonMovementOwnedData;
  const runtime = createDungeonRuntime(document, spawn, 'east', { storage: {
    player: () => player, obstacles: () => obstacles,
    traversal: map => traversal = allocateDungeonTraversalStateData(loadId, 'test', map.topology.tileIds.length),
    movement: world => movement = allocateDungeonMovementStateData(loadId, 'test', world.occupantIdsByTile.length, world.map.topology.pointIds.length),
  } });
  return { runtime, player, obstacles, traversal, movement };
};
const options: DungeonPlayerMovementOptions = { movementTimingMode: 'seconds-per-tile', movementSecondsPerTile: 1,
  resolveWorldPosition: (position: { tileX: number; tileY: number }) => [position.tileX, 0, position.tileY] as const };

test('host-created records own player, occupancy, requests, indexes and sequence through commit and completion', () => {
  const data = candidate(), registry = new LabMemoryRegistry(), scope = registry.scope('loader');
  scope.acquire(DUNGEON_PLAYER_STATE_MEMORY).replace(data.player);
  scope.acquire(DUNGEON_OBSTACLE_STATE_MEMORY).replace(data.obstacles);
  scope.acquire(DUNGEON_TRAVERSAL_STATE_MEMORY).replace(data.traversal);
  scope.acquire(DUNGEON_MOVEMENT_STATE_MEMORY).replace(data.movement);
  assert.equal(data.runtime.traversal.storage, data.traversal);
  assert.equal(data.runtime.movementResolver.storage, data.movement);
  assert.ok('value' in Object.getOwnPropertyDescriptor(data.player, 'playerPosition')!);
  assert.ok('value' in Object.getOwnPropertyDescriptor(data.movement, 'config')!);
  assert.equal(startDungeonPlayerMovement(data.runtime, 'east', options).started, true);
  const id = data.player.playerMovement!.requestId!;
  assert.equal(data.movement.activeRequestIdByActor.get(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID), id);
  assert.equal(data.movement.nextRequestSequence, 2);
  updateDungeonPlayerMovement(data.runtime, 0.25);
  assert.equal(data.player.playerPosition.tileX, 0);
  assert.equal(data.player.playerWorldPosition[0], 0.25);
  updateDungeonPlayerMovement(data.runtime, 0.25);
  assert.equal(data.player.playerPosition.tileX, 1);
  assert.equal(data.traversal.occupantIdsByTile[1].has(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID), true);
  data.runtime.movementResolver.updateConfig({ commitProgress: 0.75 });
  assert.equal(data.movement.config.commitProgress, 0.75);
  updateDungeonPlayerMovement(data.runtime, 0.5);
  assert.equal(data.player.playerMovement, null);
  assert.equal(data.movement.activeRequests.size, 0);
  assert.equal(data.movement.activeRequestIdByActor.size, 0);
  data.runtime.traversal.replaceReservations('path', [0, 1, 2], 1);
  assert.deepEqual([...data.traversal.pathReservationTileIndicesByActor.get('path')!], [1, 2]);
  data.runtime.traversal.clearReservations('path');
  assert.equal(data.traversal.pathReservationTileIndicesByActor.has('path'), false);
  data.player.playerWorldPosition = [5, 0, 0];
  assert.equal(data.runtime.playerWorldPosition, data.player.playerWorldPosition);
  data.runtime.playerWorldPosition = [6, 0, 0];
  assert.equal(data.player.playerWorldPosition[0], 6);
});

test('shared storage preserves pre-commit preemption, continuous rollback and reservation cleanup', () => {
  const data = candidate();
  startDungeonPlayerMovement(data.runtime, 'east', options);
  updateDungeonPlayerMovement(data.runtime, 0.2);
  data.runtime.traversal.registerActor({ id: 'rival', kind: 'agent', tileIndex: 2, enabled: true,
    blocksMovement: true, movementProfileId: 'ground' });
  assert.equal(data.runtime.movementResolver.requestMove({ actorId: 'rival', direction: 'west',
    durationSeconds: 1, basePriority: 2000 }).accepted, true);
  assert.equal(data.movement.activeRequests.get(data.player.playerMovement!.requestId!)!.state, 'rollback');
  updateDungeonPlayerMovement(data.runtime, 0.1);
  assert.ok(Math.abs(data.player.playerWorldPosition[0] - 0.1) < 1e-9);
  updateDungeonPlayerMovement(data.runtime, 0.1);
  assert.equal(data.player.playerPosition.tileX, 0);
  assert.equal(data.player.playerWorldPosition[0], 0);
  assert.equal(data.player.playerMovement, null);
  assert.equal(data.movement.activeRequestIdByActor.has(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID), false);
  assert.equal(data.movement.movementReservationsByTile[1].has('rival'), true);
});

test('Agent authority lives in shallow domain records, including replaced movement, plans, overrides and clocks', () => {
  const data = candidate(1, true), owned = allocateDungeonAgentStorage(1, 'test');
  const system = new DungeonAgentSystem(data.runtime, createDefaultDungeonAgentControllerRegistry(), owned.storage);
  const scope = new LabMemoryRegistry().scope('dungeon-agent');
  scope.acquire(DUNGEON_AGENT_STATE_MEMORY).replace(owned.state);
  scope.acquire(DUNGEON_AGENT_CONTROLLER_MEMORY).replace(owned.controllers);
  scope.acquire(DUNGEON_AGENT_SETTINGS_MEMORY).replace(owned.settings);
  scope.acquire(DUNGEON_AGENT_NAVIGATION_MEMORY).replace(owned.navigation);
  const agent = system.state.agents[0]!, row = owned.state.agents.get('guard')!;
  assert.ok('value' in Object.getOwnPropertyDescriptor(row, 'movement')!);
  assert.equal('binding' in row, false);
  startDungeonAgentMovement(system.state, data.runtime.map, 'guard', 'east', { durationSeconds: 1 });
  assert.equal(owned.state.activeAgentIds.has('guard'), true);
  assert.equal(row.movement, agent.movement);
  system.update(0.25);
  assert.equal(row.visualProgress, 0.25);
  assert.equal(owned.controllers.decisionElapsed, 0);
  system.update(0.05);
  assert.equal(owned.controllers.decisionElapsed, 0.05);
  agent.navigationPlan = { targetTileIndex: 3, tileIndices: [2, 3], directions: ['east'],
    nextStepIndex: 0, totalCost: 1, visitedCount: 2, planSequence: 1 };
  assert.equal(owned.navigation.agents.get('guard')!.plan, agent.navigationPlan);
  system.update(0.7);
  assert.equal(row.tileIndex, 3); assert.equal(row.movement, null);
  assert.equal(owned.state.activeAgentIds.size, 0);
  assert.equal(owned.navigation.agents.get('guard')!.nextStepIndex, 1);
  agent.controllerOverride = { controllerId: 'stationary', parameters: { test: 1 } };
  assert.equal(owned.controllers.agents.get('guard')!.controllerOverride, agent.controllerOverride);
  owned.controllers.agents.get('guard')!.controllerState = { seed: 42 };
  assert.deepEqual(agent.controllerState, { seed: 42 });
  system.state.turnNumber = 5; assert.equal(owned.controllers.turnNumber, 5);
  owned.settings.controllersEnabled = false; assert.equal(system.settings.controllersEnabled, false);
  system.update(0.01); assert.equal(owned.controllers.decisionElapsed, 0);
});

test('failed candidates and old systems cannot overwrite the active shared session', () => {
  const first = candidate(1), next = candidate(2), registry = new LabMemoryRegistry();
  const handle = registry.scope('loader').acquire(DUNGEON_PLAYER_STATE_MEMORY);
  handle.replace(first.player);
  startDungeonPlayerMovement(next.runtime, 'east', options);
  updateDungeonPlayerMovement(next.runtime, 0.6);
  assert.equal(handle.current, first.player); assert.equal(handle.current!.playerPosition.tileX, 0);
  assert.throws(() => createDungeonTraversalWorld(next.runtime.map, [], new Map(),
    allocateDungeonTraversalStateData(3, 'test', 1)), /尺寸/);
  assert.equal(handle.current, first.player);
  assert.throws(() => createDungeonMovementResolver(next.runtime.traversal, {},
    allocateDungeonMovementStateData(3, 'test', 1, 0)), /尺寸/);
  handle.replace(next.player);
  first.runtime.playerWorldPosition = [99, 0, 0];
  assert.equal(handle.current, next.player); assert.equal(handle.current!.playerWorldPosition[0], 0.6);
  handle.replace(null); assert.equal(handle.current, null);
});

test('save restoration writes the owned candidate before publication and retains the original save format', () => {
  const data = candidate();
  const saved = { version: 1 as const, dungeonPresetKey: 'test', playerPosition: { tileX: 2, tileY: 0 }, playerFacing: 'north' as const };
  const result = applyDungeonRuntimeSaveState(data.runtime, saved, options.resolveWorldPosition);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(data.player.playerPosition, saved.playerPosition);
  assert.deepEqual(data.player.playerWorldPosition, [2, 0, 0]);
  assert.equal(data.player.playerFacing, 'north'); assert.equal(data.player.playerWorldRotationY, Math.PI);
  assert.equal(data.traversal.occupantIdsByTile[2].has(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID), true);
  const spawn = { tilePosition: { x: 0, y: 0 }, worldPosition: [0, 0, 0] } as unknown as DungeonPlayerSpawnBinding;
  assert.deepEqual(createDungeonRuntimeSaveState('test', data.runtime, spawn), saved);
  assert.deepEqual(applyDungeonRuntimeSaveState(data.runtime, { ...saved, playerPosition: { tileX: 99, tileY: 0 } },
    options.resolveWorldPosition).warnings.length, 1);
  assert.equal(data.player.playerPosition.tileX, 2);
});
