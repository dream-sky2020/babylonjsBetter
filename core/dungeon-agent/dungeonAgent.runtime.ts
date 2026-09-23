import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { createDungeonTraversalWorld, type DungeonTraversalWorld } from '../dungeon-traversal/index.ts';
import { createDungeonMovementResolver, type DungeonMovementResolver } from '../dungeon-movement/index.ts';
import {
  DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS,
  getDungeonMovementDirectionCost,
  type DungeonMovementDirection,
} from '../dungeon-movement/index.ts';
import { scanDungeonDocumentAgents } from './dungeonAgent.scan.ts';
import { resolveDungeonSpatialFootprint } from '../dungeon-space/index.ts';
import type {
  DungeonAgentMovementResult,
  DungeonAgentRuntimeState,
  DungeonAgentTurn,
  DungeonRuntimeAgent,
} from './dungeonAgent.types.ts';

export type DungeonAgentMovementOptions = Readonly<{
  durationSeconds?: number;
}>;

export const createDungeonAgentRuntimeState = (
  map: DungeonRuntimeMap,
  traversal: DungeonTraversalWorld = createDungeonTraversalWorld(map),
  movementResolver: DungeonMovementResolver = createDungeonMovementResolver(traversal),
): DungeonAgentRuntimeState => {
  const bindings = scanDungeonDocumentAgents(map.document);
  const agents: DungeonRuntimeAgent[] = bindings.map((binding) => ({
    binding,
    tileIndex: binding.initialTileIndex,
    facing: binding.gridAgent.initialFacing,
    enabled: true,
    actionClock: 0,
    movement: null,
  }));
  agents.forEach((agent) => {
    traversal.registerActor({
      id: agent.binding.entity.id,
      kind: 'agent',
      tileIndex: agent.tileIndex,
      enabled: agent.enabled,
      blocksMovement: agent.binding.gridAgent.blocksMovement,
      spatialFootprint: resolveDungeonSpatialFootprint(
        agent.binding.gridAgent.spatialFootprint,
        'center',
      ),
      movementProfileId: agent.binding.gridAgent.movementProfileId,
    });
  });
  return {
    turnNumber: 0,
    agents,
    agentIndexByEntityId: new Map(agents.map((agent, index) => [agent.binding.entity.id, index])),
    traversal,
    movementResolver,
  };
};

export const resolveDungeonAgentPriority = (agent: DungeonRuntimeAgent): number => (
  agent.priorityOverride ?? agent.binding.gridAgent.priority
);

export const syncDungeonAgentPathReservation = (
  state: DungeonAgentRuntimeState,
  agent: DungeonRuntimeAgent,
): void => {
  const actorId = agent.binding.entity.id;
  const plan = agent.navigationPlan;
  if (!agent.enabled || !plan) {
    if (agent.reservationPlanSequence === undefined) return;
    state.traversal.clearReservations(actorId);
    agent.reservationPlanSequence = undefined;
    agent.reservationStartIndex = undefined;
    return;
  }
  const startIndex = plan.nextStepIndex + 1;
  if (agent.reservationPlanSequence === plan.planSequence
    && agent.reservationStartIndex === startIndex) return;
  state.traversal.replaceReservations(actorId, plan.tileIndices, startIndex);
  agent.reservationPlanSequence = plan.planSequence;
  agent.reservationStartIndex = startIndex;
};

/** 仅供初始化、恢复与兼容调用；正常帧循环必须使用单 Agent 增量同步。 */
export const rebuildDungeonAgentPathReservations = (state: DungeonAgentRuntimeState): void => {
  state.agents.forEach((agent) => syncDungeonAgentPathReservation(state, agent));
};

const requireDuration = (value: number | undefined): number => {
  const duration = value ?? 0.3;
  if (!Number.isFinite(duration) || duration < 0) throw new RangeError('Agent 移动时长必须是非负有限数。');
  return duration;
};

const getAgent = (state: DungeonAgentRuntimeState, entityId: string) => {
  const index = state.agentIndexByEntityId.get(entityId);
  return index === undefined ? undefined : { index, agent: state.agents[index] };
};

