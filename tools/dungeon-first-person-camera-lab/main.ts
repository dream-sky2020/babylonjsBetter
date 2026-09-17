import { createLab } from '@/tools/lab-kit';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: 'Dungeon 玩家相机 Lab',
  description: '验证格步移动驱动的 DRPG 第一人称与第三人称俯视跟随，并支持运行中切换。',
  badge: 'Composable Lab · Player Camera',
  modules: ['dungeon-config', 'dungeon-player-camera'],
  catalog: dungeonLabModuleCatalog,
});

window.addEventListener('beforeunload', () => host.dispose(), { once: true });
