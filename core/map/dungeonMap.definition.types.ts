import type { IComponent, IEntityContainer } from '../entity';
import type {
  DungeonMapData,
  DungeonMapEdgeEvent,
  DungeonMapMarker,
  DungeonMapTopologyMode,
} from './dungeonMap.types';

/** 数组层固定使用 east、south、west、north；相反方向可用 index ^ 2 得到。 */
export type DungeonMapDirectionIndex = 0 | 1 | 2 | 3;

export type DungeonMapDataDefinitionComponent = Omit<IComponent, 'id'> & {
  localId: string;
  absoluteId?: string;
};

export type DungeonMapDataDefinitionEntity = {
  localId: string;
  absoluteId?: string;
  entityType: string;
  name?: string;
  archetypeId?: string;
  enabled?: boolean;
  components: DungeonMapDataDefinitionComponent[];
};

/** 只保存可复用内容；空间实例 ID 在展开时由容器位置与 localId 组合。 */
export type DungeonMapDataDefinition = {
  entities: DungeonMapDataDefinitionEntity[];
};

export type DungeonMapReferenceLayers = readonly [
  east: readonly number[],
  south: readonly number[],
  west: readonly number[],
  north: readonly number[],
];

export type DungeonMapStoredEndpoint = readonly [
  x: number,
  y: number,
  direction: DungeonMapDirectionIndex,
];

export type DungeonMapStoredPointPosition = readonly [gridX: number, gridY: number];
export type DungeonMapStoredPointSide = readonly [
  x: number,
  y: number,
  corner: 0 | 1 | 2 | 3,
];

export type DungeonMapStoredTileProperties = {
  kind?: string;
  label?: string;
  walkable?: boolean;
  discovered?: boolean;
};

export type DungeonMapStoredEdgeProperties = {
  /** 仅在不是可推导的默认 ID 时保存。 */
  id?: string;
  kind?: 'open' | 'wall' | 'door' | string;
  label?: string;
  passable?: boolean;
  events?: DungeonMapEdgeEvent[];
  metadata?: Record<string, unknown>;
};

export type DungeonMapStoredSharedEdge = readonly [
  id: string,
  first: DungeonMapStoredEndpoint,
  second: DungeonMapStoredEndpoint | null,
  dataDefinitionRef: number,
  properties?: DungeonMapStoredEdgeProperties,
];

export type DungeonMapStoredSharedPoint = readonly [
  id: string,
  gridX: number,
  gridY: number,
  positions: readonly DungeonMapStoredPointPosition[],
  sides: readonly DungeonMapStoredPointSide[],
  dataDefinitionRef: number,
  pointId?: string,
];

export type DungeonMapDefinitionRefsData = {
  format: 'definition-refs';
  version: 1;
  id: string;
  width: number;
  height: number;
  topologyMode?: DungeonMapTopologyMode;

  /** 地图、格子、单格边、公用边、公用点共同使用的只读数据定义池。 */
  dataDefinitions: readonly DungeonMapDataDefinition[];
  /** 地图自身数据容器的显式快速引用；-1 表示没有数据。 */
  mapDataDefinitionRef: number;
  tileDataDefinitionRefs: readonly number[];
  tileEdgeDataDefinitionRefs: DungeonMapReferenceLayers;

  /** 空间关系保持独立，不与四个单格边层合并。 */
  sharedEdges: readonly DungeonMapStoredSharedEdge[];
  sharedPoints: readonly DungeonMapStoredSharedPoint[];

  /** 可选的显式上下左右联通目标；每项为目标 tileIndex，-1 表示不联通。 */
  connections?: DungeonMapReferenceLayers;

  /** 迁移期保留旧表现字段；只保存实际存在的稀疏项。 */
  tileProperties?: readonly (readonly [tileIndex: number, properties: DungeonMapStoredTileProperties])[];
  tileEdgeProperties?: readonly (readonly [endpointIndex: number, properties: DungeonMapStoredEdgeProperties])[];
  markers?: readonly DungeonMapMarker[];
  metadata?: Record<string, unknown>;
};

export type DungeonMapStoredData = DungeonMapData | DungeonMapDefinitionRefsData;

export type DungeonMapStoredPreset = {
  presetKey: string;
  name: string;
  map: DungeonMapStoredData;
};

export type DungeonMapStoredPresetLibrary = Record<string, DungeonMapStoredPreset>;

export const NO_DUNGEON_MAP_DATA_DEFINITION_REF = -1;

export type DungeonMapResolvedContainer = IEntityContainer | undefined;
