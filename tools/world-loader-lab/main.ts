import { createLab } from '@/tools/lab-kit';
import { worldLabModuleCatalog } from '@/tools/lab-modules/world';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: '世界加载 Lab',
  description: '读取世界数据容器，并通过首次地牢加载组件复用组合式 Dungeon Scene Loader。',
  badge: 'Composable Lab · world-loader + dungeon-grid-debug',
  modules: ['world-loader', 'dungeon-grid-debug'],
  catalog: worldLabModuleCatalog,
});

window.addEventListener('beforeunload', () => host.dispose(), { once: true });
