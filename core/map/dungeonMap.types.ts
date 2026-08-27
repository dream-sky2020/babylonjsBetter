import type { IEntityContainer } from '../entity';

export type DungeonMapDirection = 'north' | 'east' | 'south' | 'west';
/**
 * 地图拓扑模式。
 * `loop` 保留为原有双向循环值，避免旧地图存档迁移；另外两个值分别只循环一个轴。
 */
export type DungeonMapTopologyMode = 'bounded' | 'loop-horizontal' | 'loop-vertical' | 'loop';
export type DungeonMapTileCorner = 'north-west' | 'north-east' | 'south-east' | 'south-west';

export type DungeonMapGridPoint = Readonly<{ gridX: number; gridY: number }>;
export type DungeonMapMapCoordinates = Readonly<{
  type: 'map'; x: number; y: number; width: number; height: number;
}>;
export type DungeonMapTileCoordinates = Readonly<{ type: 'tile'; x: number; y: number }>;
export type DungeonMapTileEdgeCoordinates = Readonly<{
  type: 'tile-edge'; x: number; y: number; direction: DungeonMapDirection;
}>;
export type DungeonMapSharedEdgeCoordinates = Readonly<{
  type: 'shared-edge'; sides: readonly DungeonMapEdgeEndpoint[];
}>;
export type DungeonMapSharedPointCoordinates = Readonly<{
  type: 'shared-point'; gridX: number; gridY: number; positions: readonly DungeonMapGridPoint[];
}>;
export type DungeonMapContainerCoordinates =
  | DungeonMapMapCoordinates
  | DungeonMapTileCoordinates
  | DungeonMapTileEdgeCoordinates
  | DungeonMapSharedEdgeCoordinates
  | DungeonMapSharedPointCoordinates;

/** 地图自身的数据容器，可像格子、边和点一样挂载 Entity/Component。 */
export type DungeonMapContainer<TData = IEntityContainer> = {
  id: string;
  /** 与 Entity 数据平级的空间坐标；旧预设加载时会自动补齐。 */
  coordinates: DungeonMapMapCoordinates;
  data?: TData;
};

export type DungeonMapEdgeEndpoint = {
  x: number;
  y: number;
  direction: DungeonMapDirection;
};

export type DungeonMapEdgeEvent = {
  id: string;
  type: string;
  trigger: 'enter' | 'leave' | 'cross' | 'interact';
  enabled?: boolean;
  once?: boolean;
  [key: string]: unknown;
};

/**
 * 边容器（Edge Container）
 * 纯粹的边数据载体，可挂载视觉、状态、属性等任意扩展数据
 */
export type DungeonMapEdgeContainer<
  TData = IEntityContainer,
  TCoordinates extends DungeonMapTileEdgeCoordinates | DungeonMapSharedEdgeCoordinates =
    DungeonMapTileEdgeCoordinates | DungeonMapSharedEdgeCoordinates,
> = {
  id?: string;
  /** 单格边保存格子与方向；公用边保存全部共享侧。 */
  coordinates: TCoordinates;
  /** 挂载的数据/组件集合，类型完全由业务决定 */
  data?: TData;
  /** 迁移期旧地图表现字段；新业务规则应进入 Entity Component。 */
  kind?: 'open' | 'wall' | 'door' | string;
  label?: string;
  passable?: boolean;
  events?: DungeonMapEdgeEvent[];
  metadata?: Record<string, unknown>;
};

export type DungeonMapEdge<TData = IEntityContainer> = DungeonMapEdgeContainer<TData>;

/** 公用点自身的数据容器。 */
export type DungeonMapPointContainer<TData = IEntityContainer> = {
  id?: string;
  coordinates: DungeonMapSharedPointCoordinates;
  data?: TData;
};

/** 一个格子角对公用点的引用。 */
export type DungeonMapPointEndpoint = {
  x: number;
  y: number;
  corner: DungeonMapTileCorner;
};

export type DungeonMapSharedPointSides =
  | readonly [DungeonMapPointEndpoint]
  | readonly [DungeonMapPointEndpoint, DungeonMapPointEndpoint]
  | readonly [
      DungeonMapPointEndpoint,
      DungeonMapPointEndpoint,
      DungeonMapPointEndpoint,
      DungeonMapPointEndpoint,
    ];

