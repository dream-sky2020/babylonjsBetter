import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { validateDungeonTransitionMap } from '@/core/dungeon-transition';
import { deleteDungeonMapDocumentColumn, deleteDungeonMapDocumentRow, insertDungeonMapDocumentColumn, insertDungeonMapDocumentRow } from '@/core/map';
import { createDungeonMapData, compactGeneratedDungeonMapShells, createDungeonMapDocumentMutationPlan, encodeDungeonMapData, encodeDungeonMapDocumentLibraryV2, encodeDungeonMapDocumentLibraryV3, loadDungeonMapDocumentLibraryV2, loadDungeonMapDocumentV2, migrateDungeonMapToDocumentV2, projectDungeonMapDocumentToLegacyMap, validateDungeonMapData, DungeonMapDocumentQuery, DungeonMapDocumentStore, dungeonMapSpatialTargetKey, executeDungeonMapDocumentMutationPlan, type DungeonMapData, type DungeonMapDocumentStructureEditResult, type DungeonMapDocumentLibraryV2, type DungeonMapDocumentMutationPlan, type DungeonMapDocumentV2, type DungeonMapContainerCoordinates, type DungeonMapDirection, type DungeonMapEdge, type DungeonMapPreset, type DungeonMapPresetLibrary, type DungeonMapSharedEdge, type DungeonMapSharedPoint, type DungeonMapStructureDefaults, type DungeonMapTile, type DungeonMapTopologyMode, type DungeonMapSpatialTarget } from '@/core/map';
import { createMutationPlan, dedupeBatchContainerTargets, listBatchComponentDefinitions, listBatchEntityDefinitions, normalizeEntityContainer, resolveBatchComponentGroups, resolveBatchEntityGroups, type BatchContainerTarget, type BatchEntityTarget, type MutationPlan, type ComponentFieldSchema, type EntityContainerKind, type IComponent, type IEntity, type IEntityContainer } from '@/core/entity';
import { componentDefinitions as COMPONENT_DEFINITIONS, componentRegistry as COMPONENT_REGISTRY, createEntityFromDefinition, entityTypeDefinitions as ENTITY_TYPE_DEFINITIONS, entityTypeRegistry as ENTITY_TYPE_REGISTRY } from '@/tools/entity-container-editor';
import { type DungeonMapEntityMove, type DungeonMapEntityViewMode, type DungeonMapPatternRendering, type DungeonMapSelection, type DungeonMapSelectionMode } from '@/core/ui/DungeonMapCanvas';
import { requestDevServer } from '@/core/network/devServerPortResolver';
import { readBundledResourceAssetPaths } from '@/core/resources';
import './dungeon-map-canvas-lab.css';

export const ENTITY_TYPE_COLORS = Object.fromEntries(
  ENTITY_TYPE_DEFINITIONS.map((definition) => [definition.type, definition.labAppearance.color]),
) as Readonly<Record<string, string>>;

export const PATTERN_MODULES = Object.fromEntries(
  readBundledResourceAssetPaths()
    .filter((path) => path.startsWith('/resources/dungeon-map/') && path.toLowerCase().endsWith('.svg'))
    .map((path) => [decodeURIComponent(path), path])
) as Record<string, string>;

type PatternKind = 'walls' | 'tiles' | 'characters' | 'events' | 'edges' | 'shared-edges' | 'shared-points';

export const PATTERN_LABELS: Record<PatternKind, string> = { walls: '墙壁格', tiles: '地面格', characters: '角色', events: '事件', edges: '单格边', 'shared-edges': '公用边', 'shared-points': '公用点' };

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

export const DIRECTION_LABEL: Record<DungeonMapDirection, string> = { north: '北', east: '东', south: '南', west: '西' };

export const SELECTION_MODE_LABEL: Record<DungeonMapSelection['mode'], string> = {
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

export const selectionObjectLabel = (selection: DungeonMapSelection): string => {
  if (selection.mode === 'map') return '地图';
  if (selection.mode === 'point') return `公用点 (${selection.x}, ${selection.y})`;
  const direction = selection.direction ? ` · ${DIRECTION_LABEL[selection.direction]}侧` : '';
  return `${SELECTION_MODE_LABEL[selection.mode]} (${selection.x}, ${selection.y})${direction}`;
};

export const selectionObjectId = (selection: DungeonMapSelection): string => (
  selection.sharedEdgeId ?? selection.sharedPointId ?? selectionIdentity(selection)
);

export const SELECTION_LIST_PREVIEW_LIMIT = 100;

const SELECTION_JSON_WARNING_LIMIT = 500;

const EMPTY_BATCH_CONTAINER_TARGETS: readonly BatchContainerTarget[] = [];

const EMPTY_BATCH_ENTITY_TARGETS: readonly BatchEntityTarget[] = [];

type LabMutationPlan = {
  plan: MutationPlan;
  nativePlan: DungeonMapDocumentMutationPlan;
};

type LabPanelWorkspace = 'project' | 'inspector' | 'appearance';

type ResolvedMapContainerTarget = BatchContainerTarget & {
  coordinates: DungeonMapContainerCoordinates;
};

type DungeonMapSharedEdgeDraft = Omit<DungeonMapSharedEdge, 'edge'> & {
  edge: Omit<DungeonMapSharedEdge['edge'], 'coordinates'>;
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
  createMapData: () => ({
    entities: [{
      id: `map:${presetKey}:entity`,
      entityType: 'map',
      name: '地图实体',
      enabled: true,
      components: [COMPONENT_REGISTRY.get('scene-environment')?.createDefault()]
        .filter((component): component is IComponent => component !== undefined),
    }],
  }),
});

const STRUCTURE_EDIT_DEFAULTS: DungeonMapStructureDefaults = {};

