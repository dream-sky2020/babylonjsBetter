import type { WorldPreset, WorldPresetLibrary } from '@/core/world';
import type { DungeonMapPreset } from '@/core/map';
import type { WorldRuntime } from '@/core/world-runtime';

export type WorldRequestedEvent = {
  preset: WorldPreset;
  initialDungeonPreset: DungeonMapPreset;
};

export type WorldRuntimeReadyEvent = WorldRequestedEvent & {
  runtime: WorldRuntime;
};

export const WORLD_LAB_SERVICES = {
  library: 'world:library',
  preset: 'world:preset',
  runtime: 'world:runtime',
} as const;

export type WorldLabPresetLibrary = WorldPresetLibrary;
