import { createLab } from '@/tools/lab-kit';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: '地牢阻碍系统 Lab',
  description: '组合地牢场景、全部格子 Debug、Runtime 与阻碍模块，测试阻碍扫描和运行时启停。',
  badge: 'Composable Lab · dungeon-obstacle + dungeon-grid-debug',
  modules: ['dungeon-grid-debug', 'dungeon-obstacle'],
  catalog: dungeonLabModuleCatalog,
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
