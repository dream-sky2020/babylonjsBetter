import type { DungeonMapDocumentLibraryV2 } from '@/core/map-document';
import type { SceneEnvironmentPresetLibrary, ShadowQualityPresetLibrary } from '@/core/scene';
import { createLabRequest } from '@/tools/lab-kit';

export type DungeonLabLibraries = {
  maps: DungeonMapDocumentLibraryV2;
  environments: SceneEnvironmentPresetLibrary;
  shadows: ShadowQualityPresetLibrary;
};

export type DungeonMapCatalogEntry = {
  presetKey: string;
  name: string;
  mapId: string;
  width: number;
  height: number;
};

export const dungeonMapCatalogRequest = createLabRequest<void, readonly DungeonMapCatalogEntry[]>(
  'dungeon.map.catalog',
);

export const DUNGEON_LIBRARIES_SERVICE_KEY = 'dungeon:libraries';
