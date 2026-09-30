import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import type { SceneEditor } from '@/core/scene-editor';
import { SceneEditorHierarchy, SceneEditorToolbar, useSceneEditor } from '@/core/scene-editor/SceneEditorPanels';
import { InspectorPanel, InspectorSection } from '@/core/ui/editor-kit';
import { openCommandMenuAtPoint, type CommandMenuEntry } from '@/core/ui/menu';
import { loadModelAssetManifestByExtension } from '@/core/resources';
import type { SceneEnvironmentPreset } from '@/core/scene/sceneEnvironment.types';
import { applyEnvironmentFields, environmentFields, environmentTarget, fieldValue, formatField, type EnvironmentField } from './sceneEnvironmentFields';
import { modelAssetMenuEntries } from './modelAssetMenu';
import type { EnvironmentObjectKind } from './sceneEnvironmentObjects';
export type EnvironmentEditorHost = { read(): SceneEnvironmentPreset | undefined; write(preset: SceneEnvironmentPreset): void; create(kind: EnvironmentObjectKind, modelPath?: string): void; shadowKeys(): string[] };

export async function openEnvironmentCreateMenu(x: number, y: number, host: EnvironmentEditorHost) {
  if (!host.read()) return;
  const models = await loadModelAssetManifestByExtension(/\.(glb|gltf)$/i);
  if (!host.read()) return;
  const entry = (kind: EnvironmentObjectKind, label: string): CommandMenuEntry => ({ id: `create-${kind}`, label, action: () => host.create(kind) });
  const modelEntries = modelAssetMenuEntries(models, path => host.create('model', path));
  openCommandMenuAtPoint(x, y, [
    { id: 'geometry', label: '添加几何体', children: [entry('ground', '地面'), entry('box', '方盒'), entry('cylinder', '圆柱')] },
    { id: 'model', label: '添加模型', disabled: modelEntries.length === 0, children: modelEntries },
    { id: 'light', label: '添加光源', children: [entry('hemispheric', '半球光'), entry('directional', '方向光'), entry('point', '点光')] },
  ], '添加场景对象');
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
  return <InspectorPanel title={String(target.name)} status={dirty ? '未应用' : '草稿预览'}>
    <InspectorSection title={id && id !== 'scene' ? `声明 · ${type?.primitive ?? 'model'}` : '场景配置'} subtitle={String(target.id ?? preset.presetKey)}>
      <p>编辑后点击“应用并预览”。旋转使用弧度；空的可选字段使用运行时默认值。</p>
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
  </InspectorPanel>;
}
function EnvironmentInspector({ editor, host }: { editor: SceneEditor; host: EnvironmentEditorHost }) {
  useSceneEditor(editor);
  const preset = host.read();
  if (!preset) return <p>请选择并加载场景。</p>;
  // Preserve unsubmitted text across runtime refreshes; reset only on selection/document changes.
  return <DeclarationForm key={`${preset.presetKey}:${editor.selectedId}:${JSON.stringify(preset)}`} editor={editor} host={host} preset={preset} />;
}
export function mountEnvironmentEditor(editor: SceneEditor, host: EnvironmentEditorHost) {
  const hierarchy = createRoot(document.getElementById('scene-hierarchy')!);
  const inspector = createRoot(document.getElementById('scene-inspector')!);
  const toolbar = createRoot(document.getElementById('scene-toolbar')!);
  hierarchy.render(<div className="environment-hierarchy-menu-area" onContextMenu={event => { event.preventDefault(); void openEnvironmentCreateMenu(event.clientX, event.clientY, host); }}>
    <SceneEditorHierarchy editor={editor} onContextMenu={(_event, id) => editor.select(id)} />
  </div>);
  inspector.render(<EnvironmentInspector editor={editor} host={host} />);
  toolbar.render(<SceneEditorToolbar editor={editor} />);
  return () => { hierarchy.unmount(); inspector.unmount(); toolbar.unmount(); };
}
