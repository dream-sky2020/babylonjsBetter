import type { PanelSettingsRegistry } from '../../kit/draggable/panelSettings.ts';
export const warehousePanelSettings: PanelSettingsRegistry = { warehouse: [{ key: 'columns', label: '内容列数', type: 'select', default: 1, options: [1, 2, 3, 4].map(value => ({ label: `${value} 列`, value })) }] };
