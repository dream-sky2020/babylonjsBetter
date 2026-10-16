import { createLab } from '@/labs/kit';
import { dungeonLabModuleCatalog } from '@/labs/modules/dungeon';
import '@/labs/kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: '地牢阻碍系统 Lab',
  description: '组合地牢场景、全部格子 Debug、Runtime 与阻碍模块，测试阻碍扫描和运行时启停。',
  badge: 'Composable Lab · Grid + Traversal + Movement',
  modules: ['dungeon-config', 'dungeon-grid', 'dungeon-traversal', 'dungeon-movement', 'dungeon-runtime', 'dungeon-obstacle'],
  catalog: dungeonLabModuleCatalog,
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
