import type { LabModuleCatalog } from '@/tools/lab-kit';
import { dungeonConfigLabModule } from './dungeonConfig.labModule';
import { dungeonLibrariesLabModule } from './dungeonLibraries.labModule';
import { dungeonGridDebugLabModule } from './dungeonGridDebug.labModule';
import { dungeonObstacleLabModule } from './dungeonObstacle.labModule';
import { dungeonRuntimeLabModule } from './dungeonRuntime.labModule';
import { dungeonSceneLabModule } from './dungeonScene.labModule';
import { playerMovementLabModule } from './playerMovement.labModule';
import { playerSpawnLabModule } from './playerSpawn.labModule';

export const dungeonLabModuleCatalog: LabModuleCatalog = {
  [dungeonLibrariesLabModule.id]: dungeonLibrariesLabModule,
  [dungeonConfigLabModule.id]: dungeonConfigLabModule,
  [dungeonSceneLabModule.id]: dungeonSceneLabModule,
  [dungeonGridDebugLabModule.id]: dungeonGridDebugLabModule,
  [playerSpawnLabModule.id]: playerSpawnLabModule,
  [dungeonRuntimeLabModule.id]: dungeonRuntimeLabModule,
  [dungeonObstacleLabModule.id]: dungeonObstacleLabModule,
  [playerMovementLabModule.id]: playerMovementLabModule,
};

export * from './dungeonLab.types';
export * from './dungeonConfig.labModule';
export * from './dungeonLibraries.labModule';
export * from './dungeonGridDebug.labModule';
export * from './dungeonObstacle.labModule';
export * from './dungeonRuntime.labModule';
export * from './dungeonScene.labModule';
export * from './playerMovement.labModule';
export * from './playerSpawn.labModule';
