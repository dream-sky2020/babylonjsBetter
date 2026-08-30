import type { DungeonMapDirection } from '../map';
import type { DungeonRuntime, DungeonRuntimePlayerPosition } from '../dungeon-runtime';
import { findDungeonMovementObstacles } from '../dungeon-obstacle';

const DIRECTION_OFFSETS: Readonly<Record<DungeonMapDirection, Readonly<{ x: number; y: number }>>> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

export type DungeonPlayerMovementOptions = {
  /** 默认开启；开启后目标格超出地图尺寸时拒绝移动。 */
  restrictToMapBounds?: boolean;
  /** 默认开启；开启后玩家不能进入阻碍格或跨越带启用阻碍的独立边/公用边。 */
  restrictMovementObstacles?: boolean;
};

export type DungeonPlayerMovementResult = {
  moved: boolean;
  direction: DungeonMapDirection;
  from: DungeonRuntimePlayerPosition;
  to: DungeonRuntimePlayerPosition;
  blockedReason?: 'map-boundary' | 'movement-obstacle';
  blockedObstacleIds?: readonly string[];
};

/**
 * 执行一次玩家格步移动并直接更新 DungeonRuntime。
 * 负责坐标、地图边界和运行时阻碍状态；普通墙、边事件与其他实体占用仍由后续规则处理。
 */
export const moveDungeonPlayer = (
  runtime: DungeonRuntime,
  direction: DungeonMapDirection,
  options: DungeonPlayerMovementOptions = {},
): DungeonPlayerMovementResult => {
  const from = { ...runtime.playerPosition };
  const offset = DIRECTION_OFFSETS[direction];
  const to = { tileX: from.tileX + offset.x, tileY: from.tileY + offset.y };
  const restrictToMapBounds = options.restrictToMapBounds ?? true;
  const outside = to.tileX < 0 || to.tileY < 0
    || to.tileX >= runtime.map.width || to.tileY >= runtime.map.height;
  if (restrictToMapBounds && outside) {
    return { moved: false, direction, from, to, blockedReason: 'map-boundary' };
  }
  const restrictMovementObstacles = options.restrictMovementObstacles ?? true;
  if (restrictMovementObstacles) {
    const obstacles = findDungeonMovementObstacles(runtime, from, to, direction);
    if (obstacles.length > 0) {
      return {
        moved: false,
        direction,
        from,
        to,
        blockedReason: 'movement-obstacle',
        blockedObstacleIds: obstacles.map(({ entity }) => entity.id),
      };
    }
  }
  runtime.playerPosition = to;
  return { moved: true, direction, from, to };
};
