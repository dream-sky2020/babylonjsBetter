import type { LabModuleCatalog } from '@/tools/lab-kit';
import { viewportLayersLabModule } from '@/tools/lab-modules/shared/viewport-layers';
import { dungeonConfigLabModule } from './dungeon-config';
import { dungeonAgentLabModule } from './dungeon-agent';
import { dungeonFirstPersonCameraLabModule } from './dungeon-first-person-camera';
import { dungeonPlayerCameraLabModule } from './dungeon-player-camera';
import { dungeonRuntimeSaveSwitchLabModule } from './dungeon-runtime-save-switch';
import { dungeonTransitionLabModule } from './dungeon-transition';
import { dungeonGridDebugLabModule } from './dungeon-grid-debug';
import { dungeonLibrariesLabModule } from './dungeon-libraries';
import { dungeonObstacleLabModule } from './dungeon-obstacle';
import { dungeonRuntimeLabModule } from './dungeon-runtime';
import { dungeonMapLoaderLabModule } from './dungeon-map-loader';
import { playerMovementLabModule } from './player-movement';
import { playerSpawnLabModule } from './player-spawn';

export const dungeonLabModuleCatalog: LabModuleCatalog = {
  [viewportLayersLabModule.id]: viewportLayersLabModule,
  [dungeonLibrariesLabModule.id]: dungeonLibrariesLabModule,
  [dungeonMapLoaderLabModule.id]: dungeonMapLoaderLabModule,
  [dungeonConfigLabModule.id]: dungeonConfigLabModule,
  [dungeonAgentLabModule.id]: dungeonAgentLabModule,
  [dungeonFirstPersonCameraLabModule.id]: dungeonFirstPersonCameraLabModule,
  [dungeonPlayerCameraLabModule.id]: dungeonPlayerCameraLabModule,
  [dungeonGridDebugLabModule.id]: dungeonGridDebugLabModule,
  [playerSpawnLabModule.id]: playerSpawnLabModule,
  [dungeonRuntimeLabModule.id]: dungeonRuntimeLabModule,
  [dungeonObstacleLabModule.id]: dungeonObstacleLabModule,
  [playerMovementLabModule.id]: playerMovementLabModule,
  [dungeonRuntimeSaveSwitchLabModule.id]: dungeonRuntimeSaveSwitchLabModule,
  [dungeonTransitionLabModule.id]: dungeonTransitionLabModule,
};

export * from './dungeon-config';
export * from './dungeon-agent';
export * from './dungeon-first-person-camera';
export * from './dungeon-player-camera';
export * from './dungeon-runtime-save-switch';
export * from './dungeon-transition';
export * from './dungeon-grid-debug';
export * from './dungeon-libraries';
export * from './dungeon-obstacle';
export * from './dungeon-runtime';
export * from './dungeon-map-loader';
export * from './player-movement';
export * from './player-spawn';
