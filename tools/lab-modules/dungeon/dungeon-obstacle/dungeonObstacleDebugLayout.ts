import type { DungeonObstacleBinding } from '@/core/dungeon-obstacle';
import type { ISceneEnvironmentComponent } from '@/core/entity';
import type { DungeonMapDirection } from '@/core/map';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene';

export type DungeonObstacleDebugLayout = {
  center: readonly [number, number, number];
  size: readonly [number, number, number];
};

const resolveEdgeDebugLayout = (
  component: ISceneEnvironmentComponent,
  mapWidth: number,
  mapHeight: number,
  tileX: number,
  tileY: number,
  direction: DungeonMapDirection,
  insideTile: boolean,
): DungeonObstacleDebugLayout => {
  const tile = resolveDungeonMapTileWorldLayout(component, mapWidth, mapHeight, tileX, tileY);
  const northSouth = direction === 'north' || direction === 'south';
  const sign = direction === 'north' || direction === 'west' ? -1 : 1;
  const tileShortSide = Math.min(tile.size[0], tile.size[2]);
  const thickness = insideTile
    ? Math.max(0.45, tileShortSide * 0.12)
    : Math.max(0.18, tileShortSide * 0.04);
  const lengthScale = insideTile ? 0.72 : 1;
  const height = Math.max(1.5, tile.size[1] * 2);
  const horizontalOffset = insideTile
    ? Math.max(0, tile.size[0] / 2 - thickness / 2)
    : component.tileSpacing[0] / 2;
  const verticalOffset = insideTile
    ? Math.max(0, tile.size[2] / 2 - thickness / 2)
    : component.tileSpacing[1] / 2;
  const center: [number, number, number] = [
    tile.center[0] + (!northSouth ? sign * horizontalOffset : 0),
    tile.center[1] + tile.size[1] / 2 + height / 2,
    tile.center[2] + (northSouth ? sign * verticalOffset : 0),
  ];
  return {
    center,
    size: northSouth
      ? [tile.size[0] * lengthScale, height, thickness]
      : [thickness, height, tile.size[2] * lengthScale],
  };
};

/** 计算组合式 Lab 中阻碍 Debug 盒的布局，不参与正式碰撞规则。 */
export const resolveDungeonObstacleDebugLayout = (
  binding: DungeonObstacleBinding,
  component: ISceneEnvironmentComponent,
  mapWidth: number,
  mapHeight: number,
): DungeonObstacleDebugLayout => {
  if (binding.placement.kind === 'tile') {
    const tile = resolveDungeonMapTileWorldLayout(
      component, mapWidth, mapHeight, binding.placement.tileX, binding.placement.tileY,
    );
    const height = Math.max(0.8, tile.size[1]);
    return {
      center: [
        tile.center[0],
        tile.center[1] + tile.size[1] / 2 + height / 2,
        tile.center[2],
      ],
      size: [tile.size[0] * 0.65, height, tile.size[2] * 0.65],
    };
  }
  if (binding.placement.kind === 'tile-edge') {
    return resolveEdgeDebugLayout(
      component,
      mapWidth,
      mapHeight,
      binding.placement.tileX,
      binding.placement.tileY,
      binding.placement.direction,
      true,
    );
  }
  return resolveEdgeDebugLayout(
    component,
    mapWidth,
    mapHeight,
    binding.placement.side.x,
    binding.placement.side.y,
    binding.placement.side.direction,
    false,
  );
};
