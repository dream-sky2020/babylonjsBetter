import React from 'react';
import ReactDOM from 'react-dom/client';
import { AnimationWorkbenchLab } from './AnimationWorkbenchLab.tsx';
import './animation-workbench-lab.css';

const root = document.getElementById('root');
if (!root) throw new Error('缺少 #root 元素');
ReactDOM.createRoot(root).render(<React.StrictMode><AnimationWorkbenchLab /></React.StrictMode>);
