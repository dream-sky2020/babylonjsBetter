import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createDungeonMapData,
  validateDungeonMapData,
  type DungeonMapData,
  type DungeonMapDirection,
  type DungeonMapEdge,
  type DungeonMapSharedEdge,
  type DungeonMapSharedPoint,
  type DungeonMapTile,
  type DungeonMapTopologyMode,
} from '@/core/map';
import {
  ComponentRegistry,
  EntityTypeRegistry,
  createEntity,
  normalizeEntityContainer,
  type ComponentDefinition,
  type ComponentFieldSchema,
  type EntityContainerKind,
  type EntityTypeDefinition,
  type IComponent,
  type IEntity,
  type IEntityContainer,
} from '@/core/entity';
import { DungeonMapCanvas, type DungeonMapSelection, type DungeonMapSelectionMode } from '@/core/ui/DungeonMapCanvas';
import './dungeon-map-canvas-lab.css';

const PATTERN_MODULES = import.meta.glob('/public/resources/dungeon-map/**/*.svg', {
  eager: true, query: '?url', import: 'default'
}) as Record<string, string>;
const COMPONENT_MODULES = import.meta.glob('/core/entity/components/*.component.ts', {
  eager: true, import: 'componentDefinition'
}) as Record<string, ComponentDefinition>;
const ENTITY_TYPE_MODULES = import.meta.glob('/core/entity/entity-types/*.entity-type.ts', {
  eager: true, import: 'entityTypeDefinition'
}) as Record<string, EntityTypeDefinition>;
const COMPONENT_REGISTRY = new ComponentRegistry();
Object.values(COMPONENT_MODULES).forEach((definition) => COMPONENT_REGISTRY.register(definition));
const COMPONENT_DEFINITIONS = COMPONENT_REGISTRY.list();
const ENTITY_TYPE_REGISTRY = new EntityTypeRegistry();
Object.values(ENTITY_TYPE_MODULES).forEach((definition) => ENTITY_TYPE_REGISTRY.register(definition));
const ENTITY_TYPE_DEFINITIONS = ENTITY_TYPE_REGISTRY.list();
type PatternKind = 'walls' | 'tiles' | 'characters' | 'events' | 'edges' | 'shared-edges' | 'shared-points';
const PATTERN_LABELS: Record<PatternKind, string> = { walls: '墙壁格', tiles: '地面格', characters: '角色', events: '事件', edges: '单格边', 'shared-edges': '公用边', 'shared-points': '公用点' };
const patternOptions = (kind: PatternKind) => Object.entries(PATTERN_MODULES)
  .filter(([path]) => path.includes(`/dungeon-map/${kind}/`))
  .map(([path, url]) => ({ label: path.split('/').pop()?.replace(/\.svg$/i, '') ?? path, url }))
  .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));

type PatternSuite = {
  name: string;
  wall?: string;
  floor?: string;
  edge?: string;
  sharedEdge?: string;
  sharedPoint?: string;
};

const patternSuites = (): PatternSuite[] => {
  const suites = new Map<string, PatternSuite>();
  const targetByKind: Partial<Record<PatternKind, keyof Omit<PatternSuite, 'name'>>> = {
    walls: 'wall', tiles: 'floor', edges: 'edge',
    'shared-edges': 'sharedEdge', 'shared-points': 'sharedPoint',
  };
  Object.entries(PATTERN_MODULES).forEach(([path, url]) => {
    const match = path.match(/\/dungeon-map\/([^/]+)\/([^/]+)套装-[^/]+\.svg$/i);
    if (!match) return;
    const kind = match[1] as PatternKind;
    const target = targetByKind[kind];
    if (!target) return;
    const name = match[2];
    const suite = suites.get(name) ?? { name };
    suite[target] = url;
    suites.set(name, suite);
  });
  return [...suites.values()]
    .filter((suite) => suite.floor && suite.sharedEdge && suite.sharedPoint)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
};

const MAP_ROWS = [
  '#############',
  '#.....#.....#',
  '#.###.#.###.#',
  '#.#...D...#.#',
  '#.#.#####.#.#',
  '....#...#....',
  '###.#.^.#.###',
  '#...#...#...#',
  '#.#####.###.#',
  '#.....D.....#',
  '#############'
] as const;

const TILE_BY_CHARACTER: Record<string, Omit<DungeonMapTile, 'x' | 'y'>> = {
  '#': { kind: 'wall', edges: { north: { kind: 'wall' }, east: { kind: 'wall' }, south: { kind: 'wall' }, west: { kind: 'wall' } } },
  '.': { kind: 'floor', edges: { north: { kind: 'open' }, east: { kind: 'open' }, south: { kind: 'open' }, west: { kind: 'open' } } },
  D: { kind: 'floor', label: '门旁地面', edges: { north: { kind: 'open' }, east: { kind: 'open' }, south: { kind: 'open' }, west: { kind: 'open' } } },
  '^': { kind: 'stairs-up', label: '上行楼梯', edges: { north: { kind: 'open' }, east: { kind: 'open' }, south: { kind: 'open' }, west: { kind: 'open' } } }
};
const EXPLICIT_DOOR_EDGES = new Set(['5,3,east', '6,3,west', '5,9,east', '6,9,west']);
const EXPLICIT_WALL_EDGES = new Set(['2,1,east', '3,1,west']);
const EXPLICIT_LOOP_EDGES = new Set(['0,5,west', '12,5,east']);
const SPECIAL_SHARED_EDGE_POSITIONS = new Set([
  '2,1,east', '5,3,east', '5,2,east', '5,2,south', '6,2,south',
  '1,1,south', '9,1,south', '3,3,east', '9,9,east', '6,8,south',
]);
const DIRECTIONS: DungeonMapDirection[] = ['north', 'east', 'south', 'west'];
const DIRECTION_LABEL: Record<DungeonMapDirection, string> = { north: '北', east: '东', south: '南', west: '西' };
const VECTOR: Record<DungeonMapDirection, { x: number; y: number }> = {
  north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 }
};

const createEdge = (x: number, y: number, direction: DungeonMapDirection): DungeonMapEdge => {
  const key = `${x},${y},${direction}`;
  if (key === '1,1,east') {
    return { kind: 'open', events: [{ id: 'leave-start', type: 'tutorial-step', trigger: 'leave', once: true }] };
  }
  if (EXPLICIT_LOOP_EDGES.has(key)) {
    return { kind: 'open', label: '循环出口', events: [{ id: `loop-${key}`, type: 'map-loop', trigger: 'cross' }] };
  }
  if (EXPLICIT_DOOR_EDGES.has(key)) {
    return { kind: 'door', label: '木门', events: [{ id: `door-${key}`, type: 'door-contact', trigger: 'interact' }] };
  }
  if (EXPLICIT_WALL_EDGES.has(key)) return { kind: 'wall', label: '格间墙' };
  const vector = VECTOR[direction];
  const neighborX = x + vector.x;
  const neighborY = y + vector.y;
  const current = MAP_ROWS[y]?.[x];
  const neighbor = MAP_ROWS[neighborY]?.[neighborX];
  if (!neighbor || current === '#' || neighbor === '#') return { kind: 'wall' };
  return { kind: 'open' };
};

