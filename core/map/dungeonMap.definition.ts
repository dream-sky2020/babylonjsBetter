import type { IComponent, IEntity, IEntityContainer } from '../entity';
import type {
  DungeonMapDataDefinition,
  DungeonMapDataDefinitionComponent,
  DungeonMapDataDefinitionEntity,
  DungeonMapDefinitionRefsData,
  DungeonMapDirectionIndex,
  DungeonMapStoredData,
  DungeonMapStoredEdgeProperties,
  DungeonMapStoredPreset,
  DungeonMapStoredPresetLibrary,
  DungeonMapStoredTileProperties,
} from './dungeonMap.definition.types';
import { NO_DUNGEON_MAP_DATA_DEFINITION_REF } from './dungeonMap.definition.types.ts';
import type {
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapPreset,
  DungeonMapPresetLibrary,
  DungeonMapSharedPointSides,
  DungeonMapTileCorner,
} from './dungeonMap.types';

const DIRECTIONS: readonly DungeonMapDirection[] = ['east', 'south', 'west', 'north'];
const CORNERS: readonly DungeonMapTileCorner[] = ['north-west', 'north-east', 'south-east', 'south-west'];
const GENERATED_LABEL_TOKEN = '$dungeon-map:generated-label';

type DefinitionContext = {
  instanceId: string;
  defaultEntityName?: string;
  generatedLabel?: string;
};

const cloneJson = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

const mapJsonStrings = (value: unknown, mapper: (value: string) => string): unknown => {
  if (typeof value === 'string') return mapper(value);
  if (Array.isArray(value)) return value.map((item) => mapJsonStrings(item, mapper));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapJsonStrings(item, mapper)]));
};

const relativeId = (id: string, prefix: string): { localId: string; absoluteId?: string } => {
  if (id.startsWith(`${prefix}:`)) return { localId: id.slice(prefix.length + 1) };
  return { localId: id, absoluteId: id };
};

const instantiateId = (localId: string, absoluteId: string | undefined, prefix: string): string => (
  absoluteId ?? `${prefix}:${localId}`
);

const encodeComponent = (
  component: IComponent,
  entityId: string,
  generatedLabel?: string,
): DungeonMapDataDefinitionComponent => {
  const { id, ...content } = cloneJson(component);
  const identity = relativeId(id, entityId);
  const normalized = generatedLabel
    ? mapJsonStrings(content, (value) => value === generatedLabel ? GENERATED_LABEL_TOKEN : value)
    : content;
  return { ...(normalized as Omit<IComponent, 'id'>), ...identity };
};

const encodeEntity = (entity: IEntity, context: DefinitionContext): DungeonMapDataDefinitionEntity => {
  const identity = relativeId(entity.id, context.instanceId);
  return {
    ...identity,
    entityType: entity.entityType,
    ...(entity.name && entity.name !== context.defaultEntityName ? { name: entity.name } : {}),
    ...(entity.archetypeId ? { archetypeId: entity.archetypeId } : {}),
    ...(entity.enabled !== undefined ? { enabled: entity.enabled } : {}),
    components: entity.components.map((component) => encodeComponent(component, entity.id, context.generatedLabel)),
  };
};

const encodeDefinition = (
  container: IEntityContainer | undefined,
  context: DefinitionContext,
  definitions: DungeonMapDataDefinition[],
  definitionIndex: Map<string, number>,
): number => {
  if (!container) return NO_DUNGEON_MAP_DATA_DEFINITION_REF;
  const definition: DungeonMapDataDefinition = {
    entities: container.entities.map((entity) => encodeEntity(entity, context)),
  };
  const key = JSON.stringify(definition);
  const existing = definitionIndex.get(key);
  if (existing !== undefined) return existing;
  const ref = definitions.length;
  definitions.push(definition);
  definitionIndex.set(key, ref);
  return ref;
};

const decodeComponent = (
  component: DungeonMapDataDefinitionComponent,
  entityId: string,
  generatedLabel?: string,
): IComponent => {
  const { localId, absoluteId, ...content } = cloneJson(component);
  const restored = generatedLabel
    ? mapJsonStrings(content, (value) => value === GENERATED_LABEL_TOKEN ? generatedLabel : value)
    : content;
  return { ...(restored as Omit<IComponent, 'id'>), id: instantiateId(localId, absoluteId, entityId) };
};

