import type { DungeonEntranceData, DungeonExitData } from '@/core/dungeon-transition/dungeonTransitionData';
import type { DungeonMapTileLayoutSettings } from '@/core/scene/dungeonMapSceneLayout';
import {
  resolveDungeonEdgeDebugLayout,
  resolveDungeonTileDebugLayout,
  type DungeonObstacleDebugLayout,
} from '../dungeon-obstacle/dungeonObstacleDebugLayout';

export type DungeonTransitionDebugBinding =
  | Readonly<{ kind: 'entrance'; binding: DungeonEntranceData }>
  | Readonly<{ kind: 'exit'; binding: DungeonExitData }>;

/** 与阻碍 Debug 共用空间规则，保证格子、独立边和公用边盒对齐。 */
export const resolveDungeonTransitionDebugLayout = (
  target: DungeonTransitionDebugBinding,
  component: DungeonMapTileLayoutSettings,
  mapWidth: number,
  mapHeight: number,
): DungeonObstacleDebugLayout => {
  if (target.kind === 'entrance') {
    const layout = resolveDungeonTileDebugLayout(
      component, mapWidth, mapHeight, target.binding.tileX, target.binding.tileY,
    );
    return {
      center: layout.center,
      size: [layout.size[0] * 0.55, layout.size[1] * 1.15, layout.size[2] * 0.55],
    };
  }
  const { location } = target.binding;
  if (location.kind === 'tile') {
    return resolveDungeonTileDebugLayout(
      component, mapWidth, mapHeight, location.tileX, location.tileY,
    );
  }
  if (location.kind === 'tile-edge') {
    return resolveDungeonEdgeDebugLayout(
      component, mapWidth, mapHeight,
      location.tileX, location.tileY, location.direction, true,
    );
  }
  const side = location.sides[0];
  if (!side) throw new Error(`公用边出口“${target.binding.entityId}”缺少边端点。`);
  return resolveDungeonEdgeDebugLayout(
    component, mapWidth, mapHeight,
    side.x, side.y, side.direction, false,
  );
};
