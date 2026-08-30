import { createLab } from '@/tools/lab-kit';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: '玩家出生点世界位置 Lab',
  description: '组合场景、全部格子 Debug 和玩家出生点模块，验证出生格的 3D 世界位置。',
  badge: 'Composable Lab · player-spawn + dungeon-grid-debug',
  modules: ['dungeon-grid-debug', 'player-spawn'],
  catalog: dungeonLabModuleCatalog,
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
