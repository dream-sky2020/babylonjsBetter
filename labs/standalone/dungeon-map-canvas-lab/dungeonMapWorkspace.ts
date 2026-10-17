import { arrangeDockPanels, validateDockTree, type DockNode } from '../../../core/ui/editor-kit/dockLayout.ts';
export const mapBrowserPanels = ['contents', 'entities', 'components'] as const;
export type MapBrowserPanel = typeof mapBrowserPanels[number];
export const mapBrowserLabels = { contents: '地图内容', entities: '实体', components: '组件' };
export const mapWorkspaceKey = 'dungeon-map-canvas-lab:workspace:v2';
export type MapWorkspacePreferences = {
  left: number; right: number; leftOpen: boolean; rightOpen: boolean;
  visible: Record<MapBrowserPanel, boolean>; collapsed: Partial<Record<MapBrowserPanel, boolean>>; tree: DockNode<MapBrowserPanel>;
};
export const defaultMapWorkspace = (width: number): MapWorkspacePreferences => ({
  left: 320, right: 340, leftOpen: width >= 1000, rightOpen: width >= 720,
  visible: { contents: true, entities: true, components: true }, collapsed: { contents: false, entities: false, components: false }, tree: arrangeDockPanels(mapBrowserPanels, 'y'),
});
export function normalizeMapWorkspace(value: unknown, width: number): MapWorkspacePreferences {
  const result = defaultMapWorkspace(width);
  if (!value || typeof value !== 'object') return result;
  const row = value as Partial<MapWorkspacePreferences>;
  for (const side of ['left', 'right'] as const) if (typeof row[side] === 'number' && Number.isFinite(row[side])) result[side] = Math.max(side === 'left' ? 210 : 280, Math.min(side === 'left' ? 1000 : 480, row[side]));
  for (const side of ['leftOpen', 'rightOpen'] as const) if (typeof row[side] === 'boolean') result[side] = row[side];
  for (const panel of mapBrowserPanels) {
    if (typeof row.visible?.[panel] === 'boolean') result.visible[panel] = row.visible[panel];
    result.collapsed[panel] = row.collapsed?.[panel] === true;
  }
  result.tree = validateDockTree(row.tree, mapBrowserPanels, result.tree);
  return result;
}
export function readMapWorkspace(storage: Pick<Storage, 'getItem'>, width: number): MapWorkspacePreferences {
  try { return normalizeMapWorkspace(JSON.parse(storage.getItem(mapWorkspaceKey) ?? storage.getItem('dungeon-map-canvas-lab:workspace:v1') ?? 'null'), width); }
  catch { return defaultMapWorkspace(width); }
}
