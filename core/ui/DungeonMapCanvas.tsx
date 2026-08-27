import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  sharedPoint?: string;
};

export type DungeonMapSelection = {
  mode: 'map' | 'tile' | 'edge' | 'shared' | 'point';
  x: number;
  y: number;
  direction?: DungeonMapDirection;
  sharedEdgeId?: string;
  sharedPointId?: string;
};

export type DungeonMapSelectionMode = DungeonMapSelection['mode'] | 'all';

export type DungeonMapCanvasProps = {
  map: DungeonMapData;
  cellSize?: number;
  displayScale?: number;
  outerPadding?: number;
  minCanvasWidth?: number;
  minCanvasHeight?: number;
  showGrid?: boolean;
  showCoordinates?: boolean;
  patterns?: DungeonMapPatterns;
  edgeThicknessRatio?: number;
  sharedEdgeThicknessRatio?: number;
  selectionMode?: DungeonMapSelectionMode;
  selection?: DungeonMapSelection;
  selections?: DungeonMapSelection[];
  viewedSelection?: DungeonMapSelection;
  onSelectionChange?: (selection: DungeonMapSelection) => void;
  onSelectionsChange?: (selections: DungeonMapSelection[]) => void;
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
const directionVector: Record<DungeonMapDirection, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

const isSameSelection = (left: DungeonMapSelection, right: DungeonMapSelection): boolean => {
  if (left.mode !== right.mode) return false;
  if (left.mode === 'shared' && left.sharedEdgeId && right.sharedEdgeId) {
    return left.sharedEdgeId === right.sharedEdgeId;
  }
  if (left.mode === 'point' && left.sharedPointId && right.sharedPointId) {
    return left.sharedPointId === right.sharedPointId;
  }
  return left.x === right.x && left.y === right.y && left.direction === right.direction;
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

const distanceToSegment = (
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) => {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) return Math.hypot(pointX - startX, pointY - startY);
  const projection = Math.max(0, Math.min(1,
    ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared,
  ));
  return Math.hypot(
    pointX - (startX + segmentX * projection),
    pointY - (startY + segmentY * projection),
  );
};

const gridPointPosition = (
  index: number,
  count: number,
  cell: number,
  gap: number,
  pitch: number,
) => {
  if (index <= 0) return -gap / 2;
  if (index >= count) return count * cell + Math.max(0, count - 1) * gap + gap / 2;
  return index * pitch - gap / 2;
};

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
  pointSize: number,
  originX: number,
  originY: number,
  mapWidth: number,
  mapHeight: number,
  isViewed = false,
) => {
  const left = originX + selection.x * pitch;
  const top = originY + selection.y * pitch;
  context.save();
  context.fillStyle = isViewed ? 'rgba(167, 139, 250, .38)' : 'rgba(255, 209, 102, .34)';
  context.strokeStyle = isViewed ? '#c4b5fd' : '#ffd166';
  context.lineWidth = isViewed ? 2.5 : 2;
  context.lineJoin = 'miter';

  if (selection.mode === 'map') {
    const mapPixelWidth = mapWidth * cell + Math.max(0, mapWidth - 1) * gap;
    const mapPixelHeight = mapHeight * cell + Math.max(0, mapHeight - 1) * gap;
    context.fillRect(originX, originY, mapPixelWidth, mapPixelHeight);
    context.strokeRect(originX + 1, originY + 1, mapPixelWidth - 2, mapPixelHeight - 2);
    context.restore();
    return;
  }

  if (selection.mode === 'tile') {
    context.fillRect(left, top, cell, cell);
    context.strokeRect(left + 1, top + 1, cell - 2, cell - 2);
    context.restore();
    return;
  }

  if (selection.mode === 'point') {
    const centerX = originX + gridPointPosition(selection.x, mapWidth, cell, gap, pitch);
    const centerY = originY + gridPointPosition(selection.y, mapHeight, cell, gap, pitch);
    context.fillRect(centerX - pointSize / 2, centerY - pointSize / 2, pointSize, pointSize);
    context.strokeRect(centerX - pointSize / 2, centerY - pointSize / 2, pointSize, pointSize);
    context.restore();
    return;
  }

  context.translate(left + cell / 2, top + cell / 2);
  context.rotate(directionAngle[selection.direction ?? 'north'] + Math.PI / 2);

  if (selection.mode === 'edge') {
    // Four copies of this exact 45-degree trapezoid surround a hollow square.
    const depth = Math.min(cell / 2, Math.max(0, edgeThickness));
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
  outerPadding = 0,
  minCanvasWidth = 0,
  minCanvasHeight = 0,
  showGrid = true,
  showCoordinates = false,
  patterns,
  edgeThicknessRatio = 0.12,
  sharedEdgeThicknessRatio = 0.24,
  selectionMode = 'tile',
  selection,
  selections,
  viewedSelection,
  onSelectionChange,
  onSelectionsChange,
  onTileClick,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const suppressClickRef = useRef(false);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const [imageRevision, setImageRevision] = useState(0);
  const [dragBox, setDragBox] = useState<{ startX: number; startY: number; endX: number; endY: number }>();
  const cell = Math.max(8, cellSize);
  const sharedThickness = Math.max(0, cell * sharedEdgeThicknessRatio);
  const edgeThickness = Math.min(cell / 2, Math.max(0, cell * edgeThicknessRatio));
  const hasSharedLayer = sharedThickness > 0;
  const gap = hasSharedLayer ? sharedThickness + Math.max(2, cell * 0.04) : 0;
  const pointSize = hasSharedLayer ? gap : 0;
  const pitch = cell + gap;
  const contentWidth = map.width * cell + Math.max(0, map.width - 1) * gap;
  const contentHeight = map.height * cell + Math.max(0, map.height - 1) * gap;
  // topologyMargin belongs to the map itself; canvasPadding is interaction space outside the map.
  const topologyMargin = hasSharedLayer ? gap : 0;
  const canvasPadding = Math.max(0, outerPadding);
  const naturalWidth = contentWidth + topologyMargin * 2 + canvasPadding * 2;
  const naturalHeight = contentHeight + topologyMargin * 2 + canvasPadding * 2;
  const width = Math.max(naturalWidth, Math.max(0, minCanvasWidth));
  const height = Math.max(naturalHeight, Math.max(0, minCanvasHeight));
  const originX = topologyMargin + canvasPadding + (width - naturalWidth) / 2;
  const originY = topologyMargin + canvasPadding + (height - naturalHeight) / 2;
  const getSharedEdgeVisualSides = useCallback((edge: NonNullable<DungeonMapData['sharedEdges']>[number]) => {
    const seen = new Set<string>();
    return edge.sides.filter((side) => {
      const vector = directionVector[side.direction];
      const centerX = originX + side.x * pitch + cell / 2 + vector.x * (cell / 2 + gap / 2);
      const centerY = originY + side.y * pitch + cell / 2 + vector.y * (cell / 2 + gap / 2);
      const key = `${Math.round(centerX * 1000)},${Math.round(centerY * 1000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cell, gap, originX, originY, pitch]);

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
        const left = originX + x * pitch;
        const top = originY + y * pitch;
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

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.tiles[y * map.width + x];
        directions.forEach((direction) => {
          if (
            !tile ||
            !hasData(tile.edges[direction].data)
          ) return;
          const image = imagesRef.current[patternKey[direction]];
          context.save();
          context.translate(originX + x * pitch + cell / 2, originY + y * pitch + cell / 2);
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

    if (hasSharedLayer) (map.sharedEdges ?? []).forEach((edge) => {
      if (!hasData(edge.edge.data)) return;
      const image = imagesRef.current.sharedEdge;
      const length = cell + gap;
      getSharedEdgeVisualSides(edge).forEach((side) => {
        context.save();
        context.translate(originX + side.x * pitch + cell / 2, originY + side.y * pitch + cell / 2);
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
    });

    if (hasSharedLayer) (map.sharedPoints ?? []).forEach((sharedPoint) => {
      if (!hasData(sharedPoint.point.data)) return;
      const image = imagesRef.current.sharedPoint;
      sharedPoint.positions.forEach((position) => {
        const centerX = originX + gridPointPosition(position.gridX, map.width, cell, gap, pitch);
        const centerY = originY + gridPointPosition(position.gridY, map.height, cell, gap, pitch);
        if (image) {
          context.drawImage(image, centerX - pointSize / 2, centerY - pointSize / 2, pointSize, pointSize);
        } else {
          context.fillStyle = '#9af2cd';
          context.fillRect(centerX - pointSize / 2, centerY - pointSize / 2, pointSize, pointSize);
        }
      });
    });

    const drawResolvedSelection = (item: DungeonMapSelection) => {
      const isViewed = Boolean(viewedSelection && isSameSelection(item, viewedSelection));
      let drawableSelection = !hasSharedLayer && (item.mode === 'shared' || item.mode === 'point') ? undefined : item;
      if (hasSharedLayer && item.mode === 'shared') {
      const selectedSharedEdge = map.sharedEdges?.find((edge) => edge.id === item.sharedEdgeId);
      if (selectedSharedEdge) getSharedEdgeVisualSides(selectedSharedEdge).forEach((side) => {
        drawSelection(context, {
          mode: 'shared', x: side.x, y: side.y, direction: side.direction,
          sharedEdgeId: selectedSharedEdge?.id,
        }, cell, gap, pitch, edgeThickness, sharedThickness, pointSize, originX, originY, map.width, map.height, isViewed);
      });
      drawableSelection = undefined;
      } else if (hasSharedLayer && item.mode === 'point') {
      const selectedSharedPoint = map.sharedPoints?.find(
        (point) => point.id === item.sharedPointId,
      );
      selectedSharedPoint?.positions.forEach((position) => {
        drawSelection(context, {
          mode: 'point', x: position.gridX, y: position.gridY,
          sharedPointId: selectedSharedPoint.id,
        }, cell, gap, pitch, edgeThickness, sharedThickness, pointSize, originX, originY, map.width, map.height, isViewed);
      });
      drawableSelection = undefined;
    }
    if (drawableSelection) {
      drawSelection(
        context,
        drawableSelection,
        cell,
        gap,
        pitch,
        edgeThickness,
        sharedThickness,
        pointSize,
        originX,
        originY,
        map.width,
        map.height,
        isViewed,
      );
      }
    };
    // One list represents both states: one item is a single selection, while
    // multiple items are a box selection. `selection` remains only as a legacy
    // fallback for consumers that have not migrated to the list API yet.
    const drawableSelections = selections ?? (selection ? [selection] : []);
    drawableSelections.forEach((item) => drawResolvedSelection(item));
    if (dragBox) {
      const left = Math.min(dragBox.startX, dragBox.endX);
      const top = Math.min(dragBox.startY, dragBox.endY);
      const boxWidth = Math.abs(dragBox.endX - dragBox.startX);
      const boxHeight = Math.abs(dragBox.endY - dragBox.startY);
      context.save();
      context.fillStyle = 'rgba(77, 208, 225, .12)';
      context.strokeStyle = '#4dd0e1';
      context.lineWidth = 1.5;
      context.setLineDash([5, 3]);
      context.fillRect(left, top, boxWidth, boxHeight);
      context.strokeRect(left, top, boxWidth, boxHeight);
      context.restore();
    }
  }, [
    map,
    selection,
    selections,
    viewedSelection,
    dragBox,
    cell,
    width,
    height,
    pitch,
    gap,
    sharedThickness,
    hasSharedLayer,
    pointSize,
    originX,
    originY,
    edgeThickness,
    showGrid,
    showCoordinates,
    imageRevision,
    getSharedEdgeVisualSides,
  ]);

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * width,
      y: ((event.clientY - bounds.top) / bounds.height) * height,
    };
  };

  const selectionsInBox = (box: NonNullable<typeof dragBox>) => {
    const left = Math.min(box.startX, box.endX);
    const right = Math.max(box.startX, box.endX);
    const top = Math.min(box.startY, box.endY);
    const bottom = Math.max(box.startY, box.endY);
    const contains = (x: number, y: number) => x >= left && x <= right && y >= top && y <= bottom;
    const result: DungeonMapSelection[] = [];
    const allow = (mode: DungeonMapSelection['mode']) => selectionMode === 'all' || selectionMode === mode;
    // The map container is global and must only be selected explicitly through
    // map mode. It is intentionally excluded from the automatic "all" mode.
    if (selectionMode === 'map') result.push({ mode: 'map', x: 0, y: 0 });
    if (allow('tile')) for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
      if (contains(originX + x * pitch + cell / 2, originY + y * pitch + cell / 2)) result.push({ mode: 'tile', x, y });
    }
    if (allow('edge')) for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
      const tile = map.tiles[y * map.width + x];
      directions.forEach((direction) => {
        if (!hasData(tile?.edges[direction].data)) return;
        const vector = directionVector[direction];
        const centerX = originX + x * pitch + cell / 2 + vector.x * (cell / 2 - edgeThickness / 2);
        const centerY = originY + y * pitch + cell / 2 + vector.y * (cell / 2 - edgeThickness / 2);
        if (contains(centerX, centerY)) result.push({ mode: 'edge', x, y, direction });
      });
    }
    if (allow('shared') && hasSharedLayer) (map.sharedEdges ?? []).forEach((edge) => {
      if (!hasData(edge.edge.data)) return;
      const side = getSharedEdgeVisualSides(edge).find((candidate) => {
        const vector = directionVector[candidate.direction];
        return contains(
          originX + candidate.x * pitch + cell / 2 + vector.x * (cell / 2 + gap / 2),
          originY + candidate.y * pitch + cell / 2 + vector.y * (cell / 2 + gap / 2),
        );
      });
      if (side) result.push({ mode: 'shared', x: side.x, y: side.y, direction: side.direction, sharedEdgeId: edge.id });
    });
    if (allow('point') && hasSharedLayer) (map.sharedPoints ?? []).forEach((point) => {
      const position = point.positions.find((candidate) => contains(
        originX + gridPointPosition(candidate.gridX, map.width, cell, gap, pitch),
        originY + gridPointPosition(candidate.gridY, map.height, cell, gap, pitch),
      ));
      if (position && hasData(point.point.data)) result.push({ mode: 'point', x: position.gridX, y: position.gridY, sharedPointId: point.id });
    });
    return result;
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // A drag does not consistently emit a trailing click in every browser.
        // Never let a stale suppression flag consume the user's next real click.
        suppressClickRef.current = false;
        const point = canvasPoint(event);
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragBox({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
      }}
      onPointerMove={(event) => {
        if (!dragBox || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const point = canvasPoint(event);
        setDragBox((current) => current ? { ...current, endX: point.x, endY: point.y } : current);
      }}
      onPointerUp={(event) => {
        if (!dragBox) return;
        const point = canvasPoint(event);
        const finished = { ...dragBox, endX: point.x, endY: point.y };
        const distance = Math.hypot(finished.endX - finished.startX, finished.endY - finished.startY);
        setDragBox(undefined);
        if (distance < 5) return;
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        const nextSelections = selectionsInBox(finished);
        onSelectionsChange?.(nextSelections);
        if (nextSelections[0]) onSelectionChange?.(nextSelections[0]);
      }}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        const localX = ((event.clientX - bounds.left) / bounds.width) * width;
        const localY = ((event.clientY - bounds.top) / bounds.height) * height;
        const contentX = localX - originX;
        const contentY = localY - originY;
        const x = Math.min(map.width - 1, Math.max(0, Math.floor(contentX / pitch)));
        const y = Math.min(map.height - 1, Math.max(0, Math.floor(contentY / pitch)));
        const offsetX = contentX - x * pitch;
        const offsetY = contentY - y * pitch;
        const direction = ([
          ['north', offsetY],
          ['east', cell - offsetX],
          ['south', cell - offsetY],
          ['west', offsetX],
        ] as [DungeonMapDirection, number][]).sort((a, b) => a[1] - b[1])[0][0];
        const sharedHit = (map.sharedEdges ?? [])
          .filter((edge) => hasSharedLayer && hasData(edge.edge.data))
          .flatMap((edge) => getSharedEdgeVisualSides(edge).map((side) => {
            const vector = directionVector[side.direction];
            const centerX = originX + side.x * pitch + cell / 2 + vector.x * (cell / 2 + gap / 2);
            const centerY = originY + side.y * pitch + cell / 2 + vector.y * (cell / 2 + gap / 2);
            const tangentX = -vector.y;
            const tangentY = vector.x;
            const halfLength = (cell + gap) / 2;
            return {
              edge,
              side,
              distance: distanceToSegment(
                localX,
                localY,
                centerX - tangentX * halfLength,
                centerY - tangentY * halfLength,
                centerX + tangentX * halfLength,
                centerY + tangentY * halfLength,
              ),
            };
          }))
          .sort((left, right) => left.distance - right.distance)[0];
        const sharedEdge = sharedHit && sharedHit.distance <= sharedThickness / 2 + 5
          ? sharedHit
          : undefined;
        const sharedPointHit = (hasSharedLayer ? map.sharedPoints ?? [] : [])
          .filter((point) => hasData(point.point.data))
          .flatMap((point) => point.positions.map((position) => ({
            point,
            position,
            distance: Math.hypot(
              localX - (originX + gridPointPosition(position.gridX, map.width, cell, gap, pitch)),
              localY - (originY + gridPointPosition(position.gridY, map.height, cell, gap, pitch)),
            ),
          })))
          .sort((left, right) => left.distance - right.distance)[0];
        const sharedPoint = sharedPointHit && sharedPointHit.distance <= pointSize / 2 + 5
          ? sharedPointHit.point
          : undefined;
        const selectedTileContainer = map.tiles[y * map.width + x];
        const directionDistance = Math.max(0, Math.min(
          direction === 'north' ? offsetY
            : direction === 'east' ? cell - offsetX
              : direction === 'south' ? cell - offsetY
                : offsetX,
          cell,
        ));
        const singleEdgeIsHit = edgeThickness > 0
          && directionDistance <= edgeThickness + 5
          && hasData(selectedTileContainer?.edges[direction].data);
        const automaticSelection: DungeonMapSelection = sharedPoint
          ? {
              mode: 'point',
              x: sharedPointHit.position.gridX,
              y: sharedPointHit.position.gridY,
              sharedPointId: sharedPoint.id,
            }
          : sharedEdge
            ? {
                mode: 'shared',
                x: sharedEdge.side.x,
                y: sharedEdge.side.y,
                direction: sharedEdge.side.direction,
                sharedEdgeId: sharedEdge.edge.id,
              }
            : singleEdgeIsHit
              ? { mode: 'edge', x, y, direction }
              : { mode: 'tile', x, y };
        const nextSelection: DungeonMapSelection =
          selectionMode === 'all'
            ? automaticSelection
            : selectionMode === 'map'
            ? { mode: 'map', x: 0, y: 0 }
            : selectionMode === 'tile'
            ? { mode: 'tile', x, y }
            : selectionMode === 'shared'
              ? sharedEdge
                ? {
                    mode: 'shared',
                    x: sharedEdge.side.x,
                    y: sharedEdge.side.y,
                    direction: sharedEdge.side.direction,
                    sharedEdgeId: sharedEdge.edge.id,
                  }
                : { mode: 'shared', x, y, direction }
              : selectionMode === 'point'
                ? sharedPoint
                  ? {
                      mode: 'point',
                      x: sharedPointHit.position.gridX,
                      y: sharedPointHit.position.gridY,
                      sharedPointId: sharedPoint.id,
                    }
                  : { mode: 'point', x, y }
                : { mode: 'edge', x, y, direction };
        onSelectionChange?.(nextSelection);
        onSelectionsChange?.([nextSelection]);
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
