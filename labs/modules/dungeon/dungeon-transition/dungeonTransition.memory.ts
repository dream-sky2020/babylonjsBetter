import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import { scanDungeonDocumentEntrances, scanDungeonDocumentExits } from '../../../../core/dungeon-transition/dungeonTransition.document.ts';
import { createDungeonEntranceData, createDungeonExitData, type DungeonEntranceData, type DungeonExitData } from '../../../../core/dungeon-transition/dungeonTransitionData.ts';
import type { DungeonMapDocumentV2 } from '@/core/map-document/dungeonMapDocument.types';

export type DungeonTransitionData = { loadId: number; presetKey: string; entrances: readonly DungeonEntranceData[]; exits: readonly DungeonExitData[] };
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const direction = (v: unknown) => ['north', 'east', 'south', 'west'].includes(v as string);
const location = (v: unknown) => record(v) && (
  ((v.kind === 'tile' || v.kind === 'tile-edge') && Number.isInteger(v.tileX) && Number.isInteger(v.tileY)
    && (v.kind === 'tile' || direction(v.direction)))
  || (v.kind === 'shared-edge' && Array.isArray(v.sides) && v.sides.length > 0
    && v.sides.every(side => record(side) && Number.isInteger(side.x) && Number.isInteger(side.y) && direction(side.direction))));
const type = defineLabMemoryType<DungeonTransitionData | null>('DungeonTransitionData',
  (v): v is DungeonTransitionData | null => v === null || (record(v) && Number.isSafeInteger(v.loadId) && (v.loadId as number) > 0
    && typeof v.presetKey === 'string' && Array.isArray(v.entrances) && Array.isArray(v.exits)
    && v.entrances.every(item => record(item) && typeof item.entityId === 'string' && typeof item.entranceId === 'string'
      && Number.isInteger(item.tileX) && Number.isInteger(item.tileY) && direction(item.facing))
    && v.exits.every(item => record(item) && typeof item.entityId === 'string' && typeof item.componentId === 'string'
      && typeof item.targetMapPresetKey === 'string' && typeof item.targetEntranceId === 'string' && location(item.location)
      && Array.isArray(item.triggers) && item.triggers.length > 0 && item.triggers.every(t => ['enter', 'interact', 'move-attempt'].includes(t)))));
export const DUNGEON_TRANSITION_DATA_MEMORY = defineLabSharedData({
  key: 'dungeon.transitions', label: '地图入口与出口', type, create: () => null,
  inspect: (v: DungeonTransitionData | null) => v ? { loadId: v.loadId, presetKey: v.presetKey,
    entranceCount: v.entrances.length, exitCount: v.exits.length, entrances: v.entrances, exits: v.exits } : { loaded: false },
});
export const createDungeonTransitionData = (loadId: number, presetKey: string, document: DungeonMapDocumentV2): DungeonTransitionData => ({
  loadId, presetKey, entrances: scanDungeonDocumentEntrances(document).map(createDungeonEntranceData),
  exits: scanDungeonDocumentExits(document).map(createDungeonExitData),
});
