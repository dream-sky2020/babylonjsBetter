import type {
  DungeonMapDirection,
  DungeonMapMarker,
  DungeonMapTileCorner,
  DungeonMapTopologyMode,
} from '../map/dungeonMap.types.ts';

export const DUNGEON_MAP_DOCUMENT_SCHEMA_VERSION = 2 as const;
export const DUNGEON_MAP_STORAGE_SCHEMA_VERSION = 3 as const;

export const DUNGEON_MAP_DIRECTION_ORDER = ['north', 'east', 'south', 'west'] as const;
export const DUNGEON_MAP_CORNER_ORDER = [
  'north-west',
  'north-east',
  'south-east',
  'south-west',
] as const;

export type DungeonMapDirectionTuple<T> = readonly [T, T, T, T];
export type DungeonMapCornerTuple<T> = readonly [T, T, T, T];

/** V2 文档中的 Entity 只保存身份；组件和空间位置均保存在独立表中。 */
export type DungeonMapDocumentEntity = {
  id: string;
  entityType: string;
  name?: string;
  archetypeId?: string;
  enabled?: boolean;
};

/**
 * JSON 友好的 ECS 组件记录。entityId 是 Entity/Component 关系的唯一事实来源，
 * Entity 上不再反向保存 componentIds。
 */
export type DungeonMapDocumentComponent = {
  id: string;
  entityId: string;
  type: string;
  version: number;
  slot?: string;
  enabled?: boolean;
  [key: string]: unknown;
};

export type DungeonMapSpatialTarget =
  | Readonly<{ kind: 'map' }>
  | Readonly<{ kind: 'tile'; tileId: string }>
  | Readonly<{ kind: 'side'; sideId: string }>
  | Readonly<{ kind: 'edge'; edgeId: string }>
  | Readonly<{ kind: 'point'; pointId: string }>;

export type DungeonMapSpatialAttachmentComponent = DungeonMapDocumentComponent & {
  type: 'spatial-attachment';
  version: 1;
  targets: DungeonMapSpatialTarget[];
};

/** 某个格子某一方向自己的面；共享边通过 edgeId 连接一个或两个面。 */
export type DungeonMapDocumentSide = {
  id: string;
  tileId: string;
  direction: DungeonMapDirection;
  edgeId: string;
};

export type DungeonMapDocumentEdge = {
  id: string;
  sideIds: readonly [string] | readonly [string, string];
};

export type DungeonMapDocumentPointCorner = {
  tileId: string;
  corner: DungeonMapTileCorner;
};

export type DungeonMapDocumentPoint = {
  id: string;
  gridX: number;
  gridY: number;
  /** 循环拓扑的同一点可能需要在画布边界绘制多次。 */
  positions: readonly { gridX: number; gridY: number }[];
  corners: DungeonMapDocumentPointCorner[];
};

export type DungeonMapTerrainProperties = {
  kind?: string;
  label?: string;
  walkable?: boolean;
  discovered?: boolean;
};

/** 默认地形覆盖整张规则网格，只有不同的格子才进入 overrides。 */
export type DungeonMapDocumentTerrain = {
  default: DungeonMapTerrainProperties;
  overrides?: Record<string, DungeonMapTerrainProperties>;
};

/**
 * V1 迁移兼容区。这里只暂存旧 Marker；墙、门、阻碍及交互均由
 * 正式 Entity/Component 表达，不允许在 Side/Edge 上保留第二套属性语义。
 */
export type DungeonMapDocumentLegacyData = {
  markers?: readonly DungeonMapMarker[];
};

/**
 * 编辑器权威拓扑。tileIds 使用行优先排列；tileSides/tilePoints 与其一一对应，
 * 每项分别采用固定 NESW 与 NW/NE/SE/SW 顺序。
 */
export type DungeonMapDocumentGrid = {
  width: number;
  height: number;
  topologyMode: DungeonMapTopologyMode;
  tileIds: string[];
  tileSides: DungeonMapDirectionTuple<string>[];
  sides: DungeonMapDocumentSide[];
  edges: DungeonMapDocumentEdge[];
  tilePoints: DungeonMapCornerTuple<string>[];
  points: DungeonMapDocumentPoint[];
};

export type DungeonMapDocumentV2 = {
  schemaVersion: typeof DUNGEON_MAP_DOCUMENT_SCHEMA_VERSION;
  identity: {
    id: string;
    presetKey: string;
    name: string;
  };
  grid: DungeonMapDocumentGrid;
  /** 稳定顺序便于 diff；查询时通过派生索引访问。 */
  entities: DungeonMapDocumentEntity[];
  /** 组件类型 → 该类型的组件表。 */
  components: Record<string, DungeonMapDocumentComponent[]>;
  /** 稀疏地板/格子地形，不需要为每个格子创建 Entity。 */
  terrain?: DungeonMapDocumentTerrain;
  metadata?: Record<string, unknown>;
  legacy?: DungeonMapDocumentLegacyData;
};

/**
 * V3 是磁盘专用紧凑格式。矩形地图的完整 Tile/Side/Edge/Point 表可由这三个字段
 * 唯一推导，因此不再重复写入 JSON；加载边界会将其展开为运行时 V2 文档。
 */
export type DungeonMapStorageGridV3 = {
  width: number;
  height: number;
  topologyMode: DungeonMapTopologyMode;
};

export type DungeonMapDocumentV3 = Omit<DungeonMapDocumentV2, 'schemaVersion' | 'grid'> & {
  schemaVersion: typeof DUNGEON_MAP_STORAGE_SCHEMA_VERSION;
  grid: DungeonMapStorageGridV3;
};

export type DungeonMapDocumentValidationIssue = {
  code: string;
  message: string;
  path?: string;
};
