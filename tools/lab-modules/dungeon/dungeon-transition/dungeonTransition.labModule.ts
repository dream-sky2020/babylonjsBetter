import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import {
  createDungeonTransitionController,
  findDungeonEntrance,
  findDungeonExitAfterMovement,
  findDungeonExitForInteraction,
  scanDungeonEntrances,
  scanDungeonExits,
  type DungeonExitBinding,
} from '@/core/dungeon-transition';
import {
  createLabJson,
  createLabStatus,
  createLabSwitch,
  type LabKeyboardLockHandle,
  type LabModule,
} from '@/tools/lab-kit';
import {
  DUNGEON_LIBRARIES_SERVICE_KEY,
} from '../dungeon-libraries/dungeonLibraries.protocol';
import type { DungeonLabLibrariesReference } from '../dungeon-libraries/dungeonLibraries.references';
import {
  dungeonMapChangedEvent,
  dungeonMapSwitchRequest,
  dungeonRuntimeChangedEvent,
  dungeonRuntimeCommitRequest,
} from '../dungeon-map-loader/dungeonMapLoader.protocol';
import {
  DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
  type DungeonMapLoaderReferences,
} from '../dungeon-map-loader/dungeonMapLoader.references';
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

type TilePosition = Readonly<{ tileX: number; tileY: number }>;

