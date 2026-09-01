import type { Scene } from '@babylonjs/core';
import type { DungeonObstacleBinding } from '../dungeon-obstacle';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import type { DungeonRuntime } from '../dungeon-runtime';
import type { DungeonMapPreset, DungeonMapPresetLibrary } from '../map';
import type {
  DungeonMapSceneEnvironmentBinding,
  DungeonMapSceneEnvironmentInstance,
  SceneEnvironmentPresetLibrary,
  ShadowQualityPresetLibrary,
} from '../scene';
import type { WorldRuntime } from '../world-runtime';

export type DungeonSessionLibraries = {
  maps: DungeonMapPresetLibrary;
  environments: SceneEnvironmentPresetLibrary;
  shadows: ShadowQualityPresetLibrary;
};

export type DungeonSession = {
  readonly sessionId: number;
  readonly dungeonPresetKey: string;
  readonly preset: DungeonMapPreset;
  readonly binding: DungeonMapSceneEnvironmentBinding;
  readonly instance: DungeonMapSceneEnvironmentInstance;
  readonly spawn: DungeonPlayerSpawnBinding;
  readonly runtime: DungeonRuntime;
  readonly obstacles: readonly DungeonObstacleBinding[];
  readonly deltaWarnings: readonly string[];
};

export type DungeonSessionChanged = {
  previous: DungeonSession | null;
  current: DungeonSession;
};

export type DungeonSessionControllerOptions = {
  scene: Scene;
  worldRuntime: WorldRuntime;
  libraries: DungeonSessionLibraries;
};
