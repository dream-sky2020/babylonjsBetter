import React from 'react';
import ReactDOM from 'react-dom/client';
import { ModelSceneLab } from './ModelSceneLab.tsx';
import './model-scene-lab.css';

const root = document.getElementById('root');
if (!root) throw new Error('缺少 #root 元素');
ReactDOM.createRoot(root).render(<React.StrictMode><ModelSceneLab /></React.StrictMode>);
