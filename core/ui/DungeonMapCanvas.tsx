import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IEntityContainer } from '@/core/entity';
import type {
  DungeonMapData,
  DungeonMapDocumentV2,
  DungeonMapDirection,
  DungeonMapTileContainer,
} from '@/core/map';
import {
  DungeonMapSvgTintCache,
  resolveDungeonMapEntityAppearance,
  type DungeonMapEntityTypeColors,
} from './dungeon-map-svg-tint';
import {
  createDungeonMapCanvasView,
  createLegacyDungeonMapCanvasView,
} from './dungeon-map-canvas-view';
import {
  layoutDungeonMapEntityStack,
  visibleDungeonMapEntities,
  type DungeonMapEntityRegion,
} from './dungeon-map-entity-stack';
import {
  dungeonMapGridPointPosition as gridPointPosition,
  dungeonMapSpaceMetrics,
  dungeonMapTopologyColors as topologyColors,
  northTileSidePolygon,
} from './dungeon-map-space-geometry';

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
export type DungeonMapPatternRendering = 'canvas' | 'svg';
export type DungeonMapEntityViewMode = 'overview' | 'entities';

export type DungeonMapEntityMove = {
  entityId: string;
  from: DungeonMapSelection;
  to: DungeonMapSelection;
  copy: boolean;
};

type DungeonMapDragBox = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  operation: 'select' | 'deselect';
};

const selectionIdentity = (selection: DungeonMapSelection): string => {
  if (selection.mode === 'shared' && selection.sharedEdgeId) return `shared:${selection.sharedEdgeId}`;
  if (selection.mode === 'point' && selection.sharedPointId) return `point:${selection.sharedPointId}`;
  return `${selection.mode}:${selection.x}:${selection.y}:${selection.direction ?? ''}`;
};

type DungeonMapCanvasDataSource =
  | {
      /** V1 兼容输入。 */
      map: DungeonMapData;
      document?: never;
    }
  | {
      map?: never;
      /** V2 文档直接通过 Grid 与 ECS 索引生成最小绘制视图。 */
      document: DungeonMapDocumentV2;
    };

export type DungeonMapCanvasProps = DungeonMapCanvasDataSource & {
  cellSize?: number;
  displayScale?: number;
  outerPadding?: number;
  minCanvasWidth?: number;
  minCanvasHeight?: number;
  showGrid?: boolean;
  showCoordinates?: boolean;
  patterns?: DungeonMapPatterns;
  /** `canvas` 使用程序化几何；`svg` 使用并按 Entity 数据染色素材。 */
  patternRendering?: DungeonMapPatternRendering;
  /** `overview` 使用空间容器的聚合外观；`entities` 展开每个 Entity 实例。 */
  entityViewMode?: DungeonMapEntityViewMode;
  /** Entity Type Registry 提供的 Lab 主色；存在时启用数据着色。 */
  entityTypeColors?: DungeonMapEntityTypeColors;
  edgeThicknessRatio?: number;
  sharedEdgeThicknessRatio?: number;
  selectionMode?: DungeonMapSelectionMode;
  selection?: DungeonMapSelection;
  /** 受控选择集合；空数组表示当前没有选中任何数据容器。 */
  selections?: DungeonMapSelection[];
  onSelectionChange?: (selection: DungeonMapSelection) => void;
  onSelectionsChange?: (selections: DungeonMapSelection[]) => void;
  selectedEntityId?: string;
  onEntitySelect?: (entityId: string, location: DungeonMapSelection) => void;
  onEntityMove?: (move: DungeonMapEntityMove) => void;
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

const patternKey = {
  north: 'edgeNorth',
  east: 'edgeEast',
  south: 'edgeSouth',
  west: 'edgeWest',
} as const;

const hasData = (value: unknown) =>
  value != null &&
  (!Array.isArray(value) || value.length > 0) &&
  (typeof value !== 'object' || Array.isArray(value) || (
    Array.isArray((value as { entities?: unknown }).entities)
      ? (value as { entities: unknown[] }).entities.length > 0
      : Object.keys(value).length > 0
  ));

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

/**
 * 描出位于单格北侧的梯形边。调用方只需先按方向旋转画布。
 * 四个方向复用同一组尺寸，因此相邻梯形会共享完全一致的角点。
 */
const traceTileEdgeTrapezoid = (
  context: CanvasRenderingContext2D,
  cell: number,
  edgeThickness: number,
) => {
  const [outerLeft, outerRight, innerRight, innerLeft] = northTileSidePolygon(cell, edgeThickness);
  context.beginPath();
  context.moveTo(outerLeft.x, outerLeft.y);
  context.lineTo(outerRight.x, outerRight.y);
  context.lineTo(innerRight.x, innerRight.y);
  context.lineTo(innerLeft.x, innerLeft.y);
  context.closePath();
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
) => {
  const left = originX + selection.x * pitch;
  const top = originY + selection.y * pitch;
  context.save();
  context.fillStyle = 'rgba(255, 209, 102, .34)';
  context.strokeStyle = '#ffd166';
  context.lineWidth = 2;
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
    const tileBodySize = Math.max(0, cell - edgeThickness * 2);
    context.fillRect(left + edgeThickness, top + edgeThickness, tileBodySize, tileBodySize);
    context.strokeRect(
      left + edgeThickness + 1,
      top + edgeThickness + 1,
      Math.max(0, tileBodySize - 2),
      Math.max(0, tileBodySize - 2),
    );
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
    traceTileEdgeTrapezoid(context, cell, edgeThickness);
    context.fill();
    context.stroke();
  } else {
    // Shared edges stay a central strip so they cannot be confused with tile-edge trapezoids.
    const length = cell;
    const centerY = -cell / 2 - gap / 2;
    const top = centerY - sharedThickness / 2;
    context.fillRect(-length / 2, top, length, sharedThickness);
    context.strokeRect(-length / 2, top, length, sharedThickness);
  }

  context.restore();
};

