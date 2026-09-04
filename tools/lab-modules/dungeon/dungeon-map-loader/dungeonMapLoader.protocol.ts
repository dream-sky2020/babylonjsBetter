import type { DungeonRuntimeSaveState } from '@/core/dungeon-runtime-save';
import { createLabEvent, createLabRequest } from '@/tools/lab-kit';

export type DungeonMapChangedEvent = {
  loadId: number;
  revision: number;
  previousPresetKey: string | null;
  presetKey: string;
  mapId: string;
  width: number;
  height: number;
};

export const dungeonMapChangedEvent = createLabEvent<DungeonMapChangedEvent>('dungeon.map.changed');

export type DungeonRuntimeChangedReason =
  | 'obstacle-state'
  | 'player-movement-completed'
  | 'player-movement-blocked'
  | 'player-turn-completed'
  | 'player-relative-movement-completed'
  | 'player-position-teleported';

export type DungeonRuntimeChangedEvent = {
  reason: DungeonRuntimeChangedReason;
  loadId: number;
  revision: number;
  presetKey: string;
};

export const dungeonRuntimeChangedEvent = createLabEvent<DungeonRuntimeChangedEvent>('dungeon.runtime.changed');

export type DungeonRuntimeCommitRequest = { reason: DungeonRuntimeChangedReason };
export type DungeonRuntimeCommitResult = {
  committed: boolean;
  loadId: number;
  revision: number;
  presetKey: string | null;
};

export const dungeonRuntimeCommitRequest = createLabRequest<DungeonRuntimeCommitRequest, DungeonRuntimeCommitResult>(
  'dungeon.runtime.commit',
);

export const dungeonRuntimeSaveStatesRequest = createLabRequest<
  void,
  Readonly<Record<string, DungeonRuntimeSaveState>>
>('dungeon.runtime-save-states.get');

export type DungeonLabMapLoader = {
  switchDungeon(presetKey: string): Promise<boolean>;
  dispose(): void;
};

export type DungeonMapSwitchRequest = { presetKey: string };
export type DungeonMapSwitchResult = { loaded: boolean; presetKey: string };

export const dungeonMapSwitchRequest = createLabRequest<DungeonMapSwitchRequest, DungeonMapSwitchResult>(
  'dungeon.map.switch',
);
