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

const jsonEqual = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

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

const requireSameDeltaTopology = (
  base: DungeonMapDefinitionRefsData,
  current: DungeonMapDefinitionRefsData,
): void => {
  if (base.id !== current.id
    || base.width !== current.width
    || base.height !== current.height
    || base.topologyMode !== current.topologyMode) {
    throw new Error('地图 ID、尺寸或 topologyMode 已改变，无法用当前稀疏 Delta 表示。');
  }
  const tileCount = base.width * base.height;
  [base, current].forEach((map) => {
    if (map.tileDataDefinitionRefs.length !== tileCount
      || map.tileEdgeDataDefinitionRefs.some((layer) => layer.length !== tileCount)
      || map.connections?.some((layer) => layer.length !== tileCount)) {
      throw new Error(`地图 ${map.id} 的格子、单格边或联通引用数组长度不正确。`);
    }
  });
};

const createPropertyChanges = <T>(
  base: readonly (readonly [number, T])[] | undefined,
  current: readonly (readonly [number, T])[] | undefined,
): [number, T | null][] | undefined => {
  const baseValues = new Map(base ?? []);
  const currentValues = new Map(current ?? []);
  const indices = [...new Set([...baseValues.keys(), ...currentValues.keys()])].sort((a, b) => a - b);
  const changes = indices.flatMap((index): [number, T | null][] => {
    const before = baseValues.get(index);
    const after = currentValues.get(index);
    if (after === undefined) return before === undefined ? [] : [[index, null]];
    return jsonEqual(before, after) ? [] : [[index, cloneJson(after)]];
  });
  return changes.length ? changes : undefined;
};

const createKeyedChanges = <T extends DungeonMapStoredSharedEdge | DungeonMapStoredSharedPoint>(
  base: readonly T[],
  current: readonly T[],
): { remove?: string[]; upsert?: T[] } | undefined => {
  const baseValues = new Map(base.map((item) => [item[0], item]));
  const currentValues = new Map(current.map((item) => [item[0], item]));
  const remove = base.filter((item) => !currentValues.has(item[0])).map((item) => item[0]);
  const upsert = current.filter((item) => !jsonEqual(baseValues.get(item[0]), item)).map(cloneJson);
  return remove.length || upsert.length
    ? { ...(remove.length ? { remove } : {}), ...(upsert.length ? { upsert } : {}) }
    : undefined;
};

/**
 * 比较完整基础地图与当前运行地图，生成可持久化的稀疏引用 Delta。
 * Definition 按内容复用基础池；当前地图中新出现且确实被引用的 Definition 才会写入 Delta。
 */