const decodeDefinition = (
  map: DungeonMapDefinitionRefsData,
  ref: number,
  context: DefinitionContext,
): IEntityContainer | undefined => {
  if (ref === NO_DUNGEON_MAP_DATA_DEFINITION_REF) return undefined;
  const definition = map.dataDefinitions[ref];
  if (!definition) throw new Error(`地图 ${map.id} 引用了不存在的数据定义 ${ref}。`);
  return {
    entities: definition.entities.map((entity) => {
      const id = instantiateId(entity.localId, entity.absoluteId, context.instanceId);
      return {
        id,
        entityType: entity.entityType,
        ...(entity.name || context.defaultEntityName ? { name: entity.name ?? context.defaultEntityName } : {}),
        ...(entity.archetypeId ? { archetypeId: entity.archetypeId } : {}),
        ...(entity.enabled !== undefined ? { enabled: entity.enabled } : {}),
        components: entity.components.map((component) => decodeComponent(component, id, context.generatedLabel)),
      };
    }),
  };
};

const edgeProperties = (edge: {
  id?: string;
  kind?: string;
  label?: string;
  passable?: boolean;
  events?: import('./dungeonMap.types').DungeonMapEdgeEvent[];
  metadata?: Record<string, unknown>;
}, defaultId: string): DungeonMapStoredEdgeProperties | undefined => {
  const properties: DungeonMapStoredEdgeProperties = {
    ...(edge.id && edge.id !== defaultId ? { id: edge.id } : {}),
    ...(edge.kind !== undefined ? { kind: edge.kind } : {}),
    ...(edge.label !== undefined ? { label: edge.label } : {}),
    ...(edge.passable !== undefined ? { passable: edge.passable } : {}),
    ...(edge.events !== undefined ? { events: cloneJson(edge.events) } : {}),
    ...(edge.metadata !== undefined ? { metadata: cloneJson(edge.metadata) } : {}),
  };
  return Object.keys(properties).length ? properties : undefined;
};

const tileProperties = (tile: {
  kind?: string;
  label?: string;
  walkable?: boolean;
  discovered?: boolean;
}): DungeonMapStoredTileProperties | undefined => {
  const properties: DungeonMapStoredTileProperties = {
    ...(tile.kind !== undefined ? { kind: tile.kind } : {}),
    ...(tile.label !== undefined ? { label: tile.label } : {}),
    ...(tile.walkable !== undefined ? { walkable: tile.walkable } : {}),
    ...(tile.discovered !== undefined ? { discovered: tile.discovered } : {}),
  };
  return Object.keys(properties).length ? properties : undefined;
};

export const isDungeonMapDefinitionRefsData = (value: unknown): value is DungeonMapDefinitionRefsData => (
  !!value && typeof value === 'object'
  && (value as Partial<DungeonMapDefinitionRefsData>).format === 'definition-refs'
  && (value as Partial<DungeonMapDefinitionRefsData>).version === 1
);

