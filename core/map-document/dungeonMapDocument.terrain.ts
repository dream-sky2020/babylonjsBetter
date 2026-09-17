import type {
  DungeonMapDocumentTerrain,
  DungeonMapTerrainProperties,
} from './dungeonMapDocument.types.ts';

const normalizeProperties = (value: unknown): DungeonMapTerrainProperties => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return {
    ...(typeof source.kind === 'string' ? { kind: source.kind } : {}),
    ...(typeof source.label === 'string' ? { label: source.label } : {}),
    ...(typeof source.walkable === 'boolean' ? { walkable: source.walkable } : {}),
    ...(typeof source.discovered === 'boolean' ? { discovered: source.discovered } : {}),
  };
};

const propertiesKey = (value: DungeonMapTerrainProperties): string => JSON.stringify(value);

export const getDungeonMapTerrainProperties = (
  terrain: DungeonMapDocumentTerrain | undefined,
  tileId: string,
): DungeonMapTerrainProperties | undefined => {
  if (!terrain) return undefined;
  return terrain.overrides?.[tileId] ?? terrain.default;
};

/** 将逐格属性压缩成出现次数最多的默认值和少量例外。 */
export const compactDungeonMapTerrain = (
  tileIds: readonly string[],
  propertiesByTileId: Record<string, DungeonMapTerrainProperties> | undefined,
): DungeonMapDocumentTerrain | undefined => {
  if (tileIds.length === 0) return undefined;
  const normalized = tileIds.map((tileId) => normalizeProperties(propertiesByTileId?.[tileId]));
  const counts = new Map<string, { count: number; firstIndex: number; value: DungeonMapTerrainProperties }>();
  normalized.forEach((value, index) => {
    const key = propertiesKey(value);
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { count: 1, firstIndex: index, value });
  });
  const selected = [...counts.values()].sort((left, right) => (
    right.count - left.count || left.firstIndex - right.firstIndex
  ))[0];
  const defaultProperties = selected?.value ?? {};
  const defaultKey = propertiesKey(defaultProperties);
  const overrideEntries: [string, DungeonMapTerrainProperties][] = [];
  tileIds.forEach((tileId, index) => {
    if (propertiesKey(normalized[index]) !== defaultKey) overrideEntries.push([tileId, normalized[index]]);
  });
  const overrides = Object.fromEntries(overrideEntries);
  if (defaultKey === '{}' && Object.keys(overrides).length === 0) return undefined;
  return {
    default: defaultProperties,
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
  };
};

export const expandDungeonMapTerrain = (
  tileIds: readonly string[],
  terrain: DungeonMapDocumentTerrain | undefined,
): Record<string, DungeonMapTerrainProperties> => Object.fromEntries(tileIds.map((tileId) => [
  tileId,
  structuredClone(getDungeonMapTerrainProperties(terrain, tileId) ?? {}),
] as const));

/** 只用于读取旧 V2/V3 的 legacy.tileProperties。 */
export const readLegacyDungeonMapTileProperties = (
  legacy: unknown,
): Record<string, DungeonMapTerrainProperties> | undefined => {
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return undefined;
  const value = (legacy as Record<string, unknown>).tileProperties;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([id, properties]) => [
    id,
    normalizeProperties(properties),
  ] as const));
};

export const normalizeDungeonMapTerrain = (
  tileIds: readonly string[],
  terrain: unknown,
  legacy: unknown,
): DungeonMapDocumentTerrain | undefined => {
  if (terrain && typeof terrain === 'object' && !Array.isArray(terrain)) {
    const source = terrain as Record<string, unknown>;
    const defaultProperties = normalizeProperties(source.default);
    const rawOverrides = source.overrides && typeof source.overrides === 'object' && !Array.isArray(source.overrides)
      ? source.overrides as Record<string, unknown>
      : {};
    const properties = Object.fromEntries(tileIds.map((tileId) => [
      tileId,
      tileId in rawOverrides ? normalizeProperties(rawOverrides[tileId]) : defaultProperties,
    ] as const));
    return compactDungeonMapTerrain(tileIds, properties);
  }
  return compactDungeonMapTerrain(tileIds, readLegacyDungeonMapTileProperties(legacy));
};
