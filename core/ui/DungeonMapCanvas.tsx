import React, { useCallback, useEffect, useRef } from 'react';
import type {
  DungeonMapAction,
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapEdge,
  DungeonMapMarker,
  DungeonMapPlayer,
  DungeonMapTile,
  DungeonMapTileKind
} from '@/core/map';

export type {
  DungeonMapAction,
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapEdge,
  DungeonMapMarker,
  DungeonMapPlayer,
  DungeonMapTile,
  DungeonMapTileKind
} from '@/core/map';

export type DungeonMapTheme = {
  background: string;
  void: string;
  floor: string;
  wall: string;
  door: string;
  stairs: string;
  undiscovered: string;
  grid: string;
  player: string;
  text: string;
  edgeWall: string;
  edgeDoor: string;
};

export type DungeonMapCanvasProps = {
  map: DungeonMapData;
  player: DungeonMapPlayer;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  cellSize?: number;
  showGrid?: boolean;
  showCoordinates?: boolean;
  keyboardEnabled?: boolean;
  theme?: Partial<DungeonMapTheme>;
  onAction?: (action: DungeonMapAction) => void;
  onTileClick?: (x: number, y: number, tile: DungeonMapTile | undefined) => void;
};

const DEFAULT_THEME: DungeonMapTheme = {
  background: '#07100d', void: '#07100d', floor: '#18352b', wall: '#557066', door: '#c7924b',
  stairs: '#6fcf97', undiscovered: '#0b1713', grid: 'rgba(173, 255, 214, 0.12)', player: '#8fffc1', text: '#d8ffea',
  edgeWall: '#b9c8c1', edgeDoor: '#e0a85c'
};

const TILE_COLOR_KEY: Record<DungeonMapTileKind, keyof DungeonMapTheme> = {
  void: 'void', floor: 'floor', wall: 'wall', door: 'door', 'stairs-up': 'stairs', 'stairs-down': 'stairs'
};

const DIRECTION_ANGLE: Record<DungeonMapDirection, number> = {
  north: -Math.PI / 2, east: 0, south: Math.PI / 2, west: Math.PI
};

const keyToAction = (event: React.KeyboardEvent<HTMLCanvasElement>): DungeonMapAction | undefined => {
  const key = event.key.toLowerCase();
  if (event.key === 'ArrowUp' || key === 'w') return 'move-forward';
  if (event.key === 'ArrowDown' || key === 's') return 'move-backward';
  if (event.key === 'ArrowLeft' || key === 'q') return 'turn-left';
  if (event.key === 'ArrowRight' || key === 'e') return 'turn-right';
  if (key === 'a') return 'strafe-left';
  if (key === 'd') return 'strafe-right';
  return undefined;
};

