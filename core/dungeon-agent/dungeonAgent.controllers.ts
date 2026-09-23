import {
  getDungeonMovementDirectionsForMode,
  getDungeonMovementDirectionCost,
  resolveDungeonMovementProfile,
  type DungeonMovementDirection,
} from '../dungeon-movement/index.ts';
import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { findDungeonPath, type DungeonPathResult } from '../dungeon-navigation/index.ts';
import {
  inspectDungeonAgentStepTraversal,
  syncDungeonAgentPathReservation,
  startDungeonAgentMovement,
  resolveDungeonAgentPriority,
} from './dungeonAgent.runtime.ts';
import type {
  DungeonAgentControllerConfig,
  DungeonAgentMovementResult,
  DungeonAgentRuntimeState,
  DungeonRuntimeAgent,
} from './dungeonAgent.types.ts';

export const STATIONARY_CONTROLLER_ID = 'stationary';
export const RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID = 'random-after-player-step';
export const CONTINUOUS_RANDOM_WALK_CONTROLLER_ID = 'continuous-random-walk';
export const MOVE_TO_TILE_CONTROLLER_ID = 'move-to-tile';
export const PATROL_ROUTE_CONTROLLER_ID = 'patrol-route';
export const CHASE_PLAYER_CONTROLLER_ID = 'chase-player';

export type DungeonAgentControllerTrigger = 'player-step' | 'continuous';

export type DungeonAgentControllerAction = Readonly<{
  entityId: string;
  controllerId: string;
  trigger: DungeonAgentControllerTrigger;
  outcome: 'move-started' | 'idle' | 'blocked';
  direction?: DungeonMovementDirection;
  movementResult?: DungeonAgentMovementResult;
}>;

export type DungeonAgentControllerExecutionOptions = Readonly<{
  playerTileIndex?: number;
  /** 每个其他 Agent 的路径预约给该格增加的寻路代价。 */
  reservationPenalty?: number;
  /** 单次 Controller 更新允许发起的寻路次数，避免多个 Agent 同帧集中搜索。 */
  maxPathSearchesPerUpdate?: number;
}>;

type RandomControllerState = {
  controllerId: string;
  randomState: number;
  idleRemainingSeconds: number | null;
  lastAction?: DungeonAgentControllerAction;
  planSequence?: number;
  waypointIndex?: number;
  arrivedWaypointIndex?: number;
  waypointWaitRemainingSeconds?: number;
  patrolDirection?: 1 | -1;
  blockedElapsedSeconds?: number;
  pathRetryRemainingSeconds?: number;
  satisfiedTargetTileIndex?: number;
  satisfiedAtTileIndex?: number;
  lockedSegments?: Record<string, Readonly<{
    tileIndices: readonly number[];
    directions: readonly DungeonMovementDirection[];
    totalCost: number;
    visitedCount: number;
  }>>;
};

type DungeonAgentPathPlanningOptions = Readonly<{
  ignoreAgentOccupancy?: boolean;
  useReservations?: boolean;
  /** 允许规划到当前被占据的目标格；追踪者会在进入前按停止距离结束。 */
  allowOccupiedTarget?: boolean;
  maxVisited?: number;
}>;

type DungeonAgentPathSearchBudget = { remaining: number };

type DungeonAgentControllerContext = Readonly<{
  state: DungeonAgentRuntimeState;
  map: DungeonRuntimeMap;
  agent: DungeonRuntimeAgent;
  trigger: DungeonAgentControllerTrigger;
  playerTileIndex?: number;
  random(): number;
  findPathTo(toTileIndex: number, options?: DungeonAgentPathPlanningOptions): DungeonPathResult;
  tryMove(direction: DungeonMovementDirection, durationSeconds: number): DungeonAgentControllerAction;
  tryRandomMove(durationSeconds: number): DungeonAgentControllerAction;
  idle(): DungeonAgentControllerAction;
}>;

export type DungeonAgentControllerNumberParameter = Readonly<{
  key: string;
  label: string;
  description?: string;
  type: 'number';
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
}>;

export type DungeonAgentControllerTextParameter = Readonly<{
  key: string;
  label: string;
  description?: string;
  type: 'text';
  defaultValue?: string;
  placeholder?: string;
}>;

export type DungeonAgentControllerBooleanParameter = Readonly<{
  key: string;
  label: string;
  description?: string;
  type: 'boolean';
  defaultValue: boolean;
}>;

export type DungeonAgentControllerSelectParameter = Readonly<{
  key: string;
  label: string;
  description?: string;
  type: 'select';
  defaultValue: string;
  options: readonly Readonly<{ value: string; label: string }>[];
}>;

export type DungeonAgentTilePoint = Readonly<{
  x: number;
  y: number;
}>;

export type DungeonAgentControllerTileListParameter = Readonly<{
  key: string;
  label: string;
  description?: string;
  type: 'tile-list';
  defaultValue: readonly DungeonAgentTilePoint[];
}>;

export type DungeonAgentControllerParameter =
  | DungeonAgentControllerNumberParameter
  | DungeonAgentControllerTextParameter
  | DungeonAgentControllerBooleanParameter
  | DungeonAgentControllerSelectParameter
  | DungeonAgentControllerTileListParameter;

export type DungeonAgentController = Readonly<{
  id: string;
  label: string;
  description: string;
  parameters: readonly DungeonAgentControllerParameter[];
  onPlayerStep?(context: DungeonAgentControllerContext): DungeonAgentControllerAction | null;
  update?(context: DungeonAgentControllerContext, deltaSeconds: number): DungeonAgentControllerAction | null;
}>;