const BASE_TILES: DungeonMapTile[] = MAP_ROWS.flatMap((row, y) => [...row].map((character, x) => ({
  ...(TILE_BY_CHARACTER[character] ?? TILE_BY_CHARACTER['#']),
  edges: {
    north: createEdge(x, y, 'north'),
    east: createEdge(x, y, 'east'),
    south: createEdge(x, y, 'south'),
    west: createEdge(x, y, 'west')
  }
})));

const legacyEntityContainer = (
  id: string,
  name: string,
  data: Record<string, unknown>,
  entityType: string,
): IEntityContainer => normalizeEntityContainer(data, id, name, entityType);

const valueAtPath = (value: unknown, path: string): unknown => path.split('.').reduce<unknown>(
  (current, key) => current && typeof current === 'object'
    ? (current as Record<string, unknown>)[key]
    : undefined,
  value,
);

const valueWithPath = <T extends object>(source: T, path: string, value: unknown): T => {
  const result = { ...source } as Record<string, unknown>;
  const keys = path.split('.');
  let cursor = result;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      if (value === undefined || value === '') delete cursor[key];
      else cursor[key] = value;
      return;
    }
    const child = cursor[key];
    cursor[key] = child && typeof child === 'object' && !Array.isArray(child)
      ? { ...(child as Record<string, unknown>) }
      : {};
    cursor = cursor[key] as Record<string, unknown>;
  });
  return result as T;
};

