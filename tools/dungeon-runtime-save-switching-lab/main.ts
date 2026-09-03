import { createLab } from '@/tools/lab-kit';
import { worldLabModuleCatalog } from '@/tools/lab-modules/world';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: '地牢差分切换 Lab',
  description: '修改玩家位置、朝向与阻碍状态，切换地牢后再返回，验证 dungeonDeltas 的生成与应用。',
  badge: 'Composable Lab · GameRuntime + WorldRuntime + DungeonDelta',
  modules: ['dungeon-delta-switch', 'viewport-layers'],
  catalog: worldLabModuleCatalog,
});

window.addEventListener('beforeunload', () => host.dispose(), { once: true });
