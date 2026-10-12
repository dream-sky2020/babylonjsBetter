import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntityContainer } from '../entity/entity.utils.ts';
import type { IEntity } from '../entity/entity.types.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { createDungeonAgentRuntimeState, updateDungeonAgentMovements, syncDungeonAgentPathReservation } from './dungeonAgent.runtime.ts';
import { createDungeonAgentControl } from './dungeonAgentControl.ts';
import type { DungeonAgentSystem } from './dungeonAgentSystem';
import { createDefaultDungeonAgentControllerRegistry } from './dungeonAgent.controllers.ts';

const session = () => {
  const entity: IEntity = { id: 'guard', entityType: 'dungeon-agent', components: [
    { id: 'grid', type: 'grid-agent', version: 1, initialFacing: 'east', blocksMovement: true, actionPeriod: 1, priority: 7, movementProfileId: 'ground' },
    { id: 'controller', type: 'agent-controller', version: 1, controllerId: 'stationary', parameters: {} },
  ] };
  const doc = migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'Test', map: createDungeonMapData({ id: 'test', width: 2, height: 1,
    createTileData: ({ x }) => x === 0 ? createEntityContainer(entity) : undefined }) }).document;
  const map = createDungeonRuntimeMap(doc), state = createDungeonAgentRuntimeState(map);
  const system: Pick<DungeonAgentSystem, 'state' | 'settings' | 'update' | 'afterPlayerStep'> = {
    state, settings: { controllersEnabled: true, decisionIntervalSeconds: 0.1, maxPathSearchesPerDecision: 2 },
    update(delta) { assert.equal(this, system); return { completed: updateDungeonAgentMovements(state, delta), actions: [], changed: new Set(state.agents) }; },
    afterPlayerStep(event) { assert.equal(this, system); assert.equal(event.loadId, 1); return []; },
  };
  return { loadId: 1, map, system };
};

test('Agent map capability retains domain state and receiver, and movement uses the original Core map', () => {
  const active = session(), commands = createDungeonAgentControl(() => active).acquire(1)!;
  assert.equal(commands.state, active.system.state); assert.equal(commands.settings, active.system.settings);
  assert.equal('runtime' in commands, false); assert.equal('map' in commands, false);
  commands.settings.controllersEnabled = false; assert.equal(active.system.settings.controllersEnabled, false);
  assert.equal(commands.move('guard', 'east', { durationSeconds: 0.3 }).started, true);
  assert.deepEqual(commands.update(1).completed, ['guard']); assert.equal(commands.state.agents[0].tileIndex, 1);
  assert.deepEqual(commands.afterPlayerStep({ loadId: 1, stepId: 1, from: { tileX: 0, tileY: 0 }, to: { tileX: 1, tileY: 0 }, facing: 'east' }), []);
});

test('old Agent commands cannot move or advance a replacement Session', () => {
  let active: ReturnType<typeof session> | null = session(); const control = createDungeonAgentControl(() => active);
  const old = control.acquire(1)!; assert.equal(control.acquire(2), null);
  active = { ...session(), loadId: 2 };
  assert.throws(() => old.move('guard', 'east', {}), /地图已切换/); assert.throws(() => old.update(1), /地图已切换/);
  assert.throws(() => old.resetController('guard'), /地图已切换/);
  assert.throws(() => old.turn('guard', 'right', 0.3), /地图已切换/);
  assert.throws(() => old.setMovementProfile('guard', 'ground-eight-way'), /地图已切换/);
  assert.throws(() => old.setController('guard', createDefaultDungeonAgentControllerRegistry().get('stationary')!), /地图已切换/);
  assert.equal(active.system.state.agents[0].tileIndex, 0); active = null; assert.equal(control.acquire(2), null);
});

test('Controller commands preserve Core reset behavior and map configuration', () => {
  const active = session(), commands = createDungeonAgentControl(() => active).acquire(1)!;
  const agent = commands.state.agents[0]!, original = agent.binding.controller;
  agent.actionClock = 5; agent.controllerState = { counter: 3 };
  commands.setController('guard', createDefaultDungeonAgentControllerRegistry().get('stationary')!, {});
  assert.equal(agent.actionClock, 0); assert.equal(agent.controllerState, undefined);
  assert.equal(agent.controllerOverride?.controllerId, 'stationary');
  assert.equal(agent.binding.controller, original);
  agent.actionClock = 4; commands.resetController('guard');
  assert.equal(agent.controllerOverride, undefined); assert.equal(agent.actionClock, 0);
});

test('movement profile commands invalidate plans and clear original traversal reservations', () => {
  const active = session(), commands = createDungeonAgentControl(() => active).acquire(1)!;
  const state = active.system.state, agent = state.agents[0]!;
  agent.navigationPlan = { targetTileIndex: 1, tileIndices: [0, 1], directions: ['east'], nextStepIndex: 0, totalCost: 1, visitedCount: 2, planSequence: 1 };
  syncDungeonAgentPathReservation(state, agent);
  assert.equal(state.traversal.pathReservationsByTile[1]!.has('guard'), true);
  commands.setMovementProfile('guard', 'ground-eight-way');
  assert.equal(state.traversal.actors.get('guard')!.movementProfileId, 'ground-eight-way');
  assert.equal(agent.navigationPlan, undefined); assert.equal(agent.reservationPlanSequence, undefined);
  assert.equal(state.traversal.pathReservationsByTile[1]!.has('guard'), false);
  assert.equal(commands.turn('guard', 'right', 0.3).started, true);
  commands.update(1); assert.equal(agent.movement, null);
});
