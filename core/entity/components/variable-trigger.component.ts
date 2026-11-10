import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';
import { mapActionFields, validateDungeonMapAction, type ExecutableInteractionAction } from './event.component.ts';
import { isSharedVariableId, isSharedVariableValue, type SharedVariableValue } from './shared-variable.component.ts';

export const variableTriggerOperators = ['gte', 'lte', 'equals'] as const;
export type VariableTriggerOperator = typeof variableTriggerOperators[number];
export interface IVariableTriggerComponent extends IComponent {
  type: 'variable-trigger';
  variableId?: string;
  operator: VariableTriggerOperator;
  threshold?: SharedVariableValue;
  action?: ExecutableInteractionAction;
}
const actionFields = mapActionFields.map(field => field.path === 'action.type' && 'options' in field
  ? { ...field, options: field.options?.filter(option => option.value !== 'legacy') } : field);

export const matchesVariableCondition = (value: SharedVariableValue, operator: VariableTriggerOperator, threshold: SharedVariableValue): boolean => {
  if (operator === 'equals') return value === threshold;
  if (typeof value !== 'number' || typeof threshold !== 'number') return false;
  return operator === 'gte' ? value >= threshold : value <= threshold;
};

export function validateVariableTrigger(component: IVariableTriggerComponent, complete = false): string[] {
  const errors: string[] = [];
  if (component.version !== 1) errors.push('变量变化触发须使用版本 1。');
  if ((complete || component.variableId !== undefined) && !isSharedVariableId(component.variableId)) errors.push('请选择要监听的共享变量。');
  if (!variableTriggerOperators.includes(component.operator)) errors.push('变量比较条件无效。');
  if ((complete || component.threshold !== undefined) && (component.operator === 'equals'
    ? !isSharedVariableValue(component.threshold) : !Number.isSafeInteger(component.threshold))) errors.push('变量条件值与比较方式不匹配。');
  return !complete && component.action === undefined ? errors : [...errors, ...validateDungeonMapAction(component.action, complete)];
}

export const componentDefinition: ComponentDefinition<IVariableTriggerComponent> = {
  type: 'variable-trigger', version: 1, label: '变量变化触发', description: '比较变量的新旧值，条件由不成立变为成立时执行地图动作。',
  allowedEntityTypes: ['map'], allowMultiple: true,
  fields: [
    { path: 'variableId', label: '监听变量', control: 'text' },
    { path: 'operator', label: '条件', control: 'select', options: [
      { value: 'gte', label: '大于或等于' }, { value: 'lte', label: '小于或等于' }, { value: 'equals', label: '等于' },
    ] },
    { path: 'threshold', label: '比较值', control: 'json' },
    ...actionFields,
  ],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'variable-trigger', version: 1, operator: 'equals',
    action: { type: 'message', text: '' } }),
  validate: validateVariableTrigger,
};
