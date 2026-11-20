import { createLab } from '@/labs/kit';
import { dungeonLabModuleCatalog } from '@/labs/modules/dungeon';
import '@/labs/kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  labId: 'dungeon-art-tuning-lab',
  root,
  title: '地牢美术调试 Lab',
  description: '在连续地面上用 WASD 移动主角，调整俯视镜头和脚底偏移。',
  badge: '',
  modules: ['dungeon-config', 'player-appearance'],
  catalog: dungeonLabModuleCatalog,
});

window.addEventListener('pagehide', event => { if (!event.persisted) host.dispose(); });
