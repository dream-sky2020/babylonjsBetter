import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import type { DungeonRuntime } from '@/core/dungeon-runtime/dungeonRuntime.types';
import type { DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';
import { createDungeonObstacleStatesFromBindings } from '../../../../core/dungeon-obstacle/dungeonObstacle.ts';

type Identity = { loadId: number; presetKey: string };
type PlayerFields = Pick<DungeonRuntime, 'playerPosition' | 'playerFacing' | 'playerWorldPosition' | 'playerWorldRotationY' | 'playerMovement'>;
export type DungeonPlayerStateData = Identity & PlayerFields;
export type DungeonObstacleStateData = Identity & { states: DungeonRuntime['obstacleStates'] };

/** Authoritative candidate data, created before Core preparation and published on commit. */
export const allocateDungeonPlayerStateData = (loadId: number, presetKey: string,
  spawn: DungeonPlayerSpawnBinding, playerFacing: DungeonRuntime['playerFacing'] = 'south'): DungeonPlayerStateData => ({
  loadId, presetKey, playerPosition: { tileX: spawn.tilePosition.x, tileY: spawn.tilePosition.y }, playerFacing,
  playerWorldPosition: [...spawn.worldPosition], playerMovement: null,
  playerWorldRotationY: playerFacing === 'north' ? Math.PI : playerFacing === 'east' ? Math.PI / 2
    : playerFacing === 'west' ? -Math.PI / 2 : 0,
});
export const allocateDungeonObstacleStateData = (loadId: number, presetKey: string,
  bindings: DungeonRuntime['obstacles']): DungeonObstacleStateData => ({
  loadId, presetKey, states: createDungeonObstacleStatesFromBindings(bindings),
});

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = (value: Record<string, unknown>) => Number.isSafeInteger(value.loadId) && (value.loadId as number) > 0 && typeof value.presetKey === 'string';
const position = (value: unknown) => record(value) && Number.isInteger(value.tileX) && Number.isInteger(value.tileY);
const vector = (value: unknown) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const direction = (value: unknown) => ['north', 'east', 'south', 'west'].includes(value as string);
const movement = (value: unknown) => value === null || (record(value)
  && ['move', 'turn', 'blocked', 'rollback'].includes(value.kind as string)
  && ['north', 'east', 'south', 'west', 'north-east', 'south-east', 'south-west', 'north-west'].includes(value.direction as string)
  && direction(value.targetFacing) && position(value.from) && position(value.to)
  && vector(value.fromWorldPosition) && vector(value.toWorldPosition)
  && [value.fromWorldRotationY, value.toWorldRotationY, value.elapsedSeconds, value.movementDurationSeconds, value.turnDurationSeconds].every(Number.isFinite));
const playerType = defineLabMemoryType<DungeonPlayerStateData | null>('DungeonPlayerStateData',
  (value): value is DungeonPlayerStateData | null => value === null || (record(value) && identity(value)
    && position(value.playerPosition) && direction(value.playerFacing) && vector(value.playerWorldPosition)
    && Number.isFinite(value.playerWorldRotationY) && movement(value.playerMovement)));
const obstacleType = defineLabMemoryType<DungeonObstacleStateData | null>('DungeonObstacleStateData',
  (value): value is DungeonObstacleStateData | null => value === null || (record(value) && identity(value)
    && value.states instanceof Map && [...value.states].every(([id, active]) => typeof id === 'string' && typeof active === 'boolean')));

export const DUNGEON_PLAYER_STATE_MEMORY = defineLabSharedData({
  key: 'dungeon.player-state', label: '玩家运行状态', type: playerType, create: () => null,
  inspect: (value: DungeonPlayerStateData | null) => value ? {
    loadId: value.loadId, presetKey: value.presetKey, playerPosition: { ...value.playerPosition },
    playerFacing: value.playerFacing, playerWorldPosition: [...value.playerWorldPosition], playerWorldRotationY: value.playerWorldRotationY,
    playerMovement: value.playerMovement ? {
      kind: value.playerMovement.kind, requestId: value.playerMovement.requestId, direction: value.playerMovement.direction,
      targetFacing: value.playerMovement.targetFacing, from: { ...value.playerMovement.from }, to: { ...value.playerMovement.to },
      fromWorldPosition: [...value.playerMovement.fromWorldPosition], toWorldPosition: [...value.playerMovement.toWorldPosition],
      fromWorldRotationY: value.playerMovement.fromWorldRotationY, toWorldRotationY: value.playerMovement.toWorldRotationY,
      elapsedSeconds: value.playerMovement.elapsedSeconds, movementDurationSeconds: value.playerMovement.movementDurationSeconds,
      turnDurationSeconds: value.playerMovement.turnDurationSeconds,
      positionCompleted: value.playerMovement.positionCompleted,
      blockedObstacleIds: value.playerMovement.blockedObstacleIds?.slice(0, 20),
      blockedObstacleCount: value.playerMovement.blockedObstacleIds?.length ?? 0,
    } : null,
  } : { loaded: false },
});

export const DUNGEON_OBSTACLE_STATE_MEMORY = defineLabSharedData({
  key: 'dungeon.obstacle-state', label: '障碍启用状态', type: obstacleType, create: () => null,
  // The inspector paginates this live Map; do not copy all obstacles on each debug sample.
  inspect: (value: DungeonObstacleStateData | null) => value ? {
    loadId: value.loadId, presetKey: value.presetKey, obstacleCount: value.states.size, states: value.states,
  } : { loaded: false },
});

/** @deprecated Legacy live field bridge; composed sessions use allocateDungeonPlayerStateData.
 * Setters forward writes to the same authority; they are not access controls.
 */
export const createDungeonPlayerStateData = (loadId: number, presetKey: string, source: PlayerFields): DungeonPlayerStateData => ({
  loadId, presetKey,
  get playerPosition() { return source.playerPosition; }, set playerPosition(value) { source.playerPosition = value; },
  get playerFacing() { return source.playerFacing; }, set playerFacing(value) { source.playerFacing = value; },
  get playerWorldPosition() { return source.playerWorldPosition; }, set playerWorldPosition(value) { source.playerWorldPosition = value; },
  get playerWorldRotationY() { return source.playerWorldRotationY; }, set playerWorldRotationY(value) { source.playerWorldRotationY = value; },
  get playerMovement() { return source.playerMovement; }, set playerMovement(value) { source.playerMovement = value; },
});

/** @deprecated Legacy view adapter; composed sessions use allocateDungeonObstacleStateData. */
export const createDungeonObstacleStateData = (loadId: number, presetKey: string, source: Pick<DungeonRuntime, 'obstacleStates'>): DungeonObstacleStateData => ({
  loadId, presetKey,
  get states() { return source.obstacleStates; }, set states(value) { source.obstacleStates = value; },
});
