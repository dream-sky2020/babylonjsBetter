import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import type { DungeonLabLibraries } from './dungeonLibraries.protocol';

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const librariesType = defineLabMemoryType<DungeonLabLibraries | null>('DungeonLabLibraries',
  (value): value is DungeonLabLibraries | null => value === null || (record(value)
    && record(value.maps) && record(value.environments) && record(value.shadows)));

export const DUNGEON_LIBRARIES_MEMORY = defineLabSharedData({
  key: 'dungeon.libraries', label: '地牢预设库', type: librariesType, create: () => null,
  inspect: (value: DungeonLabLibraries | null) => value ? {
    loaded: true, mapPresetKeys: Object.keys(value.maps),
    environmentPresetCount: Object.keys(value.environments).length,
    shadowPresetCount: Object.keys(value.shadows).length,
  } : { loaded: false },
});
