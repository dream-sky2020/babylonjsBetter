import type { LabModuleCatalog } from '@/tools/lab-kit';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import { worldLoaderLabModule } from './worldLoader.labModule';
import { worldRuntimeLabModule } from './worldRuntime.labModule';

export const worldLabModuleCatalog: LabModuleCatalog = {
  ...dungeonLabModuleCatalog,
  [worldLoaderLabModule.id]: worldLoaderLabModule,
  [worldRuntimeLabModule.id]: worldRuntimeLabModule,
};

export * from './worldLab.types';
export * from './worldLoader.labModule';
export * from './worldRuntime.labModule';
