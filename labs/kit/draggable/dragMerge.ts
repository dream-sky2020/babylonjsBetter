import type { WorkspaceLayout } from './layout.ts';
import { combinePanels, workspaceWindows } from './tabs.ts';
export type MergeZone = { id: string; x: number; y: number; width: number; height: number; windowHeight: number; rank: number };
export function mergeTarget(zones: MergeZone[], source: string, point: { x: number; y: number }): MergeZone | undefined {
  return [...zones].filter(zone => zone.id !== source && point.x >= zone.x && point.x <= zone.x + zone.width && point.y >= zone.y && point.y <= zone.y + zone.height).sort((a, b) => b.rank - a.rank)[0];
}
export function mergeByDragging<T extends WorkspaceLayout>(data: T, source: string, target: string): T {
  if (data.locked || !data.tabs?.enabled || !data.tabs.dragMerge) return data;
  const windows = workspaceWindows(data); const dragged = windows.find(window => window.item.i === source); const destination = windows.find(window => window.item.i === target);
  if (!dragged || !destination || source === target) return data;
  const tabs = combinePanels(data, target, source);
  return { ...data, tabs: { ...tabs, groups: tabs.groups.map(group => group.panels.includes(source) ? { ...group, active: dragged.active } : group) } };
}
