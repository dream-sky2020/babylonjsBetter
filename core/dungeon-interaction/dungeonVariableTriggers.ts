import { validateVariableTrigger, type IVariableTriggerComponent } from '../entity/components/variable-trigger.component.ts';
import { isSharedVariableValueOfType, validateSharedVariableOperation } from '../entity/components/shared-variable.component.ts';
import type { DungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.types.ts';
import { collectDungeonSharedVariables } from './dungeonSharedVariables.ts';

export function collectDungeonVariableTriggers(document: DungeonMapDocumentV2, complete = false) {
  const rules: (IVariableTriggerComponent & { entityId: string })[] = [];
  const issues: { path: string; message: string }[] = [];
  const rows = document.components['variable-trigger'] ?? [];
  if (!rows.length) return { rules, issues };
  const { definitions } = collectDungeonSharedVariables(document);
  for (const [index, raw] of rows.entries()) {
    const rule = raw as unknown as IVariableTriggerComponent & { entityId: string };
    const owner = document.entities.find(entity => entity.id === raw.entityId);
    const enabled = raw.enabled !== false && owner?.enabled !== false;
    const errors = validateVariableTrigger(rule, complete && enabled);
    if (owner?.entityType !== 'map') errors.push('变量变化触发必须挂在地图实体上。');
    if (complete && enabled) {
      const source = rule.variableId ? definitions.get(rule.variableId) : undefined;
      if (!source) errors.push(`监听变量「${rule.variableId ?? ''}」尚未在本地图声明。`);
      else if (!isSharedVariableValueOfType(source.valueType, rule.threshold)) errors.push('比较值必须符合监听变量类型。');
      if (rule.action?.type === 'shared-variable') {
        const target = definitions.get(rule.action.variableId);
        const error = target ? validateSharedVariableOperation(rule.action, target.valueType)
          : `目标共享变量「${rule.action.variableId ?? ''}」尚未在本地图声明。`;
        if (error) errors.push(error);
      }
    }
    for (const message of errors) issues.push({ path: `components.variable-trigger[${index}]`, message });
    if (enabled && errors.length === 0) rules.push(rule);
  }
  return { rules, issues };
}
