import React, { useEffect, useRef, useState } from 'react';
import type {
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapTileContainer,
} from '@/core/map';

export type DungeonMapPatterns = {
  wall?: string;
  floor?: string;
  player?: string;
  event?: string;
  edgeNorth?: string;
  edgeEast?: string;
  edgeSouth?: string;
  edgeWest?: string;
  sharedEdge?: string;
};

export type DungeonMapSelection = {
  mode: 'tile' | 'edge' | 'shared';
  x: number;
  y: number;
  direction?: DungeonMapDirection;
  sharedEdgeId?: string;
};

export type DungeonMapCanvasProps = {
  map: DungeonMapData;
  cellSize?: number;
  displayScale?: number;
  showGrid?: boolean;
  showCoordinates?: boolean;
  patterns?: DungeonMapPatterns;
  edgeThicknessRatio?: number;
  sharedEdgeThicknessRatio?: number;
  selectionMode?: DungeonMapSelection['mode'];
  selection?: DungeonMapSelection;
  onSelectionChange?: (selection: DungeonMapSelection) => void;
  onTileClick?: (x: number, y: number, tile: DungeonMapTileContainer | undefined) => void;
  className?: string;
  style?: React.CSSProperties;
  keyboardEnabled?: boolean;
};

const directions: DungeonMapDirection[] = ['north', 'east', 'south', 'west'];
const directionAngle: Record<DungeonMapDirection, number> = {
  north: -Math.PI / 2,
  east: 0,
  south: Math.PI / 2,
  west: Math.PI,
};
const patternKey = {
  north: 'edgeNorth',
  east: 'edgeEast',
  south: 'edgeSouth',
  west: 'edgeWest',
} as const;

const hasData = (value: unknown) =>
  value != null &&
  (!Array.isArray(value) || value.length > 0) &&
  (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0);

const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

const drawThreeSlice = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  cap: number,
) => {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const sourceCap = Math.min(sourceHeight / 2, sourceWidth / 2);
  const targetCap = Math.min(cap, width / 2);
  context.drawImage(image, 0, 0, sourceCap, sourceHeight, x, y, targetCap, height);
  context.drawImage(
    image,
    sourceCap,
    0,
    sourceWidth - sourceCap * 2,
    sourceHeight,
    x + targetCap,
    y,
    width - targetCap * 2,
    height,
  );
  context.drawImage(
    image,
    sourceWidth - sourceCap,
    0,
    sourceCap,
    sourceHeight,
    x + width - targetCap,
    y,
    targetCap,
    height,
  );
};

const drawSelection = (
  context: CanvasRenderingContext2D,
  selection: DungeonMapSelection,
  cell: number,
  gap: number,
  pitch: number,
  edgeThickness: number,
  sharedThickness: number,
) => {
  const left = selection.x * pitch;
  const top = selection.y * pitch;
  context.save();
  context.fillStyle = 'rgba(255, 209, 102, .34)';
  context.strokeStyle = '#ffd166';
  context.lineWidth = 2;
  context.lineJoin = 'miter';

  if (selection.mode === 'tile') {
    context.fillRect(left, top, cell, cell);
    context.strokeRect(left + 1, top + 1, cell - 2, cell - 2);
    context.restore();
    return;
  }

  context.translate(left + cell / 2, top + cell / 2);
  context.rotate(directionAngle[selection.direction ?? 'north'] + Math.PI / 2);

  if (selection.mode === 'edge') {
    // Four copies of this exact 45-degree trapezoid surround a hollow square.
    const depth = Math.min(cell / 2, Math.max(1, edgeThickness));
    const outerY = -cell / 2;
    const innerY = outerY + depth;
    context.beginPath();
    context.moveTo(-cell / 2, outerY);
    context.lineTo(cell / 2, outerY);
    context.lineTo(cell / 2 - depth, innerY);
    context.lineTo(-cell / 2 + depth, innerY);
    context.closePath();
    context.fill();
    context.stroke();
  } else {
    // Shared edges stay a central strip so they cannot be confused with tile-edge trapezoids.
    const length = cell + gap;
    const centerY = -cell / 2 - gap / 2;
    const top = centerY - sharedThickness / 2;
    context.fillRect(-length / 2, top, length, sharedThickness);
    context.strokeRect(-length / 2, top, length, sharedThickness);
  }

  context.restore();
};

