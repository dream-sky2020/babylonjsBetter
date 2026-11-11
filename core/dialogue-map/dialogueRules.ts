import type { DialogueCondition, DialogueEffect, DialogueEditorNode, DialogueEventWait, DialogueMapAction, DialogueRuleCatalog, DialogueScalar, DialogueValue } from './dialogueMap.types.ts';
import { validateDungeonMapAction } from '../entity/components/event.component.ts';
import type { DialogueEditorDocument, DialogueTextBindings } from './dialogueMap.types.ts';
import { dialogueTextVariableNames, isDialogueTextVariableName } from './dialogueText.ts';

export const dialogueComparisonOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'] as const;

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('对话规则必须是对象。');
  return value as Record<string, unknown>;
};
const string = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('对话规则字段必须是字符串。');
  return value;
};
export const parseDialogueValue = (value: unknown): DialogueValue => {
  const raw = object(value);
  if (raw.type === 'literal' && (raw.value === null || ['string', 'boolean', 'number'].includes(typeof raw.value))) {
    return { type: 'literal', value: raw.value as DialogueScalar };
  }
  if (raw.type === 'memory' && Array.isArray(raw.path)) return { type: 'memory', key: string(raw.key), path: raw.path.map(string) };
  throw new Error('不支持的对话值引用。');
};
export const parseDialogueCondition = (value: unknown, depth = 0): DialogueCondition => {
  if (depth > 32) throw new Error('条件嵌套不能超过 32 层。');
  const raw = object(value);
  if (raw.type === 'compare' && dialogueComparisonOperators.some(operator => operator === raw.operator)) return {
    type: 'compare', left: parseDialogueValue(raw.left), operator: raw.operator as Extract<DialogueCondition, { type: 'compare' }>['operator'], right: parseDialogueValue(raw.right),
  };
  if ((raw.type === 'all' || raw.type === 'any') && Array.isArray(raw.conditions)) return { type: raw.type, conditions: raw.conditions.map(item => { const child = parseDialogueCondition(item, depth + 1); if (child.type !== 'compare') throw new Error('判断只支持平铺比较条件，不支持嵌套条件组。'); return child; }) };
  throw new Error('不支持的对话条件。');
};
export const parseDialogueEffect = (value: unknown): DialogueEffect => {
  const raw = object(value);
  if (raw.type === 'event' && typeof raw.version === 'number') return {
    type: 'event', eventType: string(raw.eventType), version: raw.version,
    ...(raw.payload === undefined ? {} : { payload: Object.fromEntries(Object.entries(object(raw.payload)).map(([key, item]) => [key, parseDialogueValue(item)])) }),
    ...(raw.correlationId === undefined ? {} : { correlationId: string(raw.correlationId) }),
  };
  throw new Error('不支持的对话效果。');
};

export const parseDialogueEventWait = (value: unknown): DialogueEventWait => {
  const raw = object(value);
  if (!Array.isArray(raw.filters)) throw new Error('等待事件需要匹配条件列表。');
  const filters = raw.filters.map(item => {
    const filter = object(item);
    const operator = dialogueComparisonOperators.find(operator => operator === filter.operator);
    if (!operator) throw new Error('事件匹配比较方式无效。');
    return { field: string(filter.field), operator, value: parseDialogueValue(filter.value) };
  });
  const { timeoutMs, allowMovement } = raw;
  if (timeoutMs !== undefined && (typeof timeoutMs !== 'number' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 2_147_483_647)) throw new Error('等待超时毫秒数无效。');
  if (allowMovement !== undefined && typeof allowMovement !== 'boolean') throw new Error('允许移动必须是布尔值。');
  return { filters, ...(timeoutMs === undefined ? {} : { timeoutMs }), ...(allowMovement === undefined ? {} : { allowMovement }),
    ...(raw.sourceModuleId === undefined ? {} : { sourceModuleId: string(raw.sourceModuleId) }),
    ...(raw.correlationId === undefined ? {} : { correlationId: string(raw.correlationId) }) };
};

export const parseDialogueMapAction = (value: unknown): DialogueMapAction => {
  const raw = object(value);
  if (!['message', 'visual-state', 'shared-variable', 'service'].some(type => raw.type === type)) throw new Error('不支持的对话地图动作。');
  const action = structuredClone(raw) as DialogueMapAction;
  const errors = validateDungeonMapAction(action.type === 'shared-variable' && action.variableId === ''
    ? { ...action, variableId: undefined! } : action, false);
  if (errors.length) throw new Error(errors.join('；'));
  return action;
};

export type DialogueRuleIssue = { severity: 'error' | 'warning'; message: string };

