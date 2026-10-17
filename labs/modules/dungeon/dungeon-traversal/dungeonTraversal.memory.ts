import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import type { DungeonTraversalWorld } from '@/core/dungeon-traversal/dungeonTraversal';
import type { DungeonTraversalStorage } from '@/core/dungeon-traversal/dungeonTraversal';

type TraversalFields = Pick<DungeonTraversalWorld, 'actors' | 'occupantIdsByTile' | 'pathReservationsByTile'>;
export type DungeonTraversalStateData = { loadId: number; presetKey: string } & TraversalFields
  & Partial<Pick<DungeonTraversalStorage, 'pathReservationTileIndicesByActor'>>;
export type DungeonTraversalOwnedData = DungeonTraversalStateData & DungeonTraversalStorage;
export const allocateDungeonTraversalStateData = (loadId: number, presetKey: string, tileCount: number): DungeonTraversalOwnedData => ({
  loadId, presetKey, bodies: new Map(), colliders: new Map(), bodyIdByEntity: new Map(), bodyIdsBySide: new Map(), bodyIdsByCell: new Map(), cellsByBody: new Map(), actors: new Map(), pathReservationTileIndicesByActor: new Map(),
  occupantIdsByTile: Array.from({ length: tileCount }, () => new Set()),
  pathReservationsByTile: Array.from({ length: tileCount }, () => new Map()),
});
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const stateType = defineLabMemoryType<DungeonTraversalStateData | null>('DungeonTraversalStateData',
  (v): v is DungeonTraversalStateData | null => {
    if (v === null) return true;
    if(record(v)&&'bodies' in v){
      if(!(v.bodies instanceof Map)||!(v.colliders instanceof Map))return false;
      for(const [id,body] of v.bodies)if(!record(body)||body.bodyId!==id||typeof body.entityId!=='string'
        ||!record(body.pose)||!Number.isFinite(body.pose.x)||!Number.isFinite(body.pose.y))return false;
      for(const [id,collider] of v.colliders)if(!record(collider)||collider.id!==id||!v.bodies.has(collider.bodyId)
        ||!['disc','box','boundary','point'].includes(collider.shape as string))return false;
    }
    if (!record(v) || !Number.isSafeInteger(v.loadId) || (v.loadId as number) <= 0 || typeof v.presetKey !== 'string'
      || !(v.actors instanceof Map) || !Array.isArray(v.occupantIdsByTile) || !Array.isArray(v.pathReservationsByTile)
      || v.occupantIdsByTile.length !== v.pathReservationsByTile.length) return false;
    if ('pathReservationTileIndicesByActor' in v) {
      if (!(v.pathReservationTileIndicesByActor instanceof Map)) return false;
      for (const [id, indices] of v.pathReservationTileIndicesByActor) {
        if (typeof id !== 'string' || !(indices instanceof Set) || [...indices].some(index => !Number.isInteger(index))) return false;
      }
    }
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
  key: 'dungeon.spatial-world', label: '统一空间世界与导航索引', type: stateType, create: () => null,
  // Live collections are paginated by the inspector; sampling never clones/scans all tiles.
  inspect: (v: DungeonTraversalStateData | null) => v ? {
    loadId: v.loadId, presetKey: v.presetKey, actorCount: v.actors.size, tileCount: v.occupantIdsByTile.length,
    bodies: 'bodies' in v ? v.bodies : undefined, colliders: 'colliders' in v ? v.colliders : undefined,
    actors: v.actors, occupantIdsByTile: v.occupantIdsByTile, pathReservationsByTile: v.pathReservationsByTile,
    pathReservationTileIndicesByActor: 'pathReservationTileIndicesByActor' in v ? v.pathReservationTileIndicesByActor : undefined,
  } : { loaded: false },
});
/** @deprecated Legacy view adapter. Composed sessions allocate data before constructing Core. */
export const createDungeonTraversalStateData = (loadId: number, presetKey: string, source: TraversalFields): DungeonTraversalStateData => ({
  loadId, presetKey, actors: source.actors, occupantIdsByTile: source.occupantIdsByTile, pathReservationsByTile: source.pathReservationsByTile,
});
