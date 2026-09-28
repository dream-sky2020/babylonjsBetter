/** 保留旧 Service Key，避免已有俯视 Lab 的消费者失效。 */
export const DUNGEON_GRID_VIEW_SERVICE_KEY = 'dungeon-grid-debug:view';
export type { DungeonViewConsumer, DungeonViewLease, ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView.ts';
