import { createLab } from '@/tools/lab-kit';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: 'Dungeon Agent 移动 Lab',
  description: '在地图传送完整链路上扫描 dungeon-agent，验证运行时占位、朝向、手动格步移动与 Debug 3D 模型。',
  badge: 'Composable Lab · Dungeon Transition + Agent',
  modules: ['dungeon-config', 'dungeon-player-camera', 'dungeon-transition', 'dungeon-agent'],
  catalog: dungeonLabModuleCatalog,
});

window.addEventListener('beforeunload', () => host.dispose(), { once: true });
