import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import { applyDungeonViewToNode, createDungeonViewConsumer, type ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { scanDungeonDocumentObstacles, setDungeonObstacleActive, type DungeonObstacleBinding } from '@/core/dungeon-obstacle';
import { resolveDungeonSpatialFootprint } from '@/core/dungeon-space';
import { createLabJson, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import { dungeonMapChangedEvent, dungeonRuntimeCommitRequest } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY, type DungeonMapLoaderReferences,
  type LoadedDungeonReferences } from '../dungeon-map-loader/dungeonMapLoader.references';
import { resolveDungeonObstacleDebugLayout } from './dungeonObstacleDebugLayout';
import { DUNGEON_OBSTACLE_VIEW_SERVICE_KEY } from './dungeonObstacle.view';

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
    const assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    const uninstall = assembly.install('obstacles', scanDungeonDocumentObstacles);
    const references = context.services.get<DungeonMapLoaderReferences>(DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY);
    const panel = context.ui.addPanel('dungeon-obstacle', '地牢阻碍');
    const debugToggle = createLabSwitch('显示静态阻碍 Debug', false, {
      preference: { ui: context.ui, key: 'dungeon-obstacle/debug-boxes' },
    });
    const list = document.createElement('div');
    list.className = 'lab-obstacle-list';
    const json = createLabJson('尚未加载地图。');
    panel.content.append(debugToggle.row, list, json);
    let current: LoadedDungeonReferences | null = null;
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
      loaded.obstacles.forEach(binding => {
        const active = loaded.runtime.obstacleStates.get(binding.entity.id) === true;
        const layout = resolveDungeonObstacleDebugLayout(binding,
          loaded.sceneBinding.component, loaded.runtime.map.width, loaded.runtime.map.height);
        const box = MeshBuilder.CreateBox(`obstacle_${loaded.loadId}_${binding.entity.id}`, {
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
      json.textContent = JSON.stringify({ loadId: loaded.loadId,
        obstacles: loaded.obstacles.map(binding => ({ entityId: binding.entity.id,
          placement: binding.placement,
          spatialFootprint: binding.placement.kind === 'tile'
            ? resolveDungeonSpatialFootprint(binding.component.spatialFootprint, 'full-tile') : 'edge-boundary',
          active: loaded.runtime.obstacleStates.get(binding.entity.id) === true })),
      }, null, 2);
      list.replaceChildren(...loaded.obstacles.map(binding => {
        const item = document.createElement('div');
        item.className = 'lab-obstacle-item';
        const label = document.createElement('label');
        const text = document.createElement('span');
        text.textContent = binding.entity.name ?? binding.entity.id;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = loaded.runtime.obstacleStates.get(binding.entity.id) === true;
        checkbox.addEventListener('change', () => {
          if (assembly.isPaused || context.scheduler.isPaused) return;
          setDungeonObstacleActive(loaded.runtime, binding.entity.id, checkbox.checked);
          if (loaded.runtime.installedSystems?.traversal === false) refresh();
          void context.communication.request(dungeonRuntimeCommitRequest, { reason: 'obstacle-state' });
        });
        const detail = document.createElement('small');
        const footprint = binding.placement.kind === 'tile'
          ? resolveDungeonSpatialFootprint(binding.component.spatialFootprint, 'full-tile') === 'full-tile'
            ? '整格占位' : '中心占位' : '边界阻挡';
        detail.textContent = `${placementLabel(binding)} · ${footprint} · ${binding.entity.id}`;
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
      const loaded = references.current;
      if (!loaded || loaded.loadId !== event.loadId) return;
      offChanges?.(); current = loaded;
      offChanges = loaded.runtime.installedSystems?.traversal === false ? null : loaded.runtime.traversal.subscribe(change => {
        if (change.kind === 'obstacle-state-changed') refresh();
      });
      refresh();
    });
    return () => {
      uninstall(); offMap(); offChanges?.(); viewConsumer.dispose(); context.services.delete(DUNGEON_OBSTACLE_VIEW_SERVICE_KEY);
      disposeDebug(); panel.root.remove();
    };
  },
};
