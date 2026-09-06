import { createLab } from '@/tools/lab-kit';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: 'Dungeon 第一人称相机 Lab',
  description: '验证现有格步移动、阻碍与转向插值驱动的 DRPG 第一人称相机。',
  badge: 'Composable Lab · DRPG First Person',
  modules: ['dungeon-config', 'dungeon-first-person-camera'],
  catalog: dungeonLabModuleCatalog,
});

window.addEventListener('beforeunload', () => host.dispose(), { once: true });
