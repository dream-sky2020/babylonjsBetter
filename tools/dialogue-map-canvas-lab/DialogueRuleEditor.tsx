import { useId, useState } from 'react';
import type { DialogueCondition, DialogueEffect, DialogueEditorNode, DialogueScalar, DialogueValue, DialogueEditorSelection } from '../../core/dialogue-map/dialogueMap.types';
import { InspectorGroup } from './InspectorGroup';
import { dialogueRuleCatalog as catalog } from './dialogueRuleCatalog';

const scalarDefault = (type: string): DialogueScalar => type === 'number' ? 0 : type === 'boolean' ? false : type === 'null' ? null : '';
const newDialogueComparison = (): DialogueCondition => ({
  type: 'compare', left: { type: 'memory', key: '', path: [] }, operator: 'eq', right: { type: 'literal', value: 0 },
});
const valueType = (value: DialogueValue) => value.type === 'literal' ? (value.value === null ? 'null' : typeof value.value)
  : catalog.memories.find(item => item.key === value.key)?.fields.find(field => field.path.join('.') === value.path.join('.'))?.valueType;

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
      <label className="field"><span>字段路径（以点分隔）</span>
        <input list={`${id}-fields`} value={value.path.join('.')} onChange={e => onChange({ ...value, path: e.target.value ? e.target.value.split('.') : [] })} />
        <datalist id={`${id}-fields`}>{memory?.fields.map(field => <option key={field.path.join('.')} value={field.path.join('.')}>{field.label} · {field.valueType}</option>)}</datalist>
      </label>
      <small>{memory?.fields.find(field => field.path.join('.') === value.path.join('.'))?.valueType ?? '字段未登记，可手动配置'}</small>
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

export function ComparisonEditor({ value, onChange }: { value: Extract<DialogueCondition, { type: 'compare' }>; onChange(value: Extract<DialogueCondition, { type: 'compare' }>): void }) {
  const numericComparison = [value.left, value.right].every(item => !valueType(item) || valueType(item) === 'number');
  return <>
    <ValueEditor label="左侧" value={value.left} onChange={left => onChange({ ...value, left })} />
    <label className="field"><span>比较方式</span><select value={value.operator} onChange={e => onChange({ ...value, operator: e.target.value as typeof value.operator })}>
      <option value="eq">等于 =</option><option value="ne">不等于 ≠</option>
      <option value="gt" disabled={!numericComparison}>大于 &gt;</option><option value="gte" disabled={!numericComparison}>大于等于 ≥</option><option value="lt" disabled={!numericComparison}>小于 &lt;</option><option value="lte" disabled={!numericComparison}>小于等于 ≤</option>
    </select></label>
    <ValueEditor label="右侧" value={value.right} onChange={right => onChange({ ...value, right })} />
  </>;
}

export function ConditionEditor({ value, onChange }: { value: DialogueCondition; onChange(value: DialogueCondition): void }) {
  const conditions = value.type === 'compare' ? [value] : value.conditions;
  const mode = value.type === 'compare' ? 'all' : value.type;
  return <div className="dialogue-rule-condition">
    <label className="field"><span>满足方式</span><select aria-label="满足方式" value={mode} onChange={e => onChange({ type: e.target.value as 'all' | 'any', conditions })}>
      <option value="all">全部满足</option><option value="any">任一满足</option>
    </select></label>
    {conditions.map((child, index) => <div className="dialogue-rule-child" key={index}>
      <div className="dialogue-rule-heading"><strong>条件 {index + 1}</strong><button onClick={() => onChange({ type: mode, conditions: conditions.filter((_, i) => i !== index) })}>删除</button></div>
      <ComparisonEditor value={child} onChange={next => onChange({ type: mode, conditions: conditions.map((item, i) => i === index ? next : item) })} />
    </div>)}
    <button onClick={() => onChange({ type: mode, conditions: [...conditions, newDialogueComparison() as Extract<DialogueCondition, { type: 'compare' }>] })}>添加条件</button>
    <p>复杂组合可通过成立／不成立出口连接其他判断卡片。</p>
  </div>;
}

