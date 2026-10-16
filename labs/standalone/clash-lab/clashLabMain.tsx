import './main.ts';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { ClashWorkspace } from './puck/ClashWorkspace.tsx';
import './shared/clash-workspace.css';
import './shared/xp-console.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      {new URLSearchParams(window.location.search).has('legacy') ? <App /> : <ClashWorkspace />}
    </React.StrictMode>
  );
}
