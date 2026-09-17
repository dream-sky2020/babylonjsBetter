import type { DungeonMapDocumentV2 } from './dungeonMapDocument.types.ts';
import { compactGeneratedDungeonMapShells } from './dungeonMapDocument.compact.ts';
import { normalizeDungeonMapTerrain } from './dungeonMapDocument.terrain.ts';
import { validateDungeonMapDocumentV2 } from './dungeonMapDocument.validation.ts';

const cloneJson = <T>(value: T): T => structuredClone(value);

export const isDungeonMapDocumentV2 = (value: unknown): value is DungeonMapDocumentV2 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<DungeonMapDocumentV2>;
  return candidate.schemaVersion === 2;
};

export const parseDungeonMapDocumentV2 = (
  value: unknown,
  expectedPresetKey?: string,
): DungeonMapDocumentV2 => {
  if (!isDungeonMapDocumentV2(value)) throw new Error('地图文档不是 V2 格式。');
  const candidate = value as DungeonMapDocumentV2;
  if (!candidate.identity || typeof candidate.identity !== 'object'
    || !candidate.grid || typeof candidate.grid !== 'object'
    || !Array.isArray(candidate.entities)
    || !candidate.components || typeof candidate.components !== 'object' || Array.isArray(candidate.components)
    || !Array.isArray(candidate.grid.tileIds) || !Array.isArray(candidate.grid.tileSides)
    || !Array.isArray(candidate.grid.sides) || !Array.isArray(candidate.grid.edges)
    || !Array.isArray(candidate.grid.tilePoints) || !Array.isArray(candidate.grid.points)) {
    throw new Error('地图 V2 文档缺少 identity、grid、entities 或 components 基础结构。');
  }
  if (expectedPresetKey !== undefined && candidate.identity.presetKey !== expectedPresetKey) {
    throw new Error(`地图 V2 文档的 presetKey 应为“${expectedPresetKey}”。`);
  }
  const document = cloneJson(candidate);
  const terrain = normalizeDungeonMapTerrain(document.grid.tileIds, document.terrain, document.legacy);
  if (terrain) document.terrain = terrain;
  else delete document.terrain;
  if (document.legacy?.markers !== undefined) document.legacy = { markers: document.legacy.markers };
  else delete document.legacy;
  const issues = validateDungeonMapDocumentV2(document);
  if (issues.length > 0) {
    throw new Error(`地图 V2 文档校验失败：${issues[0].message}${issues.length > 1 ? `（另有 ${issues.length - 1} 项）` : ''}`);
  }
  return document;
};

export type DungeonMapDocumentLibraryV2 = Record<string, DungeonMapDocumentV2>;

export const encodeDungeonMapDocumentLibraryV2 = (
  library: DungeonMapDocumentLibraryV2,
): DungeonMapDocumentLibraryV2 => Object.fromEntries(Object.entries(library).map(([key, document]) => {
  const normalized = parseDungeonMapDocumentV2(compactGeneratedDungeonMapShells({
    ...document,
    identity: { ...document.identity, presetKey: key, name: document.identity.name.trim() || key },
  }), key);
  return [key, normalized];
}));
