import type { DialogueCondition, DialogueEffect, DialogueOutputPort, DialogueRuleCatalog, DialogueScalar, DialogueValue } from './dialogueMap.types.ts';

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
  if (typeof value === 'string') return { type: 'legacy', expression: value };
  const raw = object(value);
  if (raw.type === 'legacy') return { type: 'legacy', expression: string(raw.expression) };
  if (raw.type === 'compare' && ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(raw.operator as string)) return {
    type: 'compare', left: parseDialogueValue(raw.left), operator: raw.operator as Extract<DialogueCondition, { type: 'compare' }>['operator'], right: parseDialogueValue(raw.right),
  };
  if ((raw.type === 'all' || raw.type === 'any') && Array.isArray(raw.conditions)) return { type: raw.type, conditions: raw.conditions.map(item => parseDialogueCondition(item, depth + 1)) };
  if (raw.type === 'not') return { type: 'not', condition: parseDialogueCondition(raw.condition, depth + 1) };
  throw new Error('不支持的对话条件。');
};
export const parseDialogueEffect = (value: unknown): DialogueEffect => {
  if (typeof value === 'string') return { type: 'legacy', event: value };
  const raw = object(value);
  if (raw.type === 'legacy') return { type: 'legacy', event: string(raw.event) };
  if (raw.type === 'event' && typeof raw.version === 'number') return {
    type: 'event', eventType: string(raw.eventType), version: raw.version,
    ...(raw.payload === undefined ? {} : { payload: Object.fromEntries(Object.entries(object(raw.payload)).map(([key, item]) => [key, parseDialogueValue(item)])) }),
  };
  throw new Error('不支持的对话效果。');
};

export type DialogueRuleIssue = { severity: 'error' | 'warning'; message: string };
export const validateDialogueOutputRules = (port: DialogueOutputPort, catalog?: DialogueRuleCatalog): DialogueRuleIssue[] => {
  const issues: DialogueRuleIssue[] = [];
  const report = (message: string, severity: 'error' | 'warning' = 'error') => issues.push({ message, severity });
  const valueType = (value: DialogueValue): string | undefined => {
    if (value.type === 'literal') {
      if (typeof value.value === 'number' && !Number.isFinite(value.value)) report('常量必须为有限数值。');
      return value.value === null ? 'null' : typeof value.value;
    }
    if (!value.key.trim() || !value.path.length || value.path.some(item => !item.trim())) { report('共享内存 Key 和字段路径不能为空。'); return undefined; }
    const field = catalog?.memories.find(item => item.key === value.key)?.fields.find(item => JSON.stringify(item.path) === JSON.stringify(value.path));
    if (catalog && !field) report(`共享内存字段未登记：${value.key}.${value.path.join('.')}`, 'warning');
    return field?.valueType;
  };
  const condition = (item: DialogueCondition, depth = 0): void => {
    if (depth > 32) { report('条件嵌套不能超过 32 层。'); return; }
    if (item.type === 'legacy') { report('旧版条件尚未转换，将原样保存。', 'warning'); return; }
    if (item.type === 'not') { condition(item.condition, depth + 1); return; }
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
  if (port.activation.type === 'event') event(port.activation.eventType, port.activation.version);
  if (port.activation.type === 'auto' && port.activation.priority !== undefined && !Number.isFinite(port.activation.priority)) report('优先级必须为有限数值。');
  if (port.condition) condition(port.condition);
  port.effects?.forEach(effect => {
    if (effect.type === 'legacy') { report('旧版效果尚未转换，将原样保存。', 'warning'); return; }
    const entry = event(effect.eventType, effect.version);
    Object.entries(effect.payload ?? {}).forEach(([key, value]) => {
      if (!key.trim()) report('事件参数名不能为空。');
      const actual = valueType(value), field = entry?.fields.find(field => field.name === key), expected = field?.valueType;
      if (actual && expected && actual !== expected && !(actual === 'null' && field?.nullable)) report(`参数 ${key} 的类型应为 ${expected}。`);
    });
    entry?.fields.forEach(field => { if (field.required && !Object.hasOwn(effect.payload ?? {}, field.name)) report(`缺少必需参数：${field.name}`); });
  });
  return issues;
};

const symbols = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' };
export const summarizeDialogueCondition = (condition?: DialogueCondition): string => {
  if (!condition) return '始终可用';
  if (condition.type === 'legacy') return '旧版条件';
  if (condition.type === 'not') return '条件取反';
  if (condition.type === 'all' || condition.type === 'any') return `满足${condition.type === 'all' ? '全部' : '任一'} ${condition.conditions.length} 个条件`;
  if (condition.type !== 'compare') return '';
  const label = (value: DialogueValue) => value.type === 'literal' ? JSON.stringify(value.value) : value.path.join('.');
  return `${label(condition.left)} ${symbols[condition.operator]} ${label(condition.right)}`;
};
