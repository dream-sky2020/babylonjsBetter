import { dungeonInteractTriggerLabModule } from './dungeon-interact-trigger/dungeonInteractTrigger.labModule';
import { dungeonSpatialTriggerLabModule } from './dungeon-spatial-trigger/dungeonSpatialTrigger.labModule';
import { dungeonVariableTriggerLabModule } from './dungeon-variable-trigger/dungeonVariableTrigger.labModule';
import { dungeonMapActionExecutorLabModule } from './dungeon-map-action-executor/dungeonMapActionExecutor.labModule';
import { dungeonInteractionLabModule } from './dungeon-interaction/dungeonInteraction.labModule';
import { dungeonEntityVisualLoaderLabModule } from './dungeon-entity-visual-loader/dungeonEntityVisualLoader.labModule';
import { dungeonVisualObjectControlLabModule } from './dungeon-visual-object-control/dungeonVisualObjectControl.labModule';
import { dungeonSystemManifests } from './dungeonSystem.manifests';
import type { LabModuleCatalog } from '@/labs/kit';
import { dungeonOverheadViewLabModule } from './dungeon-overhead-view';
import { dungeonVisualDeformationLabModule } from './dungeon-visual-deformation';
import { viewportLayersLabModule } from '@/labs/modules/shared/viewport-layers';
import { messageBarLabModule } from '@/labs/modules/shared/message-bar/messageBar.labModule';
import { uiRuntimeLabModule } from '@/labs/modules/shared/ui-runtime/uiRuntime.labModule';
import { dungeonConfigLabModule } from './dungeon-config';
import { dungeonAgentLabModule } from './dungeon-agent';
import { dungeonFirstPersonCameraLabModule } from './dungeon-first-person-camera';
import { dungeonPlayerCameraLabModule } from './dungeon-player-camera';
import { dungeonRuntimeSaveSwitchLabModule } from './dungeon-runtime-save-switch';
import { dungeonTransitionLabModule } from './dungeon-transition';
import { dungeonGridDebugLabModule } from './dungeon-grid-debug';
import { dungeonGridLabModule } from './dungeon-grid';
import { dungeonTraversalLabModule } from './dungeon-traversal';
import { dungeonMovementLabModule } from './dungeon-movement';
import { dungeonLibrariesLabModule } from './dungeon-libraries';
import { dungeonObstacleLabModule } from './dungeon-obstacle';
import { dungeonRuntimeLabModule } from './dungeon-runtime';
import { dungeonMapLoaderLabModule } from './dungeon-map-loader';
import { playerMovementLabModule } from './player-movement';
import { playerSpawnLabModule } from './player-spawn';

const dungeonModules: LabModuleCatalog = {
  [dungeonInteractionLabModule.id]: dungeonInteractionLabModule,
  [dungeonInteractTriggerLabModule.id]: dungeonInteractTriggerLabModule,
  [dungeonSpatialTriggerLabModule.id]: dungeonSpatialTriggerLabModule,
  [dungeonVariableTriggerLabModule.id]: dungeonVariableTriggerLabModule,
  [dungeonMapActionExecutorLabModule.id]: dungeonMapActionExecutorLabModule,
  [dungeonEntityVisualLoaderLabModule.id]: dungeonEntityVisualLoaderLabModule,
  [dungeonVisualObjectControlLabModule.id]: dungeonVisualObjectControlLabModule,
  [dungeonOverheadViewLabModule.id]: dungeonOverheadViewLabModule,
  [dungeonVisualDeformationLabModule.id]: dungeonVisualDeformationLabModule,
  [viewportLayersLabModule.id]: viewportLayersLabModule,
  [messageBarLabModule.id]: messageBarLabModule,
  [uiRuntimeLabModule.id]: uiRuntimeLabModule,
  [dungeonLibrariesLabModule.id]: dungeonLibrariesLabModule,
  [dungeonMapLoaderLabModule.id]: dungeonMapLoaderLabModule,
  [dungeonConfigLabModule.id]: dungeonConfigLabModule,
  [dungeonAgentLabModule.id]: dungeonAgentLabModule,
  [dungeonFirstPersonCameraLabModule.id]: dungeonFirstPersonCameraLabModule,
  [dungeonPlayerCameraLabModule.id]: dungeonPlayerCameraLabModule,
  [dungeonGridDebugLabModule.id]: dungeonGridDebugLabModule,
  [dungeonGridLabModule.id]: dungeonGridLabModule,
  [dungeonTraversalLabModule.id]: dungeonTraversalLabModule,
  [dungeonMovementLabModule.id]: dungeonMovementLabModule,
  [playerSpawnLabModule.id]: playerSpawnLabModule,
  [dungeonRuntimeLabModule.id]: dungeonRuntimeLabModule,
  [dungeonObstacleLabModule.id]: dungeonObstacleLabModule,
  [playerMovementLabModule.id]: playerMovementLabModule,
  [dungeonRuntimeSaveSwitchLabModule.id]: dungeonRuntimeSaveSwitchLabModule,
  [dungeonTransitionLabModule.id]: dungeonTransitionLabModule,
};

export const dungeonLabModuleCatalog: LabModuleCatalog = Object.freeze(Object.fromEntries(
  Object.entries(dungeonModules).map(([id, module]) => {
    const manifest = dungeonSystemManifests[id];
    if (!manifest) throw new Error('Dungeon 模块缺少系统契约：' + id);
    return [id, Object.freeze({ ...module, manifest })];
  }),
));

export * from './dungeon-config';
export * from './dungeon-overhead-view';
export * from './dungeon-visual-deformation';
export * from './dungeon-agent';
export * from './dungeon-first-person-camera';
export * from './dungeon-player-camera';
export * from './dungeon-runtime-save-switch';
export * from './dungeon-transition';
export { dungeonGridDebugLabModule } from './dungeon-grid-debug';
export * from './dungeon-grid';
export * from './dungeon-traversal';
export * from './dungeon-movement';
export * from './dungeon-libraries';
export * from './dungeon-obstacle';
export * from './dungeon-runtime';
export * from './dungeon-map-loader';
export * from './player-movement';
export * from './player-spawn';
