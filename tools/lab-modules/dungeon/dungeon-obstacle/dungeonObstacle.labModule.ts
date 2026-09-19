import { Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import {
  setDungeonObstacleActive,
  type DungeonObstacleBinding,
} from '@/core/dungeon-obstacle';
import { createLabJson, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import {
  dungeonMapChangedEvent,
  dungeonRuntimeChangedEvent,
  dungeonRuntimeCommitRequest,
} from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { dungeonAgentsChangedEvent } from '../dungeon-agent/dungeonAgent.protocol';
import {
  DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
  type DungeonMapLoaderReferences,
  type LoadedDungeonReferences,
} from '../dungeon-map-loader/dungeonMapLoader.references';
import {
  resolveDungeonObstacleDebugLayout,
  resolveDungeonTileDebugLayout,
} from './dungeonObstacleDebugLayout';

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
    const debugToggle = createLabSwitch('显示阻碍与占位 Debug', false, {
      preference: { ui: context.ui, key: 'dungeon-obstacle/debug-boxes' },
    });
    const debugLegend = document.createElement('small');
    debugLegend.className = 'lab-hint';
    debugLegend.textContent = '红：静态阻碍 · 橙：实占位 · 青：移动虚占位 · 黄：寻路预约';
    const list = document.createElement('div');
    list.className = 'lab-obstacle-list';
    const runtimeJson = createLabJson();
    panel.content.append(debugToggle.row, debugLegend, list, runtimeJson);
    let current: LoadedDungeonReferences | null = null;
    let debugRoot: TransformNode | null = null;
    let occupancyMaterial: StandardMaterial | null = null;
    let reservationMaterial: StandardMaterial | null = null;
    let movementReservationMaterial: StandardMaterial | null = null;
    const occupancyMarkers = new Map<string, Mesh>();
    const reservationMarkers = new Map<number, Mesh>();
    const movementReservationMarkers = new Map<string, Mesh>();
    let jsonRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    const disposeDebug = () => {
      debugRoot?.dispose(false, true);
      debugRoot = null;
      occupancyMaterial = null;
      reservationMaterial = null;
      movementReservationMaterial = null;
      occupancyMarkers.clear();
      reservationMarkers.clear();
      movementReservationMarkers.clear();
    };
    const refreshJson = () => {
      runtimeJson.textContent = current
        ? JSON.stringify({
          loadId: current.loadId,
          dungeonPresetKey: current.presetKey,
          obstacleStates: Object.fromEntries(current.runtime.obstacleStates),
          traversalActors: Object.fromEntries([...current.runtime.traversal.actors].map(([id, actor]) => [id, {
            kind: actor.kind,
            tileIndex: actor.tileIndex,
            blocksMovement: actor.blocksMovement,
            movementProfileId: actor.movementProfileId,
          }])),
          occupantsByTile: current.runtime.traversal.occupantIdsByTile.map((occupants) => [...occupants]),
          pathReservationsByTile: current.runtime.traversal.pathReservationsByTile
            .map((reservations) => Object.fromEntries(reservations)),
          ...current.runtime.movementResolver.debugSnapshot(),
        }, null, 2)
        : '尚未加载';
    };
    const syncTraversalDebug = () => {
      if (!debugRoot || !current || !occupancyMaterial || !reservationMaterial
        || !movementReservationMaterial) return;
      const loaded = current;
      const visibleActorIds = new Set<string>();
      loaded.runtime.traversal.actors.forEach((actor) => {
        if (!actor.enabled || !actor.blocksMovement) return;
        visibleActorIds.add(actor.id);
        const tileX = actor.tileIndex % loaded.runtime.map.width;
        const tileY = Math.floor(actor.tileIndex / loaded.runtime.map.width);
        const layout = resolveDungeonTileDebugLayout(
          loaded.spawn.sceneEnvironmentComponent,
          loaded.runtime.map.width,
          loaded.runtime.map.height,
          tileX,
          tileY,
        );
        let box = occupancyMarkers.get(actor.id);
        if (!box) {
          box = MeshBuilder.CreateBox(`occupant_${loaded.loadId}_${actor.id}`, {
            width: layout.size[0] * 0.72,
            height: Math.max(0.18, layout.size[1] * 0.18),
            depth: layout.size[2] * 0.72,
          }, context.scene);
          box.material = occupancyMaterial;
          box.parent = debugRoot;
          box.isPickable = false;
          box.enableEdgesRendering();
          box.edgesColor.set(1, 0.66, 0.12, 0.9);
          box.edgesWidth = 3;
          occupancyMarkers.set(actor.id, box);
        }
        box.position.set(layout.center[0], layout.center[1] + layout.size[1] * 0.56, layout.center[2]);
      });
      occupancyMarkers.forEach((marker, actorId) => {
        if (visibleActorIds.has(actorId)) return;
        marker.dispose();
        occupancyMarkers.delete(actorId);
      });

      const visibleReservationTiles = new Set<number>();
      loaded.runtime.traversal.pathReservationsByTile.forEach((reservations, tileIndex) => {
        if (!reservations.size) return;
        visibleReservationTiles.add(tileIndex);
        let marker = reservationMarkers.get(tileIndex);
        if (!marker) {
          const tileX = tileIndex % loaded.runtime.map.width;
          const tileY = Math.floor(tileIndex / loaded.runtime.map.width);
          const layout = resolveDungeonTileDebugLayout(
            loaded.spawn.sceneEnvironmentComponent,
            loaded.runtime.map.width,
            loaded.runtime.map.height,
            tileX,
            tileY,
          );
          marker = MeshBuilder.CreateBox(`reservation_${loaded.loadId}_${tileIndex}`, {
            width: layout.size[0] * 0.34,
            height: 0.12,
            depth: layout.size[2] * 0.34,
          }, context.scene);
          marker.position.set(layout.center[0], layout.center[1] + layout.size[1] * 0.68, layout.center[2]);
          marker.material = reservationMaterial;
          marker.parent = debugRoot;
          marker.isPickable = false;
          reservationMarkers.set(tileIndex, marker);
        }
      });
      reservationMarkers.forEach((marker, tileIndex) => {
        if (visibleReservationTiles.has(tileIndex)) return;
        marker.dispose();
        reservationMarkers.delete(tileIndex);
      });

      const visibleMovementReservations = new Set<string>();
      loaded.runtime.movementResolver.movementReservationsByTile.forEach((reservations, tileIndex) => {
        reservations.forEach((_requestId, actorId) => {
          visibleMovementReservations.add(actorId);
          const tileX = tileIndex % loaded.runtime.map.width;
          const tileY = Math.floor(tileIndex / loaded.runtime.map.width);
          const layout = resolveDungeonTileDebugLayout(
            loaded.spawn.sceneEnvironmentComponent,
            loaded.runtime.map.width,
            loaded.runtime.map.height,
            tileX,
            tileY,
          );
          let marker = movementReservationMarkers.get(actorId);
          if (!marker) {
            marker = MeshBuilder.CreateBox(`movement_reservation_${loaded.loadId}_${actorId}`, {
              width: layout.size[0] * 0.58,
              height: Math.max(0.1, layout.size[1] * 0.12),
              depth: layout.size[2] * 0.58,
            }, context.scene);
            marker.material = movementReservationMaterial;
            marker.parent = debugRoot;
            marker.isPickable = false;
            marker.enableEdgesRendering();
            marker.edgesColor.set(0.13, 0.83, 0.93, 1);
            marker.edgesWidth = 4;
            movementReservationMarkers.set(actorId, marker);
          }
          marker.position.set(layout.center[0], layout.center[1] + layout.size[1] * 0.76, layout.center[2]);
        });
      });
      movementReservationMarkers.forEach((marker, actorId) => {
        if (visibleMovementReservations.has(actorId)) return;
        marker.dispose();
        movementReservationMarkers.delete(actorId);
      });
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
      occupancyMaterial = new StandardMaterial(`occupancy_${loaded.loadId}`, context.scene);
      occupancyMaterial.diffuseColor = Color3.FromHexString('#f59e0b');
      occupancyMaterial.emissiveColor = Color3.FromHexString('#7c4a08');
      occupancyMaterial.alpha = 0.24;
      occupancyMaterial.wireframe = true;
      reservationMaterial = new StandardMaterial(`reservation_${loaded.loadId}`, context.scene);
      reservationMaterial.diffuseColor = Color3.FromHexString('#facc15');
      reservationMaterial.emissiveColor = Color3.FromHexString('#6b5507');
      reservationMaterial.alpha = 0.18;
      movementReservationMaterial = new StandardMaterial(`movement_reservation_${loaded.loadId}`, context.scene);
      movementReservationMaterial.diffuseColor = Color3.FromHexString('#22d3ee');
      movementReservationMaterial.emissiveColor = Color3.FromHexString('#0e7490');
      movementReservationMaterial.alpha = 0.3;
      movementReservationMaterial.wireframe = true;
      syncTraversalDebug();
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
    const refreshTraversalDebug = () => {
      if (debugToggle.input.checked) syncTraversalDebug();
      if (jsonRefreshTimer !== null) return;
      jsonRefreshTimer = setTimeout(() => {
        jsonRefreshTimer = null;
        refreshJson();
      }, 200);
    };
    const offRuntime = context.communication.on(dungeonRuntimeChangedEvent, (event) => {
      if (current?.loadId === event.loadId) refreshTraversalDebug();
    });
    const offAgents = context.communication.on(dungeonAgentsChangedEvent, (event) => {
      if (current?.loadId === event.loadId) refreshTraversalDebug();
    });
    const frameObserver = context.scene.onBeforeRenderObservable.add(() => {
      if (debugToggle.input.checked) syncTraversalDebug();
    });
    return () => {
      off();
      offRuntime();
      offAgents();
      context.scene.onBeforeRenderObservable.remove(frameObserver);
      if (jsonRefreshTimer !== null) clearTimeout(jsonRefreshTimer);
      disposeDebug();
    };
  },
};
