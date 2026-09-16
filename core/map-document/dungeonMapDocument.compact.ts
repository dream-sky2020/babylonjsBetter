import type {
  DungeonMapDocumentComponent,
  DungeonMapDocumentLegacyEdgeProperties,
  DungeonMapDocumentLegacyTileProperties,
  DungeonMapDocumentV2,
  DungeonMapSpatialAttachmentComponent,
  DungeonMapSpatialTarget,
} from './dungeonMapDocument.types.ts';

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const mergeWithoutConflict = <T extends object>(existing: T | undefined, incoming: T): T | undefined => {
  if (existing && Object.entries(incoming).some(([key, value]) => (
    key in existing && !sameJson(existing[key as keyof T], value)
  ))) return undefined;
  return { ...(existing ?? {}), ...incoming };
};

const generatedShellIdentityMatches = (
  entity: DungeonMapDocumentV2['entities'][number],
  target: DungeonMapSpatialTarget,
): boolean => {
  if (entity.archetypeId !== undefined || entity.enabled === false || target.kind === 'map') return false;
  if (target.kind === 'tile') {
    const match = /^tile:(\d+),(\d+):entity$/.exec(entity.id);
    return !!match && entity.entityType === 'tile' && entity.name === `格子 ${match[1]},${match[2]}`;
  }
  if (target.kind === 'side') {
    const match = /^tile:(\d+),(\d+):(north|east|south|west):entity$/.exec(entity.id);
    return !!match && entity.entityType === 'tile-edge'
      && entity.name === `单格边 ${match[1]},${match[2]},${match[3]}`;
  }
  if (target.kind === 'edge') {
    return /^(shared|shared-boundary):.+:entity$/.test(entity.id) && entity.entityType === 'shared-edge'
      && entity.name === '公用边实体';
  }
  return /^point:\d+,\d+:entity$/.test(entity.id) && entity.entityType === 'shared-point'
    && entity.name === '公用点实体';
};

/** 保存时清理旧编辑器自动创建的纯拓扑占位 Entity。 */
export const compactGeneratedDungeonMapShells = (source: DungeonMapDocumentV2): DungeonMapDocumentV2 => {
  const document = structuredClone(source);
  const componentsByEntity = new Map<string, DungeonMapDocumentComponent[]>();
  Object.values(document.components).flat().forEach((component) => {
    const components = componentsByEntity.get(component.entityId) ?? [];
    components.push(component);
    componentsByEntity.set(component.entityId, components);
  });

  const removedEntityIds = new Set<string>();
  const tileProperties = { ...(document.legacy?.tileProperties ?? {}) };
  const sideProperties = { ...(document.legacy?.sideProperties ?? {}) };
  const edgeProperties = { ...(document.legacy?.edgeProperties ?? {}) };

  document.entities.forEach((entity) => {
    const components = componentsByEntity.get(entity.id) ?? [];
    const attachment = components.find(({ type }) => type === 'spatial-attachment') as
      DungeonMapSpatialAttachmentComponent | undefined;
    const legacyComponent = components.find(({ type }) => type === 'legacy-data');
    if (components.length !== 2 || !attachment || !legacyComponent || attachment.targets.length === 0) return;
    const target = attachment.targets.find((candidate) => generatedShellIdentityMatches(entity, candidate));
    if (!target || attachment.targets.some((candidate) => candidate.kind !== target.kind)) return;

    const data = legacyComponent.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    const record = data as Record<string, unknown>;
    if (Object.keys(record).length !== 1 || !record.legacy
      || typeof record.legacy !== 'object' || Array.isArray(record.legacy)) return;
    const legacy = record.legacy as Record<string, unknown>;

    if (target.kind === 'tile') {
      if (Object.keys(legacy).some((key) => !['kind', 'label', 'walkable', 'discovered'].includes(key))) return;
      const updates = attachment.targets.map((candidate) => {
        if (candidate.kind !== 'tile') return undefined;
        const merged = mergeWithoutConflict(tileProperties[candidate.tileId], legacy as DungeonMapDocumentLegacyTileProperties);
        return merged ? [candidate.tileId, merged] as const : undefined;
      });
      if (updates.some((update) => !update)) return;
      updates.forEach((update) => { if (update) tileProperties[update[0]] = update[1]; });
    } else if (target.kind === 'side' || target.kind === 'edge') {
      if (Object.keys(legacy).some((key) => !['kind', 'label', 'passable', 'events', 'metadata'].includes(key))) return;
      const table = target.kind === 'side' ? sideProperties : edgeProperties;
      const updates = attachment.targets.map((candidate) => {
        const id = candidate.kind === 'side' ? candidate.sideId : candidate.kind === 'edge' ? candidate.edgeId : undefined;
        const merged = id ? mergeWithoutConflict(table[id], legacy as DungeonMapDocumentLegacyEdgeProperties) : undefined;
        return id && merged ? [id, merged] as const : undefined;
      });
      if (updates.some((update) => !update)) return;
      updates.forEach((update) => { if (update) table[update[0]] = update[1]; });
    } else if (target.kind === 'point') {
      const match = /^point:(\d+),(\d+):entity$/.exec(entity.id);
      if (!match || !sameJson(legacy, { label: `公用点 ${match[1]},${match[2]}` })) return;
    } else return;

    removedEntityIds.add(entity.id);
  });

  if (removedEntityIds.size === 0) return document;
  document.entities = document.entities.filter(({ id }) => !removedEntityIds.has(id));
  document.components = Object.fromEntries(Object.entries(document.components).flatMap(([type, components]) => {
    const retained = components.filter(({ entityId }) => !removedEntityIds.has(entityId));
    return retained.length > 0 ? [[type, retained]] : [];
  }));
  document.legacy = {
    ...(document.legacy ?? {}),
    ...(Object.keys(tileProperties).length > 0 ? { tileProperties } : {}),
    ...(Object.keys(sideProperties).length > 0 ? { sideProperties } : {}),
    ...(Object.keys(edgeProperties).length > 0 ? { edgeProperties } : {}),
  };
  return document;
};
