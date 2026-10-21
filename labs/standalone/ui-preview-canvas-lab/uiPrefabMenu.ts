import type { CommandMenuEntry } from '../../../core/ui/menu/commandMenu.ts';

export type UiPrefabMenuSource<T> = { source: string; definition: T & { type: string; label: string } };
/** Every directory becomes a submenu; a leaf inserts its corresponding React prefab. */
export function buildUiPrefabMenu<T extends { type: string; label: string }>(prefabs: readonly UiPrefabMenuSource<T>[], onPick: (definition: T) => void): CommandMenuEntry[] {
  type Branch = { folders: Map<string, Branch>; items: UiPrefabMenuSource<T>[] };
  const root: Branch = { folders: new Map(), items: [] };
  for (const prefab of prefabs) {
    const parts = prefab.source.replace(/\\/g, '/').split('/').filter(Boolean);
    let branch = root;
    for (const part of parts.slice(0, -1)) {
      if (!branch.folders.has(part)) branch.folders.set(part, { folders: new Map(), items: [] });
      branch = branch.folders.get(part)!;
    }
    branch.items.push(prefab);
  }
  const visit = (branch: Branch, prefix: string): CommandMenuEntry[] => [
    ...[...branch.folders].sort(([a], [b]) => a.localeCompare(b)).map(([label, child]) => ({ id: `ui-prefab-folder:${prefix}${label}`, label, children: visit(child, `${prefix}${label}/`) })),
    ...branch.items.sort((a, b) => a.definition.label.localeCompare(b.definition.label)).map(({ definition }) => ({ id: `ui-prefab:${definition.type}`, label: definition.label, action: () => onPick(definition) })),
  ];
  return visit(root, '');
}
