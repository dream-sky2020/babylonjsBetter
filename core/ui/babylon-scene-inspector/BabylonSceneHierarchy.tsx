import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { Node, Scene } from '@babylonjs/core';
import { openCommandMenuAtPoint, type CommandMenuEntry, type CommandMenuHandle } from '@/core/ui/menu';

const nodeKind = (node: Node) => {
  const kind = node.getClassName().toLowerCase();
  if (kind.includes('camera')) return 'camera';
  if (kind.includes('light')) return 'light';
  if (kind.includes('mesh')) return 'mesh';
  return 'node';
};

const NodeIcon = ({ kind }: { kind: ReturnType<typeof nodeKind> }) => <svg className={`hierarchy-icon ${kind}`} viewBox="0 0 24 24" aria-hidden="true">
  {kind === 'camera' && <><path d="M4 7h11v10H4z" /><path d="m15 10 5-3v10l-5-3" /><circle cx="9.5" cy="12" r="2.2" /></>}
  {kind === 'light' && <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>}
  {kind === 'mesh' && <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>}
  {kind === 'node' && <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h4a3 3 0 0 1 3 3v7M6 8v10h10" /></>}
</svg>;

const nodePath = (node: Node) => {
  const names: string[] = []; let current: Node | null = node;
  while (current) { names.unshift(current.name); current = current.parent; }
  return names.join(' / ');
};

const nodeLabel = (node: Node) => node.name;

export type BabylonSceneHierarchyProps = {
  scene: Scene | null;
  selectedId: number | null;
  onSelect: (node: Node) => void;
  onFocus?: (node: Node) => void;
  onClearSelection?: () => void;
  getNodeLabel?: (node: Node) => string;
};

export function BabylonSceneHierarchy({ scene, selectedId, onSelect, onFocus, onClearSelection, getNodeLabel = nodeLabel }: BabylonSceneHierarchyProps) {
  const [roots, setRoots] = useState<Node[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState('');
  const menuHandle = useRef<CommandMenuHandle | null>(null);

  useEffect(() => {
    if (!scene) return;
    const refresh = () => setRoots([...scene.rootNodes]);
    queueMicrotask(refresh);
    const newCamera = scene.onNewCameraAddedObservable.add(refresh); const removedCamera = scene.onCameraRemovedObservable.add(refresh);
    const newLight = scene.onNewLightAddedObservable.add(refresh); const removedLight = scene.onLightRemovedObservable.add(refresh);
    const newTransform = scene.onNewTransformNodeAddedObservable.add(refresh); const removedTransform = scene.onTransformNodeRemovedObservable.add(refresh);
    const newMesh = scene.onNewMeshAddedObservable.add(refresh); const removedMesh = scene.onMeshRemovedObservable.add(refresh);
    return () => {
      scene.onNewCameraAddedObservable.remove(newCamera); scene.onCameraRemovedObservable.remove(removedCamera);
      scene.onNewLightAddedObservable.remove(newLight); scene.onLightRemovedObservable.remove(removedLight);
      scene.onNewTransformNodeAddedObservable.remove(newTransform); scene.onTransformNodeRemovedObservable.remove(removedTransform);
      scene.onNewMeshAddedObservable.remove(newMesh); scene.onMeshRemovedObservable.remove(removedMesh);
    };
  }, [scene]);

  useEffect(() => () => menuHandle.current?.close(), []);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const liveRoots = scene ? [...scene.rootNodes] : roots;
  const selectedAncestorIds = new Set<number>();
  if (selectedId !== null) {
    const visit = (nodes: Node[]): Node | null => {
      for (const node of nodes) {
        if (node.uniqueId === selectedId) return node;
        const found = visit(node.getChildren()); if (found) return found;
      }
      return null;
    };
    let parent = visit(liveRoots.filter(node => !node.parent))?.parent ?? null;
    while (parent) { selectedAncestorIds.add(parent.uniqueId); parent = parent.parent; }
  }
  const visibleRoots = (() => {
    const currentRoots = liveRoots.filter(node => !node.parent && !node.isDisposed());
    if (!normalizedQuery) return currentRoots;
    const matches = (node: Node): boolean => `${node.name} ${getNodeLabel(node)} ${node.getClassName()}`.toLocaleLowerCase().includes(normalizedQuery) || node.getChildren().some(matches);
    return currentRoots.filter(matches);
  })();

  const toggle = (id: number, force?: boolean) => setExpanded(current => {
    const next = new Set(current); const open = force ?? !next.has(id);
    if (open) next.add(id); else next.delete(id);
    return next;
  });
  const expandDescendants = (node: Node) => setExpanded(current => {
    const next = new Set(current); next.add(node.uniqueId); node.getDescendants().forEach(child => next.add(child.uniqueId)); return next;
  });
  const collapseDescendants = (node: Node) => setExpanded(current => {
    const next = new Set(current); next.delete(node.uniqueId); node.getDescendants().forEach(child => next.delete(child.uniqueId)); return next;
  });
  const openMenu = (event: MouseEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    const items: CommandMenuEntry[] = [];
    if (onFocus) {
      items.push({
        id: 'focus-node',
        label: '聚焦到节点',
        icon: 'focus',
        action: () => { onSelect(node); onFocus(node); },
      });
    }
    items.push(
      { type: 'separator' },
      {
        id: 'hierarchy-children',
        label: '子级显示',
        icon: 'layout',
        children: [
          { id: 'expand-descendants', label: '展开所有子级', icon: 'expand', action: () => expandDescendants(node) },
          { id: 'collapse-descendants', label: '收起所有子级', icon: 'collapse', action: () => collapseDescendants(node) },
        ],
      },
      { type: 'separator' },
      {
        id: 'copy-node-path',
        label: '复制节点路径',
        icon: 'copy',
        action: () => { void navigator.clipboard.writeText(nodePath(node)); },
      },
    );
    menuHandle.current = openCommandMenuAtPoint(event.clientX, event.clientY, items, `${getNodeLabel(node)} 节点操作`);
  };

  const renderNode = (node: Node, depth = 0): ReactNode => {
    const children = node.getChildren(); const isOpen = Boolean(normalizedQuery) || expanded.has(node.uniqueId) || selectedAncestorIds.has(node.uniqueId);
    const visibleChildren = normalizedQuery
      ? children.filter(child => `${child.name} ${getNodeLabel(child)} ${child.getClassName()}`.toLocaleLowerCase().includes(normalizedQuery) || child.getDescendants().some(descendant => `${descendant.name} ${getNodeLabel(descendant)} ${descendant.getClassName()}`.toLocaleLowerCase().includes(normalizedQuery)))
      : children;
    return <div className="hierarchy-branch" key={node.uniqueId}>
      <div className={`hierarchy-row ${selectedId === node.uniqueId ? 'selected' : ''} ${node.isEnabled() ? '' : 'disabled'}`} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => onSelect(node)} onDoubleClick={() => onFocus?.(node)} onContextMenu={event => openMenu(event, node)} title={`${nodePath(node)} · ${node.getClassName()}`}>
        <button className={`hierarchy-chevron ${children.length ? '' : 'empty'} ${isOpen ? 'open' : ''}`} aria-label={isOpen ? '收起' : '展开'} onClick={event => { event.stopPropagation(); toggle(node.uniqueId); }}><svg viewBox="0 0 16 16"><path d="m5 3 5 5-5 5" /></svg></button>
        <NodeIcon kind={nodeKind(node)} /><span>{getNodeLabel(node)}</span><small>{node.getClassName().replace('TransformNode', 'Node')}</small>
      </div>
      {isOpen && visibleChildren.map(child => renderNode(child, depth + 1))}
    </div>;
  };

  return <aside className="hierarchy-panel" aria-label="场景层级">
    <div className="hierarchy-heading"><div><span>SCENE</span><strong>层级</strong></div><em>只读</em></div>
    <label className="hierarchy-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索节点" aria-label="搜索场景节点" /></label>
    <div className="hierarchy-tree" onClick={event => { if (event.target === event.currentTarget) onClearSelection?.(); }}>{visibleRoots.length ? visibleRoots.map(node => renderNode(node)) : <p>{scene ? '没有匹配节点' : '正在读取场景…'}</p>}</div>
    <div className="hierarchy-footer"><span>{scene?.rootNodes.length ?? 0} 个根节点</span><span>{onFocus ? '双击聚焦 · ' : ''}右键操作</span></div>
  </aside>;
}
