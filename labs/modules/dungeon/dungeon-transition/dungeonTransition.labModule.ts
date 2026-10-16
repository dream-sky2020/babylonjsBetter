import { DUNGEON_LIBRARIES_MEMORY } from '../dungeon-libraries/dungeonLibraries.memory';
import { DUNGEON_TRANSITION_DATA_MEMORY } from './dungeonTransition.memory';
import { DUNGEON_PLAYER_STATE_MEMORY } from '../dungeon-runtime/dungeonRuntime.memory';
import { DUNGEON_GRID_MEMORY } from '../dungeon-grid/dungeonGrid.memory';
import { DUNGEON_TRANSITION_CONTROL_SERVICE_KEY } from '@/core/dungeon-transition/dungeonTransitionControl';
import type { DungeonExitData } from '@/core/dungeon-transition/dungeonTransitionData';
import { DUNGEON_PLAYER_STEP_SERVICE_KEY } from '@/core/dungeon-player-movement/dungeonPlayerStepEvents';
import { applyDungeonViewToNode } from '@/core/dungeon-view/dungeonOverheadView.ts';
import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
} from '@babylonjs/core';
import {
  createDungeonTransitionController,
  findDungeonDocumentEntrance,
} from '@/core/dungeon-transition';
import type { DungeonExitTrigger } from '@/core/entity';
import {
  createLabJson,
  createLabStatus,
  createLabSwitch,
  type LabKeyboardLockHandle,
  type LabModule,
} from '@/labs/kit';
import {
  dungeonMapChangedEvent,
  dungeonMapSwitchRequest,
  dungeonRuntimeCommitRequest,
} from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { DUNGEON_OVERHEAD_VIEW_SERVICE_KEY, type DungeonOverheadViewService } from '../dungeon-overhead-view/dungeonOverheadView.references';
import {
  PLAYER_MOVEMENT_BLOCKED_ATTEMPT_SERVICE_KEY,
  type DungeonPlayerBlockedAttemptService,
} from '../player-movement/playerMovement.blockedAttempt';
import {
  dungeonTransitionCompletedEvent,
  dungeonTransitionFailedEvent,
  dungeonTransitionStartedEvent,
  type DungeonTransitionEventPayload,
} from './dungeonTransition.protocol';
import {
  resolveDungeonTransitionDebugLayout,
  type DungeonTransitionDebugBinding,
} from './dungeonTransitionDebugLayout';

type DebugLocationKind = 'entrance' | 'tile' | 'tile-edge' | 'shared-edge';
type DebugMaterialStyle = 'solid' | 'wire';

const triggerLabel = (triggers: readonly DungeonExitTrigger[]): string => {
  if (triggers.length === 3) return 'ALL';
  return triggers.map((trigger) => (
    trigger === 'enter' ? 'AUTO' : trigger === 'interact' ? 'E' : 'PUSH'
  )).join(' + ');
};

