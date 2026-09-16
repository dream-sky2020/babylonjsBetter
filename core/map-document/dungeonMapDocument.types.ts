import type {
  DungeonMapEdgeEvent,
  DungeonMapDirection,
  DungeonMapMarker,
  DungeonMapTileCorner,
  DungeonMapTopologyMode,
} from '../map/dungeonMap.types.ts';

export const DUNGEON_MAP_DOCUMENT_SCHEMA_VERSION = 2 as const;

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

export type DungeonMapDocumentLegacyTileProperties = {
  kind?: string;
  label?: string;
  walkable?: boolean;
  discovered?: boolean;
};

export type DungeonMapDocumentLegacyEdgeProperties = {
  kind?: string;
  label?: string;
  passable?: boolean;
  events?: DungeonMapEdgeEvent[];
  metadata?: Record<string, unknown>;
};

/**
 * V1 迁移兼容区。新业务不得继续向这里写入；这些字段会在对应组件落地后移除。
 */
export type DungeonMapDocumentLegacyData = {
  tileProperties?: Record<string, DungeonMapDocumentLegacyTileProperties>;
  sideProperties?: Record<string, DungeonMapDocumentLegacyEdgeProperties>;
  edgeProperties?: Record<string, DungeonMapDocumentLegacyEdgeProperties>;
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
  metadata?: Record<string, unknown>;
  legacy?: DungeonMapDocumentLegacyData;
};

export type DungeonMapDocumentValidationIssue = {
  code: string;
  message: string;
  path?: string;
};
