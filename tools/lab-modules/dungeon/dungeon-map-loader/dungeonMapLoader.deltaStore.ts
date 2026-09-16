import {
  applyDungeonMapDocumentDelta,
  createDungeonMapDocumentDelta,
  isDungeonMapDocumentDeltaV1,
  type DungeonMapDocumentDeltaV1,
} from '../../../../core/map-document/dungeonMapDocument.delta.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';
import { projectDungeonMapDocumentToLegacyMap } from '../../../../core/map-document/dungeonMapDocument.projection.ts';
import type { DungeonMapDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.types.ts';
import {
  applyDungeonMapDelta,
  isDungeonMapDefinitionRefsDelta,
} from '../../../../core/map/dungeonMap.delta.ts';
import type { DungeonMapDefinitionRefsDelta } from '../../../../core/map/dungeonMap.delta.types.ts';

export type DungeonMapSavedDelta = DungeonMapDocumentDeltaV1 | DungeonMapDefinitionRefsDelta;

const clone = <T>(value: T): T => structuredClone(value);

export type DungeonMapDeltaStore = {
  /** 使用只读 V2 基础文档和已有 Delta 创建一份独立活文档。旧 Delta 会在此兼容迁移。 */
  restore(presetKey: string, base: DungeonMapDocumentV2): DungeonMapDocumentV2;
  capture(
    presetKey: string,
    base: DungeonMapDocumentV2,
    live: DungeonMapDocumentV2,
  ): DungeonMapDocumentDeltaV1 | null;
  preview(
    presetKey: string,
    base: DungeonMapDocumentV2,
    live: DungeonMapDocumentV2,
  ): DungeonMapDocumentDeltaV1 | null;
  get(presetKey: string): DungeonMapSavedDelta | null;
  readAll(): Readonly<Record<string, DungeonMapSavedDelta>>;
  replaceAll(next: Readonly<Record<string, DungeonMapSavedDelta>>): void;
};

export const createDungeonMapDeltaStore = (): DungeonMapDeltaStore => {
  const deltas: Record<string, DungeonMapSavedDelta> = {};
  const preview: DungeonMapDeltaStore['preview'] = (presetKey, base, live) => (
    createDungeonMapDocumentDelta(presetKey, base, live)
  );
  return {
    restore(presetKey, base) {
      const delta = deltas[presetKey];
      if (!delta) return clone(base);
      if (isDungeonMapDocumentDeltaV1(delta)) {
        return applyDungeonMapDocumentDelta(base, delta, presetKey);
      }
      if (!isDungeonMapDefinitionRefsDelta(delta)) throw new Error(`地图“${presetKey}”的 Delta 格式无效。`);
      const legacyMap = applyDungeonMapDelta(projectDungeonMapDocumentToLegacyMap(base), delta, presetKey);
      return migrateDungeonMapToDocumentV2({
        presetKey,
        name: base.identity.name,
        map: legacyMap,
      }).document;
    },
    capture(presetKey, base, live) {
      const delta = preview(presetKey, base, live);
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
