import { useState } from 'react';
import { Render } from '@puckeditor/core';
import { clashPuckConfig } from './clashPuckConfig.tsx';
import { createDefaultLayout, loadLayout } from './layoutData.ts';

export function readInitialLayout() {
  try { return { data: loadLayout(window.localStorage), error: '' }; }
  catch (error) { return { data: createDefaultLayout(), error: `无法读取保存的布局，已显示默认界面：${error instanceof Error ? error.message : String(error)}` }; }
}

export function ClashWorkspace() {
  const [initial] = useState(readInitialLayout);
  return <div className="clash-workspace">
    <nav className="clash-toolbar"><a href="../../../index.html">← Lab 入口</a><span>CLASH LAB</span><a href="./grid.html">Grid 战斗工作台</a><a href="./index.html?legacy=1">完整战斗参数</a><a className="clash-toolbar-primary" href="./editor.html">编辑界面 ↗</a></nav>
    {initial.error && <p className="clash-notice" role="alert">{initial.error}</p>}
    <Render config={clashPuckConfig} data={initial.data} />
  </div>;
}
