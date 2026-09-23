import type { DungeonMapDirection } from '../map/index.ts';

export type DungeonDiagonalDirection =
  | 'north-east'
  | 'south-east'
  | 'south-west'
  | 'north-west';

/** 地图 Side 仍是四方向；该类型只描述 Actor 的单次格步。 */
export type DungeonMovementDirection = DungeonMapDirection | DungeonDiagonalDirection;
export type DungeonMovementDirectionMode = 'four-way' | 'eight-way';
export type DungeonCornerPolicy = 'forbid' | 'allow-if-one-route' | 'allow';

export type DungeonMovementProfile = Readonly<{
  id: string;
  directionMode: DungeonMovementDirectionMode;
  cornerPolicy: DungeonCornerPolicy;
  diagonalDistanceScale: number;
  reserveDiagonalCrossing: boolean;
}>;

export const DUNGEON_CARDINAL_MOVEMENT_DIRECTIONS = [
  'north', 'east', 'south', 'west',
] as const satisfies readonly DungeonMapDirection[];

export const DUNGEON_DIAGONAL_MOVEMENT_DIRECTIONS = [
  'north-east', 'south-east', 'south-west', 'north-west',
] as const satisfies readonly DungeonDiagonalDirection[];

export const DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS = [
  'north', 'north-east', 'east', 'south-east',
  'south', 'south-west', 'west', 'north-west',
] as const satisfies readonly DungeonMovementDirection[];

const DIRECTION_VECTORS: Readonly<Record<
  DungeonMovementDirection,
  Readonly<{ x: -1 | 0 | 1; y: -1 | 0 | 1 }>
>> = {
  north: { x: 0, y: -1 },
  'north-east': { x: 1, y: -1 },
  east: { x: 1, y: 0 },
  'south-east': { x: 1, y: 1 },
  south: { x: 0, y: 1 },
  'south-west': { x: -1, y: 1 },
  west: { x: -1, y: 0 },
  'north-west': { x: -1, y: -1 },
};

const BUILTIN_PROFILES: Readonly<Record<string, DungeonMovementProfile>> = {
  ground: {
    id: 'ground', directionMode: 'four-way', cornerPolicy: 'forbid',
    diagonalDistanceScale: Math.SQRT2, reserveDiagonalCrossing: true,
  },
  'ground-four-way': {
    id: 'ground-four-way', directionMode: 'four-way', cornerPolicy: 'forbid',
    diagonalDistanceScale: Math.SQRT2, reserveDiagonalCrossing: true,
  },
  'ground-eight-way': {
    id: 'ground-eight-way', directionMode: 'eight-way', cornerPolicy: 'forbid',
    diagonalDistanceScale: Math.SQRT2, reserveDiagonalCrossing: true,
  },
};

export const isDungeonDiagonalDirection = (
  direction: DungeonMovementDirection,
): direction is DungeonDiagonalDirection => direction.includes('-');

export const getDungeonMovementDirectionVector = (
  direction: DungeonMovementDirection,
): Readonly<{ x: -1 | 0 | 1; y: -1 | 0 | 1 }> => DIRECTION_VECTORS[direction];

export const getDungeonDiagonalAxes = (
  direction: DungeonDiagonalDirection,
): readonly [DungeonMapDirection, DungeonMapDirection] => {
  const vector = DIRECTION_VECTORS[direction];
  return [vector.x > 0 ? 'east' : 'west', vector.y > 0 ? 'south' : 'north'];
};

export const getDungeonMovementDirectionCost = (direction: DungeonMovementDirection): number => (
  isDungeonDiagonalDirection(direction) ? Math.SQRT2 : 1
);

export const resolveDungeonMovementProfile = (profileId: string): DungeonMovementProfile => (
  BUILTIN_PROFILES[profileId] ?? BUILTIN_PROFILES.ground
);

export const getDungeonMovementDirectionsForMode = (
  mode: DungeonMovementDirectionMode,
): readonly DungeonMovementDirection[] => mode === 'eight-way'
  ? DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS
  : DUNGEON_CARDINAL_MOVEMENT_DIRECTIONS;

/** 四方向逻辑朝向对斜向移动使用垂直轴作为稳定降级。 */
export const resolveDungeonCardinalFacing = (
  direction: DungeonMovementDirection,
): DungeonMapDirection => isDungeonDiagonalDirection(direction)
  ? getDungeonDiagonalAxes(direction)[1]
  : direction;

export const getDungeonMovementDirectionYaw = (direction: DungeonMovementDirection): number => {
  const vector = DIRECTION_VECTORS[direction];
  return Math.atan2(vector.x, vector.y);
};

export const getDungeonDiagonalCornerIndex = (direction: DungeonDiagonalDirection): number => ({
  'north-west': 0,
  'north-east': 1,
  'south-east': 2,
  'south-west': 3,
})[direction];
