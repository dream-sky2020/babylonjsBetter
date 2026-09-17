import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import type { DungeonMapDirection } from '../map/dungeonMap.types.ts';
import { compactGeneratedDungeonMapShells } from './dungeonMapDocument.compact.ts';
import { migrateDungeonMapToDocumentV2 } from './dungeonMapDocument.migrate.ts';
import {
  DUNGEON_MAP_DIRECTION_ORDER,
  DUNGEON_MAP_STORAGE_SCHEMA_VERSION,
  type DungeonMapDocumentComponent,
  type DungeonMapDocumentLegacyData,
  type DungeonMapDocumentTerrain,
  type DungeonMapDocumentV2,
  type DungeonMapDocumentV3,
  type DungeonMapSpatialAttachmentComponent,
  type DungeonMapSpatialTarget,
} from './dungeonMapDocument.types.ts';
import { validateDungeonMapDocumentV2 } from './dungeonMapDocument.validation.ts';
import { normalizeDungeonMapTerrain } from './dungeonMapDocument.terrain.ts';

const cloneJson = <T>(value: T): T => structuredClone(value);

const createDerivedGrid = (document: Pick<DungeonMapDocumentV3, 'identity' | 'grid'>) => (
  migrateDungeonMapToDocumentV2({
    presetKey: document.identity.presetKey,
    name: document.identity.name,
    map: createDungeonMapData({
      id: document.identity.id,
      width: document.grid.width,
      height: document.grid.height,
      mode: document.grid.topologyMode,
    }),
  }).document.grid
);

type TopologyIdMaps = {
  tile: Map<string, string>;
  side: Map<string, string>;
  edge: Map<string, string>;
  point: Map<string, string>;
};

const setConsistent = (map: Map<string, string>, sourceId: string, targetId: string): void => {
  const existing = map.get(sourceId);
  if (existing !== undefined && existing !== targetId) {
    throw new Error(`拓扑 ID“${sourceId}”在规则网格中对应了多个位置。`);
  }
  map.set(sourceId, targetId);
};

const createTopologyIdMaps = (
  source: DungeonMapDocumentV2,
  derivedGrid: DungeonMapDocumentV2['grid'],
): TopologyIdMaps => {
  const maps: TopologyIdMaps = {
    tile: new Map(),
    side: new Map(),
    edge: new Map(),
    point: new Map(),
  };
  const sourceSideById = new Map(source.grid.sides.map((side) => [side.id, side]));
  const derivedSideById = new Map(derivedGrid.sides.map((side) => [side.id, side]));

  source.grid.tileIds.forEach((tileId, tileIndex) => {
    setConsistent(maps.tile, tileId, derivedGrid.tileIds[tileIndex]);
    DUNGEON_MAP_DIRECTION_ORDER.forEach((_direction: DungeonMapDirection, directionIndex) => {
      const sourceSideId = source.grid.tileSides[tileIndex][directionIndex];
      const derivedSideId = derivedGrid.tileSides[tileIndex][directionIndex];
      setConsistent(maps.side, sourceSideId, derivedSideId);
      const sourceSide = sourceSideById.get(sourceSideId);
      const derivedSide = derivedSideById.get(derivedSideId);
      if (sourceSide && derivedSide) setConsistent(maps.edge, sourceSide.edgeId, derivedSide.edgeId);
    });
    source.grid.tilePoints[tileIndex].forEach((pointId, cornerIndex) => {
      setConsistent(maps.point, pointId, derivedGrid.tilePoints[tileIndex][cornerIndex]);
    });
  });
  return maps;
};

const remapTarget = (target: DungeonMapSpatialTarget, maps: TopologyIdMaps): DungeonMapSpatialTarget => {
  if (target.kind === 'map') return target;
  if (target.kind === 'tile') return { kind: 'tile', tileId: maps.tile.get(target.tileId) ?? target.tileId };
  if (target.kind === 'side') return { kind: 'side', sideId: maps.side.get(target.sideId) ?? target.sideId };
  if (target.kind === 'edge') return { kind: 'edge', edgeId: maps.edge.get(target.edgeId) ?? target.edgeId };
  return { kind: 'point', pointId: maps.point.get(target.pointId) ?? target.pointId };
};

const remapRecord = <T>(
  source: Record<string, T> | undefined,
  ids: Map<string, string>,
): Record<string, T> | undefined => {
  if (!source) return undefined;
  return Object.fromEntries(Object.entries(source).map(([id, value]) => [ids.get(id) ?? id, cloneJson(value)]));
};

const remapLegacy = (
  legacy: DungeonMapDocumentLegacyData | undefined,
): DungeonMapDocumentLegacyData | undefined => {
  if (!legacy) return undefined;
  return {
    ...(legacy.markers ? { markers: cloneJson(legacy.markers) } : {}),
  };
};

const remapTerrain = (
  terrain: DungeonMapDocumentTerrain | undefined,
  tileIds: Map<string, string>,
): DungeonMapDocumentTerrain | undefined => {
  if (!terrain) return undefined;
  return {
    default: cloneJson(terrain.default),
    ...(terrain.overrides ? { overrides: remapRecord(terrain.overrides, tileIds)! } : {}),
  };
};

