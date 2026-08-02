import React from 'react';
import ReactDOM from 'react-dom/client';
import { ModelLab } from './ModelLab.tsx';
import './model-lab.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('缺少 #root 元素');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ModelLab />
  </React.StrictMode>
);
