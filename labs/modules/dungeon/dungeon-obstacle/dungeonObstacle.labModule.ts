import { DUNGEON_GRID_MEMORY } from '../dungeon-grid/dungeonGrid.memory';
import { DUNGEON_OBSTACLE_STATE_MEMORY } from '../dungeon-runtime/dungeonRuntime.memory';
import { DUNGEON_OBSTACLES_MEMORY, type DungeonObstacleData, type DungeonObstaclesData } from './dungeonObstacles.memory';
import { DUNGEON_OBSTACLE_CONTROL_SERVICE_KEY } from '@/core/dungeon-obstacle/dungeonObstacleControl';
import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import { applyDungeonViewToNode, createDungeonViewConsumer, type ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { scanDungeonDocumentObstacles } from '@/core/dungeon-obstacle';
import { createLabJson, createLabSwitch, type LabModule } from '@/labs/kit';
import { dungeonMapChangedEvent, dungeonRuntimeCommitRequest } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { resolveDungeonObstacleDebugLayout } from './dungeonObstacleDebugLayout';
import { DUNGEON_OBSTACLE_VIEW_SERVICE_KEY } from './dungeonObstacle.view';

const placementLabel = (binding: DungeonObstacleData): string => {
  const placement = binding.placement;
  if (placement.kind === 'tile') return `格子 (${placement.tileX}, ${placement.tileY})`;
  if (placement.kind === 'tile-edge') return `独立边 (${placement.tileX}, ${placement.tileY}) ${placement.direction}`;
  return `公用边 ${placement.sharedEdgeId}`;
};

export const dungeonObstacleLabModule: LabModule = {
  id: 'dungeon-obstacle',
  dependencies: ['dungeon-map-loader'],
  setup(context) {
    const assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    const uninstall = assembly.install('obstacles', scanDungeonDocumentObstacles);
    const obstaclesMemory = context.memory.acquire(DUNGEON_OBSTACLES_MEMORY);
    const stateMemory = context.memory.acquire(DUNGEON_OBSTACLE_STATE_MEMORY);
    const gridMemory = context.memory.acquire(DUNGEON_GRID_MEMORY);
    const control = context.services.get(DUNGEON_OBSTACLE_CONTROL_SERVICE_KEY);
    const panel = context.ui.addPanel('dungeon-obstacle', '地牢阻碍');
    const debugToggle = createLabSwitch('显示静态阻碍 Debug', false, {
      preference: { ui: context.ui, key: 'dungeon-obstacle/debug-boxes' },
    });
    const list = document.createElement('div');
    list.className = 'lab-obstacle-list';
    const json = createLabJson('尚未加载地图。');
    panel.content.append(debugToggle.row, list, json);
    let current: DungeonObstaclesData | null = null;
    let root: TransformNode | null = null;
    let materials: StandardMaterial[] = [];
    let view: ResolvedDungeonView | null = null;
    let offChanges: (() => void) | null = null;
    const viewConsumer = createDungeonViewConsumer(next => {
      view = next;
      if (root) applyDungeonViewToNode(root, view);
    });
    const disposeDebug = () => {
      root?.dispose(false, false); root = null;
      materials.forEach(material => material.dispose()); materials = [];
    };
    const renderDebug = () => {
      disposeDebug();
      if (!debugToggle.input.checked || !current) return;
      const loaded = current;
      const state = stateMemory.current, grid = gridMemory.current;
      if (!state || !grid || state.loadId !== loaded.loadId || grid.loadId !== loaded.loadId) return;
      root = new TransformNode(`obstacle_debug_${loaded.loadId}`, context.scene);
      applyDungeonViewToNode(root, view);
      const activeMaterial = new StandardMaterial(`obstacle_active_${loaded.loadId}`, context.scene);
      materials.push(activeMaterial);
      activeMaterial.diffuseColor = Color3.FromHexString('#e24c3d');
      activeMaterial.alpha = 0.42;
      const inactiveMaterial = new StandardMaterial(`obstacle_inactive_${loaded.loadId}`, context.scene);
      materials.push(inactiveMaterial);
      inactiveMaterial.diffuseColor = Color3.FromHexString('#71808c');
      inactiveMaterial.alpha = 0.14;
      inactiveMaterial.wireframe = true;
      loaded.items.forEach(binding => {
        const active = state.states.get(binding.entityId) === true;
        const layout = resolveDungeonObstacleDebugLayout(binding,
          grid, grid.width, grid.height);
        const box = MeshBuilder.CreateBox(`obstacle_${loaded.loadId}_${binding.entityId}`, {
          width: layout.size[0], height: layout.size[1], depth: layout.size[2],
        }, context.scene);
        box.position.set(...layout.center);
        box.material = active ? activeMaterial : inactiveMaterial;
        box.parent = root; box.isPickable = false;
        box.enableEdgesRendering();
        box.edgesColor.set(active ? 1 : 0.45, active ? 0.25 : 0.55, active ? 0.18 : 0.62, active ? 1 : 0.5);
        box.edgesWidth = active ? 4 : 2;
      });
    };
    const refresh = () => {
      if (!current) { list.textContent = '尚未加载'; return; }
      const loaded = current;
      const state = stateMemory.current;
      if (!state || state.loadId !== loaded.loadId) return;
      json.textContent = JSON.stringify({ loadId: loaded.loadId,
        obstacles: loaded.items.map(binding => ({ entityId: binding.entityId,
          placement: binding.placement,
          spatialFootprint: binding.spatialFootprint,
          active: state.states.get(binding.entityId) === true })),
      }, null, 2);
      list.replaceChildren(...loaded.items.map(binding => {
        const item = document.createElement('div');
        item.className = 'lab-obstacle-item';
        const label = document.createElement('label');
        const text = document.createElement('span');
        text.textContent = binding.name;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = state.states.get(binding.entityId) === true;
        checkbox.addEventListener('change', () => {
          if (assembly.isPaused || context.scheduler.isPaused) return;
          if (!control.setActive(loaded.loadId, binding.entityId, checkbox.checked)) return;
          refresh();
          void context.communication.request(dungeonRuntimeCommitRequest, { reason: 'obstacle-state' });
        });
        const detail = document.createElement('small');
        const footprint = binding.placement.kind === 'tile'
          ? binding.spatialFootprint === 'full-tile'
            ? '整格占位' : '中心占位' : '边界阻挡';
        detail.textContent = `${placementLabel(binding)} · ${footprint} · ${binding.entityId}`;
        label.append(text, checkbox); item.append(label, detail);
        return item;
      }));
      renderDebug();
    };
    debugToggle.input.addEventListener('change', renderDebug);
    context.services.set(DUNGEON_OBSTACLE_VIEW_SERVICE_KEY, {
      acquire: viewConsumer.acquire,
      setVisible(visible: boolean) { debugToggle.input.checked = visible; renderDebug(); },
    });
    const offMap = context.communication.on(dungeonMapChangedEvent, event => {
      const loaded = obstaclesMemory.current;
      if (!loaded || loaded.loadId !== event.loadId) return;
      offChanges?.(); current = loaded;
      offChanges = control.subscribe(loaded.loadId, refresh);
      refresh();
    });
    return () => {
      debugToggle.input.removeEventListener('change', renderDebug);
      uninstall(); offMap(); offChanges?.(); viewConsumer.dispose(); context.services.delete(DUNGEON_OBSTACLE_VIEW_SERVICE_KEY);
      disposeDebug(); panel.root.remove();
    };
  },
};
