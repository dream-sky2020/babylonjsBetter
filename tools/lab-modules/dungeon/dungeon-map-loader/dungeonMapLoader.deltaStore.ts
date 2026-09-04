import {
  applyDungeonMapDelta,
  createDungeonMapDefinitionRefsDelta,
} from '../../../../core/map/dungeonMap.delta.ts';
import {
  decodeDungeonMapData,
  isDungeonMapDefinitionRefsData,
} from '../../../../core/map/dungeonMap.definition.ts';
import type { DungeonMapDefinitionRefsDelta } from '../../../../core/map/dungeonMap.delta.types.ts';
import type { DungeonMapStoredData } from '../../../../core/map/dungeonMap.definition.types.ts';
import type { DungeonMapData } from '../../../../core/map/dungeonMap.types.ts';

const clone = <T>(value: T): T => structuredClone(value);

export const isDungeonMapDeltaEmpty = (delta: DungeonMapDefinitionRefsDelta): boolean => (
  delta.dataDefinitions.length === 0
  && delta.mapDataDefinitionRef === undefined
  && delta.tileDataDefinitionRefChanges === undefined
  && delta.tileEdgeDataDefinitionRefChanges === undefined
  && delta.sharedEdgeChanges === undefined
  && delta.sharedPointChanges === undefined
  && delta.connectionChanges === undefined
  && delta.tilePropertyChanges === undefined
  && delta.tileEdgePropertyChanges === undefined
  && delta.markers === undefined
  && delta.metadata === undefined
);

export type DungeonMapDeltaStore = {
  /** 使用只读基础地图和已有 Delta 创建一份独立的活地图。 */
  restore(presetKey: string, baseMap: DungeonMapStoredData): DungeonMapData;
  /** 计算并保存当前活地图的 Delta；无变化时删除已有 Delta。 */
  capture(
    presetKey: string,
    baseMap: DungeonMapStoredData,
    liveMap: DungeonMapStoredData,
  ): DungeonMapDefinitionRefsDelta | null;
  /** 只计算当前差异，不修改 Store。 */
  preview(
    presetKey: string,
    baseMap: DungeonMapStoredData,
    liveMap: DungeonMapStoredData,
  ): DungeonMapDefinitionRefsDelta | null;
  get(presetKey: string): DungeonMapDefinitionRefsDelta | null;
  readAll(): Readonly<Record<string, DungeonMapDefinitionRefsDelta>>;
  replaceAll(next: Readonly<Record<string, DungeonMapDefinitionRefsDelta>>): void;
};

export const createDungeonMapDeltaStore = (): DungeonMapDeltaStore => {
  const deltas: Record<string, DungeonMapDefinitionRefsDelta> = {};
  const preview: DungeonMapDeltaStore['preview'] = (presetKey, baseMap, liveMap) => {
    const delta = createDungeonMapDefinitionRefsDelta(presetKey, baseMap, liveMap);
    return isDungeonMapDeltaEmpty(delta) ? null : delta;
  };
  return {
    restore(presetKey, baseMap) {
      const delta = deltas[presetKey];
      if (delta) return applyDungeonMapDelta(baseMap, delta, presetKey);
      return isDungeonMapDefinitionRefsData(baseMap)
        ? decodeDungeonMapData(baseMap)
        : clone(baseMap as DungeonMapData);
    },
    capture(presetKey, baseMap, liveMap) {
      const delta = preview(presetKey, baseMap, liveMap);
      if (delta) deltas[presetKey] = clone(delta);
      else delete deltas[presetKey];
      return delta ? clone(delta) : null;
    },
    preview,
    get(presetKey) {
      const delta = deltas[presetKey];
      return delta ? clone(delta) : null;
    },
    readAll() {
      return clone(deltas);
    },
    replaceAll(next) {
      Object.keys(deltas).forEach((key) => delete deltas[key]);
      Object.entries(clone(next)).forEach(([key, delta]) => { deltas[key] = delta; });
    },
  };
};