export function migrateDialogueConditions(document: DialogueEditorDocument): void {
  const bindings: DialogueTextBindings = document.textVariables ?? {};
  const reserved = new Set([...document.graph.nodes.values()].flatMap(node => [...node.lines.values()].flatMap(line => dialogueTextVariableNames(line.text))));
  const formatValue = (value: DialogueValue): string => {
    if (value.type === 'literal') return JSON.stringify(value.value);
    const known = Object.keys(bindings).find(name => bindings[name].key === value.key && JSON.stringify(bindings[name].path) === JSON.stringify(value.path));
    if (known) return `{${known}}`;
    const base = value.path.at(-1) || value.key.split('.').at(-1) || '变量';
    const stem = isDialogueTextVariableName(base) && base.length <= 55 ? base : '变量';
    let name = stem;
    for (let suffix = 2; Object.hasOwn(bindings, name) || reserved.has(name) || name === '__proto__'; suffix++) name = `${stem}_${suffix}`;
    bindings[name] = { key: value.key, path: value.path };
    document.textVariables = bindings;
    return `{${name}}`;
  };
  const operators = { eq: '==', ne: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' };
  for (const node of document.graph.nodes.values()) {
    if (node.kind !== 'condition' || !node.condition) continue;
    const condition = node.condition;
    const comparisons = condition.type === 'compare' ? [condition] : condition.conditions;
    node.formula = comparisons.map(item => `${formatValue(item.left)} ${operators[item.operator]} ${formatValue(item.right)}`)
      .join(condition.type === 'any' ? ' || ' : ' && ');
    delete node.condition;
  }
}
export const validateDialogueNodeRules = (node: DialogueEditorNode, catalog?: DialogueRuleCatalog): DialogueRuleIssue[] => {
  const issues: DialogueRuleIssue[] = [];
  const report = (message: string, severity: 'error' | 'warning' = 'error') => issues.push({ message, severity });
  const valueType = (value: DialogueValue): string | undefined => {
    if (value.type === 'literal') {
      if (typeof value.value === 'number' && !Number.isFinite(value.value)) report('常量必须为有限数值。');
      return value.value === null ? 'null' : typeof value.value;
    }
    if (!value.key.trim() || value.path.some(item => !item.trim())) { report('共享内存 Key 不能为空，字段路径不能包含空段。'); return undefined; }
    const field = catalog?.memories.find(item => item.key === value.key)?.fields.find(item => JSON.stringify(item.path) === JSON.stringify(value.path));
    if (catalog && !field) report(`共享内存字段未登记：${[value.key, ...value.path].join('.')}`, 'warning');
    return field?.valueType;
  };
  const condition = (item: DialogueCondition, depth = 0): void => {
    if (depth > 0 && item.type !== 'compare') { report('判断只支持平铺比较条件。'); return; }
    if (item.type === 'all' || item.type === 'any') {
      if (!item.conditions.length) report('条件组至少需要一个条件。');
      item.conditions.forEach(child => condition(child, depth + 1)); return;
    }
    if (item.type !== 'compare') return;
    const left = valueType(item.left), right = valueType(item.right);
    if (left && right && left !== right) report('比较两侧的类型必须一致。');
    if (!['eq', 'ne'].includes(item.operator) && ((left && left !== 'number') || (right && right !== 'number'))) report('大小比较只支持数字。');
  };
  const event = (eventType: string, version: number) => {
    const validName = !!eventType.trim(), validVersion = Number.isSafeInteger(version) && version >= 1;
    if (!validName) report('事件名称不能为空。');
    if (!validVersion) report('事件版本必须为正整数。');
    if (!validName || !validVersion) return undefined;
    const entry = catalog?.events.find(item => item.eventType === eventType && item.version === version);
    if (catalog && !entry) report(`事件未登记：${eventType}@${version}`, 'warning');
    return entry;
  };
  if (node.kind === 'condition' && node.formula === undefined) {
    if (node.condition) condition(node.condition); else report('判断节点缺少条件。');
  }
  if (node.kind === 'event') {
    node.events.forEach(effect => {
    const entry = event(effect.eventType, effect.version);
    if (node.mode === 'wait') {
      for (const filter of node.wait.filters) {
        const actual = valueType(filter.value), field = entry?.fields.find(field => field.name === filter.field);
        if (!filter.field.trim()) report('事件匹配字段不能为空。');
        else if (entry && !field) report(`事件匹配字段未登记：${filter.field}`, 'warning');
        if (actual && field && field.valueType !== 'scalar' && actual !== field.valueType && !(actual === 'null' && field.nullable)) report(`字段 ${filter.field} 应为 ${field.valueType}。`);
        if (!['eq', 'ne'].includes(filter.operator) && ((actual && actual !== 'number') || (field && !['number', 'scalar'].includes(field.valueType)))) report('大小比较只支持数字。');
      }
      return;
    }
    if (entry?.publish === false) report(`对话只能等待此事件：${effect.eventType}`);
    Object.entries(effect.payload ?? {}).forEach(([key, value]) => {
      if (!key.trim()) report('事件参数名不能为空。');
      const actual = valueType(value), field = entry?.fields.find(field => field.name === key), expected = field?.valueType;
      if (actual && expected && expected !== 'scalar' && actual !== expected && !(actual === 'null' && field?.nullable)) report(`参数 ${key} 的类型应为 ${expected}。`);
    });
    entry?.fields.forEach(field => { if (node.mode === 'send' && field.required && !Object.hasOwn(effect.payload ?? {}, field.name)) report(`缺少必需参数：${field.name}`); });
    });
  }
  if (node.kind === 'action') validateDungeonMapAction(node.action).forEach(message => report(message));
  return issues;
};

const symbols = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' };
export const summarizeDialogueCondition = (condition?: DialogueCondition): string => {
  if (!condition) return '始终可用';
  if (condition.type === 'all' || condition.type === 'any') return `满足${condition.type === 'all' ? '全部' : '任一'} ${condition.conditions.length} 个条件`;
  if (condition.type !== 'compare') return '';
  const label = (value: DialogueValue) => value.type === 'literal' ? JSON.stringify(value.value) : [value.key, ...value.path].join('.');
  return `${label(condition.left)} ${symbols[condition.operator]} ${label(condition.right)}`;
};
