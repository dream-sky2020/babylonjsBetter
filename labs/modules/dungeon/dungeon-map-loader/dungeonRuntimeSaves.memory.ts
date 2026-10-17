import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import type { DungeonRuntimeSaveState } from '@/core/dungeon-runtime-save';

type DungeonRuntimeSaves = Record<string, DungeonRuntimeSaveState>;
const savesType = defineLabMemoryType<DungeonRuntimeSaves>('DungeonRuntimeSaves',
  (value): value is DungeonRuntimeSaves => value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([key, state]) => state !== null && typeof state === 'object'
      && (state.version === 1 || state.version === 2) && state.dungeonPresetKey === key));

export const DUNGEON_RUNTIME_SAVES_MEMORY = defineLabSharedData({
  key: 'dungeon.runtime-saves', label: '地牢运行态存档', type: savesType, create: () => ({}),
  inspect: (value: DungeonRuntimeSaves) => structuredClone(value),
});
