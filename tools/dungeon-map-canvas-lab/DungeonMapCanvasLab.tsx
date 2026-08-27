import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createDungeonMapData,
  validateDungeonMapData,
  type DungeonMapData,
  type DungeonMapContainerCoordinates,
  type DungeonMapDirection,
  type DungeonMapEdge,
  type DungeonMapPreset,
  type DungeonMapPresetLibrary,
  type DungeonMapSharedEdge,
  type DungeonMapSharedPoint,
  type DungeonMapTile,
  type DungeonMapTopologyMode,
} from '@/core/map';
import {
  ComponentRegistry,
  EntityTypeRegistry,
  createMutationPlan,
  createEntity,
  dedupeBatchContainerTargets,
  listBatchComponentDefinitions,
  listBatchEntityDefinitions,
  normalizeEntityContainer,
  resolveBatchComponentGroups,
  resolveBatchEntityGroups,
  resolveBatchFieldValue,
  type BatchContainerTarget,
  type MutationPlan,
  type ComponentDefinition,
  type ComponentFieldSchema,
  type EntityContainerKind,
  type EntityTypeDefinition,
  type IComponent,
  type IEntity,
  type IEntityContainer,
} from '@/core/entity';
import { DungeonMapCanvas, type DungeonMapSelection, type DungeonMapSelectionMode } from '@/core/ui/DungeonMapCanvas';
import { requestDevServer } from '@/core/network/devServerPortResolver';
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

type DungeonMapTileTemplate = Omit<DungeonMapTile, 'x' | 'y' | 'coordinates' | 'edges'> & {
  edges: Record<DungeonMapDirection, Omit<DungeonMapEdge, 'coordinates'>>;
};
const TILE_BY_CHARACTER: Record<string, DungeonMapTileTemplate> = {
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
const SELECTION_MODE_LABEL: Record<DungeonMapSelection['mode'], string> = {
  map: '地图', tile: '格子', edge: '单格边', shared: '公用边', point: '公用点',
};
const selectionIdentity = (selection: DungeonMapSelection): string => [
  selection.mode,
  selection.sharedEdgeId ?? '',
  selection.sharedPointId ?? '',
  selection.x,
  selection.y,
  selection.direction ?? '',
].join(':');
const selectionObjectLabel = (selection: DungeonMapSelection): string => {
  if (selection.mode === 'map') return '地图';
  if (selection.mode === 'point') return `公用点 (${selection.x}, ${selection.y})`;
  const direction = selection.direction ? ` · ${DIRECTION_LABEL[selection.direction]}侧` : '';
  return `${SELECTION_MODE_LABEL[selection.mode]} (${selection.x}, ${selection.y})${direction}`;
};
const selectionObjectId = (selection: DungeonMapSelection): string => (
  selection.sharedEdgeId ?? selection.sharedPointId ?? selectionIdentity(selection)
);
type LabMutationPlan = {
  plan: MutationPlan;
  selections: Record<string, DungeonMapSelection>;
};
type ResolvedMapContainerTarget = BatchContainerTarget & {
  coordinates: DungeonMapContainerCoordinates;
};
const VECTOR: Record<DungeonMapDirection, { x: number; y: number }> = {
  north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 }
};

const createEdge = (x: number, y: number, direction: DungeonMapDirection): Omit<DungeonMapEdge, 'coordinates'> => {
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
  x,
  y,
  coordinates: { type: 'tile', x, y },
  edges: {
    north: { ...createEdge(x, y, 'north'), coordinates: { type: 'tile-edge', x, y, direction: 'north' } },
    east: { ...createEdge(x, y, 'east'), coordinates: { type: 'tile-edge', x, y, direction: 'east' } },
    south: { ...createEdge(x, y, 'south'), coordinates: { type: 'tile-edge', x, y, direction: 'south' } },
    west: { ...createEdge(x, y, 'west'), coordinates: { type: 'tile-edge', x, y, direction: 'west' } },
  }
})));

const legacyEntityContainer = (
  id: string,
  name: string,
  data: Record<string, unknown>,
  entityType: string,
): IEntityContainer => normalizeEntityContainer(data, id, name, entityType);

const createBlankPresetMap = (
  presetKey: string,
  width: number,
  height: number,
  mode: DungeonMapTopologyMode,
): DungeonMapData => createDungeonMapData({
  id: `dungeon-map:${presetKey}`,
  width,
  height,
  mode,
  createMapData: () => legacyEntityContainer(
    `map:${presetKey}:entity`, '地图实体', { legacy: { presetKey } }, 'map',
  ),
  createTileData: ({ x, y }) => legacyEntityContainer(
    `tile:${x},${y}:entity`, `格子 ${x},${y}`, { legacy: { kind: 'floor' } }, 'tile',
  ),
  createTileEdgeData: ({ x, y, direction }) => legacyEntityContainer(
    `tile:${x},${y}:${direction}:entity`, `单格边 ${x},${y},${direction}`, { legacy: { kind: 'open' } }, 'tile-edge',
  ),
  createSharedEdgeData: ({ id, first }) => legacyEntityContainer(
    `${id}:entity`, '公用边实体', { legacy: { kind: 'open', label: `公用边 ${first.x},${first.y},${first.direction}` } }, 'shared-edge',
  ),
  createSharedPointData: ({ id, gridX, gridY }) => legacyEntityContainer(
    `${id}:entity`, '公用点实体', { legacy: { label: `公用点 ${gridX},${gridY}` } }, 'shared-point',
  ),
});

