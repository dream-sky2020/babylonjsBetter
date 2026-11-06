import { createLab } from '@/labs/kit';
import { dungeonLabModuleCatalog } from '@/labs/modules/dungeon';
import { uiRuntimeLabModule } from '@/labs/modules/shared/ui-runtime/uiRuntime.labModule';
import { dungeonHudLabModule } from '@/labs/modules/dungeon/dungeon-hud/dungeonHud.labModule';
import '@/labs/kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');
const host = await createLab({ labId: 'dungeon-ui-overlay-lab', root, title: '地牢 UI 覆盖层 Lab', description: '加载 UI 编辑器预设，显示共享地图状态并通过模块请求切换地图。', badge: 'Composable Lab · UI Overlay', modules: ['dungeon-hud'], catalog: { ...dungeonLabModuleCatalog, [uiRuntimeLabModule.id]: uiRuntimeLabModule, [dungeonHudLabModule.id]: dungeonHudLabModule } });
window.addEventListener('pagehide', event => { if (!event.persisted) host.dispose(); });
