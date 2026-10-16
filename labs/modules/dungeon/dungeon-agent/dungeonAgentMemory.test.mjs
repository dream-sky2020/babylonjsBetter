import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../kit/shared-memory/LabMemory.ts';
import { createDungeonAgentMemoryData, DUNGEON_AGENTS_MEMORY, DUNGEON_AGENT_STATE_MEMORY } from './dungeonAgent.memory.ts';
import { createDungeonAgentControllerData, DUNGEON_AGENT_SETTINGS_MEMORY, DUNGEON_AGENT_CONTROLLER_MEMORY } from './dungeonAgentController.memory.ts';
import { createDungeonAgentNavigationData, DUNGEON_AGENT_NAVIGATION_MEMORY } from './dungeonAgentNavigation.memory.ts';

test('Agent views forward Core mutations and replacement movements without leaking bindings', () => {
  const source = { binding: { entity: { id: 'a', name: 'A' }, gridAgent: { blocksMovement: true, actionPeriod: 1, priority: 5 }, initialTileIndex: 0 },
    tileIndex: 0, facing: 'east', enabled: true, movement: null };
  const registry = new LabMemoryRegistry(), publisher = registry.scope('dungeon-agent');
  const descriptions = publisher.acquire(DUNGEON_AGENTS_MEMORY), states = publisher.acquire(DUNGEON_AGENT_STATE_MEMORY);
  const data = createDungeonAgentMemoryData(1, 'test', [source]);
  descriptions.replace(data.descriptions); states.replace(data.state);
  assert.equal(registry.scope('observer').acquire(DUNGEON_AGENT_STATE_MEMORY), states);
  const row = states.current.agents.get('a');
  assert.equal(row.effectivePriority, 5); row.priorityOverride = 9; assert.equal(source.priorityOverride, 9);
  source.tileIndex = 4; source.facing = 'south'; assert.equal(row.tileIndex, 4); assert.equal(row.facing, 'south');
  source.movement = { kind: 'move', fromTileIndex: 4, toTileIndex: 5, fromFacing: 'south', toFacing: 'east', elapsedSeconds: 0.1, durationSeconds: 0.3 };
  assert.equal(row.toTileIndex, 5); assert.equal(row.elapsedSeconds, 0.1);
  source.movement = { ...source.movement, kind: 'rollback', toTileIndex: 4, visualProgress: 0.5 };
  assert.equal(row.movementKind, 'rollback'); assert.equal(row.visualProgress, 0.5);
  source.movement = null; assert.equal(row.movementKind, null); assert.equal(row.fromTileIndex, null);
  for (const view of [row, descriptions.current.agents.get('a')]) {
    assert.equal('binding' in view, false); assert.equal('navigationPlan' in view, false); assert.equal('controllerState' in view, false);
    assert.ok(Object.values(view).every(value => value === null || typeof value !== 'object'));
  }
  assert.equal(DUNGEON_AGENT_STATE_MEMORY.inspect(states.current).agents, states.current.agents);
});

test('Controller views follow config and internal-state replacements, and settings write through to Core', () => {
  const agent = { binding: { entity: { id: 'a' }, controller: { controllerId: 'stationary', parameters: { seed: 1 } } }, actionClock: 0 };
  const state = { turnNumber: 0, agents: [agent] };
  const settings = { controllersEnabled: true, decisionIntervalSeconds: 0.1, maxPathSearchesPerDecision: 2 };
  const data = createDungeonAgentControllerData(1, 'test', state, settings), registry = new LabMemoryRegistry();
  const scope = registry.scope('test');
  scope.acquire(DUNGEON_AGENT_SETTINGS_MEMORY).replace(data.settings);
  scope.acquire(DUNGEON_AGENT_CONTROLLER_MEMORY).replace(data.controllers);
  const row = data.controllers.agents.get('a');
  assert.equal(row.source, 'map'); assert.equal(row.parameters, agent.binding.controller.parameters);
  agent.controllerOverride = { controllerId: 'random-walk', parameters: { seed: 2 } };
  agent.controllerState = { randomState: 9 }; agent.actionClock = 0.5; state.turnNumber = 3;
  assert.equal(row.source, 'runtime-override'); assert.equal(row.parameters, agent.controllerOverride.parameters);
  assert.equal(row.controllerState, agent.controllerState); assert.equal(row.actionClock, 0.5); assert.equal(data.controllers.turnNumber, 3);
  agent.controllerState = { randomState: 10 }; assert.equal(row.controllerState.randomState, 10);
  agent.controllerOverride = undefined; assert.equal(row.source, 'map'); assert.equal(row.controllerId, 'stationary');
  data.settings.controllersEnabled = false; data.settings.decisionIntervalSeconds = 0.2;
  assert.equal(settings.controllersEnabled, false); assert.equal(settings.decisionIntervalSeconds, 0.2);
  assert.equal('binding' in row, false); assert.equal('navigationPlan' in row, false);
  assert.equal(DUNGEON_AGENT_CONTROLLER_MEMORY.inspect(data.controllers).agents, data.controllers.agents);
  assert.throws(() => scope.acquire(DUNGEON_AGENT_SETTINGS_MEMORY).replace({ ...data.settings, decisionIntervalSeconds: -1 }));
});

test('Agent schemas reject incompatible identities and records at publication', () => {
  const registry = new LabMemoryRegistry(), scope = registry.scope('test');
  const states = scope.acquire(DUNGEON_AGENT_STATE_MEMORY), descriptions = scope.acquire(DUNGEON_AGENTS_MEMORY);
  assert.throws(() => states.replace({ loadId: 1, presetKey: 'x', agents: new Map([['a', { entityId: 'a', tileIndex: 'bad' }]]) }));
  assert.throws(() => descriptions.replace({ loadId: 0, presetKey: 'x', agents: new Map() }));
  assert.equal(states.current, null); assert.equal(descriptions.current, null);
});

test('navigation views follow plan and blocked-state replacement without copying paths', () => {
  const agent = { binding: { entity: { id: 'a' } } };
  const value = createDungeonAgentNavigationData(1, 'test', [agent]);
  const row = value.agents.get('a'); assert.equal(row.hasPlan, false);
  agent.navigationPlan = { targetTileIndex: 2, tileIndices: [0, 1, 2], directions: ['east', 'east'], nextStepIndex: 0, totalCost: 2, visitedCount: 3, planSequence: 1 };
  assert.equal(row.tileIndices, agent.navigationPlan.tileIndices);
  const registry = new LabMemoryRegistry(), handle = registry.scope('test').acquire(DUNGEON_AGENT_NAVIGATION_MEMORY);
  handle.replace(value); assert.equal(DUNGEON_AGENT_NAVIGATION_MEMORY.inspect(value).agents, value.agents);
  agent.navigationPlan = { ...agent.navigationPlan, nextStepIndex: 1, planSequence: 2, blocked: { reason: 'occupied', fromTileIndex: 1, toTileIndex: 2, retryRemainingSeconds: 0.3, consecutiveFailures: 1 } };
  assert.equal(row.nextStepIndex, 1); assert.equal(row.planSequence, 2); assert.equal(row.blockedReason, 'occupied');
  agent.navigationPlan.blocked = { ...agent.navigationPlan.blocked, retryRemainingSeconds: 0.1 };
  assert.equal(row.retryRemainingSeconds, 0.1);
  agent.navigationPlan = undefined; assert.equal(row.hasPlan, false); assert.equal(row.blockedReason, null);
  assert.deepEqual(row.tileIndices, []); assert.equal('binding' in row, false);
});
