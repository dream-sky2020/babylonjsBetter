import type { Node } from '@babylonjs/core';
import type { SceneEditorObject } from './types.ts';
/** Optional imported-node browsing. Paths are scoped under the stable domain owner, never uniqueId. */
export function withReadOnlyDescendants(objects: SceneEditorObject[]): SceneEditorObject[] {
  const registered = new Set(objects.map(o => o.node)); const result = [...objects];
  const visit = (node: Node, parentId: string) => {
    const counts = new Map<string, number>();
    for (const child of node.getChildren()) {
      if (registered.has(child) || child.name.startsWith('editor:') || child.name.includes('debug')) continue;
      const name = encodeURIComponent(child.id || child.name); const index = counts.get(name) ?? 0; counts.set(name, index + 1);
      const id = `${parentId}/render:${name}:${index}`;
      result.push({ id, parentId, name: child.name, node: child, channels: [], readonly: true });
      visit(child, id);
    }
  };
  objects.filter(o => !o.readonly).forEach(o => visit(o.node, o.id));
  return result;
}