export type DungeonAgentControllerRegistry = ReadonlyMap<string, DungeonAgentController>;

export const resolveDungeonAgentControllerConfig = (
  agent: DungeonRuntimeAgent,
): DungeonAgentControllerConfig => agent.controllerOverride ?? {
  controllerId: agent.binding.controller.controllerId,
  parameters: agent.binding.controller.parameters ?? {},
};

export const createDefaultDungeonAgentControllerParameters = (
  controller: DungeonAgentController,
): Record<string, unknown> => Object.fromEntries(controller.parameters.flatMap((parameter) => (
  parameter.defaultValue === undefined ? [] : [[
    parameter.key,
    parameter.type === 'tile-list'
      ? parameter.defaultValue.map((point) => ({ ...point }))
      : parameter.defaultValue,
  ]]
)));

export const normalizeDungeonAgentTilePointList = (
  value: unknown,
  fallback: readonly DungeonAgentTilePoint[] = [],
): DungeonAgentTilePoint[] => {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[;\n]+/).map((part) => {
        const [x, y] = part.trim().split(',');
        return { x, y };
      })
      : fallback;
  return source.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const { x, y } = item as Partial<DungeonAgentTilePoint>;
    const normalizedX = Number(x);
    const normalizedY = Number(y);
    return Number.isInteger(normalizedX) && Number.isInteger(normalizedY)
      ? [{ x: normalizedX, y: normalizedY }]
      : [];
  });
};

export const normalizeDungeonAgentControllerParameters = (
  controller: DungeonAgentController,
  parameters: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const normalized = { ...parameters };
  controller.parameters.forEach((definition) => {
    const raw = parameters[definition.key];
    if (definition.type === 'boolean') {
      normalized[definition.key] = typeof raw === 'boolean' ? raw : definition.defaultValue;
      return;
    }
    if (definition.type === 'text') {
      const value = raw === undefined || raw === null ? definition.defaultValue : String(raw);
      if (value === undefined) delete normalized[definition.key];
      else normalized[definition.key] = value;
      return;
    }
    if (definition.type === 'select') {
      const value = typeof raw === 'string' ? raw : definition.defaultValue;
      normalized[definition.key] = definition.options.some((option) => option.value === value)
        ? value
        : definition.defaultValue;
      return;
    }
    if (definition.type === 'tile-list') {
      normalized[definition.key] = normalizeDungeonAgentTilePointList(raw, definition.defaultValue);
      return;
    }
    if ((raw === undefined || raw === '') && definition.defaultValue === undefined) {
      delete normalized[definition.key];
      return;
    }
    let value = Number(raw ?? definition.defaultValue);
    if (!Number.isFinite(value)) value = definition.defaultValue ?? 0;
    if (definition.integer) value = Math.trunc(value);
    if (definition.min !== undefined) value = Math.max(definition.min, value);
    if (definition.max !== undefined) value = Math.min(definition.max, value);
    normalized[definition.key] = value;
  });
  return normalized;
};

export const setDungeonAgentControllerOverride = (
  agent: DungeonRuntimeAgent,
  controller: DungeonAgentController,
  parameters: Readonly<Record<string, unknown>> = createDefaultDungeonAgentControllerParameters(controller),
  state?: DungeonAgentRuntimeState,
): void => {
  agent.controllerOverride = {
    controllerId: controller.id,
    parameters: normalizeDungeonAgentControllerParameters(controller, parameters),
  };
  agent.controllerState = undefined;
  agent.navigationPlan = undefined;
  agent.actionClock = 0;
  if (state) syncDungeonAgentPathReservation(state, agent);
};

export const clearDungeonAgentControllerOverride = (
  agent: DungeonRuntimeAgent,
  state?: DungeonAgentRuntimeState,
): void => {
  agent.controllerOverride = undefined;
  agent.controllerState = undefined;
  agent.navigationPlan = undefined;
  agent.actionClock = 0;
  if (state) syncDungeonAgentPathReservation(state, agent);
};

const numberParameter = (
  agent: DungeonRuntimeAgent,
  key: string,
  fallback: number,
  minimum = 0,
): number => {
  const value = Number(resolveDungeonAgentControllerConfig(agent).parameters[key]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
};

const hashSeed = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x9e3779b9;
};

const controllerState = (agent: DungeonRuntimeAgent): RandomControllerState => {
  const controller = resolveDungeonAgentControllerConfig(agent);
  const controllerId = controller.controllerId;
  const current = agent.controllerState as Partial<RandomControllerState> | undefined;
  if (current?.controllerId === controllerId && typeof current.randomState === 'number') {
    return current as RandomControllerState;
  }
  const configuredSeed = Number(controller.parameters.seed);
  const randomState = Number.isInteger(configuredSeed)
    ? (configuredSeed >>> 0) || 0x9e3779b9
    : hashSeed(`${agent.binding.entity.id}:${controllerId}`);
  const next: RandomControllerState = {
    controllerId,
    randomState,
    idleRemainingSeconds: null,
  };
  agent.controllerState = next;
  return next;
};

const nextRandom = (state: RandomControllerState): number => {
  let value = state.randomState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.randomState = value >>> 0 || 0x9e3779b9;
  return state.randomState / 0x1_0000_0000;
};

const shouldIdle = (agent: DungeonRuntimeAgent, random: () => number): boolean => {
  const idleWeight = numberParameter(agent, 'idleWeight', 0);
  const moveWeight = numberParameter(agent, 'moveWeight', 1);
  const total = idleWeight + moveWeight;
  return total <= 0 || random() * total < idleWeight;
};

