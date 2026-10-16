import { DUNGEON_GRID_MEMORY, type DungeonGridData } from './dungeonGrid.memory';
import { Color3, StandardMaterial, TransformNode } from '@babylonjs/core';
import { createDungeonGridDebugMeshes } from './dungeonGridDebugMesh.ts';
import { applyDungeonViewToNode, createDungeonViewConsumer, type ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene/dungeonMapSceneLayout';
import { createLabField, createLabStatus, createLabSwitch, type LabModule } from '@/labs/kit';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { DUNGEON_GRID_VIEW_SERVICE_KEY } from './dungeonGrid.view';

export const dungeonGridLabModule: LabModule = {
  id: 'dungeon-grid',
  dependencies: ['dungeon-map-loader'],
  setup(context) {
    const gridMemory = context.memory.acquire(DUNGEON_GRID_MEMORY);
    // 沿用已发布面板 ID，保留用户已有的折叠布局偏好。
    const panel = context.ui.addPanel('dungeon-grid-debug', '地牢格子');
    const toggle = createLabSwitch('显示全部格子 Debug 盒', false, {
      preference: { ui: context.ui, key: 'dungeon-grid-debug/all-tiles' },
    });
    const x = document.createElement('input');
    const y = document.createElement('input');
    for (const input of [x, y]) { input.type = 'number'; input.min = '0'; input.step = '1'; input.value = '0'; }
    const info = createLabStatus('尚未加载地图。');
    panel.content.append(toggle.row, createLabField('查看格子 X', x), createLabField('查看格子 Y', y), info);

    let current: DungeonGridData | null = null;
    let root: TransformNode | null = null;
    let materials: StandardMaterial[] = [];
    let view: ResolvedDungeonView | null = null;
    const viewConsumer = createDungeonViewConsumer(next => {
      view = next;
      if (root) applyDungeonViewToNode(root, view);
    });
    const disposeBoxes = () => {
      root?.dispose(false, false); root = null;
      materials.forEach(material => material.dispose()); materials = [];
    };
    const describe = () => {
      if (!current) { info.textContent = '尚未加载地图。'; return; }
      const map = current;
      const tileX = Number(x.value);
      const tileY = Number(y.value);
      if (!Number.isInteger(tileX) || !Number.isInteger(tileY)
        || tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) {
        info.textContent = `格子坐标须位于 X 0–${map.width - 1}、Y 0–${map.height - 1}。`;
        return;
      }
      const index = tileY * map.width + tileX;
      const layout = resolveDungeonMapTileWorldLayout(
        current, map.width, map.height, tileX, tileY,
      );
      info.textContent = `地图 ${map.width}×${map.height} · 格子 ${map.tileIds[index]}
        · index ${index} · 世界中心 (${layout.center.map(value => value.toFixed(2)).join(', ')})
        · 尺寸 (${layout.size.join(', ')})`;
    };
    const renderBoxes = () => {
      disposeBoxes();
      if (!toggle.input.checked || !current) return;
      const loaded = current;
      const map = loaded;
      root = new TransformNode(`dungeon_grid_debug_${loaded.loadId}`, context.scene);
      applyDungeonViewToNode(root, view);
      const material = new StandardMaterial(`dungeon_grid_debug_material_${loaded.loadId}`, context.scene);
      materials.push(material);
      material.diffuseColor = Color3.FromHexString('#36bff2');
      material.emissiveColor = Color3.FromHexString('#17698a');
      material.alpha = 0.2;
      material.wireframe = true;
      createDungeonGridDebugMeshes(context.scene, root, map, material);
    };
    toggle.input.addEventListener('change', renderBoxes);
    x.addEventListener('change', describe);
    y.addEventListener('change', describe);
    context.services.set(DUNGEON_GRID_VIEW_SERVICE_KEY, {
      acquire: viewConsumer.acquire,
      setVisible(visible: boolean) { toggle.input.checked = visible; renderBoxes(); },
    });
    const off = context.communication.on(dungeonMapChangedEvent, (event) => {
      const loaded = gridMemory.current;
      if (!loaded || loaded.loadId !== event.loadId) return;
      current = loaded;
      x.max = String(loaded.width - 1);
      y.max = String(loaded.height - 1);
      describe();
      renderBoxes();
    });
    return () => {
      toggle.input.removeEventListener('change', renderBoxes); x.removeEventListener('change', describe); y.removeEventListener('change', describe);
      off(); viewConsumer.dispose(); context.services.delete(DUNGEON_GRID_VIEW_SERVICE_KEY); disposeBoxes();
      panel.root.remove();
    };
  },
};
