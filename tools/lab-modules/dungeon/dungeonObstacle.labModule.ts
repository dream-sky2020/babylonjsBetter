import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import {
  initializeDungeonObstacleStates,
  resolveDungeonObstacleDebugLayout,
  setDungeonObstacleActive,
  type DungeonObstacleBinding,
} from '@/core/dungeon-obstacle';
import { createLabJson, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import {
  DUNGEON_LAB_SERVICES,
  type DungeonObstaclesReadyEvent,
  type DungeonRuntimeReadyEvent,
} from './dungeonLab.types';

const placementLabel = (binding: DungeonObstacleBinding): string => {
  const placement = binding.placement;
  if (placement.kind === 'tile') return `格子 (${placement.tileX}, ${placement.tileY})`;
  if (placement.kind === 'tile-edge') return `独立边 (${placement.tileX}, ${placement.tileY}) ${placement.direction}`;
  return `公用边 ${placement.sharedEdgeId}`;
};

export const dungeonObstacleLabModule: LabModule = {
  id: 'dungeon-obstacle',
  dependencies: ['player-spawn'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-obstacle', '地牢阻碍');
    const debugToggle = createLabSwitch('显示阻碍 Debug 盒');
    const list = document.createElement('div');
    list.className = 'lab-obstacle-list';
    const runtimeJson = createLabJson();
    panel.content.append(debugToggle.row, list, runtimeJson);
    let current: DungeonObstaclesReadyEvent | null = null;
    let debugRoot: TransformNode | null = null;
    const disposeDebug = () => {
      debugRoot?.dispose(false, true);
      debugRoot = null;
    };
    const refreshJson = () => {
      runtimeJson.textContent = current
        ? JSON.stringify({ obstacleStates: Object.fromEntries(current.runtime.obstacleStates) }, null, 2)
        : '尚未加载';
    };
    const renderDebug = () => {
      disposeDebug();
      if (!debugToggle.input.checked || !current) return;
      const activeMaterial = new StandardMaterial('composable_obstacle_active', context.scene);
      activeMaterial.diffuseColor = Color3.FromHexString('#e24c3d');
      activeMaterial.emissiveColor = Color3.FromHexString('#7c211b');
      activeMaterial.alpha = 0.42;
      const inactiveMaterial = new StandardMaterial('composable_obstacle_inactive', context.scene);
      inactiveMaterial.diffuseColor = Color3.FromHexString('#71808c');
      inactiveMaterial.emissiveColor = Color3.FromHexString('#273039');
      inactiveMaterial.alpha = 0.14;
      inactiveMaterial.wireframe = true;
      debugRoot = new TransformNode('composable_obstacle_debug', context.scene);
      const event = current;
      event.obstacles.forEach((binding) => {
        const active = event.runtime.obstacleStates.get(binding.entity.id) === true;
        const layout = resolveDungeonObstacleDebugLayout(
          binding,
          event.spawn.sceneEnvironmentComponent,
          event.runtime.map.width,
          event.runtime.map.height,
        );
        const box = MeshBuilder.CreateBox(`composable_obstacle_${binding.entity.id}`, {
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
      if (!current) {
        list.textContent = '尚未加载';
        return;
      }
      const event = current;
      list.replaceChildren(...event.obstacles.map((binding) => {
        const item = document.createElement('div');
        item.className = 'lab-obstacle-item';
        const label = document.createElement('label');
        const text = document.createElement('span');
        text.textContent = binding.entity.name ?? binding.entity.id;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = event.runtime.obstacleStates.get(binding.entity.id) === true;
        checkbox.addEventListener('change', () => {
          setDungeonObstacleActive(event.runtime, binding.entity.id, checkbox.checked);
          refreshJson();
          renderDebug();
          void context.events.emit('dungeon:runtime-changed', { reason: 'obstacle-state', runtime: event.runtime });
        });
        const detail = document.createElement('small');
        detail.textContent = `${placementLabel(binding)} · ${binding.entity.id}`;
        label.append(text, checkbox);
        item.append(label, detail);
        return item;
      }));
    };
    debugToggle.input.addEventListener('change', renderDebug);
    const offRuntime = context.events.on<DungeonRuntimeReadyEvent>('dungeon:runtime-ready', async (event) => {
      const obstacles = initializeDungeonObstacleStates(event.runtime);
      current = { ...event, obstacles };
      context.services.set(DUNGEON_LAB_SERVICES.obstacles, obstacles);
      renderList();
      refreshJson();
      renderDebug();
      await context.events.emit('dungeon:obstacles-ready', current);
    });
    return () => {
      offRuntime();
      disposeDebug();
    };
  },
};
