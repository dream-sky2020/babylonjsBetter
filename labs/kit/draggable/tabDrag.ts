import { overlaps, type WorkspaceLayout } from './layout.ts';
import { combinePanels, panelGroup, windowOwner, workspaceWindows } from './tabs.ts';

/** Transfer the group's current rectangle before removing its owning tab. */
export function moveTab<T extends WorkspaceLayout>(data: T, panel: string, position: { x: number; y: number }, target?: string): T {
  const group = panelGroup(data, panel);
  if (data.locked || !data.tabs?.dragMerge || !group || data.hidden.includes(panel) || target === windowOwner(data, panel)) return data;
  if (target && !workspaceWindows(data).some(window => window.item.i === target)) return data;
  const owner = data.items.find(item => item.i === group.panels[0])!;
  const remaining = group.panels.filter(id => id !== panel);
  const groups = data.tabs.groups.flatMap(value => value !== group ? [value] : remaining.length < 2 ? [] : [{ panels: remaining, active: remaining.includes(group.active) ? group.active : remaining[0] }]);
  let next = { ...data, tabs: { ...data.tabs, groups }, items: data.items.map(item => item.i === panel ? { ...item, x: position.x, y: position.y, w: owner.w, h: owner.h } : item.i === remaining[0] ? { ...item, x: owner.x, y: owner.y, w: owner.w, h: owner.h } : item) };
  if (target) {
    const tabs = combinePanels(next, target, panel);
    next = { ...next, tabs: { ...tabs, groups: tabs.groups.map(value => value.panels.includes(panel) ? { ...value, active: panel } : value) } };
  }
  return next;
}

/** Non-overlapping layouts place the detached window below occupied rectangles. */
export function placeTab<T extends WorkspaceLayout>(data: T, panel: string, position: { x: number; y: number }, allowOverlap: boolean): T {
  let next = moveTab(data, panel, position);
  if (next === data || allowOverlap) return next;
  let item = next.items.find(value => value.i === panel)!;
  for (;;) {
    const collisions = workspaceWindows(next).filter(window => overlaps(item, window.item));
    if (!collisions.length) return next;
    const y = Math.max(...collisions.map(window => window.item.y + window.item.h));
    if (y + item.h > 1000) return data;
    item = { ...item, y };
    next = { ...next, items: next.items.map(value => value.i === panel ? item : value) };
  }
}
