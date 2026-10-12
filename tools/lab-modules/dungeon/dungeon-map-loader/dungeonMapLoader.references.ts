import type { DungeonObstacleBinding } from '@/core/dungeon-obstacle';
import type { DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';
import type { DungeonRuntime } from '@/core/dungeon-runtime';
import type { DungeonMapDocumentV2 } from '@/core/map-document';
import type { DungeonMapSceneEnvironmentBinding } from '@/core/scene';
import type { DungeonMapCanvasView } from '@/core/ui';

/** @deprecated 旧装载结构兼容类型；当前 Loader 不再向模块公开完整对象。 */
export type LoadedDungeonReferences = Readonly<{
  loadId: number;
  presetKey: string;
  document: DungeonMapDocumentV2;
  /** 旧装载结构中的地图投影；当前 Loader 已停止生成。 */
  map: DungeonMapCanvasView;
  sceneBinding: DungeonMapSceneEnvironmentBinding;
  spawn: DungeonPlayerSpawnBinding;
  runtime: DungeonRuntime;
  obstacles: readonly DungeonObstacleBinding[];
}>;

/** @deprecated 旧 Reader 兼容接口；当前模块改为申请领域共享内存。 */
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
