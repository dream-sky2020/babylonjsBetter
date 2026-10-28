import type { UiDefinition, UiPropertyField } from '../../ui-document/uiDocument.types';
export type UiPrefabMetadata = Omit<UiDefinition, 'component' | 'render' | 'hitTest'>;
const basicDefaults = { content: '', fill: '#162337', stroke: '#30465c', textColor: '#e9f0f7', accent: '#71cdb5', fontSize: 20, cornerRadius: 8, strokeWidth: 1, value: 70, maximum: 100, action: '' };
const dialogueDefaults = { content: '', fill: '#121a2d', stroke: '#7dd3fc', textColor: '#f8fafc', accent: '#f5c96a', fontSize: 30, cornerRadius: 20, strokeWidth: 3, icon: 'continue' };
const normalizeWith = (defaults: Record<string, unknown>) => (raw: unknown): Record<string, unknown> => {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof value[key] === typeof fallback && (typeof fallback !== 'number' || Number.isFinite(value[key])) ? value[key] : fallback]));
};
const appearanceFields: UiPropertyField[] = [
  ...(['fill', 'stroke', 'textColor', 'accent'] as const).map(path => ({ path, label: { fill: '背景', stroke: '描边', textColor: '文字颜色', accent: '强调颜色' }[path], control: 'color' as const, group: '外观' })),
  ...(['fontSize', 'cornerRadius', 'strokeWidth'] as const).map(path => ({ path, label: { fontSize: '字号', cornerRadius: '圆角', strokeWidth: '描边宽度' }[path], control: 'number' as const, group: '外观', min: path === 'fontSize' ? 8 : 0 })),
];
export function basicUiMetadata(type: 'panel' | 'label' | 'button' | 'resource-bar'): UiPrefabMetadata {
  return {
    type, version: 1, category: '基础', label: { panel: '面板', label: '文本标签', button: '按钮', 'resource-bar': '资源条' }[type],
    defaultSize: type === 'panel' ? { width: 360, height: 240 } : { width: 240, height: 48 },
    createDefaultProps: () => ({ ...basicDefaults }), normalizeProps: normalizeWith(basicDefaults),
    bindableFields: [
      ...(type !== 'panel' ? [{ key: 'text', label: '显示文字', propertyPath: 'content', valueType: 'string' as const }] : []),
      ...(type !== 'label' ? [{ key: 'fill', label: '背景', propertyPath: 'fill', valueType: 'string' as const }] : []),
      ...(type === 'button' ? [{ key: 'action', label: '按钮动作', propertyPath: 'action', valueType: 'string' as const }] : []),
      ...(type === 'resource-bar' ? [{ key: 'value', label: '当前值', propertyPath: 'value', valueType: 'number' as const }, { key: 'maximum', label: '上限', propertyPath: 'maximum', valueType: 'number' as const }] : []),
    ],
    fields: [{ path: 'content', label: '显示文字', control: 'text', group: '内容' },
      ...(type === 'button' ? [{ path: 'action', label: '预览动作', control: 'text' as const, group: '事件' }] : []),
      ...(type === 'resource-bar' ? [{ path: 'value', label: '当前值', control: 'number' as const, group: '数值', min: 0 }, { path: 'maximum', label: '上限', control: 'number' as const, group: '数值', min: 1 }] : []), ...appearanceFields],
  };
}
export function dialogueUiMetadata(type: string, label: string, defaultSize: { width: number; height: number }, defaults: Record<string, unknown> = {}): UiPrefabMetadata {
  return { type, label, version: 1, category: '对话', defaultSize,
    createDefaultProps: () => ({ ...dialogueDefaults, ...defaults }), normalizeProps: normalizeWith(dialogueDefaults),
    bindableFields: [{ key: 'text', label: '显示内容', propertyPath: 'content', valueType: 'string' }],
    fields: [{ path: 'content', label: '显示内容', control: 'textarea', group: '内容' },
      ...(type === 'icon' ? [{ path: 'icon', label: '图标', control: 'select' as const, group: '内容', options: ['continue', 'auto', 'voice', 'skip', 'log'].map(value => ({ value, label: value })) }] : []), ...appearanceFields] };
}