export const DungeonMapCanvasLab: React.FC = () => {
  const [cellSize, setCellSize] = useState(64);
  const [canvasOuterPadding, setCanvasOuterPadding] = useState(48);
  const [minCanvasWidth, setMinCanvasWidth] = useState(800);
  const [minCanvasHeight, setMinCanvasHeight] = useState(640);
  const [mapWidth, setMapWidth] = useState<number>(MAP_ROWS[0].length);
  const [mapHeight, setMapHeight] = useState<number>(MAP_ROWS.length);
  const [topologyMode, setTopologyMode] = useState<DungeonMapTopologyMode>('bounded');
  const [mapScale, setMapScale] = useState(1);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const [mapViewportSize, setMapViewportSize] = useState({ width: 0, height: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [fogEnabled, setFogEnabled] = useState(true);
  const [visited] = useState(() => new Set(['1,1']));
  const options = useMemo(() => ({ walls: patternOptions('walls'), tiles: patternOptions('tiles'), characters: patternOptions('characters'), events: patternOptions('events'), edges: patternOptions('edges'), sharedEdges: patternOptions('shared-edges'), sharedPoints: patternOptions('shared-points') }), []);
  const suites = useMemo(() => patternSuites(), []);
  const minimalSuite = suites.find((suite) => suite.name === '极简');
  const [selectedSuite, setSelectedSuite] = useState(minimalSuite?.name ?? '');
  const [patterns, setPatterns] = useState(() => ({
    wall: minimalSuite?.wall ?? patternOptions('walls')[0]?.url ?? '', floor: minimalSuite?.floor ?? patternOptions('tiles')[0]?.url ?? '',
    player: patternOptions('characters')[0]?.url ?? '', event: patternOptions('events')[0]?.url ?? '',
    edgeNorth: minimalSuite?.edge ?? patternOptions('edges')[0]?.url ?? '', edgeEast: minimalSuite?.edge ?? patternOptions('edges')[0]?.url ?? '',
    edgeSouth: minimalSuite?.edge ?? patternOptions('edges')[0]?.url ?? '', edgeWest: minimalSuite?.edge ?? patternOptions('edges')[0]?.url ?? '',
    sharedEdge: minimalSuite?.sharedEdge ?? patternOptions('shared-edges')[0]?.url ?? '',
    sharedPoint: minimalSuite?.sharedPoint ?? patternOptions('shared-points')[0]?.url ?? ''
  }));
  const [edgeEditMode, setEdgeEditMode] = useState<'linked' | 'individual'>('linked');
  const [edgeThicknessRatio, setEdgeThicknessRatio] = useState(0.12);
  const [sharedEdgeThicknessRatio, setSharedEdgeThicknessRatio] = useState(0.24);
  const [selectedDirection, setSelectedDirection] = useState<DungeonMapDirection>('east');
  const [mapDataEdits, setMapDataEdits] = useState<IEntityContainer>();
  const [tileDataEdits, setTileDataEdits] = useState<Record<string, IEntityContainer>>({});
  const [tileEdgeDataEdits, setTileEdgeDataEdits] = useState<Record<string, IEntityContainer>>({});
  const [sharedEdgeEdits, setSharedEdgeEdits] = useState<Record<string, DungeonMapSharedEdge>>({});
  const [sharedPointEdits, setSharedPointEdits] = useState<Record<string, DungeonMapSharedPoint>>({});
  const [selectionMode, setSelectionMode] = useState<DungeonMapSelectionMode>('tile');
  const [canvasSelections, setCanvasSelections] = useState<DungeonMapSelection[]>([{ mode: 'tile', x: 1, y: 1 }]);
  const canvasSelection = canvasSelections[0];
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [componentTypeToAdd, setComponentTypeToAdd] = useState(COMPONENT_DEFINITIONS[0]?.type ?? '');
  const [entityTypeToAdd, setEntityTypeToAdd] = useState(ENTITY_TYPE_DEFINITIONS[0]?.type ?? '');
  const [entityViewMode, setEntityViewMode] = useState<'all' | 'select'>('select');
  const [componentViewMode, setComponentViewMode] = useState<'all' | 'select'>('select');
  const [collapsedEntityIds, setCollapsedEntityIds] = useState<Set<string>>(() => new Set());
  const [collapsedComponentIds, setCollapsedComponentIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport) return;
    const updateSize = () => setMapViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const fittedMapScale = useMemo(() => {
    const sharedThickness = Math.max(0, cellSize * sharedEdgeThicknessRatio);
    const gap = sharedThickness > 0 ? sharedThickness + Math.max(2, cellSize * 0.04) : 0;
    const topologyMargin = sharedThickness > 0 ? gap : 0;
    const naturalWidth = mapWidth * cellSize + Math.max(0, mapWidth - 1) * gap + topologyMargin * 2 + canvasOuterPadding * 2;
    const naturalHeight = mapHeight * cellSize + Math.max(0, mapHeight - 1) * gap + topologyMargin * 2 + canvasOuterPadding * 2;
    const width = Math.max(naturalWidth, minCanvasWidth);
    const height = Math.max(naturalHeight, minCanvasHeight);
    if (!mapViewportSize.width || !mapViewportSize.height) return 1;
    return Math.max(0.05, Math.min(mapViewportSize.width / width, mapViewportSize.height / height));
  }, [canvasOuterPadding, cellSize, mapHeight, mapViewportSize, mapWidth, minCanvasHeight, minCanvasWidth, sharedEdgeThicknessRatio]);

  const updateMapWidth = (width: number) => {
    setMapWidth(width);
    setCanvasSelections((current) => current.map((selection) => ({
      ...selection,
      x: Math.min(selection.mode === 'point' ? width : width - 1, selection.x),
      sharedEdgeId: undefined,
      sharedPointId: undefined,
    })));
  };

  const updateMapHeight = (height: number) => {
    setMapHeight(height);
    setCanvasSelections((current) => current.map((selection) => ({
      ...selection,
      y: Math.min(selection.mode === 'point' ? height : height - 1, selection.y),
      sharedEdgeId: undefined,
      sharedPointId: undefined,
    })));
  };

  const updateTopologyMode = (mode: DungeonMapTopologyMode) => {
    setTopologyMode(mode);
    setCanvasSelections((current) => current.map((selection) => ({
      ...selection,
      sharedEdgeId: undefined,
      sharedPointId: undefined,
    })));
  };

  const map = useMemo<DungeonMapData>(() => {
    const visitedPositions = [...visited].map((key) => key.split(',').map(Number));
    const isRevealed = (x: number, y: number) => !fogEnabled || visitedPositions.some(
      ([visitedX, visitedY]) => Math.abs(visitedX - x) + Math.abs(visitedY - y) <= 1
    );
    const generatedTopology = createDungeonMapData({
      id: 'forgotten-corridor-b1-generated-topology',
      width: mapWidth,
      height: mapHeight,
      mode: topologyMode,
      createMapData: () => mapDataEdits ?? legacyEntityContainer(
        'map:forgotten-corridor-b1:entity', '地图实体',
        { legacy: { name: '遗忘回廊', floor: 'B1' } },
        'map',
      ),
      createTileData: ({ x, y }) => tileDataEdits[`${x},${y}`] ?? legacyEntityContainer(
        `tile:${x},${y}:entity`, `格子 ${x},${y}`,
        { legacy: { kind: MAP_ROWS[y]?.[x] === '#' ? 'wall' : 'floor' } },
        'tile',
      ),
      createTileEdgeData: ({ x, y, direction }) => tileEdgeDataEdits[`${x},${y},${direction}`] ?? legacyEntityContainer(
        `tile:${x},${y}:${direction}:entity`, `单格边 ${x},${y},${direction}`,
        { legacy: { kind: 'open' } },
        'tile-edge',
      ),
      createSharedEdgeData: ({ first }) => legacyEntityContainer(
        `shared:${first.x},${first.y}:${first.direction}:entity`, '公用边实体', {
          legacy: {
          kind: 'open',
          label: `自动公用边 ${first.x},${first.y},${first.direction}`,
          },
        },
        'shared-edge',
      ),
      createSharedPointData: ({ gridX, gridY }) => legacyEntityContainer(
        `point:${gridX},${gridY}:entity`, '公用点实体',
        { legacy: { label: `公用点 ${gridX},${gridY}` } },
        'shared-point',
      ),
    });
    const generatedSharedEdges = generatedTopology.sharedEdges?.filter((edge) => {
      const side = edge.sides[0];
      return !SPECIAL_SHARED_EDGE_POSITIONS.has(`${side.x},${side.y},${side.direction}`);
    }) ?? [];
    const generatedSharedPoints = generatedTopology.sharedPoints?.map(
      (point) => sharedPointEdits[point.id] ?? point,
    ) ?? [];
    const usesGeneratedConfiguration = topologyMode === 'loop'
      || mapWidth !== MAP_ROWS[0].length
      || mapHeight !== MAP_ROWS.length;
    if (usesGeneratedConfiguration) {
      return {
        ...generatedTopology,
        id: 'configurable-dungeon-map',
        sharedEdges: generatedTopology.sharedEdges?.map(
          (edge) => sharedEdgeEdits[edge.id] ?? edge,
        ),
        sharedPoints: generatedSharedPoints,
        data: generatedTopology.data,
      };
    }
    return {
      id: 'forgotten-corridor-b1',
      width: MAP_ROWS[0].length,
      height: MAP_ROWS.length,
      tiles: BASE_TILES.map((baseTile, index) => {
        const tile = baseTile;
        const x = index % MAP_ROWS[0].length;
        const y = Math.floor(index / MAP_ROWS[0].length);
        const legacyTile = tile as DungeonMapTile & { data?: unknown };
        return {
          ...tile,
          x,
          y,
          discovered: isRevealed(x, y),
          data: tileDataEdits[`${x},${y}`] ?? normalizeEntityContainer(
            legacyTile.data ?? { legacy: { kind: tile.kind, label: tile.label, walkable: tile.walkable } },
            `tile:${x},${y}:entity`, `格子 ${x},${y}`,
            'tile',
          ),
          edges: Object.fromEntries(DIRECTIONS.map((direction) => {
            const edge = tile.edges[direction] as DungeonMapEdge & { data?: unknown };
            return [direction, {
              ...edge,
              data: tileEdgeDataEdits[`${x},${y},${direction}`] ?? normalizeEntityContainer(
                edge.data ?? { legacy: { kind: edge.kind, label: edge.label, passable: edge.passable } },
                `tile:${x},${y}:${direction}:entity`, `单格边 ${x},${y},${direction}`,
                'tile-edge',
              ),
            }];
          })) as DungeonMapTile['edges'],
        };
      }),
      sharedEdges: [...generatedSharedEdges,
        {
          id: 'shared-room-wall',
          sides: [{ x: 2, y: 1, direction: 'east' }, { x: 3, y: 1, direction: 'west' }],
          edge: { kind: 'wall', label: '公用格间墙', metadata: { shared: true } }
        },
        {
          id: 'shared-upper-door',
          sides: [{ x: 5, y: 3, direction: 'east' }, { x: 6, y: 3, direction: 'west' }],
          edge: { kind: 'door', label: '公用木门', events: [{ id: 'shared-upper-door-contact', type: 'door-contact', trigger: 'interact' }] }
        },
        {
          id: 'shared-cross-up',
          sides: [{ x: 5, y: 2, direction: 'east' }, { x: 6, y: 2, direction: 'west' }],
          edge: { kind: 'wall', label: '十字测试·上', metadata: { shared: true, crossTest: true } }
        },
        {
          id: 'shared-cross-left',
          sides: [{ x: 5, y: 2, direction: 'south' }, { x: 5, y: 3, direction: 'north' }],
          edge: { kind: 'wall', label: '十字测试·左', metadata: { shared: true, crossTest: true } }
        },
        {
          id: 'shared-cross-right',
          sides: [{ x: 6, y: 2, direction: 'south' }, { x: 6, y: 3, direction: 'north' }],
          edge: { kind: 'wall', label: '十字测试·右', metadata: { shared: true, crossTest: true } }
        },
        {
          id: 'shared-start-south-wall',
          sides: [{ x: 1, y: 1, direction: 'south' }, { x: 1, y: 2, direction: 'north' }],
          edge: { kind: 'wall', label: '起点南侧公用墙', metadata: { shared: true } }
        },
        {
          id: 'shared-east-vertical-wall',
          sides: [{ x: 9, y: 1, direction: 'south' }, { x: 9, y: 2, direction: 'north' }],
          edge: { kind: 'wall', label: '东侧纵向公用墙', metadata: { shared: true } }
        },
        {
          id: 'shared-center-door',
          sides: [{ x: 3, y: 3, direction: 'east' }, { x: 4, y: 3, direction: 'west' }],
          edge: { kind: 'door', label: '中央公用门', events: [{ id: 'shared-center-door-contact', type: 'door-contact', trigger: 'interact' }] }
        },
        {
          id: 'shared-lower-wall',
          sides: [{ x: 9, y: 9, direction: 'east' }, { x: 10, y: 9, direction: 'west' }],
          edge: { kind: 'wall', label: '下层公用墙', metadata: { shared: true } }
        },
        {
          id: 'shared-lower-vertical-door',
          sides: [{ x: 6, y: 8, direction: 'south' }, { x: 6, y: 9, direction: 'north' }],
          edge: { kind: 'door', label: '下层纵向公用门', events: [{ id: 'shared-lower-vertical-door-contact', type: 'door-contact', trigger: 'interact' }] }
        }
      ]
        .map((edge) => sharedEdgeEdits[edge.id] ?? edge)
        .map((sharedEdge) => {
          const edge = sharedEdge.edge as DungeonMapEdge & { data?: unknown };
          return {
            ...sharedEdge,
            edge: {
              ...edge,
              data: normalizeEntityContainer(
                edge.data ?? { legacy: { kind: edge.kind, label: edge.label, passable: edge.passable } },
                `${sharedEdge.id}:entity`, '公用边实体',
                'shared-edge',
              ),
            },
          };
        }),
      sharedPoints: generatedSharedPoints,
      data: mapDataEdits ?? generatedTopology.data,
      markers: [
        { id: 'goal', x: 6, y: 6, label: '出口', color: '#ffd166', shape: 'diamond', visible: isRevealed(6, 6) },
        { id: 'event', x: 10, y: 9, label: '事件', color: '#ff6b9a', visible: isRevealed(10, 9) }
      ],
      metadata: { floor: 'B1', name: '遗忘回廊' }
    };
  }, [fogEnabled, visited, mapWidth, mapHeight, topologyMode, mapDataEdits, tileDataEdits, tileEdgeDataEdits, sharedEdgeEdits, sharedPointEdits]);

  const validationIssues = useMemo(() => validateDungeonMapData(map), [map]);
  const canvasSelectedTile = map.tiles[canvasSelection.y * map.width + canvasSelection.x];
  const canvasSelectionDirection = canvasSelection.direction ?? selectedDirection;
  // 公用边编辑只认 Canvas 精确命中后返回的 ID，禁止按附近格子猜测目标。
  const canvasSelectedSharedEdge = map.sharedEdges?.find(
    (edge) => edge.id === canvasSelection.sharedEdgeId,
  );
  const canvasSelectedSharedPoint = map.sharedPoints?.find(
    (point) => point.id === canvasSelection.sharedPointId,
  );
  const rawSelectedContainerData = (
    canvasSelection.mode === 'map'
      ? map.data
      : canvasSelection.mode === 'tile'
      ? canvasSelectedTile?.data
      : canvasSelection.mode === 'edge'
        ? canvasSelectedTile?.edges[canvasSelectionDirection]?.data
        : canvasSelection.mode === 'shared'
          ? canvasSelectedSharedEdge?.edge.data
          : canvasSelectedSharedPoint?.point.data
  ) as unknown;
  const selectionHasTarget = canvasSelection.mode === 'map'
    ? true
    : canvasSelection.mode === 'shared'
    ? Boolean(canvasSelectedSharedEdge)
    : canvasSelection.mode === 'point'
      ? Boolean(canvasSelectedSharedPoint)
      : true;
  const selectionHostId = canvasSelection.mode === 'map'
    ? map.id
    : canvasSelection.mode === 'shared'
    ? canvasSelectedSharedEdge?.id ?? 'missing-shared-edge'
    : canvasSelection.mode === 'point'
      ? canvasSelectedSharedPoint?.id ?? 'missing-shared-point'
      : `${canvasSelection.mode}:${canvasSelection.x},${canvasSelection.y}:${canvasSelectionDirection}`;
  const selectedContainerKind: EntityContainerKind = canvasSelection.mode === 'map'
    ? 'map'
    : canvasSelection.mode === 'tile'
      ? 'tile'
      : canvasSelection.mode === 'edge'
        ? 'tile-edge'
        : canvasSelection.mode === 'shared'
          ? 'shared-edge'
          : 'shared-point';
  const selectedContainerData = selectionHasTarget
    ? normalizeEntityContainer(rawSelectedContainerData, `${selectionHostId}:entity`, '地图实体', selectedContainerKind)
    : undefined;
  const availableEntityDefinitions = ENTITY_TYPE_REGISTRY.listForContainer(selectedContainerKind);
  const effectiveEntityTypeToAdd = availableEntityDefinitions.some((definition) => definition.type === entityTypeToAdd)
    ? entityTypeToAdd
    : availableEntityDefinitions[0]?.type ?? '';
  const selectedEntity = selectedContainerData?.entities.find((entity) => entity.id === selectedEntityId)
    ?? selectedContainerData?.entities[0];

  const changeSelectionMode = (mode: DungeonMapSelectionMode) => {
    setSelectionMode(mode);
    if (mode === 'all') {
      setCanvasSelections((currentSelections) => {
        const current = currentSelections[0];
        return current?.mode === 'map'
          ? [{ mode: 'tile', x: 0, y: 0 }]
          : currentSelections;
      });
      return;
    }
    setCanvasSelections((currentSelections) => {
      const current: DungeonMapSelection = currentSelections[0] ?? { mode: 'tile', x: 0, y: 0 };
      if (mode === 'map') return [{ mode, x: 0, y: 0 }];
      if (mode === 'tile') return [{ mode, x: current.x, y: current.y }];
      if (mode === 'point') return [{ mode, x: current.x, y: current.y }];
      const direction = current.direction ?? selectedDirection;
      if (mode === 'edge') return [{ mode, x: current.x, y: current.y, direction }];
      const sharedEdge = map.sharedEdges?.find((edge) => edge.sides.some((side) =>
        side.x === current.x && side.y === current.y && side.direction === direction
      ));
      const next: DungeonMapSelection = {
        mode,
        x: current.x,
        y: current.y,
        direction,
        sharedEdgeId: sharedEdge?.id,
      };
      return [next];
    });
  };

  const updateCanvasSelectionData = (
    updater: (data: IEntityContainer) => IEntityContainer,
  ) => {
    if (!selectionHasTarget) return;
    if (canvasSelection.mode === 'map') {
      setMapDataEdits(updater(normalizeEntityContainer(map.data, `${map.id}:entity`, '地图实体', 'map')));
      return;
    }
    if (canvasSelection.mode === 'point') {
      if (!canvasSelectedSharedPoint) return;
      const next = {
        ...canvasSelectedSharedPoint,
        point: {
          ...canvasSelectedSharedPoint.point,
          data: updater(normalizeEntityContainer(canvasSelectedSharedPoint.point.data, `${canvasSelectedSharedPoint.id}:entity`, '公用点实体', 'shared-point')),
        },
      };
      setSharedPointEdits((edits) => ({ ...edits, [next.id]: next }));
      return;
    }
    if (canvasSelection.mode === 'shared') {
      if (!canvasSelectedSharedEdge) return;
      const next = {
        ...canvasSelectedSharedEdge,
        edge: {
          ...canvasSelectedSharedEdge.edge,
          data: updater(normalizeEntityContainer(canvasSelectedSharedEdge.edge.data, `${canvasSelectedSharedEdge.id}:entity`, '公用边实体', 'shared-edge')),
        },
      };
      setSharedEdgeEdits((edits) => ({ ...edits, [next.id]: next }));
      return;
    }

    if (canvasSelection.mode === 'tile') {
      const key = `${canvasSelection.x},${canvasSelection.y}`;
      setTileDataEdits((edits) => ({
        ...edits,
        [key]: updater(normalizeEntityContainer(canvasSelectedTile?.data, `tile:${key}:entity`, `格子 ${key}`, 'tile')),
      }));
      return;
    }
    const direction = canvasSelectionDirection;
    const key = `${canvasSelection.x},${canvasSelection.y},${direction}`;
    setTileEdgeDataEdits((edits) => ({
      ...edits,
      [key]: updater(normalizeEntityContainer(canvasSelectedTile?.edges[direction]?.data, `tile-edge:${key}:entity`, `单格边 ${key}`, 'tile-edge')),
    }));
  };

  const updateEntityById = (entityId: string, updater: (entity: IEntity) => IEntity) => {
    updateCanvasSelectionData((container) => ({
      ...container,
      entities: container.entities.map((entity) => entity.id === entityId ? updater(entity) : entity),
    }));
  };

  const addEntityToSelection = () => {
    const definition = ENTITY_TYPE_REGISTRY.get(effectiveEntityTypeToAdd);
    if (!definition || !ENTITY_TYPE_REGISTRY.canCreateIn(definition.type, selectedContainerKind)) return;
    if (definition.allowMultiplePerContainer === false
      && selectedContainerData?.entities.some((entity) => entity.entityType === definition.type)) return;
    const entity = createEntity(definition.label, definition.type);
    const initialComponentTypes = [...new Set([
      ...(definition.defaultComponents ?? []),
      ...(definition.requiredComponents ?? []),
    ])];
    entity.components = initialComponentTypes.flatMap((componentType) => {
      const componentDefinition = COMPONENT_REGISTRY.get(componentType);
      return componentDefinition && COMPONENT_REGISTRY.canAttachTo(componentType, entity.entityType)
        ? [componentDefinition.createDefault()]
        : [];
    });
    updateCanvasSelectionData((container) => ({ ...container, entities: [...container.entities, entity] }));
    setCollapsedEntityIds((ids) => {
      const next = new Set(ids);
      next.delete(entity.id);
      return next;
    });
    setSelectedEntityId(entity.id);
    setSelectedComponentId('');
  };

  const removeEntityById = (entityId: string) => {
    updateCanvasSelectionData((container) => ({
      ...container,
      entities: container.entities.filter((entity) => entity.id !== entityId),
    }));
    setSelectedEntityId('');
    setSelectedComponentId('');
  };

  const addComponentToEntity = (entityId = selectedEntity?.id, requestedType = componentTypeToAdd) => {
    if (!entityId) return;
    const entity = selectedContainerData?.entities.find((item) => item.id === entityId);
    if (!entity) return;
    const definition = COMPONENT_REGISTRY.get(requestedType);
    if (!definition || !COMPONENT_REGISTRY.canAttachTo(definition.type, entity.entityType)) return;
    if (!definition.allowMultiple && entity.components.some((component) => component.type === definition.type)) return;
    const component = definition.createDefault();
    updateEntityById(entityId, (current) => ({ ...current, components: [...current.components, component] }));
    setCollapsedComponentIds((ids) => {
      const next = new Set(ids);
      next.delete(component.id);
      return next;
    });
    setSelectedEntityId(entityId);
    setSelectedComponentId(component.id);
  };

  const updateComponentById = (entityId: string, componentId: string, updater: (component: IComponent) => IComponent) => {
    updateEntityById(entityId, (entity) => ({
      ...entity,
      components: entity.components.map((component) => component.id === componentId ? updater(component) : component),
    }));
  };

  const removeComponentById = (entityId: string, componentId: string) => {
    const entity = selectedContainerData?.entities.find((item) => item.id === entityId);
    const component = entity?.components.find((item) => item.id === componentId);
    const requiredComponents = entity ? ENTITY_TYPE_REGISTRY.get(entity.entityType)?.requiredComponents ?? [] : [];
    if (component && requiredComponents.includes(component.type)) return;
    updateEntityById(entityId, (entity) => ({
      ...entity,
      components: entity.components.filter((component) => component.id !== componentId),
    }));
    setSelectedComponentId('');
  };

  const reset = () => {
    setMapDataEdits(undefined); setTileDataEdits({}); setTileEdgeDataEdits({}); setSharedEdgeEdits({}); setSharedPointEdits({});
  };

  const visibleEntities = entityViewMode === 'all'
    ? selectedContainerData?.entities ?? []
    : selectedEntity ? [selectedEntity] : [];

  const toggleCollapsedId = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) => setter((ids) => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const renderComponentCard = (entity: IEntity, component: IComponent) => {
    const definition = COMPONENT_REGISTRY.get(component.type);
    const entityDefinition = ENTITY_TYPE_REGISTRY.get(entity.entityType);
    const isRequired = entityDefinition?.requiredComponents?.includes(component.type) === true;
    const isAllowed = definition ? COMPONENT_REGISTRY.canAttachTo(component.type, entity.entityType) : false;
    const isCollapsed = collapsedComponentIds.has(component.id);
    const setField = (field: ComponentFieldSchema, value: unknown) => updateComponentById(
      entity.id, component.id, (current) => valueWithPath(current, field.path, value),
    );
    return <div className="component-card" key={component.id}>
      <div className="component-card__header"><button type="button" className="card-collapse-button" aria-expanded={!isCollapsed} onClick={() => toggleCollapsedId(setCollapsedComponentIds, component.id)}><span className="card-collapse-button__icon">{isCollapsed ? '▸' : '▾'}</span><span className="card-collapse-button__text"><strong>{definition?.label ?? component.type}</strong><small>{component.type} · v{component.version}{!isAllowed ? ' · 当前 Entity 类型不允许' : ''}</small></span></button><label className="component-enabled"><input type="checkbox" checked={component.enabled !== false} onChange={(event) => updateComponentById(entity.id, component.id, (current) => ({ ...current, enabled: event.target.checked }))} />启用</label></div>
      {!isCollapsed && (definition ? <div className="physics-fields">
        {definition.fields.map((field) => {
          const currentValue = valueAtPath(component, field.path);
          if (field.control === 'checkbox') return <label className="physics-check" key={field.path}><input type="checkbox" checked={currentValue === true} onChange={(event) => setField(field, event.target.checked)} /><span>{field.label}</span></label>;
          if (field.control === 'select') return <label key={field.path}><span>{field.label}</span><select value={String(currentValue ?? '')} onChange={(event) => setField(field, event.target.value || undefined)}>{field.optional ? <option value="">不启用</option> : null}{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
          if (field.control === 'tags') return <label key={field.path}><span>{field.label}</span><textarea rows={2} value={Array.isArray(currentValue) ? currentValue.join(', ') : ''} placeholder={field.placeholder} onChange={(event) => setField(field, event.target.value.split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean))} /></label>;
          if (field.control === 'json') return <label key={`${component.id}-${field.path}-${JSON.stringify(currentValue)}`}><span>{field.label}</span><textarea rows={4} defaultValue={currentValue === undefined ? '' : JSON.stringify(currentValue, null, 2)} placeholder={field.placeholder} onBlur={(event) => { const text = event.currentTarget.value.trim(); try { event.currentTarget.setCustomValidity(''); setField(field, text ? JSON.parse(text) : undefined); } catch { event.currentTarget.setCustomValidity('请输入合法 JSON'); event.currentTarget.reportValidity(); } }} /></label>;
          if (field.control === 'number') return <label key={field.path}><span>{field.label}</span><input type="number" min={field.min} max={field.max} step={field.step ?? 1} value={typeof currentValue === 'number' ? currentValue : ''} onChange={(event) => setField(field, event.target.value === '' ? undefined : Number(event.target.value))} /></label>;
          return <label key={field.path}><span>{field.label}</span><input value={String(currentValue ?? '')} placeholder={field.placeholder} onChange={(event) => setField(field, event.target.value || undefined)} /></label>;
        })}
      </div> : <label className="unknown-component-json"><span>未注册组件，使用原始 JSON 编辑</span><textarea key={`${component.id}-${JSON.stringify(component)}`} rows={8} defaultValue={JSON.stringify(component, null, 2)} onBlur={(event) => { try { const parsed = JSON.parse(event.currentTarget.value) as IComponent; if (!parsed.id || !parsed.type || !parsed.version) throw new Error(); event.currentTarget.setCustomValidity(''); updateComponentById(entity.id, component.id, () => parsed); } catch { event.currentTarget.setCustomValidity('必须包含合法的 id、type、version'); event.currentTarget.reportValidity(); } }} /></label>)}
      {!isCollapsed ? <button type="button" className="danger-button compact-button" disabled={isRequired} onClick={() => removeComponentById(entity.id, component.id)}>{isRequired ? '必需组件' : '删除'}</button> : null}
    </div>;
  };

  return (
    <div className="dungeon-lab">
      <aside className="dungeon-lab__panel">
        <div className="dungeon-lab__panel-scroll">
        <div>
          <p className="dungeon-lab__eyebrow">CORE UI / DATA-DRIVEN</p>
          <h1>Dungeon Map Canvas</h1>
          <p className="dungeon-lab__intro">地图拓扑数据检查、可视化与编辑工具。</p>
        </div>
        <section className="control-card">
          <div className="status-row"><span>地图结构</span><strong>{validationIssues.length === 0 ? '校验通过' : `${validationIssues.length} 项错误`}</strong></div>
          <div className="status-row"><span>公用边</span><strong>{map.sharedEdges?.length ?? 0} 条</strong></div>
          <div className="status-row"><span>公用点</span><strong>{map.sharedPoints?.length ?? 0} 个</strong></div>
          <div className="status-row"><span>当前坐标</span><strong>{canvasSelection.x}, {canvasSelection.y}</strong></div>
        </section>
        <section className="control-card controls">
          <div className="map-size-fields">
            <label>地图 X<input type="number" min="1" max="30" value={mapWidth} onChange={(event) => updateMapWidth(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} /></label>
            <label>地图 Y<input type="number" min="1" max="30" value={mapHeight} onChange={(event) => updateMapHeight(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} /></label>
          </div>
          <label>拓扑模式<select value={topologyMode} onChange={(event) => updateTopologyMode(event.target.value as DungeonMapTopologyMode)}><option value="bounded">有界模式</option><option value="loop">循环模式</option></select></label>
          <label>格子尺寸 <strong>{cellSize}px</strong><input type="range" min="24" max="128" value={cellSize} onChange={(event) => setCellSize(Number(event.target.value))} /></label>
          <label>地图外侧留白 <strong>{canvasOuterPadding}px</strong><input type="range" min="0" max="160" step="4" value={canvasOuterPadding} onChange={(event) => setCanvasOuterPadding(Number(event.target.value))} /></label>
          <div className="map-size-fields">
            <label>最小画布宽度<input type="number" min="0" max="2400" step="20" value={minCanvasWidth} onChange={(event) => setMinCanvasWidth(Math.max(0, Math.min(2400, Number(event.target.value) || 0)))} /></label>
            <label>最小画布高度<input type="number" min="0" max="2400" step="20" value={minCanvasHeight} onChange={(event) => setMinCanvasHeight(Math.max(0, Math.min(2400, Number(event.target.value) || 0)))} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={fogEnabled} onChange={(event) => setFogEnabled(event.target.checked)} />探索迷雾</label>
          <label className="check"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />显示网格</label>
          <label className="check"><input type="checkbox" checked={showCoordinates} onChange={(event) => setShowCoordinates(event.target.checked)} />显示坐标</label>
          <button type="button" className="reset-button" onClick={reset}>重置编辑数据</button>
        </section>
        <section className="control-card selection-panel">
          <div className="map-editor__header"><div><h2>选中数据</h2><p>点击精确选择，拖动鼠标框选</p></div><strong>{canvasSelections.length > 1 ? `${canvasSelections.length} 项` : `${canvasSelection.x}, ${canvasSelection.y}`}</strong></div>
          <div className="selection-mode-switch">{([['all','所有'],['map','地图'],['tile','格子'],['edge','单格边'],['shared','公用边'],['point','公用点']] as const).map(([mode,label])=><button type="button" key={mode} className={selectionMode===mode?'is-active':''} onClick={()=>changeSelectionMode(mode)}>{label}</button>)}</div>
          <div className="selection-summary"><span>{canvasSelections.length > 1 ? `已框选 ${canvasSelections.length} 个数据容器` : `类型：${canvasSelection.mode==='map'?'地图':canvasSelection.mode==='tile'?'格子':canvasSelection.mode==='edge'?'单格边':canvasSelection.mode==='shared'?'公用边':'公用点'}`}</span>{canvasSelections.length <= 1 && canvasSelection.direction&&canvasSelection.mode!=='point'?<span>方向：{DIRECTION_LABEL[canvasSelection.direction]}</span>:null}</div>
          {canvasSelections.length > 1 ? <div className="selection-multi-hint">下方编辑器显示框选结果中的主数据容器；地图会同时高亮全部结果。</div> : null}
          <pre className="selection-data">{JSON.stringify(selectedContainerData, null, 2) ?? '无数据'}</pre>
        </section>
        <section className="control-card entity-component-editor">
          <div className="map-editor__header"><div><h2>Entity / Component</h2><p>{ENTITY_TYPE_DEFINITIONS.length} 种 Entity / {COMPONENT_DEFINITIONS.length} 种 Component 定义已自动扫描</p></div><strong>{selectedContainerData?.entities.length ?? 0} Entity</strong></div>
          {!selectionHasTarget ? <div className="editor-empty">当前位置没有可编辑的数据容器</div> : <>
            <div className="subpanel-header"><strong className="subpanel-title">Entity</strong><div className="mini-mode-switch"><button type="button" className={entityViewMode === 'all' ? 'is-active' : ''} onClick={() => setEntityViewMode('all')}>全部</button><button type="button" className={entityViewMode === 'select' ? 'is-active' : ''} onClick={() => setEntityViewMode('select')}>下拉</button></div></div>
            <div className="subpanel-body">
              <div className="entity-toolbar">
                {entityViewMode === 'select' ? <select aria-label="选择 Entity" value={selectedEntity?.id ?? ''} onChange={(event) => { setSelectedEntityId(event.target.value); setSelectedComponentId(''); }}>{(selectedContainerData?.entities ?? []).map((entity) => <option key={entity.id} value={entity.id}>{entity.name || entity.id}</option>)}</select> : <span className="entity-count">全部 {visibleEntities.length} 个</span>}
                <div className="entity-add-row"><label className="component-toolbar__field"><span>新增 Entity 类型</span><select aria-label="新增 Entity 类型" value={effectiveEntityTypeToAdd} disabled={availableEntityDefinitions.length === 0} onChange={(event) => setEntityTypeToAdd(event.target.value)}>{availableEntityDefinitions.length === 0 ? <option value="">当前容器无可用类型</option> : null}{availableEntityDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}</select></label><button type="button" className="compact-button" disabled={!effectiveEntityTypeToAdd} onClick={addEntityToSelection}>＋ 添加</button></div>
              </div>
              <div className="entity-card-list">{visibleEntities.map((entity) => {
                const entityDefinition = ENTITY_TYPE_REGISTRY.get(entity.entityType);
                const availableComponentDefinitions = COMPONENT_REGISTRY.listForEntity(entity.entityType);
                const effectiveComponentTypeToAdd = availableComponentDefinitions.some((definition) => definition.type === componentTypeToAdd)
                  ? componentTypeToAdd
                  : availableComponentDefinitions[0]?.type ?? '';
                const chosen = selectedEntityId === entity.id
                  ? entity.components.find((component) => component.id === selectedComponentId) ?? entity.components[0]
                  : entity.components[0];
                const shown = componentViewMode === 'all' ? entity.components : chosen ? [chosen] : [];
                const entityCollapsed = collapsedEntityIds.has(entity.id);
                return <div className="entity-card" key={entity.id}>
                  <div className="entity-card__title"><button type="button" className="card-collapse-button" aria-expanded={!entityCollapsed} onClick={() => toggleCollapsedId(setCollapsedEntityIds, entity.id)}><span className="card-collapse-button__icon">{entityCollapsed ? '▸' : '▾'}</span><span className="card-collapse-button__text"><strong>{entity.name || '未命名 Entity'}</strong><small>{entityDefinition?.label ?? entity.entityType} · {entity.components.length} Component</small></span></button><button type="button" className="danger-button icon-button" onClick={() => removeEntityById(entity.id)}>删除</button></div>
                  {!entityCollapsed ? <><div className="physics-fields entity-fields"><label><span>Entity ID</span><input value={entity.id} readOnly /></label><label><span>Entity 类型</span><input value={entityDefinition ? `${entityDefinition.label} (${entity.entityType})` : `未注册 (${entity.entityType})`} readOnly /></label><label><span>名称</span><input value={entity.name ?? ''} onChange={(event) => updateEntityById(entity.id, (current) => ({ ...current, name: event.target.value || undefined }))} /></label><label><span>原型 ID</span><input value={entity.archetypeId ?? ''} onChange={(event) => updateEntityById(entity.id, (current) => ({ ...current, archetypeId: event.target.value || undefined }))} /></label><label className="physics-check"><input type="checkbox" checked={entity.enabled !== false} onChange={(event) => updateEntityById(entity.id, (current) => ({ ...current, enabled: event.target.checked }))} /><span>启用</span></label></div>
                  <div className="entity-component-child">
                    <div className="subpanel-header component-child-header"><strong className="subpanel-title">Component <span>{entity.components.length}</span></strong><div className="mini-mode-switch"><button type="button" className={componentViewMode === 'all' ? 'is-active' : ''} onClick={() => setComponentViewMode('all')}>全部</button><button type="button" className={componentViewMode === 'select' ? 'is-active' : ''} onClick={() => setComponentViewMode('select')}>下拉</button></div></div>
                    <div className="component-group component-group--nested">
                      <div className="component-toolbar">
                        {componentViewMode === 'select' ? <label className="component-toolbar__field"><span>编辑 Component</span><select aria-label={`选择 ${entity.name || entity.id} 的 Component`} value={chosen?.id ?? ''} onChange={(event) => { setSelectedEntityId(entity.id); setSelectedComponentId(event.target.value); }}>{entity.components.length === 0 ? <option value="">暂无 Component</option> : null}{entity.components.map((component) => <option key={component.id} value={component.id}>{COMPONENT_REGISTRY.get(component.type)?.label ?? component.type}</option>)}</select></label> : <span className="entity-count">当前显示全部 {entity.components.length} 个 Component</span>}
                        <div className="component-add-row"><label className="component-toolbar__field"><span>新增组件类型</span><select aria-label={`新增 ${entity.name || entity.id} 的 Component 类型`} value={effectiveComponentTypeToAdd} disabled={availableComponentDefinitions.length === 0} onChange={(event) => setComponentTypeToAdd(event.target.value)}>{availableComponentDefinitions.length === 0 ? <option value="">当前 Entity 无可用组件</option> : null}{availableComponentDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}</select></label><button type="button" className="compact-button" disabled={!effectiveComponentTypeToAdd} onClick={() => addComponentToEntity(entity.id, effectiveComponentTypeToAdd)}>＋ 添加</button></div>
                      </div>
                      {shown.length > 0 ? <div className="component-card-list">{shown.map((component) => renderComponentCard(entity, component))}</div> : <div className="editor-empty">暂无 Component</div>}
                    </div>
                  </div>
                  </> : null}
                </div>;
              })}</div>
            </div>
          </>}
        </section>
        <section className="control-card pattern-controls">
          <div className="pattern-controls__header"><div><h2>地图图案</h2><p>资源自动扫描自 public</p></div><span>{Object.keys(PATTERN_MODULES).length} 个</span></div>
          <label className="pattern-field"><span>成套主题</span><span className="pattern-select pattern-select--without-preview">
            <select value={selectedSuite} onChange={(event) => {
              const name = event.target.value;
              setSelectedSuite(name);
              const suite = suites.find((item) => item.name === name);
              if (!suite) return;
              setPatterns((current) => ({
                ...current,
                wall: suite.wall ?? current.wall,
                floor: suite.floor ?? current.floor,
                edgeNorth: suite.edge ?? current.edgeNorth,
                edgeEast: suite.edge ?? current.edgeEast,
                edgeSouth: suite.edge ?? current.edgeSouth,
                edgeWest: suite.edge ?? current.edgeWest,
                sharedEdge: suite.sharedEdge ?? current.sharedEdge,
                sharedPoint: suite.sharedPoint ?? current.sharedPoint,
              }));
            }}>
              <option value="">自定义组合</option>
              {suites.map((suite) => <option key={suite.name} value={suite.name}>{suite.name}套装</option>)}
            </select>
          </span></label>
          <div className="pattern-grid">
            {([['walls', 'wall'], ['tiles', 'floor'], ['characters', 'player'], ['events', 'event']] as const).map(([kind, key]) => (
              <label className="pattern-field" key={kind}><span>{PATTERN_LABELS[kind]}</span><span className="pattern-select">
                <img src={patterns[key]} alt="" /><select value={patterns[key]} onChange={(event) => setPatterns((current) => ({ ...current, [key]: event.target.value }))}>
                  {options[kind].map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
                </select>
              </span></label>
            ))}
          </div>
          <div className="edge-patterns">
            <div className="edge-patterns__title"><strong>格子四边</strong><span>墙边图案设置</span></div>
            <div className="edge-size-controls">
              <label><span>单格边厚度</span><strong>{Math.round(edgeThicknessRatio * 100)}%</strong><input type="range" min="0" max="0.5" step="0.01" value={edgeThicknessRatio} onChange={(event) => setEdgeThicknessRatio(Number(event.target.value))} /></label>
              <label><span>公用边厚度</span><strong>{Math.round(sharedEdgeThicknessRatio * 100)}%</strong><input type="range" min="0" max="1" step="0.01" value={sharedEdgeThicknessRatio} onChange={(event) => setSharedEdgeThicknessRatio(Number(event.target.value))} /></label>
            </div>
            <label className="pattern-field shared-edge-field"><span>中央公用边</span><span className="pattern-select">
              <img src={patterns.sharedEdge} alt="" /><select value={patterns.sharedEdge} onChange={(event) => setPatterns((current) => ({ ...current, sharedEdge: event.target.value }))}>
                {options.sharedEdges.map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
              </select>
            </span></label>
            <label className="pattern-field shared-point-field"><span>公用交汇点</span><span className="pattern-select">
              <img src={patterns.sharedPoint} alt="" /><select value={patterns.sharedPoint} onChange={(event) => setPatterns((current) => ({ ...current, sharedPoint: event.target.value }))}>
                {options.sharedPoints.map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
              </select>
            </span></label>
            <div className="edge-mode-switch" role="group" aria-label="格子四边调整模式">
              <button type="button" className={edgeEditMode === 'linked' ? 'is-active' : ''} onClick={() => setEdgeEditMode('linked')}>统一调整</button>
              <button type="button" className={edgeEditMode === 'individual' ? 'is-active' : ''} onClick={() => setEdgeEditMode('individual')}>单独调整</button>
            </div>
            {edgeEditMode === 'linked' ? (
              <label className="pattern-field"><span>全部四边</span><span className="pattern-select">
                <img src={patterns.edgeNorth} alt="" /><select value={patterns.edgeNorth} onChange={(event) => {
                  const url = event.target.value;
                  setPatterns((current) => ({ ...current, edgeNorth: url, edgeEast: url, edgeSouth: url, edgeWest: url }));
                }}>
                  {options.edges.map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
                </select>
              </span></label>
            ) : (
              <div className="edge-patterns__grid">
                {([['北边', 'edgeNorth'], ['东边', 'edgeEast'], ['南边', 'edgeSouth'], ['西边', 'edgeWest']] as const).map(([label, key]) => (
                  <label className="pattern-field" key={key}><span>{label}</span><span className="pattern-select">
                    <img src={patterns[key]} alt="" /><select value={patterns[key]} onChange={(event) => setPatterns((current) => ({ ...current, [key]: event.target.value }))}>
                      {options.edges.map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
                    </select>
                  </span></label>
                ))}
              </div>
            )}
          </div>
        </section>
        </div>
      </aside>
      <main className="dungeon-lab__stage">
        <div className="map-frame">
          <div className="map-frame__header"><span>B1 · 遗忘回廊</span><div className="map-zoom"><button type="button" onClick={() => setMapScale((scale) => Math.max(0.5, scale - 0.1))}>−</button><button type="button" className="map-zoom__value" onClick={() => setMapScale(1)} title="恢复为适配窗口">{Math.round(mapScale * 100)}%</button><button type="button" onClick={() => setMapScale((scale) => Math.min(2.5, scale + 0.1))}>＋</button></div><span>{map.width} × {map.height}</span></div>
          <div className="map-scroll" ref={mapViewportRef}>
            <DungeonMapCanvas
              map={map}
              cellSize={cellSize}
              displayScale={fittedMapScale * mapScale}
              outerPadding={canvasOuterPadding}
              minCanvasWidth={minCanvasWidth}
              minCanvasHeight={minCanvasHeight}
              showGrid={showGrid}
              showCoordinates={showCoordinates}
              patterns={patterns}
              edgeThicknessRatio={edgeThicknessRatio}
              sharedEdgeThicknessRatio={sharedEdgeThicknessRatio}
              selectionMode={selectionMode}
              selections={canvasSelections}
              onSelectionsChange={(next) => {
                if (next.length === 0) return;
                setCanvasSelections(next);
                if (next[0].direction) setSelectedDirection(next[0].direction);
              }}
              keyboardEnabled={false}
            />
          </div>
        </div>
      </main>
    </div>
  );
};
