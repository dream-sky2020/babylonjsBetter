import { createLab } from '@/labs/kit';
import { dungeonLabModuleCatalog } from '@/labs/modules/dungeon';
import '@/labs/kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({ labId: 'dungeon-agent-lab',
  root,
  title: 'Dungeon Agent 移动 Lab',
  description: '在地图传送完整链路上扫描 dungeon-agent，验证运行时占位、朝向、手动格步移动与 Debug 3D 模型。',
  badge: 'Composable Lab · Dungeon Transition + Agent',
  modules: ['dungeon-config', 'dungeon-transition', 'dungeon-variable-trigger', 'dungeon-agent', 'dungeon-visual-deformation'],
  catalog: dungeonLabModuleCatalog,
});

window.addEventListener('pagehide', event => { if (!event.persisted) host.dispose(); });