const drawMarker = (context: CanvasRenderingContext2D, marker: DungeonMapMarker, cellSize: number, textColor: string) => {
  const centerX = (marker.x + 0.5) * cellSize;
  const centerY = (marker.y + 0.5) * cellSize;
  const radius = cellSize * 0.18;
  context.save();
  context.fillStyle = marker.color ?? '#f7d36f';
  context.beginPath();
  if (marker.shape === 'square') {
    context.rect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  } else if (marker.shape === 'diamond') {
    context.moveTo(centerX, centerY - radius * 1.25);
    context.lineTo(centerX + radius * 1.25, centerY);
    context.lineTo(centerX, centerY + radius * 1.25);
    context.lineTo(centerX - radius * 1.25, centerY);
    context.closePath();
  } else {
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  }
  context.fill();
  if (marker.label && cellSize >= 28) {
    context.fillStyle = textColor;
    context.font = `600 ${Math.max(9, cellSize * 0.23)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText(marker.label, centerX, centerY - radius - 3);
  }
  context.restore();
};

const drawTileEdge = (
  context: CanvasRenderingContext2D,
  edge: DungeonMapEdge | undefined,
  direction: DungeonMapDirection,
  x: number,
  y: number,
  cellSize: number,
  colors: DungeonMapTheme
) => {
  if (!edge || edge.kind === 'open') return;
  const left = x * cellSize;
  const top = y * cellSize;
  const right = left + cellSize;
  const bottom = top + cellSize;
  const inset = edge.kind === 'door' ? cellSize * 0.22 : 0;
  const lineWidth = Math.max(2, cellSize * (edge.kind === 'door' ? 0.09 : 0.11));
  const tileInset = lineWidth / 2;
  context.save();
  context.strokeStyle = edge.color ?? (edge.kind === 'door' ? colors.edgeDoor : colors.edgeWall);
  context.lineWidth = lineWidth;
  context.lineCap = edge.kind === 'door' ? 'square' : 'butt';
  context.beginPath();
  if (direction === 'north') {
    context.moveTo(left + inset, top + tileInset);
    context.lineTo(right - inset, top + tileInset);
  } else if (direction === 'east') {
    context.moveTo(right - tileInset, top + inset);
    context.lineTo(right - tileInset, bottom - inset);
  } else if (direction === 'south') {
    context.moveTo(left + inset, bottom - tileInset);
    context.lineTo(right - inset, bottom - tileInset);
  } else {
    context.moveTo(left + tileInset, top + inset);
    context.lineTo(left + tileInset, bottom - inset);
  }
  context.stroke();
  context.restore();
};

export const DungeonMapCanvas: React.FC<DungeonMapCanvasProps> = ({
  map, player, className, style, ariaLabel = '地牢地图，点击后可使用方向键或 WASD/QE 操作', cellSize = 42,
  showGrid = true, showCoordinates = false, keyboardEnabled = true, theme, onAction, onTileClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const safeCellSize = Math.max(8, cellSize);
  const logicalWidth = Math.max(1, map.width) * safeCellSize;
  const logicalHeight = Math.max(1, map.height) * safeCellSize;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const colors = { ...DEFAULT_THEME, ...theme };
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(logicalWidth * ratio);
    canvas.height = Math.round(logicalHeight * ratio);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = colors.background;
    context.fillRect(0, 0, logicalWidth, logicalHeight);

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.tiles[y * map.width + x];
        const kind = tile?.kind ?? 'void';
        context.fillStyle = tile?.discovered === false ? colors.undiscovered : tile?.color ?? colors[TILE_COLOR_KEY[kind]];
        context.fillRect(x * safeCellSize, y * safeCellSize, safeCellSize, safeCellSize);
        if (tile?.discovered !== false && (kind === 'stairs-up' || kind === 'stairs-down')) {
          context.fillStyle = colors.text;
          context.font = `700 ${Math.max(10, safeCellSize * 0.34)}px sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(kind === 'stairs-up' ? '↑' : '↓', (x + 0.5) * safeCellSize, (y + 0.5) * safeCellSize);
        }
        if (showCoordinates && safeCellSize >= 28 && tile?.discovered !== false) {
          context.fillStyle = colors.text;
          context.globalAlpha = 0.48;
          context.font = `${Math.max(8, safeCellSize * 0.19)}px monospace`;
          context.textAlign = 'left';
          context.textBaseline = 'top';
          context.fillText(`${x},${y}`, x * safeCellSize + 3, y * safeCellSize + 3);
          context.globalAlpha = 1;
        }
      }
    }

    if (showGrid) {
      context.strokeStyle = colors.grid;
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x <= map.width; x += 1) {
        context.moveTo(x * safeCellSize + 0.5, 0);
        context.lineTo(x * safeCellSize + 0.5, logicalHeight);
      }
      for (let y = 0; y <= map.height; y += 1) {
        context.moveTo(0, y * safeCellSize + 0.5);
        context.lineTo(logicalWidth, y * safeCellSize + 0.5);
      }
      context.stroke();
    }

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.tiles[y * map.width + x];
        if (!tile || tile.discovered === false) continue;
        (['north', 'east', 'south', 'west'] as const).forEach((direction) => {
          drawTileEdge(context, tile.edges[direction], direction, x, y, safeCellSize, colors);
        });
      }
    }

    map.markers?.filter((marker) => marker.visible !== false).forEach((marker) => drawMarker(context, marker, safeCellSize, colors.text));
    const radius = safeCellSize * 0.29;
    context.save();
    context.translate((player.x + 0.5) * safeCellSize, (player.y + 0.5) * safeCellSize);
    context.rotate(DIRECTION_ANGLE[player.direction]);
    context.fillStyle = player.color ?? colors.player;
    context.beginPath();
    context.moveTo(radius * 1.25, 0);
    context.lineTo(-radius * 0.8, radius * 0.76);
    context.lineTo(-radius * 0.42, 0);
    context.lineTo(-radius * 0.8, -radius * 0.76);
    context.closePath();
    context.fill();
    context.restore();
  }, [logicalHeight, logicalWidth, map, player, safeCellSize, showCoordinates, showGrid, theme]);

  useEffect(() => { draw(); }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={logicalWidth}
      height={logicalHeight}
      tabIndex={keyboardEnabled ? 0 : undefined}
      role="img"
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (!keyboardEnabled) return;
        const action = keyToAction(event);
        if (!action) return;
        event.preventDefault();
        onAction?.(action);
      }}
      onClick={(event) => {
        event.currentTarget.focus();
        if (!onTileClick) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * map.width);
        const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * map.height);
        if (x >= 0 && y >= 0 && x < map.width && y < map.height) onTileClick(x, y, map.tiles[y * map.width + x]);
      }}
      style={{ display: 'block', width: logicalWidth, height: logicalHeight, maxWidth: '100%', objectFit: 'contain', borderRadius: 0, outline: 'none', ...style }}
    />
  );
};
