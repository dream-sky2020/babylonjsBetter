import React, { useMemo, useState } from 'react';
import {
  createDungeonMapData,
  isDungeonMapPositionInside,
  isDungeonMapTileWalkable,
  validateDungeonMapData,
  type DungeonMapData,
  type DungeonMapDirection,
  type DungeonMapEdge,
  type DungeonMapEdgeEvent,
  type IPhysicsComponent,
  type DungeonMapSharedEdge,
  type DungeonMapTile,
  PHYSICS_COMPONENT_FIELD_SCHEMA
} from '@/core/map';
import { DungeonMapCanvas, type DungeonMapSelection } from '@/core/ui/DungeonMapCanvas';
import './dungeon-map-canvas-lab.css';

const PATTERN_MODULES = import.meta.glob('/public/resources/dungeon-map/**/*.svg', {
  eager: true, query: '?url', import: 'default'
}) as Record<string, string>;
type PatternKind = 'walls' | 'tiles' | 'characters' | 'events' | 'edges' | 'shared-edges';
type MapBrush = 'select' | 'walkable' | 'blocked' | 'single-wall' | 'single-door' | 'single-open' | 'shared-wall' | 'shared-door' | 'erase-shared' | 'event';
const BRUSHES: readonly { id: MapBrush; icon: string; label: string }[] = [
  { id: 'select', icon: '⌖', label: '选择' }, { id: 'walkable', icon: '□', label: '可通行格' },
  { id: 'blocked', icon: '■', label: '阻挡格' }, { id: 'single-wall', icon: '▰', label: '单格墙' },
  { id: 'single-door', icon: '▥', label: '单格门' }, { id: 'single-open', icon: '⌫', label: '开放单格边' },
  { id: 'shared-wall', icon: '═', label: '公用墙' }, { id: 'shared-door', icon: '╫', label: '公用门' },
  { id: 'erase-shared', icon: '✕', label: '删除公用边' }, { id: 'event', icon: '⚡', label: '添加边事件' }
];
const PATTERN_LABELS: Record<PatternKind, string> = { walls: '墙壁格', tiles: '地面格', characters: '角色', events: '事件', edges: '单格边', 'shared-edges': '公用边' };
const patternOptions = (kind: PatternKind) => Object.entries(PATTERN_MODULES)
  .filter(([path]) => path.includes(`/dungeon-map/${kind}/`))
  .map(([path, url]) => ({ label: path.split('/').pop()?.replace(/\.svg$/i, '') ?? path, url }))
  .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));

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

