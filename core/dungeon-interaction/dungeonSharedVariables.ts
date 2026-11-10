import { isSharedVariableId, validateSharedVariable, type ISharedVariableComponent } from '../entity/components/shared-variable.component.ts';
import type { DungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.types.ts';

export function collectDungeonSharedVariables(document: DungeonMapDocumentV2) {
  const definitions = new Map<string, ISharedVariableComponent>();
  const issues: { path: string; message: string }[] = [];
  (document.components['shared-variable'] ?? []).forEach((row, index) => {
    const path = `components.shared-variable[${index}]`;
    const owner = document.entities.find(entity => entity.id === row.entityId);
    const definition = row as unknown as ISharedVariableComponent;
    const errors = validateSharedVariable(definition);
    if (owner?.entityType !== 'map') errors.push('共享变量必须声明在地图实体上。');
    if (row.enabled !== false && owner?.enabled !== false && isSharedVariableId(definition.variableId)) {
      if (definitions.has(definition.variableId)) errors.push(`地图中的共享变量「${definition.variableId}」重复。`);
      else if (errors.length === 0) definitions.set(definition.variableId, definition);
    }
    for (const message of errors) issues.push({ path, message });
  });
  return { definitions, issues };
}
