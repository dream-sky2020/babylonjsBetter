import { getDungeonMapTerrainProperties } from '../map-document/index.ts';
import type { DungeonMapDirection } from '../map/index.ts';
import { DUNGEON_MAP_DIRECTION_ORDER } from '../map-document/index.ts';
import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { scanDungeonDocumentAgents } from './dungeonAgent.scan.ts';
import type {
  DungeonAgentMovementResult,
  DungeonAgentRuntimeState,
  DungeonAgentTurn,
  DungeonRuntimeAgent,
} from './dungeonAgent.types.ts';

export type DungeonAgentMovementOptions = Readonly<{
  durationSeconds?: number;
  isStepBlocked?: Readonly<{
    check(
      agent: DungeonRuntimeAgent,
      fromTileIndex: number,
      toTileIndex: number,
      direction: DungeonMapDirection,
    ): boolean;
  }>;
}>;

export const createDungeonAgentRuntimeState = (map: DungeonRuntimeMap): DungeonAgentRuntimeState => {
  const bindings = scanDungeonDocumentAgents(map.document);
  const agents: DungeonRuntimeAgent[] = bindings.map((binding) => ({
    binding,
    tileIndex: binding.initialTileIndex,
    facing: binding.gridAgent.initialFacing,
    enabled: true,
    actionClock: 0,
    movement: null,
  }));
  const occupantsByTile = Array.from({ length: map.topology.tileIds.length }, () => new Set<number>());
  agents.forEach((agent, agentIndex) => {
    const occupants = occupantsByTile[agent.tileIndex];
    if (agent.binding.gridAgent.blocksMovement && [...occupants].some(
      (index) => agents[index].binding.gridAgent.blocksMovement,
    )) {
      throw new Error(`格子“${map.topology.tileIds[agent.tileIndex]}”存在多个阻挡移动的 dungeon-agent。`);
    }
    occupants.add(agentIndex);
  });
  return {
    turnNumber: 0,
    agents,
    agentIndexByEntityId: new Map(agents.map((agent, index) => [agent.binding.entity.id, index])),
    occupantsByTile,
  };
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

export const startDungeonAgentMovement = (
  state: DungeonAgentRuntimeState,
  map: DungeonRuntimeMap,
  entityId: string,
  direction: DungeonMapDirection,
  options: DungeonAgentMovementOptions = {},
): DungeonAgentMovementResult => {
  const resolved = getAgent(state, entityId);
  if (!resolved) return { started: false, completed: false, entityId, blockedReason: 'agent-not-found' };
  const { index, agent } = resolved;
  const fromTileIndex = agent.tileIndex;
  if (!agent.enabled) return { started: false, completed: false, entityId, fromTileIndex, blockedReason: 'agent-disabled' };
  if (agent.movement) return { started: false, completed: false, entityId, fromTileIndex, blockedReason: 'movement-in-progress' };
  const directionIndex = DUNGEON_MAP_DIRECTION_ORDER.indexOf(direction);
  const toTileIndex = map.topology.neighborTileIndices[fromTileIndex * 4 + directionIndex];
  if (toTileIndex < 0) {
    return { started: false, completed: false, entityId, fromTileIndex, blockedReason: 'map-boundary' };
  }
  const targetTileId = map.topology.tileIds[toTileIndex];
  if (getDungeonMapTerrainProperties(map.document.terrain, targetTileId)?.walkable === false) {
    return { started: false, completed: false, entityId, fromTileIndex, toTileIndex, blockedReason: 'terrain' };
  }
  if (options.isStepBlocked?.check(agent, fromTileIndex, toTileIndex, direction)) {
    return { started: false, completed: false, entityId, fromTileIndex, toTileIndex, blockedReason: 'movement-obstacle' };
  }
  const occupied = [...state.occupantsByTile[toTileIndex]].some((occupantIndex) => (
    occupantIndex !== index
    && state.agents[occupantIndex].enabled
    && state.agents[occupantIndex].binding.gridAgent.blocksMovement
  ));
  if (occupied) return { started: false, completed: false, entityId, fromTileIndex, toTileIndex, blockedReason: 'occupied' };

  const durationSeconds = requireDuration(options.durationSeconds);
  const fromFacing = agent.facing;
  state.occupantsByTile[fromTileIndex].delete(index);
  state.occupantsByTile[toTileIndex].add(index);
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
