import { createServiceToken } from '../system-runtime/ServiceToken.ts';
import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import type { DungeonRuntimePlayerPosition } from '../dungeon-runtime/dungeonRuntime.types.ts';
import type { DungeonMapDirection } from '../map/dungeonMap.types.ts';
import { findDungeonDocumentExitAfterMovement, findDungeonDocumentExitForInteraction, findDungeonDocumentExitForMoveAttempt } from './dungeonTransition.document.ts';
import { createDungeonExitData, type DungeonExitData } from './dungeonTransitionData.ts';

export type DungeonTransitionControl = {
  findAfterMovement(loadId: number, from: DungeonRuntimePlayerPosition, to: DungeonRuntimePlayerPosition): DungeonExitData | null;
  findInteraction(loadId: number, position: DungeonRuntimePlayerPosition, facing: DungeonMapDirection): DungeonExitData | null;
  findMoveAttempt(loadId: number, position: DungeonRuntimePlayerPosition, direction: DungeonMapDirection): DungeonExitData | null;
};
export const DUNGEON_TRANSITION_CONTROL_SERVICE_KEY = createServiceToken<DungeonTransitionControl>('dungeon:transition-control');
export const createDungeonTransitionControl = (read: () => { loadId: number; map: DungeonRuntimeMap } | null): DungeonTransitionControl => ({
  findAfterMovement(loadId, from, to) {
    const current = read(); if (!current || current.loadId !== loadId) return null;
    const result = findDungeonDocumentExitAfterMovement(current.map, from, to); return result ? createDungeonExitData(result) : null;
  },
  findInteraction(loadId, position, facing) {
    const current = read(); if (!current || current.loadId !== loadId) return null;
    const result = findDungeonDocumentExitForInteraction(current.map, position, facing); return result ? createDungeonExitData(result) : null;
  },
  findMoveAttempt(loadId, position, direction) {
    const current = read(); if (!current || current.loadId !== loadId) return null;
    const result = findDungeonDocumentExitForMoveAttempt(current.map, position, direction); return result ? createDungeonExitData(result) : null;
  },
});