const TILE_BY_CHARACTER: Record<string, DungeonMapTile> = {
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
const OPPOSITE: Record<DungeonMapDirection, DungeonMapDirection> = { north: 'south', east: 'west', south: 'north', west: 'east' };

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

const rotate = (direction: DungeonMapDirection, delta: -1 | 1): DungeonMapDirection => {
  const index = DIRECTIONS.indexOf(direction);
  return DIRECTIONS[(index + delta + DIRECTIONS.length) % DIRECTIONS.length];
};

type ComponentHostData = Record<string, unknown> & {
  components?: Array<{ type: string; [key: string]: unknown }>;
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
  const [cellSize, setCellSize] = useState(42);
  const [mapScale, setMapScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [fogEnabled, setFogEnabled] = useState(true);
  const [visited, setVisited] = useState(() => new Set(['1,1']));
  const [eventLog, setEventLog] = useState<string[]>(['地图已加载；点击地图后可使用键盘。']);
  const options = useMemo(() => ({ walls: patternOptions('walls'), tiles: patternOptions('tiles'), characters: patternOptions('characters'), events: patternOptions('events'), edges: patternOptions('edges'), sharedEdges: patternOptions('shared-edges') }), []);
  const [patterns, setPatterns] = useState(() => ({
    wall: patternOptions('walls')[0]?.url ?? '', floor: patternOptions('tiles')[0]?.url ?? '',
    player: patternOptions('characters')[0]?.url ?? '', event: patternOptions('events')[0]?.url ?? '',
    edgeNorth: patternOptions('edges')[0]?.url ?? '', edgeEast: patternOptions('edges')[0]?.url ?? '',
    edgeSouth: patternOptions('edges')[0]?.url ?? '', edgeWest: patternOptions('edges')[0]?.url ?? '',
    sharedEdge: patternOptions('shared-edges')[0]?.url ?? ''
  }));
  const [edgeEditMode, setEdgeEditMode] = useState<'linked' | 'individual'>('linked');
  const [edgeThicknessRatio, setEdgeThicknessRatio] = useState(0.3);
  const [sharedEdgeThicknessRatio, setSharedEdgeThicknessRatio] = useState(0.1);
  const [selectedTile, setSelectedTile] = useState({ x: 1, y: 1 });
  const [selectedDirection, setSelectedDirection] = useState<DungeonMapDirection>('east');
  const [edgeTarget, setEdgeTarget] = useState<'single' | 'shared'>('single');
  const [tileOverrides, setTileOverrides] = useState<Record<number, DungeonMapTile>>({});
  const [addedSharedEdges, setAddedSharedEdges] = useState<DungeonMapSharedEdge[]>([]);
  const [sharedEdgeEdits, setSharedEdgeEdits] = useState<Record<string, DungeonMapSharedEdge>>({});
  const [removedSharedEdgeIds, setRemovedSharedEdgeIds] = useState(() => new Set<string>());
  const [activeBrush, setActiveBrush] = useState<MapBrush>('select');
  const [selectionMode, setSelectionMode] = useState<DungeonMapSelection['mode']>('tile');
  const [canvasSelection, setCanvasSelection] = useState<DungeonMapSelection>({ mode: 'tile', x: 1, y: 1 });

  const map = useMemo<DungeonMapData>(() => {
    const visitedPositions = [...visited].map((key) => key.split(',').map(Number));
    const isRevealed = (x: number, y: number) => !fogEnabled || visitedPositions.some(
      ([visitedX, visitedY]) => Math.abs(visitedX - x) + Math.abs(visitedY - y) <= 1
    );
    const generatedSharedEdges = createDungeonMapData({
      id: 'forgotten-corridor-b1-generated-topology',
      width: MAP_ROWS[0].length,
      height: MAP_ROWS.length,
      createSharedEdgeData: ({ first }) => ({
        legacy: {
          kind: 'open',
          label: `自动公用边 ${first.x},${first.y},${first.direction}`,
        },
      }),
    }).sharedEdges?.filter((edge) => {
      const side = edge.sides[0];
      return !SPECIAL_SHARED_EDGE_POSITIONS.has(`${side.x},${side.y},${side.direction}`);
    }) ?? [];
    return {
      id: 'forgotten-corridor-b1',
      width: MAP_ROWS[0].length,
      height: MAP_ROWS.length,
      tiles: BASE_TILES.map((baseTile, index) => {
        const tile = tileOverrides[index] ?? baseTile;
        const x = index % MAP_ROWS[0].length;
        const y = Math.floor(index / MAP_ROWS[0].length);
        const legacyTile = tile as DungeonMapTile & { data?: ComponentHostData };
        return {
          ...tile,
          x,
          y,
          discovered: isRevealed(x, y),
          data: legacyTile.data ?? {
            legacy: { kind: tile.kind, label: tile.label, walkable: tile.walkable },
          },
          edges: Object.fromEntries(DIRECTIONS.map((direction) => {
            const edge = tile.edges[direction] as DungeonMapEdge & { data?: ComponentHostData };
            return [direction, {
              ...edge,
              data: edge.data ?? {
                legacy: { kind: edge.kind, label: edge.label, passable: edge.passable },
              },
            }];
          })),
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
        .filter((edge) => !removedSharedEdgeIds.has(edge.id))
        .map((edge) => sharedEdgeEdits[edge.id] ?? edge)
        .concat(addedSharedEdges)
        .map((sharedEdge) => {
          const edge = sharedEdge.edge as DungeonMapEdge & { data?: ComponentHostData };
          return {
            ...sharedEdge,
            edge: {
              ...edge,
              data: edge.data ?? {
                legacy: { kind: edge.kind, label: edge.label, passable: edge.passable },
              },
            },
          };
        }),
      markers: [
        { id: 'goal', x: 6, y: 6, label: '出口', color: '#ffd166', shape: 'diamond', visible: isRevealed(6, 6) },
        { id: 'event', x: 10, y: 9, label: '事件', color: '#ff6b9a', visible: isRevealed(10, 9) }
      ],
      metadata: { floor: 'B1', name: '遗忘回廊' }
    };
  }, [fogEnabled, visited, tileOverrides, addedSharedEdges, sharedEdgeEdits, removedSharedEdgeIds]);

  const validationIssues = useMemo(() => validateDungeonMapData(map), [map]);
  const selectedIndex = selectedTile.y * map.width + selectedTile.x;
  const selectedMapTile = map.tiles[selectedIndex];
  const selectedSharedEdge = map.sharedEdges?.find(({ sides }) => sides.some((side) => side.x === selectedTile.x && side.y === selectedTile.y && side.direction === selectedDirection));
  const selectedEdge = edgeTarget === 'shared' ? selectedSharedEdge?.edge : selectedMapTile?.edges[selectedDirection];

  const canvasSelectedTile = map.tiles[canvasSelection.y * map.width + canvasSelection.x];
  const canvasSelectionDirection = canvasSelection.direction ?? selectedDirection;
  // 公用边编辑只认 Canvas 精确命中后返回的 ID，禁止按附近格子猜测目标。
  const canvasSelectedSharedEdge = map.sharedEdges?.find(
    (edge) => edge.id === canvasSelection.sharedEdgeId,
  );
  const selectedContainerData = (
    canvasSelection.mode === 'tile'
      ? canvasSelectedTile?.data
      : canvasSelection.mode === 'edge'
        ? canvasSelectedTile?.edges[canvasSelectionDirection]?.data
        : canvasSelectedSharedEdge?.edge.data
  ) as ComponentHostData | undefined;
  const selectedPhysics = selectedContainerData?.components?.find(
    (component) => component.type === 'physics',
  ) as IPhysicsComponent | undefined;
  const selectionHasTarget = canvasSelection.mode !== 'shared' || Boolean(canvasSelectedSharedEdge);

  const changeSelectionMode = (mode: DungeonMapSelection['mode']) => {
    setSelectionMode(mode);
    setCanvasSelection((current) => {
      if (mode === 'tile') return { mode, x: current.x, y: current.y };
      const direction = current.direction ?? selectedDirection;
      if (mode === 'edge') return { mode, x: current.x, y: current.y, direction };
      const sharedEdge = map.sharedEdges?.find((edge) => edge.sides.some((side) =>
        side.x === current.x && side.y === current.y && side.direction === direction
      ));
      return {
        mode,
        x: current.x,
        y: current.y,
        direction,
        sharedEdgeId: sharedEdge?.id,
      };
    });
  };

  const updateCanvasSelectionData = (
    updater: (data: ComponentHostData) => ComponentHostData,
  ) => {
    if (!selectionHasTarget) return;
    if (canvasSelection.mode === 'shared') {
      if (!canvasSelectedSharedEdge) return;
      const next = {
        ...canvasSelectedSharedEdge,
        edge: {
          ...canvasSelectedSharedEdge.edge,
          data: updater((canvasSelectedSharedEdge.edge.data ?? {}) as ComponentHostData),
        },
      };
      if (addedSharedEdges.some((edge) => edge.id === next.id)) {
        setAddedSharedEdges((edges) => edges.map((edge) => edge.id === next.id ? next : edge));
      } else {
        setSharedEdgeEdits((edits) => ({ ...edits, [next.id]: next }));
      }
      return;
    }

    const index = canvasSelection.y * map.width + canvasSelection.x;
    const tile = tileOverrides[index] ?? BASE_TILES[index];
    if (!tile) return;
    if (canvasSelection.mode === 'tile') {
      setTileOverrides((overrides) => ({
        ...overrides,
        [index]: { ...tile, data: updater((tile.data ?? {}) as ComponentHostData) },
      }));
      return;
    }
    const direction = canvasSelectionDirection;
    const edge = tile.edges[direction];
    setTileOverrides((overrides) => ({
      ...overrides,
      [index]: {
        ...tile,
        edges: {
          ...tile.edges,
          [direction]: { ...edge, data: updater((edge.data ?? {}) as ComponentHostData) },
        },
      },
    }));
  };

  const savePhysics = (physics?: IPhysicsComponent) => updateCanvasSelectionData((data) => ({
    ...data,
    components: [
      ...(data.components ?? []).filter((component) => component.type !== 'physics'),
      ...(physics ? [physics] : []),
    ],
  }));

  const updatePhysicsField = (path: string, value: unknown) => {
    let next = valueWithPath<IPhysicsComponent>(selectedPhysics ?? { type: 'physics' }, path, value);
    if (path === 'passRequirement.mode' && !value) {
      const { passRequirement: _removed, ...rest } = next;
      next = rest as IPhysicsComponent;
    } else if (path === 'passRequirement.tags' && Array.isArray(value) && value.length > 0 && !next.passRequirement?.mode) {
      next = valueWithPath(next, 'passRequirement.mode', 'all-of');
    }
    if (path === 'condition.expressionId' && !value) {
      const { condition: _removed, ...rest } = next;
      next = rest as IPhysicsComponent;
    }
    savePhysics(next);
  };

  const updateSingleTile = (updater: (tile: DungeonMapTile) => DungeonMapTile) => {
    const current = tileOverrides[selectedIndex] ?? BASE_TILES[selectedIndex];
    if (!current) return;
    setTileOverrides((overrides) => ({ ...overrides, [selectedIndex]: updater(current) }));
  };

  const updateCurrentEdge = (updater: (edge: DungeonMapEdge) => DungeonMapEdge) => {
    if (edgeTarget === 'shared') {
      if (!selectedSharedEdge) return;
      const next = { ...selectedSharedEdge, edge: updater(selectedSharedEdge.edge) };
      if (addedSharedEdges.some((edge) => edge.id === selectedSharedEdge.id)) {
        setAddedSharedEdges((edges) => edges.map((edge) => edge.id === next.id ? next : edge));
      } else setSharedEdgeEdits((edits) => ({ ...edits, [next.id]: next }));
      return;
    }
    updateSingleTile((tile) => ({ ...tile, edges: { ...tile.edges, [selectedDirection]: updater(tile.edges[selectedDirection]) } }));
  };

  const addSharedEdge = () => {
    const vector = VECTOR[selectedDirection];
    const neighbor = { x: selectedTile.x + vector.x, y: selectedTile.y + vector.y };
    if (!isDungeonMapPositionInside(map, neighbor.x, neighbor.y) || selectedSharedEdge) return;
    const id = `shared-editor-${selectedTile.x}-${selectedTile.y}-${selectedDirection}-${Date.now()}`;
    setAddedSharedEdges((edges) => [...edges, {
      id,
      sides: [{ ...selectedTile, direction: selectedDirection }, { ...neighbor, direction: OPPOSITE[selectedDirection] }],
      edge: { kind: 'wall', label: '编辑器公用边', metadata: { shared: true } }
    }]);
    setEdgeTarget('shared');
  };

  const removeSelectedSharedEdge = () => {
    if (!selectedSharedEdge) return;
    setAddedSharedEdges((edges) => edges.filter((edge) => edge.id !== selectedSharedEdge.id));
    setRemovedSharedEdgeIds((ids) => new Set(ids).add(selectedSharedEdge.id));
    setEdgeTarget('single');
  };

  const addEdgeEvent = () => updateCurrentEdge((edge) => ({ ...edge, events: [...(edge.events ?? []), {
    id: `event-${Date.now()}`, type: 'custom-event', trigger: 'interact', enabled: true
  }] }));
  const updateEdgeEvent = (index: number, patch: Partial<DungeonMapEdgeEvent>) => updateCurrentEdge((edge) => ({
    ...edge, events: (edge.events ?? []).map((event, eventIndex) => eventIndex === index ? { ...event, ...patch } : event)
  }));
  const removeEdgeEvent = (index: number) => updateCurrentEdge((edge) => ({ ...edge, events: (edge.events ?? []).filter((_, eventIndex) => eventIndex !== index) }));

  const applyBrush = (x: number, y: number) => {
    const index = y * map.width + x;
    const direction = selectedDirection;
    const shared = map.sharedEdges?.find(({ sides }) => sides.some((side) => side.x === x && side.y === y && side.direction === direction));
    const updateTileAt = (updater: (tile: DungeonMapTile) => DungeonMapTile) => {
      const current = tileOverrides[index] ?? BASE_TILES[index];
      if (current) setTileOverrides((overrides) => ({ ...overrides, [index]: updater(current) }));
    };
    if (activeBrush === 'walkable') updateTileAt((tile) => ({ ...tile, kind: 'floor', walkable: true }));
    if (activeBrush === 'blocked') updateTileAt((tile) => ({ ...tile, kind: 'wall', walkable: false }));
    const singleKind = activeBrush === 'single-wall' ? 'wall' : activeBrush === 'single-door' ? 'door' : activeBrush === 'single-open' ? 'open' : undefined;
    if (singleKind) updateTileAt((tile) => ({ ...tile, edges: { ...tile.edges, [direction]: { kind: singleKind, label: `画笔${DIRECTION_LABEL[direction]}边` } } }));
    if (activeBrush === 'event') updateTileAt((tile) => ({ ...tile, edges: { ...tile.edges, [direction]: { ...tile.edges[direction], events: [...(tile.edges[direction].events ?? []), { id: `paint-event-${Date.now()}`, type: 'custom-event', trigger: 'interact', enabled: true }] } } }));
    if (activeBrush === 'erase-shared' && shared) {
      setAddedSharedEdges((edges) => edges.filter((edge) => edge.id !== shared.id));
      setRemovedSharedEdgeIds((ids) => new Set(ids).add(shared.id));
    }
    if (activeBrush === 'shared-wall' || activeBrush === 'shared-door') {
      const kind = activeBrush === 'shared-wall' ? 'wall' : 'door';
      if (shared) {
        const next = { ...shared, edge: { ...shared.edge, kind, label: `画笔公用${kind === 'wall' ? '墙' : '门'}` } };
        if (addedSharedEdges.some((edge) => edge.id === shared.id)) setAddedSharedEdges((edges) => edges.map((edge) => edge.id === shared.id ? next : edge));
        else setSharedEdgeEdits((edits) => ({ ...edits, [shared.id]: next }));
      } else {
        const vector = VECTOR[direction];
        const neighbor = { x: x + vector.x, y: y + vector.y };
        if (isDungeonMapPositionInside(map, neighbor.x, neighbor.y)) setAddedSharedEdges((edges) => [...edges, {
          id: `shared-brush-${x}-${y}-${direction}-${Date.now()}`,
          sides: [{ x, y, direction }, { ...neighbor, direction: OPPOSITE[direction] }],
          edge: { kind, label: `画笔公用${kind === 'wall' ? '墙' : '门'}`, metadata: { shared: true } }
        }]);
      }
    }
  };

  const log = (message: string) => setEventLog((current) => [message, ...current].slice(0, 8));

  const handleTileClick = (x: number, y: number) => {
    setSelectedTile({ x, y });
    if (activeBrush !== 'select') {
      applyBrush(x, y);
      log(`${BRUSHES.find((brush) => brush.id === activeBrush)?.label ?? '画笔'}应用于 (${x}, ${y}) · ${DIRECTION_LABEL[selectedDirection]}边`);
      return;
    }
    log(`已选择格子 (${x}, ${y})`);
  };

  const reset = () => {
    setTileOverrides({}); setAddedSharedEdges([]); setSharedEdgeEdits({}); setRemovedSharedEdgeIds(new Set());
    setEventLog(['编辑数据已重置。']);
  };

  const activateBrush = (brush: MapBrush, direction?: DungeonMapDirection) => {
    setActiveBrush(brush);
    if (direction) setSelectedDirection(direction);
  };

  const renderDirectionalBrushRow = (label: string, brush: MapBrush) => (
    <div className="direction-brush-row" key={brush}>
      <span>{label}</span>
      <div>
        {DIRECTIONS.map((direction) => <button
          type="button"
          key={direction}
          className={activeBrush === brush && selectedDirection === direction ? 'is-active' : ''}
          onClick={() => activateBrush(brush, direction)}
        >{DIRECTION_LABEL[direction]}</button>)}
      </div>
    </div>
  );

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
          <div className="status-row"><span>选中格子</span><strong>{selectedTile.x}, {selectedTile.y}</strong></div>
        </section>
        <section className="control-card controls">
          <label>格子尺寸 <strong>{cellSize}px</strong><input type="range" min="24" max="64" value={cellSize} onChange={(event) => setCellSize(Number(event.target.value))} /></label>
          <label className="check"><input type="checkbox" checked={fogEnabled} onChange={(event) => setFogEnabled(event.target.checked)} />探索迷雾</label>
          <label className="check"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />显示网格</label>
          <label className="check"><input type="checkbox" checked={showCoordinates} onChange={(event) => setShowCoordinates(event.target.checked)} />显示坐标</label>
          <button type="button" className="reset-button" onClick={reset}>重置编辑数据</button>
        </section>
        <section className="control-card selection-panel">
          <div className="map-editor__header"><div><h2>选中数据</h2><p>切换模式后点击地图</p></div><strong>{canvasSelection.x}, {canvasSelection.y}</strong></div>
          <div className="selection-mode-switch">{([['tile','格子'],['edge','单格边'],['shared','公用边']] as const).map(([mode,label])=><button type="button" key={mode} className={selectionMode===mode?'is-active':''} onClick={()=>changeSelectionMode(mode)}>{label}</button>)}</div>
          <div className="selection-summary"><span>类型：{canvasSelection.mode==='tile'?'格子':canvasSelection.mode==='edge'?'单格边':'公用边'}</span>{canvasSelection.direction?<span>方向：{DIRECTION_LABEL[canvasSelection.direction]}</span>:null}</div>
          <pre className="selection-data">{JSON.stringify(selectedContainerData, null, 2) ?? '无数据'}</pre>
        </section>
        <section className="control-card physics-editor">
          <div className="map-editor__header">
            <div><h2>PhysicsComponent</h2><p>根据组件字段 Schema 自动生成</p></div>
            <strong>{selectedPhysics ? '已挂载' : '未挂载'}</strong>
          </div>
          {!selectionHasTarget ? (
            <div className="editor-empty">当前位置没有可编辑的公用边</div>
          ) : !selectedPhysics ? (
            <button type="button" onClick={() => savePhysics({ type: 'physics', directionMode: 'all' })}>
              ＋ 添加 PhysicsComponent
            </button>
          ) : (
            <>
              <div className="physics-fields">
                {PHYSICS_COMPONENT_FIELD_SCHEMA.map((field) => {
                  const currentValue = valueAtPath(selectedPhysics, field.path);
                  if (field.control === 'checkbox') return (
                    <label className="physics-check" key={field.path}>
                      <input
                        type="checkbox"
                        checked={currentValue === true}
                        onChange={(event) => updatePhysicsField(field.path, event.target.checked)}
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                  if (field.control === 'select') return (
                    <label key={field.path}>
                      <span>{field.label}</span>
                      <select
                        value={String(currentValue ?? (field.path === 'directionMode' ? 'all' : ''))}
                        onChange={(event) => updatePhysicsField(field.path, event.target.value || undefined)}
                      >
                        {field.optional && field.path !== 'directionMode' ? <option value="">不启用</option> : null}
                        {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  );
                  if (field.control === 'tags') return (
                    <label key={field.path}>
                      <span>{field.label}</span>
                      <textarea
                        rows={2}
                        value={Array.isArray(currentValue) ? currentValue.join(', ') : ''}
                        placeholder={field.placeholder}
                        onChange={(event) => updatePhysicsField(
                          field.path,
                          event.target.value.split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean),
                        )}
                      />
                    </label>
                  );
                  if (field.control === 'json') return (
                    <label key={`${field.path}-${JSON.stringify(currentValue)}`}>
                      <span>{field.label}</span>
                      <textarea
                        className="physics-json"
                        rows={4}
                        defaultValue={currentValue ? JSON.stringify(currentValue, null, 2) : ''}
                        placeholder={field.placeholder}
                        onBlur={(event) => {
                          const text = event.currentTarget.value.trim();
                          try {
                            event.currentTarget.setCustomValidity('');
                            updatePhysicsField(field.path, text ? JSON.parse(text) : undefined);
                          } catch {
                            event.currentTarget.setCustomValidity('请输入合法的 JSON 对象');
                            event.currentTarget.reportValidity();
                          }
                        }}
                      />
                    </label>
                  );
                  return (
                    <label key={field.path}>
                      <span>{field.label}</span>
                      <input
                        value={String(currentValue ?? '')}
                        placeholder={field.placeholder}
                        onChange={(event) => updatePhysicsField(field.path, event.target.value || undefined)}
                      />
                    </label>
                  );
                })}
              </div>
              <button type="button" className="danger-button" onClick={() => savePhysics(undefined)}>
                删除 PhysicsComponent
              </button>
            </>
          )}
        </section>
        <section className="control-card map-editor legacy-map-editor">
          <div className="map-editor__header"><div><h2>地图编辑</h2><p>点击地图选择格子</p></div><strong>{selectedTile.x}, {selectedTile.y}</strong></div>
          <div className="brush-toolbar">
            <div className="brush-toolbar__primary">
              <button type="button" className={activeBrush === 'select' ? 'is-active' : ''} onClick={() => activateBrush('select')}><span>⌖</span>选择 / 精细编辑</button>
              <button type="button" className={activeBrush === 'walkable' ? 'is-active' : ''} onClick={() => activateBrush('walkable')}><span>□</span>可通行格</button>
              <button type="button" className={activeBrush === 'blocked' ? 'is-active' : ''} onClick={() => activateBrush('blocked')}><span>■</span>阻挡格</button>
            </div>
            <div className="brush-group"><h3>单格边画笔</h3>{renderDirectionalBrushRow('墙', 'single-wall')}{renderDirectionalBrushRow('门', 'single-door')}{renderDirectionalBrushRow('开放', 'single-open')}</div>
            <div className="brush-group"><h3>公用边画笔</h3>{renderDirectionalBrushRow('墙', 'shared-wall')}{renderDirectionalBrushRow('门', 'shared-door')}{renderDirectionalBrushRow('删除', 'erase-shared')}</div>
            <div className="brush-group"><h3>事件画笔</h3>{renderDirectionalBrushRow('添加事件', 'event')}</div>
          </div>
          <div className="brush-hint">{activeBrush === 'select' ? '选择模式：点击格子后精细编辑数据' : `画笔模式：${BRUSHES.find((brush) => brush.id === activeBrush)?.label} · 使用${DIRECTION_LABEL[selectedDirection]}边`}</div>
          {activeBrush === 'select' ? <div className="precision-editor">
          <label className="editor-check"><input type="checkbox" checked={isDungeonMapTileWalkable(selectedMapTile)} onChange={(event) => updateSingleTile((tile) => ({ ...tile, walkable: event.target.checked }))} />格子可以通过</label>
          <div className="editor-row">
            <label>方向<select value={selectedDirection} onChange={(event) => setSelectedDirection(event.target.value as DungeonMapDirection)}>{DIRECTIONS.map((direction) => <option key={direction} value={direction}>{DIRECTION_LABEL[direction]}</option>)}</select></label>
            <label>编辑目标<select value={edgeTarget} onChange={(event) => setEdgeTarget(event.target.value as 'single' | 'shared')}><option value="single">单格边</option><option value="shared">公用边</option></select></label>
          </div>
          {edgeTarget === 'single' ? <div className="editor-row"><button type="button" onClick={() => updateCurrentEdge(() => ({ kind: 'wall', label: '新单格边' }))}>＋ 添加/重置单格边</button><button type="button" onClick={() => updateCurrentEdge(() => ({ kind: 'open', label: '开放边' }))}>清空为开放边</button></div> : null}
          {edgeTarget === 'shared' && !selectedSharedEdge ? <button type="button" onClick={addSharedEdge}>＋ 添加公用边</button> : null}
          {edgeTarget === 'shared' && selectedSharedEdge ? <button type="button" className="danger-button" onClick={removeSelectedSharedEdge}>删除公用边</button> : null}
          {selectedEdge ? <>
            <div className="editor-row">
              <label>边类型<select value={selectedEdge.kind} onChange={(event) => updateCurrentEdge((edge) => ({ ...edge, kind: event.target.value as DungeonMapEdge['kind'] }))}><option value="open">开放</option><option value="wall">墙</option><option value="door">门</option></select></label>
              <label>通行<select value={selectedEdge.passable === undefined ? 'auto' : String(selectedEdge.passable)} onChange={(event) => updateCurrentEdge((edge) => ({ ...edge, passable: event.target.value === 'auto' ? undefined : event.target.value === 'true' }))}><option value="auto">跟随类型</option><option value="true">可以通过</option><option value="false">禁止通过</option></select></label>
            </div>
            <label>边名称<input value={selectedEdge.label ?? ''} onChange={(event) => updateCurrentEdge((edge) => ({ ...edge, label: event.target.value }))} /></label>
            <div className="event-editor__title"><strong>边事件</strong><button type="button" onClick={addEdgeEvent}>＋ 添加事件</button></div>
            {(selectedEdge.events ?? []).map((edgeEvent, index) => <div className="event-editor" key={`${edgeEvent.id}-${index}`}>
              <input aria-label="事件 ID" value={edgeEvent.id} onChange={(event) => updateEdgeEvent(index, { id: event.target.value })} />
              <input aria-label="事件类型" value={edgeEvent.type} onChange={(event) => updateEdgeEvent(index, { type: event.target.value })} />
              <select aria-label="触发方式" value={edgeEvent.trigger} onChange={(event) => updateEdgeEvent(index, { trigger: event.target.value as DungeonMapEdgeEvent['trigger'] })}><option value="enter">进入</option><option value="leave">离开</option><option value="cross">穿过</option><option value="interact">交互</option></select>
              <label className="event-enabled"><input type="checkbox" checked={edgeEvent.enabled !== false} onChange={(event) => updateEdgeEvent(index, { enabled: event.target.checked })} />启用</label>
              <button type="button" className="danger-button" onClick={() => removeEdgeEvent(index)}>删除</button>
            </div>)}
          </> : edgeTarget === 'shared' ? <div className="editor-empty">当前方向没有公用边</div> : null}
          </div> : null}
        </section>
        <section className="control-card event-log">
          <h2>事件输出</h2>
          {eventLog.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>)}
        </section>
        <section className="control-card pattern-controls">
          <div className="pattern-controls__header"><div><h2>地图图案</h2><p>资源自动扫描自 public</p></div><span>{Object.keys(PATTERN_MODULES).length} 个</span></div>
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
              <label><span>单格边厚度</span><strong>{Math.round(edgeThicknessRatio * 100)}%</strong><input type="range" min="0.12" max="0.35" step="0.01" value={edgeThicknessRatio} onChange={(event) => setEdgeThicknessRatio(Number(event.target.value))} /></label>
              <label><span>公用边厚度</span><strong>{Math.round(sharedEdgeThicknessRatio * 100)}%</strong><input type="range" min="0.04" max="0.24" step="0.01" value={sharedEdgeThicknessRatio} onChange={(event) => setSharedEdgeThicknessRatio(Number(event.target.value))} /></label>
            </div>
            <label className="pattern-field shared-edge-field"><span>中央公用边</span><span className="pattern-select">
              <img src={patterns.sharedEdge} alt="" /><select value={patterns.sharedEdge} onChange={(event) => setPatterns((current) => ({ ...current, sharedEdge: event.target.value }))}>
                {options.sharedEdges.map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
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
          <div className="map-frame__header"><span>B1 · 遗忘回廊</span><div className="map-zoom"><button type="button" onClick={() => setMapScale((scale) => Math.max(0.5, scale - 0.1))}>−</button><button type="button" className="map-zoom__value" onClick={() => setMapScale(1)}>{Math.round(mapScale * 100)}%</button><button type="button" onClick={() => setMapScale((scale) => Math.min(2.5, scale + 0.1))}>＋</button></div><span>{map.width} × {map.height}</span></div>
          <div className="map-scroll">
            <DungeonMapCanvas
              map={map}
              cellSize={cellSize}
              displayScale={mapScale}
              showGrid={showGrid}
              showCoordinates={showCoordinates}
              patterns={patterns}
              edgeThicknessRatio={edgeThicknessRatio}
              sharedEdgeThicknessRatio={sharedEdgeThicknessRatio}
              selectionMode={selectionMode}
              selection={canvasSelection}
              onSelectionChange={(next) => { setCanvasSelection(next); setSelectedTile({ x: next.x, y: next.y }); if (next.direction) setSelectedDirection(next.direction); }}
              keyboardEnabled={false}
              onTileClick={handleTileClick}
            />
          </div>
          <div className="map-frame__footer">数据编辑预览 · 点击格子选择或应用画笔</div>
        </div>
      </main>
    </div>
  );
};
