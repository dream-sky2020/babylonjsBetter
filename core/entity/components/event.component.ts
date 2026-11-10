import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';
import { visualRotationLabels, visualRotationModes, type VisualRotationMode } from './visual-state.component.ts';
import { isDungeonInteractionCommandId } from '../../dungeon-interaction/dungeonInteractionCommand.ts';

export type DialogueInteractionAction = { type: 'dialogue'; presetKey: string; entryNodeId: string; uiPresetKey?: string };
export type MessageInteractionAction = { type: 'message'; text: string; durationSeconds?: number };
export type VisualStateInteractionAction = {
  type: 'visual-state'; targetEntityId: string; operation?: 'set' | VisualRotationMode;
  stateId?: string; groupId?: string; feedback?: string;
};
export type ServiceInteractionAction = { type: 'service'; commandId: string; parameters?: Record<string, unknown>; successMessage?: string };
export type ExecutableInteractionAction = DialogueInteractionAction | MessageInteractionAction | VisualStateInteractionAction | ServiceInteractionAction;
export type LegacyInteractionAction = { type: 'legacy'; actionId: string; payload?: Record<string, unknown> };
export type InteractionLocalSide = 'front' | 'right' | 'back' | 'left';
export type InteractionWorldSide = 'north' | 'east' | 'south' | 'west';
export interface IEventComponent extends IComponent {
  type: 'event'; trigger: string; targetRule?: 'front' | 'self'; priority?: number;
  ruleKind?: 'receive' | 'action';
  movementPhase?: 'contact' | 'blocked';
  mover?: 'any' | 'self' | 'entity'; moverId?: string;
  blocker?: 'any' | 'self' | 'entity'; blockerId?: string;
  oncePerContact?: boolean;
  action?: ExecutableInteractionAction | LegacyInteractionAction;
  once?: boolean;
  ruleName?: string;
  directionSpace?: 'any' | 'world' | 'target-local';
  worldSides?: InteractionWorldSide[];
  localSides?: InteractionLocalSide[];
  onceScope?: 'rule' | 'entity';
  actorScope?: 'player' | 'agent' | 'both';
  /** V1 data remains available; unknown legacy actions are never automatically executed. */
  actionId?: string; payload?: Record<string, unknown>;
}
export const EVENT_ENTITY_TYPES = ['tile', 'tile-edge', 'shared-edge', 'shared-point', 'dungeon-agent', 'spatial-object', 'obstacle', 'interaction-point'] as const;
const nonempty = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 256;
export function validateInteractionEvent(component: IEventComponent, complete = true): string[] {
  if (component.version === 1) return [];
  const errors: string[] = [];
  const movementRule = component.trigger === 'move-attempt';
  const actionRule = movementRule && component.ruleKind === 'action';
  if (component.version !== 2) errors.push('event 组件版本必须为 1 或 2。');
  if (component.ruleKind !== undefined && !['receive', 'action'].includes(component.ruleKind)) errors.push('交互规则类型无效。');
  if (((complete && !movementRule) || component.targetRule !== undefined) && !['front', 'self'].includes(component.targetRule ?? '')) errors.push('交互位置必须为 front 或 self。');
  if (component.movementPhase !== undefined && !['contact', 'blocked'].includes(component.movementPhase)) errors.push('移动受阻规则的执行时机无效。');
  if (complete && movementRule && component.movementPhase === 'contact' && component.actorScope && component.actorScope !== 'player') errors.push('发现阻挡时接管目前支持玩家移动。');
  for (const [name, mode, id] of [['移动者', component.mover, component.moverId], ['阻挡者', component.blocker, component.blockerId]] as const) {
    if (mode !== undefined && !['any', 'self', 'entity'].includes(mode)) errors.push(`${name}筛选无效。`);
    if ((id !== undefined && typeof id !== 'string') || (complete && movementRule && mode === 'entity' && !nonempty(id))) errors.push(`${name}需要有效的实体 ID。`);
  }
  if (component.oncePerContact !== undefined && typeof component.oncePerContact !== 'boolean') errors.push('每次接触仅触发一次须为布尔值。');
  if ((complete || component.priority !== undefined) && !Number.isSafeInteger(component.priority)) errors.push('交互优先级必须是安全整数。');
  if (component.once !== undefined && typeof component.once !== 'boolean') errors.push('once 必须为布尔值。');
  if (component.ruleName !== undefined && (typeof component.ruleName !== 'string' || component.ruleName.length > 256)) errors.push('规则名称不能超过 256 字符。');
  if (component.directionSpace !== undefined && !['any', 'world', 'target-local'].includes(component.directionSpace)) errors.push('方向参照无效。');
  if (component.onceScope !== undefined && !['rule', 'entity'].includes(component.onceScope)) errors.push('次数共享范围无效。');
  if (component.actorScope !== undefined && !['player', 'agent', 'both'].includes(component.actorScope)) errors.push('交互发起者范围无效。');
  for (const [field, allowed] of [['worldSides', ['north', 'east', 'south', 'west']], ['localSides', ['front', 'right', 'back', 'left']]] as const) {
    const sides = component[field];
    if (sides !== undefined && (!Array.isArray(sides) || sides.some(side => !(allowed as readonly string[]).includes(side)) || new Set(sides).size !== sides.length)) errors.push(`${field} 必须是无重复的有效方向列表。`);
  }
  if (complete && component.directionSpace === 'world' && !component.worldSides?.length) errors.push('世界方向规则至少选择一个侧面。');
  if (complete && component.directionSpace === 'target-local' && !component.localSides?.length) errors.push('相对朝向规则至少选择一个侧面。');
  if (complete && component.targetRule === 'self' && component.trigger === 'interact' && component.directionSpace && component.directionSpace !== 'any') errors.push('脚下主动交互没有侧面；请使用面前目标，或进入触发的来路。');
  const action = component.action;
  if (complete && (movementRule && component.movementPhase === 'blocked' || (actionRule && component.movementPhase !== 'contact')
    || (component.actorScope === 'agent' || component.actorScope === 'both') && action?.type !== 'visual-state' && action?.type !== 'service') && action?.type !== 'message') errors.push('此交互必须使用地图提示。');
  if (action?.type === 'legacy') return errors;
  if (!['interact', 'enter', 'move-attempt'].includes(component.trigger)) errors.push('交互触发时机无效。');
  if (complete && component.trigger === 'enter' && component.targetRule !== 'self') errors.push('进入触发必须使用 self 位置规则。');
  if (complete && movementRule && !component.movementPhase && !actionRule && component.targetRule !== 'front') errors.push('旧式受阻规则使用 front，或明确选择新的执行时机。');
  if (action?.type === 'message') {
    if ((complete || action.text !== undefined) && (typeof action.text !== 'string' || action.text.length > 256 || complete && !nonempty(action.text))) errors.push('消息文字不能为空且不能超过 256 字符。');
    if (action.durationSeconds !== undefined && (!Number.isFinite(action.durationSeconds) || action.durationSeconds < .5 || action.durationSeconds > 15)) errors.push('消息停留时间必须在 0.5 至 15 秒之间。');
  } else if (action?.type === 'visual-state') {
    if (complete && movementRule) errors.push('视觉状态切换只支持进入格子或主动交互。');
    const operation = action.operation === undefined ? 'set' : action.operation;
    if (operation !== 'set' && !visualRotationModes.includes(operation)) errors.push('视觉状态操作无效。');
    for (const [label, value, required] of [
      ['视觉目标', action.targetEntityId, true], ['视觉状态', action.stateId, operation === 'set'], ['轮替组', action.groupId, operation !== 'set'],
    ] as const) {
      if (value !== undefined && (typeof value !== 'string' || value.length > 256) || complete && required && !nonempty(value)) errors.push(`${label}不能为空且不能超过 256 字符。`);
    }
    if (action.feedback !== undefined && (typeof action.feedback !== 'string' || action.feedback.length > 256)) errors.push('成功提示不能超过 256 字符。');
  } else if (action?.type === 'service') {
    if (complete && movementRule) errors.push('触发服务只支持进入格子或主动交互。');
    if ((complete || action.commandId !== undefined && action.commandId !== '') && !isDungeonInteractionCommandId(action.commandId)) errors.push('服务指令 ID 无效，例如 obstacle.set-active。');
    if (action.parameters !== undefined && (!action.parameters || typeof action.parameters !== 'object' || Array.isArray(action.parameters))) errors.push('服务参数必须是 JSON 对象。');
    if (action.successMessage !== undefined && (typeof action.successMessage !== 'string' || action.successMessage.length > 256)) errors.push('成功提示不能超过 256 字符。');
  } else if (action?.type === 'dialogue') {
    if ((complete || action.presetKey !== undefined) && (typeof action.presetKey !== 'string' || action.presetKey.length > 256 || complete && !nonempty(action.presetKey))) errors.push('对话预设 Key 不能为空且不能超过 256 字符。');
    if ((complete || action.entryNodeId !== undefined) && (typeof action.entryNodeId !== 'string' || action.entryNodeId.length > 256 || complete && !nonempty(action.entryNodeId))) errors.push('对话入口不能为空且不能超过 256 字符。');
    if (action.uiPresetKey !== undefined && !nonempty(action.uiPresetKey)) errors.push('UI 预设 Key 无效。');
  } else errors.push('交互动作必须为 dialogue、message、visual-state、service 或兼容的 legacy。');
  return errors;
}
export const visualStateOperationOptions = [
  { value: 'set', label: '切到指定状态' },
  ...visualRotationModes.map(value => ({ value, label: visualRotationLabels[value] })),
];
export function upgradeInteractionEvent(source: IEventComponent): IEventComponent {
  if (source.version === 2 && source.trigger === 'approach-player') {
    const { targetRule, actorScope, ...rest } = structuredClone(source);
    return { ...rest, trigger: 'move-attempt', movementPhase: 'blocked', ruleKind: 'action', mover: 'self', blocker: 'entity',
      blockerId: '$dungeon-player', oncePerContact: true };
  }
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
    { path: 'ruleName', label: '规则名称', control: 'text', optional: true },
    { path: 'actorScope', label: '发起者范围', control: 'select', optional: true, options: [{ value: 'player', label: '仅玩家' }, { value: 'agent', label: '仅 Agent' }, { value: 'both', label: '玩家与 Agent' }] },
    { path: 'trigger', label: '触发时机', control: 'select', options: [{ value: 'interact', label: '主动交互' }, { value: 'enter', label: '完成格步后进入' }, { value: 'move-attempt', label: '移动受阻' }] },
    { path: 'movementPhase', label: '受阻执行时机（留空沿用旧规则）', control: 'select', optional: true, visibleWhen: { path: 'trigger', equals: 'move-attempt' }, options: [{ value: 'contact', label: '发现阻挡时 · 接管移动' }, { value: 'blocked', label: '确认受阻后 · 通知' }] },
    { path: 'mover', label: '移动者（默认任意）', control: 'select', optional: true, visibleWhen: { path: 'trigger', equals: 'move-attempt' }, options: [{ value: 'any', label: '任意实体' }, { value: 'self', label: '本实体' }, { value: 'entity', label: '指定实体' }] },
    { path: 'moverId', label: '指定移动者 ID（玩家为 $dungeon-player）', control: 'text', optional: true, visibleWhen: { path: 'mover', equals: 'entity' } },
    { path: 'blocker', label: '阻挡者（旧接收规则默认本实体）', control: 'select', optional: true, visibleWhen: { path: 'trigger', equals: 'move-attempt' }, options: [{ value: 'any', label: '任意实体' }, { value: 'self', label: '本实体' }, { value: 'entity', label: '指定实体' }] },
    { path: 'blockerId', label: '指定阻挡者 ID（玩家为 $dungeon-player）', control: 'text', optional: true, visibleWhen: { path: 'blocker', equals: 'entity' } },
    { path: 'oncePerContact', label: '同一次接触只通知一次', control: 'checkbox', optional: true, visibleWhen: { path: 'trigger', equals: 'move-attempt' } },
    { path: 'targetRule', label: '接收交互的目标搜索位置', control: 'select', visibleWhen: { path: 'trigger', notEquals: 'move-attempt' }, options: [{ value: 'front', label: '面前一格或面前的边' }, { value: 'self', label: '当前所在格' }] },
    { path: 'directionSpace', label: '方向参照（留空视为不限制）', control: 'select', optional: true, options: [{ value: 'any', label: '任意方向 / 通用后备' }, { value: 'world', label: '地图固定方向' }, { value: 'target-local', label: '相对目标自身朝向' }] },
    { path: 'worldSides', label: '地图侧面（固定方向模式，可多选）', control: 'multi-select', optional: true, options: [{ value: 'north', label: '北侧' }, { value: 'east', label: '东侧' }, { value: 'south', label: '南侧' }, { value: 'west', label: '西侧' }] },
    { path: 'localSides', label: '实体侧面（相对朝向模式，可多选）', control: 'multi-select', optional: true, options: [{ value: 'front', label: '正面' }, { value: 'right', label: '右侧' }, { value: 'back', label: '背面' }, { value: 'left', label: '左侧' }] },
    { path: 'priority', label: '交互优先级', control: 'number', step: 1 },
    { path: 'action.type', label: '执行动作', control: 'select', options: [{ value: 'dialogue', label: '开始对话' }, { value: 'message', label: '显示地图提示' }, { value: 'visual-state', label: '切换视觉状态' }, { value: 'service', label: '触发服务' }, { value: 'legacy', label: '保留旧事件（未接执行器）' }] },
    { path: 'action.commandId', label: '服务指令 ID', control: 'text', placeholder: 'obstacle.set-active', visibleWhen: { path: 'action.type', equals: 'service' } },
    { path: 'action.parameters', label: '服务参数（JSON 对象）', control: 'json', optional: true, placeholder: '{"entityId":"障碍实体 ID","active":false}', visibleWhen: { path: 'action.type', equals: 'service' } },
    { path: 'action.successMessage', label: '成功提示（可选）', control: 'text', optional: true, visibleWhen: { path: 'action.type', equals: 'service' } },
    { path: 'action.text', label: '消息文字', control: 'text', visibleWhen: { path: 'action.type', equals: 'message' } },
    { path: 'action.durationSeconds', label: '消息停留秒数（默认 3）', control: 'number', min: .5, max: 15, step: .5, optional: true, visibleWhen: { path: 'action.type', equals: 'message' } },
    { path: 'action.targetEntityId', label: '目标视觉实体', control: 'text', visibleWhen: { path: 'action.type', equals: 'visual-state' } },
    { path: 'action.operation', label: '视觉状态操作', control: 'select', options: visualStateOperationOptions, visibleWhen: { path: 'action.type', equals: 'visual-state' } },
    { path: 'action.stateId', label: '目标视觉状态', control: 'text', visibleWhen: { path: 'action.type', equals: 'visual-state' } },
    { path: 'action.groupId', label: '目标轮替组', control: 'text', visibleWhen: { path: 'action.type', equals: 'visual-state' } },
    { path: 'action.feedback', label: '成功提示（可选）', control: 'text', optional: true, placeholder: '例如：机关灯切换为 {state}', visibleWhen: { path: 'action.type', equals: 'visual-state' } },
    { path: 'action.presetKey', label: '对话预设 Key', control: 'text', visibleWhen: { path: 'action.type', equals: 'dialogue' } },
    { path: 'action.entryNodeId', label: '对话入口节点', control: 'text', visibleWhen: { path: 'action.type', equals: 'dialogue' } },
    { path: 'action.uiPresetKey', label: 'UI 预设（空则沿用对话模块）', control: 'text', optional: true, visibleWhen: { path: 'action.type', equals: 'dialogue' } },
    { path: 'once', label: '本次进入地图只触发一次', control: 'checkbox', optional: true },
    { path: 'onceScope', label: '一次性次数共享范围', control: 'select', optional: true, options: [{ value: 'rule', label: '各规则独立' }, { value: 'entity', label: '同一实体的共享规则共用一次' }] },
    { path: 'actionId', label: '旧动作 ID（兼容数据）', control: 'text', optional: true },
    { path: 'payload', label: '旧业务载荷（兼容数据）', control: 'json', optional: true },
  ],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'event', version: 2, trigger: 'interact', targetRule: 'front', priority: 0,
    action: { type: 'dialogue', presetKey: '', entryNodeId: '' } }),
  validate: validateInteractionEvent,
  migrate: data => upgradeInteractionEvent(data as IEventComponent),
};