const createContext = (
  state: DungeonAgentRuntimeState,
  map: DungeonRuntimeMap,
  agent: DungeonRuntimeAgent,
  trigger: DungeonAgentControllerTrigger,
  options: DungeonAgentControllerExecutionOptions,
  pathSearchBudget: DungeonAgentPathSearchBudget,
): DungeonAgentControllerContext => {
  const runtimeState = controllerState(agent);
  const base = { entityId: agent.binding.entity.id, controllerId: resolveDungeonAgentControllerConfig(agent).controllerId, trigger };
  const random = () => nextRandom(runtimeState);
  const remember = (action: DungeonAgentControllerAction): DungeonAgentControllerAction => {
    runtimeState.lastAction = action;
    return action;
  };
  const tryMove = (direction: DungeonMovementDirection, durationSeconds: number) => {
    const result = startDungeonAgentMovement(state, map, agent.binding.entity.id, direction, {
      durationSeconds,
    });
    return remember({
      ...base,
      outcome: result.started ? 'move-started' : 'blocked',
      direction,
      movementResult: result,
    });
  };
  return {
    state,
    map,
    agent,
    trigger,
    playerTileIndex: options.playerTileIndex,
    random,
    findPathTo: (toTileIndex, planningOptions = {}) => {
      if (pathSearchBudget.remaining <= 0) {
        return {
          found: false,
          tileIndices: [],
          directions: [],
          totalCost: Number.POSITIVE_INFINITY,
          visitedCount: 0,
          reason: 'budget-exhausted',
        };
      }
      pathSearchBudget.remaining -= 1;
      return findDungeonPath({
      map,
      fromTileIndex: agent.tileIndex,
      toTileIndex,
      seed: Math.floor(random() * 0x1_0000_0000),
      directionMode: resolveDungeonMovementProfile(
        state.traversal.actors.get(agent.binding.entity.id)?.movementProfileId ?? 'ground',
      ).directionMode,
      maxVisited: planningOptions.maxVisited,
      canTraverse: (fromTileIndex, _nextTileIndex, direction) => !inspectDungeonAgentStepTraversal(
        state,
        map,
        agent,
        fromTileIndex,
        direction,
        {
          ignoreAgentOccupancy: planningOptions.ignoreAgentOccupancy,
          allowOccupiedTileIndex: planningOptions.allowOccupiedTarget ? toTileIndex : undefined,
        },
      ).blockedReason,
      getStepCost: (_fromTileIndex, toTileIndex, direction) => {
        const baseCost = getDungeonMovementDirectionCost(direction);
        if (planningOptions.useReservations === false) return baseCost;
        const otherReservations = state.traversal.reservationCount(toTileIndex, agent.binding.entity.id);
        const penalty = Number.isFinite(options.reservationPenalty) && (options.reservationPenalty ?? 0) >= 0
          ? options.reservationPenalty!
          : 2;
        return baseCost + otherReservations * penalty;
      },
      });
    },
    idle: () => remember({ ...base, outcome: 'idle' }),
    tryMove,
    tryRandomMove: (durationSeconds) => {
      const legalDirections = state.traversal.getLegalDirections(
        agent.binding.entity.id,
        agent.tileIndex,
        1,
      );
      if (!legalDirections.length) return remember({ ...base, outcome: 'blocked' });
      const direction = legalDirections[Math.floor(random() * legalDirections.length)];
      return tryMove(direction, durationSeconds);
    },
  };
};

const RANDOM_PARAMETERS: readonly DungeonAgentControllerParameter[] = [
  { key: 'moveDurationSeconds', label: '每格移动耗时（秒）', type: 'number', defaultValue: 0.3, min: 0, step: 0.05 },
  { key: 'idleWeight', label: '等待权重', type: 'number', defaultValue: 0, min: 0, step: 0.1 },
  { key: 'moveWeight', label: '移动权重', type: 'number', defaultValue: 1, min: 0, step: 0.1 },
  { key: 'seed', label: '随机种子', description: '留空时根据 Agent ID 自动生成。', type: 'number', step: 1, integer: true },
];

const stationaryController: DungeonAgentController = {
  id: STATIONARY_CONTROLLER_ID,
  label: '保持静止',
  description: '不主动执行任何移动或转向。',
  parameters: [],
};

const textParameter = (agent: DungeonRuntimeAgent, key: string, fallback = ''): string => {
  const value = resolveDungeonAgentControllerConfig(agent).parameters[key];
  return typeof value === 'string' ? value : fallback;
};

const booleanParameter = (agent: DungeonRuntimeAgent, key: string, fallback: boolean): boolean => {
  const value = resolveDungeonAgentControllerConfig(agent).parameters[key];
  return typeof value === 'boolean' ? value : fallback;
};

const randomAfterPlayerStepController: DungeonAgentController = {
  id: RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID,
  label: '玩家格步后随机移动',
  description: '玩家成功完成格步后，按 Agent 的行动周期随机等待或移动。',
  parameters: RANDOM_PARAMETERS,
  onPlayerStep(context) {
    if (context.agent.movement) return null;
    if (shouldIdle(context.agent, context.random)) return context.idle();
    return context.tryRandomMove(numberParameter(context.agent, 'moveDurationSeconds', 0.3));
  },
};

