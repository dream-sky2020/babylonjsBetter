import { createLab } from '@/tools/lab-kit';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: '地牢玩家移动 Lab',
  description: '通过可组合模块自动加载场景、格子 Debug、玩家出生点、阻碍和玩家移动系统。',
  badge: 'Composable Lab · player-movement 自动解析依赖',
  modules: ['player-movement'],
  catalog: dungeonLabModuleCatalog,
});

window.addEventListener('beforeunload', () => host.dispose(), { once: true });
