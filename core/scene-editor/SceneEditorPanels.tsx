import { useEffect, useReducer, type ReactNode } from 'react';
import { ObjectHierarchy, InspectorPanel, InspectorSection, type EditorHierarchyItem } from '../ui/editor-kit';
import { BabylonSceneInspector } from '../ui/babylon-scene-inspector';
import { readTransform } from './transform.ts';
import type { SceneEditor } from './SceneEditor.ts';
import type { TransformChannel } from './types.ts';
import './scene-editor.css';

export function useSceneEditor(editor: SceneEditor | null) {
  const [, update] = useReducer(n => n + 1, 0);
  useEffect(() => editor?.subscribe(update), [editor]);
}
export function SceneEditorHierarchy({ editor, className = '' }: { editor: SceneEditor | null; className?: string }) {
  useSceneEditor(editor);
  const objects = editor?.objects() ?? [];
  const items = Object.fromEntries(objects.map((o): [string, EditorHierarchyItem] => [o.id, {
    id: o.id, label: o.name, parentId: objects.some(p => p.id === o.parentId) ? o.parentId : null,
    childIds: objects.filter(c => c.parentId === o.id).map(c => c.id),
    typeLabel: o.readonly ? '只读' : o.description, badges: o.readonly ? ['locked'] : !o.node.isEnabled() ? ['hidden'] : [],
  }]));
  return <ObjectHierarchy className={`scene-editor-hierarchy ${className}`} items={items} rootIds={objects.filter(o => !items[o.id].parentId).map(o => o.id)} selectedIds={editor?.selectedId ? [editor.selectedId] : []}
    defaultExpandedIds={objects.map(o => o.id)} onSelectionChange={ids => editor?.select(ids[0] ?? null)} onClearSelection={() => editor?.select(null)} onFocus={id => editor?.focus(id)} />;
}
export function SceneEditorToolbar({ editor }: { editor: SceneEditor | null }) {
  useSceneEditor(editor);
  return <div className="scene-editor-toolbar">
    {([['position', '移动'], ['rotation', '旋转'], ['scaling', '缩放']] as const).map(([mode, label]) => <button key={mode} disabled={!editor?.canEdit(editor.selected, mode)} className={editor?.mode === mode ? 'active' : ''} onClick={() => { if (editor) { editor.cancel(); editor.mode = mode; editor.refresh(); } }}>{label}</button>)}
    <button onClick={() => { if (editor) { editor.cancel(); editor.space = editor.space === 'local' ? 'world' : 'local'; editor.refresh(); } }}>{editor?.space === 'world' ? 'WORLD' : 'LOCAL'}</button>
    <button className={editor?.snap.position ? 'active' : ''} title="移动 0.01 / 旋转 5° / 缩放 0.05" onClick={() => { if (editor) { editor.snap = editor.snap.position ? { position: 0, rotation: 0, scaling: 0 } : { position: .01, rotation: 5, scaling: .05 }; editor.refresh(); } }}>吸附</button>
    <button onClick={() => editor?.focus()}>聚焦</button><button onClick={() => editor?.reset()}>重置视角</button>
    <button disabled={!editor?.adapter.undo} onClick={() => editor?.undo()}>撤销</button><button disabled={!editor?.adapter.redo} onClick={() => editor?.redo()}>重做</button>
  </div>;
}
export function SceneTransformFields({ editor }: { editor: SceneEditor | null }) {
  useSceneEditor(editor);
  const object = editor?.selected;
  if (!object?.target) return object ? <BabylonSceneInspector node={object.node} activeCamera={editor?.scene.activeCamera ?? null} /> : <p>选择可编辑对象。</p>;
  const value = readTransform(object.target);
  return <InspectorSection title="Transform" subtitle={object.description ?? '局部变换'}>
    {(['position', 'rotation', 'scaling'] as TransformChannel[]).map(channel => <div className="scene-editor-vector" key={channel}><span>{{ position: '位置', rotation: '旋转 °', scaling: '缩放' }[channel]}</span>
      {(['x', 'y', 'z'] as const).map(axis => <label key={axis} data-axis={axis}><b>{axis.toUpperCase()}</b><input aria-label={`${channel}.${axis}`} type="number" step={channel === 'rotation' ? 1 : .01} disabled={!editor?.canEdit(object, channel) || (channel === 'scaling' && object.uniformScale && axis !== 'x')}
        value={Number(value[channel][axis].toFixed(4))} onFocus={() => editor?.begin(channel)} onChange={event => {
          const n = event.currentTarget.valueAsNumber; if (!Number.isFinite(n) || !editor) return;
          if (!editor.editing && !editor.begin(channel)) return;
          editor.preview({ ...value, [channel]: { ...value[channel], [axis]: n } });
        }} onBlur={() => editor?.commit()} onKeyDown={event => { if (event.key === 'Escape') { editor?.cancel(); event.currentTarget.blur(); } else if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>)}
    </div>)}
    <button disabled={object.readonly} onClick={() => editor?.setVisible(object.id, !object.node.isEnabled())}>{object.node.isEnabled() ? '隐藏对象' : '显示对象'}</button>
  </InspectorSection>;
}
export function SceneEditorInspector({ editor, children, className = '' }: { editor: SceneEditor | null; children?: ReactNode; className?: string }) {
  useSceneEditor(editor);
  return <InspectorPanel className={className} title={editor?.selected?.name ?? '未选择对象'} status={editor?.selected?.readonly ? '只读' : undefined}><SceneTransformFields editor={editor} />{children}</InspectorPanel>;
}
