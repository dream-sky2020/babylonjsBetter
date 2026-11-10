import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';
import { validVisualId } from './visual-objects.component.ts';

export type VisualStateDefinition = { id: string; label?: string; enabled: Record<string, boolean> };
export type VisualStateRotationGroup = { id: string; stateIds: string[] };
export const visualRotationModes = ['next', 'previous', 'random', 'shuffle'] as const;
export type VisualRotationMode = typeof visualRotationModes[number];
export const visualRotationLabels: Record<VisualRotationMode, string> = {
  next: '下一个', previous: '上一个', random: '随机抽取', shuffle: '洗牌轮替',
};
export interface IVisualStateComponent extends IComponent {
  type: 'visual-state';
  initialState: string;
  states: VisualStateDefinition[];
  rotationGroups?: VisualStateRotationGroup[];
}

export function validateVisualState(component: IVisualStateComponent): string[] {
  if (component.version !== 1 || !Array.isArray(component.states) || !validVisualId(component.initialState)) return ['视觉状态组件需要 V1 状态列表和有效的初始状态 ID。'];
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const state of component.states) {
    if (!state || !validVisualId(state.id) || ids.has(state.id)) { errors.push('视觉状态 ID 无效或重复。'); continue; }
    ids.add(state.id);
    if (state.label !== undefined && (typeof state.label !== 'string' || !state.label.trim() || state.label.length > 80)) errors.push(`状态 ${state.id} 的显示名称无效。`);
    if (!state.enabled || typeof state.enabled !== 'object' || Array.isArray(state.enabled)
      || Object.entries(state.enabled).some(([key, value]) => !validVisualId(key) || typeof value !== 'boolean')) {
      errors.push(`状态 ${state.id} 的对象开关必须由本地对象名映射到布尔值。`);
    }
  }
  if (component.rotationGroups !== undefined && !Array.isArray(component.rotationGroups)) {
    errors.push('轮替组必须是数组。');
  } else {
    const groups = new Set<string>();
    for (const group of component.rotationGroups ?? []) {
      if (!group || !validVisualId(group.id) || groups.has(group.id)) { errors.push('轮替组 ID 无效或重复。'); continue; }
      groups.add(group.id);
      if (!Array.isArray(group.stateIds) || !group.stateIds.length || group.stateIds.some(id => !validVisualId(id) || !ids.has(id))
        || new Set(group.stateIds).size !== group.stateIds.length) errors.push(`轮替组 ${group.id} 必须引用至少一个存在且不重复的状态。`);
    }
  }
  return errors;
}

export const componentDefinition: ComponentDefinition<IVisualStateComponent> = {
  type: 'visual-state', version: 1, label: '视觉状态', description: '声明初始状态、对象开关和有序轮替组。',
  allowedEntityTypes: ['visual-object'], allowMultiple: false,
  fields: [
    { path: 'initialState', label: '初始状态 ID', control: 'text' },
    { path: 'states', label: '状态列表（JSON）', control: 'json' },
    { path: 'rotationGroups', label: '轮替组（JSON）', control: 'json', optional: true,
      placeholder: '[{"id":"colors","stateIds":["off","lit"]}]' },
  ],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'visual-state', version: 1, initialState: 'off', states: [
    { id: 'off', enabled: { light: false } }, { id: 'lit', enabled: { light: true } },
  ] }),
  validate: validateVisualState,
};
