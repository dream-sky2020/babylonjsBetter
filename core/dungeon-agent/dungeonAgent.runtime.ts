import type { DungeonMapDirection } from '../map/index.ts';
import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { createDungeonTraversalWorld, type DungeonTraversalWorld } from '../dungeon-traversal/index.ts';
import { scanDungeonDocumentAgents } from './dungeonAgent.scan.ts';
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
      movementProfileId: agent.binding.gridAgent.movementProfileId,
    });
  });
  return {
    turnNumber: 0,
    agents,
    agentIndexByEntityId: new Map(agents.map((agent, index) => [agent.binding.entity.id, index])),
    traversal,
  };
};

export const rebuildDungeonAgentPathReservations = (state: DungeonAgentRuntimeState): void => {
  state.agents.forEach((agent) => {
    state.traversal.clearReservations(agent.binding.entity.id);
    const plan = agent.navigationPlan;
    if (!agent.enabled || !plan) return;
    state.traversal.replaceReservations(
      agent.binding.entity.id,
      plan.tileIndices,
      plan.nextStepIndex + 1,
    );
  });
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
    'map-boundary' | 'terrain' | 'movement-obstacle' | 'occupied'>;
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
  direction: DungeonMapDirection,
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
  direction: DungeonMapDirection,
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

  const durationSeconds = requireDuration(options.durationSeconds);
  const fromFacing = agent.facing;
  state.traversal.moveActor(agent.binding.entity.id, toTileIndex);
  agent.tileIndex = toTileIndex;
  agent.facing = direction;
  agent.movement = durationSeconds > 0 ? {
    kind: 'move',
    fromTileIndex,
    toTileIndex,
    fromFacing,
    toFacing: direction,
    elapsedSeconds: 0,
    durationSeconds,
  } : null;
  return { started: true, completed: durationSeconds === 0, entityId, fromTileIndex, toTileIndex };
};

const CLOCKWISE_DIRECTIONS: readonly DungeonMapDirection[] = ['north', 'east', 'south', 'west'];

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
  const offset = turn === 'left' ? -1 : turn === 'right' ? 1 : 2;
  const nextFacing = CLOCKWISE_DIRECTIONS[(currentIndex + offset + 4) % 4];
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
    agent.movement.elapsedSeconds += deltaSeconds;
    if (agent.movement.elapsedSeconds < agent.movement.durationSeconds) return;
    agent.movement = null;
    completed.push(agent.binding.entity.id);
  });
  return completed;
};
