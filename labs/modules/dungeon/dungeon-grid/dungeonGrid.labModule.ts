import { controlSetting } from '@/labs/kit/settings/LabSettingsStore';
import { DUNGEON_GRID_MEMORY, type DungeonGridData } from './dungeonGrid.memory';
import { Color3, StandardMaterial, TransformNode } from '@babylonjs/core';
import { createDungeonGridDebugMeshes, createDungeonGridDebugOutlines } from './dungeonGridDebugMesh.ts';
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
    const toggle = createLabSwitch('显示全部格子 Debug', false);
    const mode = document.createElement('select');
    mode.append(new Option('3D 盒', 'box'), new Option('2D 格面轮廓', 'flat'));
    const x = document.createElement('input');
    const y = document.createElement('input');
    for (const input of [x, y]) { input.type = 'number'; input.min = '0'; input.step = '1'; input.value = '0'; }
    const info = createLabStatus('尚未加载地图。');
    panel.content.append(toggle.row, createLabField('Debug 显示方式', mode),
      createLabField('查看格子 X', x), createLabField('查看格子 Y', y), info);

    let current: DungeonGridData | null = null;
    let root: TransformNode | null = null;
    let material: StandardMaterial | null = null;
    let view: ResolvedDungeonView | null = null;
    const viewConsumer = createDungeonViewConsumer(next => {
      view = next;
      if (root) applyDungeonViewToNode(root, view);
    });
    const disposeDebug = () => {
      root?.dispose(false, false); root = null;
      material?.dispose(); material = null;
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
    const renderDebug = () => {
      disposeDebug();
      if (!toggle.input.checked || !current) return;
      root = new TransformNode(`dungeon_grid_debug_${current.loadId}`, context.scene);
      applyDungeonViewToNode(root, view);
      if (mode.value === 'flat') {
        createDungeonGridDebugOutlines(context.scene, root, current);
        return;
      }
      material = new StandardMaterial(`dungeon_grid_debug_material_${current.loadId}`, context.scene);
      material.diffuseColor = Color3.FromHexString('#36bff2');
      material.emissiveColor = Color3.FromHexString('#17698a');
      material.alpha = 0.2;
      material.wireframe = true;
      createDungeonGridDebugMeshes(context.scene, root, current, material);
    };
    toggle.input.addEventListener('change', renderDebug);
    mode.addEventListener('change', renderDebug);
    x.addEventListener('change', describe);
    y.addEventListener('change', describe);
    context.services.set(DUNGEON_GRID_VIEW_SERVICE_KEY, {
      acquire: viewConsumer.acquire,
      setVisible(visible: boolean) { toggle.input.checked = visible; renderDebug(); },
    });
    const off = context.communication.on(dungeonMapChangedEvent, (event) => {
      const loaded = gridMemory.current;
      if (!loaded || loaded.loadId !== event.loadId) return;
      current = loaded;
      x.max = String(loaded.width - 1);
      y.max = String(loaded.height - 1);
      for (const input of [x, y]) if (input.valueAsNumber > Number(input.max)) input.value = input.max;
      describe();
      renderDebug();
    });
    const rememberedSettings = context.ui.registerSettings('dungeon-grid-debug', [
      controlSetting('all-tiles', '显示全部格子 Debug', toggle.input, { defaultRemember: true, legacyKey: 'dungeon-grid-debug/all-tiles' }),
      controlSetting('display-mode', 'Debug 显示方式', mode),
      controlSetting('inspect-x', '查看格子 X', x, { valid: value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && (!x.max || value <= Number(x.max)) }),
      controlSetting('inspect-y', '查看格子 Y', y, { valid: value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && (!y.max || value <= Number(y.max)) }),
    ], () => { describe(); renderDebug(); });
    return () => {
      rememberedSettings.dispose();
      toggle.input.removeEventListener('change', renderDebug); mode.removeEventListener('change', renderDebug);
      x.removeEventListener('change', describe); y.removeEventListener('change', describe);
      off(); viewConsumer.dispose(); context.services.delete(DUNGEON_GRID_VIEW_SERVICE_KEY); disposeDebug();
      panel.root.remove();
    };
  },
};
