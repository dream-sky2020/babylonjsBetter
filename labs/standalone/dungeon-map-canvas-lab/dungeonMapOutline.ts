import type { DungeonMapDocumentV2, DungeonMapSpatialTarget } from '../../../core/map-document/dungeonMapDocument.types.ts';
import { createDungeonMapDocumentIndexes, dungeonMapSpatialTargetKey } from '../../../core/map-document/dungeonMapDocument.query.ts';
import type { DungeonMapSelection } from '../../../core/ui/DungeonMapCanvas';
import type { EditorHierarchyItem } from '../../../core/ui/editor-kit/ObjectHierarchy';

export type MapOutline = {
  items: Record<string, EditorHierarchyItem>;
  roots: string[];
  locations: Map<string, { entityId?: string; selection: DungeonMapSelection }>;
};

/** Index only occupied containers. Shared edges and periodic points have one row per stable target ID. */
export function createMapOutline(document: DungeonMapDocumentV2): MapOutline {
  const indexes = createDungeonMapDocumentIndexes(document);
  const items: MapOutline['items'] = {}, roots: string[] = [], locations: MapOutline['locations'] = new Map();
  const groups = { map: '地图', tile: '格子', side: '独立边', edge: '公用边', point: '公用点' };
  const tilePosition = (tileId: string) => {
    const index = indexes.tileIndexById.get(tileId);
    return index === undefined ? undefined : { x: index % document.grid.width, y: Math.floor(index / document.grid.width) };
  };
  const locate = (target: DungeonMapSpatialTarget): DungeonMapSelection | undefined => {
    if (target.kind === 'map') return { mode: 'map', x: 0, y: 0 };
    if (target.kind === 'tile') { const point = tilePosition(target.tileId);return point && { mode: 'tile', ...point }; }
    if (target.kind === 'point') {
      const point = indexes.pointById.get(target.pointId);
      return point && { mode: 'point', x: point.gridX, y: point.gridY, sharedPointId: point.id };
    }
    const side = target.kind === 'side' ? indexes.sideById.get(target.sideId)
      : indexes.sideById.get(indexes.edgeById.get(target.edgeId)?.sideIds[0] ?? '');
    const point = side && tilePosition(side.tileId);
    return side && point ? { ...point, direction: side.direction,
      ...(target.kind === 'side' ? { mode: 'edge' as const } : { mode: 'shared' as const, sharedEdgeId: target.edgeId }) } : undefined;
  };
  for (const row of document.components['spatial-attachment'] ?? []) {
    const entity = indexes.entityById.get(row.entityId);
    if (!entity || !Array.isArray(row.targets)) continue;
    for (const target of row.targets as DungeonMapSpatialTarget[]) {
      const selection = locate(target);if (!selection) continue;
      const groupId = `group:${target.kind}`, containerId = `container:${dungeonMapSpatialTargetKey(target)}`;
      if (!items[groupId]) {
        roots.push(groupId);items[groupId] = { id: groupId, label: groups[target.kind], parentId: null, childIds: [], draggable: false };
      }
      if (!items[containerId]) {
        const label = target.kind === 'map' ? '地图根容器' : `${groups[target.kind]} (${selection.x}, ${selection.y})${selection.direction ? ` · ${selection.direction}` : ''}`;
        items[containerId] = { id: containerId, label, parentId: groupId, childIds: [], draggable: false };
        items[groupId].childIds.push(containerId);locations.set(containerId, { selection });
      }
      const id = `${containerId}/entity:${entity.id}`;if (items[id]) continue;
      const components = [...(indexes.componentsByEntity.get(entity.id)?.values() ?? [])].flat().filter(row => row.type !== 'spatial-attachment');
      items[id] = { id, label: entity.name || entity.entityType, typeLabel: entity.entityType, parentId: containerId,
        childIds: [], draggable: false, searchText: `${entity.id} ${entity.entityType} ${entity.archetypeId ?? ''} ${components.map(component => component.type).join(' ')}`,
        badges: entity.enabled === false ? ['hidden'] : undefined, title: `${entity.name ?? entity.id} · ${entity.id}` };
      items[containerId].childIds.push(id);locations.set(id, { selection, entityId: entity.id });
    }
  }
  for (const group of roots) items[group].childIds.sort((a, b) => {
    const left = locations.get(a)!.selection, right = locations.get(b)!.selection;
    return left.y - right.y || left.x - right.x || (left.direction ?? '').localeCompare(right.direction ?? '');
  });
  roots.sort((a, b) => Object.keys(groups).indexOf(a.slice(6)) - Object.keys(groups).indexOf(b.slice(6)));
  return { items, roots, locations };
}

