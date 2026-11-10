import { EVENT_ENTITY_TYPES, validateInteractionEvent, type IEventComponent } from '../entity/components/event.component.ts';
import type { DungeonMapDocumentV2, DungeonMapSpatialAttachmentComponent } from '../map-document/dungeonMapDocument.types.ts';
import { collectDungeonSharedVariables } from './dungeonSharedVariables.ts';
import { validateSharedVariableOperation } from '../entity/components/shared-variable.component.ts';
/** Execution validation is deliberately stricter than authoring/storage validation. */
export function validateDungeonInteractionDocument(document: DungeonMapDocumentV2): string[] {
  const { definitions, issues } = collectDungeonSharedVariables(document);
  const errors = issues.map(issue => `${issue.path}: ${issue.message}`);
  for (const raw of document.components.event ?? []) {
    const event = raw as unknown as IEventComponent;
    const entity = document.entities.find(row => row.id === raw.entityId);
    if (event.enabled === false || entity?.enabled === false || event.version === 1 || event.action?.type === 'legacy') continue;
    errors.push(...validateInteractionEvent(event).map(error => `${raw.id}: ${error}`));
    if (event.action?.type === 'shared-variable') {
      const definition = definitions.get(event.action.variableId);
      const error = definition ? validateSharedVariableOperation(event.action, definition.valueType)
        : `目标共享变量「${event.action.variableId ?? ''}」尚未在本地图声明。`;
      if (error) errors.push(`${raw.id}: ${error}`);
    }
    if (!entity || !(EVENT_ENTITY_TYPES as readonly string[]).includes(entity.entityType)) errors.push(`${raw.id}: 交互实体类型无效。`);
    if (event.trigger === 'move-attempt' && (event.ruleKind === 'action' || event.movementPhase)) continue;
    const targets = ((document.components['spatial-attachment'] ?? []) as DungeonMapSpatialAttachmentComponent[])
      .filter(row => row.entityId === raw.entityId && row.enabled !== false).flatMap(row => row.targets ?? []);
    if (!targets.length || targets.some(target => !['tile', 'side', 'edge'].includes(target.kind))) errors.push(`${raw.id}: 交互需要有效的格子或边挂载。`);
    if (event.directionSpace === 'target-local') {
      const source = ['grid-agent', 'spatial-body', 'grid-facing'].some(type => (document.components[type] ?? []).some(row => row.entityId === raw.entityId && row.enabled !== false));
      if (!source) errors.push(`${raw.id}: 相对方向交互需要实体自身朝向（空间物体、格步行动属性或格子朝向）。`);
    }
    if ((entity?.entityType === 'dungeon-agent' || event.trigger === 'enter' || event.targetRule === 'self')
      && targets.some(target => target.kind !== 'tile')) errors.push(`${raw.id}: Agent、进入触发和当前位置交互只支持格子挂载。`);
  }
  return errors;
}
