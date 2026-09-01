import type { LabModuleCatalog } from '@/tools/lab-kit';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import { gameRuntimeLabModule } from './gameRuntime.labModule';
import { gameTimeLabModule } from './gameTime.labModule';
import { worldLoaderLabModule } from './worldLoader.labModule';

export const worldLabModuleCatalog: LabModuleCatalog = {
  ...dungeonLabModuleCatalog,
  [worldLoaderLabModule.id]: worldLoaderLabModule,
  [gameTimeLabModule.id]: gameTimeLabModule,
  [gameRuntimeLabModule.id]: gameRuntimeLabModule,
};

export * from './worldLab.types';
export * from './gameRuntime.labModule';
export * from './gameTime.labModule';
export * from './worldLoader.labModule';