export const dungeonTransitionLabModule: LabModule = {
  id: 'dungeon-transition',
  dependencies: ['player-movement', 'dungeon-map-loader', 'dungeon-libraries', 'dungeon-overhead-view'],
  setup(context) {
    const playerSteps = context.services.get(DUNGEON_PLAYER_STEP_SERVICE_KEY);
    const transitionMemory = context.memory.acquire(DUNGEON_TRANSITION_DATA_MEMORY);
    const playerMemory = context.memory.acquire(DUNGEON_PLAYER_STATE_MEMORY);
    const gridMemory = context.memory.acquire(DUNGEON_GRID_MEMORY);
    const control = context.services.get(DUNGEON_TRANSITION_CONTROL_SERVICE_KEY);
    const libraries = context.memory.acquire(DUNGEON_LIBRARIES_MEMORY);
    const blockedAttempts = context.services.get<DungeonPlayerBlockedAttemptService>(
      PLAYER_MOVEMENT_BLOCKED_ATTEMPT_SERVICE_KEY,
    );
    const overheadView = context.services.get<DungeonOverheadViewService>(DUNGEON_OVERHEAD_VIEW_SERVICE_KEY);
    const panel = context.ui.addPanel('dungeon-transition', '地牢地图传送');
    const enabledToggle = createLabSwitch('启用地图传送', true);
    const enterToggle = createLabSwitch('移动后触发 enter 出口', true);
    const interactToggle = createLabSwitch('启用 E 键交互出口', true);
    const moveAttemptToggle = createLabSwitch('受阻移动触发 move-attempt 出口', true);
    const debugBoxesToggle = createLabSwitch('显示入口 / 出口 Debug 盒', false, {
      preference: { ui: context.ui, key: 'dungeon-transition/debug-boxes' },
    });
    const debugLegend = document.createElement('small');
    debugLegend.textContent = 'Debug：绿色=入口；粉/橙/紫=格子/单向边/公用边出口。AUTO=穿过；E=交互；PUSH=撞向阻挡边；ALL=三种均可。';
    debugLegend.style.lineHeight = '1.55';
    const interactButton = document.createElement('button');
    interactButton.type = 'button';
    interactButton.textContent = '触发当前位置 / 前方交互出口';
    const status = createLabStatus('等待 Dungeon Runtime。');
    const debug = createLabJson();
    panel.content.append(
      enabledToggle.row,
      enterToggle.row,
      interactToggle.row,
      moveAttemptToggle.row,
      debugBoxesToggle.row,
      debugLegend,
      interactButton,
      status,
      debug,
    );

    let inputLock: LabKeyboardLockHandle | null = null;
    let debugRoot: TransformNode | null = null;
    const syncDebugView = (): void => {
      if (debugRoot) applyDungeonViewToNode(debugRoot, overheadView.displayedView);
    };
    const offView = overheadView.subscribe(syncDebugView);

    const disposeDebugBoxes = (): void => {
      debugRoot?.dispose(false, true);
      debugRoot = null;
    };

    const renderDebugBoxes = (): void => {
      disposeDebugBoxes();
      const loaded = transitionMemory.current, grid = gridMemory.current;
      if (!debugBoxesToggle.input.checked || !loaded || !grid || loaded.loadId !== grid.loadId) return;
      const colors = {
        entrance: '#35d07f',
        tile: '#e45aa6',
        'tile-edge': '#f5a623',
        'shared-edge': '#8d6be8',
      } as const;
      const materials = new Map<string, StandardMaterial>();
      const getMaterial = (kind: DebugLocationKind, style: DebugMaterialStyle): StandardMaterial => {
        const key = `${kind}:${style}`;
        const existing = materials.get(key);
        if (existing) return existing;
        const material = new StandardMaterial(`dungeon_transition_debug_${key}_${loaded.loadId}`, context.scene);
        const color = Color3.FromHexString(colors[kind]);
        material.diffuseColor = color;
        material.emissiveColor = color.scale(0.45);
        material.alpha = style === 'wire' ? 0.92 : 0.34;
        material.wireframe = style === 'wire';
        materials.set(key, material);
        return material;
      };
      debugRoot = new TransformNode(`dungeon_transition_debug_${loaded.loadId}`, context.scene);
      syncDebugView();
      const targets: DungeonTransitionDebugBinding[] = [
        ...loaded.entrances
          .map((binding) => ({ kind: 'entrance' as const, binding })),
        ...loaded.exits
          .map((binding) => ({ kind: 'exit' as const, binding })),
      ];
      targets.forEach((target) => {
        const locationKind: DebugLocationKind = target.kind === 'entrance'
          ? 'entrance'
          : target.binding.location.kind;
        const triggers = target.kind === 'exit' ? target.binding.triggers : [];
        const layout = resolveDungeonTransitionDebugLayout(
          target,
          grid,
          grid.width,
          grid.height,
        );
        const box = MeshBuilder.CreateBox(
          `dungeon_transition_${loaded.loadId}_${target.binding.entityId}`,
          { width: layout.size[0], height: layout.size[1], depth: layout.size[2] },
          context.scene,
        );
        box.position.set(...layout.center);
        box.material = getMaterial(locationKind, triggers.includes('enter') ? 'solid' : 'wire');
        box.parent = debugRoot;
        box.isPickable = false;
        box.enableEdgesRendering();
        const color = Color3.FromHexString(colors[locationKind]);
        box.edgesColor.set(color.r, color.g, color.b, 1);
        box.edgesWidth = triggers.includes('move-attempt') ? 8 : triggers.includes('interact') ? 2 : 4;

        if (triggers.length > 1) {
          const outline = MeshBuilder.CreateBox(
            `dungeon_transition_outline_${loaded.loadId}_${target.binding.entityId}`,
            {
              width: layout.size[0] * 1.12,
              height: layout.size[1] * 1.12,
              depth: layout.size[2] * 1.12,
            },
            context.scene,
          );
          outline.position.set(...layout.center);
          outline.material = getMaterial(locationKind, 'wire');
          outline.parent = debugRoot;
          outline.isPickable = false;
        }

        if (target.kind === 'exit') {
          const labelText = triggerLabel(target.binding.triggers);
          const texture = new DynamicTexture(
            `dungeon_transition_label_texture_${loaded.loadId}_${target.binding.entityId}`,
            { width: 1024, height: 160 },
            context.scene,
            false,
          );
          texture.hasAlpha = true;
          texture.drawText(labelText, null, 112, 'bold 68px Segoe UI', '#ffffff', 'rgba(3, 12, 9, 0.82)', true, true);
          const labelMaterial = new StandardMaterial(
            `dungeon_transition_label_material_${loaded.loadId}_${target.binding.entityId}`,
            context.scene,
          );
          labelMaterial.diffuseTexture = texture;
          labelMaterial.emissiveColor = Color3.White();
          labelMaterial.disableLighting = true;
          labelMaterial.backFaceCulling = false;
          labelMaterial.useAlphaFromDiffuseTexture = true;
          const label = MeshBuilder.CreatePlane(
            `dungeon_transition_label_${loaded.loadId}_${target.binding.entityId}`,
            { width: Math.max(1.45, labelText.length * 0.28), height: 0.55 },
            context.scene,
          );
          label.position.set(layout.center[0], layout.center[1] + layout.size[1] / 2 + 0.42, layout.center[2]);
          label.billboardMode = Mesh.BILLBOARDMODE_ALL;
          label.material = labelMaterial;
          label.parent = debugRoot;
          label.isPickable = false;
        }
      });
    };

    const refreshDebug = (): void => {
      const loaded = transitionMemory.current, player = playerMemory.current;
      debug.textContent = JSON.stringify(loaded ? {
        transitioning: controller.transitioning,
        presetKey: loaded.presetKey,
        playerPosition: player?.loadId === loaded.loadId ? player.playerPosition : null,
        playerFacing: player?.loadId === loaded.loadId ? player.playerFacing : null,
        entrances: loaded.entrances,
        exits: loaded.exits.map(exit => ({
          entityId: exit.entityId, location: exit.location.kind, triggers: exit.triggers,
          triggerLabel: triggerLabel(exit.triggers),
          targetMapPresetKey: exit.targetMapPresetKey,
          targetEntranceId: exit.targetEntranceId,
        })),
      } : { transitioning: false, loaded: false }, null, 2);
    };

    const controller = createDungeonTransitionController({
      getCurrentPresetKey: () => transitionMemory.current?.presetKey ?? '',
      switchDungeon: async (presetKey, entranceId) => (
        await context.communication.request(dungeonMapSwitchRequest, { presetKey, entranceId })
      ).loaded,
    });

    let pendingTransition = false;
    let disposed = false;
    const executeTransition = async (exit: DungeonExitData): Promise<void> => {
      if (disposed || pendingTransition || !enabledToggle.input.checked || controller.transitioning) return;
      const source = transitionMemory.current;
      if (!source) return;
      pendingTransition = true;
      const payload: DungeonTransitionEventPayload = {
        sourcePresetKey: source.presetKey,
        targetPresetKey: exit.targetMapPresetKey,
        targetEntranceId: exit.targetEntranceId,
        exitEntityId: exit.entityId,
      };
      try {
        const target = libraries.require().maps[exit.targetMapPresetKey];
        if (!target) throw new Error(`目标地图预设“${exit.targetMapPresetKey}”不存在。`);
        // 在切换并释放来源场景前完成目标入口预校验。
        findDungeonDocumentEntrance(target, exit.targetEntranceId);
        inputLock = context.keyboard.acquireLock({ ownerId: 'dungeon-transition', label: '地牢地图传送' });
        status.textContent = `正在切换到 ${payload.targetPresetKey} / ${payload.targetEntranceId}……`;
        refreshDebug();
        await context.communication.publish(dungeonTransitionStartedEvent, payload);
        if (disposed) return;
        const result = await controller.transitionTo(exit);
        if (disposed) return;
        if (!result.transitioned) throw new Error(`地图切换未完成：${result.reason ?? 'unknown'}。`);
        await context.communication.request(dungeonRuntimeCommitRequest, { reason: 'dungeon-transition-arrived' });
        status.textContent = `已抵达 ${payload.targetPresetKey} / ${payload.targetEntranceId}。`;
        await context.communication.publish(dungeonTransitionCompletedEvent, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        status.textContent = `地图传送失败：${message}`;
        await context.communication.publish(dungeonTransitionFailedEvent, { ...payload, message });
      } finally {
        pendingTransition = false;
        inputLock?.release();
        inputLock = null;
        refreshDebug();
      }
    };

    const findInteractionExit = (): DungeonExitData | null => {
      const loaded = transitionMemory.current, player = playerMemory.current;
      if (!loaded || !player || loaded.loadId !== player.loadId || !enabledToggle.input.checked || !interactToggle.input.checked) return null;
      return control.findInteraction(
        loaded.loadId, player.playerPosition, player.playerFacing,
      );
    };

    const tryInteraction = (): boolean => {
      try {
        const exit = findInteractionExit();
        if (!exit) {
          status.textContent = '当前位置和面前的边没有可交互出口。';
          return false;
        }
        void executeTransition(exit);
        return true;
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
        return true;
      }
    };

    const offBlockedAttempt = blockedAttempts.register((attempt) => {
      if (!enabledToggle.input.checked || !moveAttemptToggle.input.checked || controller.transitioning) return false;
      if (attempt.direction !== 'north' && attempt.direction !== 'east'
        && attempt.direction !== 'south' && attempt.direction !== 'west') return false;
      const loaded = transitionMemory.current;
      if (!loaded) return false;
      try {
        const exit = control.findMoveAttempt(loaded.loadId, attempt.from, attempt.direction);
        if (!exit) return false;
        status.textContent = `尝试向 ${attempt.direction} 移动，命中 PUSH 出口。`;
        void executeTransition(exit);
        return true;
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
        return true;
      }
    });

    interactButton.addEventListener('click', tryInteraction);
    debugBoxesToggle.input.addEventListener('change', renderDebugBoxes);
    const keyboardRegistration = context.keyboard.register({
      id: 'dungeon-transition',
      label: '地牢传送交互',
      keys: ['KeyE'],
      enabled: interactToggle.input.checked,
      priority: 70,
      intercept: true,
      preventDefault: true,
      onKeyDown: () => tryInteraction() ? 'handled' : 'ignored',
    });
    interactToggle.input.addEventListener('change', () => keyboardRegistration.setEnabled(interactToggle.input.checked));

    const offMapChanged = context.communication.on(dungeonMapChangedEvent, (changed) => {
      const loaded = transitionMemory.current;
      if (!loaded || loaded.loadId !== changed.loadId) return;
      status.textContent = `地图“${loaded.presetKey}”已加载；等待移动或交互出口。`;
      refreshDebug();
      renderDebugBoxes();
    });
    const offRuntimeChanged = playerSteps.subscribe('dungeon-transition', 100, (changed) => {
      if (pendingTransition) return true;
      const loaded = transitionMemory.current;
      if (!loaded || loaded.loadId !== changed.loadId) return;
      const nextPosition = changed.to;
      const previousPosition = changed.from;
      refreshDebug();
      if (!enabledToggle.input.checked || !enterToggle.input.checked || controller.transitioning || !previousPosition) return;

      try {
        const exit = control.findAfterMovement(loaded.loadId, previousPosition, nextPosition);
        if (exit) { void executeTransition(exit); return true; }
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
      }
    });

    refreshDebug();
    return () => {
      disposed = true;
      offMapChanged();
      offRuntimeChanged();
      offBlockedAttempt();
      offView();
      keyboardRegistration.dispose();
      interactButton.removeEventListener('click', tryInteraction);
      debugBoxesToggle.input.removeEventListener('change', renderDebugBoxes);
      inputLock?.release();
      disposeDebugBoxes();
      panel.root.remove();
    };
  },
};
