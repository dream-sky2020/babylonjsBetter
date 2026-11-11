import { useId, useRef, useState, type Ref } from 'react';
import { dialogueTextVariableNames, isDialogueTextVariableName, type DialogueTextBindings } from '@/core/dialogue-map';
import { dialogueRuleCatalog } from './dialogueRuleCatalog';

const emptyBindings: DialogueTextBindings = {};

export function DialogueTextBindingsEditor({ bindings = emptyBindings, onChange, panelRef }: {
  bindings?: DialogueTextBindings; onChange(bindings: DialogueTextBindings): void; panelRef: Ref<HTMLDetailsElement>;
}) {
  const [name, setName] = useState('');
  const keyOptions = useId();
  const alias = name.trim();
  return <details className="create-preset" ref={panelRef}>
    <summary>文本变量（{Object.keys(bindings).length}）</summary>
    <div className="create-preset__body">
      <label className="field"><span>变量名称</span><input value={name} placeholder="例如 石障计数" onChange={event => setName(event.target.value)} /></label>
      <button disabled={!isDialogueTextVariableName(alias) || Object.hasOwn(bindings, alias)} onClick={() => {
        onChange({ ...bindings, [alias]: { key: '', path: [] } });
        setName('');
      }}>添加变量绑定</button>
      <datalist id={keyOptions}>{dialogueRuleCatalog.memories.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</datalist>
      {Object.entries(bindings).map(([id, binding]) => <fieldset key={id} className="dialogue-rule-value">
        <legend>{`{${id}}`}</legend>
        <label className="field"><span>共享内存 Key</span><input list={keyOptions} value={binding.key} onChange={event =>
          onChange({ ...bindings, [id]: { ...binding, key: event.target.value } })} /></label>
        <label className="field"><span>字段路径（留空读取根值）</span><input value={binding.path.join('.')} onChange={event =>
          onChange({ ...bindings, [id]: { ...binding, path: event.target.value ? event.target.value.split('.') : [] } })} /></label>
        <button onClick={() => onChange(Object.fromEntries(Object.entries(bindings).filter(([key]) => key !== id)))}>删除绑定</button>
      </fieldset>)}
    </div>
  </details>;
}

export function DialogueLineTextEditor({ text, bindings = emptyBindings, onChange, manage, label = '对白内容', rows = 7, showMissing = true }: {
  text: string; bindings?: DialogueTextBindings; onChange(text: string): void; manage(): void; label?: string; rows?: number; showMissing?: boolean;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState('');
  const missing = showMissing ? dialogueTextVariableNames(text).filter(id => !Object.hasOwn(bindings, id)) : [];
  const insert = () => {
    const field = textarea.current;
    if (!field || !Object.hasOwn(bindings, name)) return;
    const start = field.selectionStart;
    const token = `{${name}}`;
    onChange(text.slice(0, start) + token + text.slice(field.selectionEnd));
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + token.length, start + token.length); });
  };
  return <>
    <label className="field"><span>{label}</span><textarea ref={textarea} rows={rows} value={text} onChange={event => onChange(event.target.value)} /></label>
    <div className="collection-actions">
      <select aria-label="选择文本变量" value={Object.hasOwn(bindings, name) ? name : ''} onChange={event => setName(event.target.value)}>
        <option value="">选择文本变量</option>
        {Object.keys(bindings).map(id => <option key={id} value={id}>{`{${id}}`}</option>)}
      </select>
      <button disabled={!Object.hasOwn(bindings, name)} onClick={insert}>插入变量</button>
      <button onClick={manage}>管理变量</button>
    </div>
    {missing.length ? <p>未绑定的文本变量：{missing.join('、')}</p> : null}
  </>;
}
