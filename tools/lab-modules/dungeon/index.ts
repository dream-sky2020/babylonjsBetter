import type { LabModuleCatalog } from '@/tools/lab-kit';
import { viewportLayersLabModule } from '@/tools/lab-modules/shared/viewportLayers.labModule';
import { dungeonConfigLabModule } from './dungeonConfig.labModule';
import { dungeonDeltaSwitchLabModule } from './dungeonDeltaSwitch.labModule';
import { dungeonGridDebugLabModule } from './dungeonGridDebug.labModule';
import { dungeonLibrariesLabModule } from './dungeonLibraries.labModule';
import { dungeonObstacleLabModule } from './dungeonObstacle.labModule';
import { dungeonRuntimeLabModule } from './dungeonRuntime.labModule';
import { dungeonSessionLabModule } from './dungeonSession.labModule';
import { playerMovementLabModule } from './playerMovement.labModule';
import { playerSpawnLabModule } from './playerSpawn.labModule';

export const dungeonLabModuleCatalog: LabModuleCatalog = {
  [viewportLayersLabModule.id]: viewportLayersLabModule,
  [dungeonLibrariesLabModule.id]: dungeonLibrariesLabModule,
  [dungeonSessionLabModule.id]: dungeonSessionLabModule,
  [dungeonConfigLabModule.id]: dungeonConfigLabModule,
  [dungeonGridDebugLabModule.id]: dungeonGridDebugLabModule,
  [playerSpawnLabModule.id]: playerSpawnLabModule,
  [dungeonRuntimeLabModule.id]: dungeonRuntimeLabModule,
  [dungeonObstacleLabModule.id]: dungeonObstacleLabModule,
  [playerMovementLabModule.id]: playerMovementLabModule,
  [dungeonDeltaSwitchLabModule.id]: dungeonDeltaSwitchLabModule,
};

export * from './dungeonLab.types';
export * from './dungeonConfig.labModule';
export * from './dungeonDeltaSwitch.labModule';
export * from './dungeonGridDebug.labModule';
export * from './dungeonLibraries.labModule';
export * from './dungeonObstacle.labModule';
export * from './dungeonRuntime.labModule';
export * from './dungeonSession.labModule';
export * from './playerMovement.labModule';
export * from './playerSpawn.labModule';
