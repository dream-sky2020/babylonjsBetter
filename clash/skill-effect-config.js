// skill-effect-config.js
export const TRIGGER_TIMINGS = [
    { value: 'onBeforeClash', label: '拼点前' },
    { value: 'onClashWin',    label: '拼点胜利时' },
    { value: 'onBeforeHit',   label: '命中前' },
    { value: 'onHit',         label: '命中时' },
    { value: 'onAfterHit',    label: '伤害计算后' }
];

export const SKILL_EFFECTS = [
    { value: 'dmg', label: '追加伤害', params: ['value'] },
    { value: 'applyStatus', label: '赋予状态', params: ['statusId', 'power', 'stack'] },
    { value: 'heal', label: '恢复生命', params: ['value'] }
];

// 引入你之前定义的状态列表供下拉选择
import { STATUS_TYPES } from './dice-effect-config.js';
export { STATUS_TYPES };