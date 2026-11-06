import { validateDungeonInteractionDocument } from './dungeonInteraction.validation.ts';
import { createServiceToken } from '../system-runtime/ServiceToken.ts';
import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import { getDungeonRuntimeNeighbor, type DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import type { DungeonTraversalWorld } from '../dungeon-traversal/dungeonTraversal.ts';
import type { DialogueInteractionAction, IEventComponent } from '../entity/components/event.component.ts';
import type { InteractionQuery } from './DungeonInteractionRouter.ts';
import { describeDungeonInteractions, type InteractionDebugDescriptor } from './dungeonInteraction.debug.ts';
export type DialogueInteractionMatch = { id: string; entityId: string; label: string; priority: number; rank: number; once: boolean; action: DialogueInteractionAction };
type Session = { loadId: number; map: DungeonRuntimeMap; world: DungeonTraversalWorld; moving(entityId: string): boolean };
export type DungeonInteractionControl = {
  find(query: InteractionQuery): readonly DialogueInteractionMatch[];
  describe(loadId: number): readonly InteractionDebugDescriptor[];
};
export const DUNGEON_INTERACTION_CONTROL = createServiceToken<DungeonInteractionControl>('dungeon:interaction-control');
export function createDungeonInteractionControl(read: () => Session | null): DungeonInteractionControl {
  const indexes = new WeakMap<DungeonRuntimeMap, DungeonMapDocumentQuery>();
  return { describe(loadId) {
    const session = read();
    return session?.loadId === loadId ? describeDungeonInteractions(session.map, session.world, session.moving) : [];
  }, find(input) {
    const session = read();
    if (!session || session.loadId !== input.loadId || input.trigger === 'move-attempt') return [];
    const { map, world } = session;
    let query = indexes.get(map);
    if (!query) { const errors = validateDungeonInteractionDocument(map.document); if (errors.length) throw new Error(errors.join('\n')); query = new DungeonMapDocumentQuery(map.document); indexes.set(map, query); }
    const front = getDungeonRuntimeNeighbor(map, input.position, input.facing);
    const ownId = query.getTileIdAt(input.position.tileX, input.position.tileY);
    const frontId = front && query.getTileIdAt(front.tileX, front.tileY);
    const side = ownId && query.getSide(ownId, input.facing);
    const matches: DialogueInteractionMatch[] = [];
    for (const raw of map.document.components.event ?? []) {
      const event = raw as unknown as IEventComponent;
      if (event.version !== 2 || event.enabled === false || event.action?.type !== 'dialogue' || event.trigger !== input.trigger) continue;
      const entity = query.getEntity(raw.entityId);
      if (!entity || entity.enabled === false) continue;
      const body = world.body(entity.id);
      if (body && (!body.enabled || session.moving(entity.id))) continue;
      if (entity.entityType === 'dungeon-agent' && !body) continue;
      const wanted = event.targetRule === 'front' ? frontId : ownId;
      let hit = false;
      if (body) {
        const index = body.logicalPosition.tileY * map.width + body.logicalPosition.tileX;
        hit = !!wanted && map.topology.tileIds[index] === wanted;
      } else {
        const targets = query.getComponents(entity.id, 'spatial-attachment').filter(item => item.enabled !== false).flatMap(item => (item.targets ?? []) as { kind: string; tileId?: string; sideId?: string; edgeId?: string }[]);
        hit = targets.some(target => target.kind === 'tile' ? target.tileId === wanted
          : event.targetRule === 'front' && !!side && (target.kind === 'side' ? target.sideId === side.id : target.kind === 'edge' && target.edgeId === side.edgeId));
      }
      if (!hit) continue;
      if (event.targetRule === 'front') {
        const inspection = world.inspectStep('$dungeon-player', input.position.tileY * map.width + input.position.tileX, input.facing,
          { ignoreBodyIds: [entity.id], ignoreDynamicOccupancy: true, checkTerrain: false });
        if (inspection.blockedReason && inspection.blockingEntityIds.some(id => id !== entity.id)) continue;
        if (inspection.blockedReason === 'map-boundary' && !side) continue;
      }
      matches.push({ id: event.id, entityId: entity.id, label: entity.name ?? entity.id,
        priority: event.priority ?? 0, rank: event.targetRule === 'front' ? 0 : 1, once: event.once === true, action: structuredClone(event.action) });
    }
    return matches;
  } };
}
