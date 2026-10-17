import type { Layout, LayoutItem } from 'react-grid-layout';
import type { PanelSettings } from './panelSettings.ts';
import { workspaceWindows, type PanelTabs } from './tabs.ts';
export type WorkspaceLayout = { items: LayoutItem[]; hidden: string[]; locked: boolean; tabs?: PanelTabs; panelSettings?: PanelSettings };
export function displayItems(data: WorkspaceLayout, scale: number, narrow: boolean, minimum: { w: number; h: number; maxH: number }): LayoutItem[] {
  let y = 0;
  const items = workspaceWindows(data).map(window => window.item);
  if (narrow) return [...items].sort((a, b) => a.y - b.y || a.x - b.x).map(item => { const next = { ...item, x: 0, y, w: 1, minW: 1 }; y += item.h; return next; });
  return items.map(item => ({ ...item, x: item.x * scale, y: item.y * scale, w: item.w * scale, h: item.h * scale, minW: minimum.w * scale, minH: minimum.h * scale, maxH: minimum.maxH * scale }));
}
export function mergeItems<T extends WorkspaceLayout>(data: T, visible: Layout, scale: number, narrow: boolean): T {
  if (narrow || data.locked) return data;
  const changes = new Map(visible.map(item => [item.i, item]));
  const owners = new Set(workspaceWindows(data).map(window => window.item.i));
  return { ...data, items: data.items.map(item => { const next = changes.get(item.i); return !owners.has(item.i) || !next ? item : { ...item, x: next.x / scale, y: next.y / scale, w: next.w / scale, h: next.h / scale }; }) };
}
export function overlaps(a: LayoutItem, b: LayoutItem): boolean { return a.i !== b.i && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
export function downloadLayout(data: unknown, filename: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