/** 单元格的四条边容器 */
export type DungeonMapTileEdges<TData = IEntityContainer> = Readonly<
  Record<DungeonMapDirection, DungeonMapEdgeContainer<TData, DungeonMapTileEdgeCoordinates>>
>;

/**
 * 格子容器（Tile Container）
 * 纯粹的空间单元载体，包含拓扑位置、四条边，以及任意挂载数据
 */
export type DungeonMapTileContainer<
  TTileData = IEntityContainer,
  TEdgeData = IEntityContainer
> = {
  x: number;
  y: number;
  /** 统一坐标字段；x/y 暂时保留用于旧调用兼容。 */
  coordinates: DungeonMapTileCoordinates;
  /** 四条独立边容器 */
  edges: DungeonMapTileEdges<TEdgeData>;
  /** 挂载在格子自身上的数据（如地形、物件、标记、事件等） */
  data?: TTileData;
  /** 迁移期旧地图表现字段。 */
  kind?: string;
  label?: string;
  walkable?: boolean;
  discovered?: boolean;
};

export type DungeonMapTile<
  TTileData = IEntityContainer,
  TEdgeData = IEntityContainer,
> = DungeonMapTileContainer<TTileData, TEdgeData>;

/**
 * 公用边容器（Shared Edge Overrides）
 * 用于覆盖或共享两个邻接格子之间的边容器
 */
export type DungeonMapSharedEdge<TEdgeData = IEntityContainer> = {
  id: string;
  /** 有界地图外轮廓为单侧；内部或循环接缝为双侧。 */
  sides: readonly [DungeonMapEdgeEndpoint] | readonly [DungeonMapEdgeEndpoint, DungeonMapEdgeEndpoint];
  /** 权威边容器数据 */
  edge: DungeonMapEdgeContainer<TEdgeData, DungeonMapSharedEdgeCoordinates>;
};

/** 一个、两个或四个相邻格子共享的交汇点容器。 */
export type DungeonMapSharedPoint<TPointData = IEntityContainer> = {
  id: string;
  /** 公用点在格线坐标中的位置。 */
  gridX: number;
  gridY: number;
  /** 同一数据点的所有画布落点；循环地图的边界点会有两个或四个落点。 */
  positions: readonly DungeonMapGridPoint[];
  /** 顺时针排列的一个、两个或四个格子角。 */
  sides: DungeonMapSharedPointSides;
  point: DungeonMapPointContainer<TPointData>;
};

/**
 * 地图总体拓扑契约
 */
export type DungeonMapData<
  TTileData = IEntityContainer,
  TEdgeData = IEntityContainer,
  TMapData = IEntityContainer,
  TPointData = TEdgeData,
> = DungeonMapContainer<TMapData> & {
  width: number;
  height: number;
  /** 有界、单轴循环或双轴循环地图。 */
  topologyMode?: DungeonMapTopologyMode;
  /** 行优先铺开的纯容器格子数组 */
  tiles: readonly DungeonMapTileContainer<TTileData, TEdgeData>[];
  /** 可选的公用边数据覆盖 */
  sharedEdges?: readonly DungeonMapSharedEdge<TEdgeData>[];
  /** 四格交汇处的公用点数据。 */
  sharedPoints?: readonly DungeonMapSharedPoint<TPointData>[];
  /** 地图自身挂载的 Entity/Component 数据容器。 */
  data?: TMapData;
  markers?: readonly DungeonMapMarker[];
  metadata?: Record<string, unknown>;
};

/** 可由编辑 Lab 与游戏运行时共同读取的完整地图预设。 */
export type DungeonMapPreset = {
  presetKey: string;
  name: string;
  map: DungeonMapData;
};

export type DungeonMapPresetLibrary = Record<string, DungeonMapPreset>;

export type DungeonMapMarker = {
  id: string;
  x: number;
  y: number;
  label?: string;
  color?: string;
  shape?: string;
  visible?: boolean;
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

export type DungeonMapValidationIssue = { code: string; message: string };


export type { IComponent, IVisualComponent, IStateComponent, IEventComponent } from '../entity';
