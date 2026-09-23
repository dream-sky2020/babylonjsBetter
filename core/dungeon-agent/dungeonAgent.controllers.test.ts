import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntityContainer } from '../entity/entity.utils.ts';
import type { IEntity } from '../entity/entity.types.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import {
  CONTINUOUS_RANDOM_WALK_CONTROLLER_ID,
  createDefaultDungeonAgentControllerRegistry,
  createDungeonAgentRuntimeState,
  CHASE_PLAYER_CONTROLLER_ID,
  MOVE_TO_TILE_CONTROLLER_ID,
  normalizeDungeonAgentControllerParameters,
  PATROL_ROUTE_CONTROLLER_ID,
  resolveDungeonAgentControllerConfig,
  RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID,
  runDungeonAgentControllersAfterPlayerStep,
  setDungeonAgentControllerOverride,
  STATIONARY_CONTROLLER_ID,
  rebuildDungeonAgentPathReservations,
  updateDungeonAgentControllers,
} from './index.ts';

const agentEntity = (controllerId: string, actionPeriod = 1, entityId = 'agent:test'): IEntity => ({
  id: entityId,
  entityType: 'dungeon-agent',
  enabled: true,
  components: [
    {
      id: `${entityId}:grid`, type: 'grid-agent', version: 1,
      initialFacing: 'east', blocksMovement: true, actionPeriod, priority: 0,
      movementProfileId: 'ground',
    },
    {
      id: `${entityId}:controller`, type: 'agent-controller', version: 1,
      controllerId,
      parameters: {
        seed: 7,
        idleWeight: 0,
        moveWeight: 1,
        moveDurationSeconds: 0,
        minIdleSeconds: 0,
        maxIdleSeconds: 0,
      },
    },
  ],
});

const createRuntime = (controllerId: string, actionPeriod = 1, width = 2, height = 1) => {
  const document = migrateDungeonMapToDocumentV2({
    presetKey: 'agent-controller-test',
    name: 'Agent Controller 测试',
    map: createDungeonMapData({
      id: 'map:agent-controller-test',
      width,
      height,
      createTileData: ({ x, y }) => x === 0 && y === 0
        ? createEntityContainer(agentEntity(controllerId, actionPeriod))
        : undefined,
    }),
  }).document;
  const map = createDungeonRuntimeMap(document);
  return { map, state: createDungeonAgentRuntimeState(map) };
};

test('玩家格步随机 Controller 遵守 actionPeriod，并只在到期时行动', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID, 2);
  const registry = createDefaultDungeonAgentControllerRegistry();

  assert.deepEqual(runDungeonAgentControllersAfterPlayerStep(state, map, registry), []);
  assert.equal(state.turnNumber, 1);
  assert.equal(state.agents[0].tileIndex, 0);

  const actions = runDungeonAgentControllersAfterPlayerStep(state, map, registry);
  assert.equal(state.turnNumber, 2);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].outcome, 'move-started');
  assert.equal(state.agents[0].tileIndex, 1);
});

test('连续随机 Controller 使用自己的等待时钟，不依赖玩家格步', () => {
  const { map, state } = createRuntime(CONTINUOUS_RANDOM_WALK_CONTROLLER_ID);
  const actions = updateDungeonAgentControllers(
    state,
    map,
    createDefaultDungeonAgentControllerRegistry(),
    0,
  );

  assert.equal(state.turnNumber, 0);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].trigger, 'continuous');
  assert.equal(actions[0].outcome, 'move-started');
  assert.equal(state.agents[0].tileIndex, 1);
});

test('相同 Agent 与 seed 会产生可复现的随机行动', () => {
  const first = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID);
  const second = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID);
  const registry = createDefaultDungeonAgentControllerRegistry();

  const firstAction = runDungeonAgentControllersAfterPlayerStep(first.state, first.map, registry)[0];
  const secondAction = runDungeonAgentControllersAfterPlayerStep(second.state, second.map, registry)[0];
  assert.deepEqual(firstAction, secondAction);
});

