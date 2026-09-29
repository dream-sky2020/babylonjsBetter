import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import type { SceneEditor } from '@/core/scene-editor';
import { SceneEditorHierarchy, SceneEditorToolbar, useSceneEditor } from '@/core/scene-editor/SceneEditorPanels';
import { InspectorPanel, InspectorSection } from '@/core/ui/editor-kit';
import type { SceneEnvironmentPreset } from '@/core/scene/sceneEnvironment.types';
import { applyEnvironmentFields, environmentFields, environmentTarget, fieldValue, formatField } from './sceneEnvironmentFields';
export type EnvironmentEditorHost = { read(): SceneEnvironmentPreset | undefined; write(preset: SceneEnvironmentPreset): void; shadowKeys(): string[] };
function DeclarationForm({ editor, host, preset }: { editor: SceneEditor; host: EnvironmentEditorHost; preset: SceneEnvironmentPreset }) {
  const id = editor.selectedId;
  const target = environmentTarget(preset, id);
  const fields = environmentFields(preset, id, host.shadowKeys());
  const initial = Object.fromEntries(fields.map(f => [f.path, formatField(fieldValue(target, f.path), f.type)]));
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const type = target.geometry as { primitive: string } | undefined ?? target.light as { primitive: string } | undefined;
  return <InspectorPanel title={String(target.name)} status={dirty ? '未应用' : '草稿预览'}>
    <InspectorSection title={id && id !== 'scene' ? `声明 · ${type?.primitive ?? 'model'}` : '场景配置'} subtitle={String(target.id ?? preset.presetKey)}>
      <p>编辑后点击“应用并预览”。旋转使用弧度；空的可选字段使用运行时默认值。</p>
      <fieldset disabled={!editor.enabled} className="environment-fields">
        {fields.map(f => <label key={f.path}><span>{f.label}{f.optional ? '（可选）' : ''}</span>
          {f.type === 'boolean' || f.type === 'select' ? <select aria-label={f.label} value={values[f.path]} onChange={e => setValues({ ...values, [f.path]: e.target.value })}>
            {f.optional && <option value="">默认 / 不设置</option>}{(f.type === 'boolean' ? ['true', 'false'] : f.options ?? []).map(option => <option key={option} value={option}>{option === 'true' ? '是' : option === 'false' ? '否' : option}</option>)}
          </select> : f.type === 'json' ? <textarea aria-label={f.label} rows={5} value={values[f.path]} onChange={e => setValues({ ...values, [f.path]: e.target.value })} />
            : <input aria-label={f.label} type={f.type === 'number' ? 'number' : 'text'} step={f.integer ? 1 : 'any'} min={f.min} placeholder={f.type === 'vector' ? '[x, y, z]' : ''} value={values[f.path]} onChange={e => setValues({ ...values, [f.path]: e.target.value })} />}
        </label>)}
        <button disabled={!dirty} onClick={() => { try { host.write(applyEnvironmentFields(preset, id, fields, values)); setError(''); } catch (e) { setError(String(e)); } }}>应用并预览</button>
        <button disabled={!dirty} onClick={() => { setValues(initial); setError(''); }}>放弃输入</button>
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
  hierarchy.render(<SceneEditorHierarchy editor={editor} />);
  inspector.render(<EnvironmentInspector editor={editor} host={host} />);
  toolbar.render(<SceneEditorToolbar editor={editor} />);
  return () => { hierarchy.unmount(); inspector.unmount(); toolbar.unmount(); };
}
