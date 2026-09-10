import { useEffect, useState, type ReactNode } from 'react';
import { AbstractMesh, Camera, Light, Quaternion, TransformNode, Vector3, type Node } from '@babylonjs/core';

const formatNumber = (value: number) => Number.isFinite(value) ? Number(value.toFixed(4)).toString() : '—';
const vectorValues = (value?: Vector3 | null) => value ? [value.x, value.y, value.z].map(formatNumber) : ['—', '—', '—'];

const nodePath = (node: Node) => {
  const names: string[] = []; let current: Node | null = node;
  while (current) { names.unshift(current.name); current = current.parent; }
  return names.join(' / ');
};

const ReadonlyField = ({ label, value }: { label: string; value: ReactNode }) => <div className="readonly-field"><span>{label}</span><output>{value}</output></div>;

const VectorField = ({ label, value, unit }: { label: string; value?: Vector3 | null; unit?: string }) => {
  const values = vectorValues(value);
  return <div className="readonly-vector"><span>{label}</span><div>{(['X', 'Y', 'Z'] as const).map((axis, index) => <label key={axis} className={`readonly-axis axis-${axis.toLowerCase()}`}><b>{axis}</b><input readOnly value={values[index]} aria-label={`${label} ${axis}`} tabIndex={-1} />{unit && <i>{unit}</i>}</label>)}</div></div>;
};

