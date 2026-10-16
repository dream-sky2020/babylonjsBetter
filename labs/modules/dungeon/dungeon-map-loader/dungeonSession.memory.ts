import { defineLabMemoryType, defineLabSharedData, type LabSharedData } from '../../../kit/shared-memory/LabMemory.ts';

/** Session identity/lifecycle only. Never add document, runtime or scene objects here. */
export type DungeonSessionInfo = {
  loadId: number | null;
  presetKey: string | null;
  mapId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  pendingLoadId: number | null;
  pendingPresetKey: string | null;
  error: string | null;
};

const initialInfo = (): DungeonSessionInfo => ({
  loadId: null, presetKey: null, mapId: null, status: 'idle',
  pendingLoadId: null, pendingPresetKey: null, error: null,
});
const nullableString = (value: unknown) => value === null || typeof value === 'string';
const nullableId = (value: unknown) => value === null || (Number.isSafeInteger(value) && (value as number) > 0);
const sessionType = defineLabMemoryType<DungeonSessionInfo>('DungeonSessionInfo', (value): value is DungeonSessionInfo => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const info = value as Record<string, unknown>;
  return nullableId(info.loadId) && nullableId(info.pendingLoadId) && nullableString(info.presetKey)
    && nullableString(info.mapId) && nullableString(info.pendingPresetKey) && nullableString(info.error)
    && ['idle', 'loading', 'ready', 'failed'].includes(info.status as string);
});

export const DUNGEON_SESSION_INFO_MEMORY = defineLabSharedData({
  key: 'dungeon.session', label: 'Session 元信息', type: sessionType,
  create: initialInfo, inspect: value => ({ ...value }),
});

/** Loader lifecycle adapter; stale completions cannot overwrite the newest attempt. */
export const createDungeonSessionInfoController = (memory: LabSharedData<DungeonSessionInfo>) => ({
  begin(loadId: number, presetKey: string) {
    memory.replace({ ...memory.current, status: 'loading', pendingLoadId: loadId, pendingPresetKey: presetKey, error: null });
  },
  commit(loadId: number, presetKey: string, mapId: string): boolean {
    if (memory.current.pendingLoadId !== loadId) return false;
    memory.replace({ loadId, presetKey, mapId, status: 'ready', pendingLoadId: null, pendingPresetKey: null, error: null });
    return true;
  },
  fail(loadId: number, error: unknown): boolean {
    if (memory.current.pendingLoadId !== loadId) return false;
    memory.replace({ ...memory.current, status: 'failed', pendingLoadId: null, pendingPresetKey: null,
      error: error instanceof Error ? error.message : String(error) });
    return true;
  },
  clear() { memory.replace(initialInfo()); },
});
