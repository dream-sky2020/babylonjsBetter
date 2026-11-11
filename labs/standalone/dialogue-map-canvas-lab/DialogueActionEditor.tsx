import { useState } from 'react';
import type { DialogueMapAction } from '@/core/dialogue-map';
import { visualStateOperationOptions } from '@/core/entity/components/event.component';
import { sharedVariableOperationOptions } from '@/core/entity/components/shared-variable.component';
import { InspectorGroup } from './InspectorGroup';

const defaults: Record<DialogueMapAction['type'], DialogueMapAction> = {
  message: { type: 'message', text: '' },
  'visual-state': { type: 'visual-state', targetEntityId: '', stateId: '' },
  'shared-variable': { type: 'shared-variable', variableId: '' },
  service: { type: 'service', commandId: 'obstacle.set-active', parameters: { entityId: '', active: false } },
};

function JsonParameters({ parameters, onChange }: { parameters?: Record<string, unknown>; onChange(value: Record<string, unknown>): void }) {
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState('');
  return <label className="field"><span>参数（JSON 对象）</span><textarea value={draft ?? JSON.stringify(parameters ?? {}, null, 2)}
    onChange={e => setDraft(e.target.value)} onBlur={() => {
      if (draft === undefined) return;
      try {
        const value: unknown = JSON.parse(draft);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        onChange(value as Record<string, unknown>); setDraft(undefined); setError('');
      } catch { setError('请输入有效的 JSON 对象。'); }
    }} />{error ? <span role="alert">{error}</span> : null}</label>;
}

export function DialogueActionEditor({ action, onChange }: { action?: DialogueMapAction; onChange(value?: DialogueMapAction): void }) {
  const text = (label: string, value: string | undefined, update: (value: string) => void) =>
    <label className="field"><span>{label}</span><input value={value ?? ''} onChange={e => update(e.target.value)} /></label>;
  return <InspectorGroup title="执行地图动作">
    <label className="field"><span>动作类型</span><select value={action?.type ?? ''} onChange={e => onChange(structuredClone(defaults[e.target.value as keyof typeof defaults]))}>
      <option value="">选择动作</option><option value="message">显示消息</option><option value="visual-state">视觉状态</option>
      <option value="shared-variable">共享变量</option><option value="service">调用公开服务操作</option>
    </select></label>
    {action?.type === 'message' ? <>
      {text('消息文字', action.text, value => onChange({ ...action, text: value }))}
      <label className="field"><span>停留秒数（可选）</span><input type="number" min={0.5} max={15} step={0.5} value={action.durationSeconds ?? ''} onChange={e => onChange({ ...action, durationSeconds: e.target.value ? Number(e.target.value) : undefined })} /></label>
    </> : null}
    {action?.type === 'visual-state' ? <>
      {text('视觉对象 ID', action.targetEntityId, value => onChange({ ...action, targetEntityId: value }))}
      <label className="field"><span>状态操作</span><select value={action.operation ?? 'set'} onChange={e => onChange({ ...action, operation: e.target.value as typeof action.operation })}>
        {visualStateOperationOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select></label>
      {(!action.operation || action.operation === 'set') ? text('状态 ID', action.stateId, value => onChange({ ...action, stateId: value })) : text('轮替组 ID', action.groupId, value => onChange({ ...action, groupId: value }))}
      {text('成功提示（可选）', action.feedback, value => onChange({ ...action, feedback: value || undefined }))}
    </> : null}
    {action?.type === 'shared-variable' ? <>
      {text('变量 ID', action.variableId, value => onChange({ ...action, variableId: value }))}
      <label className="field"><span>变量操作</span><select value={action.variableOperation ?? 'set'} onChange={e => onChange({ ...action, variableOperation: e.target.value as typeof action.variableOperation, value: undefined })}>
        {sharedVariableOperationOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select></label>
      {(!action.variableOperation || action.variableOperation === 'set') ? <label className="field"><span>值类型</span><select value={typeof (action.value ?? 0)} onChange={e => onChange({ ...action, value: e.target.value === 'string' ? '' : e.target.value === 'boolean' ? false : 0 })}>
        <option value="number">整数</option><option value="boolean">布尔值</option><option value="string">字符串</option>
      </select></label> : null}
      {(!action.variableOperation || action.variableOperation === 'set' || action.variableOperation === 'add') ? typeof action.value === 'boolean'
        ? <label><input type="checkbox" checked={action.value} onChange={e => onChange({ ...action, value: e.target.checked })} />值</label>
        : typeof action.value === 'string' ? text('值', action.value, value => onChange({ ...action, value }))
          : <label className="field"><span>整数值</span><input type="number" step={1} value={action.value ?? ''} onChange={e => onChange({ ...action, value: e.target.value ? Math.trunc(Number(e.target.value)) : undefined })} /></label> : null}
    </> : null}
    {action?.type === 'service' ? <>
      {text('公开操作 ID', action.commandId, value => onChange({ ...action, commandId: value }))}
      {action.commandId === 'obstacle.set-active' ? <>
        {text('障碍实体 ID', String(action.parameters?.entityId ?? ''), value => onChange({ ...action, parameters: { active: false, ...action.parameters, entityId: value } }))}
        <label><input type="checkbox" checked={action.parameters?.active === true} onChange={e => onChange({ ...action, parameters: { ...action.parameters, active: e.target.checked } })} />启用障碍</label>
      </> : <JsonParameters key={action.commandId} parameters={action.parameters} onChange={parameters => onChange({ ...action, parameters })} />}
      {text('成功提示（可选）', action.successMessage, value => onChange({ ...action, successMessage: value || undefined }))}
    </> : null}
  </InspectorGroup>;
}
