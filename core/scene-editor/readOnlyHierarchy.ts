import type { Node } from '@babylonjs/core';
import type { SceneEditorObject } from './types.ts';
/** Optional imported-node browsing. Paths are scoped under the stable domain owner, never uniqueId. */
export function withReadOnlyDescendants(objects: SceneEditorObject[], options: { rootIds?: ReadonlySet<string>; pathKey?: (node: Node) => string; transparentNodes?: ReadonlySet<Node> } = {}): SceneEditorObject[] {
  const registered = new Set(objects.map(o => o.node)); const result = [...objects];
  const visit = (node: Node, parentId: string, counts = new Map<string, number>()) => {
    for (const child of node.getChildren()) {
      if (registered.has(child) || child.name.startsWith('editor:') || child.name.includes('debug')) continue;
      // Internal property carriers are not objects in the authoring hierarchy.
      if (options.transparentNodes?.has(child)) { visit(child, parentId, counts); continue; }
      const name = encodeURIComponent(options.pathKey?.(child) ?? (child.id || child.name)); const index = counts.get(name) ?? 0; counts.set(name, index + 1);
      const id = `${parentId}/render:${name}:${index}`;
      result.push({ id, parentId, name: child.name, node: child, channels: [], readonly: true, draggable: false, acceptsChildren: false });
      visit(child, id);
    }
  };
  objects.filter(o => !o.readonly && (!options.rootIds || options.rootIds.has(o.id))).forEach(o => visit(o.node, o.id));
  return result;
}
