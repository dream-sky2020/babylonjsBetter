import { defineLabMemoryType, defineLabSharedData } from '../../../lab-kit/shared-memory/LabMemory.ts';
import type { DungeonTraversalWorld } from '@/core/dungeon-traversal/dungeonTraversal';

type TraversalFields = Pick<DungeonTraversalWorld, 'actors' | 'occupantIdsByTile' | 'pathReservationsByTile'>;
export type DungeonTraversalStateData = { loadId: number; presetKey: string } & TraversalFields;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const stateType = defineLabMemoryType<DungeonTraversalStateData | null>('DungeonTraversalStateData',
  (v): v is DungeonTraversalStateData | null => {
    if (v === null) return true;
    if (!record(v) || !Number.isSafeInteger(v.loadId) || (v.loadId as number) <= 0 || typeof v.presetKey !== 'string'
      || !(v.actors instanceof Map) || !Array.isArray(v.occupantIdsByTile) || !Array.isArray(v.pathReservationsByTile)
      || v.occupantIdsByTile.length !== v.pathReservationsByTile.length) return false;
    for (const [id, actor] of v.actors) {
      if (typeof id !== 'string' || !record(actor) || actor.id !== id || !['player', 'agent', 'dynamic'].includes(actor.kind as string)
        || !Number.isInteger(actor.tileIndex) || typeof actor.enabled !== 'boolean' || typeof actor.blocksMovement !== 'boolean'
        || typeof actor.movementProfileId !== 'string'
        || (actor.spatialFootprint !== undefined && !['center', 'full-tile'].includes(actor.spatialFootprint as string))) return false;
    }
    for (const ids of v.occupantIdsByTile) {
      if (!(ids instanceof Set)) return false;
      for (const id of ids) if (typeof id !== 'string') return false;
    }
    for (const ids of v.pathReservationsByTile) {
      if (!(ids instanceof Map)) return false;
      for (const [id, distance] of ids) if (typeof id !== 'string' || !Number.isFinite(distance)) return false;
    }
    return true;
  });
export const DUNGEON_TRAVERSAL_STATE_MEMORY = defineLabSharedData({
  key: 'dungeon.traversal-state', label: '通行占位与寻路预约', type: stateType, create: () => null,
  // Live collections are paginated by the inspector; sampling never clones/scans all tiles.
  inspect: (v: DungeonTraversalStateData | null) => v ? {
    loadId: v.loadId, presetKey: v.presetKey, actorCount: v.actors.size, tileCount: v.occupantIdsByTile.length,
    actors: v.actors, occupantIdsByTile: v.occupantIdsByTile, pathReservationsByTile: v.pathReservationsByTile,
  } : { loaded: false },
});
export const createDungeonTraversalStateData = (loadId: number, presetKey: string, source: TraversalFields): DungeonTraversalStateData => ({
  loadId, presetKey, actors: source.actors, occupantIdsByTile: source.occupantIdsByTile, pathReservationsByTile: source.pathReservationsByTile,
});
