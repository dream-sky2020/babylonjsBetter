import { decodeDungeonMapData, encodeDungeonMapData, isDungeonMapDefinitionRefsData } from './dungeonMap.definition.ts';
import {
  NO_DUNGEON_MAP_DATA_DEFINITION_REF,
  type DungeonMapDefinitionRefsData,
  type DungeonMapReferenceLayers,
  type DungeonMapStoredData,
  type DungeonMapStoredSharedEdge,
  type DungeonMapStoredSharedPoint,
} from './dungeonMap.definition.types.ts';
import type {
  DungeonMapDefinitionRefsDelta,
  DungeonMapSparseConnectionLayers,
  DungeonMapSparseDefinitionRefChanges,
  DungeonMapSparseDefinitionRefLayers,
  DungeonMapSparsePropertyChanges,
} from './dungeonMap.delta.types';
import type { DungeonMapData } from './dungeonMap.types';

const cloneJson = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

/** 快速一致性指纹，不承担安全哈希用途。 */
export const createDungeonMapDefinitionRefsFingerprint = (map: DungeonMapDefinitionRefsData): string => {
  const json = JSON.stringify(map);
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}:${json.length}`;
};

export const createEmptyDungeonMapDefinitionRefsDelta = (
  basePresetKey: string,
  base: DungeonMapDefinitionRefsData,
): DungeonMapDefinitionRefsDelta => {
  const key = basePresetKey.trim();
  if (!key) throw new Error('地图 Delta 的 basePresetKey 不能为空。');
  return {
    format: 'definition-refs-delta',
    version: 1,
    basePresetKey: key,
    baseFingerprint: createDungeonMapDefinitionRefsFingerprint(base),
    baseDefinitionCount: base.dataDefinitions.length,
    dataDefinitions: [],
  };
};

export const isDungeonMapDefinitionRefsDelta = (value: unknown): value is DungeonMapDefinitionRefsDelta => (
  !!value && typeof value === 'object'
  && (value as Partial<DungeonMapDefinitionRefsDelta>).format === 'definition-refs-delta'
  && (value as Partial<DungeonMapDefinitionRefsDelta>).version === 1
);

const requireIndex = (value: number, limit: number, label: string): void => {
  if (!Number.isInteger(value) || value < 0 || value >= limit) {
    throw new RangeError(`${label} ${String(value)} 超出 0..${Math.max(0, limit - 1)}。`);
  }
};

const requireDefinitionRef = (ref: number, definitionCount: number, label: string): void => {
  requireIndex(ref, definitionCount, `${label} Definition 引用`);
};

const applyReferenceChanges = (
  target: number[],
  changes: DungeonMapSparseDefinitionRefChanges | undefined,
  definitionCount: number,
  label: string,
): void => {
  const seen = new Set<number>();
  (changes ?? []).forEach(([index, ref]) => {
    requireIndex(index, target.length, `${label}位置`);
    if (seen.has(index)) throw new Error(`${label}位置 ${index} 被重复覆盖。`);
    seen.add(index);
    if (ref !== null) requireDefinitionRef(ref, definitionCount, label);
    target[index] = ref ?? NO_DUNGEON_MAP_DATA_DEFINITION_REF;
  });
};

const applyReferenceLayers = (
  target: [number[], number[], number[], number[]],
  changes: DungeonMapSparseDefinitionRefLayers | undefined,
  definitionCount: number,
): void => changes?.forEach((layer, directionIndex) => {
  applyReferenceChanges(target[directionIndex], layer, definitionCount, `单格边方向 ${directionIndex}`);
});

const applyPropertyChanges = <T>(
  source: readonly (readonly [number, T])[] | undefined,
  changes: DungeonMapSparsePropertyChanges<T> | undefined,
  limit: number,
  label: string,
): [number, T][] | undefined => {
  if (!changes?.length) return source ? cloneJson(source) as [number, T][] : undefined;
  const values = new Map<number, T>(cloneJson(source ?? []));
  const seen = new Set<number>();
  changes.forEach(([index, value]) => {
    requireIndex(index, limit, `${label}位置`);
    if (seen.has(index)) throw new Error(`${label}位置 ${index} 被重复覆盖。`);
    seen.add(index);
    if (value === null) values.delete(index);
    else values.set(index, cloneJson(value));
  });
  return values.size ? [...values.entries()].sort(([a], [b]) => a - b) : undefined;
};

const applyKeyedChanges = <T extends DungeonMapStoredSharedEdge | DungeonMapStoredSharedPoint>(
  source: readonly T[],
  remove: readonly string[] | undefined,
  upsert: readonly T[] | undefined,
  definitionCount: number,
  label: string,
): T[] => {
  const removed = new Set(remove ?? []);
  if (removed.size !== (remove?.length ?? 0)) throw new Error(`${label} remove 中存在重复 ID。`);
  const result = cloneJson(source).filter((item) => !removed.has(item[0])) as T[];
  const positions = new Map(result.map((item, index) => [item[0], index]));
  const upserted = new Set<string>();
  (upsert ?? []).forEach((item) => {
    const id = item[0];
    if (upserted.has(id)) throw new Error(`${label} upsert 中存在重复 ID“${id}”。`);
    upserted.add(id);
    const definitionRef = typeof item[1] === 'number'
      ? (item as DungeonMapStoredSharedPoint)[5]
      : (item as DungeonMapStoredSharedEdge)[3];
    requireDefinitionRef(definitionRef, definitionCount, `${label}“${id}”`);
    const copy = cloneJson(item) as T;
    const position = positions.get(id);
    if (position === undefined) {
      positions.set(id, result.length);
      result.push(copy);
    } else result[position] = copy;
  });
  return result;
};

const applyConnections = (
  base: DungeonMapReferenceLayers | undefined,
  changes: DungeonMapSparseConnectionLayers | null | undefined,
  tileCount: number,
): DungeonMapReferenceLayers | undefined => {
  if (changes === undefined) return base ? cloneJson(base) : undefined;
  if (changes === null) return undefined;
  const layers: [number[], number[], number[], number[]] = base
    ? cloneJson(base) as [number[], number[], number[], number[]]
    : [
      Array(tileCount).fill(-1), Array(tileCount).fill(-1),
      Array(tileCount).fill(-1), Array(tileCount).fill(-1),
    ];
  changes.forEach((layer, directionIndex) => {
    const seen = new Set<number>();
    layer.forEach(([tileIndex, targetTileIndex]) => {
      requireIndex(tileIndex, tileCount, `联通方向 ${directionIndex} 的格子`);
      if (seen.has(tileIndex)) throw new Error(`联通方向 ${directionIndex} 的格子 ${tileIndex} 被重复覆盖。`);
      seen.add(tileIndex);
      if (targetTileIndex !== -1) requireIndex(targetTileIndex, tileCount, '联通目标');
      layers[directionIndex][tileIndex] = targetTileIndex;
    });
  });
  return layers;
};

/** 在紧凑引用数据上应用稀疏覆盖，不修改基础地图或 Delta。 */
export const applyDungeonMapDefinitionRefsDelta = (
  base: DungeonMapDefinitionRefsData,
  delta: DungeonMapDefinitionRefsDelta,
  expectedBasePresetKey?: string,
): DungeonMapDefinitionRefsData => {
  if (!isDungeonMapDefinitionRefsDelta(delta)) throw new Error('地图 Delta 格式或版本无效。');
  if (expectedBasePresetKey !== undefined && delta.basePresetKey !== expectedBasePresetKey) {
    throw new Error(`地图 Delta 基础 Key 为“${delta.basePresetKey}”，预期为“${expectedBasePresetKey}”。`);
  }
  if (delta.baseDefinitionCount !== base.dataDefinitions.length) {
    throw new Error('地图 Delta 的基础 Definition 数量与当前基础地图不一致。');
  }
  if (delta.baseFingerprint !== createDungeonMapDefinitionRefsFingerprint(base)) {
    throw new Error('地图 Delta 的基础地图指纹不匹配，拒绝应用过期的数字引用。');
  }
  const dataDefinitions = [...cloneJson(base.dataDefinitions), ...cloneJson(delta.dataDefinitions)];
  const tileCount = base.width * base.height;
  const tileDataDefinitionRefs = [...base.tileDataDefinitionRefs];
  const tileEdgeDataDefinitionRefs = base.tileEdgeDataDefinitionRefs.map((layer) => [...layer]) as [
    number[], number[], number[], number[],
  ];
  applyReferenceChanges(
    tileDataDefinitionRefs, delta.tileDataDefinitionRefChanges, dataDefinitions.length, '格子',
  );
  applyReferenceLayers(tileEdgeDataDefinitionRefs, delta.tileEdgeDataDefinitionRefChanges, dataDefinitions.length);
  const mapDataDefinitionRef = delta.mapDataDefinitionRef === undefined
    ? base.mapDataDefinitionRef
    : delta.mapDataDefinitionRef ?? NO_DUNGEON_MAP_DATA_DEFINITION_REF;
  if (mapDataDefinitionRef !== NO_DUNGEON_MAP_DATA_DEFINITION_REF) {
    requireDefinitionRef(mapDataDefinitionRef, dataDefinitions.length, '地图');
  }
  const tileProperties = applyPropertyChanges(
    base.tileProperties, delta.tilePropertyChanges, tileCount, '格子属性',
  );
  const tileEdgeProperties = applyPropertyChanges(
    base.tileEdgeProperties, delta.tileEdgePropertyChanges, tileCount * 4, '单格边属性',
  );
  const result: DungeonMapDefinitionRefsData = {
    ...cloneJson(base),
    dataDefinitions,
    mapDataDefinitionRef,
    tileDataDefinitionRefs,
    tileEdgeDataDefinitionRefs,
    sharedEdges: applyKeyedChanges(
      base.sharedEdges, delta.sharedEdgeChanges?.remove, delta.sharedEdgeChanges?.upsert,
      dataDefinitions.length, '公用边',
    ),
    sharedPoints: applyKeyedChanges(
      base.sharedPoints, delta.sharedPointChanges?.remove, delta.sharedPointChanges?.upsert,
      dataDefinitions.length, '公用点',
    ),
  };
  const connections = applyConnections(base.connections, delta.connectionChanges, tileCount);
  if (connections) result.connections = connections;
  else delete result.connections;
  if (tileProperties) result.tileProperties = tileProperties;
  else delete result.tileProperties;
  if (tileEdgeProperties) result.tileEdgeProperties = tileEdgeProperties;
  else delete result.tileEdgeProperties;
  if (delta.markers !== undefined) {
    if (delta.markers === null) delete result.markers;
    else result.markers = cloneJson(delta.markers);
  }
  if (delta.metadata !== undefined) {
    if (delta.metadata === null) delete result.metadata;
    else result.metadata = cloneJson(delta.metadata);
  }
  return result;
};

/** “完整地图 + 稀疏 Delta”直接得到修改后的标准 DungeonMapData。 */
export const applyDungeonMapDelta = (
  base: DungeonMapStoredData,
  delta: DungeonMapDefinitionRefsDelta,
  expectedBasePresetKey?: string,
): DungeonMapData => {
  const storedBase = isDungeonMapDefinitionRefsData(base) ? base : encodeDungeonMapData(base);
  return decodeDungeonMapData(applyDungeonMapDefinitionRefsDelta(storedBase, delta, expectedBasePresetKey));
};
