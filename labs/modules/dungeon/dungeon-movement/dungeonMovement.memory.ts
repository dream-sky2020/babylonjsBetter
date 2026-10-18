import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import type { DungeonMovementResolver } from '@/core/dungeon-movement/dungeonMovementResolver';
import type { DungeonMovementStorage } from '@/core/dungeon-movement/dungeonMovement.types';

type Fields = Pick<DungeonMovementResolver, 'config' | 'activeRequests' | 'movementReservationsByTile' | 'movementReservationsByPoint'>;
export type DungeonMovementStateData = { loadId: number; presetKey: string } & Fields
  & Partial<Pick<DungeonMovementStorage, 'activeRequestIdByActor' | 'nextRequestSequence' | 'groups'>>;
export type DungeonMovementOwnedData = DungeonMovementStateData & DungeonMovementStorage;
export const allocateDungeonMovementStateData = (loadId: number, presetKey: string,
  tileCount: number, pointCount: number): DungeonMovementOwnedData => ({
  loadId, presetKey, config: { progressWeight: 1, commitProgress: 0.5, playerBasePriority: 1000 },
  activeRequests: new Map(), activeRequestIdByActor: new Map(), nextRequestSequence: 1,
  samples: new Map(), groups: new Map(), tracks: new Map(), simulationSeconds: 0,
  movementReservationsByTile: Array.from({ length: tileCount }, () => new Map()),
  movementReservationsByPoint: Array.from({ length: pointCount }, () => new Map()),
});
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const reservations = (v: unknown) => Array.isArray(v) && v.every(ids => {
  if (!(ids instanceof Map)) return false;
  for (const [actor, request] of ids) if (typeof actor !== 'string' || typeof request !== 'string') return false;
  return true;
});
const type = defineLabMemoryType<DungeonMovementStateData | null>('DungeonMovementStateData',
  (v): v is DungeonMovementStateData | null => {
    if (v === null) return true;
    if(record(v)&&'groups' in v&&(!(v.groups instanceof Map)||!(v.tracks instanceof Map)||!(v.samples instanceof Map)
      ||!Number.isFinite(v.simulationSeconds)||(v.simulationSeconds as number)<0))return false;
    if (!record(v) || !Number.isSafeInteger(v.loadId) || (v.loadId as number) <= 0 || typeof v.presetKey !== 'string'
      || !record(v.config) || !Number.isFinite(v.config.progressWeight) || (v.config.progressWeight as number) < 0
      || !Number.isFinite(v.config.commitProgress) || (v.config.commitProgress as number) < 0 || (v.config.commitProgress as number) > 1
      || !Number.isFinite(v.config.playerBasePriority) || !(v.activeRequests instanceof Map)
      || !reservations(v.movementReservationsByTile) || !reservations(v.movementReservationsByPoint)) return false;
    if ('activeRequestIdByActor' in v && (!(v.activeRequestIdByActor instanceof Map)
      || [...v.activeRequestIdByActor].some(([actor, request]) => typeof actor !== 'string' || typeof request !== 'string'))) return false;
    if ('nextRequestSequence' in v && (!Number.isSafeInteger(v.nextRequestSequence) || (v.nextRequestSequence as number) < 1)) return false;
    for (const [id, request] of v.activeRequests) {
      if (typeof id !== 'string' || !record(request) || request.id !== id || typeof request.actorId !== 'string'
        || !Number.isInteger(request.fromTileIndex) || !Number.isInteger(request.toTileIndex)
        || !['forward-before-commit', 'forward-after-commit', 'rollback'].includes(request.state as string)
        || !Number.isFinite(request.elapsedSeconds) || !Number.isFinite(request.durationSeconds)) return false;
    }
    return true;
  });
export const DUNGEON_MOVEMENT_STATE_MEMORY = defineLabSharedData({
  key: 'dungeon.spatial-actions', label: '统一动作、时间轴与预留', type, create: () => null,
  inspect: (v: DungeonMovementStateData | null) => v ? {
    loadId: v.loadId, presetKey: v.presetKey, config: { ...v.config }, activeRequestCount: v.activeRequests.size,
    groups: 'groups' in v ? v.groups : undefined, tracks: 'tracks' in v ? v.tracks : undefined,
    simulationSeconds: 'simulationSeconds' in v ? v.simulationSeconds : undefined, activeRequests: v.activeRequests, movementReservationsByTile: v.movementReservationsByTile,
    movementReservationsByPoint: v.movementReservationsByPoint,
    activeRequestIdByActor: 'activeRequestIdByActor' in v ? v.activeRequestIdByActor : undefined,
    nextRequestSequence: 'nextRequestSequence' in v ? v.nextRequestSequence : undefined,
  } : { loaded: false },
});
/** @deprecated Legacy view adapter. Composed sessions allocate data before constructing Core. */
export const createDungeonMovementStateData = (loadId: number, presetKey: string, source: Fields): DungeonMovementStateData => ({
  loadId, presetKey, get config() { return source.config; }, set config(value) { source.config = value; },
  activeRequests: source.activeRequests, movementReservationsByTile: source.movementReservationsByTile,
  movementReservationsByPoint: source.movementReservationsByPoint,
});
