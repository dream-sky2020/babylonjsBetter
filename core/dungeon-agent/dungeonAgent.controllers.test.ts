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

const createRuntime = (controllerId: string, actionPeriod = 1, width = 2, height = 1, mode: 'bounded' | 'loop-horizontal' = 'bounded', blocked: readonly number[] = []) => {
  const document = migrateDungeonMapToDocumentV2({
    presetKey: 'agent-controller-test',
    name: 'Agent Controller 测试',
    map: createDungeonMapData({
      id: 'map:agent-controller-test',
      width,
      height,
      mode,
      createTileData: ({ x, y }) => x === 0 && y === 0
        ? createEntityContainer(agentEntity(controllerId, actionPeriod))
        : undefined,
    }),
  }).document;
  if (blocked.length) document.terrain = { default: { kind: 'floor' }, overrides: Object.fromEntries(blocked.map(index => [document.grid.tileIds[index], { kind: 'wall', walkable: false }])) };
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

test('轻量追踪直接靠近，动态占位时等待，解除后继续，不创建路径', () => {
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 4, 1);
  const registry = createDefaultDungeonAgentControllerRegistry();
  setDungeonAgentControllerOverride(state.agents[0], registry.get(CHASE_PLAYER_CONTROLLER_ID)!, { navigationStrategy: 'direct', stopDistance: 0, moveDurationSeconds: 0 });
  updateDungeonAgentControllers(state, map, registry, 0.1, { playerTileIndex: 3 });
  assert.equal(state.agents[0].tileIndex, 1); assert.equal(state.agents[0].navigationPlan, undefined);
  state.traversal.registerActor({ id: 'blocker', kind: 'dynamic', tileIndex: 2, enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  updateDungeonAgentControllers(state, map, registry, 0.1, { playerTileIndex: 3 }); assert.equal(state.agents[0].tileIndex, 1);
  state.traversal.unregisterActor('blocker'); updateDungeonAgentControllers(state, map, registry, 0.1, { playerTileIndex: 3 }); assert.equal(state.agents[0].tileIndex, 2);
});

test('沿墙策略绕过静态障碍并恢复追近，保持合法格步', () => {
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 5, 3);
  const registry = createDefaultDungeonAgentControllerRegistry();
  setDungeonAgentControllerOverride(state.agents[0], registry.get(CHASE_PLAYER_CONTROLLER_ID)!, { navigationStrategy: 'wall-follow', stopDistance: 0, moveDurationSeconds: 0 });
  const inspect = state.traversal.inspectStep.bind(state.traversal);
  state.traversal.inspectStep = (actor, from, direction, options) => {
    const result = inspect(actor, from, direction, options);
    return result.toTileIndex === 1 || result.toTileIndex === 6 ? { ...result, blockedReason: 'movement-obstacle' as const } : result;
  };
  for (let i = 0; i < 20 && state.agents[0].tileIndex !== 4; i++) updateDungeonAgentControllers(state, map, registry, 0.1, { playerTileIndex: 4 });
  assert.equal(state.agents[0].tileIndex, 4); assert.equal(state.agents[0].navigationPlan, undefined);
});

test('沿墙追踪绕过错开方块，移动时仍执行通行检查', () => {
  const blocked = new Set([1, 7, 14, 15, 21]);
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 6, 5, 'bounded', [...blocked]);
  const registry = createDefaultDungeonAgentControllerRegistry();
  setDungeonAgentControllerOverride(state.agents[0], registry.get(CHASE_PLAYER_CONTROLLER_ID)!, { navigationStrategy: 'wall-follow', stopDistance: 0, moveDurationSeconds: 0 });
  for (let i = 0; i < 90 && state.agents[0].tileIndex !== 5; i++) {
    updateDungeonAgentControllers(state, map, registry, .1, { playerTileIndex: 5 });
    assert.equal(blocked.has(state.agents[0].tileIndex), false);
  }
  assert.equal(state.agents[0].tileIndex, 5);
});

