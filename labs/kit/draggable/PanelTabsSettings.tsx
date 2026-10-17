import { useState } from 'react';
import type { WorkspaceLayout } from './layout.ts';
import { combinePanels } from './tabs.ts';
export function PanelTabsSettings<T extends WorkspaceLayout>({ data, titles, commit, narrow }: { data: T; titles: Record<string, string>; commit: (data: T) => void; narrow: boolean }) {
  const ids = Object.keys(titles); const [source, setSource] = useState(ids[0]); const [target, setTarget] = useState(ids[1]); const [error, setError] = useState('');
  const tabs = data.tabs ?? { enabled: false, groups: [] };
  return <section className="wb-tabs-settings" aria-label="面板标签合并设置"><label><input type="checkbox" checked={tabs.enabled} disabled={data.locked || narrow} onChange={event => commit({ ...data, tabs: { ...tabs, enabled: event.target.checked } })} />开启面板标签合并</label>
    <p>合并后使用第一个面板的窗口位置与尺寸。关闭开关保留分组，拆分时恢复各面板各自的位置。</p>
    {tabs.enabled && <><label><input type="checkbox" checked={tabs.dragMerge ?? false} disabled={data.locked || narrow} onChange={event => commit({ ...data, tabs: { ...tabs, dragMerge: event.target.checked } })} />允许拖动合并与拆分</label><p>拖动窗口标题到另一个窗口的标题栏或标签栏，看到提示后松开鼠标即可合并。拖动单个标签离开标签栏可拆成独立窗口，也可拖入其他窗口。按 Esc 取消。关闭此选项时仍可使用下方选择合并。</p><fieldset disabled={data.locked || narrow}><label>第一个面板<select aria-label="第一个面板" value={source} onChange={event => setSource(event.target.value)}>{ids.map(id => <option key={id} value={id}>{titles[id]}</option>)}</select></label><label>合入面板<select aria-label="合入面板" value={target} onChange={event => setTarget(event.target.value)}>{ids.map(id => <option key={id} value={id}>{titles[id]}</option>)}</select></label><button disabled={source === target} onClick={() => { try { commit({ ...data, tabs: combinePanels(data, source, target) }); setError(''); } catch (error) { setError(String(error)); } }}>合并为标签窗口</button></fieldset>
      <ul>{tabs.groups.map(group => <li key={group.panels[0]}><span>{group.panels.map(id => titles[id]).join(' / ')}</span><button disabled={data.locked || narrow} onClick={() => commit({ ...data, tabs: { ...tabs, groups: tabs.groups.filter(value => value !== group) } })}>拆分此组</button></li>)}</ul></>}
    {error && <p role="status">{error}</p>}
  </section>;
}
