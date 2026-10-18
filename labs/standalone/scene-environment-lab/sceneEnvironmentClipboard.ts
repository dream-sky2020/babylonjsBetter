import type { SceneEnvironmentLight, SceneEnvironmentModel, SceneEnvironmentObject, SceneEnvironmentPreset, SceneEnvironmentTransformNode } from '@/core/scene/sceneEnvironment.types';
import { environmentNodeEntries, normalizeEnvironmentOrder, orderedEnvironmentEntries } from '../../../core/scene/sceneEnvironment.hierarchy.ts';

export type EnvironmentObjectClipboard = {
  roots: string[];
  transformNodes: SceneEnvironmentTransformNode[];
  objects: SceneEnvironmentObject[];
  models: SceneEnvironmentModel[];
  lights: SceneEnvironmentLight[];
};

const emptyClipboard = (): EnvironmentObjectClipboard => ({ roots: [], transformNodes: [], objects: [], models: [], lights: [] });

export function copyEnvironmentSelection(preset: SceneEnvironmentPreset, selectedIds: readonly string[]): EnvironmentObjectClipboard {
  const entries = orderedEnvironmentEntries(preset);
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const selected = new Set(selectedIds.filter(id => byId.has(id)));
  const roots = entries.filter(entry => {
    if (!selected.has(entry.id)) return false;
    let parent = entry.definition.parentId;
    while (parent) {
      if (selected.has(parent)) return false;
      parent = byId.get(parent)?.definition.parentId;
    }
    return true;
  }).map(entry => entry.id);
  const included = new Set(roots);
  for (let changed = true; changed;) {
    changed = false;
    for (const entry of entries) if (entry.definition.parentId && included.has(entry.definition.parentId) && !included.has(entry.id)) {
      included.add(entry.id); changed = true;
    }
  }
  const result = emptyClipboard();
  result.roots = roots;
  for (const entry of entries) {
    if (!included.has(entry.id)) continue;
    const copy = structuredClone(entry.definition);
    if (entry.id.startsWith('transform:')) result.transformNodes.push(copy as SceneEnvironmentTransformNode);
    else if (entry.id.startsWith('object:')) result.objects.push(copy as SceneEnvironmentObject);
    else if (entry.id.startsWith('model:')) result.models.push(copy as SceneEnvironmentModel);
    else result.lights.push(copy as SceneEnvironmentLight);
  }
  return result;
}

export function deleteEnvironmentSelection(preset: SceneEnvironmentPreset, selectedIds: readonly string[]): SceneEnvironmentPreset {
  const snapshot = copyEnvironmentSelection(preset, selectedIds);
  const removed = new Set([...snapshot.transformNodes, ...snapshot.objects, ...snapshot.models, ...snapshot.lights].map(item => item.id));
  if (!removed.size) return preset;
  return {
    ...preset,
    transformNodes: preset.transformNodes?.filter(item => !removed.has(item.id)),
    objects: preset.objects.filter(item => !removed.has(item.id)),
    models: preset.models.filter(item => !removed.has(item.id)),
    lights: preset.lights.filter(item => !removed.has(item.id)),
  };
}

export function pasteEnvironmentSelection(preset: SceneEnvironmentPreset, clipboard: EnvironmentObjectClipboard, parentId: string | null, preserveIds = false): { preset: SceneEnvironmentPreset; selectedIds: string[] } {
  if (!clipboard.roots.length) return { preset, selectedIds: [] };
  const next = normalizeEnvironmentOrder(preset);
  const existing = new Set(environmentNodeEntries(next).map(entry => entry.definition.id));
  const pasted = [
    ...clipboard.transformNodes.map(definition => ({ id: `transform:${definition.id}`, definition })),
    ...clipboard.objects.map(definition => ({ id: `object:${definition.id}`, definition })),
    ...clipboard.models.map(definition => ({ id: `model:${definition.id}`, definition })),
    ...clipboard.lights.map(definition => ({ id: `light:${definition.id}`, definition })),
  ].sort((left, right) => (left.definition.order ?? 0) - (right.definition.order ?? 0));
  const idMap = new Map<string, string>();
  for (const { id, definition } of pasted) {
    let newId = definition.id;
    if (!preserveIds || existing.has(newId)) {
      let index = 1;
      while (existing.has(`${definition.id}-copy-${index}`)) index++;
      newId = `${definition.id}-copy-${index}`;
    }
    existing.add(newId);
    idMap.set(id, `${id.split(':')[0]}:${newId}`);
  }
  const rootSet = new Set(clipboard.roots);
  const counters = new Map<string | null, number>();
  for (const entry of environmentNodeEntries(next)) {
    const parent = entry.definition.parentId ?? null;
    counters.set(parent, Math.max(counters.get(parent) ?? 0, (entry.definition.order ?? 0) + 1));
  }
  const newOrders = new Map<string, number>();
  for (const entry of pasted) {
    const parent = rootSet.has(entry.id) ? parentId : idMap.get(entry.definition.parentId ?? '') ?? parentId;
    const order = counters.get(parent) ?? 0;
    counters.set(parent, order + 1);
    newOrders.set(entry.id, order);
  }
  const clone = <T extends SceneEnvironmentTransformNode | SceneEnvironmentObject | SceneEnvironmentModel | SceneEnvironmentLight>(kind: string, source: T): T => {
    const oldId = `${kind}:${source.id}`;
    const parent = rootSet.has(oldId) ? parentId : idMap.get(source.parentId ?? '') ?? parentId;
    return { ...structuredClone(source), id: idMap.get(oldId)!.split(':').slice(1).join(':'), parentId: parent, order: newOrders.get(oldId)!, name: preserveIds ? source.name : `${source.name} 副本` };
  };
  next.transformNodes = [...(next.transformNodes ?? []), ...clipboard.transformNodes.map(item => clone('transform', item))];
  next.objects = [...next.objects, ...clipboard.objects.map(item => clone('object', item))];
  next.models = [...next.models, ...clipboard.models.map(item => clone('model', item))];
  next.lights = [...next.lights, ...clipboard.lights.map(item => clone('light', item))];
  return { preset: next, selectedIds: clipboard.roots.map(id => idMap.get(id)!) };
}
