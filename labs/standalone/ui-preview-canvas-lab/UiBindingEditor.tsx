import type { UiBindableField, UiDefinition, UiDocument, UiDocumentStore, UiNode } from '@/core/ui-document';

type Props = { store: UiDocumentStore; document: UiDocument; node: UiNode; definition?: UiDefinition; runtimeContext?: Record<string, unknown>; onChanged(): void };
/** Bindings describe UI inputs; preview values never access live Lab shared memory. */
export function UiBindingEditor({ store, document, node, definition, runtimeContext, onChanged }: Props) {
  const known = definition?.bindableFields ?? [];
  const fields: UiBindableField[] = [...known, ...Object.keys(node.bindings ?? {}).filter(key => !known.some(field => field.key === key)).map(key => ({ key, label: `${key}（未声明）`, propertyPath: '', valueType: 'string' as const }))];
  const changeNode = (label: string, update: (item: UiNode) => void) => { store.updateNode(node.id, label, update); onChanged(); };
  const writeValue = (field: UiBindableField, source: string, value: string) => {
    if (!source || (field.valueType === 'number' && (value.trim() === '' || !Number.isFinite(Number(value))))) return;
    store.mutate('修改绑定模拟值', draft => { draft.previewContext ??= {}; draft.previewContext[source] = field.valueType === 'number' ? Number(value) : value; }); onChanged();
  };
  return <div className="ui-binding-editor">
    <p className="hint">绑定名是 UI 数据接口，由模块提供实际值；模拟值仅用于编辑器，保存到预设，不修改共享内存。</p>
    {!fields.length && <p className="hint">此组件没有声明可绑定属性。</p>}
    {fields.map(field => {
      const binding = node.bindings?.[field.key];
      const simulated = binding ? document.previewContext?.[binding.source] : undefined;
      const demoOverrides = !!binding && runtimeContext?.[binding.source] != null;
      return <div className="ui-binding-row" key={field.key} data-ui-binding={field.key}>
        <div className="ui-binding-heading"><strong>{field.label}</strong><label><input type="checkbox" aria-label={`${field.label}：使用数据绑定`} checked={!!binding} onChange={event => changeNode(event.target.checked ? '启用数据绑定' : '解除数据绑定', item => {
          if (event.target.checked) { item.bindings ??= {}; item.bindings[field.key] = { source: `${item.id}.${field.key}` }; }
          else { delete item.bindings?.[field.key]; if (item.bindings && !Object.keys(item.bindings).length) delete item.bindings; }
        })} />使用绑定</label></div>
        {binding && <>
          <label className="text-field"><span>数据名称</span><input aria-label={`${field.label}：数据名称`} value={binding.source} onChange={event => changeNode('修改绑定名称', item => { item.bindings![field.key].source = event.target.value; })} /></label>
          <label className="text-field"><span>模拟值（同名绑定共用）</span><input aria-label={`${field.label}：模拟值`} type={field.valueType === 'number' ? 'number' : 'text'} value={simulated == null ? '' : String(simulated)} disabled={!binding.source} onChange={event => writeValue(field, binding.source, event.target.value)} /></label>
          <div className="ui-binding-actions"><button type="button" disabled={!binding.source || simulated === undefined} onClick={() => { store.mutate('清除绑定模拟值', draft => { if (draft.previewContext) delete draft.previewContext[binding.source]; }); onChanged(); }}>清除模拟值</button>
          {binding.fallback !== undefined && <button type="button" onClick={() => changeNode('清除绑定备用值', item => { delete item.bindings![field.key].fallback; })}>使用静态属性作为备用值</button>}</div>
          <small>{demoOverrides ? '当前演示会话覆盖模拟值；关闭演示数据后可查看模拟值。' : `当前显示：${String(simulated ?? binding.fallback ?? (field.propertyPath ? node.props[field.propertyPath] : '') ?? '')}`}</small>
          {binding.fallback !== undefined && <small>原有绑定备用值：{String(binding.fallback)}</small>}
        </>}
      </div>;
    })}
  </div>;
}
