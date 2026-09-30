import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import type { SceneEditor } from '@/core/scene-editor';
import { SceneEditorHierarchy, SceneEditorToolbar, useSceneEditor } from '@/core/scene-editor/SceneEditorPanels';
import { InspectorPanel, InspectorSection, type EditorHierarchyDropIntent } from '@/core/ui/editor-kit';
import { openCommandMenuAtPoint, type CommandMenuEntry } from '@/core/ui/menu';
import { loadModelAssetManifestByExtension } from '@/core/resources';
import type { SceneEnvironmentPreset } from '@/core/scene/sceneEnvironment.types';
import { applyEnvironmentFields, environmentFields, environmentTarget, fieldValue, formatField, type EnvironmentField } from './sceneEnvironmentFields';
import { modelAssetMenuEntries } from './modelAssetMenu';
import type { EnvironmentObjectKind } from './sceneEnvironmentObjects';
import type { EnvironmentModelAssetProperties } from './sceneEnvironmentAdapter';
import { environmentNodeEntries, environmentParentCandidates } from '@/core/scene/sceneEnvironment.hierarchy';
export type EnvironmentEditorHost = {
  read(): SceneEnvironmentPreset | undefined; write(preset: SceneEnvironmentPreset): void;
  create(kind: EnvironmentObjectKind, modelPath?: string, parentId?: string | null): void;
  reparent(id: string, parentId: string | null): void; shadowKeys(): string[];
  canMove(intent: EditorHierarchyDropIntent): boolean; move(intent: EditorHierarchyDropIntent): void;
  markersVisible(): boolean; setMarkersVisible(visible: boolean): void;
  modelAssetProperties(id: string): EnvironmentModelAssetProperties | undefined;
};

export async function openEnvironmentCreateMenu(x: number, y: number, host: EnvironmentEditorHost, selectedId: string | null = null) {
  const preset = host.read();
  if (!preset || (selectedId && selectedId !== 'scene' && !environmentNodeEntries(preset).some(entry => entry.id === selectedId))) return;
  const models = await loadModelAssetManifestByExtension(/\.(glb|gltf)$/i);
  if (host.read() !== preset) return;
  const parentId = selectedId && selectedId !== 'scene' && !selectedId.startsWith('light:') ? selectedId : null;
  const entry = (kind: EnvironmentObjectKind, label: string): CommandMenuEntry => ({ id: `create-${kind}`, label, action: () => host.create(kind, undefined, parentId) });
  const modelEntries = modelAssetMenuEntries(models, path => host.create('model', path, parentId));
  openCommandMenuAtPoint(x, y, [
    entry('empty', '添加空节点'), entry('rig', '添加 Rig'), entry('socket', '添加 Socket 挂点'),
    { id: 'geometry', label: '添加几何体', children: [entry('ground', '地面'), entry('box', '方盒'), entry('cylinder', '圆柱')] },
    { id: 'model', label: '添加模型', disabled: modelEntries.length === 0, children: modelEntries },
    { id: 'light', label: '添加光源', children: [entry('hemispheric', '半球光'), entry('directional', '方向光'), entry('point', '点光')] },
    ...(selectedId && selectedId !== 'scene' ? [{ id: 'move-root', label: '移至根层级（保持世界姿态）', action: () => { try { host.reparent(selectedId, null); } catch { /* Host reports the failure in the scene status. */ } } }] : []),
  ], parentId ? '在此节点下添加' : '添加场景对象');
}

function ParentField({ editor, host, preset, id }: { editor: SceneEditor; host: EnvironmentEditorHost; preset: SceneEnvironmentPreset; id: string }) {
  const current = String(environmentTarget(preset, id).parentId ?? '');
  const [parent, setParent] = useState(current);
  const [error, setError] = useState('');
  return <InspectorSection title="父子关系" subtitle="变换字段相对于父节点；改父级保持世界姿态">
    <fieldset disabled={!editor.enabled} className="environment-fields">
      <label><span>父节点</span><select aria-label="父节点" value={parent} onChange={event => setParent(event.target.value)}>
        <option value="">场景根层级</option>
        {environmentParentCandidates(preset, id).map(entry => <option key={entry.id} value={entry.id}>{entry.definition.name} · {entry.id}</option>)}
      </select></label>
      <button disabled={parent === current} onClick={() => { try { host.reparent(id, parent || null); setError(''); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } }}>应用父节点</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </InspectorSection>;
}

