import { defineLabMemoryType, defineLabSharedData } from '../../../lab-kit/shared-memory/LabMemory.ts';
import type { DungeonMovementResolver } from '@/core/dungeon-movement/dungeonMovementResolver';

type Fields = Pick<DungeonMovementResolver, 'config' | 'activeRequests' | 'movementReservationsByTile' | 'movementReservationsByPoint'>;
export type DungeonMovementStateData = { loadId: number; presetKey: string } & Fields;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const reservations = (v: unknown) => Array.isArray(v) && v.every(ids => {
  if (!(ids instanceof Map)) return false;
  for (const [actor, request] of ids) if (typeof actor !== 'string' || typeof request !== 'string') return false;
  return true;
});
const type = defineLabMemoryType<DungeonMovementStateData | null>('DungeonMovementStateData',
  (v): v is DungeonMovementStateData | null => {
    if (v === null) return true;
    if (!record(v) || !Number.isSafeInteger(v.loadId) || (v.loadId as number) <= 0 || typeof v.presetKey !== 'string'
      || !record(v.config) || !Number.isFinite(v.config.progressWeight) || (v.config.progressWeight as number) < 0
      || !Number.isFinite(v.config.commitProgress) || (v.config.commitProgress as number) < 0 || (v.config.commitProgress as number) > 1
      || !Number.isFinite(v.config.playerBasePriority) || !(v.activeRequests instanceof Map)
      || !reservations(v.movementReservationsByTile) || !reservations(v.movementReservationsByPoint)) return false;
    for (const [id, request] of v.activeRequests) {
      if (typeof id !== 'string' || !record(request) || request.id !== id || typeof request.actorId !== 'string'
        || !Number.isInteger(request.fromTileIndex) || !Number.isInteger(request.toTileIndex)
        || !['forward-before-commit', 'forward-after-commit', 'rollback'].includes(request.state as string)
        || !Number.isFinite(request.elapsedSeconds) || !Number.isFinite(request.durationSeconds)) return false;
    }
    return true;
  });
export const DUNGEON_MOVEMENT_STATE_MEMORY = defineLabSharedData({
  key: 'dungeon.movement-state', label: '移动请求与临时预留', type, create: () => null,
  inspect: (v: DungeonMovementStateData | null) => v ? {
    loadId: v.loadId, presetKey: v.presetKey, config: { ...v.config }, activeRequestCount: v.activeRequests.size,
    activeRequests: v.activeRequests, movementReservationsByTile: v.movementReservationsByTile,
    movementReservationsByPoint: v.movementReservationsByPoint,
  } : { loaded: false },
});
export const createDungeonMovementStateData = (loadId: number, presetKey: string, source: Fields): DungeonMovementStateData => ({
  loadId, presetKey, get config() { return source.config; }, set config(value) { source.config = value; },
  activeRequests: source.activeRequests, movementReservationsByTile: source.movementReservationsByTile,
  movementReservationsByPoint: source.movementReservationsByPoint,
});
