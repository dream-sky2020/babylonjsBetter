import { createRoot } from 'react-dom/client';
import { useState, useSyncExternalStore } from 'react';
import type { SceneEditor } from '@/core/scene-editor';
import { SceneEditorHierarchy, SceneEditorToolbar, useSceneEditor } from '@/core/scene-editor/SceneEditorPanels';
import { InspectorPanel, InspectorSection, type EditorHierarchyDropIntent } from '@/core/ui/editor-kit';
import { openCommandMenuAtPoint, type CommandMenuEntry } from '@/core/ui/menu';
import { loadModelAssetManifestByExtension } from '@/core/resources';
import { readBundledResourceAssetPaths } from '@/core/resources/resourceManifest';
import type { SceneEnvironmentPreset } from '@/core/scene/sceneEnvironment.types';
import { applyEnvironmentBatchFields, applyEnvironmentFields, commonEnvironmentFields, environmentFields, environmentTarget, fieldValue, formatField, type EnvironmentField, type EnvironmentVectorChanges } from './sceneEnvironmentFields';
import { modelAssetMenuEntries } from './modelAssetMenu';
import type { EnvironmentObjectKind } from './sceneEnvironmentObjects';
import type { EnvironmentModelAssetProperties } from './sceneEnvironmentAdapter';
import { environmentNodeEntries, environmentParentCandidates } from '@/core/scene/sceneEnvironment.hierarchy';
import { EnvironmentSelection } from './sceneEnvironmentSelection';
import { MODEL_TEXTURE_SLOTS, parseModelMaterialBindings, type ModelMaterialBindings } from '@/core/model/material/modelMaterialBindings';
import { formatTextureBytes, type EnvironmentTextureStats } from './sceneEnvironmentTextureStats';
import type { UvCoverage } from './sceneEnvironmentUvCoverage';
export type EnvironmentEditorHost = {
  read(): SceneEnvironmentPreset | undefined; write(preset: SceneEnvironmentPreset): void;
  create(kind: EnvironmentObjectKind, modelPath?: string, parentId?: string | null): void;
  reparent(id: string, parentId: string | null): void; shadowKeys(): string[];
  canMove(intent: EditorHierarchyDropIntent): boolean; move(intent: EditorHierarchyDropIntent): void;
  markersVisible(): boolean; setMarkersVisible(visible: boolean): void;
  modelAssetProperties(id: string): EnvironmentModelAssetProperties | undefined;
  faceCount?(id: string): number | undefined;
  modelTextureStats?(id: string): EnvironmentTextureStats | undefined;
  modelUvCoverage?(id: string): UvCoverage | undefined;
  setUvCoverageVisible?(visible: boolean): void;
  modelMaterials?(id: string): { gltfMaterialIndex: number; name: string; textures: Record<string, string | null> }[];
};

