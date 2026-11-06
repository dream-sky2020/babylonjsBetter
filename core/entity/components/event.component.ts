import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';

export type DialogueInteractionAction = { type: 'dialogue'; presetKey: string; entryNodeId: string; uiPresetKey?: string };
export type LegacyInteractionAction = { type: 'legacy'; actionId: string; payload?: Record<string, unknown> };
export interface IEventComponent extends IComponent {
  type: 'event'; trigger: string; targetRule?: 'front' | 'self'; priority?: number;
  action?: DialogueInteractionAction | LegacyInteractionAction;
  once?: boolean;
  /** V1 data remains available; unknown legacy actions are never automatically executed. */
  actionId?: string; payload?: Record<string, unknown>;
}
export const EVENT_ENTITY_TYPES = ['tile', 'tile-edge', 'shared-edge', 'shared-point', 'dungeon-agent', 'spatial-object', 'obstacle', 'interaction-point'] as const;
const nonempty = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 256;
export function validateInteractionEvent(component: IEventComponent, complete = true): string[] {
  if (component.version === 1) return [];
  const errors: string[] = [];
  if (component.version !== 2) errors.push('event 组件版本必须为 1 或 2。');
  if ((complete || component.targetRule !== undefined) && !['front', 'self'].includes(component.targetRule ?? '')) errors.push('交互位置必须为 front 或 self。');
  if ((complete || component.priority !== undefined) && !Number.isSafeInteger(component.priority)) errors.push('交互优先级必须是安全整数。');
  if (component.once !== undefined && typeof component.once !== 'boolean') errors.push('once 必须为布尔值。');
  const action = component.action;
  if (action?.type === 'legacy') return errors;
  if (!['interact', 'enter'].includes(component.trigger)) errors.push('对白交互只支持 interact 或 enter。');
  if (complete && component.trigger === 'enter' && component.targetRule !== 'self') errors.push('进入触发必须使用 self 位置规则。');
  if (!action || action.type !== 'dialogue') errors.push('交互动作必须为 dialogue 或兼容的 legacy。');
  else {
    if ((complete || action.presetKey !== undefined) && (typeof action.presetKey !== 'string' || action.presetKey.length > 256 || complete && !nonempty(action.presetKey))) errors.push('对话预设 Key 不能为空且不能超过 256 字符。');
    if ((complete || action.entryNodeId !== undefined) && (typeof action.entryNodeId !== 'string' || action.entryNodeId.length > 256 || complete && !nonempty(action.entryNodeId))) errors.push('对话入口不能为空且不能超过 256 字符。');
    if (action.uiPresetKey !== undefined && !nonempty(action.uiPresetKey)) errors.push('UI 预设 Key 无效。');
  }
  return errors;
}
export function upgradeInteractionEvent(source: IEventComponent): IEventComponent {
  if (source.version !== 1) return structuredClone(source);
  return { ...structuredClone(source), version: 2, targetRule: 'self', priority: 0,
    action: { type: 'legacy', actionId: source.actionId ?? '', ...(source.payload ? { payload: structuredClone(source.payload) } : {}) } };
}
export const componentDefinition: ComponentDefinition<IEventComponent> = {
  type: 'event', version: 2, label: '交互事件',
  description: '主动交互或进入位置时的动作。旧事件无损保留为 legacy，不自动执行未知业务。',
  allowMultiple: true, allowedEntityTypes: EVENT_ENTITY_TYPES,
  batch: { scope: 'compatible', create: true, delete: true },
  fields: [
    { path: 'trigger', label: '触发时机', control: 'select', options: [{ value: 'interact', label: '主动交互' }, { value: 'enter', label: '完成格步后进入' }] },
    { path: 'targetRule', label: '交互位置', control: 'select', options: [{ value: 'front', label: '面前一格或面前的边' }, { value: 'self', label: '当前所在格' }] },
    { path: 'priority', label: '交互优先级', control: 'number', step: 1 },
    { path: 'action.type', label: '执行动作', control: 'select', options: [{ value: 'dialogue', label: '开始对话' }, { value: 'legacy', label: '保留旧事件（未接执行器）' }] },
    { path: 'action.presetKey', label: '对话预设 Key', control: 'text' },
    { path: 'action.entryNodeId', label: '对话入口节点', control: 'text' },
    { path: 'action.uiPresetKey', label: 'UI 预设（空则沿用对话模块）', control: 'text', optional: true },
    { path: 'once', label: '本次进入地图只触发一次', control: 'checkbox', optional: true },
    { path: 'actionId', label: '旧动作 ID（兼容数据）', control: 'text', optional: true },
    { path: 'payload', label: '旧业务载荷（兼容数据）', control: 'json', optional: true },
  ],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'event', version: 2, trigger: 'interact', targetRule: 'front', priority: 0,
    action: { type: 'dialogue', presetKey: '', entryNodeId: '' } }),
  validate: validateInteractionEvent,
  migrate: data => upgradeInteractionEvent(data as IEventComponent),
};