export const encodeDungeonMapData = (map: DungeonMapData): DungeonMapDefinitionRefsData => {
  const definitions: DungeonMapDataDefinition[] = [];
  const definitionIndex = new Map<string, number>();
  const tileDataDefinitionRefs: number[] = [];
  const tileEdgeDataDefinitionRefs: [number[], number[], number[], number[]] = [[], [], [], []];
  const storedTileProperties: [number, DungeonMapStoredTileProperties][] = [];
  const storedTileEdgeProperties: [number, DungeonMapStoredEdgeProperties][] = [];

  map.tiles.forEach((tile, tileIndex) => {
    const position = `${tile.x},${tile.y}`;
    tileDataDefinitionRefs.push(encodeDefinition(tile.data, {
      instanceId: `tile:${position}`,
      defaultEntityName: `格子 ${position}`,
    }, definitions, definitionIndex));
    const properties = tileProperties(tile);
    if (properties) storedTileProperties.push([tileIndex, properties]);
    DIRECTIONS.forEach((direction, directionIndex) => {
      const edge = tile.edges[direction];
      const instanceId = `tile:${position}:${direction}`;
      tileEdgeDataDefinitionRefs[directionIndex].push(encodeDefinition(edge.data, {
        instanceId,
        defaultEntityName: `单格边 ${position},${direction}`,
      }, definitions, definitionIndex));
      const properties = edgeProperties(edge, instanceId);
      if (properties) storedTileEdgeProperties.push([tileIndex * 4 + directionIndex, properties]);
    });
  });

  const sharedEdges = (map.sharedEdges ?? []).map((sharedEdge) => {
    const first = sharedEdge.sides[0];
    const generatedLabel = `公用边 ${first.x},${first.y},${first.direction}`;
    const ref = encodeDefinition(sharedEdge.edge.data, {
      instanceId: sharedEdge.id,
      defaultEntityName: '公用边实体',
      generatedLabel,
    }, definitions, definitionIndex);
    const firstStored = [first.x, first.y, DIRECTIONS.indexOf(first.direction) as DungeonMapDirectionIndex] as const;
    const second = sharedEdge.sides[1];
    const secondStored = second
      ? [second.x, second.y, DIRECTIONS.indexOf(second.direction) as DungeonMapDirectionIndex] as const
      : null;
    const properties = edgeProperties(sharedEdge.edge, sharedEdge.id);
    return properties
      ? [sharedEdge.id, firstStored, secondStored, ref, properties] as const
      : [sharedEdge.id, firstStored, secondStored, ref] as const;
  });

  const sharedPoints = (map.sharedPoints ?? []).map((sharedPoint) => {
    const ref = encodeDefinition(sharedPoint.point.data, {
      instanceId: sharedPoint.id,
      defaultEntityName: '公用点实体',
      generatedLabel: `公用点 ${sharedPoint.gridX},${sharedPoint.gridY}`,
    }, definitions, definitionIndex);
    const storedPoint = [
      sharedPoint.id,
      sharedPoint.gridX,
      sharedPoint.gridY,
      sharedPoint.positions.map(({ gridX, gridY }) => [gridX, gridY] as const),
      sharedPoint.sides.map(({ x, y, corner }) => [x, y, CORNERS.indexOf(corner) as 0 | 1 | 2 | 3] as const),
      ref,
    ] as const;
    return sharedPoint.point.id && sharedPoint.point.id !== sharedPoint.id
      ? [...storedPoint, sharedPoint.point.id] as const
      : storedPoint;
  });

  return {
    format: 'definition-refs',
    version: 1,
    id: map.id,
    width: map.width,
    height: map.height,
    ...(map.topologyMode ? { topologyMode: map.topologyMode } : {}),
    dataDefinitions: definitions,
    mapDataDefinitionRef: encodeDefinition(map.data, {
      instanceId: map.id,
      defaultEntityName: '地图实体',
    }, definitions, definitionIndex),
    tileDataDefinitionRefs,
    tileEdgeDataDefinitionRefs,
    sharedEdges,
    sharedPoints,
    ...(storedTileProperties.length ? { tileProperties: storedTileProperties } : {}),
    ...(storedTileEdgeProperties.length ? { tileEdgeProperties: storedTileEdgeProperties } : {}),
    ...(map.markers ? { markers: cloneJson(map.markers) } : {}),
    ...(map.metadata ? { metadata: cloneJson(map.metadata) } : {}),
  };
};

const applyEdgeProperties = <T extends object>(target: T, properties?: DungeonMapStoredEdgeProperties): T => {
  if (!properties) return target;
  return Object.assign(target, cloneJson(properties));
};

