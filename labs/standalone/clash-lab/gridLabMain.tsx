import './main.ts';
import { createRoot } from 'react-dom/client';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './shared/clash-workspace.css';
import './grid/grid-workspace.css';
import './shared/xp-console.css';
import './grid/xp-grid.css';
import { GridWorkspace } from './grid/GridWorkspace.tsx';

const container = document.getElementById('root');
if (!container) throw new Error('缺少工作台根节点。');
createRoot(container).render(<GridWorkspace />);
