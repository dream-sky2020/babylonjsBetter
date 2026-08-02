import React from 'react';
import ReactDOM from 'react-dom/client';
import { ModelDisplayLab } from './ModelDisplayLab.tsx';
import './model-display-lab.css';

const root = document.getElementById('root');
if (!root) throw new Error('缺少 #root 元素');
ReactDOM.createRoot(root).render(<React.StrictMode><ModelDisplayLab /></React.StrictMode>);
