import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { defaultUiPreviewWorkspace, normalizeUiPreviewWorkspace, uiPreviewWorkspaceKey, type UiPreviewWorkspace } from './uiPreviewWorkspace';
import './ui-preview-workbench.css';

export type UiPreviewIssue = { nodeId: string; message: string };

export function UiPreviewWorkbench({ workspace, onWorkspaceChange, documentBar, objects, components, inspector, documentSettings, viewSettings, previewStatus, status, issues, onIssueSelect, children }: {
  workspace: UiPreviewWorkspace; onWorkspaceChange: Dispatch<SetStateAction<UiPreviewWorkspace>>;
  documentBar: ReactNode; objects: ReactNode; components: ReactNode; inspector: ReactNode;
  documentSettings: ReactNode; viewSettings: ReactNode; previewStatus?: ReactNode;
  status: ReactNode; issues: UiPreviewIssue[]; onIssueSelect(issue: UiPreviewIssue): void; children: ReactNode;
}) {
  const [settings, setSettings] = useState<'document' | 'view' | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ side: 'left' | 'right'; x: number; width: number } | null>(null);
  useEffect(() => { try { localStorage.setItem(uiPreviewWorkspaceKey, JSON.stringify(workspace)); } catch { /* Keep session preferences when storage is unavailable. */ } }, [workspace]);
  useEffect(() => {
    if (settings && !dialog.current?.open) dialog.current?.showModal();
    else if (!settings && dialog.current?.open) dialog.current.close();
  }, [settings]);
  const toggle = (side: 'left' | 'right') => onWorkspaceChange(current => ({ ...current,
    [`${side}Open`]: !current[`${side}Open`],
    ...(window.innerWidth < 1050 ? { [side === 'left' ? 'rightOpen' : 'leftOpen']: false } : {}),
  }));
  const setWidth = (side: 'left' | 'right', width: number) => onWorkspaceChange(current => normalizeUiPreviewWorkspace({ ...current, [side]: width }, window.innerWidth));
  const splitter = (side: 'left' | 'right') => <div className={`ui-workbench-splitter ${side}`} role="separator" aria-label={side === 'left' ? '调整对象面板宽度' : '调整属性面板宽度'} aria-orientation="vertical" aria-valuemin={220} aria-valuemax={side === 'left' ? 480 : 560} aria-valuenow={workspace[side]} tabIndex={0}
    onDoubleClick={() => setWidth(side, side === 'left' ? 280 : 340)}
    onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setWidth(side, workspace[side] + (event.key === 'ArrowRight' ? 16 : -16) * (side === 'left' ? 1 : -1)); } }}
    onPointerDown={event => { if (event.button !== 0) return; drag.current = { side, x: event.clientX, width: workspace[side] }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => {
      if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const delta = (event.clientX - drag.current.x) * (side === 'left' ? 1 : -1);
      const available = (root.current?.clientWidth ?? window.innerWidth) - workspace[side === 'left' ? 'right' : 'left'] - 380;
      setWidth(side, Math.min(Math.max(220, available), drag.current.width + delta));
    }}
    onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; }} />;
  return <div ref={root} className="preview-lab ui-workbench" data-left-open={workspace.leftOpen} data-right-open={workspace.rightOpen} style={{ '--ui-left-width': `${workspace.left}px`, '--ui-right-width': `${workspace.right}px` } as CSSProperties}>
    <header className="ui-workbench-header"><h1>React UI Layout Lab</h1><div className="ui-document-switch">{documentBar}</div><nav aria-label="工作台面板">
      <button aria-pressed={workspace.leftOpen} onClick={() => toggle('left')}>对象 / 组件</button><button aria-pressed={workspace.rightOpen} onClick={() => toggle('right')}>属性</button>
      <button onClick={() => setSettings('document')}>文档设置</button><button onClick={() => setSettings('view')}>视图设置</button>
      <button onClick={() => onWorkspaceChange(defaultUiPreviewWorkspace(window.innerWidth))}>恢复布局</button>
    </nav></header>
    <div className="ui-workbench-body">
      <aside className="preview-sidebar" aria-label="对象与组件浏览"><nav className="ui-browser-tabs" aria-label="浏览分类">
        <button aria-pressed={workspace.tab === 'objects'} onClick={() => onWorkspaceChange(current => ({ ...current, tab: 'objects' }))}>对象层级</button>
        <button aria-pressed={workspace.tab === 'components'} onClick={() => onWorkspaceChange(current => ({ ...current, tab: 'components' }))}>组件库</button>
        <button aria-label="收起对象面板" onClick={() => toggle('left')}>‹</button>
      </nav><div className="ui-browser-page" hidden={workspace.tab !== 'objects'}>{objects}</div><div className="ui-browser-page" hidden={workspace.tab !== 'components'}>{components}</div></aside>
      {splitter('left')}{children}{splitter('right')}<div className="ui-inspector-host">{inspector}</div>
      {(workspace.leftOpen || workspace.rightOpen) && <button className="ui-panel-backdrop" aria-label="关闭侧栏" onClick={() => onWorkspaceChange(current => ({ ...current, leftOpen: false, rightOpen: false }))} />}
    </div>
    {previewStatus && <div className="ui-preview-session">{previewStatus}</div>}
    {issuesOpen && <section className="ui-workbench-issues" aria-label="组件定义检查"><header><strong>组件定义检查 · {issues.length} 项</strong><button onClick={() => setIssuesOpen(false)}>关闭</button></header>{issues.length ? issues.map((issue, index) => <button key={`${issue.nodeId}-${index}`} onClick={() => onIssueSelect(issue)}>{issue.nodeId} · {issue.message}</button>) : <p>当前节点均有已注册的 React 组件。此检查不包含未来的数据绑定与事件协议校验。</p>}</section>}
    <footer className="ui-workbench-status"><span role="status">{status}</span><button aria-expanded={issuesOpen} onClick={() => setIssuesOpen(value => !value)}>组件定义检查 · {issues.length} 项</button></footer>
    <dialog ref={dialog} className="ui-settings-dialog" onCancel={() => setSettings(null)}><header><strong>编辑器设置</strong><nav aria-label="设置分类"><button aria-pressed={settings === 'document'} onClick={() => setSettings('document')}>文档与画布</button><button aria-pressed={settings === 'view'} onClick={() => setSettings('view')}>视图与工作区</button></nav><button aria-label="关闭设置" onClick={() => setSettings(null)}>×</button></header><div className="ui-settings-body">{settings === 'document' ? documentSettings : viewSettings}</div></dialog>
  </div>;
}
