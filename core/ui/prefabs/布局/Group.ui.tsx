import { UiGroupComponent } from '../../../ui-document/react/UiDialogueComponents';
import type { UiPrefabMetadata } from '../metadata';
export default function Group() { return <UiGroupComponent />; }
// eslint-disable-next-line react-refresh/only-export-components
export const ui: UiPrefabMetadata = { type: 'group', version: 1, category: '布局', label: '容器', description: '组织子节点与相对布局。', defaultSize: { width: 320, height: 180 }, fields: [], createDefaultProps: () => ({}), normalizeProps: () => ({}) };