test('检测到绕圈后有限局部搜索可规划出口并继续沿格子移动', () => {
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 6, 5);
  const registry = createDefaultDungeonAgentControllerRegistry();
  setDungeonAgentControllerOverride(state.agents[0], registry.get(CHASE_PLAYER_CONTROLLER_ID)!, { navigationStrategy: 'wall-follow', stopDistance: 0, moveDurationSeconds: 0 });
  const inspect = state.traversal.inspectStep.bind(state.traversal);
  state.traversal.inspectStep = (actor, from, direction, options) => {
    const result = inspect(actor, from, direction, options);
    return result.toTileIndex !== undefined && [1, 7, 13].includes(result.toTileIndex) ? { ...result, blockedReason: 'movement-obstacle' as const } : result;
  };
  const samples: number[] = [], options = { playerTileIndex: 5, onPathSearch: (_id: string, _ms: number, visited: number) => samples.push(visited) };
  updateDungeonAgentControllers(state, map, registry, .1, options);
  const wall = (state.agents[0].controllerState as { wallFollow: { heading: string; visited: string[] } }).wallFollow;
  wall.visited.push(`${state.agents[0].tileIndex}:${wall.heading}`);
  updateDungeonAgentControllers(state, map, registry, .1, options);
  assert.equal(samples.length, 1); assert.ok(samples[0] <= 64);
  for (let i = 0; i < 50 && state.agents[0].tileIndex !== 5; i++) updateDungeonAgentControllers(state, map, registry, .1, options);
  assert.equal(state.agents[0].tileIndex, 5);
});

test('绕行中玩家换格不会清空绕行历史', () => {
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 5, 3);
  const registry = createDefaultDungeonAgentControllerRegistry();
  setDungeonAgentControllerOverride(state.agents[0], registry.get(CHASE_PLAYER_CONTROLLER_ID)!, { navigationStrategy: 'wall-follow', stopDistance: 0, moveDurationSeconds: 0 });
  const inspect = state.traversal.inspectStep.bind(state.traversal);
  state.traversal.inspectStep = (actor, from, direction, options) => {
    const result = inspect(actor, from, direction, options);
    return result.toTileIndex === 1 || result.toTileIndex === 6 ? { ...result, blockedReason: 'movement-obstacle' as const } : result;
  };
  updateDungeonAgentControllers(state, map, registry, .1, { playerTileIndex: 4 });
  const wall = (state.agents[0].controllerState as { wallFollow: { visited: string[] } }).wallFollow;
  const history = wall.visited.slice();
  updateDungeonAgentControllers(state, map, registry, .1, { playerTileIndex: 9 });
  assert.deepEqual(wall.visited.slice(0, history.length), history);
});

test('八方向绕行不能从两个被占据方块的角之间穿过', () => {
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 3, 3);
  const registry = createDefaultDungeonAgentControllerRegistry(), id = state.agents[0].binding.entity.id;
  state.traversal.setActorMovementProfile(id, 'ground-eight-way');
  for (const [actorId, tileIndex] of [['east-blocker', 1], ['south-blocker', 3]] as const) state.traversal.registerActor({ id: actorId, kind: 'dynamic', tileIndex, enabled: true, blocksMovement: true, spatialFootprint: 'full-tile', movementProfileId: 'ground' });
  setDungeonAgentControllerOverride(state.agents[0], registry.get(CHASE_PLAYER_CONTROLLER_ID)!, { navigationStrategy: 'wall-follow', stopDistance: 0, moveDurationSeconds: 0 });
  for (let i = 0; i < 10; i++) updateDungeonAgentControllers(state, map, registry, .1, { playerTileIndex: 8 });
  assert.equal(state.agents[0].tileIndex, 0);
});

