import type { DungeonMapDirection } from '../map';
import type {
  DungeonRuntime,
  DungeonRuntimePlayerPosition,
  DungeonRuntimeWorldPosition,
} from '../dungeon-runtime';
import { findDungeonMovementObstacles } from '../dungeon-obstacle';

const DIRECTION_OFFSETS: Readonly<Record<DungeonMapDirection, Readonly<{ x: number; y: number }>>> = {
  north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 },
};

const DIRECTION_YAWS: Readonly<Record<DungeonMapDirection, number>> = {
  north: Math.PI, east: Math.PI / 2, south: 0, west: -Math.PI / 2,
};

const CLOCKWISE_DIRECTIONS: readonly DungeonMapDirection[] = ['north', 'east', 'south', 'west'];

export type DungeonPlayerTurn = 'left' | 'back' | 'right';
export type DungeonPlayerRelativeMovement = 'forward' | 'backward' | 'left' | 'right';
export const DUNGEON_PLAYER_MOVEMENT_TIMING_MODES = ['world-units-per-second', 'seconds-per-tile'] as const;
export type DungeonPlayerMovementTimingMode = typeof DUNGEON_PLAYER_MOVEMENT_TIMING_MODES[number];
export const DUNGEON_PLAYER_TURN_TIMING_MODES = ['radians-per-second', 'seconds-per-turn'] as const;
export type DungeonPlayerTurnTimingMode = typeof DUNGEON_PLAYER_TURN_TIMING_MODES[number];

export type DungeonPlayerMovementOptions = {
  /** 默认开启；开启后目标格超出地图尺寸时拒绝移动。 */
  restrictToMapBounds?: boolean;
  /** 默认开启；开启后玩家不能进入阻碍格或跨越带启用阻碍的独立边/公用边。 */
  restrictMovementObstacles?: boolean;
  /** 移动计时模式；默认按世界单位/秒。 */
  movementTimingMode?: DungeonPlayerMovementTimingMode;
  /** 世界单位/秒，默认 6；仅用于 world-units-per-second。 */
  movementSpeed?: number;
  /** 每跨越一格所需秒数，默认 1；仅用于 seconds-per-tile。 */
  movementSecondsPerTile?: number;
  /** 转向计时模式；默认按弧度/秒。 */
  turnTimingMode?: DungeonPlayerTurnTimingMode;
  /** 弧度/秒，默认一秒旋转一整圈；仅用于 radians-per-second。 */
  turnSpeed?: number;
  /** 每次转向动作所需秒数，默认 0.25；仅用于 seconds-per-turn。 */
  turnSecondsPerAction?: number;
  /** 开启后跳过位置和转向插值并立即完成移动。 */
  teleport?: boolean;
  /** 默认开启；关闭时只移动位置，不把玩家朝向改为移动方向。 */
  faceMovementDirection?: boolean;
  /** 把逻辑格子坐标转换成连续 3D 世界坐标。 */
  resolveWorldPosition(position: DungeonRuntimePlayerPosition): readonly [number, number, number];
};

export type DungeonPlayerMovementResult = {
  started: boolean;
  completed: boolean;
  direction: DungeonMapDirection;
  from: DungeonRuntimePlayerPosition;
  to: DungeonRuntimePlayerPosition;
  blockedReason?: 'map-boundary' | 'movement-obstacle' | 'movement-in-progress';
  blockedObstacleIds?: readonly string[];
};

export type DungeonPlayerMovementUpdateResult = {
  active: boolean;
  completed: boolean;
  movementProgress: number;
  turnProgress: number;
};

export type DungeonPlayerTurnOptions = {
  /** 转向计时模式；默认按弧度/秒。 */
  turnTimingMode?: DungeonPlayerTurnTimingMode;
  /** 弧度/秒，默认一秒旋转一整圈；仅用于 radians-per-second。 */
  turnSpeed?: number;
  /** 每次转向动作所需秒数，默认 0.25；仅用于 seconds-per-turn。 */
  turnSecondsPerAction?: number;
  /** 开启后立即完成转向。 */
  teleport?: boolean;
};

export type DungeonPlayerTurnResult = {
  started: boolean;
  completed: boolean;
  turn: DungeonPlayerTurn;
  fromFacing: DungeonMapDirection;
  toFacing: DungeonMapDirection;
  blockedReason?: 'movement-in-progress';
};

