// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Battle } from './battle';

// 确保你的 index.html 中有一个 id 为 'root' 的 div
const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Battle />
  </React.StrictMode>
);