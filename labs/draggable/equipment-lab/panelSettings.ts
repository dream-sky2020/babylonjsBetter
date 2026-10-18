import type { PanelSettingsRegistry } from '../../kit/draggable/panelSettings.ts';
export const commandDirections = [{ label: '优先水平排列', value: 'horizontal' }, { label: '优先垂直排列', value: 'vertical-first' }, { label: '水平排列', value: 'horizontal-nowrap' }, { label: '垂直排列', value: 'vertical' }] as const;
export type CommandDirection = typeof commandDirections[number]['value'];
export const equipmentDirections = [{ label: '按内容列数排列', value: 'grid' }, { label: '水平排列', value: 'horizontal-nowrap' }, { label: '垂直排列', value: 'vertical' }] as const;
export type PanelDirection = CommandDirection | 'grid';
export const characterViews = [{ label: '属性版', value: 'attributes' }, { label: '解释版', value: 'explanations' }] as const;
export type CharacterView = typeof characterViews[number]['value'];
const columns = [{ key: 'columns', label: '内容列数', type: 'select' as const, default: 1, options: [1,2,3,4].map(value => ({ label: `${value} 列`, value })) }];
export const equipmentPanelSettings: PanelSettingsRegistry = { inventory: columns, equipment: [...columns, { key: 'direction', label: '排列方式', type: 'select', default: 'grid', options: equipmentDirections }], skills: [...columns, { key: 'direction', label: '排列方式', type: 'select', default: 'grid', options: equipmentDirections }], character: [{ ...columns[0], key: 'statsColumns', label: '属性列数' }, { key: 'characterView', label: '显示版本', type: 'select', default: 'attributes', options: characterViews }], commands: [{ key: 'direction', label: '排列方式', type: 'select', default: 'horizontal', options: commandDirections }] };