const continuousRandomWalkController: DungeonAgentController = {
  id: CONTINUOUS_RANDOM_WALK_CONTROLLER_ID,
  label: '连续随机移动',
  description: '使用独立等待计时器持续随机等待或移动，不依赖玩家格步。',
  parameters: [
    ...RANDOM_PARAMETERS,
    { key: 'minIdleSeconds', label: '最短等待时间（秒）', type: 'number', defaultValue: 0.2, min: 0, step: 0.05 },
    { key: 'maxIdleSeconds', label: '最长等待时间（秒）', type: 'number', defaultValue: 0.8, min: 0, step: 0.05 },
  ],
  update(context, deltaSeconds) {
    if (context.agent.movement) return null;
    const state = controllerState(context.agent);
    if (state.idleRemainingSeconds === null) {
      const minimum = numberParameter(context.agent, 'minIdleSeconds', 0.2);
      const maximum = Math.max(minimum, numberParameter(context.agent, 'maxIdleSeconds', 0.8));
      state.idleRemainingSeconds = minimum + (maximum - minimum) * context.random();
    }
    state.idleRemainingSeconds -= deltaSeconds;
    if (state.idleRemainingSeconds > 0) return null;
    state.idleRemainingSeconds = null;
    if (shouldIdle(context.agent, context.random)) return context.idle();
    return context.tryRandomMove(numberParameter(context.agent, 'moveDurationSeconds', 0.3));
  },
};

const legacyRandomWalkController: DungeonAgentController = {
  ...randomAfterPlayerStepController,
  id: 'random-walk',
  label: '随机移动（旧版兼容）',
  description: '旧地图使用的 Controller ID；行为等同于“玩家格步后随机移动”。',
};

type NavigationPlanStatus = 'ready' | 'deferred' | 'unreachable';

const DYNAMIC_BLOCK_RETRY_SECONDS = 0.2;
const STATIC_REPAIR_RETRY_SECONDS = 0.05;
const FAILED_PATH_RETRY_SECONDS = 0.75;
const MAX_DYNAMIC_BLOCK_ATTEMPTS = 3;
const MAX_LOCAL_REPAIRS = 3;
const LOCAL_REPAIR_MAX_VISITED = 96;

const isDynamicBlock = (reason: DungeonAgentMovementResult['blockedReason']): boolean => (
  reason === 'occupied' || reason === 'movement-in-progress'
);

const isRepairableStaticBlock = (reason: DungeonAgentMovementResult['blockedReason']): boolean => (
  reason === 'terrain' || reason === 'movement-obstacle' || reason === 'corner-blocked'
);

const tryReusePlanForTarget = (
  context: DungeonAgentControllerContext,
  targetTileIndex: number,
): boolean => {
  const current = context.agent.navigationPlan;
  if (!current || current.tileIndices[current.nextStepIndex] !== context.agent.tileIndex) return false;
  const targetPathIndex = current.tileIndices.indexOf(targetTileIndex, current.nextStepIndex);
  const runtimeState = controllerState(context.agent);
  if (targetPathIndex >= current.nextStepIndex) {
    runtimeState.planSequence = (runtimeState.planSequence ?? 0) + 1;
    context.agent.navigationPlan = {
      ...current,
      targetTileIndex,
      tileIndices: current.tileIndices.slice(0, targetPathIndex + 1),
      directions: current.directions.slice(0, targetPathIndex),
      totalCost: current.directions.slice(0, targetPathIndex).reduce(
        (cost, direction) => cost + getDungeonMovementDirectionCost(direction),
        0,
      ),
      planSequence: runtimeState.planSequence,
      blocked: undefined,
    };
    syncDungeonAgentPathReservation(context.state, context.agent);
    return true;
  }
  const profile = resolveDungeonMovementProfile(
    context.state.traversal.actors.get(context.agent.binding.entity.id)?.movementProfileId ?? 'ground',
  );
  const appendedDirection = getDungeonMovementDirectionsForMode(profile.directionMode).find((direction) => {
    const inspection = inspectDungeonAgentStepTraversal(
      context.state,
      context.map,
      context.agent,
      current.targetTileIndex,
      direction,
      { ignoreAgentOccupancy: true, allowOccupiedTileIndex: targetTileIndex },
    );
    return !inspection.blockedReason && inspection.toTileIndex === targetTileIndex;
  });
  if (!appendedDirection) return false;
  runtimeState.planSequence = (runtimeState.planSequence ?? 0) + 1;
  context.agent.navigationPlan = {
    ...current,
    targetTileIndex,
    tileIndices: [...current.tileIndices, targetTileIndex],
    directions: [...current.directions, appendedDirection],
    totalCost: current.totalCost + getDungeonMovementDirectionCost(appendedDirection),
    planSequence: runtimeState.planSequence,
    blocked: undefined,
  };
  syncDungeonAgentPathReservation(context.state, context.agent);
  return true;
};