export const decodeDungeonMapData = (stored: DungeonMapStoredData): DungeonMapData => {
  if (!isDungeonMapDefinitionRefsData(stored)) return cloneJson(stored);
  const expectedTiles = stored.width * stored.height;
  if (stored.tileDataDefinitionRefs.length !== expectedTiles
    || stored.tileEdgeDataDefinitionRefs.some((layer) => layer.length !== expectedTiles)) {
    throw new Error(`地图 ${stored.id} 的格子或单格边引用数组长度不正确。`);
  }
  const tilePropertyMap = new Map(stored.tileProperties ?? []);
  const tileEdgePropertyMap = new Map(stored.tileEdgeProperties ?? []);
  const tiles = Array.from({ length: expectedTiles }, (_, tileIndex) => {
    const x = tileIndex % stored.width;
    const y = Math.floor(tileIndex / stored.width);
    const position = `${x},${y}`;
    const edges = Object.fromEntries(DIRECTIONS.map((direction, directionIndex) => {
      const instanceId = `tile:${position}:${direction}`;
      const edge = applyEdgeProperties({
        id: instanceId,
        coordinates: { type: 'tile-edge' as const, x, y, direction },
        data: decodeDefinition(stored, stored.tileEdgeDataDefinitionRefs[directionIndex][tileIndex], {
          instanceId,
          defaultEntityName: `单格边 ${position},${direction}`,
        }),
      }, tileEdgePropertyMap.get(tileIndex * 4 + directionIndex));
      return [direction, edge];
    })) as DungeonMapData['tiles'][number]['edges'];
    return {
      x,
      y,
      coordinates: { type: 'tile' as const, x, y },
      edges,
      data: decodeDefinition(stored, stored.tileDataDefinitionRefs[tileIndex], {
        instanceId: `tile:${position}`,
        defaultEntityName: `格子 ${position}`,
      }),
      ...cloneJson(tilePropertyMap.get(tileIndex) ?? {}),
    };
  });
  const sharedEdges = stored.sharedEdges.map(([id, first, second, ref, properties]) => {
    const firstEndpoint = { x: first[0], y: first[1], direction: DIRECTIONS[first[2]] };
    const secondEndpoint = second
      ? { x: second[0], y: second[1], direction: DIRECTIONS[second[2]] }
      : undefined;
    const sides = secondEndpoint ? [firstEndpoint, secondEndpoint] as const : [firstEndpoint] as const;
    return {
      id,
      sides,
      edge: applyEdgeProperties({
        id,
        coordinates: { type: 'shared-edge' as const, sides },
        data: decodeDefinition(stored, ref, {
          instanceId: id,
          defaultEntityName: '公用边实体',
          generatedLabel: `公用边 ${firstEndpoint.x},${firstEndpoint.y},${firstEndpoint.direction}`,
        }),
      }, properties),
    };
  });
  const sharedPoints = stored.sharedPoints.map(([id, gridX, gridY, positions, sides, ref, pointId]) => {
    const resolvedPositions = positions.map(([positionX, positionY]) => ({ gridX: positionX, gridY: positionY }));
    const resolvedSides = sides.map(([x, y, corner]) => ({ x, y, corner: CORNERS[corner] })) as unknown as DungeonMapSharedPointSides;
    return {
      id,
      gridX,
      gridY,
      positions: resolvedPositions,
      sides: resolvedSides,
      point: {
        id: pointId ?? id,
        coordinates: { type: 'shared-point' as const, gridX, gridY, positions: resolvedPositions },
        data: decodeDefinition(stored, ref, {
          instanceId: id,
          defaultEntityName: '公用点实体',
          generatedLabel: `公用点 ${gridX},${gridY}`,
        }),
      },
    };
  });
  return {
    id: stored.id,
    coordinates: { type: 'map', x: 0, y: 0, width: stored.width, height: stored.height },
    width: stored.width,
    height: stored.height,
    ...(stored.topologyMode ? { topologyMode: stored.topologyMode } : {}),
    data: decodeDefinition(stored, stored.mapDataDefinitionRef, {
      instanceId: stored.id,
      defaultEntityName: '地图实体',
    }),
    tiles,
    sharedEdges,
    sharedPoints,
    ...(stored.markers ? { markers: cloneJson(stored.markers) } : {}),
    ...(stored.metadata ? { metadata: cloneJson(stored.metadata) } : {}),
  };
};

export const encodeDungeonMapPreset = (preset: DungeonMapPreset): DungeonMapStoredPreset => ({
  presetKey: preset.presetKey,
  name: preset.name,
  map: encodeDungeonMapData(preset.map),
});

export const decodeDungeonMapPreset = (preset: DungeonMapStoredPreset): DungeonMapPreset => ({
  presetKey: preset.presetKey,
  name: preset.name,
  map: decodeDungeonMapData(preset.map),
});

export const encodeDungeonMapPresetLibrary = (
  library: DungeonMapPresetLibrary,
): DungeonMapStoredPresetLibrary => Object.fromEntries(Object.entries(library).map(([key, preset]) => [
  key,
  encodeDungeonMapPreset(preset),
]));

export const decodeDungeonMapPresetLibrary = (
  library: DungeonMapStoredPresetLibrary,
): DungeonMapPresetLibrary => Object.fromEntries(Object.entries(library).map(([key, preset]) => [
  key,
  decodeDungeonMapPreset(preset),
]));
