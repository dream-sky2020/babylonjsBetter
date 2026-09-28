import { createLab, type LabModule } from '@/tools/lab-kit';
import { DEFAULT_OVERHEAD_VIEW, type DungeonViewConsumer } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import { DUNGEON_GRID_VIEW_SERVICE_KEY } from '@/tools/lab-modules/dungeon/dungeon-grid/dungeonGrid.view';
import { DUNGEON_OBSTACLE_VIEW_SERVICE_KEY } from '@/tools/lab-modules/dungeon/dungeon-obstacle/dungeonObstacle.view';
import '@/tools/lab-kit/styles.css';

const demo: LabModule = {
  id: 'overhead-view-demo', dependencies: ['dungeon-config', 'dungeon-overhead-view', 'dungeon-grid', 'dungeon-obstacle', 'dungeon-visual-deformation'],
  setup(context) {
    const debug = [DUNGEON_GRID_VIEW_SERVICE_KEY, DUNGEON_OBSTACLE_VIEW_SERVICE_KEY]
      .map(key => context.services.get<DungeonViewConsumer & { setVisible(visible: boolean): void }>(key));
    return { start() {
      debug.forEach(service => service.setVisible(true));
    } };
  },
};
const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');
const host = await createLab({
  root, title: 'Dungeon 俯视比例 Lab', badge: 'Composable Lab · Overhead View',
  description: '统一验证俯视角、格子比例和第一人称切换；显示变形模块可读取地图配置或应用面板草稿，默认不生成测试物体。',
  modules: ['overhead-view-demo'], catalog: { ...dungeonLabModuleCatalog, [demo.id]: demo },
  initialState: { format: 'lab-state', version: 1, createdAt: '', modules: {
    'dungeon-overhead-view': { settings: { version: 1, data: { enabled: true, draft: { ...DEFAULT_OVERHEAD_VIEW } } } },
  } },
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
