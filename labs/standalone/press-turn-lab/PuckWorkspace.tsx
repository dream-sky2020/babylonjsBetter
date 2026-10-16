import { useRef, useState } from 'react';
import { Puck, Render } from '@puckeditor/core';
import { defaultPuck, downloadLayout, parsePuck, PUCK_KEY, readLayout, type PuckData } from './layouts.ts';
import { puckConfig } from './puckConfig.tsx';
import { Navigation } from './Navigation.tsx';
export function PuckWorkspace({ editor }: { editor: boolean }) {
  const [initial] = useState(() => { try { return { data: readLayout(localStorage, PUCK_KEY, parsePuck, defaultPuck), error: '' }; } catch (e) { return { data: defaultPuck(), error: `读取失败，显示默认布局：${String(e)}` }; } });
  const [data, setData] = useState(initial.data); const [message, setMessage] = useState(initial.error || '拖拽组件编排界面，保存后在运行页使用。'); const [preview, setPreview] = useState(false); const [revision, setRevision] = useState(0); const input = useRef<HTMLInputElement>(null);
  const save = (value: PuckData) => { try { localStorage.setItem(PUCK_KEY, JSON.stringify(parsePuck(value))); setMessage('布局已保存。战斗数据只存在本次会话。'); } catch (e) { setMessage(`保存失败：${String(e)}`); } };
  const replace = (value: PuckData) => { setData(value); setRevision(n => n + 1); setMessage('已载入布局，点击保存后生效。'); };
  return <div className="pt-app"><Navigation current={editor ? 'Puck 编辑器' : '运行页'} />{editor && <><div className="pt-toolbar"><button onClick={() => setPreview(v => !v)}>{preview ? '返回编辑' : '交互预览'}</button><button onClick={() => save(data)}>保存布局</button><button onClick={() => replace(defaultPuck())}>默认布局</button><button onClick={() => downloadLayout(data, 'press-turn-puck.json')}>导出布局</button><button onClick={() => input.current?.click()}>导入布局</button></div><div className="pt-message" role="status">{message}</div><input type="file" accept=".json" hidden ref={input} onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { if (file.size > 1000000) throw new Error('文件不能超过 1MB。'); replace(parsePuck(JSON.parse(await file.text()))); } catch (e) { setMessage(`导入失败：${String(e)}`); } }} /></>}
    {!editor && initial.error && <p role="status">{initial.error}</p>}
    {editor && !preview ? <Puck key={revision} config={puckConfig} data={data} iframe={{ enabled: false }} onChange={value => { setData(value); setMessage('有未保存的修改。'); }} onPublish={save} headerTitle="Press Turn 界面编辑器" height="calc(100vh - 100px)" dictionary={{ 'header-publish': '保存布局', 'plugin-components': '组件', 'plugin-fields': '属性', 'plugin-outline': '图层', 'action-delete': '删除', 'action-duplicate': '复制' }} /> : <Render config={puckConfig} data={data} />}
  </div>;
}
