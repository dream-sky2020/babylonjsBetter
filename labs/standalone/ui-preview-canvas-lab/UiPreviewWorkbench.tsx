import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { defaultUiPreviewWorkspace, normalizeUiPreviewWorkspace, uiPreviewWorkspaceKey, type UiPreviewWorkspace } from './uiPreviewWorkspace';
import { InspectorSection } from '@/core/ui/editor-kit';
import './ui-preview-workbench.css';

export type UiPreviewIssue = { nodeId: string; message: string };

export function UiPreviewWorkbench({ workspace, onWorkspaceChange, documentBar, objects, inspector, inspectorKey, documentSettings, viewSettings, previewStatus, status, issues, onIssueSelect, children }: {
  workspace: UiPreviewWorkspace; onWorkspaceChange: Dispatch<SetStateAction<UiPreviewWorkspace>>;
  documentBar: ReactNode; objects: ReactNode; inspector: ReactNode;
  inspectorKey: string;
  documentSettings: ReactNode; viewSettings: ReactNode; previewStatus?: ReactNode;
  status: ReactNode; issues: UiPreviewIssue[]; onIssueSelect(issue: UiPreviewIssue): void; children: ReactNode;
}) {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const inspectorHost = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ side: 'left' | 'right'; x: number; width: number } | null>(null);
  useEffect(() => { try { localStorage.setItem(uiPreviewWorkspaceKey, JSON.stringify(workspace)); } catch { /* Keep session preferences when storage is unavailable. */ } }, [workspace]);
  useEffect(() => {
    if (inspectorHost.current) inspectorHost.current.scrollTop = 0;
  }, [inspectorKey]);
  const settingsPanel = (key: 'document' | 'view', title: string, content: ReactNode) => <InspectorSection
    id={`ui-workbench-${key}-settings`} className="ui-settings-panel" title={title}
    open={workspace.sections[`settings-${key}`] ?? true}
    onOpenChange={open => onWorkspaceChange(current => ({ ...current, sections: { ...current.sections, [`settings-${key}`]: open } }))}
  >{content}</InspectorSection>;
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
      <button aria-pressed={workspace.leftOpen} onClick={() => toggle('left')}>对象层级</button><button aria-pressed={workspace.rightOpen} onClick={() => toggle('right')}>属性</button>
      <button onClick={() => onWorkspaceChange(defaultUiPreviewWorkspace(window.innerWidth))}>恢复布局</button>
    </nav></header>
    <div className="ui-workbench-body">
      <aside className="preview-sidebar" aria-label="对象与组件浏览"><nav className="ui-browser-tabs" aria-label="浏览分类">
        <strong>对象层级</strong>
        <button aria-label="收起对象面板" onClick={() => toggle('left')}>‹</button>
      </nav><div className="ui-browser-page">{objects}</div></aside>
      {splitter('left')}{children}{splitter('right')}<div ref={inspectorHost} className="ui-inspector-host" aria-label="属性与设置">
        {inspector}
        {settingsPanel('document', '文档设置', documentSettings)}
        {settingsPanel('view', '视图设置', viewSettings)}
      </div>
      {(workspace.leftOpen || workspace.rightOpen) && <button className="ui-panel-backdrop" aria-label="关闭侧栏" onClick={() => onWorkspaceChange(current => ({ ...current, leftOpen: false, rightOpen: false }))} />}
    </div>
    {previewStatus && <div className="ui-preview-session">{previewStatus}</div>}
    {issuesOpen && <section className="ui-workbench-issues" aria-label="组件定义检查"><header><strong>组件定义检查 · {issues.length} 项</strong><button onClick={() => setIssuesOpen(false)}>关闭</button></header>{issues.length ? issues.map((issue, index) => <button key={`${issue.nodeId}-${index}`} onClick={() => onIssueSelect(issue)}>{issue.nodeId} · {issue.message}</button>) : <p>当前节点均有已注册的 React 组件。此检查不包含未来的数据绑定与事件协议校验。</p>}</section>}
    <footer className="ui-workbench-status"><span role="status">{status}</span><button aria-expanded={issuesOpen} onClick={() => setIssuesOpen(value => !value)}>组件定义检查 · {issues.length} 项</button></footer>
  </div>;
}