export const DungeonMapCanvas: React.FC<DungeonMapCanvasProps> = ({
  map,
  cellSize = 42,
  displayScale = 1,
  showGrid = true,
  showCoordinates = false,
  patterns,
  edgeThicknessRatio = 0.3,
  sharedEdgeThicknessRatio = 0.1,
  selectionMode = 'tile',
  selection,
  onSelectionChange,
  onTileClick,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const [imageRevision, setImageRevision] = useState(0);
  const cell = Math.max(8, cellSize);
  const sharedThickness = Math.max(1, cell * sharedEdgeThicknessRatio);
  const edgeThickness = Math.min(cell / 2, Math.max(1, cell * edgeThicknessRatio));
  const gap = sharedThickness + Math.max(2, cell * 0.04);
  const pitch = cell + gap;
  const width = map.width * cell + Math.max(0, map.width - 1) * gap;
  const height = map.height * cell + Math.max(0, map.height - 1) * gap;

  useEffect(() => {
    let active = true;
    imagesRef.current = {};
    Object.entries(patterns ?? {}).forEach(([key, source]) => {
      if (!source) return;
      loadImage(source).then((image) => {
        if (!active) return;
        imagesRef.current[key] = image;
        setImageRevision((value) => value + 1);
      });
    });
    return () => {
      active = false;
    };
  }, [patterns]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, devicePixelRatio || 1);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#07100d';
    context.fillRect(0, 0, width, height);

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.tiles[y * map.width + x];
        const left = x * pitch;
        const top = y * pitch;
        context.fillStyle = hasData(tile?.data) ? '#294c3f' : '#0b1713';
        context.fillRect(left, top, cell, cell);
        if (hasData(tile?.data) && imagesRef.current.floor) {
          context.drawImage(imagesRef.current.floor, left, top, cell, cell);
        }
        if (showGrid) {
          context.strokeStyle = '#35584b';
          context.strokeRect(left + 0.5, top + 0.5, cell - 1, cell - 1);
        }
        if (showCoordinates) {
          context.fillStyle = '#d8ffea';
          context.fillText(`${x},${y}`, left + 3, top + 11);
        }
      }
    }

    const occupied = new Set(
      (map.sharedEdges ?? []).flatMap((edge) =>
        edge.sides.map((side) => `${side.x},${side.y},${side.direction}`),
      ),
    );
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.tiles[y * map.width + x];
        directions.forEach((direction) => {
          if (
            !tile ||
            occupied.has(`${x},${y},${direction}`) ||
            !hasData(tile.edges[direction].data)
          ) return;
          const image = imagesRef.current[patternKey[direction]];
          context.save();
          context.translate(x * pitch + cell / 2, y * pitch + cell / 2);
          context.rotate(directionAngle[direction] + Math.PI / 2);
          if (image) {
            drawThreeSlice(
              context,
              image,
              -cell / 2,
              -cell / 2,
              cell,
              edgeThickness,
              edgeThickness,
            );
          } else {
            context.fillStyle = '#8fb9a8';
            context.fillRect(-cell / 2, -cell / 2, cell, edgeThickness);
          }
          context.restore();
        });
      }
    }

    (map.sharedEdges ?? []).forEach((edge) => {
      if (!hasData(edge.edge.data)) return;
      const side = edge.sides[0];
      const image = imagesRef.current.sharedEdge;
      const length = cell + gap;
      context.save();
      context.translate(side.x * pitch + cell / 2, side.y * pitch + cell / 2);
      context.rotate(directionAngle[side.direction] + Math.PI / 2);
      const y = -cell / 2 - gap / 2 - sharedThickness / 2;
      if (image) {
        drawThreeSlice(context, image, -length / 2, y, length, sharedThickness, sharedThickness / 2);
      } else {
        context.fillStyle = '#7ee8bb';
        context.fillRect(-length / 2, y, length, sharedThickness);
      }
      context.restore();
    });

    if (selection) {
      drawSelection(
        context,
        selection,
        cell,
        gap,
        pitch,
        edgeThickness,
        sharedThickness,
      );
    }
  }, [
    map,
    selection,
    cell,
    width,
    height,
    pitch,
    gap,
    sharedThickness,
    edgeThickness,
    showGrid,
    showCoordinates,
    imageRevision,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const localX = ((event.clientX - bounds.left) / bounds.width) * width;
        const localY = ((event.clientY - bounds.top) / bounds.height) * height;
        const x = Math.min(map.width - 1, Math.max(0, Math.floor(localX / pitch)));
        const y = Math.min(map.height - 1, Math.max(0, Math.floor(localY / pitch)));
        const offsetX = localX - x * pitch;
        const offsetY = localY - y * pitch;
        const direction = ([
          ['north', offsetY],
          ['east', cell - offsetX],
          ['south', cell - offsetY],
          ['west', offsetX],
        ] as [DungeonMapDirection, number][]).sort((a, b) => a[1] - b[1])[0][0];
        const sharedEdge = map.sharedEdges?.find((edge) =>
          edge.sides.some(
            (side) => side.x === x && side.y === y && side.direction === direction,
          ),
        );
        const nextSelection: DungeonMapSelection =
          selectionMode === 'tile'
            ? { mode: 'tile', x, y }
            : selectionMode === 'shared'
              ? { mode: 'shared', x, y, direction, sharedEdgeId: sharedEdge?.id }
              : { mode: 'edge', x, y, direction };
        onSelectionChange?.(nextSelection);
        onTileClick?.(x, y, map.tiles[y * map.width + x]);
      }}
      style={{
        display: 'block',
        width: width * displayScale,
        height: height * displayScale,
        maxWidth: 'none',
        ...style,
      }}
    />
  );
};
