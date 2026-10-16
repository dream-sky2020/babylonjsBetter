import { useRef, useState } from 'react';
import ReactGridLayout, { useContainerWidth, type Layout } from 'react-grid-layout';
import { useCombatStore } from '../store.ts';
import { BattleLog, useUnit } from '../shared/CombatWidgets.tsx';
import { UnitParameters } from './UnitParameters.tsx';
import { defaultGridLayout, mergeVisibleLayout, mobileGridItems, parseGridLayout, readGridLayout, writeGridLayout, PANEL_TITLES, type PanelId, type GridWorkspaceLayout } from './gridLayoutData.ts';

function RuntimePanel() {
  const leftUnits = useCombatStore(state => state.leftUnits);
  const rightUnits = useCombatStore(state => state.rightUnits);
  const selectedLeftUnitId = useCombatStore(state => state.selectedLeftUnitId);
  const selectedRightUnitId = useCombatStore(state => state.selectedRightUnitId);
  return <pre className="clash-grid-state">{JSON.stringify({ selectedLeftUnitId, selectedRightUnitId, leftUnits, rightUnits }, null, 2)}</pre>;
}

function PanelContent({ id }: { id: PanelId }) {
  if (id === 'left-unit' || id === 'right-unit') return <UnitParameters side={id === 'left-unit' ? 'left' : 'right'} />;
  if (id === 'logs') return <BattleLog height={300} />;
  return <RuntimePanel />;
}

function initialLayout() {
  try { return { data: readGridLayout(window.localStorage), error: '' }; }
  catch (error) { return { data: defaultGridLayout(), error: `无法读取保存的布局，暂用默认布局：${error instanceof Error ? error.message : String(error)}` }; }
}

function SystemStatus() {
  const left = useUnit('left');
  const right = useUnit('right');
  const logCount = useCombatStore(state => state.logs.length);
  return <footer className="xp-system-status"><span><i />本地战斗会话</span><span>左侧: {left?.name ?? '未选择'} / HP {left?.hp ?? '—'}</span><span>右侧: {right?.name ?? '未选择'} / HP {right?.hp ?? '—'}</span><span>日志记录: {logCount}</span><span>CLASH CONTROL SYSTEM</span></footer>;
}

export function GridWorkspace() {
  const [initial] = useState(initialLayout);
  const [data, setData] = useState(initial.data);
  const [message, setMessage] = useState(initial.error || '拖动面板标题调整位置，拖动右下角调整大小；表单和战斗按钮始终可用。');
  const { width, containerRef, mounted } = useContainerWidth();
  const fileInput = useRef<HTMLInputElement>(null);
  const narrow = width < 900;
  const commit = (next: GridWorkspaceLayout) => {
    setData(next);
    try { writeGridLayout(window.localStorage, next); setMessage('布局已自动保存在当前浏览器。'); }
    catch (error) { setMessage(`当前布局可继续使用，但保存失败：${error instanceof Error ? error.message : String(error)}`); }
  };
  const finishLayoutChange = (layout: Layout) => {
    if (narrow || data.locked) return;
    try { commit(mergeVisibleLayout(data, layout)); }
    catch (error) { setMessage(`布局调整未保存：${error instanceof Error ? error.message : String(error)}`); }
  };
  const togglePanel = (id: PanelId) => commit({ ...data, hidden: data.hidden.includes(id) ? data.hidden.filter(item => item !== id) : [...data.hidden, id] });
  const visible = narrow ? mobileGridItems(data) : data.items.filter(item => !data.hidden.includes(item.i as PanelId)).map(item => ({ ...item, maxH: 100 }));
  const exportLayout = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'clash-grid-layout.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className={`clash-grid-workspace${data.locked ? ' is-locked' : ''}`}>
    <div className="xp-system-title"><span className="xp-app-icon" aria-hidden="true">C</span><strong>Clash 战斗试验台 — 工业控制终端</strong><span>{data.locked ? '布局锁定' : '布局可编辑'}</span></div>
    <nav className="clash-toolbar"><a href="../../../index.html">← Lab 入口</a><strong>控制台</strong><a href="./index.html">Puck 运行页</a><a href="./editor.html">Puck 编辑器</a><button onClick={() => commit({ ...data, locked: !data.locked })}>{data.locked ? '解锁布局' : '锁定布局'}</button><button onClick={() => commit(defaultGridLayout())}>恢复默认布局</button><button onClick={exportLayout}>导出布局</button><button onClick={() => fileInput.current?.click()}>导入布局</button></nav>
    <div className="clash-grid-command-bar"><div><span className="clash-eyebrow">COMBAT LOGIC / LIVE WORKBENCH</span><h1>战斗逻辑工作台</h1></div><div className="clash-grid-actions"><button onClick={() => window.startClash()}>开启拼点</button><button onClick={() => window.endTurn()}>回合结束</button><button onClick={() => useCombatStore.getState().clearLogs()}>清空日志</button></div></div>
    <div className="clash-grid-options"><div>{(Object.keys(PANEL_TITLES) as PanelId[]).map(id => <label key={id}><input type="checkbox" checked={!data.hidden.includes(id)} onChange={() => togglePanel(id)} />{PANEL_TITLES[id]}</label>)}</div><span role="status">{message}{narrow && ' 窄屏使用单列排列；放宽窗口后可拖动，原桌面布局保持不变。'}</span></div>
    <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      try { if (file.size > 100_000) throw new Error('布局文件不能超过 100 KB。'); commit(parseGridLayout(JSON.parse(await file.text()))); }
      catch (error) { setMessage(`导入失败，当前布局已保留：${error instanceof Error ? error.message : String(error)}`); }
    }} />
    <div className="clash-grid-container" ref={containerRef}>{mounted && <ReactGridLayout width={width} layout={visible}
      gridConfig={{ cols: narrow ? 1 : 12, rowHeight: 18, margin: [5, 5], containerPadding: [0, 0] }}
      dragConfig={{ enabled: !data.locked && !narrow, handle: '.clash-grid-drag', cancel: 'button, input, select, textarea' }}
      resizeConfig={{ enabled: !data.locked && !narrow, handles: ['se'] }} onDragStop={finishLayoutChange} onResizeStop={finishLayoutChange}>
      {visible.map(item => <section key={item.i} className={`clash-grid-panel clash-grid-panel--${item.i}`} aria-label={PANEL_TITLES[item.i as PanelId]}>
        <header className="clash-grid-panel-header"><div className="clash-grid-drag" title="拖动标题栏移动面板"><span aria-hidden="true">⠿</span><h2>{PANEL_TITLES[item.i as PanelId]}</h2></div><button aria-label={`隐藏${PANEL_TITLES[item.i as PanelId]}`} onClick={() => togglePanel(item.i as PanelId)}>×</button></header>
        <div className="clash-grid-panel-body"><PanelContent id={item.i as PanelId} /></div>
      </section>)}
    </ReactGridLayout>}</div><SystemStatus />
  </div>;
}
