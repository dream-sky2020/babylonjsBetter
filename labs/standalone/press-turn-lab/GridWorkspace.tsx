import { useRef, useState } from 'react';
import GridLayout, { useContainerWidth, type Layout } from 'react-grid-layout';
import { CommandPanel, BattleLog, FieldEditorPanel, PlayerPanel, RulesPanel, RuntimePanel, SessionButtons, TurnPanel } from './widgets.tsx';
import { defaultGrid, downloadLayout, GRID_KEY, parseGrid, readLayout, TITLES, type GridData, type Panel } from './layouts.ts';
import { Navigation } from './Navigation.tsx';

export function GridWorkspace() {
  const [initial] = useState(() => { try { return { data: readLayout(localStorage, GRID_KEY, parseGrid, defaultGrid), error: '' }; } catch (e) { return { data: defaultGrid(), error: `读取布局失败，使用默认布局：${String(e)}` }; } });
  const [data, setData] = useState(initial.data); const [message, setMessage] = useState(initial.error || '拖动标题移动窗口，右下角缩放；工作区使用全部页面宽度。');
  const { width, containerRef, mounted } = useContainerWidth(); const narrow = width < 900;
  const file = useRef<HTMLInputElement>(null);
  const commit = (value: GridData) => { const next = parseGrid(value); setData(next); try { localStorage.setItem(GRID_KEY, JSON.stringify(next)); setMessage('布局已自动保存。'); } catch (e) { setMessage(`保存失败：${String(e)}`); } };
  const hide = (id: Panel) => commit({ ...data, hidden: data.hidden.includes(id) ? data.hidden.filter(item => item !== id) : [...data.hidden, id] });
  let y = 0;
  const visible = data.items.filter(item => !data.hidden.includes(item.i as Panel)).map(item => { if (!narrow) return { ...item }; const mobile = { ...item, x: 0, y, w: 1, minW: 1 }; y += item.h; return mobile; });
  const finish = (items: Layout) => { if (narrow || data.locked) return; const changes = new Map(items.map(item => [item.i, item])); commit({ ...data, items: data.items.map(item => data.hidden.includes(item.i as Panel) ? item : changes.get(item.i) ?? item) }); };
  return <div className="pt-app"><Navigation current="Grid 工作台" /><div className="pt-toolbar"><SessionButtons /><button onClick={() => commit({ ...data, locked: !data.locked })}>{data.locked ? '解锁布局' : '锁定布局'}</button><button onClick={() => commit(defaultGrid())}>恢复默认布局</button><button onClick={() => downloadLayout(data, 'press-turn-grid.json')}>导出布局</button><button onClick={() => file.current?.click()}>导入布局</button></div>
    <div className="pt-options">{(Object.keys(TITLES) as Panel[]).map(id => <label key={id}><input type="checkbox" checked={!data.hidden.includes(id)} onChange={() => hide(id)} />{TITLES[id]}</label>)}</div><div className="pt-message" role="status">{message}</div>
    <input hidden type="file" accept=".json" ref={file} onChange={async event => { const input = event.target.files?.[0]; event.target.value = ''; if (!input) return; try { if (input.size > 100000) throw new Error('文件不能超过 100KB。'); commit(parseGrid(JSON.parse(await input.text()))); } catch (e) { setMessage(`导入失败：${String(e)}`); } }} />
    <div className="pt-grid" ref={containerRef}>{mounted && <GridLayout width={width} layout={visible} gridConfig={{ cols: narrow ? 1 : 12, rowHeight: 18, margin: [5, 5], containerPadding: [0, 0] }} dragConfig={{ enabled: !narrow && !data.locked, handle: '.pt-drag', cancel: 'button,input,select,textarea' }} resizeConfig={{ enabled: !narrow && !data.locked, handles: ['se'] }} onDragStop={finish} onResizeStop={finish}>
      {visible.map(item => <section key={item.i} className={`pt-window pt-grid-window pt-window-${item.i}`} aria-label={TITLES[item.i as Panel]}><header className="pt-window-title"><div className="pt-drag">⠿ {TITLES[item.i as Panel]}</div><button aria-label={`隐藏${TITLES[item.i as Panel]}`} onClick={() => hide(item.i as Panel)}>×</button></header><div className="pt-window-body">{item.i === 'left' || item.i === 'right' ? <FieldEditorPanel side={item.i} /> : item.i === 'player' ? <PlayerPanel /> : item.i === 'console' ? <><TurnPanel /><CommandPanel /></> : item.i === 'logs' ? <BattleLog /> : item.i === 'rules' ? <RulesPanel /> : <RuntimePanel />}</div></section>)}
    </GridLayout>}</div></div>;
}
