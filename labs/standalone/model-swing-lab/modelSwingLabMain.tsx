import React from 'react';
import ReactDOM from 'react-dom/client';
import { ModelSwingLab } from './ModelSwingLab.tsx';
import './model-swing-lab.css';
const root = document.getElementById('root');
if (!root) throw new Error('缺少 #root 元素');
ReactDOM.createRoot(root).render(<React.StrictMode><ModelSwingLab /></React.StrictMode>);
