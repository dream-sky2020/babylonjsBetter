import type { DungeonObstacleBinding } from '@/core/dungeon-obstacle';
import type { DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';
import type { DungeonRuntime } from '@/core/dungeon-runtime';
import type { DungeonMapPreset, DungeonMapPresetLibrary } from '@/core/map';
import type {
  DungeonMapSceneEnvironmentInstance,
  DungeonMapSceneEnvironmentBinding,
  SceneEnvironmentPresetLibrary,
  ShadowQualityPresetLibrary,
} from '@/core/scene';

export type DungeonLabLibraries = {
  maps: DungeonMapPresetLibrary;
  environments: SceneEnvironmentPresetLibrary;
  shadows: ShadowQualityPresetLibrary;
};

export type DungeonMapRequestedEvent = {
  preset: DungeonMapPreset;
  libraries: DungeonLabLibraries;
};

export type DungeonSceneReadyEvent = DungeonMapRequestedEvent & {
  binding: DungeonMapSceneEnvironmentBinding;
  instance: DungeonMapSceneEnvironmentInstance;
};

export type DungeonSpawnReadyEvent = DungeonSceneReadyEvent & {
  spawn: DungeonPlayerSpawnBinding;
};

export type DungeonRuntimeReadyEvent = DungeonSpawnReadyEvent & {
  runtime: DungeonRuntime;
};

export type DungeonObstaclesReadyEvent = DungeonRuntimeReadyEvent & {
  obstacles: DungeonObstacleBinding[];
};

export const DUNGEON_LAB_SERVICES = {
  libraries: 'dungeon:libraries',
  preset: 'dungeon:preset',
  sceneBinding: 'dungeon:scene-binding',
  sceneInstance: 'dungeon:scene-instance',
  spawn: 'dungeon:spawn',
  runtime: 'dungeon:runtime',
  obstacles: 'dungeon:obstacles',
} as const;
