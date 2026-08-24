import React, { useMemo, useState } from 'react';
import {
  canTraverseDungeonMap,
  getDungeonMapTraversalEdges,
  isDungeonMapPositionInside,
  isDungeonMapTileWalkable,
  validateDungeonMapData,
  type DungeonMapAction,
  type DungeonMapData,
  type DungeonMapDirection,
  type DungeonMapEdge,
  type DungeonMapPlayer,
  type DungeonMapTile
} from '@/core/map';
import { DungeonMapCanvas } from '@/core/ui/DungeonMapCanvas';
import './dungeon-map-canvas-lab.css';

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

const rotate = (direction: DungeonMapDirection, delta: -1 | 1): DungeonMapDirection => {
  const index = DIRECTIONS.indexOf(direction);
  return DIRECTIONS[(index + delta + DIRECTIONS.length) % DIRECTIONS.length];
};

export const DungeonMapCanvasLab: React.FC = () => {
  const [player, setPlayer] = useState<DungeonMapPlayer>({ x: 1, y: 1, direction: 'east' });
  const [cellSize, setCellSize] = useState(42);
  const [showGrid, setShowGrid] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [fogEnabled, setFogEnabled] = useState(true);
  const [clickTeleportEnabled, setClickTeleportEnabled] = useState(true);
  const [passWallsEnabled, setPassWallsEnabled] = useState(false);
  const [edgeLoopEnabled, setEdgeLoopEnabled] = useState(false);
  const [visited, setVisited] = useState(() => new Set(['1,1']));
  const [eventLog, setEventLog] = useState<string[]>(['地图已加载；点击地图后可使用键盘。']);

  const map = useMemo<DungeonMapData>(() => {
    const visitedPositions = [...visited].map((key) => key.split(',').map(Number));
    const isRevealed = (x: number, y: number) => !fogEnabled || visitedPositions.some(
      ([visitedX, visitedY]) => Math.abs(visitedX - x) + Math.abs(visitedY - y) <= 1
    );
    return {
      id: 'forgotten-corridor-b1',
      width: MAP_ROWS[0].length,
      height: MAP_ROWS.length,
      tiles: BASE_TILES.map((tile, index) => {
      if (!fogEnabled) return tile;
      const x = index % MAP_ROWS[0].length;
      const y = Math.floor(index / MAP_ROWS[0].length);
        return { ...tile, discovered: isRevealed(x, y) };
      }),
      markers: [
        { id: 'goal', x: 6, y: 6, label: '出口', color: '#ffd166', shape: 'diamond', visible: isRevealed(6, 6) },
        { id: 'event', x: 10, y: 9, label: '事件', color: '#ff6b9a', visible: isRevealed(10, 9) }
      ],
      metadata: { floor: 'B1', name: '遗忘回廊' }
    };
  }, [fogEnabled, visited]);

  const validationIssues = useMemo(() => validateDungeonMapData(map), [map]);

  const log = (message: string) => setEventLog((current) => [message, ...current].slice(0, 8));

  const moveByDirection = (direction: DungeonMapDirection, backward = false) => {
    const movementDirection = backward ? rotate(rotate(direction, 1), 1) : direction;
    const vector = VECTOR[movementDirection];
    const rawX = player.x + vector.x;
    const rawY = player.y + vector.y;
    const crossesMapEdge = !isDungeonMapPositionInside(map, rawX, rawY);
    if (crossesMapEdge && !edgeLoopEnabled) {
      log(`道路受阻，停留在 (${player.x}, ${player.y})`);
      return;
    }
    const x = ((rawX % map.width) + map.width) % map.width;
    const y = ((rawY % map.height) + map.height) % map.height;
    const destination = { x, y };
    if (!passWallsEnabled && !canTraverseDungeonMap(map, player.x, player.y, movementDirection, destination)) {
      log(`道路受阻，停留在 (${player.x}, ${player.y})`);
      return;
    }
    setVisited((currentVisited) => new Set(currentVisited).add(`${x},${y}`));
    setPlayer({ ...player, x, y });
    log(`${crossesMapEdge ? '循环移动' : '移动'}到 (${x}, ${y})`);
    const traversal = getDungeonMapTraversalEdges(map, player.x, player.y, movementDirection, destination);
    const triggeredEvents = [
      ...(traversal?.leaving.edge.events ?? []).filter((event) => event.enabled !== false && (event.trigger === 'leave' || event.trigger === 'cross')),
      ...(traversal?.entering.edge.events ?? []).filter((event) => event.enabled !== false && (event.trigger === 'enter' || event.trigger === 'cross'))
    ];
    if (triggeredEvents.length > 0) log(`独立边事件：${triggeredEvents.map((event) => event.id).join(', ')}`);
  };

  const handleTileClick = (x: number, y: number, tile: DungeonMapTile | undefined) => {
    if (!clickTeleportEnabled) {
      log(`点击 (${x}, ${y}) · ${tile?.kind ?? 'void'}`);
      return;
    }
    if (!passWallsEnabled && !isDungeonMapTileWalkable(tile)) {
      log(`无法瞬移到 (${x}, ${y})：目标不可通行`);
      return;
    }
    setPlayer({ ...player, x, y });
    setVisited((currentVisited) => new Set(currentVisited).add(`${x},${y}`));
    log(`瞬移到 (${x}, ${y}) · ${tile?.kind ?? 'void'}`);
  };

  const handleAction = (action: DungeonMapAction) => {
    if (action === 'turn-left' || action === 'turn-right') {
      const direction = rotate(player.direction, action === 'turn-left' ? -1 : 1);
      setPlayer({ ...player, direction });
      log(`转向${DIRECTION_LABEL[direction]}`);
      return;
    }
    if (action === 'move-forward') moveByDirection(player.direction);
    if (action === 'move-backward') moveByDirection(player.direction, true);
    if (action === 'strafe-left') moveByDirection(rotate(player.direction, -1));
    if (action === 'strafe-right') moveByDirection(rotate(player.direction, 1));
  };

  const reset = () => {
    setPlayer({ x: 1, y: 1, direction: 'east' });
    setVisited(new Set(['1,1']));
    setEventLog(['状态已重置。']);
  };

  return (
    <div className="dungeon-lab">
      <aside className="dungeon-lab__panel">
        <div>
          <p className="dungeon-lab__eyebrow">CORE UI / DATA-DRIVEN</p>
          <h1>Dungeon Map Canvas</h1>
          <p className="dungeon-lab__intro">DRPG 式格步移动测试。地图组件只绘制传入数据并派发操作意图。</p>
        </div>
        <section className="control-card">
          <div className="status-row"><span>位置</span><strong>{player.x}, {player.y}</strong></div>
          <div className="status-row"><span>朝向</span><strong>{DIRECTION_LABEL[player.direction]}</strong></div>
          <div className="status-row"><span>地图结构</span><strong>{validationIssues.length === 0 ? '校验通过' : `${validationIssues.length} 项错误`}</strong></div>
          <div className="direction-pad">
            <button type="button" onClick={() => handleAction('turn-left')}>↶ 左转</button>
            <button type="button" onClick={() => handleAction('move-forward')}>↑ 前进</button>
            <button type="button" onClick={() => handleAction('turn-right')}>右转 ↷</button>
            <button type="button" onClick={() => handleAction('strafe-left')}>← 横移</button>
            <button type="button" onClick={() => handleAction('move-backward')}>↓ 后退</button>
            <button type="button" onClick={() => handleAction('strafe-right')}>横移 →</button>
          </div>
          <div className="key-hint">键盘：W/S 前后 · A/D 横移 · Q/E 或 ←/→ 转向</div>
        </section>
        <section className="control-card controls">
          <label>格子尺寸 <strong>{cellSize}px</strong><input type="range" min="24" max="64" value={cellSize} onChange={(event) => setCellSize(Number(event.target.value))} /></label>
          <label className="check"><input type="checkbox" checked={fogEnabled} onChange={(event) => setFogEnabled(event.target.checked)} />探索迷雾</label>
          <label className="check"><input type="checkbox" checked={clickTeleportEnabled} onChange={(event) => setClickTeleportEnabled(event.target.checked)} />点击地图瞬移</label>
          <label className="check"><input type="checkbox" checked={passWallsEnabled} onChange={(event) => setPassWallsEnabled(event.target.checked)} />允许穿墙</label>
          <label className="check"><input type="checkbox" checked={edgeLoopEnabled} onChange={(event) => setEdgeLoopEnabled(event.target.checked)} />允许边缘循环</label>
          <label className="check"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />显示网格</label>
          <label className="check"><input type="checkbox" checked={showCoordinates} onChange={(event) => setShowCoordinates(event.target.checked)} />显示坐标</label>
          <button type="button" className="reset-button" onClick={reset}>重置测试状态</button>
        </section>
        <section className="control-card event-log">
          <h2>事件输出</h2>
          {eventLog.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>)}
        </section>
      </aside>
      <main className="dungeon-lab__stage">
        <div className="map-frame">
          <div className="map-frame__header"><span>B1 · 遗忘回廊</span><span>{map.width} × {map.height}</span></div>
          <div className="map-scroll">
            <DungeonMapCanvas
              map={map}
              player={player}
              cellSize={cellSize}
              showGrid={showGrid}
              showCoordinates={showCoordinates}
              onAction={handleAction}
              onTileClick={handleTileClick}
            />
          </div>
          <div className="map-frame__footer"><span className="legend player-dot" />玩家 <span className="legend goal-dot" />目标 <span className="legend event-dot" />事件</div>
        </div>
      </main>
    </div>
  );
};
