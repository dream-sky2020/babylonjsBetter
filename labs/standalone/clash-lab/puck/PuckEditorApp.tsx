import { useRef, useState } from 'react';
import { Puck, Render } from '@puckeditor/core';
import { clashPuckConfig } from './clashPuckConfig.tsx';
import { readInitialLayout } from './ClashWorkspace.tsx';
import { createDefaultLayout, parseLayout, saveLayout, type ClashLayout } from './layoutData.ts';

export function PuckEditorApp() {
  const [initial] = useState(readInitialLayout);
  const [data, setData] = useState(initial.data);
  const [message, setMessage] = useState(initial.error || '拖入组件，选中后在右侧修改属性。修改后点击「保存布局」。');
  const [preview, setPreview] = useState(false);
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const save = (value: ClashLayout) => {
    try { saveLayout(window.localStorage, value); setMessage('布局已保存在当前浏览器。点击「打开运行页」使用。'); }
    catch (error) { setMessage(`保存失败：${error instanceof Error ? error.message : String(error)}`); }
  };
  const replace = (value: ClashLayout) => { setData(value); setRevision(value => value + 1); setMessage('布局已载入，尚未保存。'); };
  const exportLayout = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'clash-layout.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('已导出布局 JSON。文件只包含界面配置，不包含战斗数据。');
  };
  return <div className="clash-editor">
    <div className="clash-toolbar"><a href="./index.html">← 打开运行页</a><strong>PUCK / CLASH UI</strong>
      <button onClick={() => setPreview(value => !value)}>{preview ? '返回编辑' : '交互预览'}</button>
      <button onClick={exportLayout}>导出 JSON</button><button onClick={() => fileInput.current?.click()}>导入 JSON</button>
      <button onClick={() => replace(createDefaultLayout())}>默认布局</button><button className="clash-toolbar-primary" onClick={() => save(data)}>保存布局</button>
      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file) return;
        try { if (file.size > 2_000_000) throw new Error('文件不能超过 2 MB。'); replace(parseLayout(JSON.parse(await file.text()))); }
        catch (error) { setMessage(`导入失败，原布局已保留：${error instanceof Error ? error.message : String(error)}`); }
      }} />
    </div>
    <div className="clash-editor-help"><span role="status">{message}</span><small>设计模式只调整布局；交互预览可执行战斗。保存只影响此浏览器。</small></div>
    {preview ? <Render config={clashPuckConfig} data={data} /> : <Puck key={revision} config={clashPuckConfig} data={data} iframe={{ enabled: false }} height="calc(100vh - 112px)"
      headerTitle="战斗界面编辑器" headerPath="Clash Lab" onChange={value => { setData(value); setMessage('有未保存的布局修改。'); }} onPublish={save}
      dictionary={{ 'header-publish': '保存布局', 'header-undo': '撤销', 'header-redo': '重做', 'header-toggle-leftsidebar': '切换组件栏', 'header-toggle-rightsidebar': '切换属性栏', 'label-page': '页面', 'label-component': '组件', 'action-delete': '删除', 'action-duplicate': '复制', 'action-selectparent': '选择父容器', 'outline-header-title': '图层', 'outline-empty': '暂无组件', 'plugin-blocks': '组件', 'plugin-components': '组件', 'plugin-fields': '属性', 'plugin-outline': '图层', 'drawer-category-other': '其他', 'field-arrayitem-delete': '删除', 'field-arrayitem-duplicate': '复制' }} />}
  </div>;
}
