import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import type { DungeonMapDocumentComponent, DungeonMapSpatialAttachmentComponent, DungeonMapSpatialTarget } from '../map-document/dungeonMapDocument.types.ts';
import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import type { DungeonTraversalWorld } from '../dungeon-traversal/dungeonTraversal.ts';
import type { IEventComponent } from '../entity/components/event.component.ts';
import { resolveDungeonExitTriggers, type IDungeonExitComponent } from '../entity/components/dungeon-exit.component.ts';
import type { DungeonMapDirection } from '../map/dungeonMap.types.ts';

export type InteractionDebugDescriptor = {
  id: string; componentId: string; entityId: string; label: string;
  kind: 'dialogue' | 'transition'; triggers: readonly string[]; targetRule?: string;
  once: boolean; enabled: boolean; moving: boolean;
  placement: { kind: 'tile' | 'side' | 'edge'; tileX: number; tileY: number; direction?: DungeonMapDirection };
  /** Copied presentation pose; never a live Body or document reference. */
  worldPosition?: [number, number, number];
};
const indexes = new WeakMap<DungeonRuntimeMap, DungeonMapDocumentQuery>();
/** Read-only descriptions; drawing these must never query or execute interaction candidates. */
export function describeDungeonInteractions(map: DungeonRuntimeMap, world: DungeonTraversalWorld,
  moving: (entityId: string) => boolean): InteractionDebugDescriptor[] {
  let query = indexes.get(map);
  if (!query) { query = new DungeonMapDocumentQuery(map.document); indexes.set(map, query); }
  const result: InteractionDebugDescriptor[] = [];
  const placement = (target: DungeonMapSpatialTarget): InteractionDebugDescriptor['placement'] | null => {
    let tileId: string | undefined, direction: DungeonMapDirection | undefined;
    if (target.kind === 'tile') tileId = target.tileId;
    else if (target.kind === 'side' || target.kind === 'edge') {
      const sideId = target.kind === 'side' ? target.sideId : query!.indexes.edgeById.get(target.edgeId)?.sideIds[0];
      const side = sideId ? query!.indexes.sideById.get(sideId) : undefined;
      tileId = side?.tileId; direction = side?.direction;
    } else return null;
    const index = tileId ? query!.indexes.tileIndexById.get(tileId) : undefined;
    return index === undefined ? null : { kind: target.kind as 'tile' | 'side' | 'edge',
      tileX: index % map.width, tileY: Math.floor(index / map.width), direction };
  };
  const append = (raw: DungeonMapDocumentComponent, info: Pick<InteractionDebugDescriptor, 'kind' | 'triggers' | 'targetRule' | 'once'>) => {
    const entity = query!.getEntity(raw.entityId); if (!entity) return;
    const body = world.body(entity.id);
    const attachments = query!.getComponents<DungeonMapSpatialAttachmentComponent>(entity.id, 'spatial-attachment');
    const attached = attachments.flatMap(row => row.targets.map(target => ({ target, enabled: row.enabled !== false })));
    const bodyPosition = body && attached.some(row => row.target.kind === 'tile') ? body.logicalPosition : null;
    const rows = bodyPosition ? [{ place: { kind: 'tile' as const, ...bodyPosition }, enabled: attached.some(row => row.enabled) }]
      : attached.map(row => ({ place: placement(row.target), enabled: row.enabled }));
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.place) continue;
      const key = `${row.place.kind}:${row.place.tileX}:${row.place.tileY}:${row.place.direction ?? ''}`;
      if (seen.has(key)) continue; seen.add(key);
      result.push({ ...info, id: `${raw.id}:${key}`, componentId: raw.id, entityId: entity.id, label: entity.name ?? entity.id,
        enabled: entity.enabled !== false && raw.enabled !== false && row.enabled && body?.enabled !== false,
        moving: !!body && moving(entity.id), placement: row.place,
        worldPosition: bodyPosition && body?.worldPosition ? [...body.worldPosition] : undefined });
    }
  };
  for (const raw of map.document.components.event ?? []) {
    const event = raw as unknown as IEventComponent;
    if (event.version !== 2 || event.action?.type !== 'dialogue') continue;
    append(raw, { kind: 'dialogue', triggers: [event.trigger], targetRule: event.targetRule, once: event.once === true });
  }
  for (const raw of map.document.components['dungeon-exit'] ?? []) {
    append(raw, { kind: 'transition', triggers: resolveDungeonExitTriggers(raw as unknown as IDungeonExitComponent), once: false });
  }
  return result;
}
