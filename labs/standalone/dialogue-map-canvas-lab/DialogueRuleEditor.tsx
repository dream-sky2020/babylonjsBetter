import { useId, useState } from 'react';
import type { DialogueEffect, DialogueEditorNode, DialogueEventWait, DialogueScalar, DialogueValue, DialogueEditorSelection } from '../../../core/dialogue-map/dialogueMap.types';
import { dialogueOutputPortId } from '../../../core/dialogue-map/dialogueMap';
import { dialogueComparisonOperators } from '../../../core/dialogue-map/dialogueRules';
import { InspectorGroup } from './InspectorGroup';
import { dialogueRuleCatalog as catalog, dialogueEventsForTarget, type DialogueLabTarget } from './dialogueRuleCatalog';

const scalarDefault = (type: string): DialogueScalar => type === 'number' ? 0 : type === 'boolean' ? false : type === 'null' ? null : '';
function ValueEditor({ label, value, onChange }: { label: string; value: DialogueValue; onChange(value: DialogueValue): void }) {
  const id = useId();
  const memory = value.type === 'memory' ? catalog.memories.find(item => item.key === value.key) : undefined;
  const scalarType = value.type === 'literal' ? value.value === null ? 'null' : typeof value.value : undefined;
  return <fieldset className="dialogue-rule-value"><legend>{label}</legend>
    <select aria-label={`${label}值来源`} value={value.type} onChange={e => onChange(e.target.value === 'memory'
      ? { type: 'memory', key: '', path: [] } : { type: 'literal', value: 0 })}>
      <option value="literal">常量</option><option value="memory">共享内存字段</option>
    </select>
    {value.type === 'memory' ? <>
      <label className="field"><span>共享内存 Key（可搜索或手动填写）</span>
        <input list={`${id}-memories`} value={value.key} onChange={e => onChange({ ...value, key: e.target.value })} />
        <datalist id={`${id}-memories`}>{catalog.memories.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</datalist>
      </label>
      <label className="field"><span>字段路径（留空读取根值，以点分隔）</span>
        <input list={`${id}-fields`} value={value.path.join('.')} onChange={e => onChange({ ...value, path: e.target.value ? e.target.value.split('.') : [] })} />
        <datalist id={`${id}-fields`}>{memory?.fields.map(field => <option key={field.path.join('.')} value={field.path.join('.')}>{field.label} · {field.valueType}</option>)}</datalist>
      </label>
      <small>{memory?.fields.find(field => field.path.join('.') === value.path.join('.'))?.valueType ?? (value.path.length ? '字段未登记，可手动配置' : '读取根值，适用于数字、字符串、布尔值和 null')}</small>
    </> : <>
      <select aria-label={`${label}常量类型`} value={scalarType} onChange={e => onChange({ type: 'literal', value: scalarDefault(e.target.value) })}>
        <option value="number">数字</option><option value="string">字符串</option><option value="boolean">布尔值</option><option value="null">null</option>
      </select>
      {scalarType === 'boolean' ? <select aria-label={`${label}常量值`} value={String(value.value)} onChange={e => onChange({ type: 'literal', value: e.target.value === 'true' })}>
        <option value="true">true</option><option value="false">false</option>
      </select> : scalarType === 'null' ? <small>null</small> :
        <input aria-label={`${label}常量值`} type={scalarType === 'number' ? 'number' : 'text'} step="any" value={String(value.value)}
          onChange={e => onChange({ type: 'literal', value: scalarType === 'number' ? Number(e.target.value) : e.target.value })} />}
    </>}
  </fieldset>;
}

function EventReference({ eventType, version, publish = false, target, onChange }: { eventType: string; version: number; publish?: boolean; target: DialogueLabTarget; onChange(eventType: string, version: number): void }) {
  const id = useId();
  const available = dialogueEventsForTarget(target);
  return <>
    <label className="field"><span>事件名称（可搜索或手动填写）</span>
      <input list={id} value={eventType} onChange={e => onChange(e.target.value, version)} />
      <datalist id={id}>{available.filter(item => !publish || item.publish !== false).map(item => <option key={`${item.eventType}@${item.version}`} value={item.eventType}>{item.label} · @{item.version}</option>)}</datalist>
    </label>
    <label className="field"><span>协议版本</span><input type="number" min={1} step={1} value={version} onChange={e => onChange(eventType, Number(e.target.value))} /></label>
    {target !== 'all' && eventType && !available.some(item => item.eventType === eventType && item.version === version) ? <p>目标 Lab 的事件目录里没有此协议，请确认发布模块。</p> : null}
  </>;
}

function ParameterEditor({ name, value, names, onRename, onChange, onDelete }: {
  name: string; value: DialogueValue; names: string[]; onRename(name: string): void; onChange(value: DialogueValue): void; onDelete(): void;
}) {
  const [draft, setDraft] = useState(name);
  const next = draft.trim();
  const invalid = !next || (next !== name && names.includes(next));
  return <div className="dialogue-rule-child">
    <label className="field"><span>参数名</span><input value={draft} onChange={e => setDraft(e.target.value)} /></label>
    <div className="dialogue-rule-actions"><button disabled={invalid || next === name} onClick={() => onRename(next)}>修改名称</button><button onClick={onDelete}>删除参数</button></div>
    {invalid ? <p role="alert">参数名不能为空或与其他参数重复。</p> : null}
    <ValueEditor label={name} value={value} onChange={onChange} />
  </div>;
}

export function EffectEditor({ effect, target = 'all', onChange }: { effect: DialogueEffect; target?: DialogueLabTarget; onChange(effect: DialogueEffect): void }) {
  const payload = effect.payload ?? {};
  const entry = catalog.events.find(item => item.eventType === effect.eventType && item.version === effect.version);
  const addParameter = () => {
    const field = entry?.fields.find(item => !Object.hasOwn(payload, item.name));
    let name = field?.name ?? 'parameter';
    for (let i = 1; Object.hasOwn(payload, name); i++) name = `parameter_${i}`;
    onChange({ ...effect, payload: { ...payload, [name]: { type: 'literal', value: scalarDefault(field?.valueType ?? 'string') } } });
  };
  return <>
    <EventReference publish target={target} eventType={effect.eventType} version={effect.version} onChange={(eventType, version) => onChange({ ...effect, eventType, version })} />
    <label className="field"><span>关联 ID（可选）</span><input value={effect.correlationId ?? ''} onChange={e => onChange({ ...effect, correlationId: e.target.value || undefined })} /></label>
    {entry ? <p>协议参数：{entry.fields.map(field => `${field.name} (${field.valueType}${field.nullable ? ' | null' : ''}${field.required ? '，必需' : ''})`).join('、')}</p> : <p>事件未登记，可手动配置参数。</p>}
    {Object.entries(payload).map(([name, value]) => <ParameterEditor key={name} name={name} value={value} names={Object.keys(payload)}
      onChange={next => onChange({ ...effect, payload: { ...payload, [name]: next } })}
      onRename={next => onChange({ ...effect, payload: Object.fromEntries(Object.entries(payload).map(([key, item]) => [key === name ? next : key, item])) })}
      onDelete={() => onChange({ ...effect, payload: Object.fromEntries(Object.entries(payload).filter(([key]) => key !== name)) })} />)}
    <button onClick={addParameter}>添加参数</button>
  </>;
}

type WaitNode = Extract<DialogueEditorNode, { kind: 'event'; mode: 'wait' }>;

function WaitEventEditor({ node, target, onChange }: { node: WaitNode; target: DialogueLabTarget; onChange(node: WaitNode): void }) {
  const event = node.events[0], wait = node.wait, id = useId();
  const entry = catalog.events.find(item => item.eventType === event.eventType && item.version === event.version);
  const change = (patch: Partial<DialogueEventWait>) => onChange({ ...node, wait: { ...wait, ...patch } });
  const setTimeout = (enabled: boolean) => {
    const portId = [...node.outputs.values()].find(port => port.branch === 'timeout')?.id ?? dialogueOutputPortId(node.id, 'timeout'), outputs = new Map(node.outputs);
    const outputOrder = node.outputOrder.filter(id => id !== portId);
    if (enabled) { outputs.set(portId, { id: portId, label: '超时', branch: 'timeout' }); outputOrder.push(portId); }
    else outputs.delete(portId);
    onChange({ ...node, outputs, outputOrder, wait: { ...wait, timeoutMs: enabled ? 30_000 : undefined } });
  };
  return <>
    <EventReference target={target} eventType={event.eventType} version={event.version} onChange={(eventType, version) => onChange({ ...node, events: [{ type: 'event', eventType, version }] })} />
    {!entry && event.eventType ? <p>协议未登记，请确认目标 Lab 有模块发布它。</p> : null}
    <label className="field"><span>发布模块 ID（可选）</span><input value={wait.sourceModuleId ?? ''} onChange={e => change({ sourceModuleId: e.target.value || undefined })} /></label>
    <label className="field"><span>关联 ID（可选）</span><input value={wait.correlationId ?? ''} onChange={e => change({ correlationId: e.target.value || undefined })} /></label>
    <label><input type="checkbox" checked={wait.allowMovement ?? false} onChange={e => change({ allowMovement: e.target.checked })} />等待时允许移动</label>
    <label><input type="checkbox" checked={wait.timeoutMs !== undefined} onChange={e => setTimeout(e.target.checked)} />启用超时出口</label>
    {wait.timeoutMs !== undefined ? <label className="field"><span>超时毫秒数</span><input type="number" min={0} max={2_147_483_647} step={1} value={wait.timeoutMs} onChange={e => change({ timeoutMs: Math.min(2_147_483_647, Math.max(0, Math.trunc(Number(e.target.value)))) })} /></label> : null}
    <p>收到的消息必须满足全部匹配条件。</p>
    <datalist id={id}>{entry?.fields.map(field => <option key={field.name} value={field.name}>{field.valueType}</option>)}</datalist>
    {wait.filters.map((filter, index) => {
      const update = (patch: Partial<typeof filter>) => change({ filters: wait.filters.map((item, i) => i === index ? { ...item, ...patch } : item) });
      return <div className="dialogue-rule-child" key={index}>
        <label className="field"><span>事件字段</span><input list={id} value={filter.field} onChange={e => update({ field: e.target.value })} /></label>
        <label className="field"><span>比较方式</span><select value={filter.operator} onChange={e => update({ operator: e.target.value as typeof filter.operator })}>
          {dialogueComparisonOperators.map((op, i) => <option key={op} value={op}>{['等于', '不等于', '大于', '大于等于', '小于', '小于等于'][i]}</option>)}
        </select></label>
        <ValueEditor label="匹配值" value={filter.value} onChange={value => update({ value })} />
        <button onClick={() => change({ filters: wait.filters.filter((_, i) => i !== index) })}>删除匹配条件</button>
      </div>;
    })}
    <button onClick={() => {
      const field = entry?.fields.find(item => !wait.filters.some(filter => filter.field === item.name));
      change({ filters: [...wait.filters, { field: field?.name ?? '', operator: 'eq', value: { type: 'literal', value: scalarDefault(field?.valueType ?? 'string') } }] });
    }}>添加匹配条件</button>
  </>;
}

export function EventNodeEditor({ node, onChange, selection, onSelection, target = 'all' }: {
  node: Extract<DialogueEditorNode, { kind: 'event' }>;
  onChange(node: DialogueEditorNode): void;
  selection?: DialogueEditorSelection;
  onSelection?(selection: DialogueEditorSelection): void;
  target?: DialogueLabTarget;
}) {
  const [localSelection, setLocalSelection] = useState<DialogueEditorSelection>({ kind: 'event', nodeId: node.id, eventIndex: 0 });
  const active = selection ?? localSelection;
  const select = (next: DialogueEditorSelection) => { setLocalSelection(next); onSelection?.(next); };
  const index = active.kind === 'event' ? active.eventIndex ?? 0 : undefined;
  const focused = active.kind === 'event' || active.kind === 'event-mode';
  if (node.mode === 'wait') return <InspectorGroup title="等待事件" focused={focused} focusToken={active}><WaitEventEditor node={node} target={target} onChange={onChange} /></InspectorGroup>;
  return <InspectorGroup property={{ nodeId: node.id, scope: 'events' }} title="发布事件" count={node.events.length} focused={focused} focusToken={active}>
    <label className="field"><span>事件模式</span><select aria-label="事件模式" value={node.mode} onChange={e => {
      const mode = e.target.value as 'send' | 'wait';
      if (mode !== 'wait' || node.events.length !== 1) return;
      const [{ type, eventType, version, payload }] = node.events;
      onChange({ ...node, mode, events: [{ type, eventType, version }], wait: { filters: Object.entries(payload ?? {}).map(([field, value]) => ({ field, value, operator: 'eq' })) } });
      select({ kind: 'event-mode', nodeId: node.id });
    }}>
      <option value="send">发布事件</option><option value="wait" disabled={node.events.length !== 1}>等待事件</option>
    </select></label>
    <p>按列表顺序发布事件。</p>
    {node.events.length > 1 ? <p>切换为等待模式前，请保留一个事件。</p> : null}
    <div className="collection-actions">
      <button onClick={() => {
        onChange({ ...node, events: [...node.events, { type: 'event', eventType: '', version: 1 }] });
        select({ kind: 'event', nodeId: node.id, eventIndex: node.events.length });
      }}>添加事件</button>
      <select aria-label="选择事件" value={index === undefined ? '' : String(index)} onChange={e => { if (e.target.value !== '') select({ kind: 'event', nodeId: node.id, eventIndex: Number(e.target.value) }); }}>
        <option value="">选择事件</option>
        {node.events.map((event, i) => <option key={i} value={i}>事件 {i + 1} · {event.eventType || '未设置事件'}</option>)}
      </select>
      <button disabled={index === undefined || node.events.length <= 1} onClick={() => {
        if (index === undefined || node.events.length <= 1) return;
        onChange({ ...node, events: node.events.filter((_, i) => i !== index) });
        select({ kind: 'event-mode', nodeId: node.id });
      }}>删除选中事件</button>
    </div>
    <div className="inspector-collection">
      {node.events.map((effect, i) => <InspectorGroup property={{ nodeId: node.id, scope: 'event', index: i }} key={`${node.id}:event:${i}`} title={`事件 ${i + 1}`} focused={index === i} focusToken={active}>
        <EffectEditor effect={effect} target={target} onChange={next => onChange({ ...node, events: node.events.map((event, j) => i === j ? next : event) })} />
      </InspectorGroup>)}
    </div>
  </InspectorGroup>;
}
