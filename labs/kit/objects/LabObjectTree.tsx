import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, PointerEventTypes, TransformNode, Vector3, type Node, type Scene } from '@babylonjs/core';
import { ObjectHierarchy, type EditorHierarchyItem } from '@/core/ui/editor-kit';
import type { CameraLabController } from '@/core/camera/cameraLabController';
import type { LabKeyboardRouter } from '../keyboard';
import { LabObjects, type LabObjectRecord } from './LabObjects';
import type { LabObjectEditor } from './LabObjectEditor';
import { useSceneEditor } from '@/core/scene-editor/SceneEditorPanels';

const helper = (node: Node) => /(^|[_:.-])(debug|helper|marker|grid|editor)([_:.-]|$)/i.test(node.name)
  || node.metadata?.labHelper === true;
const kind = (node: Node) => node.getClassName().includes('Camera') ? '相机' : node.getClassName().includes('Light') ? '灯光' : node.getClassName().includes('Mesh') ? '网格' : '节点';

export function mountLabObjectTree(element: HTMLElement, registry: LabObjects, scene: Scene,
  controller: CameraLabController, keyboard: LabKeyboardRouter, isInputPaused: () => boolean, editorHost?: LabObjectEditor) {
  let disposed = false, pendingFrame: number | null = null;
  const observers: (() => void)[] = [];
  const changed = () => {
    if (pendingFrame !== null || disposed) return;
    // Scene imports add many resources across microtasks; publish one inspection update per frame.
    pendingFrame = requestAnimationFrame(() => { pendingFrame = null; if (!disposed) registry.refresh(); });
  };
  const watch = <T,>(observable: import('@babylonjs/core').Observable<T>) => {
    const observer = observable.add(changed); observers.push(() => observable.remove(observer));
  };
  watch(scene.onNewMeshAddedObservable); watch(scene.onMeshRemovedObservable);
  watch(scene.onNewTransformNodeAddedObservable); watch(scene.onTransformNodeRemovedObservable);
  watch(scene.onNewLightAddedObservable); watch(scene.onLightRemovedObservable);
  watch(scene.onNewCameraAddedObservable); watch(scene.onCameraRemovedObservable);
  const root = createRoot(element);
  root.render(<LabObjectTree registry={registry} scene={scene} controller={controller} keyboard={keyboard} isInputPaused={isInputPaused} editorHost={editorHost} />);
  return () => { disposed = true; if (pendingFrame !== null) cancelAnimationFrame(pendingFrame); root.unmount(); observers.forEach(dispose => dispose()); };
}

