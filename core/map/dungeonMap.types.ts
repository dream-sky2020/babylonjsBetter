export type DungeonMapDirection = 'north' | 'east' | 'south' | 'west';

export type DungeonMapEdgeEndpoint = {
  x: number;
  y: number;
  direction: DungeonMapDirection;
};

/**
 * 边容器（Edge Container）
 * 纯粹的边数据载体，可挂载视觉、状态、属性等任意扩展数据
 */
export type DungeonMapEdgeContainer<TData = Record<string, unknown>> = {
  id?: string;
  /** 挂载的数据/组件集合，类型完全由业务决定 */
  data?: TData;
};

/** 单元格的四条边容器 */
export type DungeonMapTileEdges<TData = Record<string, unknown>> = Readonly<
  Record<DungeonMapDirection, DungeonMapEdgeContainer<TData>>
>;

/**
 * 格子容器（Tile Container）
 * 纯粹的空间单元载体，包含拓扑位置、四条边，以及任意挂载数据
 */
export type DungeonMapTileContainer<
  TTileData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>
> = {
  x: number;
  y: number;
  /** 四条独立边容器 */
  edges: DungeonMapTileEdges<TEdgeData>;
  /** 挂载在格子自身上的数据（如地形、物件、标记、事件等） */
  data?: TTileData;
};

/**
 * 公用边容器（Shared Edge Overrides）
 * 用于覆盖或共享两个邻接格子之间的边容器
 */
export type DungeonMapSharedEdge<TEdgeData = Record<string, unknown>> = {
  id: string;
  sides: readonly [DungeonMapEdgeEndpoint, DungeonMapEdgeEndpoint];
  /** 权威边容器数据 */
  edge: DungeonMapEdgeContainer<TEdgeData>;
};

/**
 * 地图总体拓扑契约
 */
export type DungeonMapData<
  TTileData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
  TMapData = Record<string, unknown>
> = {
  id: string;
  width: number;
  height: number;
  /** 行优先铺开的纯容器格子数组 */
  tiles: readonly DungeonMapTileContainer<TTileData, TEdgeData>[];
  /** 可选的公用边数据覆盖 */
  sharedEdges?: readonly DungeonMapSharedEdge<TEdgeData>[];
  /** 地图全局元数据/挂载容器 */
  data?: TMapData;
};


/** 组件基类标识 */
export interface IComponent {
  /** 组件类型标识，用于业务逻辑快速识别与分发 */
  type: string;
}

/** 1. 视觉表现组件 (Visual Aspect) */
export interface IVisualComponent extends IComponent {
  type: 'visual';
  /** 纹理 / 贴图 / 模型 ID */
  assetId?: string;
  /** 颜色或 Tint */
  color?: string;
  /** 标注或显示文本 */
  label?: string;
  /** 图层排序 / 渲染优先级 */
  layer?: number;
  /** 是否在小地图/UI上可见 */
  visible?: boolean;
}

/** 3. 动态状态组件 (State Aspect) */
export interface IStateComponent<TState extends string = string> extends IComponent {
  type: 'state';
  /** 当前状态 (如: 'open' | 'closed' | 'locked' | 'activated') */
  current: TState;
}

/** 4. 事件响应组件 (Event Aspect) */
export interface IEventComponent extends IComponent {
  type: 'event';
  id: string;
  /** 触发时机 (如: 'enter' | 'leave' | 'interact' | 'look-at') */
  trigger: string;
  /** 触发条件限制 */
  enabled?: boolean;
  /** 是否为一次性事件 */
  once?: boolean;
  /** 关联的操作指令或脚本 ID */
  actionId: string;
  /** 业务载荷数据 */
  payload?: Record<string, unknown>;
}