test('空闲帧不会重复清理或重建 Agent 路径预约', () => {
  const { map, state } = createRuntime(STATIONARY_CONTROLLER_ID, 1, 3);
  const agent = state.agents[0];
  agent.navigationPlan = {
    targetTileIndex: 2,
    tileIndices: [0, 1, 2],
    directions: ['east', 'east'],
    nextStepIndex: 0,
    totalCost: 2,
    visitedCount: 3,
    planSequence: 1,
  };
  rebuildDungeonAgentPathReservations(state);
  const traversal = state.traversal;
  const originalClear = traversal.clearReservations.bind(traversal);
  const originalReplace = traversal.replaceReservations.bind(traversal);
  let clearCalls = 0;
  let replaceCalls = 0;
  traversal.clearReservations = (actorId) => {
    clearCalls += 1;
    originalClear(actorId);
  };
  traversal.replaceReservations = (actorId, tileIndices, startIndex) => {
    replaceCalls += 1;
    originalReplace(actorId, tileIndices, startIndex);
  };

  const registry = createDefaultDungeonAgentControllerRegistry();
  for (let frame = 0; frame < 120; frame += 1) {
    updateDungeonAgentControllers(state, map, registry, 1 / 60);
  }

  assert.equal(clearCalls, 0);
  assert.equal(replaceCalls, 0);
  assert.equal(state.traversal.reservationCount(1), 1);
  assert.equal(state.traversal.reservationCount(2), 1);
});

test('运行时可切换 Controller 和参数而不修改地图初始绑定', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID);
  const registry = createDefaultDungeonAgentControllerRegistry();
  const agent = state.agents[0];
  const stationary = registry.get(STATIONARY_CONTROLLER_ID);
  assert.ok(stationary);

  setDungeonAgentControllerOverride(agent, stationary);
  assert.equal(resolveDungeonAgentControllerConfig(agent).controllerId, STATIONARY_CONTROLLER_ID);
  assert.equal(agent.binding.controller.controllerId, RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID);
  assert.deepEqual(runDungeonAgentControllersAfterPlayerStep(state, map, registry), []);

  const continuous = registry.get(CONTINUOUS_RANDOM_WALK_CONTROLLER_ID);
  assert.ok(continuous);
  setDungeonAgentControllerOverride(agent, continuous, {
    moveDurationSeconds: 0,
    minIdleSeconds: 0,
    maxIdleSeconds: 0,
    idleWeight: 0,
    moveWeight: 1,
    seed: 7.9,
  });
  assert.equal(resolveDungeonAgentControllerConfig(agent).parameters.seed, 7);
  assert.equal(updateDungeonAgentControllers(state, map, registry, 0).length, 1);
});

test('移动到目标格 Controller 计算路径并逐格执行', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID);
  const registry = createDefaultDungeonAgentControllerRegistry();
  const controller = registry.get(MOVE_TO_TILE_CONTROLLER_ID);
  assert.ok(controller);
  setDungeonAgentControllerOverride(state.agents[0], controller, {
    targetTileX: 1,
    targetTileY: 0,
    moveDurationSeconds: 0,
    seed: 11,
  });

  const actions = updateDungeonAgentControllers(state, map, registry, 0);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].outcome, 'move-started');
  assert.equal(state.agents[0].tileIndex, 1);
  assert.deepEqual(updateDungeonAgentControllers(state, map, registry, 0), []);
});

test('动态占用阻挡时保留原路径，冷却期间不重复预约或寻路', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID, 1, 3);
  const registry = createDefaultDungeonAgentControllerRegistry();
  const controller = registry.get(MOVE_TO_TILE_CONTROLLER_ID);
  assert.ok(controller);
  setDungeonAgentControllerOverride(state.agents[0], controller, {
    targetTileX: 2, targetTileY: 0, moveDurationSeconds: 0, seed: 11,
  });
  updateDungeonAgentControllers(state, map, registry, 0);
  assert.equal(state.agents[0].tileIndex, 1);
  state.traversal.registerActor({
    id: 'blocker', kind: 'dynamic', tileIndex: 2, enabled: true,
    blocksMovement: true, movementProfileId: 'ground',
  });
  const originalSequence = state.agents[0].navigationPlan?.planSequence;
  const originalReplace = state.traversal.replaceReservations.bind(state.traversal);
  let replaceCalls = 0;
  state.traversal.replaceReservations = (actorId, tileIndices, startIndex) => {
    replaceCalls += 1;
    originalReplace(actorId, tileIndices, startIndex);
  };
  const blocked = updateDungeonAgentControllers(state, map, registry, 0);
  assert.equal(blocked[0]?.outcome, 'blocked');
  for (let frame = 0; frame < 10; frame += 1) {
    assert.deepEqual(updateDungeonAgentControllers(state, map, registry, 0.01), []);
  }
  assert.equal(state.agents[0].navigationPlan?.planSequence, originalSequence);
  assert.equal(replaceCalls, 0);
  state.traversal.unregisterActor('blocker');
  updateDungeonAgentControllers(state, map, registry, 0.3);
  assert.equal(state.agents[0].tileIndex, 2);
});