const assertPositiveSpeed = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label}必须是大于 0 的有限数值。`);
  return value;
};

const distance3d = (from: DungeonRuntimeWorldPosition, to: DungeonRuntimeWorldPosition): number => Math.hypot(
  to[0] - from[0], to[1] - from[1], to[2] - from[2],
);

const shortestAngleDelta = (from: number, to: number): number => {
  const fullTurn = Math.PI * 2;
  return ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
};

const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

const resolveMovementDuration = (
  distance: number,
  options: DungeonPlayerMovementOptions,
): number => options.movementTimingMode === 'seconds-per-tile'
  ? assertPositiveSpeed(options.movementSecondsPerTile ?? 1, '每格移动耗时')
  : distance / assertPositiveSpeed(options.movementSpeed ?? 6, '移动速度');

const resolveTurnDuration = (
  yawDelta: number,
  options: DungeonPlayerTurnOptions,
): number => {
  if (Math.abs(yawDelta) <= Number.EPSILON) return 0;
  return options.turnTimingMode === 'seconds-per-turn'
    ? assertPositiveSpeed(options.turnSecondsPerAction ?? 0.25, '每次转向耗时')
    : Math.abs(yawDelta) / assertPositiveSpeed(options.turnSpeed ?? Math.PI * 2, '转向速度');
};

/**
 * 验证一次格步移动并创建运行时过渡。该函数不会在非瞬移模式下立刻提交目标格，
 * 调用方需要每帧调用 updateDungeonPlayerMovement()。
 */
export const startDungeonPlayerMovement = (
  runtime: DungeonRuntime,
  direction: DungeonMapDirection,
  options: DungeonPlayerMovementOptions,
): DungeonPlayerMovementResult => {
  const from = { ...runtime.playerPosition };
  const offset = DIRECTION_OFFSETS[direction];
  const to = { tileX: from.tileX + offset.x, tileY: from.tileY + offset.y };
  if (runtime.playerMovement) {
    return { started: false, completed: false, direction, from, to, blockedReason: 'movement-in-progress' };
  }
  const outside = to.tileX < 0 || to.tileY < 0 || to.tileX >= runtime.map.width || to.tileY >= runtime.map.height;
  if ((options.restrictToMapBounds ?? true) && outside) {
    return { started: false, completed: false, direction, from, to, blockedReason: 'map-boundary' };
  }
  if (options.restrictMovementObstacles ?? true) {
    const obstacles = findDungeonMovementObstacles(runtime, from, to, direction);
    if (obstacles.length > 0) {
      return {
        started: false,
        completed: false,
        direction,
        from,
        to,
        blockedReason: 'movement-obstacle',
        blockedObstacleIds: obstacles.map(({ entity }) => entity.id),
      };
    }
  }
  const fromWorldPosition: DungeonRuntimeWorldPosition = [...runtime.playerWorldPosition];
  const resolvedTarget = options.resolveWorldPosition(to);
  const toWorldPosition: DungeonRuntimeWorldPosition = [resolvedTarget[0], resolvedTarget[1], resolvedTarget[2]];
  const targetFacing = (options.faceMovementDirection ?? true) ? direction : runtime.playerFacing;
  const yawDelta = shortestAngleDelta(runtime.playerWorldRotationY, DIRECTION_YAWS[targetFacing]);
  const movementDurationSeconds = resolveMovementDuration(distance3d(fromWorldPosition, toWorldPosition), options);
  const turnDurationSeconds = resolveTurnDuration(yawDelta, options);
  runtime.playerMovement = {
    kind: 'move',
    direction,
    targetFacing,
    from,
    to,
    fromWorldPosition,
    toWorldPosition,
    fromWorldRotationY: runtime.playerWorldRotationY,
    toWorldRotationY: runtime.playerWorldRotationY + yawDelta,
    elapsedSeconds: 0,
    movementDurationSeconds,
    turnDurationSeconds,
  };
  if (options.teleport) {
    updateDungeonPlayerMovement(runtime, Number.POSITIVE_INFINITY);
    return { started: true, completed: true, direction, from, to };
  }
  return { started: true, completed: false, direction, from, to };
};

const resolveTurnFacing = (
  facing: DungeonMapDirection,
  turn: DungeonPlayerTurn,
): DungeonMapDirection => {
  const currentIndex = CLOCKWISE_DIRECTIONS.indexOf(facing);
  const offset = turn === 'left' ? -1 : turn === 'right' ? 1 : 2;
  return CLOCKWISE_DIRECTIONS[(currentIndex + offset + CLOCKWISE_DIRECTIONS.length) % CLOCKWISE_DIRECTIONS.length];
};

/** 创建一次原地转向；使用相同的逐帧更新函数推进连续旋转。 */
export const startDungeonPlayerTurn = (
  runtime: DungeonRuntime,
  turn: DungeonPlayerTurn,
  options: DungeonPlayerTurnOptions = {},
): DungeonPlayerTurnResult => {
  const fromFacing = runtime.playerFacing;
  const toFacing = resolveTurnFacing(fromFacing, turn);
  if (runtime.playerMovement) {
    return { started: false, completed: false, turn, fromFacing, toFacing, blockedReason: 'movement-in-progress' };
  }
  const yawDelta = shortestAngleDelta(runtime.playerWorldRotationY, DIRECTION_YAWS[toFacing]);
  const position = { ...runtime.playerPosition };
  const worldPosition: DungeonRuntimeWorldPosition = [...runtime.playerWorldPosition];
  runtime.playerMovement = {
    kind: 'turn',
    direction: toFacing,
    targetFacing: toFacing,
    from: position,
    to: position,
    fromWorldPosition: worldPosition,
    toWorldPosition: [...worldPosition],
    fromWorldRotationY: runtime.playerWorldRotationY,
    toWorldRotationY: runtime.playerWorldRotationY + yawDelta,
    elapsedSeconds: 0,
    movementDurationSeconds: 0,
    turnDurationSeconds: resolveTurnDuration(yawDelta, options),
  };
  if (options.teleport) {
    updateDungeonPlayerMovement(runtime, Number.POSITIVE_INFINITY);
    return { started: true, completed: true, turn, fromFacing, toFacing };
  }
  return { started: true, completed: false, turn, fromFacing, toFacing };
};

/** 每帧推进当前移动过程，并在位置和转向都结束后提交权威格子位置与朝向。 */
export const updateDungeonPlayerMovement = (
  runtime: DungeonRuntime,
  deltaSeconds: number,
): DungeonPlayerMovementUpdateResult => {
  const movement = runtime.playerMovement;
  if (!movement) return { active: false, completed: false, movementProgress: 1, turnProgress: 1 };
  if ((!Number.isFinite(deltaSeconds) && deltaSeconds !== Number.POSITIVE_INFINITY) || deltaSeconds < 0) {
    throw new RangeError('移动帧时间必须是非负数。');
  }
  movement.elapsedSeconds += deltaSeconds;
  const movementProgress = movement.movementDurationSeconds <= 0
    ? 1 : Math.min(1, movement.elapsedSeconds / movement.movementDurationSeconds);
  const turnProgress = movement.turnDurationSeconds <= 0
    ? 1 : Math.min(1, movement.elapsedSeconds / movement.turnDurationSeconds);
  runtime.playerWorldPosition = [
    lerp(movement.fromWorldPosition[0], movement.toWorldPosition[0], movementProgress),
    lerp(movement.fromWorldPosition[1], movement.toWorldPosition[1], movementProgress),
    lerp(movement.fromWorldPosition[2], movement.toWorldPosition[2], movementProgress),
  ];
  runtime.playerWorldRotationY = lerp(movement.fromWorldRotationY, movement.toWorldRotationY, turnProgress);
  const completed = movementProgress >= 1 && turnProgress >= 1;
  if (completed) {
    runtime.playerPosition = { ...movement.to };
    runtime.playerFacing = movement.targetFacing;
    runtime.playerMovement = null;
  }
  return { active: !completed, completed, movementProgress, turnProgress };
};

/** 兼容需要立即完成单步移动的调用；新运行时应使用 start + update。 */
export const moveDungeonPlayer = (
  runtime: DungeonRuntime,
  direction: DungeonMapDirection,
  options: DungeonPlayerMovementOptions,
): DungeonPlayerMovementResult => startDungeonPlayerMovement(runtime, direction, { ...options, teleport: true });

const resolveRelativeMovementDirection = (
  facing: DungeonMapDirection,
  movement: DungeonPlayerRelativeMovement,
): DungeonMapDirection => {
  const currentIndex = CLOCKWISE_DIRECTIONS.indexOf(facing);
  const offset = movement === 'forward' ? 0 : movement === 'right' ? 1 : movement === 'backward' ? 2 : -1;
  return CLOCKWISE_DIRECTIONS[(currentIndex + offset + CLOCKWISE_DIRECTIONS.length) % CLOCKWISE_DIRECTIONS.length];
};

/** 按玩家当前朝向执行前进、后退或横移；不会改变玩家朝向。 */
export const startDungeonPlayerRelativeMovement = (
  runtime: DungeonRuntime,
  movement: DungeonPlayerRelativeMovement,
  options: DungeonPlayerMovementOptions,
): DungeonPlayerMovementResult => startDungeonPlayerMovement(
  runtime,
  resolveRelativeMovementDirection(runtime.playerFacing, movement),
  { ...options, faceMovementDirection: false },
);
