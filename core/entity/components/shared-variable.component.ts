import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';

export type SharedVariableValue = number | boolean | string;
export const sharedVariableTypes = ['integer', 'boolean', 'string'] as const;
export type SharedVariableType = typeof sharedVariableTypes[number];
export const sharedVariableOperations = ['set', 'add', 'toggle', 'reset'] as const;
export type SharedVariableOperation = typeof sharedVariableOperations[number];
export const sharedVariableOperationOptions = [
  { value: 'set', label: '设为' }, { value: 'add', label: '加上（负数表示减）' },
  { value: 'toggle', label: '翻转布尔值' }, { value: 'reset', label: '重置到初始值' },
] as const;

export interface ISharedVariableComponent extends IComponent {
  type: 'shared-variable';
  variableId: string;
  label?: string;
  valueType: SharedVariableType;
  initialValue: SharedVariableValue;
  scope?: 'lab' | 'map';
}

export type SharedVariableAction = {
  type: 'shared-variable';
  variableId: string;
  variableOperation?: SharedVariableOperation;
  value?: SharedVariableValue;
};

export const isSharedVariableId = (id: unknown): id is string =>
  typeof id === 'string' && id.trim() === id && /^[a-z][a-z0-9_-]{0,63}$/.test(id);

export const isSharedVariableValue = (value: unknown): value is SharedVariableValue =>
  Number.isSafeInteger(value) || typeof value === 'boolean' || typeof value === 'string' && value.length <= 256;

export const isSharedVariableValueOfType = (type: SharedVariableType, value: unknown): value is SharedVariableValue =>
  isSharedVariableValue(value) && (type === 'integer' ? typeof value === 'number' : typeof value === type);

export const defaultSharedVariableValue = (type: SharedVariableType): SharedVariableValue =>
  type === 'integer' ? 0 : type === 'boolean' ? false : '';

export function validateSharedVariable(component: ISharedVariableComponent): string[] {
  const errors: string[] = [];
  if (component.version !== 1 || !isSharedVariableId(component.variableId)) errors.push('共享变量需要有效的 ID（小写字母开头，可含数字、连字符或下划线）。');
  if (component.label !== undefined && (typeof component.label !== 'string' || !component.label.trim() || component.label.length > 80)) errors.push('共享变量名称须在 1 至 80 字符之间。');
  if (!sharedVariableTypes.includes(component.valueType) || !isSharedVariableValueOfType(component.valueType, component.initialValue)) errors.push('共享变量初始值必须符合声明类型。');
  if (component.scope !== undefined && component.scope !== 'lab' && component.scope !== 'map') errors.push('共享变量作用域必须为当前 Lab 或按地图独立。');
  return errors;
}

export function validateSharedVariableOperation(action: SharedVariableAction, type: SharedVariableType): string | undefined {
  const operation = action.variableOperation ?? 'set';
  if (operation === 'add' && (type !== 'integer' || !Number.isSafeInteger(action.value))) return '加减操作需要整数变量和整数操作值。';
  if (operation === 'toggle' && type !== 'boolean') return '只有布尔变量可以翻转。';
  if (operation === 'set' && !isSharedVariableValueOfType(type, action.value)) return '设置值必须符合目标变量类型。';
}

export const componentDefinition: ComponentDefinition<ISharedVariableComponent> = {
  type: 'shared-variable', version: 1, label: '共享变量', description: '首次进入地图时申请一个共享值，同一 Lab 内保留运行值。',
  allowedEntityTypes: ['map'], allowMultiple: true,
  fields: [
    { path: 'variableId', label: '变量 ID', control: 'text' },
    { path: 'label', label: '显示名称', control: 'text', optional: true },
    { path: 'valueType', label: '数据类型', control: 'select', options: [
      { value: 'integer', label: '整数' }, { value: 'boolean', label: '布尔值' }, { value: 'string', label: '字符串' },
    ] },
    { path: 'initialValue', label: '初始值', control: 'json' },
    { path: 'scope', label: '作用域', control: 'select', options: [
      { value: 'lab', label: '当前 Lab（跨地图共享）' }, { value: 'map', label: '按地图独立（切回保留）' },
    ] },
  ],
  createDefault: () => {
    const id = createEntityDataId('component');
    return { id, type: 'shared-variable', version: 1, variableId: id.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      valueType: 'integer', initialValue: 0, scope: 'lab' };
  },
  validate: validateSharedVariable,
};