export type DungeonAgentStepTraversalResult = Readonly<{
  toTileIndex?: number;
  blockedReason?: Extract<DungeonAgentMovementResult['blockedReason'],
    | 'direction-not-supported'
    | 'map-boundary'
    | 'terrain'
    | 'movement-obstacle'
    | 'corner-blocked'
    | 'occupied'>;
}>;

export type DungeonAgentStepTraversalOptions = DungeonAgentMovementOptions & Readonly<{
  /** 仅供规划固定路线；实际移动始终检查 Agent 占位。 */
  ignoreAgentOccupancy?: boolean;
  /** 仅供规划追踪目标；实际移动仍检查目标占位。 */
  allowOccupiedTileIndex?: number;
}>;

/** 共享给实际格步和路径规划的单步通行检查，不修改 Agent Runtime。 */
export const inspectDungeonAgentStepTraversal = (
  state: DungeonAgentRuntimeState,
  map: DungeonRuntimeMap,
  agent: DungeonRuntimeAgent,
  fromTileIndex: number,
  direction: DungeonMovementDirection,
  options: DungeonAgentStepTraversalOptions = {},
): DungeonAgentStepTraversalResult => {
  void map;
  const inspection = state.traversal.inspectStep(
    agent.binding.entity.id,
    fromTileIndex,
    direction,
    {
      ignoreDynamicOccupancy: options.ignoreAgentOccupancy,
      allowOccupiedTileIndex: options.allowOccupiedTileIndex,
    },
  );
  return {
    ...(inspection.toTileIndex === undefined ? {} : { toTileIndex: inspection.toTileIndex }),
    ...(inspection.blockedReason ? { blockedReason: inspection.blockedReason } : {}),
  };
};

export const startDungeonAgentMovement = (
  state: DungeonAgentRuntimeState,
  map: DungeonRuntimeMap,
  entityId: string,
  direction: DungeonMovementDirection,
  options: DungeonAgentMovementOptions = {},
): DungeonAgentMovementResult => {
  const resolved = getAgent(state, entityId);
  if (!resolved) return { started: false, completed: false, entityId, blockedReason: 'agent-not-found' };
  const { agent } = resolved;
  const fromTileIndex = agent.tileIndex;
  if (!agent.enabled) return { started: false, completed: false, entityId, fromTileIndex, blockedReason: 'agent-disabled' };
  if (agent.movement) return { started: false, completed: false, entityId, fromTileIndex, blockedReason: 'movement-in-progress' };
  const inspection = inspectDungeonAgentStepTraversal(state, map, agent, fromTileIndex, direction, options);
  const { toTileIndex } = inspection;
  if (inspection.blockedReason || toTileIndex === undefined) {
    return {
      started: false,
      completed: false,
      entityId,
      fromTileIndex,
      toTileIndex,
      blockedReason: inspection.blockedReason ?? 'map-boundary',
    };
  }

  const durationSeconds = requireDuration(options.durationSeconds)
    * getDungeonMovementDirectionCost(direction);
  const fromFacing = agent.facing;
  const requestResult = state.movementResolver.requestMove({
    actorId: agent.binding.entity.id,
    direction,
    durationSeconds,
    commitProgress: state.movementResolver.config.commitProgress,
    basePriority: resolveDungeonAgentPriority(agent),
    progressWeight: state.movementResolver.config.progressWeight,
  });
  if (!requestResult.accepted || !requestResult.request) {
    return {
      started: false,
      completed: false,
      entityId,
      fromTileIndex,
      toTileIndex,
      blockedReason: requestResult.blockedReason === 'reservation-conflict' ? 'occupied'
        : requestResult.blockedReason ?? 'occupied',
    };
  }
  agent.movement = {
    kind: 'move',
    requestId: requestResult.request.id,
    fromTileIndex,
    toTileIndex,
    fromFacing,
    toFacing: direction,
    elapsedSeconds: 0,
    durationSeconds,
    visualProgress: 0,
    rotationProgress: 0,
  };
  if (durationSeconds === 0) {
    const advance = state.movementResolver.advanceActor(entityId, 0);
    if (advance.committed) {
      agent.tileIndex = toTileIndex;
      agent.facing = direction;
    }
    agent.movement = null;
  }
  return { started: true, completed: durationSeconds === 0, entityId, fromTileIndex, toTileIndex };
};

