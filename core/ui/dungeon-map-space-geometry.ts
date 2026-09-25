/** Map-space proportions shared by the ordinary Canvas and the Three.js editor view. */
export const dungeonMapTopologyColors = {
  background: '#0b1713',
  tile: '#172c25',
  side: '#315044',
  sharedEdge: '#437762',
  point: '#62a98b',
  outline: 'rgba(151, 211, 185, .24)',
  outlineColor: '#97d3b9',
  outlineOpacity: 0.24,
} as const;

export const dungeonMapSpaceMetrics = (
  cell: number,
  edgeThicknessRatio: number,
  sharedEdgeThicknessRatio: number,
) => {
  const edgeThickness = Math.min(cell / 2, Math.max(0, cell * edgeThicknessRatio));
  const sharedThickness = Math.max(0, cell * sharedEdgeThicknessRatio);
  const gap = sharedThickness > 0 ? sharedThickness : 0;
  return {
    cell,
    edgeThickness,
    sharedThickness,
    gap,
    pitch: cell + gap,
    pointSize: gap,
    tileBodySize: Math.max(0, cell - edgeThickness * 2),
    hasSharedLayer: gap > 0,
  };
};

export type DungeonMapSpaceMetrics = ReturnType<typeof dungeonMapSpaceMetrics>;

/** North Side outline in Canvas coordinates, relative to the Tile center. */
export const northTileSidePolygon = (cell: number, edgeThickness: number) => {
  const half = cell / 2;
  const depth = Math.min(half, Math.max(0, edgeThickness));
  return [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half - depth, y: -half + depth },
    { x: -half + depth, y: -half + depth },
  ] as const;
};

export const dungeonMapGridPointPosition = (
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
