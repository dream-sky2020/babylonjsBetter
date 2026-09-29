import { createLab } from '@/tools/lab-kit';
import { DEFAULT_OVERHEAD_VIEW } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: 'Dungeon Agent 移动 Lab',
  description: '在地图传送完整链路上扫描 dungeon-agent，验证运行时占位、朝向、手动格步移动与 Debug 3D 模型。',
  badge: 'Composable Lab · Dungeon Transition + Agent',
  modules: ['dungeon-config', 'dungeon-transition', 'dungeon-agent', 'dungeon-visual-deformation'],
  catalog: dungeonLabModuleCatalog,
  initialState: { format: 'lab-state', version: 1, createdAt: '', modules: {
    'dungeon-overhead-view': { settings: { version: 1, data: { enabled: true, draft: { ...DEFAULT_OVERHEAD_VIEW } } } },
  } },
});

window.addEventListener('beforeunload', () => host.dispose(), { once: true });