const CLOCKWISE_DIRECTIONS = DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS;

export const startDungeonAgentTurn = (
  state: DungeonAgentRuntimeState,
  entityId: string,
  turn: DungeonAgentTurn,
  durationSeconds = 0.2,
): DungeonAgentMovementResult => {
  const resolved = getAgent(state, entityId);
  if (!resolved) return { started: false, completed: false, entityId, blockedReason: 'agent-not-found' };
  const { agent } = resolved;
  if (!agent.enabled) return { started: false, completed: false, entityId, blockedReason: 'agent-disabled' };
  if (agent.movement) return { started: false, completed: false, entityId, blockedReason: 'movement-in-progress' };
  const duration = requireDuration(durationSeconds);
  const currentIndex = CLOCKWISE_DIRECTIONS.indexOf(agent.facing);
  const offset = turn === 'left' ? -2 : turn === 'right' ? 2 : 4;
  const nextFacing = CLOCKWISE_DIRECTIONS[(currentIndex + offset + 8) % 8];
  const fromFacing = agent.facing;
  agent.facing = nextFacing;
  agent.movement = duration > 0 ? {
    kind: 'turn',
    fromTileIndex: agent.tileIndex,
    toTileIndex: agent.tileIndex,
    fromFacing,
    toFacing: nextFacing,
    elapsedSeconds: 0,
    durationSeconds: duration,
  } : null;
  return {
    started: true,
    completed: duration === 0,
    entityId,
    fromTileIndex: agent.tileIndex,
    toTileIndex: agent.tileIndex,
  };
};

export const updateDungeonAgentMovements = (
  state: DungeonAgentRuntimeState,
  deltaSeconds: number,
): readonly string[] => {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Agent 帧时间必须是非负有限数。');
  const completed: string[] = [];
  state.agents.forEach((agent) => {
    if (!agent.movement) return;
    if (agent.movement.kind === 'move' || agent.movement.kind === 'rollback') {
      const advance = state.movementResolver.advanceActor(agent.binding.entity.id, deltaSeconds);
      if (advance.state === 'rollback') {
        agent.movement.kind = 'rollback';
        agent.navigationPlan = undefined;
        syncDungeonAgentPathReservation(state, agent);
      }
      agent.movement.visualProgress = advance.visualProgress;
      agent.movement.elapsedSeconds = advance.visualProgress * agent.movement.durationSeconds;
      agent.movement.rotationProgress = advance.state === 'rollback'
        ? Math.min(1, (agent.movement.rotationProgress ?? 0) + (
          agent.movement.durationSeconds <= 0 ? 1 : deltaSeconds / agent.movement.durationSeconds
        ))
        : advance.visualProgress;
      if (advance.committed) {
        agent.tileIndex = agent.movement.toTileIndex;
        agent.facing = agent.movement.toFacing;
        const plan = agent.navigationPlan;
        if (plan?.directions[plan.nextStepIndex] === agent.movement.toFacing
          && plan.tileIndices[plan.nextStepIndex] === agent.movement.fromTileIndex) {
          plan.nextStepIndex += 1;
          syncDungeonAgentPathReservation(state, agent);
        }
      }
      if (!advance.completed) return;
      if (advance.rolledBack) agent.facing = agent.movement.toFacing;
      agent.movement = null;
      completed.push(agent.binding.entity.id);
      return;
    }
    agent.movement.elapsedSeconds += deltaSeconds;
    if (agent.movement.elapsedSeconds < agent.movement.durationSeconds) return;
    agent.movement = null;
    completed.push(agent.binding.entity.id);
  });
  return completed;
};
