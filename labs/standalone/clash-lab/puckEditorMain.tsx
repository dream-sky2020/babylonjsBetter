import './main.ts';
import { createRoot } from 'react-dom/client';
import '@puckeditor/core/puck.css';
import './shared/clash-workspace.css';
import './shared/xp-console.css';
import { PuckEditorApp } from './puck/PuckEditorApp.tsx';

const container = document.getElementById('root');
if (!container) throw new Error('缺少编辑器根节点。');
createRoot(container).render(<PuckEditorApp />);
