import { createRoot } from 'react-dom/client';
import '@puckeditor/core/puck.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './style.css';
import { App } from './App.tsx';
const root = document.getElementById('root');
if (!root) throw new Error('页面根节点不存在。');
createRoot(root).render(<App entry={root.dataset.entry ?? 'runtime'} />);
