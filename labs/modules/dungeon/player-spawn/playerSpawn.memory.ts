import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import type { DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';

/** The spawn inspector needs these fields, not the full map, runtime or entity graph. */
export type DungeonPlayerSpawnData = {
  loadId: number;
  presetKey: string;
  spawnPointId: string;
  actorSpawnId: string;
  tilePosition: DungeonPlayerSpawnBinding['tilePosition'];
  worldPosition: DungeonPlayerSpawnBinding['worldPosition'];
  tileSize: DungeonPlayerSpawnBinding['tileWorldLayout']['size'];
};

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const vector = (value: unknown) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const spawnType = defineLabMemoryType<DungeonPlayerSpawnData | null>('DungeonPlayerSpawnData',
  (value): value is DungeonPlayerSpawnData | null => value === null || (record(value)
    && Number.isSafeInteger(value.loadId) && (value.loadId as number) > 0
    && typeof value.presetKey === 'string' && typeof value.spawnPointId === 'string' && typeof value.actorSpawnId === 'string'
    && record(value.tilePosition) && Number.isInteger(value.tilePosition.x) && Number.isInteger(value.tilePosition.y)
    && vector(value.worldPosition) && vector(value.tileSize)));

export const DUNGEON_PLAYER_SPAWN_MEMORY = defineLabSharedData({
  key: 'dungeon.player-spawn', label: '玩家出生点', type: spawnType, create: () => null,
  inspect: (value: DungeonPlayerSpawnData | null) => value ? {
    loadId: value.loadId, presetKey: value.presetKey, spawnPointId: value.spawnPointId, actorSpawnId: value.actorSpawnId,
    tilePosition: { ...value.tilePosition }, worldPosition: [...value.worldPosition], tileSize: [...value.tileSize],
  } : { loaded: false },
});

/** Shares the resolved position/size objects with Core; no secondary mutable state or sync loop. */
export const createDungeonPlayerSpawnData = (
  loadId: number, presetKey: string, spawn: DungeonPlayerSpawnBinding,
): DungeonPlayerSpawnData => ({
  loadId, presetKey, spawnPointId: spawn.spawnPointEntity.id, actorSpawnId: spawn.actorSpawnComponent.id,
  tilePosition: spawn.tilePosition, worldPosition: spawn.worldPosition, tileSize: spawn.tileWorldLayout.size,
});