test('连续动态阻挡达到阈值后只做一次受限局部修补并复用旧路径后缀', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID, 1, 4, 2);
  const registry = createDefaultDungeonAgentControllerRegistry();
  const controller = registry.get(MOVE_TO_TILE_CONTROLLER_ID);
  assert.ok(controller);
  setDungeonAgentControllerOverride(state.agents[0], controller, {
    targetTileX: 3, targetTileY: 0, moveDurationSeconds: 0, seed: 11,
  });
  updateDungeonAgentControllers(state, map, registry, 0);
  assert.equal(state.agents[0].tileIndex, 1);
  state.traversal.registerActor({
    id: 'blocker', kind: 'dynamic', tileIndex: 2, enabled: true,
    blocksMovement: true, movementProfileId: 'ground',
  });
  updateDungeonAgentControllers(state, map, registry, 0);
  updateDungeonAgentControllers(state, map, registry, 0.3);
  updateDungeonAgentControllers(state, map, registry, 0.3);
  updateDungeonAgentControllers(state, map, registry, 0.3);
  assert.equal(state.agents[0].navigationPlan?.repairCount, 1);
  assert.notEqual(state.agents[0].tileIndex, 1);
  assert.equal(state.agents[0].navigationPlan?.targetTileIndex, 3);
});

test('完整寻路失败后进入退避，不在随后每帧重复报告和搜索', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID);
  const registry = createDefaultDungeonAgentControllerRegistry();
  const controller = registry.get(MOVE_TO_TILE_CONTROLLER_ID);
  assert.ok(controller);
  setDungeonAgentControllerOverride(state.agents[0], controller, {
    targetTileX: 1, targetTileY: 0, moveDurationSeconds: 0, seed: 11,
  });
  state.traversal.registerActor({
    id: 'blocker', kind: 'dynamic', tileIndex: 1, enabled: true,
    blocksMovement: true, movementProfileId: 'ground',
  });
  assert.equal(updateDungeonAgentControllers(state, map, registry, 0)[0]?.outcome, 'idle');
  for (let frame = 0; frame < 10; frame += 1) {
    assert.deepEqual(updateDungeonAgentControllers(state, map, registry, 0.01), []);
  }
});

test('多个 Agent 同时需要新路径时遵守单次更新的共享寻路预算', () => {
  const document = migrateDungeonMapToDocumentV2({
    presetKey: 'agent-budget-test',
    name: 'Agent Budget Test',
    map: createDungeonMapData({
      id: 'map:agent-budget-test',
      width: 3,
      height: 3,
      createTileData: ({ x, y }) => x === 0
        ? createEntityContainer(agentEntity(
          RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID,
          1,
          `agent:${y}`,
        ))
        : undefined,
    }),
  }).document;
  const map = createDungeonRuntimeMap(document);
  const state = createDungeonAgentRuntimeState(map);
  const registry = createDefaultDungeonAgentControllerRegistry();
  const controller = registry.get(MOVE_TO_TILE_CONTROLLER_ID);
  assert.ok(controller);
  state.agents.forEach((agent) => setDungeonAgentControllerOverride(agent, controller, {
    targetTileX: 2,
    targetTileY: Math.floor(agent.tileIndex / map.width),
    moveDurationSeconds: 0,
    seed: 11,
  }));

  const firstFrame = updateDungeonAgentControllers(state, map, registry, 0, {
    maxPathSearchesPerUpdate: 1,
  });
  assert.equal(firstFrame.filter(({ outcome }) => outcome === 'move-started').length, 1);
  assert.equal(state.agents.filter(({ navigationPlan }) => !!navigationPlan).length, 1);

  updateDungeonAgentControllers(state, map, registry, 0, { maxPathSearchesPerUpdate: 1 });
  assert.equal(state.agents.filter(({ navigationPlan }) => !!navigationPlan).length, 2);
});

test('路线巡逻 Controller 依次前往巡逻点并循环', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID);
  const registry = createDefaultDungeonAgentControllerRegistry();
  const controller = registry.get(PATROL_ROUTE_CONTROLLER_ID);
  assert.ok(controller);
  setDungeonAgentControllerOverride(state.agents[0], controller, {
    route: [{ x: 1, y: 0 }, { x: 0, y: 0 }],
    loop: true,
    waitAtWaypointSeconds: 0,
    moveDurationSeconds: 0,
    seed: 5,
  });

  updateDungeonAgentControllers(state, map, registry, 0);
  assert.equal(state.agents[0].tileIndex, 1);
  updateDungeonAgentControllers(state, map, registry, 0);
  assert.equal(state.agents[0].tileIndex, 0);
});

