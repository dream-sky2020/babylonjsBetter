import type { DungeonMapPresetLibrary } from '@/core/map';
import type { SceneEnvironmentPresetLibrary, ShadowQualityPresetLibrary } from '@/core/scene';
import { createLabEvent, createLabRequest } from '@/tools/lab-kit';

export type DungeonLabLibraries = {
  maps: DungeonMapPresetLibrary;
  environments: SceneEnvironmentPresetLibrary;
  shadows: ShadowQualityPresetLibrary;
};

export type DungeonMapChangedEvent = {
  loadId: number;
  revision: number;
  previousPresetKey: string | null;
  presetKey: string;
  mapId: string;
  width: number;
  height: number;
};

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

export const dungeonMapChangedEvent = createLabEvent<DungeonMapChangedEvent>('dungeon.map.changed');
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

export type DungeonMapCatalogEntry = {
  presetKey: string;
  name: string;
  mapId: string;
  width: number;
  height: number;
};
export const dungeonMapCatalogRequest = createLabRequest<void, readonly DungeonMapCatalogEntry[]>(
  'dungeon.map.catalog',
);

export type DungeonLabMapLoader = {
  switchDungeon(presetKey: string): Promise<boolean>;
  dispose(): void;
};

export type DungeonMapSwitchRequest = {
  presetKey: string;
};

export type DungeonMapSwitchResult = {
  loaded: boolean;
  presetKey: string;
};

/** 地图切换的类型化 Lab API；调用方不再需要直接取得 Loader 实例。 */
export const dungeonMapSwitchRequest = createLabRequest<DungeonMapSwitchRequest, DungeonMapSwitchResult>(
  'dungeon.map.switch',
);

export const DUNGEON_LAB_SERVICES = {
  libraries: 'dungeon:libraries',
  sceneBinding: 'dungeon:scene-binding',
  spawn: 'dungeon:spawn',
  runtime: 'dungeon:runtime',
  obstacles: 'dungeon:obstacles',
} as const;