export const createDungeonMapDefinitionRefsDelta = (
  basePresetKey: string,
  baseMap: DungeonMapStoredData,
  currentMap: DungeonMapStoredData,
): DungeonMapDefinitionRefsDelta => {
  const base = isDungeonMapDefinitionRefsData(baseMap) ? baseMap : encodeDungeonMapData(baseMap);
  const current = isDungeonMapDefinitionRefsData(currentMap) ? currentMap : encodeDungeonMapData(currentMap);
  requireSameDeltaTopology(base, current);

  const delta = createEmptyDungeonMapDefinitionRefsDelta(basePresetKey, base);
  const baseDefinitionRefs = new Map<string, number>();
  base.dataDefinitions.forEach((definition, ref) => {
    const key = JSON.stringify(definition);
    if (!baseDefinitionRefs.has(key)) baseDefinitionRefs.set(key, ref);
  });
  const appendedDefinitionRefs = new Map<string, number>();
  const dataDefinitions: DungeonMapDefinitionRefsDelta['dataDefinitions'][number][] = [];
  const remapDefinitionRef = (currentRef: number): number => {
    if (currentRef === NO_DUNGEON_MAP_DATA_DEFINITION_REF) return currentRef;
    requireDefinitionRef(currentRef, current.dataDefinitions.length, '当前地图');
    const definition = current.dataDefinitions[currentRef];
    const key = JSON.stringify(definition);
    const baseRef = baseDefinitionRefs.get(key);
    if (baseRef !== undefined) return baseRef;
    const existing = appendedDefinitionRefs.get(key);
    if (existing !== undefined) return existing;
    const ref = base.dataDefinitions.length + dataDefinitions.length;
    dataDefinitions.push(cloneJson(definition));
    appendedDefinitionRefs.set(key, ref);
    return ref;
  };
  const refChange = (currentRef: number, baseRef: number): number | null | undefined => {
    const remapped = remapDefinitionRef(currentRef);
    if (remapped === baseRef) return undefined;
    return remapped === NO_DUNGEON_MAP_DATA_DEFINITION_REF ? null : remapped;
  };

  const tileDataDefinitionRefChanges = current.tileDataDefinitionRefs.flatMap((ref, index) => {
    const change = refChange(ref, base.tileDataDefinitionRefs[index]);
    return change === undefined ? [] : [[index, change] as const];
  });
  const tileEdgeDataDefinitionRefChanges = current.tileEdgeDataDefinitionRefs.map((layer, directionIndex) => (
    layer.flatMap((ref, index) => {
      const change = refChange(ref, base.tileEdgeDataDefinitionRefs[directionIndex][index]);
      return change === undefined ? [] : [[index, change] as const];
    })
  )) as unknown as DungeonMapSparseDefinitionRefLayers;

  const remapSharedEdge = (item: DungeonMapStoredSharedEdge): DungeonMapStoredSharedEdge => {
    const copy = cloneJson(item) as unknown as unknown[];
    copy[3] = remapDefinitionRef(item[3]);
    return copy as unknown as DungeonMapStoredSharedEdge;
  };
  const remapSharedPoint = (item: DungeonMapStoredSharedPoint): DungeonMapStoredSharedPoint => {
    const copy = cloneJson(item) as unknown as unknown[];
    copy[5] = remapDefinitionRef(item[5]);
    return copy as unknown as DungeonMapStoredSharedPoint;
  };
  const currentSharedEdges = current.sharedEdges.map(remapSharedEdge);
  const currentSharedPoints = current.sharedPoints.map(remapSharedPoint);

  let connectionChanges: DungeonMapSparseConnectionLayers | null | undefined;
  if (!jsonEqual(base.connections, current.connections)) {
    if (!current.connections) connectionChanges = null;
    else {
      const layers = current.connections.map((layer, directionIndex) => layer.flatMap((target, index) => (
        target === (base.connections?.[directionIndex][index] ?? -1) ? [] : [[index, target] as const]
      ))) as unknown as DungeonMapSparseConnectionLayers;
      connectionChanges = layers;
    }
  }

  const mapDataDefinitionRef = refChange(current.mapDataDefinitionRef, base.mapDataDefinitionRef);
  const sharedEdgeChanges = createKeyedChanges(base.sharedEdges, currentSharedEdges);
  const sharedPointChanges = createKeyedChanges(base.sharedPoints, currentSharedPoints);
  const tilePropertyChanges = createPropertyChanges(base.tileProperties, current.tileProperties);
  const tileEdgePropertyChanges = createPropertyChanges(base.tileEdgeProperties, current.tileEdgeProperties);

  return {
    ...delta,
    dataDefinitions,
    ...(mapDataDefinitionRef !== undefined ? { mapDataDefinitionRef } : {}),
    ...(tileDataDefinitionRefChanges.length ? { tileDataDefinitionRefChanges } : {}),
    ...(tileEdgeDataDefinitionRefChanges.some((layer) => layer.length)
      ? { tileEdgeDataDefinitionRefChanges } : {}),
    ...(sharedEdgeChanges ? { sharedEdgeChanges } : {}),
    ...(sharedPointChanges ? { sharedPointChanges } : {}),
    ...(connectionChanges !== undefined ? { connectionChanges } : {}),
    ...(tilePropertyChanges ? { tilePropertyChanges } : {}),
    ...(tileEdgePropertyChanges ? { tileEdgePropertyChanges } : {}),
    ...(!jsonEqual(base.markers, current.markers)
      ? { markers: current.markers ? cloneJson(current.markers) : null } : {}),
    ...(!jsonEqual(base.metadata, current.metadata)
      ? { metadata: current.metadata ? cloneJson(current.metadata) : null } : {}),
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