const vectorDefaults = (path: string): [string, string, string] => path === 'scaling' ? ['1', '1', '1'] : ['0', '0', '0'];
function VectorField({ field, value, onChange }: { field: EnvironmentField; value: string; onChange(value: string): void }) {
  const defaults = vectorDefaults(field.path);
  const [axes, setAxes] = useState<[string, string, string]>(() => {
    if (!value) return defaults;
    const parsed = JSON.parse(value) as [number, number, number];
    return parsed.map(String) as [string, string, string];
  });
  const updateAxis = (index: number, text: string) => {
    const next = [...axes] as [string, string, string];
    next[index] = text;
    setAxes(next);
    const numbers = next.map(Number);
    onChange(next.every(part => part.trim() !== '') && numbers.every(Number.isFinite)
      ? JSON.stringify(numbers) : `[${next.join(',')}]`);
  };
  return <div className="environment-vector-field">
    <div className="environment-vector-caption"><span>{field.label}</span>{field.optional && (value
      ? <button type="button" title={`清空${field.label}，使用运行时默认值`} aria-label={`${field.label}使用默认值`} onClick={() => { setAxes(defaults); onChange(''); }}>默认</button>
      : <small title="未设置，使用运行时默认值">默认</small>)}</div>
    <div className="environment-vector-axes">
      {(['X', 'Y', 'Z'] as const).map((axis, index) => <label key={axis} className="environment-vector-axis" data-axis={axis.toLowerCase()}>
        <b>{axis}</b><input aria-label={`${field.label} ${axis}`} type="number" step="any" value={axes[index]} onChange={event => updateAxis(index, event.currentTarget.value)} />
      </label>)}
    </div>
  </div>;
}
function DeclarationForm({ editor, host, preset }: { editor: SceneEditor; host: EnvironmentEditorHost; preset: SceneEnvironmentPreset }) {
  const id = editor.selectedId;
  const target = environmentTarget(preset, id);
  const fields = environmentFields(preset, id, host.shadowKeys());
  const initial = Object.fromEntries(fields.map(f => [f.path, formatField(fieldValue(target, f.path), f.type)]));
  const [values, setValues] = useState(initial);
  const [resetVersion, setResetVersion] = useState(0);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const type = target.geometry as { primitive: string } | undefined ?? target.light as { primitive: string } | undefined;
  const asset = id?.startsWith('model:') ? host.modelAssetProperties(id) : undefined;
  return <InspectorPanel title={String(target.name)} status={dirty ? '未应用' : '草稿预览'}>
    {id && id !== 'scene' && <ParentField editor={editor} host={host} preset={preset} id={id} />}
    <InspectorSection title={id && id !== 'scene' ? `声明 · ${type?.primitive ?? (id.startsWith('transform:') ? target.role ?? 'empty' : 'model')}` : '场景配置'} subtitle={String(target.id ?? preset.presetKey)}>
      <p>编辑后点击“应用并预览”。位置、旋转与缩放相对于父节点；旋转使用弧度。改父节点会放弃尚未应用的字段输入。</p>
      <fieldset disabled={!editor.enabled} className="environment-fields">
        {fields.map(f => f.type === 'vector'
          ? <VectorField key={`${f.path}:${resetVersion}`} field={f} value={values[f.path]} onChange={value => setValues(current => ({ ...current, [f.path]: value }))} />
          : <label key={f.path}><span>{f.label}{f.optional ? '（可选）' : ''}</span>
          {f.type === 'boolean' || f.type === 'select' ? <select aria-label={f.label} value={values[f.path]} onChange={e => setValues({ ...values, [f.path]: e.target.value })}>
            {f.optional && <option value="">默认 / 不设置</option>}{(f.type === 'boolean' ? ['true', 'false'] : f.options ?? []).map(option => <option key={option} value={option}>{option === 'true' ? '是' : option === 'false' ? '否' : option}</option>)}
          </select> : f.type === 'json' ? <textarea aria-label={f.label} rows={5} value={values[f.path]} onChange={e => setValues({ ...values, [f.path]: e.target.value })} />
            : <input aria-label={f.label} type={f.type === 'number' ? 'number' : 'text'} step={f.integer ? 1 : 'any'} min={f.min} value={values[f.path]} onChange={e => setValues({ ...values, [f.path]: e.target.value })} />}
        </label>)}
        <button disabled={!dirty} onClick={() => { try { host.write(applyEnvironmentFields(preset, id, fields, values)); setError(''); } catch (e) { setError(String(e)); } }}>应用并预览</button>
        <button disabled={!dirty} onClick={() => { setValues(initial); setResetVersion(version => version + 1); setError(''); }}>放弃输入</button>
      </fieldset>
      {error && <p role="alert" style={{ color: '#ff9d9d' }}>{error}</p>}
      <p>应用后可撤销 / 重做；“保存预设”只保存当前场景。未应用输入不写入文件。</p>
    </InspectorSection>
    {asset && <InspectorSection title="模型资产校正" subtitle="共享资产属性 · 只读" defaultOpen={false}>
      <p>模型资源的原点、旋转和缩放校正；实例变换在上方编辑。</p>
      <div className="environment-asset-properties">
        {([['position', '原点偏移'], ['rotation', '资产旋转（弧度）'], ['scaling', '资产缩放']] as const).map(([key, label]) => <div key={key} className="environment-vector-field">
          <span className="environment-vector-caption">{label}</span><div className="environment-vector-axes">
            {(['X', 'Y', 'Z'] as const).map((axis, index) => <label key={axis}><span>{axis}</span><input readOnly aria-label={`${label} ${axis}`} value={Number(asset[key][index].toFixed(6))} /></label>)}
          </div>
        </div>)}
      </div>
    </InspectorSection>}
  </InspectorPanel>;
}
function EnvironmentInspector({ editor, host }: { editor: SceneEditor; host: EnvironmentEditorHost }) {
  useSceneEditor(editor);
  const preset = host.read();
  if (!preset) return <p>请选择并加载场景。</p>;
  // Preserve unsubmitted text across runtime refreshes; reset only on selection/document changes.
  return <DeclarationForm key={`${preset.presetKey}:${editor.selectedId}:${JSON.stringify(preset)}`} editor={editor} host={host} preset={preset} />;
}
function EnvironmentToolbar({ editor, host }: { editor: SceneEditor; host: EnvironmentEditorHost }) {
  useSceneEditor(editor);
  return <div className="environment-toolbar"><SceneEditorToolbar editor={editor} />
    <button aria-pressed={host.markersVisible()} onClick={() => host.setMarkersVisible(!host.markersVisible())}>挂点标记</button>
  </div>;
}
export function mountEnvironmentEditor(editor: SceneEditor, host: EnvironmentEditorHost) {
  const hierarchy = createRoot(document.getElementById('scene-hierarchy')!);
  const inspector = createRoot(document.getElementById('scene-inspector')!);
  const toolbar = createRoot(document.getElementById('scene-toolbar')!);
  hierarchy.render(<div className="environment-hierarchy-menu-area" onContextMenu={event => { event.preventDefault(); void openEnvironmentCreateMenu(event.clientX, event.clientY, host); }}>
    <SceneEditorHierarchy editor={editor} canDrop={host.canMove} onMove={host.move} onContextMenu={(event, id) => { event.preventDefault(); event.stopPropagation(); editor.select(id); void openEnvironmentCreateMenu(event.clientX, event.clientY, host, id); }} />
  </div>);
  inspector.render(<EnvironmentInspector editor={editor} host={host} />);
  toolbar.render(<EnvironmentToolbar editor={editor} host={host} />);
  return () => { hierarchy.unmount(); inspector.unmount(); toolbar.unmount(); };
}
