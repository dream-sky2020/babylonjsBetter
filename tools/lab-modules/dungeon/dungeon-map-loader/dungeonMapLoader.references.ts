import type { DungeonObstacleBinding } from '@/core/dungeon-obstacle';
import type { DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';
import type { DungeonRuntime } from '@/core/dungeon-runtime';
import type { DungeonMapDocumentV2 } from '@/core/map-document';
import type { DungeonMapSceneEnvironmentBinding } from '@/core/scene';
import type { DungeonMapCanvasView } from '@/core/ui';

/** 一次地图装载成功后，对其他 Dungeon Lab Module 原子公开的完整活引用。 */
export type LoadedDungeonReferences = Readonly<{
  loadId: number;
  presetKey: string;
  document: DungeonMapDocumentV2;
  /** 仍供格子 Debug 几何使用的只读派生视图。 */
  map: DungeonMapCanvasView;
  sceneBinding: DungeonMapSceneEnvironmentBinding;
  spawn: DungeonPlayerSpawnBinding;
  runtime: DungeonRuntime;
  obstacles: readonly DungeonObstacleBinding[];
}>;

/** 消费模块只持有 Reader，不能提交或清空 Loader 的引用。 */
export type DungeonMapLoaderReferences = {
  readonly current: LoadedDungeonReferences | null;
};

export type DungeonMapLoaderReferencesController = {
  readonly references: DungeonMapLoaderReferences;
  commit(next: LoadedDungeonReferences): void;
  clear(): void;
};

export const DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY = 'dungeon:map-loader-references';

export const createDungeonMapLoaderReferences = (): DungeonMapLoaderReferencesController => {
  let current: LoadedDungeonReferences | null = null;
  const references: DungeonMapLoaderReferences = {
    get current() { return current; },
  };
  return {
    references,
    commit(next) { current = Object.freeze({ ...next }); },
    clear() { current = null; },
  };
};
