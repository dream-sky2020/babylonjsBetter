import {
  SCENE_ENVIRONMENT_MAP_ANCHOR_MODES,
  type ISceneEnvironmentComponent,
} from '../entity';

export type DungeonMapTileWorldLayout = {
  center: readonly [number, number, number];
  size: readonly [number, number, number];
};

/**
 * 地图 x 映射到世界 X，地图 y 映射到世界 Z。
 * first-tile：mapOffset 是 (0,0) 格子的底面中心。
 * map-center：mapOffset 是整张格子布局的 3D 中心。
 */
export const resolveDungeonMapTileWorldLayout = (
  component: ISceneEnvironmentComponent,
  mapWidth: number,
  mapHeight: number,
  tileX: number,
  tileY: number,
): DungeonMapTileWorldLayout => {
  const centered = component.mapAnchorMode === SCENE_ENVIRONMENT_MAP_ANCHOR_MODES.MAP_CENTER;
  const anchorTileX = centered ? (mapWidth - 1) / 2 : 0;
  const anchorTileY = centered ? (mapHeight - 1) / 2 : 0;
  return {
    center: [
      component.mapOffset[0] + (tileX - anchorTileX) * component.tileSpacing[0],
      component.mapOffset[1] + (centered ? 0 : component.tileSize[1] / 2),
      component.mapOffset[2] + (tileY - anchorTileY) * component.tileSpacing[1],
    ],
    size: component.tileSize,
  };
};