const normalizedPresetLibrary = (value: unknown): DungeonMapPresetLibrary => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, raw]) => {
    if (!raw || typeof raw !== 'object') return [];
    const preset = raw as Partial<DungeonMapPreset>;
    const rawMap = preset.map;
    if (!rawMap || typeof rawMap.id !== 'string' || !Number.isInteger(rawMap.width) || !Number.isInteger(rawMap.height)
      || !Array.isArray(rawMap.tiles)) return [];
    const map = rawMap;
    if (validateDungeonMapData(map).some((issue) => issue.code.includes('coordinates'))) return [];
    return [[key, {
      presetKey: key,
      name: typeof preset.name === 'string' && preset.name.trim() ? preset.name : key,
      map,
    } satisfies DungeonMapPreset]];
  }));
};

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
  const [draftMapWidth, setDraftMapWidth] = useState<number>(MAP_ROWS[0].length);
  const [draftMapHeight, setDraftMapHeight] = useState<number>(MAP_ROWS.length);
  const [draftTopologyMode, setDraftTopologyMode] = useState<DungeonMapTopologyMode>('bounded');
  const [mapPresets, setMapPresets] = useState<DungeonMapPresetLibrary>({});
  const [activePresetKey, setActivePresetKey] = useState('');
  const [presetKeyDraft, setPresetKeyDraft] = useState('');
  const [presetBaseMap, setPresetBaseMap] = useState<DungeonMapData>();
  const [newPresetKey, setNewPresetKey] = useState('dungeon_map');
  const [newPresetName, setNewPresetName] = useState('新地图预设');
  const [presetMessage, setPresetMessage] = useState('正在连接 Python 服务…');
  const [presetError, setPresetError] = useState(false);
  const [presetSaving, setPresetSaving] = useState(false);
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
  const [edgeThicknessRatio, setEdgeThicknessRatio] = useState(0.24);
  const [sharedEdgeThicknessRatio, setSharedEdgeThicknessRatio] = useState(0.24);
  const [selectedDirection, setSelectedDirection] = useState<DungeonMapDirection>('east');
  const [mapDataEdits, setMapDataEdits] = useState<IEntityContainer>();
  const [tileDataEdits, setTileDataEdits] = useState<Record<string, IEntityContainer>>({});
  const [tileEdgeDataEdits, setTileEdgeDataEdits] = useState<Record<string, IEntityContainer>>({});
  const [sharedEdgeEdits, setSharedEdgeEdits] = useState<Record<string, DungeonMapSharedEdge>>({});
  const [sharedPointEdits, setSharedPointEdits] = useState<Record<string, DungeonMapSharedPoint>>({});
  const [selectionMode, setSelectionMode] = useState<DungeonMapSelectionMode>('tile');
  const [canvasSelections, setCanvasSelections] = useState<DungeonMapSelection[]>([{ mode: 'tile', x: 1, y: 1 }]);
  const [selectionJsonMessage, setSelectionJsonMessage] = useState<{ source: string; message: string }>();
  const canvasSelection = canvasSelections[0];
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [componentTypeToAdd, setComponentTypeToAdd] = useState(COMPONENT_DEFINITIONS[0]?.type ?? '');
  const [entityTypeToAdd, setEntityTypeToAdd] = useState(ENTITY_TYPE_DEFINITIONS[0]?.type ?? '');
  const [entityViewMode, setEntityViewMode] = useState<'all' | 'select'>('select');
  const [componentViewMode, setComponentViewMode] = useState<'all' | 'select'>('select');
  const [batchEntityTypeToCreate, setBatchEntityTypeToCreate] = useState('');
  const [batchEntityArchetypeDraft, setBatchEntityArchetypeDraft] = useState('');
  const [batchEntityGroupType, setBatchEntityGroupType] = useState('');
  const [batchComponentTypeToCreate, setBatchComponentTypeToCreate] = useState('');
  const [batchComponentSlotDraft, setBatchComponentSlotDraft] = useState('');
  const [batchComponentTypeToEdit, setBatchComponentTypeToEdit] = useState('');
  const [pendingMutationPlan, setPendingMutationPlan] = useState<LabMutationPlan>();
  const [mutationHistoryPast, setMutationHistoryPast] = useState<LabMutationPlan[]>([]);
  const [mutationHistoryFuture, setMutationHistoryFuture] = useState<LabMutationPlan[]>([]);
  const [collapsedEntityIds, setCollapsedEntityIds] = useState<Set<string>>(() => new Set());
  const [collapsedComponentIds, setCollapsedComponentIds] = useState<Set<string>>(() => new Set());
  const [collapsedPanelIds, setCollapsedPanelIds] = useState<Set<string>>(() => new Set());

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

  const map = useMemo<DungeonMapData>(() => {
    if (presetBaseMap) {
      return {
        ...presetBaseMap,
        data: mapDataEdits ?? presetBaseMap.data,
        tiles: presetBaseMap.tiles.map((tile) => ({
          ...tile,
          data: tileDataEdits[`${tile.x},${tile.y}`] ?? tile.data,
          edges: Object.fromEntries(DIRECTIONS.map((direction) => [direction, {
            ...tile.edges[direction],
            data: tileEdgeDataEdits[`${tile.x},${tile.y},${direction}`] ?? tile.edges[direction].data,
          }])) as DungeonMapTile['edges'],
        })),
        sharedEdges: presetBaseMap.sharedEdges?.map((edge) => sharedEdgeEdits[edge.id] ?? edge),
        sharedPoints: presetBaseMap.sharedPoints?.map((point) => sharedPointEdits[point.id] ?? point),
      };
    }
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
    const usesGeneratedConfiguration = topologyMode !== 'bounded'
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
      coordinates: {
        type: 'map', x: 0, y: 0, width: MAP_ROWS[0].length, height: MAP_ROWS.length,
      },
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
              coordinates: { type: 'shared-edge', sides: sharedEdge.sides },
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
  }, [fogEnabled, visited, mapWidth, mapHeight, topologyMode, mapDataEdits, tileDataEdits, tileEdgeDataEdits, sharedEdgeEdits, sharedPointEdits, presetBaseMap]);

  const clearMapEdits = () => {
    setMapDataEdits(undefined);
    setTileDataEdits({});
    setTileEdgeDataEdits({});
    setSharedEdgeEdits({});
    setSharedPointEdits({});
    setSelectedEntityId('');
    setSelectedComponentId('');
    setPendingMutationPlan(undefined);
    setMutationHistoryPast([]);
    setMutationHistoryFuture([]);
  };

  const loadPresetIntoEditor = (preset: DungeonMapPreset) => {
    const nextMode = preset.map.topologyMode ?? 'bounded';
    clearMapEdits();
    setActivePresetKey(preset.presetKey);
    setPresetKeyDraft(preset.presetKey);
    setPresetBaseMap(preset.map);
    setMapWidth(preset.map.width);
    setMapHeight(preset.map.height);
    setTopologyMode(nextMode);
    setDraftMapWidth(preset.map.width);
    setDraftMapHeight(preset.map.height);
    setDraftTopologyMode(nextMode);
    setCanvasSelections([{ mode: 'tile', x: 0, y: 0 }]);
  };

  useEffect(() => {
    let active = true;
    requestDevServer(`/api/dungeon-map-presets?t=${Date.now()}`, { method: 'GET' })
      .then(async (response) => {
        const result = await response.json() as { success?: boolean; data?: unknown; message?: string; errors?: string[] };
        if (!response.ok || result.success === false) throw new Error(result.errors?.[0] ?? result.message ?? `HTTP ${response.status}`);
        if (!active) return;
        const library = normalizedPresetLibrary(result.data);
        setMapPresets(library);
        const first = Object.values(library)[0];
        if (first) {
          loadPresetIntoEditor(first);
          setPresetMessage(`已从 config 载入 ${Object.keys(library).length} 个地图预设。`);
        } else {
          setPresetMessage('已连接 Python 服务，config 中暂无地图预设。');
        }
        setPresetError(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPresetError(true);
        setPresetMessage(`地图预设加载失败：${error instanceof Error ? error.message : String(error)}`);
      });
    return () => { active = false; };
  // 仅在 Lab 启动时读取一次；切换预设由显式操作完成。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectMapPreset = (key: string) => {
    const preset = mapPresets[key];
    if (!preset) return;
    if (activePresetKey && mapPresets[activePresetKey]) {
      setMapPresets((current) => ({
        ...current,
        [activePresetKey]: { ...current[activePresetKey], map },
      }));
    }
    loadPresetIntoEditor(preset);
    setPresetError(false);
    setPresetMessage(`已切换到地图预设：${preset.name}`);
  };

  const createMapPreset = () => {
    const requestedKey = newPresetKey.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'dungeon_map';
    let key = requestedKey;
    let suffix = 2;
    while (mapPresets[key]) {
      key = `${requestedKey}_${suffix}`;
      suffix += 1;
    }
    const nextMap = createBlankPresetMap(key, draftMapWidth, draftMapHeight, draftTopologyMode);
    const preset: DungeonMapPreset = {
      presetKey: key,
      name: newPresetName.trim() || '新地图预设',
      map: nextMap,
    };
    setMapPresets((current) => ({
      ...current,
      ...(activePresetKey && current[activePresetKey]
        ? { [activePresetKey]: { ...current[activePresetKey], map } }
        : {}),
      [key]: preset,
    }));
    loadPresetIntoEditor(preset);
    setNewPresetKey(`${requestedKey}_copy`);
    setPresetError(false);
    setPresetMessage(`已新建地图预设 ${preset.name}；点击“保存全部预设”写入 config。`);
  };

  const confirmPresetKeyChange = () => {
    const fromKey = activePresetKey;
    const toKey = presetKeyDraft.trim();
    const sourcePreset = mapPresets[fromKey];
    if (!fromKey || !sourcePreset) {
      setPresetError(true);
      setPresetMessage('当前没有可以修改 presetKey 的地图预设。');
      return;
    }
    if (!toKey) {
      setPresetKeyDraft(fromKey);
      setPresetError(true);
      setPresetMessage('presetKey 不能为空。');
      return;
    }
    if (toKey === fromKey) {
      setPresetError(false);
      setPresetMessage('presetKey 没有变化。');
      return;
    }
    if (mapPresets[toKey]) {
      setPresetKeyDraft(fromKey);
      setPresetError(true);
      setPresetMessage(`无法修改：presetKey “${toKey}”已经存在。`);
      return;
    }
    const nextLibrary = { ...mapPresets };
    delete nextLibrary[fromKey];
    nextLibrary[toKey] = {
      ...sourcePreset,
      presetKey: toKey,
      map,
    };
    setMapPresets(nextLibrary);
    setActivePresetKey(toKey);
    setPresetKeyDraft(toKey);
    setPresetError(false);
    setPresetMessage(`已修改 presetKey：${fromKey} → ${toKey}；点击“保存全部预设”写入 config。`);
  };

  const duplicateMapPreset = () => {
    const sourcePreset = mapPresets[activePresetKey];
    if (!sourcePreset) return;
    const requestedKey = `${activePresetKey}_copy`;
    let key = requestedKey;
    let suffix = 2;
    while (mapPresets[key]) {
      key = `${requestedKey}_${suffix}`;
      suffix += 1;
    }
    const copiedMap = structuredClone(map);
    copiedMap.id = `dungeon-map:${key}`;
    const copiedPreset: DungeonMapPreset = {
      presetKey: key,
      name: `${sourcePreset.name} 副本`,
      map: copiedMap,
    };
    setMapPresets((current) => ({
      ...current,
      [activePresetKey]: { ...sourcePreset, map },
      [key]: copiedPreset,
    }));
    loadPresetIntoEditor(copiedPreset);
    setPresetError(false);
    setPresetMessage(`已复制地图预设为 ${copiedPreset.name}；点击“保存全部预设”写入 config。`);
  };

  const deleteMapPreset = () => {
    const sourcePreset = mapPresets[activePresetKey];
    if (!sourcePreset || !window.confirm(`删除地图预设“${sourcePreset.name}”？`)) return;
    const nextLibrary = { ...mapPresets };
    delete nextLibrary[activePresetKey];
    setMapPresets(nextLibrary);
    const nextPreset = Object.values(nextLibrary)[0];
    if (nextPreset) {
      loadPresetIntoEditor(nextPreset);
    } else {
      clearMapEdits();
      setActivePresetKey('');
      setPresetKeyDraft('');
      setPresetBaseMap(undefined);
      setMapWidth(MAP_ROWS[0].length);
      setMapHeight(MAP_ROWS.length);
      setTopologyMode('bounded');
      setCanvasSelections([{ mode: 'tile', x: 1, y: 1 }]);
    }
    setPresetError(false);
    setPresetMessage(`已删除地图预设 ${sourcePreset.name}；点击“保存全部预设”同步到 config。`);
  };

  const saveMapPresets = async () => {
    const currentLibrary = activePresetKey && mapPresets[activePresetKey]
      ? { ...mapPresets, [activePresetKey]: { ...mapPresets[activePresetKey], map } }
      : mapPresets;
    const payload = Object.fromEntries(Object.entries(currentLibrary).map(([key, preset]) => [key, {
      ...preset,
      presetKey: key,
      name: preset.name.trim() || key,
    }])) as DungeonMapPresetLibrary;
    setPresetSaving(true);
    try {
      const response = await requestDevServer('/api/dungeon-map-presets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { success?: boolean; message?: string; errors?: string[] };
      if (!response.ok || result.success === false) throw new Error(result.errors?.[0] ?? result.message ?? `HTTP ${response.status}`);
      setMapPresets(payload);
      setPresetError(false);
      setPresetMessage(`已保存 ${Object.keys(payload).length} 个地图预设到 config/dungeonMapPresets.json。`);
    } catch (error) {
      setPresetError(true);
      setPresetMessage(`地图预设保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPresetSaving(false);
    }
  };

  const validationIssues = useMemo(() => validateDungeonMapData(map), [map]);
  const canvasSelectedTile = canvasSelection
    ? map.tiles[canvasSelection.y * map.width + canvasSelection.x]
    : undefined;
  const canvasSelectionDirection = canvasSelection?.direction ?? selectedDirection;
  // 公用边编辑只认 Canvas 精确命中后返回的 ID，禁止按附近格子猜测目标。
  const canvasSelectedSharedEdge = map.sharedEdges?.find(
    (edge) => edge.id === canvasSelection?.sharedEdgeId,
  );
  const canvasSelectedSharedPoint = map.sharedPoints?.find(
    (point) => point.id === canvasSelection?.sharedPointId,
  );
  const rawSelectedContainerData = canvasSelection ? (
    canvasSelection.mode === 'map'
      ? map.data
      : canvasSelection.mode === 'tile'
      ? canvasSelectedTile?.data
      : canvasSelection.mode === 'edge'
        ? canvasSelectedTile?.edges[canvasSelectionDirection]?.data
        : canvasSelection.mode === 'shared'
          ? canvasSelectedSharedEdge?.edge.data
          : canvasSelectedSharedPoint?.point.data
  ) as unknown : undefined;
  const selectionHasTarget = !canvasSelection
    ? false
    : canvasSelection.mode === 'map'
      || canvasSelection.mode === 'shared' && Boolean(canvasSelectedSharedEdge)
      || canvasSelection.mode === 'point' && Boolean(canvasSelectedSharedPoint)
      || canvasSelection.mode === 'tile' && Boolean(canvasSelectedTile)
      || canvasSelection.mode === 'edge' && Boolean(canvasSelectedTile?.edges[canvasSelectionDirection]);
  const selectionHostId = !canvasSelection
    ? 'no-selection'
    : canvasSelection.mode === 'map'
    ? map.id
    : canvasSelection.mode === 'shared'
    ? canvasSelectedSharedEdge?.id ?? 'missing-shared-edge'
    : canvasSelection.mode === 'point'
      ? canvasSelectedSharedPoint?.id ?? 'missing-shared-point'
      : `${canvasSelection.mode}:${canvasSelection.x},${canvasSelection.y}:${canvasSelectionDirection}`;
  const selectedContainerKind: EntityContainerKind = !canvasSelection
    ? 'tile'
    : canvasSelection.mode === 'map'
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
  const resolveSelectionTarget = (selection: DungeonMapSelection): ResolvedMapContainerTarget | undefined => {
    const tile = map.tiles[selection.y * map.width + selection.x];
    const direction = selection.direction ?? selectedDirection;
    const sharedEdge = map.sharedEdges?.find((edge) => edge.id === selection.sharedEdgeId);
    const sharedPoint = map.sharedPoints?.find((point) => point.id === selection.sharedPointId);
    const hasTarget = selection.mode === 'map'
      || selection.mode === 'shared' && Boolean(sharedEdge)
      || selection.mode === 'point' && Boolean(sharedPoint)
      || selection.mode === 'tile' && Boolean(tile)
      || selection.mode === 'edge' && Boolean(tile?.edges[direction]);
    if (!hasTarget) return undefined;
    const rawData = selection.mode === 'map'
      ? map.data
      : selection.mode === 'tile'
        ? tile?.data
        : selection.mode === 'edge'
          ? tile?.edges[direction]?.data
          : selection.mode === 'shared'
            ? sharedEdge?.edge.data
            : sharedPoint?.point.data;
    const hostId = selection.mode === 'map'
      ? map.id
      : selection.mode === 'shared'
        ? sharedEdge?.id ?? 'missing-shared-edge'
        : selection.mode === 'point'
          ? sharedPoint?.id ?? 'missing-shared-point'
          : selection.mode === 'tile'
            ? `tile:${selection.x},${selection.y}`
            : `tile-edge:${selection.x},${selection.y}:${direction}`;
    const kind: EntityContainerKind = selection.mode === 'map'
      ? 'map'
      : selection.mode === 'tile'
        ? 'tile'
        : selection.mode === 'edge'
          ? 'tile-edge'
          : selection.mode === 'shared'
            ? 'shared-edge'
            : 'shared-point';
    const coordinates = selection.mode === 'map'
      ? map.coordinates
      : selection.mode === 'tile'
        ? tile!.coordinates
        : selection.mode === 'edge'
          ? tile!.edges[direction].coordinates
          : selection.mode === 'shared'
            ? sharedEdge!.edge.coordinates
            : sharedPoint!.point.coordinates;
    return {
      id: hostId,
      kind,
      coordinates,
      container: normalizeEntityContainer(rawData, `${hostId}:entity`, '地图实体', kind),
    };
  };
  const resolvedBatchSelections = canvasSelections.flatMap((selection) => {
    const target = resolveSelectionTarget(selection);
    return target ? [{ selection, target }] : [];
  });
  const uniqueBatchSelections = [...new Map(
    resolvedBatchSelections.map((item) => [item.target.id, item]),
  ).values()];
  const selectedContainersJson = {
    format: 'dungeon-map-container-selection',
    version: 1,
    mapId: map.id,
    count: uniqueBatchSelections.length,
    containers: uniqueBatchSelections.map(({ target }) => ({
      id: target.id,
      coordinates: target.coordinates,
      data: target.container,
    })),
  } as const;
  const selectedContainersJsonText = JSON.stringify(selectedContainersJson, null, 2);
  const visibleSelectionJsonMessage = selectionJsonMessage?.source === selectedContainersJsonText
    ? selectionJsonMessage.message
    : '';

  const copySelectedContainersJson = async () => {
    try {
      await navigator.clipboard.writeText(selectedContainersJsonText);
      setSelectionJsonMessage({ source: selectedContainersJsonText, message: `已复制 ${selectedContainersJson.count} 个数据容器` });
    } catch {
      setSelectionJsonMessage({ source: selectedContainersJsonText, message: '复制失败：当前环境不允许访问剪贴板' });
    }
  };

  const downloadSelectedContainersJson = () => {
    const blob = new Blob([selectedContainersJsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${map.id.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'dungeon-map'}-selection.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setSelectionJsonMessage({ source: selectedContainersJsonText, message: `已下载 ${selectedContainersJson.count} 个数据容器` });
  };

  const removeSelectedContainer = (containerId: string) => {
    setCanvasSelections((current) => current.filter(
      (selection) => resolveSelectionTarget(selection)?.id !== containerId,
    ));
  };
  const batchContainerTargets = dedupeBatchContainerTargets(
    uniqueBatchSelections.map((item) => item.target),
  );
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
      const current = currentSelections[0];
      if (!current) return currentSelections;
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

  /** 底层快照写入；只供 MutationPlan 提交、撤销和重做使用。 */
  const writeSelectionData = (
    selection: DungeonMapSelection,
    updater: (data: IEntityContainer) => IEntityContainer,
  ) => {
    const target = resolveSelectionTarget(selection);
    if (!target) return;
    const tile = map.tiles[selection.y * map.width + selection.x];
    const direction = selection.direction ?? selectedDirection;
    const sharedEdge = map.sharedEdges?.find((edge) => edge.id === selection.sharedEdgeId);
    const sharedPoint = map.sharedPoints?.find((point) => point.id === selection.sharedPointId);
    if (selection.mode === 'map') {
      setMapDataEdits(updater(normalizeEntityContainer(map.data, `${map.id}:entity`, '地图实体', 'map')));
      return;
    }
    if (selection.mode === 'point') {
      if (!sharedPoint) return;
      const next = {
        ...sharedPoint,
        point: {
          ...sharedPoint.point,
          data: updater(normalizeEntityContainer(sharedPoint.point.data, `${sharedPoint.id}:entity`, '公用点实体', 'shared-point')),
        },
      };
      setSharedPointEdits((edits) => ({ ...edits, [next.id]: next }));
      return;
    }
    if (selection.mode === 'shared') {
      if (!sharedEdge) return;
      const next = {
        ...sharedEdge,
        edge: {
          ...sharedEdge.edge,
          data: updater(normalizeEntityContainer(sharedEdge.edge.data, `${sharedEdge.id}:entity`, '公用边实体', 'shared-edge')),
        },
      };
      setSharedEdgeEdits((edits) => ({ ...edits, [next.id]: next }));
      return;
    }

    if (selection.mode === 'tile') {
      const key = `${selection.x},${selection.y}`;
      setTileDataEdits((edits) => ({
        ...edits,
        [key]: updater(normalizeEntityContainer(tile?.data, `tile:${key}:entity`, `格子 ${key}`, 'tile')),
      }));
      return;
    }
    const key = `${selection.x},${selection.y},${direction}`;
    setTileEdgeDataEdits((edits) => ({
      ...edits,
      [key]: updater(normalizeEntityContainer(tile?.edges[direction]?.data, `tile-edge:${key}:entity`, `单格边 ${key}`, 'tile-edge')),
    }));
  };

  const commitSelectionMutation = (
    selection: DungeonMapSelection,
    label: string,
    operation: string,
    updater: (data: IEntityContainer) => IEntityContainer,
  ) => {
    const target = resolveSelectionTarget(selection);
    if (!target || pendingMutationPlan) return;
    const plan = createMutationPlan(label, operation, [target], (current) => updater(current.container));
    if (plan.blockedReasons.length > 0 || plan.changes.length === 0) return;
    const entry: LabMutationPlan = { plan, selections: { [target.id]: selection } };
    writeSelectionData(selection, () => plan.changes[0].after);
    setMutationHistoryPast((history) => [...history, entry]);
    setMutationHistoryFuture([]);
  };

  const updateCanvasSelectionData = (
    label: string,
    operation: string,
    updater: (data: IEntityContainer) => IEntityContainer,
  ) => {
    if (!canvasSelection) return;
    commitSelectionMutation(canvasSelection, label, operation, updater);
  };

  const updateEntityById = (entityId: string, label: string, updater: (entity: IEntity) => IEntity) => {
    updateCanvasSelectionData(label, 'entity-edit', (container) => ({
      ...container,
      entities: container.entities.map((entity) => entity.id === entityId ? updater(entity) : entity),
    }));
  };

  const createEntityFromDefinition = (definition: EntityTypeDefinition): IEntity => {
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
    return entity;
  };

  const addEntityToSelection = () => {
    const definition = ENTITY_TYPE_REGISTRY.get(effectiveEntityTypeToAdd);
    if (!definition || !ENTITY_TYPE_REGISTRY.canCreateIn(definition.type, selectedContainerKind)) return;
    if (definition.allowMultiplePerContainer === false
      && selectedContainerData?.entities.some((entity) => entity.entityType === definition.type)) return;
    const entity = createEntityFromDefinition(definition);
    updateCanvasSelectionData(`添加 Entity：${definition.label}`, 'entity-create', (container) => ({ ...container, entities: [...container.entities, entity] }));
    setCollapsedEntityIds((ids) => {
      const next = new Set(ids);
      next.delete(entity.id);
      return next;
    });
    setSelectedEntityId(entity.id);
    setSelectedComponentId('');
  };

  const removeEntityById = (entityId: string) => {
    updateCanvasSelectionData('删除 Entity', 'entity-delete', (container) => ({
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
    updateEntityById(entityId, `添加 Component：${definition.label}`, (current) => ({ ...current, components: [...current.components, component] }));
    setCollapsedComponentIds((ids) => {
      const next = new Set(ids);
      next.delete(component.id);
      return next;
    });
    setSelectedEntityId(entityId);
    setSelectedComponentId(component.id);
  };

  const updateComponentById = (entityId: string, componentId: string, label: string, updater: (component: IComponent) => IComponent) => {
    updateEntityById(entityId, label, (entity) => ({
      ...entity,
      components: entity.components.map((component) => component.id === componentId ? updater(component) : component),
    }));
  };

  const removeComponentById = (entityId: string, componentId: string) => {
    const entity = selectedContainerData?.entities.find((item) => item.id === entityId);
    const component = entity?.components.find((item) => item.id === componentId);
    const requiredComponents = entity ? ENTITY_TYPE_REGISTRY.get(entity.entityType)?.requiredComponents ?? [] : [];
    if (component && requiredComponents.includes(component.type)) return;
    updateEntityById(entityId, `删除 Component：${component?.type ?? componentId}`, (entity) => ({
      ...entity,
      components: entity.components.filter((component) => component.id !== componentId),
    }));
    setSelectedComponentId('');
  };

  const reset = () => {
    clearMapEdits();
  };

  const visibleEntities = entityViewMode === 'all'
    ? selectedContainerData?.entities ?? []
    : selectedEntity ? [selectedEntity] : [];

  const selectionCounts = canvasSelections.reduce<Record<DungeonMapSelection['mode'], number>>(
    (counts, item) => ({ ...counts, [item.mode]: counts[item.mode] + 1 }),
    { map: 0, tile: 0, edge: 0, shared: 0, point: 0 },
  );
  const selectionCountSummary = (['map', 'tile', 'edge', 'shared', 'point'] as const)
    .filter((mode) => selectionCounts[mode] > 0)
    .map((mode) => `${SELECTION_MODE_LABEL[mode]} ${selectionCounts[mode]}`)
    .join(' · ');

  const batchEntityDefinitions = listBatchEntityDefinitions(
    ENTITY_TYPE_DEFINITIONS,
    batchContainerTargets,
    'create',
  );
  const effectiveBatchEntityTypeToCreate = batchEntityDefinitions.some(
    (definition) => definition.type === batchEntityTypeToCreate,
  ) ? batchEntityTypeToCreate : batchEntityDefinitions[0]?.type ?? '';
  const batchEntityGroups = resolveBatchEntityGroups(batchContainerTargets);
  const compatibleBatchEntityGroups = batchEntityGroups.filter((group) => group.compatible);
  const effectiveBatchEntityGroupType = compatibleBatchEntityGroups.some(
    (group) => group.key === batchEntityGroupType,
  ) ? batchEntityGroupType : compatibleBatchEntityGroups[0]?.key ?? '';
  const activeBatchEntityGroup = compatibleBatchEntityGroups.find(
    (group) => group.key === effectiveBatchEntityGroupType,
  );
  const batchEntityTargets = activeBatchEntityGroup?.targets ?? [];
  const batchComponentCreateDefinitions = listBatchComponentDefinitions(
    COMPONENT_DEFINITIONS,
    batchEntityTargets,
    'create',
  );
  const effectiveBatchComponentTypeToCreate = batchComponentCreateDefinitions.some(
    (definition) => definition.type === batchComponentTypeToCreate,
  ) ? batchComponentTypeToCreate : batchComponentCreateDefinitions[0]?.type ?? '';
  const batchComponentEditDefinitions = listBatchComponentDefinitions(
    COMPONENT_DEFINITIONS,
    batchEntityTargets,
    'edit',
  );
  const batchComponentGroups = resolveBatchComponentGroups(batchEntityTargets);
  const editableBatchComponentGroups = batchComponentGroups.filter((group) => (
    group.compatible && batchComponentEditDefinitions.some(
      (definition) => definition.type === group.componentType,
    )
  ));
  const effectiveBatchComponentTypeToEdit = editableBatchComponentGroups.some(
    (group) => group.key === batchComponentTypeToEdit,
  ) ? batchComponentTypeToEdit : editableBatchComponentGroups[0]?.key ?? '';
  const activeBatchComponentGroup = editableBatchComponentGroups.find(
    (group) => group.key === effectiveBatchComponentTypeToEdit,
  );
  const activeBatchComponentDefinition = batchComponentEditDefinitions.find(
    (definition) => definition.type === activeBatchComponentGroup?.componentType,
  );
  const activeBatchComponents = activeBatchComponentGroup?.targets.map(
    (target) => target.component,
  ) ?? [];
  const batchComponentDeleteDefinitions = listBatchComponentDefinitions(
    COMPONENT_DEFINITIONS,
    batchEntityTargets,
    'delete',
  ).filter((definition) => batchEntityTargets.every((target) => !(
    ENTITY_TYPE_REGISTRY.get(target.entity.entityType)?.requiredComponents ?? []
  ).includes(definition.type)));

  const queueBatchPlan = (
    label: string,
    operation: string,
    updater: (target: BatchContainerTarget) => IEntityContainer,
  ) => {
    if (pendingMutationPlan) return;
    const plan = createMutationPlan(label, operation, batchContainerTargets, updater);
    setPendingMutationPlan({
      plan,
      selections: Object.fromEntries(uniqueBatchSelections.map(
        ({ selection, target }) => [target.id, selection],
      )),
    });
  };

  const queueBatchEntityPlan = (
    label: string,
    operation: string,
    updater: (entity: IEntity) => IEntity,
  ) => {
    if (!activeBatchEntityGroup) return;
    const entityIdByContainer = new Map(activeBatchEntityGroup.targets.map(
      (target) => [target.containerId, target.entity.id],
    ));
    queueBatchPlan(label, operation, (target) => {
      const entityId = entityIdByContainer.get(target.id);
      if (!entityId) throw new Error('目标容器没有唯一匹配的 Entity');
      return {
        ...target.container,
        entities: target.container.entities.map((entity) => (
          entity.id === entityId ? updater(entity) : entity
        )),
      };
    });
  };

  const applyLabMutationPlan = (entry: LabMutationPlan, direction: 'forward' | 'backward') => {
    entry.plan.changes.forEach((change) => {
      const selection = entry.selections[change.targetId];
      if (!selection) return;
      const snapshot = direction === 'forward' ? change.after : change.before;
      writeSelectionData(selection, () => snapshot);
    });
  };

  const confirmMutationPlan = () => {
    if (!pendingMutationPlan || pendingMutationPlan.plan.blockedReasons.length > 0 || pendingMutationPlan.plan.changes.length === 0) return;
    applyLabMutationPlan(pendingMutationPlan, 'forward');
    setMutationHistoryPast((history) => [...history, pendingMutationPlan]);
    setMutationHistoryFuture([]);
    setPendingMutationPlan(undefined);
  };

  const undoMutationPlan = () => {
    const entry = mutationHistoryPast.at(-1);
    if (!entry || pendingMutationPlan) return;
    applyLabMutationPlan(entry, 'backward');
    setMutationHistoryPast((history) => history.slice(0, -1));
    setMutationHistoryFuture((history) => [entry, ...history]);
  };

  const redoMutationPlan = () => {
    const entry = mutationHistoryFuture[0];
    if (!entry || pendingMutationPlan) return;
    applyLabMutationPlan(entry, 'forward');
    setMutationHistoryFuture((history) => history.slice(1));
    setMutationHistoryPast((history) => [...history, entry]);
  };

  const batchCreateEntity = () => {
    const definition = ENTITY_TYPE_REGISTRY.get(effectiveBatchEntityTypeToCreate);
    if (!definition || !batchEntityDefinitions.includes(definition)) return;
    queueBatchPlan(`批量创建 ${definition.label}`, 'entity-create', (target) => {
      const archetypeId = batchEntityArchetypeDraft.trim() || undefined;
      if (target.container.entities.some((entity) => (
        entity.entityType === definition.type && entity.archetypeId === archetypeId
      ))) throw new Error('已存在相同 Entity 类型与 Archetype ID 的实例');
      const entity = createEntityFromDefinition(definition);
      entity.archetypeId = archetypeId;
      return { ...target.container, entities: [...target.container.entities, entity] };
    });
  };

  const batchAddComponent = () => {
    const definition = COMPONENT_REGISTRY.get(effectiveBatchComponentTypeToCreate);
    if (!definition || !batchComponentCreateDefinitions.includes(definition)) return;
    queueBatchEntityPlan(`批量添加 ${definition.label}`, 'component-create', (entity) => {
      const slot = batchComponentSlotDraft.trim() || undefined;
      if (entity.components.some((component) => (
        component.type === definition.type && component.slot === slot
      ))) throw new Error('已存在相同 Component 类型与 Slot 的实例');
      const component = definition.createDefault();
      component.slot = slot;
      return {
      ...entity,
        components: [...entity.components, component],
      };
    });
  };

  const batchDeleteComponent = (componentType: string) => {
    if (!batchComponentDeleteDefinitions.some((definition) => definition.type === componentType)) return;
    const definition = COMPONENT_REGISTRY.get(componentType);
    queueBatchEntityPlan(`批量删除 ${definition?.label ?? componentType}`, 'component-delete', (entity) => ({
      ...entity,
      components: entity.components.filter((component) => component.type !== componentType),
    }));
  };

  const batchSetComponentField = (field: ComponentFieldSchema, value: unknown) => {
    if (!activeBatchComponentDefinition || !activeBatchComponentGroup || field.batch?.editable !== true) return;
    const componentByContainer = new Map(activeBatchComponentGroup.targets.map(
      (target) => [target.containerId, { entityId: target.entityId, componentId: target.component.id }],
    ));
    queueBatchPlan(`批量修改 ${activeBatchComponentDefinition.label} · ${field.label}`, 'component-edit', (target) => {
      const matched = componentByContainer.get(target.id);
      if (!matched) throw new Error('目标容器没有匹配的 Component 槽位');
      return {
        ...target.container,
        entities: target.container.entities.map((entity) => entity.id === matched.entityId ? {
          ...entity,
          components: entity.components.map((component) => component.id === matched.componentId
            ? valueWithPath(component, field.path, value)
            : component),
        } : entity),
      };
    });
  };

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
      entity.id, component.id, `修改 ${definition?.label ?? component.type} · ${field.label}`,
      (current) => valueWithPath(current, field.path, value),
    );
    return <div className="component-card" key={component.id}>
      <div className="component-card__header"><button type="button" className="card-collapse-button" aria-expanded={!isCollapsed} onClick={() => toggleCollapsedId(setCollapsedComponentIds, component.id)}><span className="card-collapse-button__icon">{isCollapsed ? '▸' : '▾'}</span><span className="card-collapse-button__text"><strong>{definition?.label ?? component.type}</strong><small>{component.type} · v{component.version}{!isAllowed ? ' · 当前 Entity 类型不允许' : ''}</small></span></button><label className="component-enabled"><input type="checkbox" checked={component.enabled !== false} onChange={(event) => updateComponentById(entity.id, component.id, `切换 ${definition?.label ?? component.type} 启用状态`, (current) => ({ ...current, enabled: event.target.checked }))} />启用</label></div>
      {!isCollapsed ? <div className="component-instance-meta"><label><span>Component Slot</span><input key={`${component.id}-slot-${component.slot ?? ''}`} defaultValue={component.slot ?? ''} placeholder="多实例跨 Entity 匹配键" onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; updateComponentById(entity.id, component.id, '修改 Component Slot', (current) => ({ ...current, slot: event.currentTarget.value || undefined })); delete event.currentTarget.dataset.dirty; }} /></label></div> : null}
      {!isCollapsed && (definition ? <div className="physics-fields">
        {definition.fields.map((field) => {
          const currentValue = valueAtPath(component, field.path);
          if (field.control === 'checkbox') return <label className="physics-check" key={field.path}><input type="checkbox" checked={currentValue === true} onChange={(event) => setField(field, event.target.checked)} /><span>{field.label}</span></label>;
          if (field.control === 'select') return <label key={field.path}><span>{field.label}</span><select value={String(currentValue ?? '')} onChange={(event) => setField(field, event.target.value || undefined)}>{field.optional ? <option value="">不启用</option> : null}{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
          if (field.control === 'tags') return <label key={`${field.path}-${JSON.stringify(currentValue)}`}><span>{field.label}</span><textarea rows={2} defaultValue={Array.isArray(currentValue) ? currentValue.join(', ') : ''} placeholder={field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; setField(field, event.currentTarget.value.split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean)); delete event.currentTarget.dataset.dirty; }} /></label>;
          if (field.control === 'json') return <label key={`${component.id}-${field.path}-${JSON.stringify(currentValue)}`}><span>{field.label}</span><textarea rows={4} defaultValue={currentValue === undefined ? '' : JSON.stringify(currentValue, null, 2)} placeholder={field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; const text = event.currentTarget.value.trim(); try { event.currentTarget.setCustomValidity(''); setField(field, text ? JSON.parse(text) : undefined); delete event.currentTarget.dataset.dirty; } catch { event.currentTarget.setCustomValidity('请输入合法 JSON'); event.currentTarget.reportValidity(); } }} /></label>;
          if (field.control === 'number') return <label key={`${field.path}-${String(currentValue)}`}><span>{field.label}</span><input type="number" min={field.min} max={field.max} step={field.step ?? 1} defaultValue={typeof currentValue === 'number' ? currentValue : ''} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; setField(field, event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value)); delete event.currentTarget.dataset.dirty; }} /></label>;
          return <label key={`${field.path}-${String(currentValue)}`}><span>{field.label}</span><input defaultValue={String(currentValue ?? '')} placeholder={field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; setField(field, event.currentTarget.value || undefined); delete event.currentTarget.dataset.dirty; }} /></label>;
        })}
      </div> : <label className="unknown-component-json"><span>未注册组件，使用原始 JSON 编辑</span><textarea key={`${component.id}-${JSON.stringify(component)}`} rows={8} defaultValue={JSON.stringify(component, null, 2)} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; try { const parsed = JSON.parse(event.currentTarget.value) as IComponent; if (!parsed.id || !parsed.type || !parsed.version) throw new Error(); event.currentTarget.setCustomValidity(''); updateComponentById(entity.id, component.id, `修改未注册 Component：${component.type}`, () => parsed); delete event.currentTarget.dataset.dirty; } catch { event.currentTarget.setCustomValidity('必须包含合法的 id、type、version'); event.currentTarget.reportValidity(); } }} /></label>)}
      {!isCollapsed ? <button type="button" className="danger-button compact-button" disabled={isRequired} onClick={() => removeComponentById(entity.id, component.id)}>{isRequired ? '必需组件' : '删除'}</button> : null}
    </div>;
  };

  const renderBatchField = (field: ComponentFieldSchema) => {
    const fieldState = resolveBatchFieldValue(activeBatchComponents, field);
    const currentValue = fieldState.state === 'same' ? fieldState.value : undefined;
    const mixed = fieldState.state === 'mixed';
    const editable = field.batch?.editable === true;
    const status = mixed ? '多个值' : fieldState.state === 'missing' ? '未设置' : undefined;
    if (!editable) return <div className="batch-readonly-field" key={field.path}><span>{field.label}</span><strong>{status ?? JSON.stringify(currentValue)}</strong><em>只读 · 字段未声明批量兼容</em></div>;
    if (field.control === 'checkbox') return <label className="physics-check batch-field" key={field.path}><input type="checkbox" checked={currentValue === true} ref={(element) => { if (element) element.indeterminate = mixed; }} onChange={(event) => batchSetComponentField(field, event.target.checked)} /><span>{field.label}{status ? <em>{status}</em> : null}</span></label>;
    if (field.control === 'select') return <label className="batch-field" key={field.path}><span>{field.label}{status ? <em>{status}</em> : null}</span><select value={mixed ? '__mixed__' : String(currentValue ?? '')} onChange={(event) => batchSetComponentField(field, event.target.value || undefined)}>{mixed ? <option value="__mixed__" disabled>多个值（选择后覆盖全部）</option> : null}{field.optional ? <option value="">不启用</option> : null}{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
    if (field.control === 'json') return <label className="batch-field" key={`${field.path}-${fieldState.state}-${JSON.stringify(currentValue)}`}><span>{field.label}{status ? <em>{status}</em> : null}</span><textarea rows={4} defaultValue={currentValue === undefined ? '' : JSON.stringify(currentValue, null, 2)} placeholder={mixed ? '多个值；输入后覆盖全部目标' : field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; const text = event.currentTarget.value.trim(); try { event.currentTarget.setCustomValidity(''); batchSetComponentField(field, text ? JSON.parse(text) : undefined); delete event.currentTarget.dataset.dirty; } catch { event.currentTarget.setCustomValidity('请输入合法 JSON'); event.currentTarget.reportValidity(); } }} /></label>;
    if (field.control === 'tags') return <label className="batch-field" key={`${field.path}-${fieldState.state}-${JSON.stringify(currentValue)}`}><span>{field.label}{status ? <em>{status}</em> : null}</span><textarea rows={2} defaultValue={Array.isArray(currentValue) ? currentValue.join(', ') : ''} placeholder={mixed ? '多个值；输入后覆盖全部目标' : field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; batchSetComponentField(field, event.currentTarget.value.split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean)); delete event.currentTarget.dataset.dirty; }} /></label>;
    if (field.control === 'number') return <label className="batch-field" key={`${field.path}-${fieldState.state}-${String(currentValue)}`}><span>{field.label}{status ? <em>{status}</em> : null}</span><input type="number" min={field.min} max={field.max} step={field.step ?? 1} defaultValue={typeof currentValue === 'number' ? currentValue : ''} placeholder={mixed ? '多个值' : field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; batchSetComponentField(field, event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value)); delete event.currentTarget.dataset.dirty; }} /></label>;
    return <label className="batch-field" key={`${field.path}-${fieldState.state}-${String(currentValue)}`}><span>{field.label}{status ? <em>{status}</em> : null}</span><input defaultValue={String(currentValue ?? '')} placeholder={mixed ? '多个值；输入后覆盖全部目标' : field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; batchSetComponentField(field, event.currentTarget.value || undefined); delete event.currentTarget.dataset.dirty; }} /></label>;
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
          <div className="status-row"><span>当前坐标</span><strong>{canvasSelection ? `${canvasSelection.x}, ${canvasSelection.y}` : '未选择'}</strong></div>
        </section>
        <section className="control-card controls map-preset-controls">
          <div className="map-editor__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('map-presets')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'map-presets')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('map-presets') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>地图预设</strong><small>拓扑参数只在新建时生效</small></span></button><strong>{Object.keys(mapPresets).length} 个</strong></div>
          {!collapsedPanelIds.has('map-presets') ? <div className="collapsible-panel-body">
          <label>当前预设<select value={activePresetKey} disabled={Object.keys(mapPresets).length === 0} onChange={(event) => selectMapPreset(event.target.value)}>{Object.keys(mapPresets).length === 0 ? <option value="">暂无已保存预设</option> : null}{Object.values(mapPresets).map((preset) => <option key={preset.presetKey} value={preset.presetKey}>{preset.name} · {preset.presetKey}</option>)}</select></label>
          {activePresetKey && mapPresets[activePresetKey] ? <><label>presetKey（按确认才生效）<span className="preset-key-row"><input value={presetKeyDraft} placeholder="输入新的 presetKey" onChange={(event) => setPresetKeyDraft(event.target.value)} /><button type="button" disabled={presetKeyDraft.trim() === activePresetKey} onClick={confirmPresetKeyChange}>确认修改 ID</button></span></label><label>当前预设名称<input value={mapPresets[activePresetKey].name} onChange={(event) => setMapPresets((current) => ({ ...current, [activePresetKey]: { ...current[activePresetKey], name: event.target.value } }))} /></label><div className="preset-actions"><button type="button" onClick={duplicateMapPreset}>复制当前预设</button><button type="button" className="danger-button" onClick={deleteMapPreset}>删除当前预设</button></div></> : null}
          <div className="preset-divider"><span>新地图参数</span><small>当前地图：{mapWidth} × {mapHeight}</small></div>
          <div className="map-size-fields">
            <label>地图 X<input type="number" min="1" max="30" value={draftMapWidth} onChange={(event) => setDraftMapWidth(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} /></label>
            <label>地图 Y<input type="number" min="1" max="30" value={draftMapHeight} onChange={(event) => setDraftMapHeight(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} /></label>
          </div>
          <label>拓扑模式<select value={draftTopologyMode} onChange={(event) => setDraftTopologyMode(event.target.value as DungeonMapTopologyMode)}><option value="bounded">有界模式</option><option value="loop-horizontal">左右循环</option><option value="loop-vertical">上下循环</option><option value="loop">双向循环</option></select></label>
          <div className="map-size-fields">
            <label>新预设 Key<input value={newPresetKey} onChange={(event) => setNewPresetKey(event.target.value)} /></label>
            <label>显示名称<input value={newPresetName} onChange={(event) => setNewPresetName(event.target.value)} /></label>
          </div>
          <button type="button" className="create-preset-button" onClick={createMapPreset}>新建地图预设</button>
          <button type="button" className="save-preset-button" disabled={presetSaving} onClick={() => void saveMapPresets()}>{presetSaving ? '正在保存…' : '保存全部地图预设'}</button>
          <div className={`preset-status${presetError ? ' is-error' : ''}`}>{presetMessage}</div>
          </div> : null}
        </section>
        <section className="control-card controls visual-controls">
          <div className="map-editor__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('visual')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'visual')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('visual') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>视觉参数</strong><small>仅改变 Lab 显示，不重建地图数据</small></span></button></div>
          {!collapsedPanelIds.has('visual') ? <div className="collapsible-panel-body">
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
          </div> : null}
        </section>
        <section className="control-card selection-panel">
          <div className="map-editor__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('selection')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'selection')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('selection') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>选中数据</strong><small>左键框选；右键点击或框选取消</small></span></button><strong>{canvasSelections.length === 0 ? '未选择' : canvasSelections.length > 1 ? `${canvasSelections.length} 项` : `${canvasSelection!.x}, ${canvasSelection!.y}`}</strong></div>
          {!collapsedPanelIds.has('selection') ? <div className="collapsible-panel-body">
          <div className="selection-mode-switch">{([['all','所有'],['map','地图'],['tile','格子'],['edge','单格边'],['shared','公用边'],['point','公用点']] as const).map(([mode,label])=><button type="button" key={mode} className={selectionMode===mode?'is-active':''} onClick={()=>changeSelectionMode(mode)}>{label}</button>)}</div>
          {canvasSelections.length === 0 ? <div className="editor-empty">当前没有选中任何数据容器，可在地图上点击或框选。</div> : canvasSelections.length > 1 ? <>
            <div className="selection-overview"><strong>已选择 {uniqueBatchSelections.length} 个数据容器</strong><span>{selectionCountSummary}</span></div>
            <div className="selection-object-list">
              <div className="selection-object-list__header"><strong>选中对象列表</strong><span>已按真实容器 ID 去重</span></div>
              {uniqueBatchSelections.map(({ selection: item, target }) => <div className="selection-object-list__item" key={target.id}><span className="selection-object-list__marker">●</span><span className="selection-object-list__text"><strong>{selectionObjectLabel(item)}</strong><small>{selectionObjectId(item)}</small></span><button type="button" className="selection-object-list__remove" title={`取消选择 ${selectionObjectLabel(item)}`} aria-label={`取消选择 ${selectionObjectLabel(item)}`} onClick={() => removeSelectedContainer(target.id)}>−</button></div>)}
            </div>
            <div className="selection-multi-hint">下方 JSON 包含全部选中数据容器；循环拓扑的重复画布位置只导出一次。</div>
          </> : <div className="selection-summary"><span>类型：{SELECTION_MODE_LABEL[canvasSelection!.mode]}</span>{canvasSelection!.direction&&canvasSelection!.mode!=='point'?<span>方向：{DIRECTION_LABEL[canvasSelection!.direction]}</span>:null}</div>}
          <div className="selection-data-panel">
            <button type="button" className="selection-data-panel__header" aria-expanded={!collapsedPanelIds.has('selection-json')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'selection-json')}>
              <span>{collapsedPanelIds.has('selection-json') ? '▸' : '▾'}</span>
              <strong>全部选中容器 JSON</strong>
              <small>{selectedContainersJson.count} 个容器</small>
            </button>
            {!collapsedPanelIds.has('selection-json') ? <>
              <div className="selection-json-actions"><div><button type="button" onClick={copySelectedContainersJson}>复制 JSON</button><button type="button" onClick={downloadSelectedContainersJson}>下载 JSON</button></div><span>{visibleSelectionJsonMessage}</span></div>
              <pre className="selection-data">{selectedContainersJsonText}</pre>
            </> : null}
          </div>
          </div> : null}
        </section>
        <section className="control-card entity-component-editor">
          <div className="map-editor__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('entity-component')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'entity-component')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('entity-component') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>Entity / Component</strong><small>{ENTITY_TYPE_DEFINITIONS.length} 种 Entity / {COMPONENT_DEFINITIONS.length} 种 Component 定义已自动扫描</small></span></button><strong>{canvasSelections.length > 1 ? `${canvasSelections.length} 个目标` : `${selectedContainerData?.entities.length ?? 0} Entity`}</strong></div>
          {!collapsedPanelIds.has('entity-component') ? <div className="collapsible-panel-body">
          <div className="batch-history-toolbar"><span>数据修改历史 {mutationHistoryPast.length} · 可重做 {mutationHistoryFuture.length}</span><div><button type="button" className="icon-button" disabled={mutationHistoryPast.length === 0 || Boolean(pendingMutationPlan)} onClick={undoMutationPlan}>撤销</button><button type="button" className="icon-button" disabled={mutationHistoryFuture.length === 0 || Boolean(pendingMutationPlan)} onClick={redoMutationPlan}>重做</button></div></div>
          {canvasSelections.length > 1 ? <div className="batch-editor">
            <div className="batch-edit-placeholder"><strong>批量编辑模式</strong><span>真实目标：{batchContainerTargets.length} 个数据容器</span><p>循环地图的重复视觉位置已按真实容器 ID 去重，所有写入均要求全部目标兼容。</p></div>
            {pendingMutationPlan ? <section className="batch-plan-preview"><div className="batch-section__title"><strong>待确认：{pendingMutationPlan.plan.label}</strong><span>{pendingMutationPlan.plan.summary.changedContainers} 个真实容器</span></div><div className="batch-plan-summary"><span>Entity ＋{pendingMutationPlan.plan.summary.createdEntities} / −{pendingMutationPlan.plan.summary.deletedEntities}</span><span>Component ＋{pendingMutationPlan.plan.summary.createdComponents} / −{pendingMutationPlan.plan.summary.deletedComponents}</span><span>阻止 {pendingMutationPlan.plan.blockedReasons.length}</span></div>{pendingMutationPlan.plan.blockedReasons.length > 0 ? <div className="batch-plan-errors">{pendingMutationPlan.plan.blockedReasons.map((reason) => <div key={reason}>{reason}</div>)}</div> : null}<div className="batch-plan-targets">{pendingMutationPlan.plan.changes.slice(0, 8).map((change) => <code key={change.targetId}>{change.targetId}</code>)}{pendingMutationPlan.plan.changes.length > 8 ? <span>另有 {pendingMutationPlan.plan.changes.length - 8} 个目标</span> : null}</div><div className="batch-plan-actions"><button type="button" onClick={() => setPendingMutationPlan(undefined)}>取消</button><button type="button" className="create-preset-button" disabled={pendingMutationPlan.plan.blockedReasons.length > 0 || pendingMutationPlan.plan.changes.length === 0} onClick={confirmMutationPlan}>确认并一次提交</button></div></section> : null}
            <section className="batch-section">
              <div className="batch-section__title"><strong>批量创建 Entity</strong><span>{batchEntityDefinitions.length} 种可用</span></div>
              {batchEntityDefinitions.length > 0 ? <><div className="batch-action-row"><select aria-label="批量创建 Entity 类型" value={effectiveBatchEntityTypeToCreate} onChange={(event) => setBatchEntityTypeToCreate(event.target.value)}>{batchEntityDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}</select><button type="button" className="compact-button" disabled={Boolean(pendingMutationPlan)} onClick={batchCreateEntity}>生成创建计划</button></div><label className="batch-identity-field"><span>Archetype ID（跨容器匹配，可选）</span><input value={batchEntityArchetypeDraft} placeholder="例如 door:iron" onChange={(event) => setBatchEntityArchetypeDraft(event.target.value)} /></label></> : <div className="editor-empty">当前容器组合没有共同允许批量创建的 Entity 类型</div>}
            </section>
            <section className="batch-section">
              <div className="batch-section__title"><strong>目标 Entity</strong><span>按类型跨容器匹配</span></div>
              {compatibleBatchEntityGroups.length > 0 ? <select value={effectiveBatchEntityGroupType} onChange={(event) => { setBatchEntityGroupType(event.target.value); setBatchComponentTypeToCreate(''); setBatchComponentTypeToEdit(''); }}>{compatibleBatchEntityGroups.map((group) => <option key={group.key} value={group.key}>{ENTITY_TYPE_REGISTRY.get(group.entityType)?.label ?? group.entityType}{group.archetypeId ? ` · ${group.archetypeId}` : ' · 无 Archetype'} · {group.targets.length} 个</option>)}</select> : <div className="editor-empty">没有能在每个容器中唯一匹配的 Entity</div>}
              {batchEntityGroups.filter((group) => !group.compatible).length > 0 ? <div className="batch-readonly-list"><strong>只读 / 不兼容 Entity</strong>{batchEntityGroups.filter((group) => !group.compatible).map((group) => <div key={group.key}><span>{ENTITY_TYPE_REGISTRY.get(group.entityType)?.label ?? group.entityType}{group.archetypeId ? ` · ${group.archetypeId}` : ''}</span><em>{group.reason}</em></div>)}</div> : null}
            </section>
            {activeBatchEntityGroup ? <>
              <section className="batch-section">
                <div className="batch-section__title"><strong>批量添加 Component</strong><span>{batchComponentCreateDefinitions.length} 种可用</span></div>
                {batchComponentCreateDefinitions.length > 0 ? <><div className="batch-action-row"><select aria-label="批量添加 Component 类型" value={effectiveBatchComponentTypeToCreate} onChange={(event) => setBatchComponentTypeToCreate(event.target.value)}>{batchComponentCreateDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}</select><button type="button" className="compact-button" disabled={Boolean(pendingMutationPlan)} onClick={batchAddComponent}>生成添加计划</button></div><label className="batch-identity-field"><span>Component Slot（多实例匹配，可选）</span><input value={batchComponentSlotDraft} placeholder="例如 on-enter" onChange={(event) => setBatchComponentSlotDraft(event.target.value)} /></label></> : <div className="editor-empty">没有可安全添加到全部目标 Entity 的 Component</div>}
              </section>
              <section className="batch-section">
                <div className="batch-section__title"><strong>批量编辑 Component</strong><span>仅单实例与明确开放字段</span></div>
                {editableBatchComponentGroups.length > 0 ? <><select value={effectiveBatchComponentTypeToEdit} onChange={(event) => setBatchComponentTypeToEdit(event.target.value)}>{editableBatchComponentGroups.map((group) => <option key={group.key} value={group.key}>{COMPONENT_REGISTRY.get(group.componentType)?.label ?? group.componentType}{group.slot ? ` · Slot: ${group.slot}` : ' · 默认槽位'}</option>)}</select>{activeBatchComponentDefinition ? <div className="physics-fields batch-fields">{activeBatchComponentDefinition.fields.map(renderBatchField)}</div> : null}</> : <div className="editor-empty">共同 Component 不支持批量字段编辑，数据仍保留为只读</div>}
                {batchComponentGroups.filter((group) => !group.compatible).length > 0 ? <div className="batch-readonly-list"><strong>只读 / 不兼容 Component 槽位</strong>{batchComponentGroups.filter((group) => !group.compatible).map((group) => <div key={group.key}><span>{COMPONENT_REGISTRY.get(group.componentType)?.label ?? group.componentType}{group.slot ? ` · ${group.slot}` : ' · 无 Slot'}</span><em>{group.reason}</em></div>)}</div> : null}
              </section>
              <section className="batch-section">
                <div className="batch-section__title"><strong>共同存在的 Component</strong><span>按类型匹配，不使用实例 ID</span></div>
                <div className="batch-component-status-list">{[...new Set(batchEntityTargets.flatMap((target) => target.entity.components.map((component) => component.type)))].map((componentType) => {
                  const definition = COMPONENT_REGISTRY.get(componentType);
                  const canDelete = batchComponentDeleteDefinitions.some((item) => item.type === componentType);
                  const canEdit = batchComponentEditDefinitions.some((item) => item.type === componentType);
                  const existsEverywhere = batchEntityTargets.every((target) => target.entity.components.some((component) => component.type === componentType));
                  return <div key={componentType}><span><strong>{definition?.label ?? componentType}</strong><small>{existsEverywhere ? canEdit ? '可批量编辑' : '只读显示' : '并非所有目标都存在'}</small></span>{canDelete ? <button type="button" className="danger-button icon-button" onClick={() => batchDeleteComponent(componentType)}>删除全部同类型实例</button> : <em>{existsEverywhere ? '禁止批量删除' : '不参与批量操作'}</em>}</div>;
                })}</div>
              </section>
            </> : null}
          </div> : !selectionHasTarget ? <div className="editor-empty">当前位置没有可编辑的数据容器</div> : <>
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
                  {!entityCollapsed ? <><div className="physics-fields entity-fields"><label><span>Entity ID</span><input value={entity.id} readOnly /></label><label><span>Entity 类型</span><input value={entityDefinition ? `${entityDefinition.label} (${entity.entityType})` : `未注册 (${entity.entityType})`} readOnly /></label><label><span>名称</span><input key={`${entity.id}-name-${entity.name ?? ''}`} defaultValue={entity.name ?? ''} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; updateEntityById(entity.id, '修改 Entity 名称', (current) => ({ ...current, name: event.currentTarget.value || undefined })); delete event.currentTarget.dataset.dirty; }} /></label><label><span>原型 ID</span><input key={`${entity.id}-archetype-${entity.archetypeId ?? ''}`} defaultValue={entity.archetypeId ?? ''} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; updateEntityById(entity.id, '修改 Entity Archetype ID', (current) => ({ ...current, archetypeId: event.currentTarget.value || undefined })); delete event.currentTarget.dataset.dirty; }} /></label><label className="physics-check"><input type="checkbox" checked={entity.enabled !== false} onChange={(event) => updateEntityById(entity.id, '切换 Entity 启用状态', (current) => ({ ...current, enabled: event.target.checked }))} /><span>启用</span></label></div>
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
          </div> : null}
        </section>
        <section className="control-card pattern-controls">
          <div className="pattern-controls__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('patterns')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'patterns')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('patterns') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>地图图案</strong><small>资源自动扫描自 public</small></span></button><span>{Object.keys(PATTERN_MODULES).length} 个</span></div>
          {!collapsedPanelIds.has('patterns') ? <div className="collapsible-panel-body">
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
          </div> : null}
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
                setCanvasSelections(next);
                if (next[0]?.direction) setSelectedDirection(next[0].direction);
              }}
              keyboardEnabled={false}
            />
          </div>
        </div>
      </main>
    </div>
  );
};
