import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import type { DungeonAgentSystem } from '../../../../core/dungeon-agent/dungeonAgentSystem';
import type { DungeonAgentRuntimeState } from '../../../../core/dungeon-agent/dungeonAgent.types.ts';
import type { DungeonAgentControllerConfig } from '../../../../core/dungeon-agent/dungeonAgent.types.ts';

type Identity = { loadId: number; presetKey: string };
export type DungeonAgentSettingsData = Identity & DungeonAgentSystem['settings'];
export type DungeonAgentControllerState = {
  entityId: string; actionClock: number; controllerId: string;
  parameters: Readonly<Record<string, unknown>>; source: 'map' | 'runtime-override'; controllerState: unknown;
  controllerOverride?: DungeonAgentControllerConfig;
};
export type DungeonAgentControllerData = Identity & { turnNumber: number; decisionElapsed?: number; agents: Map<string, DungeonAgentControllerState> };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = (value: unknown): value is Record<string, unknown> => record(value)
  && Number.isSafeInteger(value.loadId) && (value.loadId as number) > 0 && typeof value.presetKey === 'string';
const settingsType = defineLabMemoryType<DungeonAgentSettingsData | null>('DungeonAgentSettingsData',
  (value): value is DungeonAgentSettingsData | null => value === null || (identity(value)
    && typeof value.controllersEnabled === 'boolean' && Number.isFinite(value.decisionIntervalSeconds)
    && (value.decisionIntervalSeconds as number) > 0 && Number.isInteger(value.maxPathSearchesPerDecision)
    && (value.maxPathSearchesPerDecision as number) >= 0));
const controllerType = defineLabMemoryType<DungeonAgentControllerData | null>('DungeonAgentControllerData',
  (value): value is DungeonAgentControllerData | null => value === null || (identity(value) && Number.isInteger(value.turnNumber)
    && (!('decisionElapsed' in value) || (Number.isFinite(value.decisionElapsed) && (value.decisionElapsed as number) >= 0))
    && value.agents instanceof Map && [...value.agents].every(([id, row]) => typeof id === 'string' && record(row)
      && row.entityId === id && Number.isFinite(row.actionClock) && typeof row.controllerId === 'string'
      && record(row.parameters) && ['map', 'runtime-override'].includes(row.source as string))));
export const DUNGEON_AGENT_SETTINGS_MEMORY = defineLabSharedData({
  key: 'dungeon.agent-settings', label: 'Agent 决策设置', type: settingsType, create: () => null,
  inspect: (value: DungeonAgentSettingsData | null) => value ?? { loaded: false },
});
export const DUNGEON_AGENT_CONTROLLER_MEMORY = defineLabSharedData({
  key: 'dungeon.agent-controller-state', label: 'Agent Controller 状态', type: controllerType, create: () => null,
  inspect: (value: DungeonAgentControllerData | null) => value ? {
    loadId: value.loadId, presetKey: value.presetKey, turnNumber: value.turnNumber, agentCount: value.agents.size, agents: value.agents,
    decisionElapsed: value.decisionElapsed,
  } : { loaded: false },
});
const EMPTY_PARAMETERS = Object.freeze({});
/** @deprecated Legacy view adapter; composed sessions use allocateDungeonAgentStorage. */
export const createDungeonAgentControllerData = (loadId: number, presetKey: string, state: DungeonAgentRuntimeState,
  settings: DungeonAgentSystem['settings']) => {
  const agents = new Map<string, DungeonAgentControllerState>();
  for (const agent of state.agents) {
    const entityId = agent.binding.entity.id;
    agents.set(entityId, {
      entityId,
      get actionClock() { return agent.actionClock; }, set actionClock(value) { agent.actionClock = value; },
      get controllerId() { return agent.controllerOverride?.controllerId ?? agent.binding.controller.controllerId; },
      get parameters() { return agent.controllerOverride?.parameters ?? agent.binding.controller.parameters ?? EMPTY_PARAMETERS; },
      get source() { return agent.controllerOverride ? 'runtime-override' : 'map'; },
      get controllerState() { return agent.controllerState; }, set controllerState(value) { agent.controllerState = value; },
    });
  }
  return {
    settings: {
      loadId, presetKey,
      get controllersEnabled() { return settings.controllersEnabled; }, set controllersEnabled(value) { settings.controllersEnabled = value; },
      get decisionIntervalSeconds() { return settings.decisionIntervalSeconds; }, set decisionIntervalSeconds(value) { settings.decisionIntervalSeconds = value; },
      get maxPathSearchesPerDecision() { return settings.maxPathSearchesPerDecision; }, set maxPathSearchesPerDecision(value) { settings.maxPathSearchesPerDecision = value; },
    } satisfies DungeonAgentSettingsData,
    controllers: { loadId, presetKey, get turnNumber() { return state.turnNumber; }, agents } satisfies DungeonAgentControllerData,
  };
};