test('巡逻点列表参数过滤无效坐标并规范化坐标值', () => {
  const controller = createDefaultDungeonAgentControllerRegistry().get(PATROL_ROUTE_CONTROLLER_ID);
  assert.ok(controller);
  const normalized = normalizeDungeonAgentControllerParameters(controller, {
    route: [{ x: 1, y: 2 }, { x: 3.5, y: 4 }, null, { x: '5', y: '6' }],
  });
  assert.deepEqual(normalized.route, [{ x: 1, y: 2 }, { x: 5, y: 6 }]);
});

test('巡逻 locked 策略缓存自动生成的路线，受阻时等待而不重算', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID, 1, 3);
  const registry = createDefaultDungeonAgentControllerRegistry();
  const controller = registry.get(PATROL_ROUTE_CONTROLLER_ID);
  assert.ok(controller);
  setDungeonAgentControllerOverride(state.agents[0], controller, {
    route: '2,0; 0,0',
    routePlayback: 'ping-pong',
    pathPolicy: 'locked',
    waitAtWaypointSeconds: 0,
    moveDurationSeconds: 0,
    seed: 5,
  });
  updateDungeonAgentControllers(state, map, registry, 0);
  assert.equal(state.agents[0].tileIndex, 1);
  const planSequence = state.agents[0].navigationPlan?.planSequence;
  state.traversal.registerActor({
    id: 'blocker', kind: 'dynamic', tileIndex: 2, enabled: true,
    blocksMovement: true, movementProfileId: 'ground',
  });
  updateDungeonAgentControllers(state, map, registry, 0.5);
  assert.equal(state.agents[0].tileIndex, 1);
  assert.equal(state.agents[0].navigationPlan?.planSequence, planSequence);
  state.traversal.unregisterActor('blocker');
  updateDungeonAgentControllers(state, map, registry, 0.3);
  assert.equal(state.agents[0].tileIndex, 2);
  updateDungeonAgentControllers(state, map, registry, 0);
  assert.equal(state.agents[0].tileIndex, 1);
});

test('巡逻 wait-then-repath 策略达到等待阈值后丢弃受阻路径', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID, 1, 3);
  const registry = createDefaultDungeonAgentControllerRegistry();
  const controller = registry.get(PATROL_ROUTE_CONTROLLER_ID);
  assert.ok(controller);
  setDungeonAgentControllerOverride(state.agents[0], controller, {
    route: '2,0',
    routePlayback: 'once',
    pathPolicy: 'wait-then-repath',
    blockedWaitSeconds: 1,
    waitAtWaypointSeconds: 0,
    moveDurationSeconds: 0,
  });
  updateDungeonAgentControllers(state, map, registry, 0);
  assert.equal(state.agents[0].tileIndex, 1);
  state.traversal.registerActor({
    id: 'blocker', kind: 'dynamic', tileIndex: 2, enabled: true,
    blocksMovement: true, movementProfileId: 'ground',
  });
  updateDungeonAgentControllers(state, map, registry, 0.4);
  assert.ok(state.agents[0].navigationPlan);
  updateDungeonAgentControllers(state, map, registry, 0.6);
  assert.equal(state.agents[0].navigationPlan, undefined);
  state.traversal.unregisterActor('blocker');
  updateDungeonAgentControllers(state, map, registry, 0.05);
  assert.equal(state.agents[0].tileIndex, 2);
});

test('追踪玩家 Controller 在配置的距离外追近并停止', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID);
  const registry = createDefaultDungeonAgentControllerRegistry();
  const controller = registry.get(CHASE_PLAYER_CONTROLLER_ID);
  assert.ok(controller);
  setDungeonAgentControllerOverride(state.agents[0], controller, {
    stopDistance: 1,
    moveDurationSeconds: 0,
    seed: 9,
  });

  updateDungeonAgentControllers(state, map, registry, 0, { playerTileIndex: 1 });
  assert.equal(state.agents[0].tileIndex, 0);
  setDungeonAgentControllerOverride(state.agents[0], controller, {
    stopDistance: 0,
    moveDurationSeconds: 0,
    seed: 9,
  });
  updateDungeonAgentControllers(state, map, registry, 0, { playerTileIndex: 1 });
  assert.equal(state.agents[0].tileIndex, 1);
});
