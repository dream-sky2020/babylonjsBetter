import type {
  DungeonMapDocumentGrid,
  DungeonMapDocumentLegacyData,
  DungeonMapDocumentV2,
} from './dungeonMapDocument.types.ts';
import { parseDungeonMapDocumentV2 } from './dungeonMapDocument.codec.ts';

export type DungeonMapDocumentDeltaV1 = Readonly<{
  version: 1;
  format: 'dungeon-map-document-delta';
  basePresetKey: string;
  changes: Readonly<{
    identity?: DungeonMapDocumentV2['identity'];
    grid?: DungeonMapDocumentGrid;
    entities?: DungeonMapDocumentV2['entities'];
    components?: DungeonMapDocumentV2['components'];
    metadata?: DungeonMapDocumentV2['metadata'] | null;
    legacy?: DungeonMapDocumentLegacyData | null;
  }>;
}>;

const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

export const isDungeonMapDocumentDeltaV1 = (value: unknown): value is DungeonMapDocumentDeltaV1 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<DungeonMapDocumentDeltaV1>;
  return candidate.version === 1
    && candidate.format === 'dungeon-map-document-delta'
    && typeof candidate.basePresetKey === 'string'
    && !!candidate.changes && typeof candidate.changes === 'object' && !Array.isArray(candidate.changes);
};

export const createDungeonMapDocumentDelta = (
  basePresetKey: string,
  base: DungeonMapDocumentV2,
  current: DungeonMapDocumentV2,
): DungeonMapDocumentDeltaV1 | null => {
  const changes: DungeonMapDocumentDeltaV1['changes'] & Record<string, unknown> = {};
  if (!same(base.identity, current.identity)) changes.identity = structuredClone(current.identity);
  if (!same(base.grid, current.grid)) changes.grid = structuredClone(current.grid);
  if (!same(base.entities, current.entities)) changes.entities = structuredClone(current.entities);
  if (!same(base.components, current.components)) changes.components = structuredClone(current.components);
  if (!same(base.metadata, current.metadata)) changes.metadata = current.metadata
    ? structuredClone(current.metadata) : null;
  if (!same(base.legacy, current.legacy)) changes.legacy = current.legacy
    ? structuredClone(current.legacy) : null;
  return Object.keys(changes).length === 0 ? null : {
    version: 1,
    format: 'dungeon-map-document-delta',
    basePresetKey,
    changes,
  };
};

export const applyDungeonMapDocumentDelta = (
  base: DungeonMapDocumentV2,
  delta: DungeonMapDocumentDeltaV1,
  expectedBasePresetKey = base.identity.presetKey,
): DungeonMapDocumentV2 => {
  if (delta.basePresetKey !== expectedBasePresetKey) {
    throw new Error(`地图文档 Delta 基础预设不匹配：期望“${expectedBasePresetKey}”，实际“${delta.basePresetKey}”。`);
  }
  const next = structuredClone(base);
  const { changes } = delta;
  if (changes.identity) next.identity = structuredClone(changes.identity);
  if (changes.grid) next.grid = structuredClone(changes.grid);
  if (changes.entities) next.entities = structuredClone(changes.entities);
  if (changes.components) next.components = structuredClone(changes.components);
  if (changes.metadata === null) delete next.metadata;
  else if (changes.metadata !== undefined) next.metadata = structuredClone(changes.metadata);
  if (changes.legacy === null) delete next.legacy;
  else if (changes.legacy !== undefined) next.legacy = structuredClone(changes.legacy);
  return parseDungeonMapDocumentV2(next, expectedBasePresetKey);
};
