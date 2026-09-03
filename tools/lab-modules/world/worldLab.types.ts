import type { WorldPresetLibrary } from '@/core/world';
import { createLabEvent, createLabRequest } from '@/tools/lab-kit';

export type GameRuntimeActivateWorldRequest = {
  worldPresetKey: string;
};

export type GameRuntimeActivateWorldResult = {
  activated: boolean;
  worldPresetKey: string;
};

export type GameRuntimeReadyEvent = {
  worldPresetKey: string;
};

export const gameRuntimeActivateWorldRequest = createLabRequest<
  GameRuntimeActivateWorldRequest,
  GameRuntimeActivateWorldResult
>('game.runtime.activate-world');

export const gameRuntimeReadyEvent = createLabEvent<GameRuntimeReadyEvent>('game.runtime.ready');

export const WORLD_LAB_SERVICES = { runtime: 'world:runtime' } as const;

export type WorldLabPresetLibrary = WorldPresetLibrary;
