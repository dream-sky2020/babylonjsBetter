import React from 'react';
import { createRoot } from 'react-dom/client';
import { WorldPresetEditorLab } from './WorldPresetEditorLab';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');
createRoot(root).render(<React.StrictMode><WorldPresetEditorLab /></React.StrictMode>);
