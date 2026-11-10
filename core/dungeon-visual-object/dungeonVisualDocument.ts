import type { IEventComponent } from '../entity/components/event.component.ts';
import { validateVisualObjects, type IVisualObjectsComponent, type VisualObjectDefinition } from '../entity/components/visual-objects.component.ts';
import { validateVisualState, type IVisualStateComponent } from '../entity/components/visual-state.component.ts';
import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import type { DungeonMapDocumentV2, DungeonMapSpatialAttachmentComponent } from '../map-document/dungeonMapDocument.types.ts';

export type DungeonEntityVisualDefinition = {
  entityId: string;
  label: string;
  tileX: number;
  tileY: number;
  objects: readonly VisualObjectDefinition[];
  states?: IVisualStateComponent;
};

export function readDungeonEntityVisuals(document: DungeonMapDocumentV2) {
  const definitions = new Map<string, DungeonEntityVisualDefinition>();
  const errors: string[] = [];
  const query = new DungeonMapDocumentQuery(document);
  for (const entity of document.entities) {
    if (entity.entityType !== 'visual-object' || entity.enabled === false) continue;
    const objects = query.getComponents(entity.id, 'visual-objects').filter(component => component.enabled !== false) as unknown as IVisualObjectsComponent[];
    const states = query.getComponents(entity.id, 'visual-state').filter(component => component.enabled !== false) as unknown as IVisualStateComponent[];
    const targets = query.getComponents<DungeonMapSpatialAttachmentComponent>(entity.id, 'spatial-attachment')
      .filter(component => component.enabled !== false).flatMap(component => component.targets ?? []);
    const target = targets[0];
    const index = target?.kind === 'tile' ? query.indexes.tileIndexById.get(target.tileId) : undefined;
    const issues = objects.flatMap(validateVisualObjects).concat(states.flatMap(validateVisualState));
    if (objects.length !== 1 || !objects[0]?.objects?.length) issues.push('需要一组非空的视觉对象。');
    if (states.length > 1) issues.push('只能有一个启用的视觉状态组件。');
    if (targets.length !== 1 || index === undefined) issues.push('必须挂载到一个有效格子。');
    const state = states[0];
    if (!issues.length && state) {
      const names = new Set(objects[0].objects.map(entry => entry.name));
      if (!state.states.some(entry => entry.id === state.initialState)) issues.push(`初始视觉状态 ${state.initialState} 不存在。`);
      for (const entry of state.states) {
        for (const name of Object.keys(entry.enabled)) if (!names.has(name)) issues.push(`状态 ${entry.id} 引用了不存在的视觉对象 ${name}。`);
      }
    }
    if (issues.length || index === undefined) {
      errors.push(...issues.map(issue => `${entity.id}: ${issue}`));
      continue;
    }
    definitions.set(entity.id, { entityId: entity.id, label: entity.name ?? entity.id,
      tileX: index % document.grid.width, tileY: Math.floor(index / document.grid.width), objects: objects[0].objects, states: state });
  }
  for (const raw of document.components.event ?? []) {
    const event = raw as unknown as IEventComponent;
    if (event.enabled === false || query.getEntity(raw.entityId)?.enabled === false || event.action?.type !== 'visual-state') continue;
    const { targetEntityId, stateId, groupId, operation = 'set' } = event.action;
    const target = definitions.get(targetEntityId)?.states;
    if (operation === 'set' ? !target?.states.some(state => state.id === stateId) : !target?.rotationGroups?.some(group => group.id === groupId)) {
      const detail = operation === 'set' ? `状态 ${stateId}` : `轮替组 ${groupId}`;
      errors.push(`${raw.id}: 视觉目标 ${targetEntityId} 或${detail}不存在或未启用。`);
    }
  }
  return { definitions, errors };
}
