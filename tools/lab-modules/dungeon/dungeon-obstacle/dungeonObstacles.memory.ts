import { defineLabMemoryType, defineLabSharedData } from '../../../lab-kit/shared-memory/LabMemory.ts';
import type { DungeonObstacleBinding, DungeonObstaclePlacement } from '@/core/dungeon-obstacle/dungeonObstacle';
import { resolveDungeonSpatialFootprint } from '../../../../core/dungeon-space/dungeonSpatialFootprint.ts';

export type DungeonObstacleData = {
  entityId: string;
  name: string;
  placement: DungeonObstaclePlacement;
  spatialFootprint: 'center' | 'full-tile' | 'edge-boundary';
};
export type DungeonObstaclesData = { loadId: number; presetKey: string; items: readonly DungeonObstacleData[] };
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const direction = (v: unknown) => ['north', 'east', 'south', 'west'].includes(v as string);
const placement = (v: unknown) => record(v) && (
  ((v.kind === 'tile' || v.kind === 'tile-edge') && Number.isInteger(v.tileX) && Number.isInteger(v.tileY)
    && (v.kind === 'tile' || direction(v.direction)))
  || (v.kind === 'shared-edge' && typeof v.sharedEdgeId === 'string' && record(v.side)
    && Number.isInteger(v.side.x) && Number.isInteger(v.side.y) && direction(v.side.direction)));
const type = defineLabMemoryType<DungeonObstaclesData | null>('DungeonObstaclesData',
  (v): v is DungeonObstaclesData | null => v === null || (record(v) && Number.isSafeInteger(v.loadId) && (v.loadId as number) > 0
    && typeof v.presetKey === 'string' && Array.isArray(v.items) && v.items.every(item => record(item)
      && typeof item.entityId === 'string' && typeof item.name === 'string' && placement(item.placement)
      && ['center', 'full-tile', 'edge-boundary'].includes(item.spatialFootprint as string))));
export const DUNGEON_OBSTACLES_MEMORY = defineLabSharedData({
  key: 'dungeon.obstacles', label: '障碍标识与放置', type, create: () => null,
  // Paginate the shallow records directly; no full list clone on debug sampling.
  inspect: (v: DungeonObstaclesData | null) => v ? { loadId: v.loadId, presetKey: v.presetKey, obstacleCount: v.items.length, items: v.items } : { loaded: false },
});
/** One small descriptor per binding; placement stays shared, scalar fields read the Core binding. */
export const createDungeonObstaclesData = (loadId: number, presetKey: string, bindings: readonly DungeonObstacleBinding[]): DungeonObstaclesData => ({
  loadId, presetKey, items: bindings.map(binding => ({
    get entityId() { return binding.entity.id; }, get name() { return binding.entity.name ?? binding.entity.id; },
    get placement() { return binding.placement; }, set placement(value) { binding.placement = value; },
    get spatialFootprint() { return binding.placement.kind === 'tile'
      ? resolveDungeonSpatialFootprint(binding.component.spatialFootprint, 'full-tile') : 'edge-boundary'; },
  })),
});