export async function openEnvironmentCreateMenu(x: number, y: number, host: EnvironmentEditorHost, selectedId: string | null = null) {
  const preset = host.read();
  if (!preset || (selectedId && selectedId !== 'scene' && !environmentNodeEntries(preset).some(entry => entry.id === selectedId))) {
    return;
  }
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
function MaterialForm({ editor, host, preset, id }: { editor: SceneEditor; host: EnvironmentEditorHost; preset: SceneEnvironmentPreset; id: string }) {
  const [texturePaths] = useState(() => readBundledResourceAssetPaths().filter(path => /\.(png|jpe?g|webp)$/i.test(path)));
  const model = preset.models.find(m => `model:${m.id}` === id)!;
  const [bindings, setBindings] = useState<ModelMaterialBindings>(() => structuredClone(model.materialOverrides ?? []));
  const [advanced,setAdvanced] = useState(JSON.stringify(bindings,null,2));
  const [error,setError] = useState('');
  const set = (next: ModelMaterialBindings) => { setBindings(next); setAdvanced(JSON.stringify(next,null,2)); };
  const edit = (index: number, slot: typeof MODEL_TEXTURE_SLOTS[number], path: string) => {
    const next = structuredClone(bindings); let b = next.find(b => b.selector.gltfMaterialIndex === index);
    if (!b) { b = { selector: { gltfMaterialIndex: index }, textures: {} }; next.push(b); }
    b.textures ??= {}; if (!path) delete b.textures[slot]; else if (path === '__remove__') b.textures[slot] = null; else b.textures[slot] = { ...b.textures[slot], path };
    set(next);
  };
  return <InspectorSection title="材质与共享贴图" subtitle="按 glTF 材质索引绑定；空路径继承原模型">
    <fieldset disabled={!editor.enabled} className="environment-fields">
      <datalist id="model-shared-texture-paths">{texturePaths.map(path => <option key={path} value={path} />)}</datalist>
      {(host.modelMaterials?.(id) ?? []).map(material => <div key={material.gltfMaterialIndex}>
        <b>#{material.gltfMaterialIndex} · {material.name}</b>
        {MODEL_TEXTURE_SLOTS.map(slot => { const value = bindings.find(b => b.selector.gltfMaterialIndex === material.gltfMaterialIndex)?.textures?.[slot];
          return <label key={slot}><span>{slot}</span><input list="model-shared-texture-paths" aria-label={`材质 ${material.gltfMaterialIndex} ${slot}`} placeholder={material.textures[slot] ?? '继承（无贴图）'} value={value?.path ?? ''} onChange={e => edit(material.gltfMaterialIndex,slot,e.target.value)} />
            <small>{value === null ? '显式移除' : value ? '实例覆盖' : '继承模型'}</small>
            <button onClick={() => edit(material.gltfMaterialIndex,slot,'')}>恢复继承</button><button onClick={() => edit(material.gltfMaterialIndex,slot,'__remove__')}>移除贴图</button></label>; })}
      </div>)}
      <details><summary>UV、采样、透明参数（JSON）</summary><textarea aria-label="材质覆盖 JSON" rows={10} value={advanced} onChange={e => setAdvanced(e.target.value)} />
        <p>uvSet 0–5；offset/scale 为二元数组；rotation 为弧度；wrapU/V：0 裁切、1 重复、2 镜像；alphaMode：OPAQUE / MASK / BLEND。</p></details>
      <button onClick={() => { try { const overrides = parseModelMaterialBindings(JSON.parse(advanced)); const next = structuredClone(preset); next.models.find(m => m.id === model.id)!.materialOverrides = overrides; host.write(next); setError(''); } catch (e) { setError(String(e)); } }}>应用材质并预览</button>
      <button onClick={() => set([])}>全部恢复继承</button>
    </fieldset>{error && <p role="alert">{error}</p>}
  </InspectorSection>;
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
  const textureStats = id?.startsWith('model:') ? host.modelTextureStats?.(id) : undefined;
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
    {textureStats && <InspectorSection title="纹理统计" subtitle={`${textureStats.textures.length} 张 · ${formatTextureBytes(textureStats.bytes)}${textureStats.unknown ? ` + ${textureStats.unknown} 张无法估算` : ''}`}>
      <p>按此模型引用的 GPU 纹理去重，估算包含 mipmap；共享纹理在场景汇总中只计一次。</p>
      <div className="environment-texture-details">
        {textureStats.textures.length ? textureStats.textures.map((texture, index) => <div className="environment-texture-entry" key={index}>
          <span title={texture.name}>{texture.name}</span>
          <small>{texture.resolution} · {texture.bytes === null ? '无法估算' : formatTextureBytes(texture.bytes)} · {texture.mipmaps ? '含 mipmap' : '无 mipmap'}</small>
        </div>) : <span>此模型未引用纹理。</span>}
      </div>
    </InspectorSection>}
    {id?.startsWith('model:') && <MaterialForm key={JSON.stringify(preset.models)} editor={editor} host={host} preset={preset} id={id} />}
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
function BatchForm({ editor, host, preset, ids }: { editor: SceneEditor; host: EnvironmentEditorHost; preset: SceneEnvironmentPreset; ids: string[] }) {
  const fields = commonEnvironmentFields(preset, ids, host.shadowKeys());
  const targets = ids.map(id => environmentTarget(preset, id));
  const [scalar, setScalar] = useState<Record<string, string>>({});
  const [vectors, setVectors] = useState<EnvironmentVectorChanges>({});
  const [error, setError] = useState('');
  const dirty = Object.keys(scalar).length > 0 || Object.keys(vectors).length > 0;
  const same = (values: unknown[]) => values.every(value => JSON.stringify(value) === JSON.stringify(values[0]));
  return <InspectorPanel title={`已选择 ${ids.length} 个对象`} status={dirty ? '批量修改未应用' : '共同属性'}>
    <InspectorSection title="批量赋予属性" subtitle="只显示所有选中对象都具有的字段">
      <p>混合值留空显示；只修改填写过的字段。向量可单独修改 X/Y/Z，其他轴保持各对象原值。应用后可一步撤销。</p>
      <fieldset disabled={!editor.enabled} className="environment-fields">
        {fields.length ? fields.map(field => {
          if (field.type === 'vector') {
            const values = targets.map(target => fieldValue(target, field.path));
            return <div className="environment-vector-field" key={field.path}><span className="environment-vector-caption">{field.label}</span><div className="environment-vector-axes">
              {(['X', 'Y', 'Z'] as const).map((axis, index) => {
                const axisValues = values.map(value => Array.isArray(value) ? value[index] : field.path === 'scaling' ? 1 : 0);
                const override = vectors[field.path]?.[index as 0 | 1 | 2];
                return <label key={axis} className="environment-vector-axis" data-axis={axis.toLowerCase()}><b>{axis}</b><input aria-label={`批量${field.label} ${axis}`} type="number" step="any" placeholder={same(axisValues) ? '' : '混合'} value={override ?? (same(axisValues) ? String(axisValues[0]) : '')} onChange={event => { const text = event.currentTarget.value; setVectors(current => {
                  const next = { ...current }, axes = { ...next[field.path] };
                  if (text === '') delete axes[index as 0 | 1 | 2]; else axes[index as 0 | 1 | 2] = text;
                  if (Object.keys(axes).length) next[field.path] = axes; else delete next[field.path];
                  return next;
                }); }} /></label>;
              })}
            </div></div>;
          }
          const values = targets.map(target => fieldValue(target, field.path));
          const mixed = !same(values);
          const value = scalar[field.path] ?? (mixed && (field.type === 'select' || field.type === 'boolean') ? '__mixed__' : mixed ? '' : formatField(values[0], field.type));
          return <label key={field.path}><span>{field.label}{mixed ? ' · 混合值' : ''}</span>
            {field.type === 'select' || field.type === 'boolean' ? <select aria-label={`批量${field.label}`} value={value} onChange={event => setScalar(current => ({ ...current, [field.path]: event.target.value }))}>
              {mixed && !Object.hasOwn(scalar, field.path) && <option value="__mixed__" disabled>混合值（未修改）</option>}
              {field.optional && <option value="">默认 / 不设置</option>}
              {(field.type === 'boolean' ? ['true', 'false'] : field.options ?? []).map(option => <option key={option} value={option}>{option === 'true' ? '是' : option === 'false' ? '否' : option}</option>)}
            </select> : field.type === 'json' ? <textarea aria-label={`批量${field.label}`} rows={4} placeholder={mixed ? '混合值' : ''} value={value} onChange={event => setScalar(current => ({ ...current, [field.path]: event.target.value }))} />
              : <input aria-label={`批量${field.label}`} type={field.type === 'number' ? 'number' : 'text'} step={field.integer ? 1 : 'any'} min={field.min} placeholder={mixed ? '混合值' : ''} value={value} onChange={event => setScalar(current => ({ ...current, [field.path]: event.target.value }))} />}
            {field.optional && field.type !== 'select' && field.type !== 'boolean' && <button type="button" onClick={() => setScalar(current => ({ ...current, [field.path]: '' }))}>设为默认</button>}
          </label>;
        }) : <p>所选对象没有可共同编辑的属性。</p>}
        <button disabled={!dirty} onClick={() => { try { host.write(applyEnvironmentBatchFields(preset, ids, scalar, vectors, host.shadowKeys())); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } }}>批量应用并预览</button>
        <button disabled={!dirty} onClick={() => { setScalar({}); setVectors({}); setError(''); }}>放弃输入</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <p>多选时 Gizmo 仍只作用于最后选中的对象；批量修改请使用上方字段。</p>
    </InspectorSection>
  </InspectorPanel>;
}
function EnvironmentInspector({ editor, host, selection }: { editor: SceneEditor; host: EnvironmentEditorHost; selection: EnvironmentSelection }) {
  useSceneEditor(editor);
  const ids = useSyncExternalStore(selection.subscribe, selection.getSnapshot);
  const preset = host.read();
  if (!preset) return <p>请选择并加载场景。</p>;
  if (ids.length > 1) return <BatchForm key={`${preset.presetKey}:${ids.join('|')}:${JSON.stringify(preset)}`} editor={editor} host={host} preset={preset} ids={ids} />;
  // Preserve unsubmitted text across runtime refreshes; reset only on selection/document changes.
  return <DeclarationForm key={`${preset.presetKey}:${editor.selectedId}:${JSON.stringify(preset)}`} editor={editor} host={host} preset={preset} />;
}
type HierarchyDisplay = { faces: boolean; types: boolean; textureSizes: boolean; uvCoverage: boolean };
function EnvironmentToolbar({ editor, host, display, changeDisplay }: { editor: SceneEditor; host: EnvironmentEditorHost; display: HierarchyDisplay; changeDisplay(key: keyof HierarchyDisplay): void }) {
  useSceneEditor(editor);
  return <div className="environment-toolbar"><SceneEditorToolbar editor={editor} />
    <button aria-pressed={host.markersVisible()} onClick={() => host.setMarkersVisible(!host.markersVisible())}>挂点标记</button>
    <button aria-pressed={display.faces} title="显示所有对象自身的三角面数" onClick={() => changeDisplay('faces')}>面数</button>
    <button aria-pressed={display.textureSizes} title="显示模型纹理分辨率" onClick={() => changeDisplay('textureSizes')}>纹理尺寸</button>
    <button aria-pressed={display.uvCoverage} title="按需分析并显示模型 UV 覆盖率估算" onClick={() => changeDisplay('uvCoverage')}>UV 覆盖率</button>
    <button aria-pressed={display.types} title="显示列表中的对象种类" onClick={() => changeDisplay('types')}>对象种类</button>
  </div>;
}
export function mountEnvironmentEditor(editor: SceneEditor, host: EnvironmentEditorHost) {
  const selection = new EnvironmentSelection(editor);
  const hierarchy = createRoot(document.getElementById('scene-hierarchy')!);
  const inspector = createRoot(document.getElementById('scene-inspector')!);
  const toolbar = createRoot(document.getElementById('scene-toolbar')!);
  let display: HierarchyDisplay;
  try {
    const saved = JSON.parse(localStorage.getItem('scene-environment-lab:hierarchy-display:v1') ?? '{}');
    display = { faces: saved?.faces === true, types: saved?.types !== false, textureSizes: saved?.textureSizes === true, uvCoverage: saved?.uvCoverage === true };
  } catch { display = { faces: false, types: true, textureSizes: false, uvCoverage: false }; }
  const displayListeners = new Set<() => void>();
  const subscribeDisplay = (listener: () => void) => { displayListeners.add(listener); return () => { displayListeners.delete(listener); }; };
  const getDisplay = () => display;
  const changeDisplay = (key: keyof HierarchyDisplay) => {
    display = { ...display, [key]: !display[key] };
    if (key === 'uvCoverage') host.setUvCoverageVisible?.(display.uvCoverage);
    try { localStorage.setItem('scene-environment-lab:hierarchy-display:v1', JSON.stringify(display)); } catch { /* Session preferences still work when storage is unavailable. */ }
    displayListeners.forEach(listener => listener());
  };
  function Toolbar() {
    const currentDisplay = useSyncExternalStore(subscribeDisplay, getDisplay);
    return <EnvironmentToolbar editor={editor} host={host} display={currentDisplay} changeDisplay={changeDisplay} />;
  }
  function Hierarchy() {
    const ids = useSyncExternalStore(selection.subscribe, selection.getSnapshot);
    const display = useSyncExternalStore(subscribeDisplay, getDisplay);
    return <div className="environment-hierarchy-menu-area" onContextMenu={event => { event.preventDefault(); void openEnvironmentCreateMenu(event.clientX, event.clientY, host); }}>
      <SceneEditorHierarchy editor={editor} selectedIds={ids} enableRangeSelection showTypeLabels={display.types}
        renderRowMetadata={id => {
          const count = display.faces ? host.faceCount?.(id) : undefined;
          const textures = display.textureSizes ? host.modelTextureStats?.(id)?.textures : undefined;
          const sizes = textures ? [...new Set(textures.map(texture => texture.resolution.replaceAll(' ', '')))] : [];
          const uv = display.uvCoverage && id.startsWith('model:') ? host.modelUvCoverage?.(id) : undefined;
          return <>
            {display.uvCoverage && id.startsWith('model:') && <small className="environment-hierarchy-uv-coverage" title={uv?.detail ?? '正在后台分析 UV 覆盖率'}>
              {uv ? uv.percent === null ? 'UV —' : `UV ${uv.percent.toFixed(1)}%` : 'UV …'}
            </small>}
            {textures && <small className="environment-hierarchy-texture-size" title={textures.length ? textures.map(texture => `${texture.name}: ${texture.resolution}`).join('\n') : '此模型未引用纹理'}>
              {sizes.length ? `${sizes[0]}${sizes.length > 1 ? ` +${sizes.length - 1}种` : ''}` : '无纹理'}
            </small>}
            {count !== undefined && <small className="environment-hierarchy-face-count" title="当前对象自身的三角面数，不含挂载的其他对象">{count.toLocaleString()} 面</small>}
          </>;
        }}
        onSelectionChange={(next, mode) => selection.change(next, mode)} canDrop={host.canMove} onMove={host.move}
        onContextMenu={(event, id) => { event.preventDefault(); event.stopPropagation(); selection.replace([id]); void openEnvironmentCreateMenu(event.clientX, event.clientY, host, id); }} />
    </div>;
  }
  hierarchy.render(<Hierarchy />);
  inspector.render(<EnvironmentInspector editor={editor} host={host} selection={selection} />);
  toolbar.render(<Toolbar />);
  host.setUvCoverageVisible?.(display.uvCoverage);
  return { selection, dispose: () => { hierarchy.unmount(); inspector.unmount(); toolbar.unmount(); selection.dispose(); } };
}
