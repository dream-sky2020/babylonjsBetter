import type { DungeonMapTopologyMode } from './dungeonMap.types';

/** 左右边缘是否在数据上属于同一条接缝。 */
export const dungeonMapWrapsX = (mode: DungeonMapTopologyMode | undefined): boolean => (
  mode === 'loop-horizontal' || mode === 'loop'
);

/** 上下边缘是否在数据上属于同一条接缝。 */
export const dungeonMapWrapsY = (mode: DungeonMapTopologyMode | undefined): boolean => (
  mode === 'loop-vertical' || mode === 'loop'
);

export const wrapDungeonMapCoordinate = (value: number, size: number): number => (
  ((value % size) + size) % size
);
