import { useState, type CSSProperties } from 'react';
import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import { basicUiMetadata } from '../metadata';
import './labSaveList.css';

export type LabSaveListRow = {
  id: string;
  name: string;
  map: string | null;
  version: number;
  createdAt: string;
  runTimeMs: number | null;
  saveCount: number | null;
};

export type LabSaveListModel = {
  rows: LabSaveListRow[];
  directory: string;
  directoryReady: boolean;
  canChooseDirectory: boolean;
  selected: string | null;
  busy: boolean;
  message: string;
};

const empty: LabSaveListModel = {
  rows: [], directory: '', directoryReady: false, canChooseDirectory: false, selected: null, busy: false, message: '',
};
const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

function duration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}

const savedTime = (date: string) => Number.isFinite(Date.parse(date)) ? dateFormat.format(new Date(date)) : '—';

export default function LabSaveList({ node, runtime, onAction }: UiReactComponentProps) {
  const binding = node.bindings?.model;
  const data = runtime.resolveBinding(binding?.source ?? '', binding?.fallback ?? '');
  let model = empty;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as LabSaveListModel | null;
      if (parsed && Array.isArray(parsed.rows)) {
        model = { ...empty, ...parsed, rows: parsed.rows.filter(row => row && typeof row.id === 'string' && typeof row.name === 'string') };
      }
    } catch { /* An unbound or malformed editor preview shows the empty state. */ }
  }
  const [name, setName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const props = node.props;
  const styling = {
    '--save-bg': props.fill,
    '--save-border': props.stroke,
    '--save-text': props.textColor,
    '--save-accent': props.accent,
    fontSize: Number(props.fontSize),
    borderRadius: Number(props.cornerRadius),
    borderWidth: Number(props.strokeWidth),
  } as CSSProperties;
  const disabled = model.busy || !onAction;
  const filesDisabled = disabled || !model.directoryReady;
  const selected = model.rows.find(row => row.id === model.selected);
  const pendingDelete = selected && selected.id === deleteId ? selected : undefined;
  return <section className="lab-save-list" style={styling} aria-label="Lab 存档" aria-busy={model.busy}>
    <header className="lab-save-list-heading">
      <div><h2>{String(props.content || 'Lab 存档')}</h2><p title={model.directory}>{model.directory}</p></div>
      <div className="lab-save-list-actions">
        {model.canChooseDirectory && <button type="button" data-lab-slot-action="choose-directory" disabled={disabled || Boolean(pendingDelete)}
          onClick={() => onAction?.('choose-directory')}>选择存档目录</button>}
        <button type="button" data-lab-slot-action="close" disabled={disabled} onClick={() => onAction?.('close')}>关闭</button>
      </div>
    </header>
    <div className="lab-save-list-records" aria-label="存档列表">
      {model.rows.length ? <>
        <div className="lab-save-list-columns" aria-hidden="true"><span>存档</span><span>运行时间</span><span>保存时间</span><span>次数</span><span>版本</span></div>
        {model.rows.map(row => <button type="button" key={row.id} className="lab-save-list-row"
          data-lab-slot-id={row.id} title={row.id} aria-pressed={selected?.id === row.id} disabled={disabled || Boolean(pendingDelete)}
          onClick={() => onAction?.(`select:${row.id}`)}>
          <span><strong>{row.name}</strong>{row.map && <small>{row.map}</small>}</span>
          <span>{duration(row.runTimeMs)}</span>
          <span>{savedTime(row.createdAt)}</span>
          <span>{row.saveCount ?? '—'}</span>
          <span>v{row.version}</span>
        </button>)}
      </> : <p className="lab-save-list-empty">{model.busy ? '正在准备存档列表……' : model.directoryReady
        ? '这个目录还没有当前 Lab 的存档。'
        : model.canChooseDirectory ? '先选择或重新授权一个目录，即可查看和保存存档。' : model.directory}</p>}
    </div>
    {pendingDelete ? <div className="lab-save-list-actions lab-save-list-confirmation" role="group" aria-label="确认删除存档">
      <span>删除「{pendingDelete.name}」？此操作无法撤销。</span>
      <button type="button" data-lab-slot-action="delete-cancel" onClick={() => setDeleteId(null)}>取消</button>
      <button type="button" data-lab-slot-action="delete-confirm" disabled={filesDisabled} onClick={() => {
        setDeleteId(null);
        onAction?.(`delete:${pendingDelete.id}`);
      }}>确认删除</button>
    </div> : <form className="lab-save-list-actions" onSubmit={event => { event.preventDefault(); if (!filesDisabled) onAction?.(`create:${name.trim()}`); }}>
      <input aria-label="存档名称" placeholder="存档名称（可选）" maxLength={80} value={name}
        disabled={filesDisabled} onChange={event => setName(event.target.value)} />
      <button type="submit" data-lab-slot-action="create" disabled={filesDisabled}>新建存档</button>
      <button type="button" data-lab-slot-action="refresh" disabled={filesDisabled} onClick={() => onAction?.('refresh')}>刷新</button>
      <button type="button" data-lab-slot-action="overwrite" disabled={filesDisabled || !selected} onClick={() => onAction?.('overwrite')}>覆盖所选</button>
      <button type="button" data-lab-slot-action="load" disabled={filesDisabled || !selected} onClick={() => onAction?.('load')}>读取所选</button>
      <button type="button" data-lab-slot-action="delete" disabled={filesDisabled || !selected}
        onClick={() => { if (selected) setDeleteId(selected.id); }}>删除所选</button>
    </form>}
    <p className="lab-save-list-status" data-lab-slot-status role="status">{model.message}</p>
  </section>;
}

const base = basicUiMetadata('label');
// eslint-disable-next-line react-refresh/only-export-components
export const ui = {
  ...base, type: 'lab-save-list', label: 'Lab 存档列表', defaultSize: { width: 860, height: 540 },
  bindableFields: [{ key: 'model', label: '存档菜单数据（JSON）', propertyPath: 'content', valueType: 'string' as const }],
};
