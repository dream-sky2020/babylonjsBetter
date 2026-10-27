import { createRoot } from 'react-dom/client';
import { useEffect, useRef } from 'react';
import { SceneTransformFields, useSceneEditor } from '@/core/scene-editor/SceneEditorPanels';
import type { LabObjectEditor } from './LabObjectEditor';

export function mountLabObjectEditorPanel(element: HTMLElement, host: LabObjectEditor) {
  const root = createRoot(element); root.render(<LabObjectEditorPanel host={host} />);
  return () => root.unmount();
}
function LabObjectEditorPanel({ host }: { host: LabObjectEditor }) {
  useSceneEditor(host.editor);
  const selected = host.selected, history = host.history;
  const properties = useRef<HTMLDivElement>(null);
  const mountInspector = selected?.mountInspector;
  useEffect(() => {
    if (!properties.current || !mountInspector) return;
    return mountInspector(properties.current);
  }, [selected?.key, mountInspector]);
  return <div className="lab-object-inspector" data-lab-transform-selected={selected?.key ?? ''} data-lab-editing={host.editor.editing} data-lab-dirty={history?.dirty() ?? false}>
    <strong>{selected?.name ?? '未选择对象'}</strong>
    <small>{selected ? `${selected.ownerId}${history ? ` · ${history.dirty() ? '有未保存修改' : '已保存'}` : ' · 只读'}` : '选择可编辑对象以调整变换和属性。'}</small>
    {!!selected?.edit?.channels.length && !selected.edit.channels.some(channel => host.editor.canEdit(host.editor.selected, channel)) && <p>当前对象已隐藏、锁定或暂不可编辑；场景启用俯视比例补偿时，请先切回原比例。</p>}
    {selected?.edit ? <SceneTransformFields editor={host.editor} /> : <p>该对象未声明变换编辑能力。</p>}
    <div className="lab-object-history">
      <button type="button" data-lab-edit="undo" disabled={host.saving || !history?.canUndo()} onClick={() => host.undo()}>撤销</button>
      <button type="button" data-lab-edit="redo" disabled={host.saving || !history?.canRedo()} onClick={() => host.redo()}>重做</button>
      <button type="button" data-lab-edit="save" disabled={host.saving || !history?.save || !history.dirty()} onClick={() => void host.save()}>{host.saving ? '保存中…' : history?.saveLabel ?? '保存'}</button>
    </div>
    {history && <small>历史与保存：{history.label}</small>}
    <div ref={properties} data-lab-object-properties />
  </div>;
}
