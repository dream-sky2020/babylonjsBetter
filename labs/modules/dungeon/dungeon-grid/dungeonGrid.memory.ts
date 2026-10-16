import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import type { DungeonRuntimeMap } from '@/core/dungeon-runtime/dungeonRuntimeMap';
import type { DungeonMapTileLayoutSettings } from '@/core/scene/dungeonMapSceneLayout';

/** Grid identity and layout only; no runtime, entities or scene-resource graph. */
export type DungeonGridData = DungeonMapTileLayoutSettings & {
  loadId: number;
  presetKey: string;
  mapId: string;
  width: number;
  height: number;
  tileIds: readonly string[];
};

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const tuple = (value: unknown, length: number) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
const positiveInteger = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0;
const gridType = defineLabMemoryType<DungeonGridData | null>('DungeonGridData',
  (value): value is DungeonGridData | null => value === null || (record(value)
    && positiveInteger(value.loadId) && typeof value.presetKey === 'string' && typeof value.mapId === 'string'
    && positiveInteger(value.width) && positiveInteger(value.height)
    && Array.isArray(value.tileIds) && value.tileIds.length === (value.width as number) * (value.height as number)
    && value.tileIds.every(id => typeof id === 'string')
    && (value.mapAnchorMode === 'map-center' || value.mapAnchorMode === 'first-tile')
    && tuple(value.mapOffset, 3) && tuple(value.tileSpacing, 2) && tuple(value.tileSize, 3)));

export const DUNGEON_GRID_MEMORY = defineLabSharedData({
  key: 'dungeon.grid', label: '格子与世界布局', type: gridType, create: () => null,
  inspect: (value: DungeonGridData | null) => value ? {
    loadId: value.loadId, presetKey: value.presetKey, mapId: value.mapId, width: value.width, height: value.height,
    mapAnchorMode: value.mapAnchorMode, mapOffset: [...value.mapOffset], tileSpacing: [...value.tileSpacing], tileSize: [...value.tileSize],
    tileCount: value.tileIds.length, tileIdPreview: value.tileIds.slice(0, 20), tileIdsTruncated: value.tileIds.length > 20,
  } : { loaded: false },
});

/** Session-static identity/dimensions; arrays are the original Core topology and spatial settings. */
export const createDungeonGridData = (
  loadId: number, presetKey: string,
  map: Pick<DungeonRuntimeMap, 'id' | 'width' | 'height'> & { topology: Pick<DungeonRuntimeMap['topology'], 'tileIds'> },
  settings: DungeonMapTileLayoutSettings,
): DungeonGridData => ({
  loadId, presetKey, mapId: map.id, width: map.width, height: map.height, tileIds: map.topology.tileIds,
  mapAnchorMode: settings.mapAnchorMode, mapOffset: settings.mapOffset, tileSpacing: settings.tileSpacing, tileSize: settings.tileSize,
});