const InspectorSection = ({ title, subtitle, children, defaultOpen = true }: { title: string; subtitle?: string; children: ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return <section className={`readonly-component ${open ? 'open' : ''}`}>
    <button className="readonly-component-heading" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 5 5-5 5" /></svg><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}
    </button>
    {open && <div className="readonly-component-body">{children}</div>}
  </section>;
};

const ObjectIcon = ({ node }: { node: Node }) => {
  const kind = node instanceof Camera ? 'camera' : node instanceof Light ? 'light' : node instanceof AbstractMesh ? 'mesh' : 'node';
  return <svg className={`readonly-object-icon ${kind}`} viewBox="0 0 32 32" aria-hidden="true">
    {kind === 'camera' && <><rect x="5" y="9" width="17" height="14" rx="2" /><path d="m22 13 6-4v14l-6-4" /><circle cx="13.5" cy="16" r="3.5" /></>}
    {kind === 'light' && <><circle cx="16" cy="16" r="5" /><path d="M16 3v5M16 24v5M3 16h5M24 16h5M7 7l4 4M21 21l4 4M25 7l-4 4M11 21l-4 4" /></>}
    {kind === 'mesh' && <><path d="m16 4 11 6v12l-11 6-11-6V10z" /><path d="m5 10 11 6 11-6M16 16v12" /></>}
    {kind === 'node' && <><circle cx="8" cy="8" r="3" /><circle cx="24" cy="24" r="3" /><path d="M11 8h5a5 5 0 0 1 5 5v8M8 11v13h13" /></>}
  </svg>;
};

export function SceneNodeInspector({ node, activeCamera, onClose }: { node: Node; activeCamera: Camera | null; onClose: () => void }) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => refresh(value => value + 1), 160);
    return () => window.clearInterval(timer);
  }, [node]);

  const transform = node as Node & { position?: Vector3; rotation?: Vector3; rotationQuaternion?: Quaternion | null; scaling?: Vector3; getAbsolutePosition?: () => Vector3 };
  const hasTransform = node instanceof TransformNode || node instanceof AbstractMesh || node instanceof Camera || Boolean(transform.position);
  const localRotation = transform.rotationQuaternion?.toEulerAngles() ?? transform.rotation;
  const rotationDegrees = localRotation?.scale(180 / Math.PI);
  const worldPosition = transform.getAbsolutePosition?.() ?? node.getWorldMatrix().getTranslation();
  const path = nodePath(node);
  const mesh = node instanceof AbstractMesh ? node : null;
  const bounds = mesh?.getBoundingInfo().boundingBox;
  const boundsSize = bounds ? bounds.maximumWorld.subtract(bounds.minimumWorld) : null;
  const camera = node instanceof Camera ? node : null;
  const light = node instanceof Light ? node : null;

  return <aside className="inspector readonly-inspector" aria-label={`${node.name} 属性`}>
    <div className="readonly-inspector-heading"><div><span>INSPECTOR</span><strong>对象属性</strong></div><em>只读</em><button onClick={onClose} title="返回武器编辑器" aria-label="关闭对象属性"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div>
    <div className="readonly-inspector-scroll">
      <div className="readonly-object-title"><ObjectIcon node={node} /><div><strong>{node.name}</strong><span>{node.getClassName()}</span></div><i className={node.isEnabled() ? 'enabled' : ''}>{node.isEnabled() ? '已启用' : '已停用'}</i></div>

      <InspectorSection title="Object" subtitle="Babylon Node">
        <ReadonlyField label="名称" value={node.name} />
        <ReadonlyField label="类型" value={node.getClassName()} />
        <ReadonlyField label="ID" value={node.id || '—'} />
        <ReadonlyField label="Unique ID" value={node.uniqueId} />
        <ReadonlyField label="父节点" value={node.parent?.name ?? 'Scene'} />
        <ReadonlyField label="直接子节点" value={node.getChildren().length} />
        <ReadonlyField label="全部后代" value={node.getDescendants().length} />
        <div className="readonly-path"><span>节点路径</span><div><code>{path}</code><button onClick={() => void navigator.clipboard.writeText(path)} title="复制路径" aria-label="复制节点路径"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg></button></div></div>
      </InspectorSection>

      {hasTransform && <InspectorSection title="Transform" subtitle="Local / World">
        <VectorField label="Position" value={transform.position} />
        <VectorField label="Rotation" value={rotationDegrees} unit="°" />
        {transform.scaling && <VectorField label="Scale" value={transform.scaling} />}
        <div className="readonly-divider" />
        <VectorField label="World Position" value={worldPosition} />
      </InspectorSection>}

      {mesh && <InspectorSection title="Mesh Renderer" subtitle={mesh.material?.name ?? 'No Material'}>
        <ReadonlyField label="材质" value={mesh.material?.name ?? '无'} />
        <ReadonlyField label="顶点" value={mesh.getTotalVertices().toLocaleString()} />
        <ReadonlyField label="索引" value={mesh.getTotalIndices().toLocaleString()} />
        <ReadonlyField label="子网格" value={mesh.subMeshes?.length ?? 0} />
        <ReadonlyField label="可见度" value={formatNumber(mesh.visibility)} />
        <ReadonlyField label="可拾取" value={mesh.isPickable ? '是' : '否'} />
        <ReadonlyField label="接收阴影" value={mesh.receiveShadows ? '是' : '否'} />
        <VectorField label="世界包围盒" value={boundsSize} />
      </InspectorSection>}

      {camera && <InspectorSection title="Camera" subtitle={camera === activeCamera ? 'Active' : 'Inactive'}>
        <ReadonlyField label="当前相机" value={camera === activeCamera ? '是' : '否'} />
        <ReadonlyField label="投影模式" value={camera.mode === Camera.PERSPECTIVE_CAMERA ? '透视' : '正交'} />
        <ReadonlyField label="近裁剪面" value={formatNumber(camera.minZ)} />
        <ReadonlyField label="远裁剪面" value={formatNumber(camera.maxZ)} />
        <ReadonlyField label="视野 FOV" value={`${formatNumber(camera.fov * 180 / Math.PI)}°`} />
        <ReadonlyField label="层遮罩" value={`0x${camera.layerMask.toString(16).padStart(8, '0')}`} />
      </InspectorSection>}

      {light && <InspectorSection title="Light" subtitle={light.getClassName()}>
        <ReadonlyField label="强度" value={formatNumber(light.intensity)} />
        <ReadonlyField label="范围" value={light.range === Number.MAX_VALUE ? '无限' : formatNumber(light.range)} />
        <ReadonlyField label="漫反射" value={light.diffuse.toHexString()} />
        <ReadonlyField label="高光" value={light.specular.toHexString()} />
        <ReadonlyField label="层遮罩" value={`0x${light.includeOnlyWithLayerMask.toString(16).padStart(8, '0')}`} />
      </InspectorSection>}
    </div>
    <div className="readonly-inspector-footer">属性来自当前 Babylon Scene · 不会写入预设</div>
  </aside>;
}
