import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { Node, Scene } from '@babylonjs/core';
import { ObjectHierarchy, type EditorHierarchyItem } from '@/core/ui/editor-kit';
import { openCommandMenuAtPoint, type CommandMenuEntry, type CommandMenuHandle } from '@/core/ui/menu';

const nodeKind = (node: Node) => {
  const kind = node.getClassName().toLowerCase();
  if (kind.includes('camera')) return 'camera';
  if (kind.includes('light')) return 'light';
  if (kind.includes('mesh')) return 'mesh';
  return 'node';
};
const NodeIcon = ({ kind }: { kind: ReturnType<typeof nodeKind> }) => <svg className={kind} viewBox="0 0 24 24" aria-hidden="true">
  {kind === 'camera' && <><path d="M4 7h11v10H4z" /><path d="m15 10 5-3v10l-5-3" /><circle cx="9.5" cy="12" r="2.2" /></>}
  {kind === 'light' && <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>}
  {kind === 'mesh' && <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>}
  {kind === 'node' && <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h4a3 3 0 0 1 3 3v7M6 8v10h10" /></>}
</svg>;
const nodePath = (node: Node) => { const names: string[] = []; let current: Node | null = node; while (current) { names.unshift(current.name); current = current.parent; } return names.join(' / '); };
const nodeLabel = (node: Node) => node.name;

export type BabylonSceneHierarchyProps = { scene: Scene | null; selectedId: number | null; onSelect: (node: Node) => void; onFocus?: (node: Node) => void; onClearSelection?: () => void; getNodeLabel?: (node: Node) => string };

export function BabylonSceneHierarchy({ scene, selectedId, onSelect, onFocus, onClearSelection, getNodeLabel = nodeLabel }: BabylonSceneHierarchyProps) {
  const [roots, setRoots] = useState<Node[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const menuHandle = useRef<CommandMenuHandle | null>(null);
  useEffect(() => {
    if (!scene) { setRoots([]); return; }
    const refresh = () => setRoots([...scene.rootNodes]); queueMicrotask(refresh);
    const newCamera = scene.onNewCameraAddedObservable.add(refresh); const removedCamera = scene.onCameraRemovedObservable.add(refresh);
    const newLight = scene.onNewLightAddedObservable.add(refresh); const removedLight = scene.onLightRemovedObservable.add(refresh);
    const newTransform = scene.onNewTransformNodeAddedObservable.add(refresh); const removedTransform = scene.onTransformNodeRemovedObservable.add(refresh);
    const newMesh = scene.onNewMeshAddedObservable.add(refresh); const removedMesh = scene.onMeshRemovedObservable.add(refresh);
    return () => { scene.onNewCameraAddedObservable.remove(newCamera); scene.onCameraRemovedObservable.remove(removedCamera); scene.onNewLightAddedObservable.remove(newLight); scene.onLightRemovedObservable.remove(removedLight); scene.onNewTransformNodeAddedObservable.remove(newTransform); scene.onTransformNodeRemovedObservable.remove(removedTransform); scene.onNewMeshAddedObservable.remove(newMesh); scene.onMeshRemovedObservable.remove(removedMesh); };
  }, [scene]);
  useEffect(() => () => menuHandle.current?.close(), []);

  const liveRoots = (scene ? [...scene.rootNodes] : roots).filter(node => !node.parent && !node.isDisposed());
  const nodesById = new Map<string, Node>(); const items: Record<string, EditorHierarchyItem> = {};
  const collect = (node: Node) => {
    const id = String(node.uniqueId); const children = node.getChildren().filter(child => !child.isDisposed()); nodesById.set(id, node);
    items[id] = { id, label: getNodeLabel(node), typeLabel: node.getClassName().replace('TransformNode', 'Node'), parentId: node.parent ? String(node.parent.uniqueId) : null, childIds: children.map(child => String(child.uniqueId)), icon: <NodeIcon kind={nodeKind(node)} />, disabled: !node.isEnabled(), searchText: `${node.name} ${node.getClassName()}`, title: `${nodePath(node)} · ${node.getClassName()}` };
    children.forEach(collect);
  };
  liveRoots.forEach(collect);
  const expandDescendants = (node: Node) => setExpanded(current => new Set([...current, String(node.uniqueId), ...node.getDescendants().map(child => String(child.uniqueId))]));
  const collapseDescendants = (node: Node) => setExpanded(current => { const next = new Set(current); next.delete(String(node.uniqueId)); node.getDescendants().forEach(child => next.delete(String(child.uniqueId))); return next; });
  const openMenu = (event: MouseEvent, id: string) => {
    const node = nodesById.get(id); if (!node) return; event.preventDefault(); event.stopPropagation(); const entries: CommandMenuEntry[] = [];
    if (onFocus) entries.push({ id: 'focus-node', label: '聚焦到节点', icon: 'focus', action: () => { onSelect(node); onFocus(node); } });
    entries.push({ type: 'separator' }, { id: 'hierarchy-children', label: '子级显示', icon: 'layout', children: [{ id: 'expand-descendants', label: '展开所有子级', icon: 'expand', action: () => expandDescendants(node) }, { id: 'collapse-descendants', label: '收起所有子级', icon: 'collapse', action: () => collapseDescendants(node) }] }, { type: 'separator' }, { id: 'copy-node-path', label: '复制节点路径', icon: 'copy', action: () => void navigator.clipboard.writeText(nodePath(node)) });
    menuHandle.current = openCommandMenuAtPoint(event.clientX, event.clientY, entries, `${getNodeLabel(node)} 节点操作`);
  };
  return <ObjectHierarchy className="hierarchy-panel" eyebrow="SCENE" title="层级" status="只读" items={items} rootIds={liveRoots.map(node => String(node.uniqueId))} selectedIds={selectedId === null ? [] : [String(selectedId)]} expandedIds={expanded} onExpandedChange={setExpanded} searchPlaceholder="搜索场景节点" emptyLabel={scene ? '没有匹配节点' : '正在读取场景…'} onSelectionChange={ids => { const node = nodesById.get(ids[0]); if (node) onSelect(node); }} onFocus={onFocus ? id => { const node = nodesById.get(id); if (node) onFocus(node); } : undefined} onContextMenu={openMenu} onClearSelection={onClearSelection} footer={<><span>{liveRoots.length} 个根节点</span><span>{onFocus ? '双击聚焦 · ' : ''}右键操作</span></>} />;
}
