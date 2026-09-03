import type {
  DungeonMapDataDefinition,
  DungeonMapReferenceLayers,
  DungeonMapStoredEdgeProperties,
  DungeonMapStoredSharedEdge,
  DungeonMapStoredSharedPoint,
  DungeonMapStoredTileProperties,
} from './dungeonMap.definition.types';
import type { DungeonMapMarker } from './dungeonMap.types';

/** null 表示清除数据；没有对应项表示继承基础地图。 */
export type DungeonMapSparseDefinitionRefChanges = readonly (
  readonly [index: number, definitionRef: number | null]
)[];

export type DungeonMapSparseDefinitionRefLayers = readonly [
  east: DungeonMapSparseDefinitionRefChanges,
  south: DungeonMapSparseDefinitionRefChanges,
  west: DungeonMapSparseDefinitionRefChanges,
  north: DungeonMapSparseDefinitionRefChanges,
];

export type DungeonMapSparseConnectionChanges = readonly (
  readonly [tileIndex: number, targetTileIndex: number]
)[];

export type DungeonMapSparseConnectionLayers = readonly [
  east: DungeonMapSparseConnectionChanges,
  south: DungeonMapSparseConnectionChanges,
  west: DungeonMapSparseConnectionChanges,
  north: DungeonMapSparseConnectionChanges,
];

export type DungeonMapSparsePropertyChanges<T> = readonly (
  readonly [index: number, properties: T | null]
)[];

export type DungeonMapDefinitionRefsDelta = {
  format: 'definition-refs-delta';
  version: 1;
  basePresetKey: string;
  /** 防止基础文件改变后数字引用静默指向错误 Definition。 */
  baseFingerprint: string;
  baseDefinitionCount: number;

  /** 追加在基础 Definition 池之后；补丁引用使用合并后的绝对下标。 */
  dataDefinitions: readonly DungeonMapDataDefinition[];
  mapDataDefinitionRef?: number | null;
  tileDataDefinitionRefChanges?: DungeonMapSparseDefinitionRefChanges;
  tileEdgeDataDefinitionRefChanges?: DungeonMapSparseDefinitionRefLayers;

  sharedEdgeChanges?: {
    remove?: readonly string[];
    upsert?: readonly DungeonMapStoredSharedEdge[];
  };
  sharedPointChanges?: {
    remove?: readonly string[];
    upsert?: readonly DungeonMapStoredSharedPoint[];
  };

  /** null 删除整层；数组只覆盖列出的格子。 */
  connectionChanges?: DungeonMapSparseConnectionLayers | null;
  tilePropertyChanges?: DungeonMapSparsePropertyChanges<DungeonMapStoredTileProperties>;
  tileEdgePropertyChanges?: DungeonMapSparsePropertyChanges<DungeonMapStoredEdgeProperties>;
  markers?: readonly DungeonMapMarker[] | null;
  metadata?: Record<string, unknown> | null;
};

export type DungeonMapResolvedReferenceLayers = DungeonMapReferenceLayers;
