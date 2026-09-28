import type { Mesh } from '@babylonjs/core';
import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import { createDungeonMovementResolver } from '@/core/dungeon-movement';
import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import { applyDungeonViewToNode, createDungeonViewConsumer, type ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene';
import { createLabField, createLabJson, createLabStatus, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY, type DungeonMapLoaderReferences,
  type LoadedDungeonReferences } from '../dungeon-map-loader/dungeonMapLoader.references';
import { dungeonMovementChangedEvent } from './dungeonMovement.protocol';
import { DUNGEON_MOVEMENT_VIEW_SERVICE_KEY } from './dungeonMovement.view';

export const dungeonMovementLabModule: LabModule = {
  id: 'dungeon-movement',
  dependencies: ['dungeon-map-loader', 'dungeon-traversal'],
  setup(context) {
    const assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    const uninstall = assembly.install('movement', createDungeonMovementResolver);
    const references = context.services.get<DungeonMapLoaderReferences>(DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY);
    const panel = context.ui.addPanel('dungeon-movement', '地牢移动仲裁');
    const toggle = createLabSwitch('显示移动目标格临时预留', false, {
      preference: { ui: context.ui, key: 'dungeon-movement/debug' },
    });
    const numberInput = (value: number, min?: number, max?: number) => {
      const input = document.createElement('input');
      input.type = 'number'; input.step = 'any'; input.value = String(value);
      if (min !== undefined) input.min = String(min);
      if (max !== undefined) input.max = String(max);
      return input;
    };
    const commitProgress = numberInput(0.5, 0, 1);
    const playerBasePriority = numberInput(1000);
    const progressWeight = numberInput(1, 0);
    const apply = document.createElement('button');
    apply.type = 'button'; apply.textContent = '应用到本次运行';
    const status = createLabStatus('尚未加载地图。');
    const summary = createLabJson('尚未加载地图。');
    panel.content.append(toggle.row,
      createLabField('移动提交进度（0–1）', commitProgress),
      createLabField('玩家基础优先级', playerBasePriority),
      createLabField('移动进度优先级权重', progressWeight), apply, status, summary);

    let current: LoadedDungeonReferences | null = null;
    let root: TransformNode | null = null;
    let materials: StandardMaterial[] = [];
    let view: ResolvedDungeonView | null = null;
    let offChanges: (() => void) | null = null;
    let sequence = 0;
    let lastSummaryAt = 0;
    let dirty = false;
    const pendingTiles = new Set<number>();
    const boxes = new Map<number, Mesh>();
    const viewConsumer = createDungeonViewConsumer(next => {
      view = next;
      if (root) applyDungeonViewToNode(root, view);
    });
    const disposeMarkers = () => {
      root?.dispose(false, false); root = null; boxes.clear();
      materials.forEach(material => material.dispose()); materials = [];
    };
    const syncConfig = () => {
      const config = current?.runtime.movementResolver.config;
      if (!config) return;
      commitProgress.value = String(config.commitProgress);
      playerBasePriority.value = String(config.playerBasePriority);
      progressWeight.value = String(config.progressWeight);
    };
    const refreshSummary = () => {
      if (!current || panel.content.hidden) return;
      const snapshot = current.runtime.movementResolver.debugSnapshot();
      summary.textContent = JSON.stringify({
        loadId: current.loadId,
        activeMoves: snapshot.activeMoves,
        targetReservations: snapshot.movementReservationsByTile.flatMap((owners, index) =>
          Object.keys(owners).length ? [{ tileIndex: index, actors: owners }] : []),
        crossingPointReservations: snapshot.movementReservationsByPoint.flatMap((owners, index) =>
          Object.keys(owners).length ? [{ pointIndex: index, actors: owners }] : []),
      }, null, 2);
      lastSummaryAt = performance.now();
    };
    const renderMarkers = (full = true) => {
      if (!toggle.input.checked || !current) { disposeMarkers(); pendingTiles.clear(); return; }
      const loaded = current;
      const map = loaded.runtime.map;
      if (!root) {
        full = true;
        root = new TransformNode('movement_debug_' + loaded.loadId, context.scene);
        applyDungeonViewToNode(root, view);
        const material = new StandardMaterial('movement_reservation_' + loaded.loadId, context.scene);
        material.diffuseColor = Color3.FromHexString('#22d3ee'); material.alpha = 0.3; material.wireframe = true;
        materials.push(material);
      }
      if (full) loaded.runtime.movementResolver.movementReservationsByTile.forEach((_, index) => pendingTiles.add(index));
      pendingTiles.forEach(index => {
        if (!loaded.runtime.movementResolver.movementReservationsByTile[index]?.size) {
          boxes.get(index)?.dispose(); boxes.delete(index); return;
        }
        if (boxes.has(index)) return;
        const layout = resolveDungeonMapTileWorldLayout(loaded.sceneBinding.component,
          map.width, map.height, index % map.width, Math.floor(index / map.width));
        const box = MeshBuilder.CreateBox('movement_target_' + loaded.loadId + '_' + index, {
          width: layout.size[0] * 0.58, height: Math.max(0.1, layout.size[1] * 0.12), depth: layout.size[2] * 0.58,
        }, context.scene);
        box.position.set(layout.center[0], layout.center[1] + layout.size[1] * 0.76, layout.center[2]);
        box.material = materials[0]!; box.parent = root; box.isPickable = false; boxes.set(index, box);
      });
      pendingTiles.clear();
    };
    apply.addEventListener('click', () => {
      if (!current) { status.textContent = '请先加载地图。'; return; }
      try {
        current.runtime.movementResolver.updateConfig({
          commitProgress: commitProgress.value.trim() ? Number(commitProgress.value) : NaN,
          playerBasePriority: playerBasePriority.value.trim() ? Number(playerBasePriority.value) : NaN,
          progressWeight: progressWeight.value.trim() ? Number(progressWeight.value) : NaN,
        });
        status.textContent = '已应用到本次运行的共享移动仲裁器。';
      } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
    });
    toggle.input.addEventListener('change', () => renderMarkers());
    context.services.set(DUNGEON_MOVEMENT_VIEW_SERVICE_KEY, { acquire: viewConsumer.acquire });
    const offMap = context.communication.on(dungeonMapChangedEvent, event => {
      const loaded = references.current;
      if (!loaded || loaded.loadId !== event.loadId) return;
      offChanges?.(); disposeMarkers(); pendingTiles.clear(); current = loaded; sequence = 0;
      offChanges = loaded.runtime.movementResolver.subscribe(change => {
        sequence += 1;
        if (change.kind === 'config-changed') syncConfig();
        dirty = true;
        if (change.fromTileIndex !== undefined) pendingTiles.add(change.fromTileIndex);
        if (change.toTileIndex !== undefined) pendingTiles.add(change.toTileIndex);
        void context.communication.publish(dungeonMovementChangedEvent,
          { loadId: loaded.loadId, sequence, change },
          change.requestId ? { correlationId: change.requestId } : undefined);
      });
      syncConfig(); refreshSummary(); renderMarkers();
      status.textContent = `正在查看地图加载 #${event.loadId} 的移动仲裁。`;
    });
    const stopFrameTask = context.scheduler.register({
      id: 'update', phase: 'debug', order: 200, description: '可见移动摘要采样',
      run: () => {
        if (!current) return;
        if (dirty) { dirty = false; renderMarkers(false); refreshSummary(); return; }
        if (!panel.content.hidden && current.runtime.movementResolver.hasActiveRequests
          && performance.now() - lastSummaryAt >= 250) refreshSummary();
      },
    });
    const visibilityObserver = new MutationObserver(() => {
      if (!panel.content.hidden) refreshSummary();
    });
    visibilityObserver.observe(panel.content, { attributes: true, attributeFilter: ['hidden'] });
    return () => {
      uninstall();
      offMap(); offChanges?.(); stopFrameTask();
      visibilityObserver.disconnect(); viewConsumer.dispose();
      context.services.delete(DUNGEON_MOVEMENT_VIEW_SERVICE_KEY); disposeMarkers(); panel.root.remove();
    };
  },
};
