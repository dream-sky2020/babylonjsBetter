import { createLab } from '@/labs/kit';
import { dungeonLabModuleCatalog } from '@/labs/modules/dungeon';
import '@/labs/kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: '玩家出生点世界位置 Lab',
  description: '组合场景、全部格子 Debug 和玩家出生点模块，验证出生格的 3D 世界位置。',
  badge: 'Composable Lab · player-spawn + dungeon-runtime + dungeon-grid',
  modules: ['dungeon-config', 'dungeon-grid', 'player-spawn', 'dungeon-runtime'],
  catalog: dungeonLabModuleCatalog,
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