export const dungeonTransitionLabModule: LabModule = {
  id: 'dungeon-transition',
  dependencies: ['player-movement'],
  setup(context) {
    const references = context.services.get<DungeonMapLoaderReferences>(
      DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
    );
    const libraries = context.services.get<DungeonLabLibrariesReference>(DUNGEON_LIBRARIES_SERVICE_KEY);
    const panel = context.ui.addPanel('dungeon-transition', '地牢地图传送');
    const enabledToggle = createLabSwitch('启用地图传送', true);
    const enterToggle = createLabSwitch('移动后触发 enter 出口', true);
    const interactToggle = createLabSwitch('启用 E 键交互出口', true);
    const debugBoxesToggle = createLabSwitch('显示入口 / 出口 Debug 盒', false, {
      preference: { ui: context.ui, key: 'dungeon-transition/debug-boxes' },
    });
    const debugLegend = document.createElement('small');
    debugLegend.textContent = 'Debug 颜色：入口绿色；格子出口粉色；单向边出口橙色；公用边出口紫色。';
    const interactButton = document.createElement('button');
    interactButton.type = 'button';
    interactButton.textContent = '触发当前位置 / 前方交互出口';
    const status = createLabStatus('等待 Dungeon Runtime。');
    const debug = createLabJson();
    panel.content.append(
      enabledToggle.row,
      enterToggle.row,
      interactToggle.row,
      debugBoxesToggle.row,
      debugLegend,
      interactButton,
      status,
      debug,
    );

    let lastPlayerPosition: TilePosition | null = null;
    let inputLock: LabKeyboardLockHandle | null = null;
    let debugRoot: TransformNode | null = null;

    const disposeDebugBoxes = (): void => {
      debugRoot?.dispose(false, true);
      debugRoot = null;
    };

    const renderDebugBoxes = (): void => {
      disposeDebugBoxes();
      const loaded = references.current;
      if (!debugBoxesToggle.input.checked || !loaded) return;
      const materials = {
        entrance: new StandardMaterial(`dungeon_entrance_debug_${loaded.loadId}`, context.scene),
        tile: new StandardMaterial(`dungeon_exit_tile_debug_${loaded.loadId}`, context.scene),
        'tile-edge': new StandardMaterial(`dungeon_exit_tile_edge_debug_${loaded.loadId}`, context.scene),
        'shared-edge': new StandardMaterial(`dungeon_exit_shared_edge_debug_${loaded.loadId}`, context.scene),
      };
      const colors = {
        entrance: '#35d07f',
        tile: '#e45aa6',
        'tile-edge': '#f5a623',
        'shared-edge': '#8d6be8',
      } as const;
      Object.entries(materials).forEach(([kind, material]) => {
        const color = Color3.FromHexString(colors[kind as keyof typeof colors]);
        material.diffuseColor = color;
        material.emissiveColor = color.scale(0.45);
        material.alpha = 0.34;
      });
      debugRoot = new TransformNode(`dungeon_transition_debug_${loaded.loadId}`, context.scene);
      const targets: DungeonTransitionDebugBinding[] = [
        ...scanDungeonEntrances(loaded.map).map((binding) => ({ kind: 'entrance' as const, binding })),
        ...scanDungeonExits(loaded.map).map((binding) => ({ kind: 'exit' as const, binding })),
      ];
      targets.forEach((target) => {
        const locationKind = target.kind === 'entrance' ? 'entrance' : target.binding.location.kind;
        const layout = resolveDungeonTransitionDebugLayout(
          target,
          loaded.spawn.sceneEnvironmentComponent,
          loaded.map.width,
          loaded.map.height,
        );
        const box = MeshBuilder.CreateBox(
          `dungeon_transition_${loaded.loadId}_${target.binding.entity.id}`,
          { width: layout.size[0], height: layout.size[1], depth: layout.size[2] },
          context.scene,
        );
        box.position.set(...layout.center);
        box.material = materials[locationKind];
        box.parent = debugRoot;
        box.isPickable = false;
        box.enableEdgesRendering();
        const color = Color3.FromHexString(colors[locationKind]);
        box.edgesColor.set(color.r, color.g, color.b, 1);
        box.edgesWidth = 4;
      });
    };

    const refreshDebug = (): void => {
      const loaded = references.current;
      debug.textContent = JSON.stringify(loaded ? {
        transitioning: controller.transitioning,
        presetKey: loaded.presetKey,
        playerPosition: loaded.runtime.playerPosition,
        playerFacing: loaded.runtime.playerFacing,
        entrances: scanDungeonEntrances(loaded.map).map(({ entity, component, tileX, tileY }) => ({
          entityId: entity.id, entranceId: component.entranceId, tileX, tileY, facing: component.facing,
        })),
        exits: scanDungeonExits(loaded.map).map(({ entity, component, location }) => ({
          entityId: entity.id, location: location.kind, activation: component.activation,
          targetMapPresetKey: component.targetMapPresetKey,
          targetEntranceId: component.targetEntranceId,
        })),
      } : { transitioning: false, loaded: false }, null, 2);
    };

    const controller = createDungeonTransitionController({
      getCurrentPresetKey: () => references.current?.presetKey ?? '',
      switchDungeon: async (presetKey, entranceId) => (
        await context.communication.request(dungeonMapSwitchRequest, { presetKey, entranceId })
      ).loaded,
    });

    const executeTransition = async (exit: DungeonExitBinding): Promise<void> => {
      if (!enabledToggle.input.checked || controller.transitioning) return;
      const source = references.current;
      if (!source) return;
      const payload: DungeonTransitionEventPayload = {
        sourcePresetKey: source.presetKey,
        targetPresetKey: exit.component.targetMapPresetKey,
        targetEntranceId: exit.component.targetEntranceId,
        exitEntityId: exit.entity.id,
      };
      try {
        const target = libraries.require().maps[exit.component.targetMapPresetKey];
        if (!target) throw new Error(`目标地图预设“${exit.component.targetMapPresetKey}”不存在。`);
        // 在切换并释放来源场景前完成目标入口预校验。
        findDungeonEntrance(target.map, exit.component.targetEntranceId);
        inputLock = context.keyboard.acquireLock({ ownerId: 'dungeon-transition', label: '地牢地图传送' });
        status.textContent = `正在切换到 ${payload.targetPresetKey} / ${payload.targetEntranceId}……`;
        refreshDebug();
        await context.communication.publish(dungeonTransitionStartedEvent, payload);
        const result = await controller.transition(exit);
        if (!result.transitioned) throw new Error(`地图切换未完成：${result.reason ?? 'unknown'}。`);
        await context.communication.request(dungeonRuntimeCommitRequest, { reason: 'dungeon-transition-arrived' });
        const loaded = references.current;
        lastPlayerPosition = loaded ? { ...loaded.runtime.playerPosition } : null;
        status.textContent = `已抵达 ${payload.targetPresetKey} / ${payload.targetEntranceId}。`;
        await context.communication.publish(dungeonTransitionCompletedEvent, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        status.textContent = `地图传送失败：${message}`;
        await context.communication.publish(dungeonTransitionFailedEvent, { ...payload, message });
      } finally {
        inputLock?.release();
        inputLock = null;
        refreshDebug();
      }
    };

    const findInteractionExit = (): DungeonExitBinding | null => {
      const loaded = references.current;
      if (!loaded || !enabledToggle.input.checked || !interactToggle.input.checked) return null;
      return findDungeonExitForInteraction(loaded.map, loaded.runtime.playerPosition, loaded.runtime.playerFacing);
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
      const loaded = references.current;
      if (!loaded || loaded.loadId !== changed.loadId) return;
      lastPlayerPosition = { ...loaded.runtime.playerPosition };
      status.textContent = `地图“${loaded.presetKey}”已加载；等待移动或交互出口。`;
      refreshDebug();
      renderDebugBoxes();
    });
    const offRuntimeChanged = context.communication.on(dungeonRuntimeChangedEvent, (changed) => {
      const loaded = references.current;
      if (!loaded || loaded.loadId !== changed.loadId) return;
      const nextPosition = { ...loaded.runtime.playerPosition };
      const previousPosition = lastPlayerPosition;
      lastPlayerPosition = nextPosition;
      refreshDebug();
      if (!enabledToggle.input.checked || !enterToggle.input.checked || controller.transitioning || !previousPosition) return;
      if (changed.reason !== 'player-movement-completed'
        && changed.reason !== 'player-relative-movement-completed') return;
      try {
        const exit = findDungeonExitAfterMovement(loaded.map, previousPosition, nextPosition);
        if (exit) void executeTransition(exit);
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
      }
    });

    refreshDebug();
    return () => {
      offMapChanged();
      offRuntimeChanged();
      keyboardRegistration.dispose();
      interactButton.removeEventListener('click', tryInteraction);
      inputLock?.release();
      disposeDebugBoxes();
    };
  },
};
