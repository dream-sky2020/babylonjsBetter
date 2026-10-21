import { UiDefinitionRegistry } from '../uiDefinition.registry';
import type { UiDefinition, UiPropertyField } from '../uiDocument.types';
import { uiBasicReactComponents } from '../UiDocumentView';
import { UiDialogueComponent, UiGroupComponent } from './UiDialogueComponents';

/** React code and editable metadata are registered together. No drawing adapter is required. */
export function registerReactUiComponent(registry: UiDefinitionRegistry, definition: Omit<UiDefinition, 'render' | 'hitTest'> & { component: NonNullable<UiDefinition['component']> }) {
  registry.register(definition);
}

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

export function createReactUiDefinitionRegistry(): UiDefinitionRegistry {
  const registry = new UiDefinitionRegistry();
  for (const type of ['panel', 'label', 'button', 'resource-bar'] as const) {
    registerReactUiComponent(registry, {
      type, version: 1, category: '通用 UI', label: { panel: '面板', label: '文本标签', button: '按钮', 'resource-bar': '资源条' }[type],
      component: uiBasicReactComponents[type], defaultSize: type === 'panel' ? { width: 360, height: 240 } : { width: 240, height: 48 },
      createDefaultProps: () => ({ ...basicDefaults }), normalizeProps: normalizeWith(basicDefaults),
      fields: [
        { path: 'content', label: '显示文字', control: 'text', group: '内容' },
        ...(type === 'button' ? [{ path: 'action', label: '预览动作', control: 'text' as const, group: '事件' }] : []),
        ...(type === 'resource-bar' ? [{ path: 'value', label: '当前值', control: 'number' as const, group: '数值', min: 0 }, { path: 'maximum', label: '上限', control: 'number' as const, group: '数值', min: 1 }] : []),
        ...appearanceFields,
      ],
    });
  }
  const presets = [
    { type: 'dialogue-box', label: '对话框', size: { width: 760, height: 190 }, defaults: { fill: '#101625', cornerRadius: 26, fontSize: 34 } },
    { type: 'portrait', label: '头像', size: { width: 390, height: 560 }, defaults: { fill: '#243a55', accent: '#68d5c3', cornerRadius: 28, fontSize: 112 } },
    { type: 'nameplate', label: '姓名牌', size: { width: 226, height: 68 } },
    { type: 'text', label: '文字', size: { width: 360, height: 60 } },
    { type: 'icon', label: '图标', size: { width: 48, height: 48 }, defaults: { cornerRadius: 21, fontSize: 20 } },
  ];
  for (const preset of presets) {
    registerReactUiComponent(registry, {
      type: preset.type, version: 1, category: '对话 UI', label: preset.label, component: UiDialogueComponent, defaultSize: preset.size,
      createDefaultProps: () => ({ ...dialogueDefaults, ...preset.defaults }), normalizeProps: normalizeWith(dialogueDefaults),
      fields: [{ path: 'content', label: '显示内容', control: 'textarea', group: '内容' },
        ...(preset.type === 'icon' ? [{ path: 'icon', label: '图标', control: 'select' as const, group: '内容', options: ['continue', 'auto', 'voice', 'skip', 'log'].map(value => ({ value, label: value })) }] : []),
        ...appearanceFields],
    });
  }
  registerReactUiComponent(registry, { type: 'group', version: 1, category: '布局', label: '容器', description: '组织子节点与相对布局。', component: UiGroupComponent, defaultSize: { width: 320, height: 180 }, fields: [], createDefaultProps: () => ({}), normalizeProps: () => ({}) });
  return registry;
}