const remapComponents = (
  components: Record<string, DungeonMapDocumentComponent[]>,
  maps: TopologyIdMaps,
): Record<string, DungeonMapDocumentComponent[]> => Object.fromEntries(
  Object.entries(components).map(([type, table]) => [type, table.map((component) => {
    const cloned = cloneJson(component);
    if (type !== 'spatial-attachment') return cloned;
    const attachment = cloned as DungeonMapSpatialAttachmentComponent;
    return { ...attachment, targets: attachment.targets.map((target) => remapTarget(target, maps)) };
  })]),
);

export const isDungeonMapDocumentV3 = (value: unknown): value is DungeonMapDocumentV3 => (
  !!value && typeof value === 'object' && !Array.isArray(value)
  && (value as Partial<DungeonMapDocumentV3>).schemaVersion === DUNGEON_MAP_STORAGE_SCHEMA_VERSION
);

export const encodeDungeonMapDocumentV3 = (source: DungeonMapDocumentV2): DungeonMapDocumentV3 => {
  const compacted = compactGeneratedDungeonMapShells(source);
  const issues = validateDungeonMapDocumentV2(compacted);
  if (issues.length > 0) throw new Error(`地图 V2 文档校验失败：${issues[0].message}`);
  const derivedGrid = createDerivedGrid({
    identity: compacted.identity,
    grid: {
      width: compacted.grid.width,
      height: compacted.grid.height,
      topologyMode: compacted.grid.topologyMode,
    },
  });
  const maps = createTopologyIdMaps(compacted, derivedGrid);
  const legacy = remapLegacy(compacted.legacy);
  const terrain = remapTerrain(compacted.terrain, maps.tile);
  return {
    schemaVersion: DUNGEON_MAP_STORAGE_SCHEMA_VERSION,
    identity: cloneJson(compacted.identity),
    grid: {
      width: compacted.grid.width,
      height: compacted.grid.height,
      topologyMode: compacted.grid.topologyMode,
    },
    entities: cloneJson(compacted.entities),
    components: remapComponents(compacted.components, maps),
    ...(terrain ? { terrain } : {}),
    ...(compacted.metadata ? { metadata: cloneJson(compacted.metadata) } : {}),
    ...(legacy ? { legacy } : {}),
  };
};

export const parseDungeonMapDocumentV3 = (
  value: unknown,
  expectedPresetKey?: string,
): DungeonMapDocumentV2 => {
  if (!isDungeonMapDocumentV3(value)) throw new Error('地图文档不是 V3 紧凑格式。');
  const candidate = value as DungeonMapDocumentV3;
  if (!candidate.identity || typeof candidate.identity !== 'object'
    || !candidate.grid || typeof candidate.grid !== 'object'
    || !Number.isInteger(candidate.grid.width) || candidate.grid.width <= 0
    || !Number.isInteger(candidate.grid.height) || candidate.grid.height <= 0
    || !Array.isArray(candidate.entities)
    || !candidate.components || typeof candidate.components !== 'object' || Array.isArray(candidate.components)) {
    throw new Error('地图 V3 文档缺少 identity、规则 grid、entities 或 components 基础结构。');
  }
  if (expectedPresetKey !== undefined && candidate.identity.presetKey !== expectedPresetKey) {
    throw new Error(`地图 V3 文档的 presetKey 应为“${expectedPresetKey}”。`);
  }
  const derivedGrid = createDerivedGrid(candidate);
  const terrain = normalizeDungeonMapTerrain(derivedGrid.tileIds, candidate.terrain, candidate.legacy);
  const legacy = candidate.legacy?.markers !== undefined
    ? { markers: cloneJson(candidate.legacy.markers) }
    : undefined;
  const document: DungeonMapDocumentV2 = {
    schemaVersion: 2,
    identity: cloneJson(candidate.identity),
    grid: derivedGrid,
    entities: cloneJson(candidate.entities),
    components: cloneJson(candidate.components),
    ...(terrain ? { terrain } : {}),
    ...(candidate.metadata ? { metadata: cloneJson(candidate.metadata) } : {}),
    ...(legacy ? { legacy } : {}),
  };
  const issues = validateDungeonMapDocumentV2(document);
  if (issues.length > 0) {
    throw new Error(`地图 V3 文档展开后校验失败：${issues[0].message}${issues.length > 1 ? `（另有 ${issues.length - 1} 项）` : ''}`);
  }
  return document;
};

export type DungeonMapDocumentLibraryV3 = Record<string, DungeonMapDocumentV3>;

export const encodeDungeonMapDocumentLibraryV3 = (
  library: Record<string, DungeonMapDocumentV2>,
): DungeonMapDocumentLibraryV3 => Object.fromEntries(Object.entries(library).map(([key, document]) => [
  key,
  encodeDungeonMapDocumentV3({
    ...document,
    identity: { ...document.identity, presetKey: key, name: document.identity.name.trim() || key },
  }),
]));
