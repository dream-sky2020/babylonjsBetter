import type { DungeonMapDirection } from '@/core/map';
import {
  createDefaultDungeonAgentControllerRegistry,
  createDungeonAgentRuntimeState,
  runDungeonAgentControllersAfterPlayerStep,
  startDungeonAgentMovement,
  startDungeonAgentTurn,
  updateDungeonAgentControllers,
  updateDungeonAgentMovements,
  type DungeonAgentControllerAction,
  type DungeonAgentRuntimeState,
  type DungeonAgentTurn,
  type DungeonRuntimeAgent,
} from '@/core/dungeon-agent';
import { findDungeonMovementObstacles } from '@/core/dungeon-obstacle';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene';
import {
  createLabField,
  createLabJson,
  createLabStatus,
  createLabSwitch,
  type LabModule,
} from '@/tools/lab-kit';
import {
  dungeonMapChangedEvent,
  dungeonRuntimeChangedEvent,
} from '../dungeon-map-loader/dungeonMapLoader.protocol';
import {
  DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
  type DungeonMapLoaderReferences,
  type LoadedDungeonReferences,
} from '../dungeon-map-loader/dungeonMapLoader.references';
import { createDungeonAgentDebugMarker, type DungeonAgentDebugMarker } from './dungeonAgentDebugMarker';
import { dungeonAgentsChangedEvent, dungeonAgentsLoadedEvent } from './dungeonAgent.protocol';
import {
  createDungeonAgentRuntimeReferences,
  DUNGEON_AGENT_RUNTIME_SERVICE_KEY,
} from './dungeonAgent.references';

const DIRECTION_YAWS: Readonly<Record<DungeonMapDirection, number>> = {
  north: Math.PI,
  east: Math.PI / 2,
  south: 0,
  west: -Math.PI / 2,
};

const FACTION_COLORS: Readonly<Record<string, string>> = {
  hostile: '#ef4444',
  friendly: '#3b82f6',
  neutral: '#f59e0b',
  mechanism: '#a855f7',
};

const createReadonlyInput = (): HTMLInputElement => {
  const input = document.createElement('input');
  input.readOnly = true;
  return input;
};

const createDurationInput = (): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '0.05';
  input.value = '0.3';
  return input;
};

const shortestAngleDelta = (from: number, to: number): number => {
  const fullTurn = Math.PI * 2;
  return ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
};

const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