const presetFingerprint = (preset: DungeonMapPreset): string => JSON.stringify({
  presetKey: preset.presetKey,
  name: preset.name,
  map: encodeDungeonMapData(preset.map),
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

export const valueAtPath = (value: unknown, path: string): unknown => path.split('.').reduce<unknown>(
  (current, key) => current && typeof current === 'object'
    ? (current as Record<string, unknown>)[key]
    : undefined,
  value,
);

export const valueWithPath = <T extends object>(source: T, path: string, value: unknown): T => {
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

export const useDungeonMapCanvasLabActivity = () => {
// 界面与地图显示状态
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

const [structureRowIndex, setStructureRowIndex] = useState(0);

const [structureColumnIndex, setStructureColumnIndex] = useState(0);

// 预设加载、保存与当前文档
const [mapPresets, setMapPresets] = useState<DungeonMapPresetLibrary>({});

const [mapDocuments, setMapDocuments] = useState<DungeonMapDocumentLibraryV2>({});

const [mapDocument, setMapDocument] = useState<DungeonMapDocumentV2>();

const [mapStore, setMapStore] = useState<DungeonMapDocumentStore>();

const [activePresetKey, setActivePresetKey] = useState('');

const [presetKeyDraft, setPresetKeyDraft] = useState('');

const [presetBaseMap, setPresetBaseMap] = useState<DungeonMapData>();

const [newPresetKey, setNewPresetKey] = useState('dungeon_map');

const [newPresetName, setNewPresetName] = useState('新地图预设');

const [presetMessage, setPresetMessage] = useState('正在连接 Python 服务…');

const [presetError, setPresetError] = useState(false);

const [presetSaving, setPresetSaving] = useState(false);

const [presetReloading, setPresetReloading] = useState(false);

const [savedPresetFingerprints, setSavedPresetFingerprints] = useState<Record<string, string>>({});

const [mapScale, setMapScale] = useState(1);

const mapViewportRef = useRef<HTMLDivElement>(null);
const panelScrollRef = useRef<HTMLDivElement>(null);

const [mapViewportSize, setMapViewportSize] = useState({ width: 0, height: 0 });

const [showGrid, setShowGrid] = useState(true);

const [showCoordinates, setShowCoordinates] = useState(false);

const [fogEnabled, setFogEnabled] = useState(true);

const [visited] = useState(() => new Set(['1,1']));

const options = useMemo(() => ({ walls: patternOptions('walls'), tiles: patternOptions('tiles'), characters: patternOptions('characters'), events: patternOptions('events'), edges: patternOptions('edges'), sharedEdges: patternOptions('shared-edges'), sharedPoints: patternOptions('shared-points') }), []);

const suites = useMemo(() => patternSuites(), []);

const minimalSuite = suites.find((suite) => suite.name === '极简');

const [selectedSuite, setSelectedSuite] = useState(minimalSuite?.name ?? '');

const [patternRendering, setPatternRendering] = useState<DungeonMapPatternRendering>('canvas');

const [entityViewMode, setEntityViewMode] = useState<DungeonMapEntityViewMode>('overview');

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

// 当前选择和 Inspector 状态
const [selectionMode, setSelectionMode] = useState<DungeonMapSelectionMode>('tile');

const [canvasSelections, setCanvasSelections] = useState<DungeonMapSelection[]>([{ mode: 'tile', x: 1, y: 1 }]);

const [selectionJsonMessage, setSelectionJsonMessage] = useState('');

const [loadedLargeSelectionJson, setLoadedLargeSelectionJson] = useState<{
    selection: object;
    text: string;
  }>();

const canvasSelection = canvasSelections[0];

const [selectedEntityId, setSelectedEntityId] = useState('');

const [selectedComponentId, setSelectedComponentId] = useState('');

const [componentTypeToAdd, setComponentTypeToAdd] = useState(COMPONENT_DEFINITIONS[0]?.type ?? '');

const [entityTypeToAdd, setEntityTypeToAdd] = useState(ENTITY_TYPE_DEFINITIONS[0]?.type ?? '');

// 批量编辑表单状态
const [batchEntityTypeToCreate, setBatchEntityTypeToCreate] = useState('');

const [batchEntityArchetypeDraft, setBatchEntityArchetypeDraft] = useState('');

const [batchEntityGroupType, setBatchEntityGroupType] = useState('');

const [batchComponentTypeToCreate, setBatchComponentTypeToCreate] = useState('');

const [batchComponentSlotDraft, setBatchComponentSlotDraft] = useState('');

const [batchComponentTypeToEdit, setBatchComponentTypeToEdit] = useState('');

const [pendingMutationPlan, setPendingMutationPlan] = useState<LabMutationPlan>();

const [collapsedPanelIds, setCollapsedPanelIds] = useState<Set<string>>(() => new Set());

const [panelWorkspace, setPanelWorkspace] = useState<LabPanelWorkspace>('project');

const [navigatingWorkspace, setNavigatingWorkspace] = useState<LabPanelWorkspace | undefined>(undefined);

const navigatingWorkspaceRef = useRef<LabPanelWorkspace | undefined>(undefined);

useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport) {
      console.warn('[DungeonMapCanvasLab] View 缺少地图视口 ref。');
      return;
    }
    const updateSize = () => setMapViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

useEffect(() => {
    const scroller = panelScrollRef.current;
    if (!scroller) {
      console.warn('[DungeonMapCanvasLab] View 缺少面板滚动区 ref。');
      return;
    }
    const sections: Array<[LabPanelWorkspace, string]> = [
      ['project', 'lab-project-section'],
      ['inspector', 'lab-inspector-section'],
      ['appearance', 'lab-appearance-section'],
    ];
    const updateActiveSection = () => {
      const activationLine = scroller.getBoundingClientRect().top + 76;
      let active: LabPanelWorkspace = 'project';
      sections.forEach(([workspace, id]) => {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= activationLine) active = workspace;
      });
      setPanelWorkspace(active);
      const navigationTarget = navigatingWorkspaceRef.current;
      if (navigationTarget) {
        const target = document.getElementById(`lab-${navigationTarget}-section`);
        const reachedTarget = target && Math.abs(target.getBoundingClientRect().top - activationLine) <= 12;
        const reachedBottomTarget = navigationTarget === 'appearance'
          && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
        if (reachedTarget || reachedBottomTarget) {
          navigatingWorkspaceRef.current = undefined;
          setNavigatingWorkspace(undefined);
        }
      }
    };
    const cancelNavigation = () => {
      if (!navigatingWorkspaceRef.current) return;
      navigatingWorkspaceRef.current = undefined;
      setNavigatingWorkspace(undefined);
    };
    scroller.addEventListener('scroll', updateActiveSection, { passive: true });
    scroller.addEventListener('wheel', cancelNavigation, { passive: true });
    scroller.addEventListener('touchstart', cancelNavigation, { passive: true });
    updateActiveSection();
    return () => {
      scroller.removeEventListener('scroll', updateActiveSection);
      scroller.removeEventListener('wheel', cancelNavigation);
      scroller.removeEventListener('touchstart', cancelNavigation);
    };
  }, []);

const fittedMapScale = useMemo(() => {
    const sharedThickness = Math.max(0, cellSize * sharedEdgeThicknessRatio);
    const gap = sharedThickness;
    const topologyMargin = sharedThickness > 0 ? gap : 0;
    const naturalWidth = mapWidth * cellSize + Math.max(0, mapWidth - 1) * gap + topologyMargin * 2 + canvasOuterPadding * 2;
    const naturalHeight = mapHeight * cellSize + Math.max(0, mapHeight - 1) * gap + topologyMargin * 2 + canvasOuterPadding * 2;
    const width = Math.max(naturalWidth, minCanvasWidth);
    const height = Math.max(naturalHeight, minCanvasHeight);
    if (!mapViewportSize.width || !mapViewportSize.height) return 1;
    return Math.max(0.05, Math.min(mapViewportSize.width / width, mapViewportSize.height / height));
  }, [canvasOuterPadding, cellSize, mapHeight, mapViewportSize, mapWidth, minCanvasHeight, minCanvasWidth, sharedEdgeThicknessRatio]);

const map = useMemo<DungeonMapData>(() => {
    if (mapDocument) return projectDungeonMapDocumentToLegacyMap(mapDocument);
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
      sharedEdges: [...generatedSharedEdges, ...([
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
      ] satisfies DungeonMapSharedEdgeDraft[])]
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
  }, [fogEnabled, visited, mapWidth, mapHeight, topologyMode, mapDataEdits, tileDataEdits, tileEdgeDataEdits, sharedEdgeEdits, sharedPointEdits, presetBaseMap, mapDocument]);

// 文档装载与预设操作
const clearMapEdits = () => {
    setMapDataEdits(undefined);
    setTileDataEdits({});
    setTileEdgeDataEdits({});
    setSharedEdgeEdits({});
    setSharedPointEdits({});
    setSelectedEntityId('');
    setSelectedComponentId('');
    setPendingMutationPlan(undefined);
  };

const installDocumentStore = (document: DungeonMapDocumentV2) => {
    const store = new DungeonMapDocumentStore(document);
    setMapStore(store);
    setMapDocument(store.getDocument());
  };

const loadDocumentIntoEditor = (document: DungeonMapDocumentV2) => {
    const projectedMap = projectDungeonMapDocumentToLegacyMap(document);
    const nextMode = document.grid.topologyMode;
    clearMapEdits();
    installDocumentStore(document);
    setActivePresetKey(document.identity.presetKey);
    setPresetKeyDraft(document.identity.presetKey);
    setPresetBaseMap(projectedMap);
    setMapWidth(document.grid.width);
    setMapHeight(document.grid.height);
    setTopologyMode(nextMode);
    setDraftMapWidth(document.grid.width);
    setDraftMapHeight(document.grid.height);
    setDraftTopologyMode(nextMode);
    setCanvasSelections([{ mode: 'tile', x: 0, y: 0 }]);
  };

useEffect(() => {
    if (!mapStore) return undefined;
    return mapStore.subscribe((change) => {
      setMapDocument(change.document);
      setMapWidth(change.document.grid.width);
      setMapHeight(change.document.grid.height);
      setTopologyMode(change.document.grid.topologyMode);
      setDraftMapWidth(change.document.grid.width);
      setDraftMapHeight(change.document.grid.height);
      setDraftTopologyMode(change.document.grid.topologyMode);
    });
  }, [mapStore]);

useEffect(() => {
    let active = true;
    loadDungeonMapDocumentLibraryV2()
      .then((loadedDocuments) => {
        if (!active) return;
        const documents = Object.fromEntries(Object.entries(loadedDocuments).map(([key, document]) => [key, {
          ...document,
          identity: { ...document.identity, presetKey: key },
        }])) as DungeonMapDocumentLibraryV2;
        const library = normalizedPresetLibrary(Object.fromEntries(Object.entries(documents).map(([key, document]) => [key, {
          presetKey: key,
          name: document.identity.name,
          map: projectDungeonMapDocumentToLegacyMap(document),
        }])));
        setMapDocuments(documents);
        setMapPresets(library);
        setSavedPresetFingerprints(Object.fromEntries(
          Object.entries(library).map(([key, preset]) => [key, presetFingerprint(preset)]),
        ));
        const first = Object.values(documents)[0];
        if (first) {
          loadDocumentIntoEditor(first);
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
    if (activePresetKey && mapPresets[activePresetKey] && mapDocument) {
      setMapPresets((current) => ({
        ...current,
        [activePresetKey]: { ...current[activePresetKey], map },
      }));
      setMapDocuments((current) => ({ ...current, [activePresetKey]: mapDocument }));
    }
    const document = mapDocuments[key] ?? migrateDungeonMapToDocumentV2(preset).document;
    loadDocumentIntoEditor(document);
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
    const document = migrateDungeonMapToDocumentV2(preset).document;
    setMapDocuments((current) => ({
      ...current,
      ...(activePresetKey && mapDocument ? { [activePresetKey]: mapDocument } : {}),
      [key]: document,
    }));
    loadDocumentIntoEditor(document);
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
    const currentDocument = mapDocument ?? migrateDungeonMapToDocumentV2(sourcePreset).document;
    const renamedDocument: DungeonMapDocumentV2 = {
      ...currentDocument,
      identity: { ...currentDocument.identity, presetKey: toKey, name: sourcePreset.name },
    };
    setMapDocuments((current) => {
      const next = { ...current };
      delete next[fromKey];
      next[toKey] = renamedDocument;
      return next;
    });
    installDocumentStore(renamedDocument);
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
    const sourceDocument = mapDocument ?? migrateDungeonMapToDocumentV2(sourcePreset).document;
    const copiedDocument: DungeonMapDocumentV2 = structuredClone({
      ...sourceDocument,
      identity: {
        ...sourceDocument.identity,
        id: copiedMap.id,
        presetKey: key,
        name: copiedPreset.name,
      },
    });
    setMapDocuments((current) => ({
      ...current,
      ...(activePresetKey && mapDocument ? { [activePresetKey]: mapDocument } : {}),
      [key]: copiedDocument,
    }));
    loadDocumentIntoEditor(copiedDocument);
    setPresetError(false);
    setPresetMessage(`已复制地图预设为 ${copiedPreset.name}；点击“保存全部预设”写入 config。`);
  };

const deleteMapPreset = () => {
    const sourcePreset = mapPresets[activePresetKey];
    if (!sourcePreset || !window.confirm(`删除地图预设“${sourcePreset.name}”？`)) return;
    const nextLibrary = { ...mapPresets };
    delete nextLibrary[activePresetKey];
    setMapPresets(nextLibrary);
    const nextDocuments = { ...mapDocuments };
    delete nextDocuments[activePresetKey];
    setMapDocuments(nextDocuments);
    const nextPreset = Object.values(nextLibrary)[0];
    if (nextPreset) {
      const nextDocument = nextDocuments[nextPreset.presetKey]
        ?? migrateDungeonMapToDocumentV2(nextPreset).document;
      loadDocumentIntoEditor(nextDocument);
    } else {
      setMapStore(undefined);
      setMapDocument(undefined);
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
    const normalizedLegacyLibrary = Object.fromEntries(Object.entries(currentLibrary).map(([key, preset]) => [key, {
      ...preset,
      presetKey: key,
      name: preset.name.trim() || key,
    }])) as DungeonMapPresetLibrary;
    const runtimeDocuments = encodeDungeonMapDocumentLibraryV2(Object.fromEntries(
      Object.entries(normalizedLegacyLibrary).map(([key, preset]) => {
        const source = key === activePresetKey && mapDocument
          ? mapDocument
          : mapDocuments[key] ?? migrateDungeonMapToDocumentV2(preset).document;
        return [key, {
          ...source,
          identity: { ...source.identity, presetKey: key, name: preset.name },
        }];
      }),
    ));
    const documentPayload = encodeDungeonMapDocumentLibraryV3(runtimeDocuments);
    setPresetSaving(true);
    try {
      const response = await requestDevServer('/api/dungeon-map-presets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentPayload),
      });
      const result = await response.json() as { success?: boolean; message?: string; errors?: string[] };
      if (!response.ok || result.success === false) throw new Error(result.errors?.[0] ?? result.message ?? `HTTP ${response.status}`);
      setMapDocuments(runtimeDocuments);
      setMapPresets(normalizedLegacyLibrary);
      setSavedPresetFingerprints(Object.fromEntries(
        Object.entries(normalizedLegacyLibrary).map(([key, preset]) => [key, presetFingerprint(preset)]),
      ));
      mapStore?.markSaved();
      setPresetError(false);
      setPresetMessage(`已保存 ${Object.keys(documentPayload).length} 个紧凑 V3 地图文档到 config/dungeonMapPresets/。`);
    } catch (error) {
      setPresetError(true);
      setPresetMessage(`地图预设保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPresetSaving(false);
    }
  };

const activePreset = activePresetKey ? mapPresets[activePresetKey] : undefined;

const hasUnsavedCurrentPreset = !!activePreset && savedPresetFingerprints[activePresetKey]
    !== presetFingerprint({ ...activePreset, map }) || Boolean(mapStore?.dirty);

const topologyShellCleanupPreview = useMemo(() => {
    if (!mapDocument) return { entityCount: 0, componentCount: 0 };
    const compacted = compactGeneratedDungeonMapShells(mapDocument);
    const componentCount = (document: DungeonMapDocumentV2) => Object.values(document.components)
      .reduce((total, table) => total + table.length, 0);
    return {
      entityCount: mapDocument.entities.length - compacted.entities.length,
      componentCount: componentCount(mapDocument) - componentCount(compacted),
    };
  }, [mapDocument]);

const cleanupGeneratedTopologyShells = () => {
    if (!mapStore || topologyShellCleanupPreview.entityCount === 0) {
      setPresetError(false);
      setPresetMessage('当前地图没有可清理的自动生成拓扑占位 Entity。');
      return;
    }
    const removedEntities = topologyShellCleanupPreview.entityCount;
    const removedComponents = topologyShellCleanupPreview.componentCount;
    mapStore.execute({
      label: '清理自动生成的拓扑占位 Entity',
      apply: compactGeneratedDungeonMapShells,
    });
    setSelectedEntityId('');
    setSelectedComponentId('');
    setPresetError(false);
    setPresetMessage(`已清理 ${removedEntities} 个拓扑占位 Entity 和 ${removedComponents} 个关联 Component；可撤销，保存后写入 config。`);
  };

const reloadCurrentPreset = async () => {
    if (!activePresetKey) return;
    if (hasUnsavedCurrentPreset
      && !window.confirm('重新加载会丢弃当前地图尚未保存的全部修改，确定继续吗？')) return;
    setPresetReloading(true);
    try {
      const loadedDocument = await loadDungeonMapDocumentV2(activePresetKey);
      const loaded: DungeonMapPreset = {
        presetKey: loadedDocument.identity.presetKey,
        name: loadedDocument.identity.name,
        map: projectDungeonMapDocumentToLegacyMap(loadedDocument),
      };
      setMapDocuments((current) => ({ ...current, [activePresetKey]: loadedDocument }));
      setMapPresets((current) => ({ ...current, [activePresetKey]: loaded }));
      setSavedPresetFingerprints((current) => ({
        ...current,
        [activePresetKey]: presetFingerprint(loaded),
      }));
      loadDocumentIntoEditor(loadedDocument);
      setPresetError(false);
      setPresetMessage(`已从 config 重新加载地图预设：${loaded.name}`);
    } catch (error) {
      setPresetError(true);
      setPresetMessage(`重新加载失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPresetReloading(false);
    }
  };

const structureSelection = canvasSelection?.mode === 'map' ? null : canvasSelection;

const targetRow = structureSelection
    ? Math.max(0, Math.min(map.height - 1, structureSelection.y))
    : Math.max(0, Math.min(map.height - 1, structureRowIndex));

const targetColumn = structureSelection
    ? Math.max(0, Math.min(map.width - 1, structureSelection.x))
    : Math.max(0, Math.min(map.width - 1, structureColumnIndex));

const describeStructureImpact = (result: DungeonMapDocumentStructureEditResult): string => {
    const { impact } = result;
    const details = [
      impact.removedTiles ? `格子 ${impact.removedTiles} 个` : '',
      impact.removedEntities ? `Entity ${impact.removedEntities} 个` : '',
      impact.removedEntranceIds.length ? `入口：${impact.removedEntranceIds.join('、')}` : '',
      impact.removedExitEntityIds.length ? `出口：${impact.removedExitEntityIds.join('、')}` : '',
      impact.removedObstacleEntityIds.length ? `阻碍：${impact.removedObstacleEntityIds.join('、')}` : '',
      impact.removedMarkerIds.length ? `Marker：${impact.removedMarkerIds.join('、')}` : '',
    ].filter(Boolean);
    return details.join('\n');
  };

const commitStructureEdit = (
    label: string,
    createResult: () => DungeonMapDocumentStructureEditResult,
    nextSelection: (nextDocument: DungeonMapDocumentV2) => Readonly<{ x: number; y: number }>,
  ) => {
    try {
      const result = createResult();
      const impact = describeStructureImpact(result);
      if (impact && !window.confirm(`${label}会移除或重建以下数据：\n${impact}\n\n确定继续吗？`)) return;
      const selection = nextSelection(result.document);
      clearMapEdits();
      const nextDocument = result.document;
      const store = mapStore;
      if (store) store.execute({ label, apply: () => nextDocument });
      else installDocumentStore(nextDocument);
      setMapWidth(nextDocument.grid.width);
      setMapHeight(nextDocument.grid.height);
      setDraftMapWidth(nextDocument.grid.width);
      setDraftMapHeight(nextDocument.grid.height);
      setCanvasSelections([{ mode: 'tile', x: selection.x, y: selection.y }]);
      if (activePresetKey && activePreset) {
        const projectedMap = projectDungeonMapDocumentToLegacyMap(nextDocument);
        setMapPresets((current) => {
          const preset = current[activePresetKey];
          return preset ? {
            ...current,
            [activePresetKey]: { ...preset, map: projectedMap },
          } : current;
        });
      }
      setPresetError(false);
      setPresetMessage(`${label}完成；当前地图为 ${nextDocument.grid.width} × ${nextDocument.grid.height}，点击“保存全部地图预设”写入 config。`);
    } catch (error) {
      setPresetError(true);
      setPresetMessage(`${label}失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

const structureSelectionX = Math.max(0, Math.min(map.width - 1, structureSelection?.x ?? targetColumn));

const structureSelectionY = Math.max(0, Math.min(map.height - 1, structureSelection?.y ?? targetRow));

// 地图行列结构修改
const runStructureEdit = (
    label: string,
    createResult: () => DungeonMapDocumentStructureEditResult,
    nextX: (nextDocument: DungeonMapDocumentV2) => number,
    nextY: (nextDocument: DungeonMapDocumentV2) => number,
  ) => commitStructureEdit(label, createResult, (nextDocument) => ({
    x: Math.max(0, Math.min(nextDocument.grid.width - 1, nextX(nextDocument))),
    y: Math.max(0, Math.min(nextDocument.grid.height - 1, nextY(nextDocument))),
  }));

const editStructure = (action: 'insert-row-above' | 'insert-row-below' | 'delete-row' | 'insert-column-left' | 'insert-column-right' | 'delete-column') => {
  if (!mapDocument) return;
  switch (action) {
    case 'insert-row-above':
      return runStructureEdit('在上方插入一行', () => insertDungeonMapDocumentRow(mapDocument, targetRow, STRUCTURE_EDIT_DEFAULTS), () => structureSelectionX, () => structureSelectionY + 1);
    case 'insert-row-below':
      return runStructureEdit('在下方插入一行', () => insertDungeonMapDocumentRow(mapDocument, targetRow + 1, STRUCTURE_EDIT_DEFAULTS), () => structureSelectionX, () => structureSelectionY);
    case 'delete-row':
      return runStructureEdit('删除当前行', () => deleteDungeonMapDocumentRow(mapDocument, targetRow, STRUCTURE_EDIT_DEFAULTS), () => structureSelectionX, (nextDocument) => Math.min(targetRow, nextDocument.grid.height - 1));
    case 'insert-column-left':
      return runStructureEdit('在左侧插入一列', () => insertDungeonMapDocumentColumn(mapDocument, targetColumn, STRUCTURE_EDIT_DEFAULTS), () => structureSelectionX + 1, () => structureSelectionY);
    case 'insert-column-right':
      return runStructureEdit('在右侧插入一列', () => insertDungeonMapDocumentColumn(mapDocument, targetColumn + 1, STRUCTURE_EDIT_DEFAULTS), () => structureSelectionX, () => structureSelectionY);
    case 'delete-column':
      return runStructureEdit('删除当前列', () => deleteDungeonMapDocumentColumn(mapDocument, targetColumn, STRUCTURE_EDIT_DEFAULTS), (nextDocument) => Math.min(targetColumn, nextDocument.grid.width - 1), () => structureSelectionY);
  }
};

const renameCurrentPreset = (name: string) => {
  if (!activePresetKey) return;
  setMapPresets((current) => {
    const preset = current[activePresetKey];
    return preset ? { ...current, [activePresetKey]: { ...preset, name } } : current;
  });
};

const cancelMutationPlan = () => setPendingMutationPlan(undefined);

const selectEntity = (entityId: string) => {
  setSelectedEntityId(entityId);
  setSelectedComponentId('');
};

const selectEntityAt = (entityId: string, location: DungeonMapSelection) => {
  selectEntity(entityId);
  setCanvasSelections([location]);
};

const validationIssues = useMemo(() => [
    ...validateDungeonMapData(map),
    ...validateDungeonTransitionMap(map),
  ], [map]);

const sharedEdgeById = useMemo(() => new Map(
    (map.sharedEdges ?? []).map((edge) => [edge.id, edge]),
  ), [map.sharedEdges]);

const sharedPointById = useMemo(() => new Map(
    (map.sharedPoints ?? []).map((point) => [point.id, point]),
  ), [map.sharedPoints]);

const documentQuery = useMemo(
    () => mapDocument ? new DungeonMapDocumentQuery(mapDocument) : undefined,
    [mapDocument],
  );

const resolveDocumentSpatialTarget = useCallback((
    selection: DungeonMapSelection,
  ): DungeonMapSpatialTarget | undefined => {
    if (!documentQuery) return undefined;
    if (selection.mode === 'map') return { kind: 'map' };
    if (selection.mode === 'shared') return selection.sharedEdgeId
      && documentQuery.indexes.edgeById.has(selection.sharedEdgeId)
      ? { kind: 'edge', edgeId: selection.sharedEdgeId }
      : undefined;
    if (selection.mode === 'point') return selection.sharedPointId
      && documentQuery.indexes.pointById.has(selection.sharedPointId)
      ? { kind: 'point', pointId: selection.sharedPointId }
      : undefined;
    const tileId = documentQuery.getTileIdAt(selection.x, selection.y);
    if (!tileId) return undefined;
    if (selection.mode === 'tile') return { kind: 'tile', tileId };
    const side = documentQuery.getSide(tileId, selection.direction ?? selectedDirection);
    return side ? { kind: 'side', sideId: side.id } : undefined;
  }, [documentQuery, selectedDirection]);

const selectedSpatialTarget = canvasSelection
    ? resolveDocumentSpatialTarget(canvasSelection)
    : undefined;

const selectionHasTarget = selectedSpatialTarget !== undefined;

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

const selectedContainerData = selectedSpatialTarget && documentQuery
    ? documentQuery.getContainerAt(selectedSpatialTarget)
    : undefined;

const resolveSelectionTarget = useCallback((selection: DungeonMapSelection): ResolvedMapContainerTarget | undefined => {
    const spatialTarget = resolveDocumentSpatialTarget(selection);
    if (!spatialTarget || !documentQuery) return undefined;
    const tile = map.tiles[selection.y * map.width + selection.x];
    const direction = selection.direction ?? selectedDirection;
    const sharedEdge = selection.sharedEdgeId ? sharedEdgeById.get(selection.sharedEdgeId) : undefined;
    const sharedPoint = selection.sharedPointId ? sharedPointById.get(selection.sharedPointId) : undefined;
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
        ? tile?.coordinates
        : selection.mode === 'edge'
          ? tile?.edges[direction].coordinates
          : selection.mode === 'shared'
            ? sharedEdge?.edge.coordinates
            : sharedPoint?.point.coordinates;
    if (!coordinates) return undefined;
    return {
      id: dungeonMapSpatialTargetKey(spatialTarget),
      kind,
      coordinates,
      container: documentQuery.getContainerAt(spatialTarget),
    };
  }, [documentQuery, map, resolveDocumentSpatialTarget, selectedDirection, sharedEdgeById, sharedPointById]);

const { uniqueBatchSelections, batchContainerTargets } = useMemo(() => {
    const unique = new Map<string, { selection: DungeonMapSelection; target: ResolvedMapContainerTarget }>();
    canvasSelections.forEach((selection) => {
      const target = resolveSelectionTarget(selection);
      if (target) unique.set(target.id, { selection, target });
    });
    const selections = [...unique.values()];
    return {
      uniqueBatchSelections: selections,
      batchContainerTargets: dedupeBatchContainerTargets(selections.map((item) => item.target)),
    };
  }, [canvasSelections, resolveSelectionTarget]);

const currentLoadedLargeSelectionJson = loadedLargeSelectionJson?.selection === uniqueBatchSelections
    ? loadedLargeSelectionJson
    : undefined;

const largeSelectionJsonRequiresConfirmation = uniqueBatchSelections.length > SELECTION_JSON_WARNING_LIMIT
    && !currentLoadedLargeSelectionJson;

const selectionJsonCollapsed = collapsedPanelIds.has('selection-json')
    || largeSelectionJsonRequiresConfirmation;

const buildSelectedContainersJsonText = useCallback(() => JSON.stringify({
    format: 'dungeon-map-container-selection',
    version: 1,
    mapId: map.id,
    count: uniqueBatchSelections.length,
    containers: uniqueBatchSelections.map(({ target }) => ({
      id: target.id,
      coordinates: target.coordinates,
      data: target.container,
    })),
  }, null, 2), [map.id, uniqueBatchSelections]);

const selectionJsonExpanded = !collapsedPanelIds.has('selection')
    && !selectionJsonCollapsed;

const selectedContainersJsonText = useMemo(
    () => selectionJsonExpanded
      ? currentLoadedLargeSelectionJson?.text ?? buildSelectedContainersJsonText()
      : '',
    [buildSelectedContainersJsonText, currentLoadedLargeSelectionJson, selectionJsonExpanded],
  );

const copySelectedContainersJson = async () => {
    const text = currentLoadedLargeSelectionJson?.text ?? buildSelectedContainersJsonText();
    try {
      await navigator.clipboard.writeText(text);
      setSelectionJsonMessage(`已复制 ${uniqueBatchSelections.length} 个数据容器`);
    } catch {
      setSelectionJsonMessage('复制失败：当前环境不允许访问剪贴板');
    }
  };

const downloadSelectedContainersJson = () => {
    const text = currentLoadedLargeSelectionJson?.text ?? buildSelectedContainersJsonText();
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${map.id.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'dungeon-map'}-selection.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setSelectionJsonMessage(`已下载 ${uniqueBatchSelections.length} 个数据容器`);
  };

const removeSelectedContainer = (containerId: string) => {
    setSelectionJsonMessage('');
    setCanvasSelections((current) => current.filter(
      (selection) => resolveSelectionTarget(selection)?.id !== containerId,
    ));
  };

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

// 单个 Entity / Component 操作
const updateEntityById = (entityId: string, label: string, updater: (entity: IEntity) => IEntity) => {
    const current = documentQuery?.getEntitySnapshot(entityId);
    if (!current || !mapStore || pendingMutationPlan) return;
    const next = updater(current);
    mapStore.updateEntity(entityId, {
      entityType: next.entityType,
      name: next.name,
      archetypeId: next.archetypeId,
      enabled: next.enabled,
    }, label);
  };

const addEntityToSelection = () => {
    const definition = ENTITY_TYPE_REGISTRY.get(effectiveEntityTypeToAdd);
    if (!definition || !ENTITY_TYPE_REGISTRY.canCreateIn(definition.type, selectedContainerKind)) return;
    if (definition.allowMultiplePerContainer === false
      && selectedContainerData?.entities.some((entity) => entity.entityType === definition.type)) return;
    if (!selectedSpatialTarget || !mapStore || pendingMutationPlan) return;
    const entity = createEntityFromDefinition(definition);
    mapStore.addEntityAt(selectedSpatialTarget, entity, `添加 Entity：${definition.label}`);
    setSelectedEntityId(entity.id);
    setSelectedComponentId('');
  };

const removeEntityById = (entityId: string) => {
    if (!selectedSpatialTarget || !mapStore || pendingMutationPlan) return;
    mapStore.removeEntityAt(selectedSpatialTarget, entityId, '删除 Entity');
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
    if (!mapStore || pendingMutationPlan) return;
    const component = definition.createDefault();
    mapStore.addComponent({ ...component, entityId }, `添加 Component：${definition.label}`);
    setSelectedEntityId(entityId);
    setSelectedComponentId(component.id);
  };

const updateComponentById = (entityId: string, componentId: string, label: string, updater: (component: IComponent) => IComponent) => {
    const entity = documentQuery?.getEntitySnapshot(entityId);
    const current = entity?.components.find(({ id }) => id === componentId);
    if (!current || !mapStore || pendingMutationPlan) return;
    const next = updater(current);
    mapStore.replaceComponent(componentId, next, label);
  };

const removeComponentById = (entityId: string, componentId: string) => {
    const entity = selectedContainerData?.entities.find((item) => item.id === entityId);
    const component = entity?.components.find((item) => item.id === componentId);
    const requiredComponents = entity ? ENTITY_TYPE_REGISTRY.get(entity.entityType)?.requiredComponents ?? [] : [];
    if (component && requiredComponents.includes(component.type)) return;
    if (!mapStore || pendingMutationPlan) return;
    mapStore.removeComponent(componentId, `删除 Component：${component?.type ?? componentId}`);
    setSelectedComponentId('');
  };

const reset = () => {
    const document = mapDocuments[activePresetKey];
    if (document) loadDocumentIntoEditor(document);
    else clearMapEdits();
  };

const handleCanvasSelectionsChange = useCallback((next: DungeonMapSelection[]) => {
    setSelectionJsonMessage('');
    setCanvasSelections(next);
    if (next[0]?.direction) setSelectedDirection(next[0].direction);
  }, []);

const handleEntityMove = useCallback((move: DungeonMapEntityMove) => {
    if (!mapStore || !documentQuery || pendingMutationPlan) return;
    const fromTarget = resolveDocumentSpatialTarget(move.from);
    const toTarget = resolveDocumentSpatialTarget(move.to);
    if (!fromTarget || !toTarget) {
      setPresetError(true);
      setPresetMessage('Entity 移动失败：源位置或目标位置无效。');
      return;
    }
    const sourceEntity = documentQuery.getEntitySnapshot(move.entityId);
    if (!sourceEntity) {
      setPresetError(true);
      setPresetMessage(`Entity 移动失败：找不到 ${move.entityId}。`);
      return;
    }
    const targetKind: EntityContainerKind = move.to.mode === 'map'
      ? 'map'
      : move.to.mode === 'tile'
        ? 'tile'
        : move.to.mode === 'edge'
          ? 'tile-edge'
          : move.to.mode === 'shared'
            ? 'shared-edge'
            : 'shared-point';
    const definition = ENTITY_TYPE_REGISTRY.get(sourceEntity.entityType);
    if (definition && !definition.allowedContainers.includes(targetKind)) {
      setPresetError(true);
      setPresetMessage(`不能把“${sourceEntity.name || sourceEntity.entityType}”放入${targetKind}容器。`);
      return;
    }
    const targetContainer = documentQuery.getContainerAt(toTarget);
    const sameTarget = dungeonMapSpatialTargetKey(fromTarget) === dungeonMapSpatialTargetKey(toTarget);
    if (!sameTarget && definition?.allowMultiplePerContainer === false
      && targetContainer.entities.some((entity) => (
        entity.id !== sourceEntity.id && entity.entityType === sourceEntity.entityType
      ))) {
      setPresetError(true);
      setPresetMessage(`目标位置已经存在“${definition.label}”，不能重复放置。`);
      return;
    }
    try {
      if (move.copy) {
        mapStore.attachEntity(move.entityId, toTarget, `复制挂载 Entity：${sourceEntity.name || sourceEntity.entityType}`);
      } else if (!sameTarget) {
        mapStore.moveEntity(move.entityId, fromTarget, toTarget, `移动 Entity：${sourceEntity.name || sourceEntity.entityType}`);
      }
      setSelectedEntityId(move.entityId);
      setSelectedComponentId('');
      setCanvasSelections([move.to]);
      setPresetError(false);
      setPresetMessage(move.copy ? '已复制 Entity 挂载。' : '已移动 Entity。');
    } catch (error) {
      setPresetError(true);
      setPresetMessage(`Entity 移动失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }, [documentQuery, mapStore, pendingMutationPlan, resolveDocumentSpatialTarget]);

const selectionCounts = useMemo(() => canvasSelections.reduce<Record<DungeonMapSelection['mode'], number>>(
    (counts, item) => {
      counts[item.mode] += 1;
      return counts;
    },
    { map: 0, tile: 0, edge: 0, shared: 0, point: 0 },
  ), [canvasSelections]);

const selectionCountSummary = useMemo(() => (['map', 'tile', 'edge', 'shared', 'point'] as const)
    .filter((mode) => selectionCounts[mode] > 0)
    .map((mode) => `${SELECTION_MODE_LABEL[mode]} ${selectionCounts[mode]}`)
    .join(' · '), [selectionCounts]);

const batchAnalysisTargets = canvasSelections.length > 1
    && !collapsedPanelIds.has('entity-component')
    ? batchContainerTargets
    : EMPTY_BATCH_CONTAINER_TARGETS;

const {
    batchEntityDefinitions,
    batchEntityGroups,
    compatibleBatchEntityGroups,
  } = useMemo(() => {
    const definitions = listBatchEntityDefinitions(
      ENTITY_TYPE_DEFINITIONS,
      batchAnalysisTargets,
      'create',
    );
    const groups = resolveBatchEntityGroups(batchAnalysisTargets);
    return {
      batchEntityDefinitions: definitions,
      batchEntityGroups: groups,
      compatibleBatchEntityGroups: groups.filter((group) => group.compatible),
    };
  }, [batchAnalysisTargets]);

const effectiveBatchEntityTypeToCreate = batchEntityDefinitions.some(
    (definition) => definition.type === batchEntityTypeToCreate,
  ) ? batchEntityTypeToCreate : batchEntityDefinitions[0]?.type ?? '';

const effectiveBatchEntityGroupType = compatibleBatchEntityGroups.some(
    (group) => group.key === batchEntityGroupType,
  ) ? batchEntityGroupType : compatibleBatchEntityGroups[0]?.key ?? '';

const activeBatchEntityGroup = compatibleBatchEntityGroups.find(
    (group) => group.key === effectiveBatchEntityGroupType,
  );

const batchEntityTargets = activeBatchEntityGroup?.targets ?? EMPTY_BATCH_ENTITY_TARGETS;

const {
    batchComponentCreateDefinitions,
    batchComponentEditDefinitions,
    batchComponentGroups,
    batchComponentDeleteDefinitions,
  } = useMemo(() => {
    const createDefinitions = listBatchComponentDefinitions(
      COMPONENT_DEFINITIONS,
      batchEntityTargets,
      'create',
    );
    const editDefinitions = listBatchComponentDefinitions(
      COMPONENT_DEFINITIONS,
      batchEntityTargets,
      'edit',
    );
    const groups = resolveBatchComponentGroups(batchEntityTargets);
    const deleteDefinitions = listBatchComponentDefinitions(
      COMPONENT_DEFINITIONS,
      batchEntityTargets,
      'delete',
    ).filter((definition) => batchEntityTargets.every((target) => !(
      ENTITY_TYPE_REGISTRY.get(target.entity.entityType)?.requiredComponents ?? []
    ).includes(definition.type)));
    return {
      batchComponentCreateDefinitions: createDefinitions,
      batchComponentEditDefinitions: editDefinitions,
      batchComponentGroups: groups,
      batchComponentDeleteDefinitions: deleteDefinitions,
    };
  }, [batchEntityTargets]);

const effectiveBatchComponentTypeToCreate = batchComponentCreateDefinitions.some(
    (definition) => definition.type === batchComponentTypeToCreate,
  ) ? batchComponentTypeToCreate : batchComponentCreateDefinitions[0]?.type ?? '';

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

// 批量操作的预览、确认、撤销与重做
const queueBatchPlan = (
    label: string,
    operation: string,
    updater: (target: BatchContainerTarget) => IEntityContainer,
  ) => {
    if (pendingMutationPlan || !mapStore) return;
    const plan = createMutationPlan(label, operation, batchContainerTargets, updater);
    const spatialTargetById = new Map(uniqueBatchSelections.flatMap(({ selection, target }) => {
      const spatialTarget = resolveDocumentSpatialTarget(selection);
      return spatialTarget ? [[target.id, spatialTarget] as const] : [];
    }));
    const nativePlan = createDungeonMapDocumentMutationPlan(
      mapStore.getDocument(),
      label,
      plan.changes.flatMap((change) => {
        const target = spatialTargetById.get(change.targetId);
        return target ? [{ target, before: change.before, after: change.after }] : [];
      }),
    );
    setPendingMutationPlan({
      plan: {
        ...plan,
        blockedReasons: [...plan.blockedReasons, ...nativePlan.blockedReasons],
      },
      nativePlan,
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

const confirmMutationPlan = () => {
    if (!pendingMutationPlan || pendingMutationPlan.plan.blockedReasons.length > 0 || pendingMutationPlan.plan.changes.length === 0) return;
    const store = mapStore;
    if (!store) return;
    try {
      executeDungeonMapDocumentMutationPlan(store, pendingMutationPlan.nativePlan);
      setPendingMutationPlan(undefined);
    } catch (error) {
      setPresetError(true);
      setPresetMessage(`批量修改失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

const undoMutationPlan = () => {
    if (pendingMutationPlan) return;
    mapStore?.undo();
  };

const redoMutationPlan = () => {
    if (pendingMutationPlan) return;
    mapStore?.redo();
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

const toggleSelectionJson = () => {
    if (!selectionJsonCollapsed) {
      setCollapsedPanelIds((ids) => new Set(ids).add('selection-json'));
      return;
    }
    if (largeSelectionJsonRequiresConfirmation && !window.confirm(
      `当前选择包含 ${uniqueBatchSelections.length} 个数据容器。展开完整 JSON 可能造成短暂卡顿，确定继续吗？`,
    )) return;
    if (largeSelectionJsonRequiresConfirmation) {
      setLoadedLargeSelectionJson({
        selection: uniqueBatchSelections,
        text: buildSelectedContainersJsonText(),
      });
    }
    setCollapsedPanelIds((ids) => {
      const next = new Set(ids);
      next.delete('selection-json');
      return next;
    });
  };

// 面板导航和 Activity 暴露给 View 的数据与操作
const jumpToPanelSection = (workspace: LabPanelWorkspace) => {
    const scroller = panelScrollRef.current;
    const target = document.getElementById(`lab-${workspace}-section`);
    if (!scroller || !target) {
      console.warn(`[DungeonMapCanvasLab] View 缺少 ${workspace} 面板或滚动区。`);
      return;
    }
    if (scroller && target && Math.abs(target.getBoundingClientRect().top - (scroller.getBoundingClientRect().top + 76)) <= 12) {
      setPanelWorkspace(workspace);
      navigatingWorkspaceRef.current = undefined;
      setNavigatingWorkspace(undefined);
      return;
    }
    navigatingWorkspaceRef.current = workspace;
    setNavigatingWorkspace(workspace);
    target?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

return {
  activeBatchComponentDefinition,
  activeBatchComponents,
  activeBatchEntityGroup,
  activePreset,
  activePresetKey,
  addComponentToEntity,
  addEntityToSelection,
  availableEntityDefinitions,
  batchAddComponent,
  batchComponentCreateDefinitions,
  batchComponentDeleteDefinitions,
  batchComponentEditDefinitions,
  batchComponentGroups,
  batchComponentSlotDraft,
  batchContainerTargets,
  batchCreateEntity,
  batchDeleteComponent,
  batchEntityArchetypeDraft,
  batchEntityDefinitions,
  batchEntityGroups,
  batchEntityTargets,
  batchSetComponentField,
  cancelMutationPlan,
  canvasOuterPadding,
  canvasSelection,
  canvasSelections,
  cellSize,
  changeSelectionMode,
  cleanupGeneratedTopologyShells,
  collapsedPanelIds,
  compatibleBatchEntityGroups,
  componentTypeToAdd,
  confirmMutationPlan,
  confirmPresetKeyChange,
  copySelectedContainersJson,
  createMapPreset,
  currentLoadedLargeSelectionJson,
  deleteMapPreset,
  downloadSelectedContainersJson,
  draftMapHeight,
  draftMapWidth,
  draftTopologyMode,
  duplicateMapPreset,
  editStructure,
  edgeEditMode,
  edgeThicknessRatio,
  editableBatchComponentGroups,
  effectiveBatchComponentTypeToCreate,
  effectiveBatchComponentTypeToEdit,
  effectiveBatchEntityGroupType,
  effectiveBatchEntityTypeToCreate,
  effectiveEntityTypeToAdd,
  entityViewMode,
  fittedMapScale,
  fogEnabled,
  handleCanvasSelectionsChange,
  handleEntityMove,
  hasUnsavedCurrentPreset,
  jumpToPanelSection,
  largeSelectionJsonRequiresConfirmation,
  map,
  mapDocument,
  mapHeight,
  mapPresets,
  mapScale,
  mapStore,
  mapViewportRef,
  mapWidth,
  minCanvasHeight,
  minCanvasWidth,
  navigatingWorkspace,
  newPresetKey,
  newPresetName,
  options,
  panelWorkspace,
  panelScrollRef,
  patternRendering,
  patterns,
  pendingMutationPlan,
  presetError,
  presetKeyDraft,
  presetMessage,
  presetReloading,
  presetSaving,
  redoMutationPlan,
  renameCurrentPreset,
  reloadCurrentPreset,
  removeComponentById,
  removeEntityById,
  removeSelectedContainer,
  reset,
  runStructureEdit,
  saveMapPresets,
  selectMapPreset,
  selectEntity,
  selectEntityAt,
  selectedComponentId,
  selectedContainerData,
  selectedContainersJsonText,
  selectedEntity,
  selectedEntityId,
  selectedSuite,
  selectionCountSummary,
  selectionHasTarget,
  selectionJsonCollapsed,
  selectionJsonMessage,
  selectionMode,
  setBatchComponentSlotDraft,
  setBatchComponentTypeToCreate,
  setBatchComponentTypeToEdit,
  setBatchEntityArchetypeDraft,
  setBatchEntityGroupType,
  setBatchEntityTypeToCreate,
  setCanvasOuterPadding,
  setCanvasSelections,
  setCellSize,
  setCollapsedPanelIds,
  setComponentTypeToAdd,
  setDraftMapHeight,
  setDraftMapWidth,
  setDraftTopologyMode,
  setEdgeEditMode,
  setEdgeThicknessRatio,
  setEntityTypeToAdd,
  setEntityViewMode,
  setFogEnabled,
  setMapPresets,
  setMapScale,
  setMinCanvasHeight,
  setMinCanvasWidth,
  setNewPresetKey,
  setNewPresetName,
  setPatternRendering,
  setPatterns,
  setPendingMutationPlan,
  setPresetKeyDraft,
  setSelectedComponentId,
  setSelectedEntityId,
  setSelectedSuite,
  setSharedEdgeThicknessRatio,
  setShowCoordinates,
  setShowGrid,
  setStructureColumnIndex,
  setStructureRowIndex,
  sharedEdgeThicknessRatio,
  showCoordinates,
  showGrid,
  structureSelection,
  structureSelectionX,
  structureSelectionY,
  suites,
  targetColumn,
  targetRow,
  toggleCollapsedId,
  toggleSelectionJson,
  topologyShellCleanupPreview,
  undoMutationPlan,
  uniqueBatchSelections,
  updateComponentById,
  updateEntityById,
  validationIssues,
};
};

export type DungeonMapCanvasLabViewModel = ReturnType<typeof useDungeonMapCanvasLabActivity>;
