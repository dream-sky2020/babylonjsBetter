import type { DungeonAgentRuntimeState } from '@/core/dungeon-agent';

export type LoadedDungeonAgentRuntime = Readonly<{
  loadId: number;
  state: DungeonAgentRuntimeState;
}>;

export type DungeonAgentRuntimeReferences = {
  readonly current: LoadedDungeonAgentRuntime | null;
};

export type DungeonAgentRuntimeReferencesController = {
  readonly references: DungeonAgentRuntimeReferences;
  commit(next: LoadedDungeonAgentRuntime): void;
  clear(): void;
};

export const DUNGEON_AGENT_RUNTIME_SERVICE_KEY = 'dungeon:agent-runtime';

export const createDungeonAgentRuntimeReferences = (): DungeonAgentRuntimeReferencesController => {
  let current: LoadedDungeonAgentRuntime | null = null;
  const references: DungeonAgentRuntimeReferences = {
    get current() { return current; },
  };
  return {
    references,
    commit(next) { current = Object.freeze({ ...next }); },
    clear() { current = null; },
  };
};
