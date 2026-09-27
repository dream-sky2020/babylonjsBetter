import type { DungeonPlayerCameraMode } from './dungeonPlayerCamera.protocol';

export const DUNGEON_PLAYER_CAMERA_SERVICE_KEY = 'dungeon:player-camera';

export type DungeonPlayerCameraService = Readonly<{
  mode: DungeonPlayerCameraMode;
  bindingEnabled: boolean;
  subscribe(listener: () => void): () => void;
  setMode(mode: DungeonPlayerCameraMode): void;
  toggleMode(): void;
}>;
