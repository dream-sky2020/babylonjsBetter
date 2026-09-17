import { createLabEvent } from '@/tools/lab-kit';

export type DungeonPlayerCameraMode = 'first-person' | 'overhead';

export type DungeonPlayerCameraModeChangedEvent = Readonly<{
  mode: DungeonPlayerCameraMode;
  previousMode: DungeonPlayerCameraMode;
  reason: 'ui' | 'keyboard' | 'service';
}>;

export const dungeonPlayerCameraModeChangedEvent = createLabEvent<DungeonPlayerCameraModeChangedEvent>(
  'dungeon.player-camera.mode-changed',
);