export type MapBrowserIndexes = {
  entities: { items: MapOutline['items']; roots: string[] };
  components: { items: MapOutline['items']; roots: string[] };
  entityLocations: Map<string, DungeonMapSelection[]>;
  entityRows: Map<string, string>;
  componentRows: Map<string, { entityId: string; componentId: string; type: string }>;
  componentTypes: Map<string, string>;
  componentCounts: Map<string, number>;
};

/** Read-only views over the document tables; attachment repetitions never duplicate an entity/component. */
export function createMapBrowserIndexes(document: DungeonMapDocumentV2, outline = createMapOutline(document)): MapBrowserIndexes {
  const result: MapBrowserIndexes = { entities: { items: {}, roots: [] }, components: { items: {}, roots: [] },
    entityLocations: new Map(), entityRows: new Map(), componentRows: new Map(), componentTypes: new Map(), componentCounts: new Map() };
  const locations = new Map<string, Map<string, DungeonMapSelection>>();
  for (const location of outline.locations.values()) if (location.entityId) {
    let rows = locations.get(location.entityId);
    if (!rows) { rows = new Map(); locations.set(location.entityId, rows); }
    rows.set(JSON.stringify(location.selection), location.selection);
  }
  const entityById = new Map(document.entities.map(entity => [entity.id, entity]));
  for (const entity of document.entities) {
    const id = `entity:${entity.id}`;
    const selections = [...(locations.get(entity.id)?.values() ?? [])];
    result.entityLocations.set(entity.id, selections);
    result.entityRows.set(id, entity.id);
    result.entities.roots.push(id);
    result.entities.items[id] = { id, label: entity.name || entity.entityType, typeLabel: entity.entityType, parentId: null, childIds: [], draggable: false,
      disabled: !selections.length, badges: !selections.length ? ['warning'] : entity.enabled === false ? ['hidden'] : undefined,
      searchText: `${entity.id} ${entity.entityType} ${entity.archetypeId ?? ''}`, title: `${entity.name ?? entity.entityType} · ${entity.id}${!selections.length ? ' · 没有有效空间挂载，无法定位' : ''}` };
  }
  for (const [type, rows] of Object.entries(document.components)) for (const row of rows) {
    const entity = entityById.get(row.entityId), groupId = `component-type:${type}`;
    if (!result.components.items[groupId]) {
      result.components.roots.push(groupId);
      result.components.items[groupId] = { id: groupId, label: type, parentId: null, childIds: [], draggable: false };
      result.componentTypes.set(groupId, type);
    }
    const id = `component:${JSON.stringify([type, row.entityId, row.id])}`;
    if (result.componentRows.has(id)) continue;
    result.componentRows.set(id, { entityId: row.entityId, componentId: row.id, type });
    result.componentCounts.set(row.entityId, (result.componentCounts.get(row.entityId) ?? 0) + 1);
    const missing = !result.entityLocations.get(row.entityId)?.length;
    result.components.items[id] = { id, label: `${entity?.name || entity?.entityType || row.entityId}${row.slot ? ` · ${row.slot}` : ''}`,
      parentId: groupId, childIds: [], draggable: false, disabled: missing,
      badges: missing ? ['warning'] : row.enabled === false || entity?.enabled === false ? ['hidden'] : undefined,
      searchText: `${type} ${row.id} ${row.entityId} ${entity?.entityType ?? ''} ${entity?.archetypeId ?? ''} ${row.slot ?? ''}`,
      title: `${type} · ${row.id}\n所属实体：${entity?.name ?? row.entityId} · ${row.entityId}${missing ? '\n没有有效空间挂载，无法定位' : ''}` };
    result.components.items[groupId].childIds.push(id);
    const item = result.entities.items[`entity:${row.entityId}`];
    if (item) item.searchText += ` ${type}`;
  }
  result.components.roots.sort();
  for (const group of result.components.roots) result.components.items[group].typeLabel = `${result.components.items[group].childIds.length}`;
  return result;
}