function EventReference({ eventType, version, onChange }: { eventType: string; version: number; onChange(eventType: string, version: number): void }) {
  const id = useId();
  return <>
    <label className="field"><span>事件名称（可搜索或手动填写）</span>
      <input list={id} value={eventType} onChange={e => onChange(e.target.value, version)} />
      <datalist id={id}>{catalog.events.map(item => <option key={`${item.eventType}@${item.version}`} value={item.eventType}>{item.label} · @{item.version}</option>)}</datalist>
    </label>
    <label className="field"><span>协议版本</span><input type="number" min={1} step={1} value={version} onChange={e => onChange(eventType, Number(e.target.value))} /></label>
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

export function EffectEditor({ effect, onChange }: { effect: DialogueEffect; onChange(effect: DialogueEffect): void }) {
  const payload = effect.payload ?? {};
  const entry = catalog.events.find(item => item.eventType === effect.eventType && item.version === effect.version);
  const addParameter = () => {
    const field = entry?.fields.find(item => !Object.hasOwn(payload, item.name));
    let name = field?.name ?? 'parameter';
    for (let i = 1; Object.hasOwn(payload, name); i++) name = `parameter_${i}`;
    onChange({ ...effect, payload: { ...payload, [name]: { type: 'literal', value: scalarDefault(field?.valueType ?? 'string') } } });
  };
  return <>
    <EventReference eventType={effect.eventType} version={effect.version} onChange={(eventType, version) => onChange({ ...effect, eventType, version })} />
    {entry ? <p>协议参数：{entry.fields.map(field => `${field.name} (${field.valueType}${field.nullable ? ' | null' : ''}${field.required ? '，必需' : ''})`).join('、')}</p> : <p>事件未登记，可手动配置参数。</p>}
    {Object.entries(payload).map(([name, value]) => <ParameterEditor key={name} name={name} value={value} names={Object.keys(payload)}
      onChange={next => onChange({ ...effect, payload: { ...payload, [name]: next } })}
      onRename={next => onChange({ ...effect, payload: Object.fromEntries(Object.entries(payload).map(([key, item]) => [key === name ? next : key, item])) })}
      onDelete={() => onChange({ ...effect, payload: Object.fromEntries(Object.entries(payload).filter(([key]) => key !== name)) })} />)}
    <button onClick={addParameter}>添加参数</button>
  </>;
}

export function DialogueRuleEditor({ node, onChange }: { node: DialogueEditorNode; onChange(node: DialogueEditorNode): void }) {
  if (node.kind === 'condition') return <section className="dialogue-rule-editor" aria-label="判断条件">
    <h3>判断条件</h3>
    {node.condition ? <><ConditionEditor value={node.condition} onChange={condition => onChange({ ...node, condition })} />
      <button onClick={() => onChange({ ...node, condition: undefined })}>清除条件</button></>
      : <button onClick={() => onChange({ ...node, condition: newDialogueComparison() })}>添加条件</button>}
  </section>;
  if (node.kind === 'event') return <EventNodeEditor node={node} onChange={onChange} />;
  return null;
}

export function EventNodeEditor({ node, onChange, selection, onSelection }: {
  node: Extract<DialogueEditorNode, { kind: 'event' }>;
  onChange(node: DialogueEditorNode): void;
  selection?: DialogueEditorSelection;
  onSelection?(selection: DialogueEditorSelection): void;
}) {
  const [localSelection, setLocalSelection] = useState<DialogueEditorSelection>({ kind: 'event', nodeId: node.id, eventIndex: 0 });
  const active = selection ?? localSelection;
  const select = (next: DialogueEditorSelection) => { setLocalSelection(next); onSelection?.(next); };
  const index = active.kind === 'event' ? active.eventIndex ?? 0 : undefined;
  const focused = active.kind === 'event' || active.kind === 'event-mode';
  return <InspectorGroup title="事件" count={node.events.length} focused={focused} focusToken={active}>
    <label className="field"><span>事件模式</span><select aria-label="事件模式" value={node.mode} onChange={e => {
      const mode = e.target.value as 'send' | 'wait';
      if (mode === 'wait' && node.events.length !== 1) return;
      onChange({ ...node, mode }); select({ kind: 'event-mode', nodeId: node.id });
    }}>
      <option value="send">触发事件</option><option value="wait" disabled={node.events.length !== 1}>等待事件</option>
    </select></label>
    <p>{node.mode === 'send' ? '按列表顺序触发事件，全部触发后继续。' : '等待指定名称和版本的事件；参数作为匹配条件。'}</p>
    {node.events.length > 1 ? <p>切换为等待模式前，请保留一个事件。</p> : null}
    <div className="collection-actions">
      {node.mode === 'send' ? <button onClick={() => {
        onChange({ ...node, events: [...node.events, { type: 'event', eventType: '', version: 1 }] });
        select({ kind: 'event', nodeId: node.id, eventIndex: node.events.length });
      }}>添加事件</button> : null}
      <select aria-label="选择事件" value={index === undefined ? '' : String(index)} onChange={e => { if (e.target.value !== '') select({ kind: 'event', nodeId: node.id, eventIndex: Number(e.target.value) }); }}>
        <option value="">选择事件</option>
        {node.events.map((event, i) => <option key={i} value={i}>事件 {i + 1} · {event.eventType || '未设置事件'}</option>)}
      </select>
      {node.mode === 'send' ? <button disabled={index === undefined || node.events.length <= 1} onClick={() => {
        if (index === undefined || node.events.length <= 1) return;
        onChange({ ...node, events: node.events.filter((_, i) => i !== index) });
        select({ kind: 'event-mode', nodeId: node.id });
      }}>删除选中事件</button> : null}
    </div>
    <div className="inspector-collection">
      {node.events.map((effect, i) => <InspectorGroup key={`${node.id}:event:${i}`} title={`事件 ${i + 1}`} focused={index === i} focusToken={active}>
        <EffectEditor effect={effect} onChange={next => onChange({ ...node, events: node.events.map((event, j) => i === j ? next : event) })} />
      </InspectorGroup>)}
    </div>
  </InspectorGroup>;
}
