import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import {
  setDungeonObstacleActive,
  type DungeonObstacleBinding,
} from '@/core/dungeon-obstacle';
import { createLabJson, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import {
  dungeonMapChangedEvent,
  dungeonRuntimeCommitRequest,
} from '../dungeon-map-loader/dungeonMapLoader.protocol';
import {
  DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
  type DungeonMapLoaderReferences,
  type LoadedDungeonReferences,
} from '../dungeon-map-loader/dungeonMapLoader.references';
import { resolveDungeonObstacleDebugLayout } from './dungeonObstacleDebugLayout';

const placementLabel = (binding: DungeonObstacleBinding): string => {
  const placement = binding.placement;
  if (placement.kind === 'tile') return `格子 (${placement.tileX}, ${placement.tileY})`;
  if (placement.kind === 'tile-edge') return `独立边 (${placement.tileX}, ${placement.tileY}) ${placement.direction}`;
  return `公用边 ${placement.sharedEdgeId}`;
};

export const dungeonObstacleLabModule: LabModule = {
  id: 'dungeon-obstacle',
  dependencies: ['dungeon-map-loader'],
  setup(context) {
    const references = context.services.get<DungeonMapLoaderReferences>(
      DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
    );
    const panel = context.ui.addPanel('dungeon-obstacle', '地牢阻碍');
    const debugToggle = createLabSwitch('显示阻碍 Debug 盒');
    const list = document.createElement('div');
    list.className = 'lab-obstacle-list';
    const runtimeJson = createLabJson();
    panel.content.append(debugToggle.row, list, runtimeJson);
    let current: LoadedDungeonReferences | null = null;
    let debugRoot: TransformNode | null = null;
    const disposeDebug = () => {
      debugRoot?.dispose(false, true);
      debugRoot = null;
    };
    const refreshJson = () => {
      runtimeJson.textContent = current
        ? JSON.stringify({
          loadId: current.loadId,
          dungeonPresetKey: current.presetKey,
          obstacleStates: Object.fromEntries(current.runtime.obstacleStates),
        }, null, 2)
        : '尚未加载';
    };
    const renderDebug = () => {
      disposeDebug();
      if (!debugToggle.input.checked || !current) return;
      const loaded = current;
      const activeMaterial = new StandardMaterial(`obstacle_active_${loaded.loadId}`, context.scene);
      activeMaterial.diffuseColor = Color3.FromHexString('#e24c3d');
      activeMaterial.emissiveColor = Color3.FromHexString('#7c211b');
      activeMaterial.alpha = 0.42;
      const inactiveMaterial = new StandardMaterial(`obstacle_inactive_${loaded.loadId}`, context.scene);
      inactiveMaterial.diffuseColor = Color3.FromHexString('#71808c');
      inactiveMaterial.emissiveColor = Color3.FromHexString('#273039');
      inactiveMaterial.alpha = 0.14;
      inactiveMaterial.wireframe = true;
      debugRoot = new TransformNode(`obstacle_debug_${loaded.loadId}`, context.scene);
      loaded.obstacles.forEach((binding) => {
        const active = loaded.runtime.obstacleStates.get(binding.entity.id) === true;
        const layout = resolveDungeonObstacleDebugLayout(
          binding,
          loaded.spawn.sceneEnvironmentComponent,
          loaded.runtime.map.width,
          loaded.runtime.map.height,
        );
        const box = MeshBuilder.CreateBox(`obstacle_${loaded.loadId}_${binding.entity.id}`, {
          width: layout.size[0], height: layout.size[1], depth: layout.size[2],
        }, context.scene);
        box.position.set(...layout.center);
        box.material = active ? activeMaterial : inactiveMaterial;
        box.parent = debugRoot;
        box.isPickable = false;
        box.enableEdgesRendering();
        box.edgesColor.set(active ? 1 : 0.45, active ? 0.25 : 0.55, active ? 0.18 : 0.62, active ? 1 : 0.5);
        box.edgesWidth = active ? 4 : 2;
      });
    };
    const renderList = () => {
      if (!current) { list.textContent = '尚未加载'; return; }
      const loaded = current;
      list.replaceChildren(...loaded.obstacles.map((binding) => {
        const item = document.createElement('div');
        item.className = 'lab-obstacle-item';
        const label = document.createElement('label');
        const text = document.createElement('span');
        text.textContent = binding.entity.name ?? binding.entity.id;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = loaded.runtime.obstacleStates.get(binding.entity.id) === true;
        checkbox.addEventListener('change', () => {
          setDungeonObstacleActive(loaded.runtime, binding.entity.id, checkbox.checked);
          refreshJson();
          renderDebug();
          void context.communication.request(dungeonRuntimeCommitRequest, { reason: 'obstacle-state' });
        });
        const detail = document.createElement('small');
        detail.textContent = `${placementLabel(binding)} · ${binding.entity.id}`;
        label.append(text, checkbox);
        item.append(label, detail);
        return item;
      }));
    };
    debugToggle.input.addEventListener('change', renderDebug);
    const off = context.communication.on(dungeonMapChangedEvent, (next) => {
      const loaded = references.current;
      if (!loaded || loaded.loadId !== next.loadId) return;
      current = loaded;
      renderList();
      refreshJson();
      renderDebug();
    });
    return () => { off(); disposeDebug(); };
  },
};
