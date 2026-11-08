import { upgradeInteractionEvent, type IEventComponent } from '../entity/components/event.component.ts';
import type { DungeonMapDocumentV2 } from './dungeonMapDocument.types.ts';

/** The parser owns this document, so migration can replace its component rows. */
export function migrateDungeonMapInteractionRules(document: DungeonMapDocumentV2): void {
  if (!document.components.event) return;
  const formerTrackers = new Set<string>();
  document.components.event = document.components.event.map(component => {
    if (component.version === 2 && component.trigger === 'approach-player') formerTrackers.add(component.entityId);
    return { ...upgradeInteractionEvent(component as unknown as IEventComponent), entityId: component.entityId };
  });
  for (const controller of document.components['agent-controller'] ?? []) {
    if (!formerTrackers.has(controller.entityId) || controller.controllerId !== 'chase-player') continue;
    const parameters = controller.parameters as Record<string, unknown> | undefined;
    if (parameters?.notifyOnApproach !== true) continue;
    const { notifyOnApproach, ...rest } = parameters;
    controller.parameters = { ...rest, stopDistance: 0, navigationStrategy: 'path' };
  }
}
