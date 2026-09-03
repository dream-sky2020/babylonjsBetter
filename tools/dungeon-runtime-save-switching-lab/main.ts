import { createLab } from '@/tools/lab-kit';
import { worldLabModuleCatalog } from '@/tools/lab-modules/world';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: '地牢运行时存档切换 Lab',
  description: '修改玩家位置、朝向与阻碍状态，切换地牢后再返回，验证 dungeonSaveStates 的保存与恢复。',
  badge: 'Composable Lab · GameRuntime + WorldRuntime + Runtime Save',
  modules: ['dungeon-runtime-save-switch', 'viewport-layers'],
  catalog: worldLabModuleCatalog,
});

window.addEventListener('beforeunload', () => host.dispose(), { once: true });