const DungeonMapCanvasComponent: React.FC<DungeonMapCanvasProps> = ({
  map: legacyMap,
  document,
  cellSize = 42,
  displayScale = 1,
  outerPadding = 0,
  minCanvasWidth = 0,
  minCanvasHeight = 0,
  showGrid = true,
  showCoordinates = false,
  patterns,
  patternRendering = 'canvas',
  entityViewMode = 'overview',
  entityTypeColors,
  edgeThicknessRatio = 0.12,
  sharedEdgeThicknessRatio = 0.24,
  selectionMode = 'tile',
  selection,
  selections,
  onSelectionChange,
  onSelectionsChange,
  selectedEntityId,
  onEntitySelect,
  onEntityMove,
  onTileClick,
  className,
  style,
}) => {
  const map = useMemo(() => {
    if (document) return createDungeonMapCanvasView(document);
    if (legacyMap) return createLegacyDungeonMapCanvasView(legacyMap);
    throw new Error('DungeonMapCanvas 必须提供 map 或 document。');
  }, [document, legacyMap]);
  const mapCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragOverlayRef = useRef<HTMLDivElement>(null);
  const entityDragOverlayRef = useRef<HTMLDivElement>(null);
  const entityRegionsRef = useRef<DungeonMapEntityRegion[]>([]);
  const entityDragRef = useRef<{
    entityId: string;
    source: DungeonMapSelection;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    copy: boolean;
    target?: DungeonMapSelection;
  }>();
  const suppressClickRef = useRef(false);
  const suppressContextMenuRef = useRef(false);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const dragBoxRef = useRef<DungeonMapDragBox>();
  const dragFrameRef = useRef<number>();
  const [entityDragTarget, setEntityDragTarget] = useState<DungeonMapSelection>();
  const [imageRevision, setImageRevision] = useState(0);
  const [tintCache] = useState(() => new DungeonMapSvgTintCache());
  const sharedEdgeById = useMemo(() => new Map(
    (map.sharedEdges ?? []).map((edge) => [edge.id, edge]),
  ), [map.sharedEdges]);
  const sharedPointById = useMemo(() => new Map(
    (map.sharedPoints ?? []).map((point) => [point.id, point]),
  ), [map.sharedPoints]);
  const cell = Math.max(8, cellSize);
  const spaceMetrics = dungeonMapSpaceMetrics(cell, edgeThicknessRatio, sharedEdgeThicknessRatio);
  const { sharedThickness, edgeThickness, hasSharedLayer, gap, pointSize, pitch } = spaceMetrics;
  // The shared-edge slot must be exactly as wide as the rendered shared edge.
  // Extra gutter space exposes the dark canvas between tile and shared layers.
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
  const updateDragOverlay = useCallback(() => {
    const overlay = dragOverlayRef.current;
    if (!overlay) return;
    const dragBox = dragBoxRef.current;
    if (!dragBox) {
      overlay.style.display = 'none';
      return;
    }
    const left = Math.min(dragBox.startX, dragBox.endX);
    const top = Math.min(dragBox.startY, dragBox.endY);
    const boxWidth = Math.abs(dragBox.endX - dragBox.startX);
    const boxHeight = Math.abs(dragBox.endY - dragBox.startY);
    const isDeselecting = dragBox.operation === 'deselect';
    overlay.style.display = 'block';
    overlay.style.left = `${(left / width) * 100}%`;
    overlay.style.top = `${(top / height) * 100}%`;
    overlay.style.width = `${(boxWidth / width) * 100}%`;
    overlay.style.height = `${(boxHeight / height) * 100}%`;
    overlay.style.background = isDeselecting ? 'rgba(255, 107, 122, .12)' : 'rgba(77, 208, 225, .12)';
    overlay.style.borderColor = isDeselecting ? '#ff6b7a' : '#4dd0e1';
  }, [height, width]);
  const scheduleDragOverlay = useCallback(() => {
    if (dragFrameRef.current !== undefined) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = undefined;
      updateDragOverlay();
    });
  }, [updateDragOverlay]);
  const clearDragBox = useCallback(() => {
    dragBoxRef.current = undefined;
    if (dragFrameRef.current !== undefined) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = undefined;
    }
    updateDragOverlay();
  }, [updateDragOverlay]);
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
    if (patternRendering !== 'svg') {
      imagesRef.current = {};
      return;
    }
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
  }, [patternRendering, patterns]);

  useEffect(() => {
    if (patternRendering !== 'svg' || !entityTypeColors) return;
    let active = true;
    const requests = new Map<string, Promise<HTMLImageElement>>();
    const requestTint = (data: unknown, source: string | undefined) => {
      if (!source) return;
      const appearance = resolveDungeonMapEntityAppearance(data, entityTypeColors);
      if (!appearance) return;
      const key = `${source}|${appearance.mixedColor}`;
      if (!requests.has(key)) requests.set(key, tintCache.load(source, appearance.mixedColor));
    };
    const requestContainerTint = (data: IEntityContainer | undefined, source: string | undefined) => {
      if (entityViewMode === 'entities') {
        const entities = visibleDungeonMapEntities(data);
        if (entities.length > 0) {
          entities.forEach((entity) => requestTint({ entities: [entity] }, source));
          return;
        }
      }
      requestTint(data, source);
    };
    map.tiles.forEach((tile) => {
      requestContainerTint(tile.data, patterns?.floor);
      directions.forEach((direction) => requestContainerTint(tile.edges[direction].data, patterns?.[patternKey[direction]]));
    });
    map.sharedEdges?.forEach((edge) => requestContainerTint(edge.edge.data, patterns?.sharedEdge));
    map.sharedPoints?.forEach((point) => requestContainerTint(point.point.data, patterns?.sharedPoint));
    void Promise.allSettled(requests.values()).then(() => {
      if (active && requests.size > 0) setImageRevision((value) => value + 1);
    });
    return () => {
      active = false;
    };
  }, [entityTypeColors, entityViewMode, map, patternRendering, patterns, tintCache]);

  useEffect(() => () => tintCache.clear(), [tintCache]);

  useEffect(() => {
    updateDragOverlay();
    return () => {
      if (dragFrameRef.current !== undefined) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = undefined;
      }
    };
  }, [updateDragOverlay]);

  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, devicePixelRatio || 1);
    const pixelWidth = Math.ceil(width * ratio);
    const pixelHeight = Math.ceil(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#07100d';
    context.fillRect(0, 0, width, height);
    const resolveAppearance = (data: unknown) => entityTypeColors
      ? resolveDungeonMapEntityAppearance(data, entityTypeColors)
      : undefined;
    const resolveImage = (
      data: unknown,
      source: string | undefined,
      fallback: HTMLImageElement | undefined,
    ) => {
      if (patternRendering !== 'svg') return undefined;
      const appearance = resolveAppearance(data);
      return appearance && source ? tintCache.get(source, appearance.mixedColor) ?? fallback : fallback;
    };
    const entityRegions: DungeonMapEntityRegion[] = [];
    const drawContainerLayers = (
      data: IEntityContainer | undefined,
      location: DungeonMapSelection,
      bounds: { x: number; y: number; width: number; height: number },
      drawSurface: (surfaceData: IEntityContainer | undefined) => void,
    ) => {
      const regions = entityViewMode === 'entities'
        ? layoutDungeonMapEntityStack(data, location, bounds)
        : [];
      if (regions.length === 0) {
        drawSurface(data);
        return;
      }
      for (const region of regions) {
        entityRegions.push(region);
        context.save();
        context.translate(region.x - bounds.x, region.y - bounds.y);
        if (entityDragRef.current?.entityId === region.entity.id) context.globalAlpha = 0.32;
        drawSurface({ entities: [region.entity] });
        context.restore();
      }
    };

    // Pass 1: topology structure. Every target gets a stable geometric slot:
    // center square = Tile, trapezoids = Sides, rectangles = shared Edges,
    // intersection squares = Points. Entity data is painted over these slots.
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const left = originX + x * pitch;
        const top = originY + y * pitch;
        context.fillStyle = topologyColors.background;
        context.fillRect(left, top, cell, cell);
        if (showGrid) {
          context.save();
          const tileBodySize = Math.max(0, cell - edgeThickness * 2);
          context.fillStyle = topologyColors.tile;
          context.fillRect(left + edgeThickness, top + edgeThickness, tileBodySize, tileBodySize);
          context.strokeStyle = topologyColors.outline;
          context.lineWidth = 0.75;
          context.strokeRect(left + edgeThickness + 0.5, top + edgeThickness + 0.5, Math.max(0, tileBodySize - 1), Math.max(0, tileBodySize - 1));
          directions.forEach((direction) => {
            context.save();
            context.translate(left + cell / 2, top + cell / 2);
            context.rotate(directionAngle[direction] + Math.PI / 2);
            traceTileEdgeTrapezoid(context, cell, edgeThickness);
            context.fillStyle = topologyColors.side;
            context.fill();
            context.stroke();
            context.restore();
          });
          context.restore();
        }
      }
    }

    if (showGrid) {
      context.save();
      if (hasSharedLayer) (map.sharedEdges ?? []).forEach((edge) => {
        getSharedEdgeVisualSides(edge).forEach((side) => {
          context.save();
          context.translate(originX + side.x * pitch + cell / 2, originY + side.y * pitch + cell / 2);
          context.rotate(directionAngle[side.direction] + Math.PI / 2);
          context.fillStyle = topologyColors.sharedEdge;
          context.fillRect(-cell / 2, -cell / 2 - gap, cell, sharedThickness);
          context.restore();
        });
      });
      if (hasSharedLayer) (map.sharedPoints ?? []).forEach((point) => {
        point.positions.forEach((position) => {
          const centerX = originX + gridPointPosition(position.gridX, map.width, cell, gap, pitch);
          const centerY = originY + gridPointPosition(position.gridY, map.height, cell, gap, pitch);
          context.fillStyle = topologyColors.point;
          context.fillRect(centerX - pointSize / 2, centerY - pointSize / 2, pointSize, pointSize);
        });
      });
      context.restore();
    }

    // Pass 2: Entity data. Only spatial targets with attached Entity data get
    // filled geometry, patterns, and registry colors.
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.tiles[y * map.width + x];
        if (!hasData(tile?.data)) continue;
        const left = originX + x * pitch;
        const top = originY + y * pitch;
        const tileBodySize = Math.max(0, cell - edgeThickness * 2);
        drawContainerLayers(tile.data, { mode: 'tile', x, y }, {
          x: left + edgeThickness,
          y: top + edgeThickness,
          width: tileBodySize,
          height: tileBodySize,
        }, (surfaceData) => {
          const appearance = resolveAppearance(surfaceData);
          context.fillStyle = '#294c3f';
          context.fillRect(left + edgeThickness, top + edgeThickness, tileBodySize, tileBodySize);
          if (patternRendering === 'svg' && imagesRef.current.floor) {
            context.drawImage(
              resolveImage(surfaceData, patterns?.floor, imagesRef.current.floor) ?? imagesRef.current.floor,
              left + edgeThickness,
              top + edgeThickness,
              tileBodySize,
              tileBodySize,
            );
          } else if (appearance) {
            context.save();
            context.globalAlpha = 0.42;
            context.fillStyle = appearance.mixedColor;
            context.fillRect(left + edgeThickness, top + edgeThickness, tileBodySize, tileBodySize);
            context.restore();
          }
        });
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
          const data = tile.edges[direction].data;
          const left = originX + x * pitch;
          const top = originY + y * pitch;
          const bounds = direction === 'north'
            ? { x: left, y: top, width: cell, height: edgeThickness }
            : direction === 'east'
              ? { x: left + cell - edgeThickness, y: top, width: edgeThickness, height: cell }
              : direction === 'south'
                ? { x: left, y: top + cell - edgeThickness, width: cell, height: edgeThickness }
                : { x: left, y: top, width: edgeThickness, height: cell };
          drawContainerLayers(data, { mode: 'edge', x, y, direction }, bounds, (surfaceData) => {
            const appearance = resolveAppearance(surfaceData);
            const source = patterns?.[patternKey[direction]];
            const image = resolveImage(surfaceData, source, imagesRef.current[patternKey[direction]]);
            context.save();
            context.translate(left + cell / 2, top + cell / 2);
            context.rotate(directionAngle[direction] + Math.PI / 2);
            traceTileEdgeTrapezoid(context, cell, edgeThickness);
            if (image) {
              context.clip();
              drawThreeSlice(context, image, -cell / 2, -cell / 2, cell, edgeThickness, edgeThickness);
            } else {
              context.fillStyle = appearance?.mixedColor ?? '#8fb9a8';
              context.fill();
            }
            context.restore();
          });
        });
      }
    }

    if (hasSharedLayer) (map.sharedEdges ?? []).forEach((edge) => {
      if (!hasData(edge.edge.data)) return;
      getSharedEdgeVisualSides(edge).forEach((side) => {
        const left = originX + side.x * pitch;
        const top = originY + side.y * pitch;
        const vector = directionVector[side.direction];
        const centerX = left + cell / 2 + vector.x * (cell / 2 + gap / 2);
        const centerY = top + cell / 2 + vector.y * (cell / 2 + gap / 2);
        const horizontal = side.direction === 'north' || side.direction === 'south';
        const bounds = {
          x: centerX - (horizontal ? cell : sharedThickness) / 2,
          y: centerY - (horizontal ? sharedThickness : cell) / 2,
          width: horizontal ? cell : sharedThickness,
          height: horizontal ? sharedThickness : cell,
        };
        drawContainerLayers(edge.edge.data, {
          mode: 'shared',
          x: side.x,
          y: side.y,
          direction: side.direction,
          sharedEdgeId: edge.id,
        }, bounds, (surfaceData) => {
          const appearance = resolveAppearance(surfaceData);
          const image = resolveImage(surfaceData, patterns?.sharedEdge, imagesRef.current.sharedEdge);
          context.save();
          context.translate(left + cell / 2, top + cell / 2);
          context.rotate(directionAngle[side.direction] + Math.PI / 2);
          const stripY = -cell / 2 - gap / 2 - sharedThickness / 2;
          if (image) {
            drawThreeSlice(context, image, -cell / 2, stripY, cell, sharedThickness, sharedThickness / 2);
          } else {
            context.fillStyle = appearance?.mixedColor ?? '#7ee8bb';
            context.fillRect(-cell / 2, stripY, cell, sharedThickness);
          }
          context.restore();
        });
      });
    });

    if (hasSharedLayer) (map.sharedPoints ?? []).forEach((sharedPoint) => {
      if (!hasData(sharedPoint.point.data)) return;
      sharedPoint.positions.forEach((position) => {
        const centerX = originX + gridPointPosition(position.gridX, map.width, cell, gap, pitch);
        const centerY = originY + gridPointPosition(position.gridY, map.height, cell, gap, pitch);
        drawContainerLayers(sharedPoint.point.data, {
          mode: 'point',
          x: position.gridX,
          y: position.gridY,
          sharedPointId: sharedPoint.id,
        }, {
          x: centerX - pointSize / 2,
          y: centerY - pointSize / 2,
          width: pointSize,
          height: pointSize,
        }, (surfaceData) => {
          const appearance = resolveAppearance(surfaceData);
          const image = resolveImage(surfaceData, patterns?.sharedPoint, imagesRef.current.sharedPoint);
          if (image) {
            context.drawImage(image, centerX - pointSize / 2, centerY - pointSize / 2, pointSize, pointSize);
          } else {
            context.fillStyle = appearance?.mixedColor ?? '#9af2cd';
            context.fillRect(centerX - pointSize / 2, centerY - pointSize / 2, pointSize, pointSize);
          }
        });
      });
    });

    if (entityViewMode === 'entities') entityRegionsRef.current = entityRegions;
    else entityRegionsRef.current = [];

    if (showCoordinates) for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
      context.fillStyle = '#d8ffea';
      context.fillText(`${x},${y}`, originX + x * pitch + 3, originY + y * pitch + 11);
    }

  }, [
    map,
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
    entityTypeColors,
    entityViewMode,
    patterns,
    patternRendering,
    selectedEntityId,
    tintCache,
  ]);

  useEffect(() => {
    const canvas = selectionCanvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, devicePixelRatio || 1);
    const pixelWidth = Math.ceil(width * ratio);
    const pixelHeight = Math.ceil(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const drawResolvedSelection = (item: DungeonMapSelection) => {
      let drawableSelection = !hasSharedLayer && (item.mode === 'shared' || item.mode === 'point') ? undefined : item;
      if (hasSharedLayer && item.mode === 'shared') {
        const selectedSharedEdge = item.sharedEdgeId ? sharedEdgeById.get(item.sharedEdgeId) : undefined;
        if (selectedSharedEdge) getSharedEdgeVisualSides(selectedSharedEdge).forEach((side) => {
          drawSelection(context, {
            mode: 'shared', x: side.x, y: side.y, direction: side.direction,
            sharedEdgeId: selectedSharedEdge.id,
          }, cell, gap, pitch, edgeThickness, sharedThickness, pointSize, originX, originY, map.width, map.height);
        });
        drawableSelection = undefined;
      } else if (hasSharedLayer && item.mode === 'point') {
        const selectedSharedPoint = item.sharedPointId ? sharedPointById.get(item.sharedPointId) : undefined;
        selectedSharedPoint?.positions.forEach((position) => {
          drawSelection(context, {
            mode: 'point', x: position.gridX, y: position.gridY,
            sharedPointId: selectedSharedPoint.id,
          }, cell, gap, pitch, edgeThickness, sharedThickness, pointSize, originX, originY, map.width, map.height);
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
        );
      }
    };
    // One list represents both states: one item is a single selection, while
    // multiple items are a box selection. `selection` remains only as a legacy
    // fallback for consumers that have not migrated to the list API yet.
    const drawableSelections = selections ?? (selection ? [selection] : []);
    drawableSelections.forEach((item) => drawResolvedSelection(item));

    if (entityViewMode === 'entities') {
      entityRegionsRef.current.filter((region) => region.entity.id === selectedEntityId).forEach((region) => {
        context.save();
        context.strokeStyle = '#ffffff';
        context.lineWidth = 2.5;
        context.strokeRect(region.x - 2, region.y - 2, region.width + 4, region.height + 4);
        context.restore();
      });
      if (entityDragTarget) {
        context.save();
        context.globalAlpha = 0.85;
        drawSelection(
          context,
          entityDragTarget,
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
        );
        context.restore();
      }
    }
  }, [
    selection,
    selections,
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
    getSharedEdgeVisualSides,
    entityDragTarget,
    entityViewMode,
    selectedEntityId,
    sharedEdgeById,
    sharedPointById,
    map.height,
    map.width,
  ]);

  const canvasPoint = (event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * width,
      y: ((event.clientY - bounds.top) / bounds.height) * height,
    };
  };

  const selectionsInBox = (box: DungeonMapDragBox) => {
    const left = Math.min(box.startX, box.endX);
    const right = Math.max(box.startX, box.endX);
    const top = Math.min(box.startY, box.endY);
    const bottom = Math.max(box.startY, box.endY);
    const contains = (x: number, y: number) => x >= left && x <= right && y >= top && y <= bottom;
    const intersects = (x: number, y: number, targetWidth: number, targetHeight: number) => (
      right >= x && left <= x + targetWidth && bottom >= y && top <= y + targetHeight
    );
    const result: DungeonMapSelection[] = [];
    const allow = (mode: DungeonMapSelection['mode']) => selectionMode === 'all' || selectionMode === mode;
    // The map container is global and must only be selected explicitly through
    // map mode. It is intentionally excluded from the automatic "all" mode.
    if (selectionMode === 'map') {
      const mapPixelWidth = map.width * cell + Math.max(0, map.width - 1) * gap;
      const mapPixelHeight = map.height * cell + Math.max(0, map.height - 1) * gap;
      if (intersects(originX, originY, mapPixelWidth, mapPixelHeight)) {
        result.push({ mode: 'map', x: 0, y: 0 });
      }
    }
    if (allow('tile')) for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
      if (contains(originX + x * pitch + cell / 2, originY + y * pitch + cell / 2)) result.push({ mode: 'tile', x, y });
    }
    if (allow('edge')) for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
      directions.forEach((direction) => {
        const vector = directionVector[direction];
        const centerX = originX + x * pitch + cell / 2 + vector.x * (cell / 2 - edgeThickness / 2);
        const centerY = originY + y * pitch + cell / 2 + vector.y * (cell / 2 - edgeThickness / 2);
        if (contains(centerX, centerY)) result.push({ mode: 'edge', x, y, direction });
      });
    }
    if (allow('shared') && hasSharedLayer) (map.sharedEdges ?? []).forEach((edge) => {
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
      if (position) result.push({ mode: 'point', x: position.gridX, y: position.gridY, sharedPointId: point.id });
    });
    return result;
  };

  const selectionContainsPoint = (item: DungeonMapSelection, localX: number, localY: number): boolean => {
    if (item.mode === 'map') {
      const mapPixelWidth = map.width * cell + Math.max(0, map.width - 1) * gap;
      const mapPixelHeight = map.height * cell + Math.max(0, map.height - 1) * gap;
      return localX >= originX && localX <= originX + mapPixelWidth
        && localY >= originY && localY <= originY + mapPixelHeight;
    }
    if (item.mode === 'tile') {
      const left = originX + item.x * pitch + edgeThickness;
      const top = originY + item.y * pitch + edgeThickness;
      const tileBodySize = Math.max(0, cell - edgeThickness * 2);
      return localX >= left && localX <= left + tileBodySize
        && localY >= top && localY <= top + tileBodySize;
    }
    if (item.mode === 'point') {
      const sharedPoint = item.sharedPointId ? sharedPointById.get(item.sharedPointId) : undefined;
      return Boolean(sharedPoint?.positions.some((position) => Math.hypot(
        localX - (originX + gridPointPosition(position.gridX, map.width, cell, gap, pitch)),
        localY - (originY + gridPointPosition(position.gridY, map.height, cell, gap, pitch)),
      ) <= pointSize / 2 + 5));
    }
    const visualSides = item.mode === 'shared'
      ? item.sharedEdgeId && sharedEdgeById.has(item.sharedEdgeId)
        ? getSharedEdgeVisualSides(sharedEdgeById.get(item.sharedEdgeId)!)
        : []
      : [{ x: item.x, y: item.y, direction: item.direction ?? 'north' }];
    return visualSides.some((side) => {
      const vector = directionVector[side.direction];
      const isShared = item.mode === 'shared';
      const centerX = originX + side.x * pitch + cell / 2
        + vector.x * (isShared ? cell / 2 + gap / 2 : cell / 2 - edgeThickness / 2);
      const centerY = originY + side.y * pitch + cell / 2
        + vector.y * (isShared ? cell / 2 + gap / 2 : cell / 2 - edgeThickness / 2);
      const tangentX = -vector.y;
      const tangentY = vector.x;
      const halfLength = cell / 2;
      const thickness = isShared ? sharedThickness : edgeThickness;
      return distanceToSegment(
        localX,
        localY,
        centerX - tangentX * halfLength,
        centerY - tangentY * halfLength,
        centerX + tangentX * halfLength,
        centerY + tangentY * halfLength,
      ) <= thickness / 2 + 5;
    });
  };

  const deselectAtPoint = (localX: number, localY: number) => {
    const currentSelections = selections ?? (selection ? [selection] : []);
    const priority: Record<DungeonMapSelection['mode'], number> = {
      point: 0, shared: 1, edge: 2, tile: 3, map: 4,
    };
    const hit = [...currentSelections]
      .sort((left, right) => priority[left.mode] - priority[right.mode])
      .find((item) => selectionContainsPoint(item, localX, localY));
    if (!hit) return;
    const hitIdentity = selectionIdentity(hit);
    const nextSelections = currentSelections.filter(
      (item) => selectionIdentity(item) !== hitIdentity,
    );
    onSelectionsChange?.(nextSelections);
    if (nextSelections[0]) onSelectionChange?.(nextSelections[0]);
  };

  const selectionAtPoint = useCallback((localX: number, localY: number, forceAutomatic = false): DungeonMapSelection => {
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
      .filter(() => hasSharedLayer)
      .flatMap((edge) => getSharedEdgeVisualSides(edge).map((side) => {
        const vector = directionVector[side.direction];
        const centerX = originX + side.x * pitch + cell / 2 + vector.x * (cell / 2 + gap / 2);
        const centerY = originY + side.y * pitch + cell / 2 + vector.y * (cell / 2 + gap / 2);
        const tangentX = -vector.y;
        const tangentY = vector.x;
        const halfLength = cell / 2;
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
    const directionDistance = Math.max(0, Math.min(
      direction === 'north' ? offsetY
        : direction === 'east' ? cell - offsetX
          : direction === 'south' ? cell - offsetY
            : offsetX,
      cell,
    ));
    const singleEdgeIsHit = edgeThickness > 0 && directionDistance <= edgeThickness + 5;
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
    if (forceAutomatic || selectionMode === 'all') return automaticSelection;
    if (selectionMode === 'map') return { mode: 'map', x: 0, y: 0 };
    if (selectionMode === 'tile') return { mode: 'tile', x, y };
    if (selectionMode === 'shared') {
      return sharedEdge
        ? {
            mode: 'shared',
            x: sharedEdge.side.x,
            y: sharedEdge.side.y,
            direction: sharedEdge.side.direction,
            sharedEdgeId: sharedEdge.edge.id,
          }
        : { mode: 'shared', x, y, direction };
    }
    if (selectionMode === 'point') {
      return sharedPoint
        ? {
            mode: 'point',
            x: sharedPointHit.position.gridX,
            y: sharedPointHit.position.gridY,
            sharedPointId: sharedPoint.id,
          }
        : { mode: 'point', x, y };
    }
    return { mode: 'edge', x, y, direction };
  }, [
    cell,
    edgeThickness,
    gap,
    getSharedEdgeVisualSides,
    hasSharedLayer,
    map.height,
    map.sharedEdges,
    map.sharedPoints,
    map.width,
    originX,
    originY,
    pitch,
    pointSize,
    selectionMode,
    sharedThickness,
  ]);

  const clearEntityDrag = () => {
    entityDragRef.current = undefined;
    setEntityDragTarget(undefined);
    const overlay = entityDragOverlayRef.current;
    if (overlay) overlay.style.display = 'none';
  };

  const updateEntityDragOverlay = (point: { x: number; y: number }, entityId: string, copy: boolean) => {
    const overlay = entityDragOverlayRef.current;
    if (!overlay) return;
    overlay.textContent = `${copy ? '复制' : '移动'} ${entityId}`;
    overlay.style.display = 'block';
    overlay.style.left = `${Math.max(0, Math.min(width - 150, point.x + 10))}px`;
    overlay.style.top = `${Math.max(0, Math.min(height - 26, point.y + 10))}px`;
  };

  return (
    <div
      className={className}
      style={{
        display: 'block',
        width: width * displayScale,
        height: height * displayScale,
        maxWidth: 'none',
        flex: 'none',
        ...style,
        position: style?.position && style.position !== 'static' ? style.position : 'relative',
      }}
    >
      <canvas
        ref={mapCanvasRef}
        data-dungeon-map-canvas-layer="map"
        aria-hidden="true"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={selectionCanvasRef}
        data-dungeon-map-canvas-layer="selection"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'block',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
      <div
        ref={dragOverlayRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          display: 'none',
          boxSizing: 'border-box',
          border: '1.5px dashed',
          pointerEvents: 'none',
        }}
      />
      <div
        ref={entityDragOverlayRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          display: 'none',
          zIndex: 3,
          maxWidth: 150,
          overflow: 'hidden',
          padding: '4px 7px',
          border: '1px solid rgba(103, 232, 249, .72)',
          borderRadius: 6,
          color: '#e6fcff',
          background: 'rgba(5, 31, 35, .92)',
          boxShadow: '0 6px 18px rgba(0,0,0,.32)',
          font: '10px Consolas, monospace',
          pointerEvents: 'none',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      />
      <div
      onPointerDown={(event) => {
        if (event.button !== 0 && event.button !== 2) return;
        // A drag does not consistently emit a trailing click in every browser.
        // Never let a stale suppression flag consume the user's next real click.
        suppressClickRef.current = false;
        const point = canvasPoint(event);
        if (entityViewMode === 'entities' && event.button === 0) {
          const region = [...entityRegionsRef.current]
            .reverse()
            .find((candidate) => point.x >= candidate.x
              && point.x <= candidate.x + candidate.width
              && point.y >= candidate.y
              && point.y <= candidate.y + candidate.height);
          if (region) {
            event.currentTarget.setPointerCapture(event.pointerId);
            entityDragRef.current = {
              entityId: region.entity.id,
              source: region.location,
              startX: point.x,
              startY: point.y,
              endX: point.x,
              endY: point.y,
              copy: event.altKey,
              target: region.location,
            };
            setEntityDragTarget(region.location);
            onEntitySelect?.(region.entity.id, region.location);
            updateEntityDragOverlay(point, region.entity.id, event.altKey);
            return;
          }
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        dragBoxRef.current = {
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
          operation: event.button === 2 ? 'deselect' : 'select',
        };
        scheduleDragOverlay();
      }}
      onPointerMove={(event) => {
        const entityDrag = entityDragRef.current;
        if (entityDrag && event.currentTarget.hasPointerCapture(event.pointerId)) {
          const point = canvasPoint(event);
          const target = selectionAtPoint(point.x, point.y, true);
          entityDrag.endX = point.x;
          entityDrag.endY = point.y;
          entityDrag.target = target;
          setEntityDragTarget(target);
          updateEntityDragOverlay(point, entityDrag.entityId, entityDrag.copy);
          return;
        }
        const dragBox = dragBoxRef.current;
        if (!dragBox || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const point = canvasPoint(event);
        dragBox.endX = point.x;
        dragBox.endY = point.y;
        scheduleDragOverlay();
      }}
      onPointerCancel={() => {
        if (entityDragRef.current) clearEntityDrag();
        clearDragBox();
      }}
      onPointerUp={(event) => {
        const entityDrag = entityDragRef.current;
        if (entityDrag) {
          const point = canvasPoint(event);
          const finished = { ...entityDrag, endX: point.x, endY: point.y };
          const distance = Math.hypot(finished.endX - finished.startX, finished.endY - finished.startY);
          const target = finished.target ?? selectionAtPoint(point.x, point.y, true);
          clearEntityDrag();
          suppressClickRef.current = true;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
          if (distance < 5) {
            onEntitySelect?.(finished.entityId, finished.source);
            return;
          }
          onEntityMove?.({
            entityId: finished.entityId,
            from: finished.source,
            to: target,
            copy: finished.copy,
          });
          return;
        }
        const dragBox = dragBoxRef.current;
        if (!dragBox) return;
        const point = canvasPoint(event);
        const finished = { ...dragBox, endX: point.x, endY: point.y };
        const distance = Math.hypot(finished.endX - finished.startX, finished.endY - finished.startY);
        clearDragBox();
        if (finished.operation === 'deselect') {
          suppressContextMenuRef.current = true;
          window.setTimeout(() => {
            suppressContextMenuRef.current = false;
          }, 0);
          if (distance < 5) {
            deselectAtPoint(point.x, point.y);
            return;
          }
          const deselectedIdentities = new Set(selectionsInBox(finished).map(selectionIdentity));
          const currentSelections = selections ?? (selection ? [selection] : []);
          const nextSelections = currentSelections.filter(
            (item) => !deselectedIdentities.has(selectionIdentity(item)),
          );
          onSelectionsChange?.(nextSelections);
          if (nextSelections[0]) onSelectionChange?.(nextSelections[0]);
          return;
        }
        if (distance < 5) return;
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        const nextSelections = selectionsInBox(finished);
        onSelectionsChange?.(nextSelections);
        if (nextSelections[0]) onSelectionChange?.(nextSelections[0]);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (suppressContextMenuRef.current || dragBoxRef.current?.operation === 'deselect') return;
        const point = canvasPoint(event);
        deselectAtPoint(point.x, point.y);
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
          .filter(() => hasSharedLayer)
          .flatMap((edge) => getSharedEdgeVisualSides(edge).map((side) => {
            const vector = directionVector[side.direction];
            const centerX = originX + side.x * pitch + cell / 2 + vector.x * (cell / 2 + gap / 2);
            const centerY = originY + side.y * pitch + cell / 2 + vector.y * (cell / 2 + gap / 2);
            const tangentX = -vector.y;
            const tangentY = vector.x;
            const halfLength = cell / 2;
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
        const directionDistance = Math.max(0, Math.min(
          direction === 'north' ? offsetY
            : direction === 'east' ? cell - offsetX
              : direction === 'south' ? cell - offsetY
                : offsetX,
          cell,
        ));
        const singleEdgeIsHit = edgeThickness > 0
          && directionDistance <= edgeThickness + 5;
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
        position: 'absolute',
        inset: 0,
        display: 'block',
        width: '100%',
        height: '100%',
        touchAction: 'none',
      }}
      />
    </div>
  );
};

export const DungeonMapCanvas = React.memo(DungeonMapCanvasComponent);
