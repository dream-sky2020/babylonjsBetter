import { defineLabMemoryType, defineLabSharedData } from '../../../lab-kit/shared-memory/LabMemory.ts';
import type { DungeonRuntimeAgent, DungeonAgentNavigationPlan } from '../../../../core/dungeon-agent/dungeonAgent.types.ts';

export type DungeonAgentNavigation = {
  entityId: string; hasPlan: boolean;
  targetTileIndex: number | null; tileIndices: readonly number[]; directions: DungeonAgentNavigationPlan['directions'];
  nextStepIndex: number | null; totalCost: number | null; visitedCount: number | null; planSequence: number | null;
  repairCount: number | undefined;
  blockedReason: string | null; blockedFromTileIndex: number | null; blockedToTileIndex: number | undefined;
  retryRemainingSeconds: number | null; consecutiveFailures: number | null;
};
export type DungeonAgentNavigationData = { loadId: number; presetKey: string; agents: Map<string, DungeonAgentNavigation> };
const EMPTY: readonly never[] = Object.freeze([]);
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
const type = defineLabMemoryType<DungeonAgentNavigationData | null>('DungeonAgentNavigationData',
  (v): v is DungeonAgentNavigationData | null => v === null || (record(v) && Number.isSafeInteger(v.loadId)
    && (v.loadId as number) > 0 && typeof v.presetKey === 'string' && v.agents instanceof Map
    && [...v.agents].every(([id, row]) => typeof id === 'string' && record(row) && row.entityId === id
      && typeof row.hasPlan === 'boolean' && Array.isArray(row.tileIndices) && Array.isArray(row.directions)
      && (!row.hasPlan || (Number.isInteger(row.targetTileIndex) && Number.isInteger(row.nextStepIndex)
        && Number.isFinite(row.totalCost) && Number.isInteger(row.visitedCount) && Number.isInteger(row.planSequence))))));
export const DUNGEON_AGENT_NAVIGATION_MEMORY = defineLabSharedData({
  key: 'dungeon.agent-navigation', label: 'Agent 寻路计划', type, create: () => null,
  inspect: (v: DungeonAgentNavigationData | null) => v ? {
    loadId: v.loadId, presetKey: v.presetKey, agentCount: v.agents.size, agents: v.agents,
  } : { loaded: false },
});
/** Stable view records; plans and blocked records may be replaced by Core. */
export const createDungeonAgentNavigationData = (loadId: number, presetKey: string, source: readonly DungeonRuntimeAgent[]): DungeonAgentNavigationData => ({
  loadId, presetKey, agents: new Map(source.map(agent => [agent.binding.entity.id, {
    entityId: agent.binding.entity.id,
    get hasPlan() { return !!agent.navigationPlan; },
    get targetTileIndex() { return agent.navigationPlan?.targetTileIndex ?? null; },
    get tileIndices() { return agent.navigationPlan?.tileIndices ?? EMPTY; },
    get directions() { return agent.navigationPlan?.directions ?? EMPTY; },
    get nextStepIndex() { return agent.navigationPlan?.nextStepIndex ?? null; },
    get totalCost() { return agent.navigationPlan?.totalCost ?? null; },
    get visitedCount() { return agent.navigationPlan?.visitedCount ?? null; },
    get planSequence() { return agent.navigationPlan?.planSequence ?? null; },
    get repairCount() { return agent.navigationPlan?.repairCount; },
    get blockedReason() { return agent.navigationPlan?.blocked?.reason ?? null; },
    get blockedFromTileIndex() { return agent.navigationPlan?.blocked?.fromTileIndex ?? null; },
    get blockedToTileIndex() { return agent.navigationPlan?.blocked?.toTileIndex; },
    get retryRemainingSeconds() { return agent.navigationPlan?.blocked?.retryRemainingSeconds ?? null; },
    get consecutiveFailures() { return agent.navigationPlan?.blocked?.consecutiveFailures ?? null; },
  }])),
});
