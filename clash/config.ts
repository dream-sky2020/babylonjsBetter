export interface TriggerTimingOption {
  value: string;
  label: string;
}

export interface SkillEffectOption {
  value: string;
  label: string;
  params: string[];
}

export interface DiceTagOption {
  value: string;
  label: string;
}

export interface StatusTypeOption {
  id: string;
  label: string;
}

export interface DiceEffectOption {
  value: string;
  label: string;
  type: 'single' | 'status';
}

// ==========================================
// 常量配置数据
// ==========================================

export const TRIGGER_TIMINGS: TriggerTimingOption[] = [
  { value: 'onBeforeClash', label: '拼点前' },
  { value: 'onClashWin', label: '拼点胜利时' },
  { value: 'onBeforeHit', label: '命中前' },
  { value: 'onHit', label: '命中时' },
  { value: 'onAfterHit', label: '伤害计算后' },
];

export const SKILL_EFFECTS: SkillEffectOption[] = [
  { value: 'dmg', label: '追加伤害', params: ['value'] },
  { value: 'applyStatus', label: '赋予状态', params: ['statusId', 'power', 'stack'] },
  { value: 'heal', label: '恢复生命', params: ['value'] },
];

export const DICE_TAGS: DiceTagOption[] = [
  { value: 'slash', label: '斩击' },
  { value: 'pierce', label: '突刺' },
  { value: 'blunt', label: '打击' },
  { value: 'guard', label: '防御' },
  { value: 'evade', label: '闪避' },
];

export const STATUS_TYPES: StatusTypeOption[] = [
  { id: 'bleed', label: '流血' },
  { id: 'burn', label: '烧伤' },
  { id: 'rupture', label: '破裂' },
  { id: 'sinking', label: '沉沦' },
  { id: 'tremor', label: '震颤' },
  { id: 'charge', label: '充能' },
  { id: 'bind', label: '束缚' },
  { id: 'strength', label: '强壮' },
  { id: 'frailty', label: '虚弱' },
  { id: 'agility', label: '迅捷' },
  { id: 'fragile', label: '脆弱' },
  { id: 'protection', label: '守护' },
  { id: 'confusion', label: '混乱' },
];

export const DICE_EFFECTS: DiceEffectOption[] = [
  { value: 'dmg', label: '追加伤害', type: 'single' },
  { value: 'applyStatus', label: '赋予状态', type: 'status' },
];