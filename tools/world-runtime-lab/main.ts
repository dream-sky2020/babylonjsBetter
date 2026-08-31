import { createLab } from '@/tools/lab-kit';
import { worldLabModuleCatalog } from '@/tools/lab-modules/world';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: '世界动态数据 Lab',
  description: '加载世界并验证 WorldRuntime 的游玩时间累计、暂停、继续、重置和存档快照。',
  badge: 'Composable Lab · world-runtime + dungeon-grid-debug',
  modules: ['world-runtime', 'dungeon-grid-debug'],
  catalog: worldLabModuleCatalog,
});

window.addEventListener('beforeunload', () => host.dispose(), { once: true });
