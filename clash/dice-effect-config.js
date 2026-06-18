// dice-effect-config.js

// 所有的状态类型提取到外部
export const STATUS_TYPES = [
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
    { id: 'confusion', label: '混乱' }
];

// 硬币效果分类
// 通过 type 区分是“单数值(single)”还是“状态类多参数(status)”
export const DICE_EFFECTS = [
    { value: 'dmg', label: '追加伤害', type: 'single' },
    { value: 'applyStatus', label: '赋予状态', type: 'status' }
];