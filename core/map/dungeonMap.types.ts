export type DungeonMapDirection = 'north' | 'east' | 'south' | 'west';

export type DungeonMapAction =
  | 'move-forward'
  | 'move-backward'
  | 'strafe-left'
  | 'strafe-right'
  | 'turn-left'
  | 'turn-right';

export type DungeonMapTileKind = 'void' | 'floor' | 'wall' | 'door' | 'stairs-up' | 'stairs-down';

export type DungeonMapEdgeKind = 'open' | 'wall' | 'door';

export type DungeonMapEdgeEventTrigger = 'enter' | 'leave' | 'cross' | 'interact';

export type DungeonMapEdgeEvent = {
  id: string;
  type: string;
  trigger: DungeonMapEdgeEventTrigger;
  enabled?: boolean;
  once?: boolean;
  payload?: Readonly<Record<string, unknown>>;
};

export type DungeonMapEdge = {
  kind: DungeonMapEdgeKind;
  passable?: boolean;
  color?: string;
  label?: string;
  events?: readonly DungeonMapEdgeEvent[];
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

/** 四条边完全归当前格子所有，不与任何相邻格子共享引用或配置。 */
export type DungeonMapTileEdges = Readonly<Record<DungeonMapDirection, DungeonMapEdge>>;

export type DungeonMapTile = {
  kind: DungeonMapTileKind;
  edges: DungeonMapTileEdges;
  discovered?: boolean;
  walkable?: boolean;
  color?: string;
  label?: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

export type DungeonMapMarker = {
  id: string;
  x: number;
  y: number;
  color?: string;
  label?: string;
  shape?: 'circle' | 'diamond' | 'square';
  visible?: boolean;
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

/**
 * 地图的稳定数据契约。tiles 使用从左到右、从上到下的一维行优先数组，
 * 因此坐标 (x, y) 的索引恒为 y * width + x。
 */
export type DungeonMapData = {
  id: string;
  width: number;
  height: number;
  tiles: readonly DungeonMapTile[];
  markers?: readonly DungeonMapMarker[];
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

export type DungeonMapPlayer = {
  x: number;
  y: number;
  direction: DungeonMapDirection;
  color?: string;
};

export type DungeonMapValidationIssue = {
  code:
    | 'invalid-id'
    | 'invalid-size'
    | 'tile-count-mismatch'
    | 'missing-tile-edge'
    | 'marker-out-of-bounds'
    | 'duplicate-marker-id';
  message: string;
};

export type DungeonMapTraversalEdge = {
  tileX: number;
  tileY: number;
  direction: DungeonMapDirection;
  edge: DungeonMapEdge;
};

export type DungeonMapTraversalEdges = {
  leaving: DungeonMapTraversalEdge;
  entering: DungeonMapTraversalEdge;
};