test('局部绕行路线遇到动态占位时等待并保留历史，占位消失后恢复', () => {
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 5, 2);
  const registry = createDefaultDungeonAgentControllerRegistry(), agent = state.agents[0];
  setDungeonAgentControllerOverride(agent, registry.get(CHASE_PLAYER_CONTROLLER_ID)!, { navigationStrategy: 'wall-follow', stopDistance: 0, moveDurationSeconds: 0 });
  updateDungeonAgentControllers(state, map, registry, .1, { playerTileIndex: 4 });
  state.traversal.registerActor({ id: 'temporary', kind: 'dynamic', tileIndex: 2, enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  const internal = agent.controllerState as { wallFollow?: unknown };
  internal.wallFollow = { heading: 'east', entryTile: 0, target: 4, visited: ['0:east'], retry: 0, route: { tiles: [1, 2, 3], directions: ['east', 'east'], index: 0 } };
  updateDungeonAgentControllers(state, map, registry, .1, { playerTileIndex: 4 });
  assert.equal(agent.tileIndex, 1);
  state.traversal.unregisterActor('temporary');
  updateDungeonAgentControllers(state, map, registry, .3, { playerTileIndex: 4 });
  assert.equal(agent.tileIndex, 2);
  assert.deepEqual((internal.wallFollow as { visited: string[] }).visited, ['0:east']);
});

test('局部绕行找不到出口时可配置回退完整寻路', () => {
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 5, 12);
  const registry = createDefaultDungeonAgentControllerRegistry(), agent = state.agents[0];
  setDungeonAgentControllerOverride(agent, registry.get(CHASE_PLAYER_CONTROLLER_ID)!, { navigationStrategy: 'wall-follow', wallFallbackToPath: true, stopDistance: 0, moveDurationSeconds: 0 });
  const inspect = state.traversal.inspectStep.bind(state.traversal);
  state.traversal.inspectStep = (actor, from, direction, options) => {
    const result = inspect(actor, from, direction, options);
    return result.toTileIndex !== undefined && result.toTileIndex % 5 === 1 && result.toTileIndex < 45
      ? { ...result, blockedReason: 'movement-obstacle' as const } : result;
  };
  updateDungeonAgentControllers(state, map, registry, .1, { playerTileIndex: 4 });
  const wall = (agent.controllerState as { wallFollow: { heading: string; visited: string[] } }).wallFollow;
  wall.visited.push(`${agent.tileIndex}:${wall.heading}`);
  updateDungeonAgentControllers(state, map, registry, .1, { playerTileIndex: 4, maxPathSearchesPerUpdate: 2 });
  assert.ok(agent.navigationPlan); assert.equal((wall as { fallback?: boolean }).fallback, true);
});

test('八方向轻量追踪在斜向相邻时遵守停止距离', () => {
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 3, 3);
  const registry = createDefaultDungeonAgentControllerRegistry();
  state.traversal.actors.get(state.agents[0].binding.entity.id)!.movementProfileId = 'ground-eight-way';
  setDungeonAgentControllerOverride(state.agents[0], registry.get(CHASE_PLAYER_CONTROLLER_ID)!, { navigationStrategy: 'direct', stopDistance: 1, moveDurationSeconds: 0 });
  updateDungeonAgentControllers(state, map, registry, 0.1, { playerTileIndex: 4 });
  assert.equal(state.agents[0].tileIndex, 0);
});

test('决策统计区分轻量策略和完整搜索，并记录搜索访问数', () => {
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 5, 2);
  const registry = createDefaultDungeonAgentControllerRegistry(), controller = registry.get(CHASE_PLAYER_CONTROLLER_ID)!;
  let decisions = 0, searches = 0, visited = 0;
  const options = { playerTileIndex: 4, onDecision: () => { decisions++; }, onPathSearch: (_id: string, _ms: number, count: number) => { searches++; visited += count; } };
  setDungeonAgentControllerOverride(state.agents[0], controller, { navigationStrategy: 'direct', stopDistance: 0, moveDurationSeconds: 0 });
  updateDungeonAgentControllers(state, map, registry, 0.1, options); assert.equal(decisions, 1); assert.equal(searches, 0);
  setDungeonAgentControllerOverride(state.agents[0], controller, { navigationStrategy: 'path', stopDistance: 0, moveDurationSeconds: 0 });
  updateDungeonAgentControllers(state, map, registry, 0.1, options); assert.equal(decisions, 2); assert.equal(searches, 1); assert.ok(visited > 0);
});

test('环绕地图的完整路径优先选择跨边界最短路线', () => {
  const { map, state } = createRuntime(CHASE_PLAYER_CONTROLLER_ID, 1, 5, 2, 'loop-horizontal');
  const registry = createDefaultDungeonAgentControllerRegistry();
  setDungeonAgentControllerOverride(state.agents[0], registry.get(CHASE_PLAYER_CONTROLLER_ID)!, { navigationStrategy: 'path', stopDistance: 0, moveDurationSeconds: 0 });
  const actions = updateDungeonAgentControllers(state, map, registry, 0.1, { playerTileIndex: 4 });
  assert.equal(actions[0]?.direction, 'west'); assert.equal(state.agents[0].tileIndex, 4);
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