const ensureNavigationPlan = (
  context: DungeonAgentControllerContext,
  targetTileIndex: number,
  planningOptions: DungeonAgentPathPlanningOptions = {},
  deltaSeconds = 0,
): NavigationPlanStatus => {
  const current = context.agent.navigationPlan;
  if (current?.targetTileIndex === targetTileIndex
    && current.tileIndices[current.nextStepIndex] === context.agent.tileIndex) return 'ready';
  if (current?.targetTileIndex !== targetTileIndex && tryReusePlanForTarget(context, targetTileIndex)) {
    return 'ready';
  }
  const runtimeState = controllerState(context.agent);
  runtimeState.pathRetryRemainingSeconds = Math.max(
    0,
    (runtimeState.pathRetryRemainingSeconds ?? 0) - deltaSeconds,
  );
  if ((runtimeState.pathRetryRemainingSeconds ?? 0) > 0) return 'deferred';
  if (current) {
    context.agent.navigationPlan = undefined;
    syncDungeonAgentPathReservation(context.state, context.agent);
  }
  runtimeState.planSequence = (runtimeState.planSequence ?? 0) + 1;
  const result = context.findPathTo(targetTileIndex, planningOptions);
  if (result.reason === 'budget-exhausted') return 'deferred';
  context.agent.navigationPlan = result.found ? {
    targetTileIndex,
    tileIndices: result.tileIndices,
    directions: result.directions,
    nextStepIndex: 0,
    totalCost: result.totalCost,
    visitedCount: result.visitedCount,
    planSequence: runtimeState.planSequence,
    repairCount: 0,
  } : undefined;
  if (!context.agent.navigationPlan) {
    runtimeState.pathRetryRemainingSeconds = FAILED_PATH_RETRY_SECONDS;
    return 'unreachable';
  }
  runtimeState.pathRetryRemainingSeconds = 0;
  syncDungeonAgentPathReservation(context.state, context.agent);
  return 'ready';
};

const repairNavigationPlan = (
  context: DungeonAgentControllerContext,
  planningOptions: DungeonAgentPathPlanningOptions,
): NavigationPlanStatus => {
  const plan = context.agent.navigationPlan;
  if (!plan || (plan.repairCount ?? 0) >= MAX_LOCAL_REPAIRS) return 'unreachable';
  const anchorIndex = Math.min(plan.tileIndices.length - 1, plan.nextStepIndex + 8);
  if (anchorIndex <= plan.nextStepIndex) return 'unreachable';
  const result = context.findPathTo(plan.tileIndices[anchorIndex], {
    ...planningOptions,
    maxVisited: LOCAL_REPAIR_MAX_VISITED,
  });
  if (result.reason === 'budget-exhausted') return 'deferred';
  if (!result.found) return 'unreachable';
  const runtimeState = controllerState(context.agent);
  runtimeState.planSequence = (runtimeState.planSequence ?? 0) + 1;
  const suffixDirections = plan.directions.slice(anchorIndex);
  context.agent.navigationPlan = {
    targetTileIndex: plan.targetTileIndex,
    tileIndices: [...result.tileIndices, ...plan.tileIndices.slice(anchorIndex + 1)],
    directions: [...result.directions, ...suffixDirections],
    nextStepIndex: 0,
    totalCost: result.totalCost + suffixDirections.reduce(
      (cost, direction) => cost + getDungeonMovementDirectionCost(direction),
      0,
    ),
    visitedCount: result.visitedCount,
    planSequence: runtimeState.planSequence,
    repairCount: (plan.repairCount ?? 0) + 1,
  };
  syncDungeonAgentPathReservation(context.state, context.agent);
  return 'ready';
};

const rememberBlockedPlan = (
  context: DungeonAgentControllerContext,
  result: DungeonAgentMovementResult | undefined,
): void => {
  const plan = context.agent.navigationPlan;
  const reason = result?.blockedReason;
  if (!plan || !reason) return;
  const sameEdge = plan.blocked?.fromTileIndex === context.agent.tileIndex
    && plan.blocked.toTileIndex === result.toTileIndex;
  plan.blocked = {
    reason,
    fromTileIndex: context.agent.tileIndex,
    toTileIndex: result.toTileIndex,
    retryRemainingSeconds: isDynamicBlock(reason)
      ? DYNAMIC_BLOCK_RETRY_SECONDS + (hashSeed(context.agent.binding.entity.id) % 80) / 1000
      : STATIC_REPAIR_RETRY_SECONDS,
    consecutiveFailures: sameEdge ? plan.blocked!.consecutiveFailures + 1 : 1,
  };
};

const ensureLockedPatrolPlan = (
  context: DungeonAgentControllerContext,
  targetTileIndex: number,
): boolean => {
  const current = context.agent.navigationPlan;
  if (current?.targetTileIndex === targetTileIndex
    && current.tileIndices[current.nextStepIndex] === context.agent.tileIndex) return true;
  const state = controllerState(context.agent);
  const segmentKey = `${context.agent.tileIndex}->${targetTileIndex}`;
  state.lockedSegments ??= {};
  let segment = state.lockedSegments[segmentKey];
  if (!segment) {
    const result = context.findPathTo(targetTileIndex, {
      ignoreAgentOccupancy: true,
      useReservations: false,
    });
    if (!result.found) return false;
    segment = {
      tileIndices: result.tileIndices,
      directions: result.directions,
      totalCost: result.totalCost,
      visitedCount: result.visitedCount,
    };
    state.lockedSegments[segmentKey] = segment;
  }
  state.planSequence = (state.planSequence ?? 0) + 1;
  context.agent.navigationPlan = {
    targetTileIndex,
    ...segment,
    nextStepIndex: 0,
    planSequence: state.planSequence,
  };
  syncDungeonAgentPathReservation(context.state, context.agent);
  return true;
};