export const dungeonAgentLabModule: LabModule = {
  id: 'dungeon-agent',
  dependencies: ['player-movement'],
  setup(context) {
    const mapReferences = context.services.get<DungeonMapLoaderReferences>(
      DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
    );
    const agentReferenceController = createDungeonAgentRuntimeReferences();
    context.services.set(DUNGEON_AGENT_RUNTIME_SERVICE_KEY, agentReferenceController.references);

    const panel = context.ui.addPanel('dungeon-agent', '可移动 Dungeon Agent');
    const debugToggle = createLabSwitch('显示 Agent Debug 模型', true, {
      preference: { ui: context.ui, key: 'dungeon-agent/debug-markers' },
    });
    const controllerToggle = createLabSwitch('启用 Agent Controller', true, {
      preference: { ui: context.ui, key: 'dungeon-agent/controllers-enabled' },
    });
    const selectedAgentSelect = document.createElement('select');
    const positionInput = createReadonlyInput();
    const facingInput = createReadonlyInput();
    const controllerInput = createReadonlyInput();
    const factionInput = createReadonlyInput();
    const durationInput = createDurationInput();
    const moveControls = document.createElement('div');
    moveControls.className = 'lab-movement-grid';
    const directions: ReadonlyArray<readonly [DungeonMapDirection, string]> = [
      ['north', '↑ 北'], ['west', '← 西'], ['south', '↓ 南'], ['east', '→ 东'],
    ];
    directions.forEach(([direction, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.agentMove = direction;
      button.textContent = label;
      moveControls.append(button);
    });
    const turnControls = document.createElement('div');
    turnControls.className = 'lab-turn-grid';
    const turns: ReadonlyArray<readonly [DungeonAgentTurn, string]> = [
      ['left', '↶ 左转'], ['back', '↺ 后转'], ['right', '↷ 右转'],
    ];
    turns.forEach(([turn, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.agentTurn = turn;
      button.textContent = label;
      turnControls.append(button);
    });
    const status = createLabStatus('等待地图中的 dungeon-agent。');
    const runtimeJson = createLabJson();
    panel.content.append(
      debugToggle.row,
      controllerToggle.row,
      createLabField('选择 Agent', selectedAgentSelect),
      createLabField('当前格子', positionInput),
      createLabField('当前朝向', facingInput),
      createLabField('控制器', controllerInput),
      createLabField('阵营', factionInput),
      createLabField('移动 / 转向耗时（秒）', durationInput),
      createLabField('手动格步移动', moveControls),
      createLabField('手动原地转向', turnControls),
      status,
      runtimeJson,
    );

    let loaded: LoadedDungeonReferences | null = null;
    let state: DungeonAgentRuntimeState | null = null;
    const controllerRegistry = createDefaultDungeonAgentControllerRegistry();
    const markers = new Map<string, DungeonAgentDebugMarker>();

    const disposeMarkers = () => {
      markers.forEach((marker) => marker.dispose());
      markers.clear();
    };

    const tilePosition = (tileIndex: number) => {
      if (!loaded) return { tileX: 0, tileY: 0 };
      return {
        tileX: tileIndex % loaded.runtime.map.width,
        tileY: Math.floor(tileIndex / loaded.runtime.map.width),
      };
    };

    const tileWorldPosition = (tileIndex: number): readonly [number, number, number] => {
      if (!loaded) return [0, 0, 0];
      const { tileX, tileY } = tilePosition(tileIndex);
      return resolveDungeonMapTileWorldLayout(
        loaded.spawn.sceneEnvironmentComponent,
        loaded.runtime.map.width,
        loaded.runtime.map.height,
        tileX,
        tileY,
      ).center;
    };

    const syncMarker = (agent: DungeonRuntimeAgent) => {
      const marker = markers.get(agent.binding.entity.id);
      if (!marker) return;
      const movement = agent.movement;
      if (!movement) {
        marker.setPose(tileWorldPosition(agent.tileIndex), DIRECTION_YAWS[agent.facing]);
        return;
      }
      const progress = movement.durationSeconds <= 0
        ? 1
        : Math.min(1, movement.elapsedSeconds / movement.durationSeconds);
      const from = tileWorldPosition(movement.fromTileIndex);
      const to = tileWorldPosition(movement.toTileIndex);
      const fromYaw = DIRECTION_YAWS[movement.fromFacing];
      const yaw = fromYaw + shortestAngleDelta(fromYaw, DIRECTION_YAWS[movement.toFacing]) * progress;
      marker.setPose([
        lerp(from[0], to[0], progress),
        lerp(from[1], to[1], progress),
        lerp(from[2], to[2], progress),
      ], yaw);
    };

    const renderMarkers = () => {
      disposeMarkers();
      if (!debugToggle.input.checked || !loaded || !state) return;
      state.agents.forEach((agent) => {
        const { tileX, tileY } = tilePosition(agent.tileIndex);
        const layout = resolveDungeonMapTileWorldLayout(
          loaded!.spawn.sceneEnvironmentComponent,
          loaded!.runtime.map.width,
          loaded!.runtime.map.height,
          tileX,
          tileY,
        );
        const factionId = agent.binding.faction?.factionId ?? 'neutral';
        const marker = createDungeonAgentDebugMarker(
          context.scene,
          `${loaded!.loadId}_${agent.binding.entity.id}`,
          layout,
          FACTION_COLORS[factionId] ?? '#94a3b8',
        );
        markers.set(agent.binding.entity.id, marker);
        syncMarker(agent);
      });
    };

    const selectedAgent = (): DungeonRuntimeAgent | undefined => {
      if (!state) return undefined;
      const index = state.agentIndexByEntityId.get(selectedAgentSelect.value);
      return index === undefined ? undefined : state.agents[index];
    };

    const refreshPanel = () => {
      const agent = selectedAgent();
      if (agent) {
        const position = tilePosition(agent.tileIndex);
        positionInput.value = `(${position.tileX}, ${position.tileY}) · index ${agent.tileIndex}`;
        facingInput.value = agent.facing;
        controllerInput.value = agent.binding.controller.controllerId;
        factionInput.value = agent.binding.faction?.factionId ?? 'neutral';
      } else {
        positionInput.value = '';
        facingInput.value = '';
        controllerInput.value = '';
        factionInput.value = '';
      }
      runtimeJson.textContent = JSON.stringify(state ? {
        loadId: loaded?.loadId,
        turnNumber: state.turnNumber,
        agents: state.agents.map((item) => ({
          entityId: item.binding.entity.id,
          name: item.binding.entity.name,
          tileIndex: item.tileIndex,
          tilePosition: tilePosition(item.tileIndex),
          facing: item.facing,
          blocksMovement: item.binding.gridAgent.blocksMovement,
          actionPeriod: item.binding.gridAgent.actionPeriod,
          priority: item.binding.gridAgent.priority,
          movementProfileId: item.binding.gridAgent.movementProfileId,
          controllerId: item.binding.controller.controllerId,
          controllerState: item.controllerState,
          factionId: item.binding.faction?.factionId ?? 'neutral',
          movement: item.movement,
        })),
        occupantsByTile: state.occupantsByTile.map((occupants) => [...occupants]),
      } : { loaded: false }, null, 2);
    };

    const populateAgentSelect = () => {
      const previous = selectedAgentSelect.value;
      const options = (state?.agents ?? []).map((agent) => {
        const option = document.createElement('option');
        option.value = agent.binding.entity.id;
        option.textContent = agent.binding.entity.name
          ? `${agent.binding.entity.name} · ${agent.binding.entity.id}`
          : agent.binding.entity.id;
        return option;
      });
      selectedAgentSelect.replaceChildren(...options);
      if (options.some(({ value }) => value === previous)) selectedAgentSelect.value = previous;
      refreshPanel();
    };

    const movementDuration = (): number => {
      const value = Number(durationInput.value);
      return Number.isFinite(value) && value >= 0 ? value : 0.3;
    };

    const isAgentStepBlocked = {
      check: (_movingAgent: DungeonRuntimeAgent, fromTileIndex: number, toTileIndex: number, moveDirection: DungeonMapDirection) => {
        if (!loaded) return true;
        const from = tilePosition(fromTileIndex);
        const to = tilePosition(toTileIndex);
        return findDungeonMovementObstacles(loaded.runtime, from, to, moveDirection).length > 0;
      },
    };

    const describeControllerActions = (actions: readonly DungeonAgentControllerAction[]): string => {
      const moved = actions.filter((action) => action.outcome === 'move-started').length;
      const idle = actions.filter((action) => action.outcome === 'idle').length;
      const blocked = actions.filter((action) => action.outcome === 'blocked').length;
      return `Controller：移动 ${moved}，等待 ${idle}，受阻 ${blocked}。`;
    };

    const publishControllerActions = (actions: readonly DungeonAgentControllerAction[]) => {
      if (!loaded) return;
      const entityIds = actions
        .filter((action) => action.outcome === 'move-started')
        .map((action) => action.entityId);
      if (!entityIds.length) return;
      void context.communication.publish(dungeonAgentsChangedEvent, {
        loadId: loaded.loadId,
        entityIds,
        reason: 'controller-move-started',
      });
    };

    const moveSelectedAgent = (direction: DungeonMapDirection) => {
      const agent = selectedAgent();
      if (!agent || !state || !loaded) return;
      const result = startDungeonAgentMovement(
        state,
        loaded.runtime.map,
        agent.binding.entity.id,
        direction,
        {
          durationSeconds: movementDuration(),
          isStepBlocked: isAgentStepBlocked,
        },
      );
      status.textContent = result.started
        ? `${agent.binding.entity.name ?? agent.binding.entity.id} 开始向 ${direction} 移动。`
        : `移动失败：${result.blockedReason ?? 'unknown'}。`;
      syncMarker(agent);
      refreshPanel();
      if (result.started) void context.communication.publish(dungeonAgentsChangedEvent, {
        loadId: loaded.loadId,
        entityIds: [agent.binding.entity.id],
        reason: 'manual-move-started',
      });
    };

    const turnSelectedAgent = (turn: DungeonAgentTurn) => {
      const agent = selectedAgent();
      if (!agent || !state || !loaded) return;
      const result = startDungeonAgentTurn(state, agent.binding.entity.id, turn, movementDuration());
      status.textContent = result.started
        ? `${agent.binding.entity.name ?? agent.binding.entity.id} 开始${turn}转向。`
        : `转向失败：${result.blockedReason ?? 'unknown'}。`;
      syncMarker(agent);
      refreshPanel();
      if (result.started) void context.communication.publish(dungeonAgentsChangedEvent, {
        loadId: loaded.loadId,
        entityIds: [agent.binding.entity.id],
        reason: 'manual-turn-started',
      });
    };

    moveControls.querySelectorAll<HTMLButtonElement>('[data-agent-move]').forEach((button) => {
      button.addEventListener('click', () => moveSelectedAgent(button.dataset.agentMove as DungeonMapDirection));
    });
    turnControls.querySelectorAll<HTMLButtonElement>('[data-agent-turn]').forEach((button) => {
      button.addEventListener('click', () => turnSelectedAgent(button.dataset.agentTurn as DungeonAgentTurn));
    });
    selectedAgentSelect.addEventListener('change', refreshPanel);
    debugToggle.input.addEventListener('change', renderMarkers);

    const frameObserver = context.scene.onBeforeRenderObservable.add(() => {
      if (!state || !loaded) return;
      const deltaSeconds = context.engine.getDeltaTime() / 1000;
      const completed = updateDungeonAgentMovements(state, deltaSeconds);
      const actions = controllerToggle.input.checked
        ? updateDungeonAgentControllers(state, loaded.runtime.map, controllerRegistry, deltaSeconds, {
          isStepBlocked: isAgentStepBlocked,
        })
        : [];
      state.agents.forEach(syncMarker);
      if (!completed.length && !actions.length) return;
      status.textContent = actions.length
        ? describeControllerActions(actions)
        : `${completed.length} 个 Agent 完成移动或转向。`;
      refreshPanel();
      publishControllerActions(actions);
      if (completed.length) void context.communication.publish(dungeonAgentsChangedEvent, {
        loadId: loaded.loadId,
        entityIds: completed,
        reason: 'movement-completed',
      });
    });

    const offMapChanged = context.communication.on(dungeonMapChangedEvent, (changed) => {
      const next = mapReferences.current;
      if (!next || next.loadId !== changed.loadId) return;
      loaded = next;
      disposeMarkers();
      try {
        state = createDungeonAgentRuntimeState(next.runtime.map);
        agentReferenceController.commit({ loadId: next.loadId, state });
        populateAgentSelect();
        renderMarkers();
        status.textContent = state.agents.length
          ? `已从地图扫描并创建 ${state.agents.length} 个 Dungeon Agent。`
          : '当前地图没有 dungeon-agent；可先在地图编辑器的 Tile 中添加。';
        void context.communication.publish(dungeonAgentsLoadedEvent, {
          loadId: next.loadId,
          agentCount: state.agents.length,
        });
      } catch (error) {
        state = null;
        agentReferenceController.clear();
        populateAgentSelect();
        status.textContent = error instanceof Error ? error.message : String(error);
      }
      refreshPanel();
    });

    const offRuntimeChanged = context.communication.on(dungeonRuntimeChangedEvent, (changed) => {
      if (!controllerToggle.input.checked || !loaded || !state || changed.loadId !== loaded.loadId) return;
      if (changed.reason !== 'player-movement-completed'
        && changed.reason !== 'player-relative-movement-completed') return;
      const actions = runDungeonAgentControllersAfterPlayerStep(
        state,
        loaded.runtime.map,
        controllerRegistry,
        { isStepBlocked: isAgentStepBlocked },
      );
      state.agents.forEach(syncMarker);
      status.textContent = `玩家格步触发第 ${state.turnNumber} 回合；${describeControllerActions(actions)}`;
      refreshPanel();
      publishControllerActions(actions);
    });

    return () => {
      offMapChanged();
      offRuntimeChanged();
      context.scene.onBeforeRenderObservable.remove(frameObserver);
      disposeMarkers();
      agentReferenceController.clear();
      context.services.delete(DUNGEON_AGENT_RUNTIME_SERVICE_KEY);
    };
  },
};
