import { createLab } from '@/tools/lab-kit';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: 'Dungeon 地图传送 Lab',
  description: '验证格子、单向边和公用边出口到目标地图唯一入口的无表现传送流程。',
  badge: 'Composable Lab · Dungeon Transition',
  modules: ['dungeon-config', 'dungeon-first-person-camera', 'dungeon-transition'],
  catalog: dungeonLabModuleCatalog,
});

window.addEventListener('beforeunload', () => host.dispose(), { once: true });