const followNavigationPlan = (
  context: DungeonAgentControllerContext,
  targetTileIndex: number,
  durationSeconds: number,
  planningOptions: DungeonAgentPathPlanningOptions = {},
  deltaSeconds = 0,
): DungeonAgentControllerAction | null => {
  if (context.agent.tileIndex === targetTileIndex) {
    if (context.agent.navigationPlan) {
      context.agent.navigationPlan = undefined;
      syncDungeonAgentPathReservation(context.state, context.agent);
    }
    return null;
  }
  const planStatus = ensureNavigationPlan(context, targetTileIndex, planningOptions, deltaSeconds);
  if (planStatus === 'deferred') return null;
  if (planStatus === 'unreachable') return context.idle();
  let plan = context.agent.navigationPlan!;
  if (plan.blocked) {
    plan.blocked.retryRemainingSeconds = Math.max(
      0,
      plan.blocked.retryRemainingSeconds - deltaSeconds,
    );
    if (plan.blocked.retryRemainingSeconds > 0) return null;
    if (!isDynamicBlock(plan.blocked.reason) && !isRepairableStaticBlock(plan.blocked.reason)) {
      context.agent.navigationPlan = undefined;
      controllerState(context.agent).pathRetryRemainingSeconds = STATIC_REPAIR_RETRY_SECONDS;
      syncDungeonAgentPathReservation(context.state, context.agent);
      return null;
    }
    const needsRepair = !isDynamicBlock(plan.blocked.reason)
      || plan.blocked.consecutiveFailures >= MAX_DYNAMIC_BLOCK_ATTEMPTS;
    if (needsRepair) {
      const repairStatus = repairNavigationPlan(context, planningOptions);
      if (repairStatus === 'deferred') return null;
      if (repairStatus === 'unreachable') {
        context.agent.navigationPlan = undefined;
        controllerState(context.agent).pathRetryRemainingSeconds = STATIC_REPAIR_RETRY_SECONDS;
        syncDungeonAgentPathReservation(context.state, context.agent);
        return null;
      }
      plan = context.agent.navigationPlan!;
    }
  }
  const direction = plan.directions[plan.nextStepIndex];
  if (!direction) return null;
  const action = context.tryMove(direction, durationSeconds);
  if (action.outcome !== 'move-started') {
    rememberBlockedPlan(context, action.movementResult);
  } else if (action.movementResult?.completed) {
    plan.nextStepIndex += 1;
    plan.blocked = undefined;
    syncDungeonAgentPathReservation(context.state, context.agent);
  } else {
    plan.blocked = undefined;
  }
  return action;
};

