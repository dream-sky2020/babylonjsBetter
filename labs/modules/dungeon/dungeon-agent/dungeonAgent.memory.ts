import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import type { DungeonRuntimeAgent, DungeonAgentMovement } from '../../../../core/dungeon-agent/dungeonAgent.types.ts';
import type { DungeonMovementDirection } from '../../../../core/dungeon-movement/index.ts';

export type DungeonAgentDescription = {
  entityId: string; name: string; factionId: string; initialTileIndex: number;
  blocksMovement: boolean; actionPeriod: number; initialPriority: number;
  movementProfileId: string; spatialFootprint: string;
};
export type DungeonAgentState = {
  entityId: string; tileIndex: number; facing: DungeonMovementDirection; enabled: boolean;
  priorityOverride: number | undefined; effectivePriority: number;
  movementKind: DungeonAgentMovement['kind'] | null; requestId: string | undefined;
  fromTileIndex: number | null; toTileIndex: number | null;
  fromFacing: DungeonMovementDirection | null; toFacing: DungeonMovementDirection | null;
  elapsedSeconds: number | null; durationSeconds: number | null;
  visualProgress: number | undefined; rotationProgress: number | undefined;
  /** Authoritative movement record in new Sessions; old adapters remain compatible. */
  movement?: DungeonAgentMovement | null;
};
type Data<T> = { loadId: number; presetKey: string; agents: Map<string, T> };
export type DungeonAgentsData = Data<DungeonAgentDescription>;
export type DungeonAgentStateData = Data<DungeonAgentState> & { activeAgentIds?: Set<string> };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
const direction = (value: unknown) => ['north', 'east', 'south', 'west', 'north-east', 'south-east', 'south-west', 'north-west'].includes(value as string);
const data = (value: unknown, check: (row: Record<string, unknown>) => boolean) => record(value)
  && Number.isSafeInteger(value.loadId) && (value.loadId as number) > 0 && typeof value.presetKey === 'string'
  && value.agents instanceof Map && [...value.agents].every(([id, row]) => typeof id === 'string' && record(row) && row.entityId === id && check(row));
const descriptions = defineLabMemoryType<DungeonAgentsData | null>('DungeonAgentsData',
  (value): value is DungeonAgentsData | null => value === null || data(value, row => typeof row.name === 'string'
    && typeof row.factionId === 'string' && Number.isInteger(row.initialTileIndex) && typeof row.blocksMovement === 'boolean'
    && Number.isFinite(row.actionPeriod) && Number.isFinite(row.initialPriority)));
const states = defineLabMemoryType<DungeonAgentStateData | null>('DungeonAgentStateData',
  (value): value is DungeonAgentStateData | null => value === null || (data(value, row => Number.isInteger(row.tileIndex)
    && direction(row.facing) && typeof row.enabled === 'boolean' && Number.isFinite(row.effectivePriority)
    && (row.priorityOverride === undefined || Number.isFinite(row.priorityOverride))
    && (row.movementKind === null || (['move', 'turn', 'rollback'].includes(row.movementKind as string)
      && Number.isInteger(row.fromTileIndex) && Number.isInteger(row.toTileIndex) && direction(row.fromFacing) && direction(row.toFacing)
      && Number.isFinite(row.elapsedSeconds) && Number.isFinite(row.durationSeconds))))
    && record(value) && (!('activeAgentIds' in value) || (value.activeAgentIds instanceof Set
      && [...value.activeAgentIds].every(id => typeof id === 'string')))));
export const DUNGEON_AGENTS_MEMORY = defineLabSharedData({
  key: 'dungeon.agents', label: 'Agent 描述', type: descriptions, create: () => null,
  inspect: (value: DungeonAgentsData | null) => value ? { loadId: value.loadId, presetKey: value.presetKey, agentCount: value.agents.size, agents: value.agents } : { loaded: false },
});
export const DUNGEON_AGENT_STATE_MEMORY = defineLabSharedData({
  key: 'dungeon.agent-state', label: 'Agent 基础运行状态', type: states, create: () => null,
  inspect: (value: DungeonAgentStateData | null) => value ? { loadId: value.loadId, presetKey: value.presetKey, agentCount: value.agents.size,
    agents: value.agents, activeAgentIds: value.activeAgentIds } : { loaded: false },
});

/** @deprecated Legacy view adapter. Composed sessions allocate authority before Core construction.
 * All fields read the original Core authority;
 * replacement of movement objects is visible without copying or notifications. */
export const createDungeonAgentMemoryData = (loadId: number, presetKey: string, source: readonly DungeonRuntimeAgent[]) => {
  const agents = new Map<string, DungeonAgentDescription>(), runtime = new Map<string, DungeonAgentState>();
  for (const agent of source) {
    const entityId = agent.binding.entity.id;
    agents.set(entityId, {
      entityId,
      get name() { return agent.binding.entity.name ?? entityId; },
      get factionId() { return agent.binding.faction?.factionId ?? 'neutral'; },
      get initialTileIndex() { return agent.binding.initialTileIndex; },
      get blocksMovement() { return agent.binding.gridAgent.blocksMovement; },
      get actionPeriod() { return agent.binding.gridAgent.actionPeriod; },
      get initialPriority() { return agent.binding.gridAgent.priority; },
      get movementProfileId() { return agent.binding.gridAgent.movementProfileId; },
      get spatialFootprint() { return agent.binding.gridAgent.spatialFootprint ?? 'center'; },
    });
    runtime.set(entityId, {
      entityId,
      get tileIndex() { return agent.tileIndex; }, set tileIndex(value) { agent.tileIndex = value; },
      get movement() { return agent.movement; }, set movement(value) { agent.movement = value; },
      get facing() { return agent.facing; }, set facing(value) { agent.facing = value; },
      get enabled() { return agent.enabled; }, set enabled(value) { agent.enabled = value; },
      get priorityOverride() { return agent.priorityOverride; }, set priorityOverride(value) { agent.priorityOverride = value; },
      get effectivePriority() { return agent.priorityOverride ?? agent.binding.gridAgent.priority; },
      get movementKind() { return agent.movement?.kind ?? null; },
      get requestId() { return agent.movement?.requestId; },
      get fromTileIndex() { return agent.movement?.fromTileIndex ?? null; },
      get toTileIndex() { return agent.movement?.toTileIndex ?? null; },
      get fromFacing() { return agent.movement?.fromFacing ?? null; },
      get toFacing() { return agent.movement?.toFacing ?? null; },
      get elapsedSeconds() { return agent.movement?.elapsedSeconds ?? null; },
      get durationSeconds() { return agent.movement?.durationSeconds ?? null; },
      get visualProgress() { return agent.movement?.visualProgress; },
      get rotationProgress() { return agent.movement?.rotationProgress; },
    });
  }
  return { descriptions: { loadId, presetKey, agents } satisfies DungeonAgentsData,
    state: { loadId, presetKey, agents: runtime } satisfies DungeonAgentStateData };
};
