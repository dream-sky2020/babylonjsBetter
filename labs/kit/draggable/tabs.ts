import type { LayoutItem } from 'react-grid-layout';
export type TabGroup = { panels: string[]; active: string };
export type PanelTabs = { enabled: boolean; groups: TabGroup[]; dragMerge?: boolean };
type TabWorkspace = { items: LayoutItem[]; hidden: string[]; tabs?: PanelTabs };
export function parsePanelTabs(value: unknown, ids: string[]): PanelTabs | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') throw new Error('面板标签设置无效。');
  const tabs = value as PanelTabs; const used = new Set<string>();
  if (typeof tabs.enabled !== 'boolean' || !Array.isArray(tabs.groups) || tabs.groups.length > ids.length / 2) throw new Error('面板标签设置无效。');
  if (tabs.dragMerge !== undefined && typeof tabs.dragMerge !== 'boolean') throw new Error('拖动合并设置无效。');
  const groups = tabs.groups.map(group => {
    if (!group || !Array.isArray(group.panels) || group.panels.length < 2 || typeof group.active !== 'string' || !group.panels.includes(group.active)) throw new Error('标签组至少包含两个面板，且当前标签必须属于组内。');
    for (const id of group.panels) { if (typeof id !== 'string' || !ids.includes(id) || used.has(id)) throw new Error('标签包含未知或重复面板。'); used.add(id); }
    return { panels: [...group.panels], active: group.active };
  });
  return { enabled: tabs.enabled, groups, ...(tabs.dragMerge === undefined ? {} : { dragMerge: tabs.dragMerge }) };
}
export function panelGroup(data: TabWorkspace, id: string): TabGroup | undefined { return data.tabs?.enabled ? data.tabs.groups.find(group => group.panels.includes(id)) : undefined; }
export function windowOwner(data: TabWorkspace, id: string): string { return panelGroup(data, id)?.panels[0] ?? id; }
export function workspaceWindows(data: TabWorkspace): { item: LayoutItem; panels: string[]; active: string }[] {
  return data.items.flatMap(item => {
    const group = panelGroup(data, item.i);
    if (group && group.panels[0] !== item.i) return [];
    const panels = (group?.panels ?? [item.i]).filter(id => !data.hidden.includes(id));
    if (!panels.length) return [];
    return [{ item, panels, active: group && panels.includes(group.active) ? group.active : panels[0] }];
  });
}
export function combinePanels(data: TabWorkspace, source: string, target: string): PanelTabs {
  const ids = data.items.map(item => item.i);
  if (source === target || !ids.includes(source) || !ids.includes(target)) throw new Error('请选择两个不同的面板。');
  const tabs = data.tabs ?? { enabled: true, groups: [] };
  const first = tabs.groups.find(group => group.panels.includes(source)); const second = tabs.groups.find(group => group.panels.includes(target));
  if (first && first === second) throw new Error('这两个面板已在同一标签组内。');
  return parsePanelTabs({ ...tabs, enabled: true, groups: [...tabs.groups.filter(group => group !== first && group !== second), { panels: [...(first?.panels ?? [source]), ...(second?.panels ?? [target])], active: source }] }, ids)!;
}