const parsePatrolRoute = (value: unknown, map: DungeonRuntimeMap): number[] => {
  const result: number[] = [];
  const points = Array.isArray(value)
    ? normalizeDungeonAgentTilePointList(value)
    : String(value ?? '').split(/[;\n]+/).flatMap((part) => {
      const [rawX, rawY] = part.trim().split(',');
      const x = Number(rawX);
      const y = Number(rawY);
      return Number.isInteger(x) && Number.isInteger(y) ? [{ x, y }] : [];
    });
  points.forEach(({ x, y }) => {
    if (!Number.isInteger(x) || !Number.isInteger(y)
      || x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const tileIndex = y * map.width + x;
    if (result[result.length - 1] !== tileIndex) result.push(tileIndex);
  });
  return result;
};

type PatrolPathPolicy = 'adaptive' | 'locked' | 'wait-then-repath';
type PatrolRoutePlayback = 'loop' | 'ping-pong' | 'once' | 'random';

const advancePatrolWaypoint = (
  state: RandomControllerState,
  routeLength: number,
  playback: PatrolRoutePlayback,
  random: () => number,
): boolean => {
  const current = state.waypointIndex ?? 0;
  if (routeLength <= 1) return false;
  if (playback === 'once') {
    if (current >= routeLength - 1) return false;
    state.waypointIndex = current + 1;
    return true;
  }
  if (playback === 'random') {
    const offset = 1 + Math.floor(random() * (routeLength - 1));
    state.waypointIndex = (current + offset) % routeLength;
    return true;
  }
  if (playback === 'ping-pong') {
    state.patrolDirection ??= 1;
    if (current >= routeLength - 1) state.patrolDirection = -1;
    else if (current <= 0) state.patrolDirection = 1;
    state.waypointIndex = current + state.patrolDirection;
    return true;
  }
  state.waypointIndex = (current + 1) % routeLength;
  return true;
};

const followPatrolPlan = (
  context: DungeonAgentControllerContext,
  targetTileIndex: number,
  durationSeconds: number,
  deltaSeconds: number,
  policy: PatrolPathPolicy,
): DungeonAgentControllerAction | null => {
  const state = controllerState(context.agent);
  if (policy === 'adaptive') {
    return followNavigationPlan(context, targetTileIndex, durationSeconds, {}, deltaSeconds);
  }
  const planStatus = policy === 'locked'
    ? (ensureLockedPatrolPlan(context, targetTileIndex) ? 'ready' : 'unreachable')
    : ensureNavigationPlan(context, targetTileIndex, {}, deltaSeconds);
  if (planStatus === 'deferred') return null;
  if (planStatus === 'unreachable') return context.idle();
  const plan = context.agent.navigationPlan!;
  if (plan.blocked) {
    state.blockedElapsedSeconds = (state.blockedElapsedSeconds ?? 0) + deltaSeconds;
    plan.blocked.retryRemainingSeconds = Math.max(0, plan.blocked.retryRemainingSeconds - deltaSeconds);
    if (policy === 'wait-then-repath'
      && state.blockedElapsedSeconds >= numberParameter(context.agent, 'blockedWaitSeconds', 1)) {
      context.agent.navigationPlan = undefined;
      state.blockedElapsedSeconds = 0;
      state.pathRetryRemainingSeconds = STATIC_REPAIR_RETRY_SECONDS;
      syncDungeonAgentPathReservation(context.state, context.agent);
      return null;
    }
    if (plan.blocked.retryRemainingSeconds > 0) return null;
    plan.blocked = undefined;
  }
  const direction = plan.directions[plan.nextStepIndex];
  if (!direction) return null;
  const action = context.tryMove(direction, durationSeconds);
  if (action.outcome === 'move-started') {
    state.blockedElapsedSeconds = 0;
    if (action.movementResult?.completed) {
      plan.nextStepIndex += 1;
      syncDungeonAgentPathReservation(context.state, context.agent);
    }
  } else {
    if (policy === 'wait-then-repath') {
      state.blockedElapsedSeconds = (state.blockedElapsedSeconds ?? 0) + deltaSeconds;
    }
    rememberBlockedPlan(context, action.movementResult);
  }
  return action;
};

const moveToTileController: DungeonAgentController = {
  id: MOVE_TO_TILE_CONTROLLER_ID,
  label: '移动到目标格',
  description: '计算随机化的等价最短路径，并在路径受阻时重新规划。',
  parameters: [
    { key: 'targetTileX', label: '目标格 X', type: 'number', defaultValue: 0, min: 0, step: 1, integer: true },
    { key: 'targetTileY', label: '目标格 Y', type: 'number', defaultValue: 0, min: 0, step: 1, integer: true },
    { key: 'moveDurationSeconds', label: '每格移动耗时（秒）', type: 'number', defaultValue: 0.3, min: 0, step: 0.05 },
    { key: 'seed', label: '随机种子', description: '留空时根据 Agent ID 自动生成。', type: 'number', step: 1, integer: true },
  ],
  update(context, deltaSeconds) {
    if (context.agent.movement) return null;
    const targetX = Math.trunc(numberParameter(context.agent, 'targetTileX', 0));
    const targetY = Math.trunc(numberParameter(context.agent, 'targetTileY', 0));
    if (targetX < 0 || targetY < 0 || targetX >= context.map.width || targetY >= context.map.height) {
      return context.idle();
    }
    const targetTileIndex = targetY * context.map.width + targetX;
    return followNavigationPlan(
      context,
      targetTileIndex,
      numberParameter(context.agent, 'moveDurationSeconds', 0.3),
      {},
      deltaSeconds,
    );
  },
};

const patrolRouteController: DungeonAgentController = {
  id: PATROL_ROUTE_CONTROLLER_ID,
  label: '巡逻点寻路',
  description: '按巡逻点列表自动规划；可自适应绕路、锁定路线或等待后重算。',
  parameters: [
    { key: 'route', label: '巡逻点列表', type: 'tile-list', defaultValue: [] },
    {
      key: 'routePlayback', label: '路线播放', type: 'select', defaultValue: 'loop',
      options: [
        { value: 'loop', label: '循环' },
        { value: 'ping-pong', label: '往返' },
        { value: 'once', label: '单次' },
        { value: 'random', label: '随机巡逻点' },
      ],
    },
    {
      key: 'pathPolicy', label: '路径策略', type: 'select', defaultValue: 'adaptive',
      options: [
        { value: 'adaptive', label: '自适应绕路' },
        { value: 'locked', label: '锁定最短路线，受阻等待' },
        { value: 'wait-then-repath', label: '等待后重新寻路' },
      ],
    },
    { key: 'blockedWaitSeconds', label: '受阻等待后重算（秒）', type: 'number', defaultValue: 1, min: 0, step: 0.1 },
    { key: 'waitAtWaypointSeconds', label: '到点等待（秒）', type: 'number', defaultValue: 0.2, min: 0, step: 0.05 },
    { key: 'moveDurationSeconds', label: '每格移动耗时（秒）', type: 'number', defaultValue: 0.3, min: 0, step: 0.05 },
    { key: 'seed', label: '随机种子', description: '留空时根据 Agent ID 自动生成。', type: 'number', step: 1, integer: true },
  ],
  update(context, deltaSeconds) {
    if (context.agent.movement) return null;
    const routeConfig = resolveDungeonAgentControllerConfig(context.agent).parameters.route;
    const route = parsePatrolRoute(routeConfig ?? [], context.map);
    if (!route.length) return context.idle();
    const state = controllerState(context.agent);
    const configuredPlayback = resolveDungeonAgentControllerConfig(context.agent).parameters.routePlayback;
    const playback = (typeof configuredPlayback === 'string'
      ? configuredPlayback
      : booleanParameter(context.agent, 'loop', true) ? 'loop' : 'once') as PatrolRoutePlayback;
    const policy = textParameter(context.agent, 'pathPolicy', 'adaptive') as PatrolPathPolicy;
    state.waypointIndex = Math.min(state.waypointIndex ?? 0, route.length - 1);
    let target = route[state.waypointIndex];
    if (context.agent.tileIndex === target) {
      if (context.agent.navigationPlan) {
        context.agent.navigationPlan = undefined;
        syncDungeonAgentPathReservation(context.state, context.agent);
      }
      if (state.arrivedWaypointIndex !== state.waypointIndex) {
        state.arrivedWaypointIndex = state.waypointIndex;
        state.waypointWaitRemainingSeconds = numberParameter(context.agent, 'waitAtWaypointSeconds', 0.2);
      }
      state.waypointWaitRemainingSeconds = Math.max(
        0,
        (state.waypointWaitRemainingSeconds ?? 0) - deltaSeconds,
      );
      if (state.waypointWaitRemainingSeconds > 0) return null;
      if (!advancePatrolWaypoint(state, route.length, playback, context.random)) return null;
      state.arrivedWaypointIndex = undefined;
      state.blockedElapsedSeconds = 0;
      target = route[state.waypointIndex];
    }
    return followPatrolPlan(
      context,
      target,
      numberParameter(context.agent, 'moveDurationSeconds', 0.3),
      deltaSeconds,
      policy,
    );
  },
};

const chasePlayerController: DungeonAgentController = {
  id: CHASE_PLAYER_CONTROLLER_ID,
  label: '追踪玩家',
  description: '持续追踪玩家当前格；玩家换格或路径受阻时自动重新规划。',
  parameters: [
    { key: 'stopDistance', label: '停止距离（格）', type: 'number', defaultValue: 1, min: 0, step: 1, integer: true },
    { key: 'moveDurationSeconds', label: '每格移动耗时（秒）', type: 'number', defaultValue: 0.3, min: 0, step: 0.05 },
    { key: 'seed', label: '随机种子', description: '留空时根据 Agent ID 自动生成。', type: 'number', step: 1, integer: true },
  ],
  update(context, deltaSeconds) {
    if (context.agent.movement || context.playerTileIndex === undefined) return null;
    const state = controllerState(context.agent);
    if (state.satisfiedTargetTileIndex === context.playerTileIndex
      && state.satisfiedAtTileIndex === context.agent.tileIndex) return null;
    state.satisfiedTargetTileIndex = undefined;
    state.satisfiedAtTileIndex = undefined;
    const planStatus = ensureNavigationPlan(
      context,
      context.playerTileIndex,
      { allowOccupiedTarget: true },
      deltaSeconds,
    );
    if (planStatus === 'deferred') return null;
    if (planStatus === 'unreachable') return context.idle();
    const plan = context.agent.navigationPlan!;
    const remainingSteps = plan.directions.length - plan.nextStepIndex;
    if (remainingSteps <= Math.trunc(numberParameter(context.agent, 'stopDistance', 1))) {
      context.agent.navigationPlan = undefined;
      state.satisfiedTargetTileIndex = context.playerTileIndex;
      state.satisfiedAtTileIndex = context.agent.tileIndex;
      syncDungeonAgentPathReservation(context.state, context.agent);
      return null;
    }
    return followNavigationPlan(
      context,
      context.playerTileIndex,
      numberParameter(context.agent, 'moveDurationSeconds', 0.3),
      { allowOccupiedTarget: true },
      deltaSeconds,
    );
  },
};

export const createDefaultDungeonAgentControllerRegistry = (): DungeonAgentControllerRegistry => new Map([
  [stationaryController.id, stationaryController],
  [randomAfterPlayerStepController.id, randomAfterPlayerStepController],
  // 兼容已经写入地图的早期随机漫游 ID；新地图应使用语义更明确的新 ID。
  [legacyRandomWalkController.id, legacyRandomWalkController],
  [continuousRandomWalkController.id, continuousRandomWalkController],
  [moveToTileController.id, moveToTileController],
  [patrolRouteController.id, patrolRouteController],
  [chasePlayerController.id, chasePlayerController],
]);

const agentsByPriority = (state: DungeonAgentRuntimeState): DungeonRuntimeAgent[] => [...state.agents]
  .sort((left, right) => (
    resolveDungeonAgentPriority(right) - resolveDungeonAgentPriority(left)
    || left.binding.entity.id.localeCompare(right.binding.entity.id)
  ));

export const runDungeonAgentControllersAfterPlayerStep = (
  state: DungeonAgentRuntimeState,
  map: DungeonRuntimeMap,
  registry: DungeonAgentControllerRegistry,
  options: DungeonAgentControllerExecutionOptions = {},
): readonly DungeonAgentControllerAction[] => {
  state.turnNumber += 1;
  const actions: DungeonAgentControllerAction[] = [];
  const pathSearchBudget = {
    remaining: Math.max(1, Math.trunc(options.maxPathSearchesPerUpdate ?? 2)),
  };
  agentsByPriority(state).forEach((agent) => {
    const controller = registry.get(resolveDungeonAgentControllerConfig(agent).controllerId);
    if (!agent.enabled || !controller?.onPlayerStep) return;
    agent.actionClock += 1;
    if (agent.actionClock < agent.binding.gridAgent.actionPeriod) return;
    agent.actionClock = 0;
    const action = controller.onPlayerStep(createContext(
      state, map, agent, 'player-step', options, pathSearchBudget,
    ));
    if (action) actions.push(action);
  });
  return actions;
};

export const updateDungeonAgentControllers = (
  state: DungeonAgentRuntimeState,
  map: DungeonRuntimeMap,
  registry: DungeonAgentControllerRegistry,
  deltaSeconds: number,
  options: DungeonAgentControllerExecutionOptions = {},
): readonly DungeonAgentControllerAction[] => {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError('Agent Controller 帧时间必须是非负有限数。');
  }
  const actions: DungeonAgentControllerAction[] = [];
  const pathSearchBudget = {
    remaining: Math.max(1, Math.trunc(options.maxPathSearchesPerUpdate ?? 2)),
  };
  agentsByPriority(state).forEach((agent) => {
    const controller = registry.get(resolveDungeonAgentControllerConfig(agent).controllerId);
    if (!agent.enabled || !controller?.update) return;
    const action = controller.update(createContext(
      state, map, agent, 'continuous', options, pathSearchBudget,
    ), deltaSeconds);
    if (action) actions.push(action);
  });
  return actions;
};
