import { DUNGEON_GRID_MEMORY } from '../dungeon-grid/dungeonGrid.memory';
import { DUNGEON_TRAVERSAL_STATE_MEMORY, type DungeonTraversalStateData } from './dungeonTraversal.memory';
import { DUNGEON_TRAVERSAL_CONTROL_SERVICE_KEY } from '@/core/dungeon-traversal/dungeonTraversalControl';
import type { Mesh } from '@babylonjs/core';
import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import { createDungeonTraversalWorld } from '@/core/dungeon-traversal';
import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import { applyDungeonViewToNode, createDungeonViewConsumer, type ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS, type DungeonMovementDirection } from '@/core/dungeon-movement';
import { resolveDungeonSpatialFootprint } from '@/core/dungeon-space';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene/dungeonMapSceneLayout';
import { createLabField, createLabJson, createLabStatus, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { dungeonTraversalChangedEvent } from './dungeonTraversal.protocol';
import { DUNGEON_TRAVERSAL_VIEW_SERVICE_KEY } from './dungeonTraversal.view';

export const dungeonTraversalLabModule: LabModule = {
  id: 'dungeon-traversal',
  dependencies: ['dungeon-map-loader', 'dungeon-obstacle'],
  setup(context) {
    const assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    const uninstall = assembly.install('traversal', createDungeonTraversalWorld);
    const traversalMemory = context.memory.acquire(DUNGEON_TRAVERSAL_STATE_MEMORY);
    const gridMemory = context.memory.acquire(DUNGEON_GRID_MEMORY);
    const control = context.services.get(DUNGEON_TRAVERSAL_CONTROL_SERVICE_KEY);
    const panel = context.ui.addPanel('dungeon-traversal', '地牢通行');
    const toggle = createLabSwitch('显示实占位与寻路预约', false, {
      preference: { ui: context.ui, key: 'dungeon-traversal/debug' },
    });
    const actorSelect = document.createElement('select');
    const directionSelect = document.createElement('select');
    directionSelect.replaceChildren(...DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS.map(direction =>
      new Option(direction, direction)));
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.textContent = '检查下一格';
    const result = createLabStatus('选择 Actor 和方向，查看通行结果。');
    const summary = createLabJson('尚未加载地图。');
    panel.content.append(toggle.row, createLabField('Actor', actorSelect),
      createLabField('方向', directionSelect), inspect, result, summary);

    let current: DungeonTraversalStateData | null = null;
    let root: TransformNode | null = null;
    let materials: StandardMaterial[] = [];
    let view: ResolvedDungeonView | null = null;
    let offChanges: (() => void) | null = null;
    let sequence = 0;
    let dirty = false;
    let actorsDirty = false;
    const pendingActors = new Set<string>();
    const pendingTiles = new Set<number>();
    const boxes = new Map<string, Mesh>();
    const viewConsumer = createDungeonViewConsumer(next => {
      view = next;
      if (root) applyDungeonViewToNode(root, view);
    });
    const disposeMarkers = () => {
      root?.dispose(false, false); root = null; boxes.clear();
      materials.forEach(material => material.dispose()); materials = [];
    };
    const refreshSummary = () => {
      if (!current || panel.content.hidden) return;
      const traversal = current;
      summary.textContent = JSON.stringify({
        loadId: current.loadId,
        actors: [...traversal.actors.values()].map(actor => ({ id: actor.id, kind: actor.kind,
          tileIndex: actor.tileIndex, enabled: actor.enabled, blocksMovement: actor.blocksMovement,
          footprint: resolveDungeonSpatialFootprint(actor.spatialFootprint, 'center') })),
        occupiedTiles: traversal.occupantIdsByTile.flatMap((ids, index) => ids.size
          ? [{ tileIndex: index, actorIds: [...ids] }] : []),
        pathReservations: traversal.pathReservationsByTile.flatMap((ids, index) => ids.size
          ? [{ tileIndex: index, actors: Object.fromEntries(ids) }] : []),
      }, null, 2);
    };
    const renderMarkers = (full = true) => {
      if (!toggle.input.checked || !current) { disposeMarkers(); pendingActors.clear(); pendingTiles.clear(); return; }
      const loaded = current;
      const map = gridMemory.current;
      if (!map || map.loadId !== loaded.loadId) { disposeMarkers(); return; }
      if (!root) {
        full = true;
        root = new TransformNode('traversal_debug_' + loaded.loadId, context.scene);
        applyDungeonViewToNode(root, view);
        for (const [name, color] of [['occupied', '#f59e0b'], ['route', '#facc15']]) {
          const material = new StandardMaterial('traversal_' + name + '_' + loaded.loadId, context.scene);
          material.diffuseColor = Color3.FromHexString(color!);
          material.alpha = 0.24;
          material.wireframe = true;
          materials.push(material);
        }
      }
      if (full) {
        loaded.actors.forEach(actor => pendingActors.add(actor.id));
        boxes.forEach((_, key) => { if (key.startsWith('actor:')) pendingActors.add(key.slice(6)); });
        loaded.pathReservationsByTile.forEach((_, index) => pendingTiles.add(index));
      }
      const update = (key: string, tileIndex: number | undefined, scale: number, materialIndex: number) => {
        if (tileIndex === undefined) { boxes.get(key)?.dispose(); boxes.delete(key); return; }
        const layout = resolveDungeonMapTileWorldLayout(map, map.width, map.height,
          tileIndex % map.width, Math.floor(tileIndex / map.width));
        let box = boxes.get(key);
        if (!box) {
          box = MeshBuilder.CreateBox('traversal_' + loaded.loadId + '_' + key, { size: 1 }, context.scene);
          box.material = materials[materialIndex]!;
          box.parent = root;
          box.isPickable = false;
          boxes.set(key, box);
        }
        box.scaling.set(layout.size[0] * scale, materialIndex === 0 ? Math.max(0.18, layout.size[1] * 0.18) : 0.12, layout.size[2] * scale);
        box.position.set(layout.center[0], layout.center[1] + layout.size[1] * (materialIndex === 0 ? 0.56 : 0.68), layout.center[2]);
      };
      pendingActors.forEach(id => {
        const actor = loaded.actors.get(id);
        update('actor:' + id, actor?.enabled && actor.blocksMovement ? actor.tileIndex : undefined,
          actor && resolveDungeonSpatialFootprint(actor.spatialFootprint, 'center') === 'full-tile' ? 0.9 : 0.48, 0);
      });
      pendingTiles.forEach(index => update('tile:' + index,
        loaded.pathReservationsByTile[index]?.size ? index : undefined, 0.34, 1));
      pendingActors.clear(); pendingTiles.clear();
    };
    const refreshActorSelect = () => {
      const selected = actorSelect.value;
      const actors = current?.actors;
      actorSelect.replaceChildren(...[...(actors?.values() ?? [])].map(actor =>
        new Option(`${actor.kind} · ${actor.id}`, actor.id)));
      if (actors?.has(selected)) actorSelect.value = selected;
    };
    const inspectNext = () => {
      const traversal = current;
      const actor = traversal?.actors.get(actorSelect.value);
      if (!traversal || !actor) { result.textContent = '请先选择有效 Actor。'; return; }
      const inspection = control.inspectStep(traversal.loadId, actor.id, actor.tileIndex,
        directionSelect.value as DungeonMovementDirection);
      if (!inspection) { result.textContent = '地图已切换，请重新选择 Actor。'; return; }
      result.textContent = inspection.blockedReason
        ? `不可通行：${inspection.blockedReason}；阻挡对象 ${inspection.blockingEntityIds.join('、') || '无'}。`
        : `可通行：目标格 index ${inspection.toTileIndex}。`;
    };
    const onToggle = () => renderMarkers();
    inspect.addEventListener('click', inspectNext);
    toggle.input.addEventListener('change', onToggle);
    context.services.set(DUNGEON_TRAVERSAL_VIEW_SERVICE_KEY, { acquire: viewConsumer.acquire });
    const offMap = context.communication.on(dungeonMapChangedEvent, event => {
      const loaded = traversalMemory.current;
      if (!loaded || loaded.loadId !== event.loadId) return;
      offChanges?.(); disposeMarkers(); pendingActors.clear(); pendingTiles.clear(); current = loaded; sequence = 0;
      dirty = false; actorsDirty = false;
      result.textContent = '选择 Actor 和方向，查看通行结果。';
      offChanges = control.subscribe(loaded.loadId, change => {
        traversalMemory.markChanged();
        sequence += 1;
        dirty = true;
        if (change.actorId) pendingActors.add(change.actorId);
        change.tileIndices?.forEach(index => pendingTiles.add(index));
        if (change.kind === 'actor-registered' || change.kind === 'actor-unregistered') actorsDirty = true;
        void context.communication.publish(dungeonTraversalChangedEvent,
          { loadId: loaded.loadId, sequence, change },
          change.requestId ? { correlationId: change.requestId } : undefined);
      });
      refreshActorSelect(); refreshSummary(); renderMarkers();
    });
    const stopDebugTask = context.scheduler.register({
      id: 'debug-refresh', phase: 'debug', order: 100, description: '合并通行增量，更新受影响的标记',
      enabled: () => dirty,
      run: () => {
        dirty = false;
        if (actorsDirty && !panel.content.hidden) { refreshActorSelect(); actorsDirty = false; }
        refreshSummary(); renderMarkers(false);
      },
    });
    const visibilityObserver = new MutationObserver(() => {
      if (!panel.content.hidden) { refreshSummary(); if (actorsDirty) { refreshActorSelect(); actorsDirty = false; } }
    });
    visibilityObserver.observe(panel.content, { attributes: true, attributeFilter: ['hidden'] });
    return () => {
      inspect.removeEventListener('click', inspectNext); toggle.input.removeEventListener('change', onToggle);
      stopDebugTask(); uninstall();
      offMap(); offChanges?.(); visibilityObserver.disconnect(); viewConsumer.dispose();
      context.services.delete(DUNGEON_TRAVERSAL_VIEW_SERVICE_KEY); disposeMarkers(); panel.root.remove();
    };
  },
};