function LabObjectTree({ registry, scene, controller, keyboard, isInputPaused, editorHost }: {
  registry: LabObjects; scene: Scene; controller: CameraLabController; keyboard: LabKeyboardRouter; isInputPaused: () => boolean; editorHost?: LabObjectEditor;
}) {
  useSceneEditor(editorHost?.editor ?? null);
  const snapshot = useSyncExternalStore(registry.subscribe, registry.getSnapshot);
  const [details, setDetails] = useState(false), [helpers, setHelpers] = useState(false);
  const [expanded, setExpanded] = useState(new Set<string>()), [rawSelected, setRawSelected] = useState<string | null>(null);
  const knownGroups = useRef(new Set<string>());
  useEffect(() => {
    const added = snapshot.groups.map(group => `group:${group.id}`).filter(id => !knownGroups.current.has(id));
    if (!added.length) return;
    added.forEach(id => knownGroups.current.add(id)); setExpanded(current => new Set([...current, ...added]));
  }, [snapshot.groups]);
  const model = useMemo(() => {
    const items: Record<string, EditorHierarchyItem> = {}, nodes = new Map<string, Node>(), records = new Map<string, LabObjectRecord>();
    const roots: string[] = [], declared = new Set(snapshot.records.map(record => record.node));
    const groupKey = (id: string) => `group:${id}`;
    const objectKey = (provider: string, id: string) => `${provider}/${encodeURIComponent(id)}`;
    for (const group of snapshot.groups) {
      const id = groupKey(group.id); roots.push(id);
      items[id] = { id, label: group.label, parentId: null, childIds: [], typeLabel: '对象组', draggable: false };
    }
    for (const record of snapshot.records) {
      if (!helpers && helper(record.node)) continue;
      const parent = record.parentId ? objectKey(record.providerId, record.parentId) : groupKey(record.providerId);
      items[record.key] = { id: record.key, label: record.name, parentId: parent, childIds: [], typeLabel: record.kind ?? kind(record.node),
        draggable: false, disabled: !record.visible, locked: record.locked, badges: [...(!record.visible ? ['hidden' as const] : []), ...(record.locked ? ['locked' as const] : [])],
        searchText: `${record.name} ${record.id} ${record.kind ?? ''}`, title: `${record.name} · ${record.ownerId}` };
      nodes.set(record.key, record.node); records.set(record.key, record);
    }
    const appendRaw = (node: Node, parent: string, id: string, deep: boolean) => {
      if (node.isDisposed() || (!helpers && helper(node))) return;
      items[id] = { id, label: node.name || kind(node), parentId: parent, childIds: [], typeLabel: `${kind(node)} · 只读`,
        draggable: false, disabled: !node.isEnabled(), searchText: `${node.name} ${node.getClassName()}` };
      nodes.set(id, node);
      if (deep) for (const child of node.getChildren()) if (!declared.has(child)) appendRaw(child, id, `${id}/render:${child.uniqueId}`, true);
    };
    if (details) for (const record of snapshot.records) {
      if (!items[record.key]) continue;
      for (const child of record.node.getChildren()) if (!declared.has(child)) appendRaw(child, record.key, `${record.key}/render:${child.uniqueId}`, true);
    }
    const claimed = new Set([...snapshot.roots, ...declared]);
    const other = 'group:scene-nodes';
    items[other] = { id: other, label: '其他场景对象', parentId: null, childIds: [], typeLabel: '只读', draggable: false };
    for (const node of scene.rootNodes) {
      if (claimed.has(node) || (!helpers && (helper(node) || node.name.startsWith('scene_environment_')))) continue;
      appendRaw(node, other, `node:${node.uniqueId}`, details);
    }
    for (const item of Object.values(items)) if (item.parentId) {
      const parent = items[item.parentId];
      if (parent) parent.childIds.push(item.id);
      else { item.parentId = null; roots.push(item.id); }
    }
    if (items[other].childIds.length) roots.push(other); else delete items[other];
    return { items, nodes, records, roots };
  }, [snapshot, details, helpers, scene]);
  const selectedKey = snapshot.selectedKey ?? (rawSelected && model.items[rawSelected] ? rawSelected : null);
  const selected = selectedKey ? model.records.get(selectedKey) : undefined;
  const selectedVisible = selected?.node.isEnabled(false) ?? false;
  const node = selectedKey ? model.nodes.get(selectedKey) : undefined;
  const focus = (target: Node | undefined) => {
    if (!target || target.isDisposed()) return;
    let center = Vector3.Zero(), radius = 12;
    if (target instanceof TransformNode) {
      target.computeWorldMatrix(true); center = target.getAbsolutePosition().clone();
      const bounds = target.getHierarchyBoundingVectors(true);
      if ([...bounds.min.asArray(), ...bounds.max.asArray()].every(Number.isFinite) && bounds.min.x <= bounds.max.x) {
        center = bounds.min.add(bounds.max).scale(.5);
        const camera = scene.activeCamera, aspect = camera ? scene.getEngine().getAspectRatio(camera) : 1;
        const halfFov = Math.max(.05, (camera?.fov ?? .7) / 2);
        const limitingFov = camera?.fovMode === Camera.FOVMODE_HORIZONTAL_FIXED
          ? Math.min(halfFov, Math.atan(Math.tan(halfFov) / Math.max(.1, aspect)))
          : Math.min(halfFov, Math.atan(Math.tan(halfFov) * Math.max(.1, aspect)));
        radius = Math.max(3, bounds.max.subtract(bounds.min).length() * .55 / Math.sin(limitingFov));
      }
    } else if ('position' in target) center = (target as unknown as { position: Vector3 }).position.clone();
    controller.setView({ orbitCenter: center, orbitRadius: Math.min(500, radius) });
  };
  const actions = useRef<{ focus(): boolean; pick(node: Node | null): void }>({ focus: () => false, pick: () => {} });
  actions.current = {
    focus: () => { if (!node || node.isDisposed()) return false; focus(node); return true; },
    pick: picked => {
      if (!picked) { registry.select(null); setRawSelected(null); return; }
      const record = registry.findNode(picked, true);
      if (record) { registry.select(record.key); setRawSelected(null); return; }
      if (registry.findNode(picked)?.locked) return;
      let cursor: Node | null = picked;
      while (cursor) {
        const match = [...model.nodes].find(([, value]) => value === cursor);
        if (match) { registry.select(null, false); setRawSelected(match[0]); return; }
        cursor = cursor.parent;
      }
    },
  };
  useEffect(() => {
    const registration = keyboard.register({ id: 'lab:objects/focus', label: '对象聚焦', keys: ['KeyF'], priority: 90, intercept: true, preventDefault: true,
      onKeyDown: event => { if (isInputPaused() || event.ctrlKey || event.metaKey || event.altKey) return 'ignored'; return actions.current.focus() ? 'handled' : 'ignored'; } });
    const observer = scene.onPointerObservable.add(info => {
      if (info.type !== PointerEventTypes.POINTERTAP || info.event.button !== 0 || isInputPaused() || editorHost?.pickingBlocked) return;
      const pick = scene.pick(scene.pointerX, scene.pointerY, mesh => mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0
        && !helper(mesh) && !registry.findNode(mesh)?.locked, false, scene.activeCamera ?? undefined);
      actions.current.pick(pick?.pickedMesh ?? null);
    });
    return () => { registration.dispose(); scene.onPointerObservable.remove(observer); };
  }, [registry, scene, keyboard, isInputPaused, editorHost]);
  useEffect(() => {
    if (!selectedKey) return;
    setExpanded(current => {
      const next = new Set(current); let parent = model.items[selectedKey]?.parentId;
      while (parent) { next.add(parent); parent = model.items[parent]?.parentId; }
      if (next.size === current.size && [...next].every(id => current.has(id))) return current;
      return next;
    });
  }, [selectedKey, model]);
  return <div className="lab-object-tree">
    {editorHost && <div className="lab-object-editor-toolbar">
      {([['position', '移动'], ['rotation', '旋转'], ['scaling', '缩放']] as const).map(([mode, label]) => <button type="button" key={mode} data-lab-edit={mode}
        aria-pressed={editorHost.editor.mode === mode} disabled={!editorHost.editor.canEdit(editorHost.editor.selected, mode)}
        onClick={() => { editorHost.editor.cancel(); editorHost.editor.mode = mode; editorHost.editor.refresh(); }}>{label}</button>)}
      <button type="button" data-lab-edit="space" onClick={() => { editorHost.editor.cancel(); editorHost.editor.space = editorHost.editor.space === 'local' ? 'world' : 'local'; editorHost.editor.refresh(); }}>{editorHost.editor.space === 'local' ? '局部' : '世界'}</button>
    </div>}
    <div className="lab-object-tree-options">
      <label><input type="checkbox" checked={details} onChange={event => setDetails(event.target.checked)} />渲染细节</label>
      <label><input type="checkbox" checked={helpers} onChange={event => setHelpers(event.target.checked)} />辅助对象</label>
    </div>
    <ObjectHierarchy title="对象树" eyebrow="" status={`${snapshot.records.length} 个对象`} items={model.items} rootIds={model.roots}
      showTypeLabels={false}
      renderRowMetadata={key => {
        const record = model.records.get(key), visible = record?.node.isEnabled(false) ?? false;
        return <><small className="editor-hierarchy-type" title={model.items[key].typeLabel}>{model.items[key].typeLabel}</small>
          {record && record.canHide !== false && <button type="button" className="lab-object-row-visibility" data-lab-object-visibility={key}
            title={visible ? '隐藏对象' : '显示对象'} aria-label={`${record.name}：${visible ? '隐藏' : '显示'}`} aria-pressed={visible}
            onDoubleClick={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); registry.setVisible(key, !visible); }}>{visible ? '◉' : '○'}</button>}</>;
      }}
      expandedIds={expanded} onExpandedChange={setExpanded} selectedIds={selectedKey ? [selectedKey] : []} searchPlaceholder="搜索场景、怪物、灯光…"
      onSelectionChange={ids => { const key = ids[0]; if (model.records.has(key)) { setRawSelected(null); registry.select(key); } else { registry.select(null, false); setRawSelected(key ?? null); } }}
      onFocus={key => focus(model.nodes.get(key))} onClearSelection={() => { registry.select(null); setRawSelected(null); }}
      footer={<><span>双击或 F 聚焦</span><span>{selected?.edit?.channels.length ? '声明对象变换' : '只读变换'}</span></>} />
    <div className="lab-object-selection" data-lab-selected-object={selectedKey ?? ''}>
      <strong title={node?.name}>{selectedKey ? model.items[selectedKey]?.label : '未选择对象'}</strong>
      <div>
        <button type="button" disabled={!node} onClick={() => focus(node)}>聚焦</button>
        <button type="button" disabled={!selected || selected.canHide === false} onClick={() => selected && registry.setVisible(selected.key, !selectedVisible)}>{selected && !selectedVisible ? '显示' : '隐藏'}</button>
        <button type="button" disabled={!selected} title="锁定后忽略视口点击，仍可在对象树中检查" onClick={() => selected && registry.setLocked(selected.key, !selected.locked)}>{selected?.locked ? '解锁选择' : '锁定选择'}</button>
      </div>
      <small>{selected ? `${selected.kind ?? kind(selected.node)} · ${selected.ownerId}` : node ? `${node.getClassName()} · 渲染节点只读` : '选择对象可查看所属模块、显隐和聚焦。'}</small>
    </div>
  </div>;
}
