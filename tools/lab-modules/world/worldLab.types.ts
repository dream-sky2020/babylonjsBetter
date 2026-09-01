import type { GameRuntime } from '@/core/game-runtime';
import type { WorldPreset, WorldPresetLibrary } from '@/core/world';
import type { WorldRuntime } from '@/core/world-runtime';
import type { DungeonMapPreset } from '@/core/map';

export type WorldRequestedEvent = {
  preset: WorldPreset;
  initialDungeonPreset: DungeonMapPreset;
};

export type GameRuntimeReadyEvent = WorldRequestedEvent & {
  gameRuntime: GameRuntime;
  worldRuntime: WorldRuntime;
};

export const WORLD_LAB_SERVICES = {
  library: 'world:library',
  preset: 'world:preset',
  gameRuntime: 'game:runtime',
  gameTime: 'game:time',
  runtime: 'world:runtime',
} as const;

export type WorldLabPresetLibrary = WorldPresetLibrary;
