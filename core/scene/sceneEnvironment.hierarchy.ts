import type { SceneEnvironmentPreset } from './sceneEnvironment.types.ts';

/** The declaration is authoritative; Babylon helper/asset nodes never enter this graph. */
export function environmentNodeEntries(preset: SceneEnvironmentPreset) {
  return [
    ...(preset.transformNodes ?? []).map(definition => ({ id: `transform:${definition.id}`, definition })),
    ...preset.objects.map(definition => ({ id: `object:${definition.id}`, definition })),
    ...preset.models.map(definition => ({ id: `model:${definition.id}`, definition })),
    ...preset.lights.map(definition => ({ id: `light:${definition.id}`, definition })),
  ];
}

/** Shared ordering for the tree, drop placement and new children. */
export function orderedEnvironmentEntries(preset: SceneEnvironmentPreset) {
  return environmentNodeEntries(preset).map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => (a.definition.order ?? a.index) - (b.definition.order ?? b.index));
}

export function environmentAppendOrder(preset: SceneEnvironmentPreset, parentId: string | null): number {
  // Adding to an earlier typed array can shift legacy fallback indices by one.
  const siblings = orderedEnvironmentEntries(preset).filter(entry => (entry.definition.parentId ?? null) === parentId);
  return Math.max(-1, ...siblings.map(entry => entry.definition.order ?? entry.index + 1)) + 1;
}

/** Materialize legacy fallback order before inserting into one of the typed arrays. */
export function normalizeEnvironmentOrder(preset: SceneEnvironmentPreset): SceneEnvironmentPreset {
  const next = structuredClone(preset);
  const counters = new Map<string | null, number>();
  for (const entry of orderedEnvironmentEntries(next)) {
    const parent = entry.definition.parentId ?? null;
    const order = counters.get(parent) ?? 0;
    entry.definition.order = order;
    counters.set(parent, order + 1);
  }
  return next;
}

export function validateEnvironmentHierarchy(preset: SceneEnvironmentPreset): void {
  const entries = environmentNodeEntries(preset);
  const byId = new Map(entries.map(entry => [entry.id, entry.definition]));
  const ids = new Set<string>();
  for (const { definition } of entries) {
    if (ids.has(definition.id)) throw new Error(`存在重复节点 ID：${definition.id}`);
    ids.add(definition.id);
  }
  for (const { id, definition } of entries) {
    const parent = definition.parentId;
    if (parent && (!byId.has(parent) || parent.startsWith('light:'))) throw new Error(`${id} 的父节点不存在或不能包含子节点：${parent}`);
  }
  const visited = new Set<string>();
  for (const { id } of entries) {
    const path = new Set<string>();
    let cursor: string | null | undefined = id;
    while (cursor && !visited.has(cursor)) {
      if (path.has(cursor)) throw new Error(`父子节点存在循环：${[...path, cursor].join(' → ')}`);
      path.add(cursor);
      cursor = byId.get(cursor)?.parentId;
    }
    path.forEach(node => visited.add(node));
  }
}

export function environmentParentCandidates(preset: SceneEnvironmentPreset, id: string) {
  const entries = environmentNodeEntries(preset);
  const excluded = new Set([id]);
  // Visit adjacency once, independent of declaration order.
  const children = new Map<string, string[]>();
  for (const entry of entries) if (entry.definition.parentId) {
    const parent = entry.definition.parentId;
    children.set(parent, [...(children.get(parent) ?? []), entry.id]);
  }
  const queue = [id];
  for (let i = 0; i < queue.length; i++) for (const child of children.get(queue[i]) ?? []) {
    if (!excluded.has(child)) { excluded.add(child); queue.push(child); }
  }
  return entries.filter(entry => !excluded.has(entry.id) && !entry.id.startsWith('light:'));
}
