import type { ComponentType } from 'react';
import type { UiReactComponentProps } from '../../ui-document/uiDocument.types';
import type { UiPrefabMetadata } from './metadata';

export type UiPrefab = { source: string; definition: UiPrefabMetadata & { component: ComponentType<UiReactComponentProps> } };
type PrefabModule = { default: ComponentType<UiReactComponentProps>; ui: UiPrefabMetadata };
// Folder paths, not category metadata or a hand-written list, define the add-menu hierarchy.
const modules = import.meta.glob<PrefabModule>('./**/*.ui.tsx', { eager: true });
const types = new Set<string>();
export const reactUiPrefabs: UiPrefab[] = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b)).map(([source, module]) => {
  if (!module.default || !module.ui?.type || !module.ui.label || !module.ui.fields || !module.ui.createDefaultProps || !module.ui.normalizeProps) throw new Error(`UI 预制件缺少默认 React 组件或 ui 元数据：${source}`);
  if (types.has(module.ui.type)) throw new Error(`UI 预制件类型重复：${module.ui.type}`);
  types.add(module.ui.type);
  return { source: source.replace(/^\.\//, ''), definition: { ...module.ui, component: module.default } };
});
