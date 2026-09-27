import { createLab, type LabModule } from '@/tools/lab-kit';
import { DEFAULT_OVERHEAD_VIEW, type DungeonViewConsumer } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import { DUNGEON_GRID_VIEW_SERVICE_KEY } from '@/tools/lab-modules/dungeon/dungeon-grid-debug/dungeonGridDebug.view';
import { DUNGEON_OBSTACLE_VIEW_SERVICE_KEY } from '@/tools/lab-modules/dungeon/dungeon-obstacle/dungeonObstacle.view';
import '@/tools/lab-kit/styles.css';

const demo: LabModule = {
  id: 'overhead-view-demo', dependencies: ['dungeon-config', 'dungeon-overhead-view', 'dungeon-grid-debug', 'dungeon-obstacle'],
  setup(context) {
    const debug = [DUNGEON_GRID_VIEW_SERVICE_KEY, DUNGEON_OBSTACLE_VIEW_SERVICE_KEY]
      .map(key => context.services.get<DungeonViewConsumer & { setVisible(visible: boolean): void }>(key));
    return { start() { debug.forEach(service => service.setVisible(true)); } };
  },
};
const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');
const host = await createLab({
  root, title: 'Dungeon 俯视比例 Lab', badge: 'Composable Lab · Overhead View',
  description: '统一俯视角与格子显示比例。调整角度后应用草稿；V 切换第一人称，关闭协调或恢复地图配置可比较原布局。只变换 Debug 与玩家标记，场景美术不在本实验范围。',
  modules: ['overhead-view-demo'], catalog: { ...dungeonLabModuleCatalog, [demo.id]: demo },
  initialState: { format: 'lab-state', version: 1, createdAt: '', modules: {
    'dungeon-overhead-view': { settings: { version: 1, data: { enabled: true, draft: { ...DEFAULT_OVERHEAD_VIEW } } } },
  } },
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
