import { createLab, type LabModule } from '@/tools/lab-kit';
import { DEFAULT_OVERHEAD_VIEW, type DungeonViewConsumer } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import { DUNGEON_GRID_VIEW_SERVICE_KEY } from '@/tools/lab-modules/dungeon/dungeon-grid-debug/dungeonGridDebug.view';
import { DUNGEON_OBSTACLE_VIEW_SERVICE_KEY } from '@/tools/lab-modules/dungeon/dungeon-obstacle/dungeonObstacle.view';
import '@/tools/lab-kit/styles.css';
import { createDeformationSamples } from './deformationSamples';
import { Vector3 } from '@babylonjs/core';
import { DEFAULT_DEFORMATION_SETTINGS } from '@/core/render-deformation/deformation.ts';
import { DUNGEON_VISUAL_DEFORMATION_SERVICE_KEY, type DungeonVisualDeformationService } from '@/tools/lab-modules/dungeon/dungeon-visual-deformation';
import { DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY, type DungeonMapLoaderReferences } from '@/tools/lab-modules/dungeon/dungeon-map-loader/dungeonMapLoader.references';
import { dungeonMapChangedEvent } from '@/tools/lab-modules/dungeon/dungeon-map-loader/dungeonMapLoader.protocol';
import { DUNGEON_OVERHEAD_VIEW_SERVICE_KEY, type DungeonOverheadViewService } from '@/tools/lab-modules/dungeon/dungeon-overhead-view';
import { mapDungeonDisplayPosition } from '@/core/dungeon-view/dungeonOverheadView.ts';

const demo: LabModule = {
  id: 'overhead-view-demo', dependencies: ['dungeon-config', 'dungeon-overhead-view', 'dungeon-grid-debug', 'dungeon-obstacle', 'dungeon-visual-deformation'],
  setup(context) {
    const debug = [DUNGEON_GRID_VIEW_SERVICE_KEY, DUNGEON_OBSTACLE_VIEW_SERVICE_KEY]
      .map(key => context.services.get<DungeonViewConsumer & { setVisible(visible: boolean): void }>(key));
    const references = context.services.get<DungeonMapLoaderReferences>(DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY);
    const view = context.services.get<DungeonOverheadViewService>(DUNGEON_OVERHEAD_VIEW_SERVICE_KEY);
    const deformation = context.services.get<DungeonVisualDeformationService>(DUNGEON_VISUAL_DEFORMATION_SERVICE_KEY);
    let samples: ReturnType<typeof createDeformationSamples> | null = null;
    const place = () => {
      if (!samples || !references.current) return;
      const position = mapDungeonDisplayPosition(view.view, references.current.runtime.playerWorldPosition);
      samples.root.position.copyFrom(Vector3.FromArray(position));
      samples.root.position.z -= 5;
    };
    const offMap = context.communication.on(dungeonMapChangedEvent, place); const offView = view.subscribe(place);
    return { start() {
      debug.forEach(service => service.setVisible(true)); samples = createDeformationSamples(context.scene); samples.animate(); place();
      deformation.setDraft({ ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true, selection: 'rules', rules: [
        { selector: 'group', value: 'sample-models', strength: 1 }, { selector: 'group', value: 'sample-sprites', strength: 1 },
        { selector: 'id', value: 'sample:half', strength: .5 },
      ] });
    }, dispose() { offMap(); offView(); samples?.dispose(); } };
  },
};
const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');
const host = await createLab({
  root, title: 'Dungeon 俯视比例 Lab', badge: 'Composable Lab · Overhead View',
  description: '统一俯视角、格子比例与物体顶点变形。两个方柱共享材质但强度不同，并包含骨骼模型与 2D Shader。批量面板默认仅控制示例组；V 切第一人称会暂停变形。',
  modules: ['overhead-view-demo'], catalog: { ...dungeonLabModuleCatalog, [demo.id]: demo },
  initialState: { format: 'lab-state', version: 1, createdAt: '', modules: {
    'dungeon-overhead-view': { settings: { version: 1, data: { enabled: true, draft: { ...DEFAULT_OVERHEAD_VIEW } } } },
  } },
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
