import type { CommandMenuEntry } from '@/core/ui/menu';

type Directory = { folders: Map<string, Directory>; files: Map<string, string> };
const directory = (): Directory => ({ folders: new Map(), files: new Map() });
const displayName = (segment: string): string => {
  try { return decodeURIComponent(segment); } catch { return segment; }
};
const compareNames = (left: string, right: string): number =>
  displayName(left).localeCompare(displayName(right), 'zh-CN', { numeric: true, sensitivity: 'base' });

/** Keep the file path intact; only compress directory labels shared by every model. */
export function modelAssetMenuEntries(paths: readonly string[], choose: (path: string) => void): CommandMenuEntry[] {
  const root = directory();
  for (const path of new Set(paths)) {
    if (!/\.(?:glb|gltf)$/i.test(path)) continue;
    const parts = path.replace(/^\/+/, '').split('/');
    if (parts.some(part => !part)) continue;
    const file = parts.pop()!;
    let current = root;
    for (const part of parts) {
      let next = current.folders.get(part);
      if (!next) { next = directory(); current.folders.set(part, next); }
      current = next;
    }
    current.files.set(file, path);
  }
  const render = (node: Directory, key: string): CommandMenuEntry[] => [
    ...[...node.folders].sort(([a], [b]) => compareNames(a, b)).map(([part, child]) => {
      const labels = [displayName(part)];
      while (child.files.size === 0 && child.folders.size === 1) {
        const [onlyName, onlyChild] = child.folders.entries().next().value!;
        labels.push(displayName(onlyName)); child = onlyChild;
      }
      return { id: `${key}/${part}`, label: labels.join(' / '), children: render(child, `${key}/${part}`) } satisfies CommandMenuEntry;
    }),
    ...[...node.files].sort(([a], [b]) => compareNames(a, b)).map(([file, path]) => ({
      id: `model:${path}`, label: displayName(file), action: () => choose(path),
    } satisfies CommandMenuEntry)),
  ];
  // A common leading directory chain conveys no choice, so start at its first branch.
  let visible = root;
  while (visible.files.size === 0 && visible.folders.size === 1) visible = visible.folders.values().next().value!;
  return render(visible, 'models');
}
