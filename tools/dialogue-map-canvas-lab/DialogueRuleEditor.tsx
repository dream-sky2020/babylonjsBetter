import { useId, useState } from 'react';
import type { DialogueCondition, DialogueEffect, DialogueOutputPort, DialogueScalar, DialogueValue } from '../../core/dialogue-map/dialogueMap.types';
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

function ConditionEditor({ value, onChange, depth = 0 }: { value: DialogueCondition; onChange(value: DialogueCondition): void; depth?: number }) {
  const numericComparison = value.type !== 'compare' || [value.left, value.right].every(item => !valueType(item) || valueType(item) === 'number');
  return <div className="dialogue-rule-condition">
    {value.type === 'legacy' ? <>
      <strong>旧版条件</strong><pre>{value.expression}</pre>
      <p>原字符串保留。替换为结构化条件后请重新配置字段和值。</p>
      <button onClick={() => onChange(newDialogueComparison())}>替换为比较条件</button>
    </> : <>
      <select aria-label="条件种类" value={value.type} onChange={e => {
        const type = e.target.value;
        if (type === 'compare') onChange(newDialogueComparison());
        else if (type === 'not') onChange({ type: 'not', condition: value });
        else if (type === 'all' || type === 'any') onChange({ type, conditions: value.type === 'all' || value.type === 'any' ? value.conditions : [value] });
      }}>
        <option value="compare">字段比较</option><option value="all">满足全部条件</option><option value="any">满足任一条件</option><option value="not">条件取反</option>
      </select>
      {value.type === 'compare' ? <>
        <ValueEditor label="左侧" value={value.left} onChange={left => onChange({ ...value, left })} />
        <label className="field"><span>比较方式</span><select value={value.operator} onChange={e => onChange({ ...value, operator: e.target.value as typeof value.operator })}>
          <option value="eq">等于 =</option><option value="ne">不等于 ≠</option>
          <option value="gt" disabled={!numericComparison}>大于 &gt;</option><option value="gte" disabled={!numericComparison}>大于等于 ≥</option><option value="lt" disabled={!numericComparison}>小于 &lt;</option><option value="lte" disabled={!numericComparison}>小于等于 ≤</option>
        </select></label>
        <ValueEditor label="右侧" value={value.right} onChange={right => onChange({ ...value, right })} />
      </> : value.type === 'not' ? <>
        <ConditionEditor value={value.condition} depth={depth + 1} onChange={condition => onChange({ ...value, condition })} />
        <button onClick={() => onChange(value.condition)}>取消取反</button>
      </> : value.type === 'all' || value.type === 'any' ? <>
        {value.conditions.map((child, index) => <div className="dialogue-rule-child" key={index}>
          <div className="dialogue-rule-heading"><strong>条件 {index + 1}</strong><button onClick={() => onChange({ ...value, conditions: value.conditions.filter((_, i) => i !== index) })}>删除</button></div>
          <ConditionEditor value={child} depth={depth + 1} onChange={next => onChange({ ...value, conditions: value.conditions.map((item, i) => i === index ? next : item) })} />
        </div>)}
        <div className="dialogue-rule-actions">
          <button disabled={depth >= 30} onClick={() => onChange({ ...value, conditions: [...value.conditions, newDialogueComparison()] })}>添加条件</button>
          <button disabled={depth >= 30} onClick={() => onChange({ ...value, conditions: [...value.conditions, { type: 'all', conditions: [newDialogueComparison()] }] })}>添加条件组</button>
        </div>
      </> : null}
    </>}
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

function EffectEditor({ effect, onChange }: { effect: DialogueEffect; onChange(effect: DialogueEffect): void }) {
  if (effect.type === 'legacy') return <>
    <strong>旧版效果</strong><pre>{effect.event}</pre>
    <p>转换时将此字符串作为事件名称，协议版本设为 1。</p>
    <button onClick={() => onChange({ type: 'event', eventType: effect.event, version: 1 })}>转换为事件</button>
  </>;
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

export function DialogueRuleEditor({ port, onChange }: { port: DialogueOutputPort; onChange(port: DialogueOutputPort): void }) {
  const effects = port.effects ?? [];
  const reorder = (index: number, delta: number) => {
    const next = [...effects]; [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange({ ...port, effects: next });
  };
  return <div className="dialogue-rule-editor">
    {port.activation.type === 'event' ? <section aria-label="接收事件">
      <h3>接收事件</h3><EventReference eventType={port.activation.eventType} version={port.activation.version}
        onChange={(eventType, version) => onChange({ ...port, activation: { type: 'event', eventType, version } })} />
    </section> : null}
    <section aria-label="出口条件"><div className="dialogue-rule-heading"><h3>出口条件</h3>
      {port.condition ? <button onClick={() => onChange({ ...port, condition: undefined })}>清除条件</button> : null}</div>
      {port.condition ? <ConditionEditor value={port.condition} onChange={condition => onChange({ ...port, condition })} /> : <>
        <p>始终可用</p><button onClick={() => onChange({ ...port, condition: newDialogueComparison() })}>添加条件</button>
      </>}
    </section>
    <section aria-label="触发事件"><h3>触发事件 · {effects.length}</h3><p>通过此出口时触发，按列表顺序保存。</p>
      {effects.map((effect, index) => <div className="dialogue-rule-effect" key={index}>
        <div className="dialogue-rule-heading"><strong>事件 {index + 1}</strong><div className="dialogue-rule-actions">
          <button aria-label={`上移事件 ${index + 1}`} disabled={!index} onClick={() => reorder(index, -1)}>↑</button>
          <button aria-label={`下移事件 ${index + 1}`} disabled={index === effects.length - 1} onClick={() => reorder(index, 1)}>↓</button>
          <button onClick={() => onChange({ ...port, effects: effects.filter((_, i) => i !== index) })}>删除</button>
        </div></div>
        <EffectEditor effect={effect} onChange={next => onChange({ ...port, effects: effects.map((item, i) => i === index ? next : item) })} />
      </div>)}
      <button onClick={() => onChange({ ...port, effects: [...effects, { type: 'event', eventType: '', version: 1 }] })}>添加事件</button>
    </section>
  </div>;
}
