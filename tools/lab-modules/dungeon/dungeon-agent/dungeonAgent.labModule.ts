import {
  getDungeonMovementDirectionYaw,
  resolveDungeonMovementProfile,
  type DungeonMovementDirection,
} from '@/core/dungeon-movement';
import {
  clearDungeonAgentControllerOverride,
  createDefaultDungeonAgentControllerRegistry,
  createDefaultDungeonAgentControllerParameters,
  createDungeonAgentRuntimeState,
  normalizeDungeonAgentControllerParameters,
  normalizeDungeonAgentTilePointList,
  resolveDungeonAgentPriority,
  resolveDungeonAgentControllerConfig,
  runDungeonAgentControllersAfterPlayerStep,
  setDungeonAgentControllerOverride,
  startDungeonAgentMovement,
  startDungeonAgentTurn,
  syncDungeonAgentPathReservation,
  updateDungeonAgentControllers,
  updateDungeonAgentMovements,
  type DungeonAgentControllerAction,
  type DungeonAgentControllerParameter,
  type DungeonAgentTilePoint,
  type DungeonAgentRuntimeState,
  type DungeonAgentTurn,
  type DungeonRuntimeAgent,
} from '@/core/dungeon-agent';
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
    const movementModeSelect = document.createElement('select');
    movementModeSelect.replaceChildren(
      Object.assign(document.createElement('option'), { value: 'ground-four-way', textContent: '四方向' }),
      Object.assign(document.createElement('option'), { value: 'ground-eight-way', textContent: '八方向' }),
    );
    const controllerSelect = document.createElement('select');
    const controllerDescription = document.createElement('p');
    controllerDescription.className = 'lab-hint';
    const controllerParameters = document.createElement('div');
    controllerParameters.className = 'lab-agent-controller-parameters';
    const controllerSource = createReadonlyInput();
    const resetControllerButton = document.createElement('button');
    resetControllerButton.type = 'button';
    resetControllerButton.textContent = '恢复地图 Controller 配置';
    const factionInput = createReadonlyInput();
    const priorityInput = document.createElement('input');
    priorityInput.type = 'number';
    priorityInput.step = '1';
    priorityInput.title = '本次运行覆盖，不写回地图组件';
    const progressWeightInput = document.createElement('input');
    progressWeightInput.type = 'number';
    progressWeightInput.min = '0';
    progressWeightInput.step = '0.1';
    progressWeightInput.title = '公式：Y + X × 移动进度；修改共享移动仲裁器配置';
    const resetPriorityButton = document.createElement('button');
    resetPriorityButton.type = 'button';
    resetPriorityButton.textContent = '恢复地图优先级';
    const durationInput = createDurationInput();
    const moveControls = document.createElement('div');
    moveControls.className = 'lab-movement-grid';
    const directions: ReadonlyArray<readonly [DungeonMovementDirection, string]> = [
      ['north-east', '↖ 东北'], ['north', '↑ 北'], ['north-west', '↗ 西北'],
      ['east', '← 东'], ['west', '→ 西'],
      ['south-east', '↙ 东南'], ['south', '↓ 南'], ['south-west', '↘ 西南'],
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
      createLabField('移动方向能力（本次运行）', movementModeSelect),
      createLabField('控制器', controllerSelect),
      controllerDescription,
      createLabField('配置来源', controllerSource),
      createLabField('Controller 参数（仅本次运行）', controllerParameters),
      resetControllerButton,
      createLabField('阵营', factionInput),
      createLabField('移动冲突优先级（本次运行）', priorityInput),
      createLabField('移动进度权重 X（本次运行）', progressWeightInput),
      resetPriorityButton,
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
    type ParameterControl = Readonly<{
      element: HTMLElement;
      sync(value: unknown): void;
    }>;
    const parameterControls = new Map<string, ParameterControl>();
    let renderedParameterKey = '';

    controllerSelect.replaceChildren(...[...controllerRegistry.values()].map((controller) => {
      const option = document.createElement('option');
      option.value = controller.id;
      option.textContent = controller.label;
      return option;
    }));

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
        marker.setPose(tileWorldPosition(agent.tileIndex), getDungeonMovementDirectionYaw(agent.facing));
        return;
      }
      const progress = movement.visualProgress ?? (movement.durationSeconds <= 0
        ? 1
        : Math.min(1, movement.elapsedSeconds / movement.durationSeconds));
      const from = tileWorldPosition(movement.fromTileIndex);
      const to = tileWorldPosition(movement.toTileIndex);
      const fromYaw = getDungeonMovementDirectionYaw(movement.fromFacing);
      const rotationProgress = movement.rotationProgress ?? progress;
      const yaw = fromYaw + shortestAngleDelta(
        fromYaw,
        getDungeonMovementDirectionYaw(movement.toFacing),
      ) * rotationProgress;
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

    const effectiveController = (agent: DungeonRuntimeAgent) => {
      const config = resolveDungeonAgentControllerConfig(agent);
      return { config, definition: controllerRegistry.get(config.controllerId) };
    };

    const applyParameterValue = (
      agent: DungeonRuntimeAgent,
      parameter: DungeonAgentControllerParameter,
      value: unknown,
    ) => {
      const currentAgent = selectedAgent();
      if (!currentAgent || currentAgent.binding.entity.id !== agent.binding.entity.id) return;
      const current = effectiveController(currentAgent);
      if (!current.definition) return;
      const parameters = { ...current.config.parameters, [parameter.key]: value };
      setDungeonAgentControllerOverride(
        currentAgent,
        current.definition,
        normalizeDungeonAgentControllerParameters(current.definition, parameters),
        state ?? undefined,
      );
      controllerSource.value = '本次运行覆盖（不写回地图）';
      status.textContent = `已更新 ${current.definition.label} 的“${parameter.label}”。`;
      refreshPanel();
    };

    const createTileListControl = (
      agent: DungeonRuntimeAgent,
      parameter: Extract<DungeonAgentControllerParameter, { type: 'tile-list' }>,
    ): ParameterControl => {
      const root = document.createElement('div');
      root.className = 'lab-agent-route-editor';
      const header = document.createElement('div');
      header.className = 'lab-agent-route-header';
      header.innerHTML = '<span>#</span><span>格子 X</span><span>格子 Y</span><span>操作</span>';
      const list = document.createElement('div');
      list.className = 'lab-agent-route-list';
      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.textContent = '＋ 添加巡逻点';
      let points: DungeonAgentTilePoint[] = [];
      let signature = '';

      const commit = (next: readonly DungeonAgentTilePoint[]) => {
        points = next.map((point) => ({ ...point }));
        signature = '';
        applyParameterValue(agent, parameter, points);
      };
      const render = () => {
        if (!points.length) {
          const empty = document.createElement('div');
          empty.className = 'lab-agent-route-empty';
          empty.textContent = '尚无巡逻点；Controller 将停在原地。';
          list.replaceChildren(empty);
          return;
        }
        list.replaceChildren(...points.map((point, index) => {
          const row = document.createElement('div');
          row.className = 'lab-agent-route-item';
          const order = document.createElement('strong');
          order.textContent = String(index + 1);
          order.title = `巡逻点 ${index + 1}`;
          const xInput = document.createElement('input');
          xInput.type = 'number';
          xInput.min = '0';
          xInput.max = String(Math.max(0, (loaded?.runtime.map.width ?? 1) - 1));
          xInput.step = '1';
          xInput.value = String(point.x);
          xInput.title = '格子 X';
          xInput.setAttribute('aria-label', `巡逻点 ${index + 1} X`);
          const yInput = document.createElement('input');
          yInput.type = 'number';
          yInput.min = '0';
          yInput.max = String(Math.max(0, (loaded?.runtime.map.height ?? 1) - 1));
          yInput.step = '1';
          yInput.value = String(point.y);
          yInput.title = '格子 Y';
          yInput.setAttribute('aria-label', `巡逻点 ${index + 1} Y`);
          const removeButton = document.createElement('button');
          removeButton.type = 'button';
          removeButton.textContent = '删除';
          removeButton.title = `删除巡逻点 ${index + 1}`;
          const updateCoordinate = () => {
            const x = Number(xInput.value);
            const y = Number(yInput.value);
            const width = loaded?.runtime.map.width ?? 1;
            const height = loaded?.runtime.map.height ?? 1;
            if (!Number.isInteger(x) || !Number.isInteger(y)
              || x < 0 || y < 0 || x >= width || y >= height) {
              status.textContent = `巡逻点必须位于地图范围：X 0–${width - 1}，Y 0–${height - 1}。`;
              return;
            }
            commit(points.map((item, itemIndex) => itemIndex === index ? { x, y } : item));
          };
          xInput.addEventListener('change', updateCoordinate);
          yInput.addEventListener('change', updateCoordinate);
          removeButton.addEventListener('click', () => commit(points.filter((_, itemIndex) => itemIndex !== index)));
          row.append(order, xInput, yInput, removeButton);
          return row;
        }));
      };
      addButton.addEventListener('click', () => {
        const last = points[points.length - 1];
        const currentPosition = tilePosition(agent.tileIndex);
        const width = loaded?.runtime.map.width ?? 1;
        const next = last
          ? { x: (last.x + 1) % width, y: last.y }
          : { x: currentPosition.tileX, y: currentPosition.tileY };
        commit([...points, next]);
      });
      root.append(header, list, addButton);
      return {
        element: root,
        sync(value) {
          if (root.contains(document.activeElement)) return;
          const next = normalizeDungeonAgentTilePointList(value, parameter.defaultValue);
          const nextSignature = JSON.stringify(next);
          if (nextSignature === signature) return;
          points = next;
          signature = nextSignature;
          render();
        },
      };
    };

    const createParameterControl = (
      agent: DungeonRuntimeAgent,
      parameter: DungeonAgentControllerParameter,
    ): ParameterControl => {
      if (parameter.type === 'tile-list') return createTileListControl(agent, parameter);
      const control = parameter.type === 'select'
        ? document.createElement('select')
        : document.createElement('input');
      if (parameter.type === 'select') {
        control.replaceChildren(...parameter.options.map(({ value, label }) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          return option;
        }));
      } else {
        control.type = parameter.type === 'boolean' ? 'checkbox' : parameter.type;
        if (parameter.type === 'number') {
          if (parameter.min !== undefined) control.min = String(parameter.min);
          if (parameter.max !== undefined) control.max = String(parameter.max);
          if (parameter.step !== undefined) control.step = String(parameter.step);
          if (parameter.defaultValue === undefined) control.placeholder = '自动';
        } else if (parameter.type === 'text') {
          control.placeholder = parameter.placeholder ?? '';
        }
      }
      control.title = parameter.description ?? '';
      control.addEventListener('change', () => {
        let value: unknown;
        if (parameter.type === 'boolean' && control instanceof HTMLInputElement) {
          value = control.checked;
        } else if (control.value.trim() === '' && parameter.defaultValue === undefined) {
          const current = effectiveController(agent);
          const parameters = { ...current.config.parameters };
          delete parameters[parameter.key];
          if (current.definition) setDungeonAgentControllerOverride(
            agent,
            current.definition,
            parameters,
            state ?? undefined,
          );
          refreshPanel();
          return;
        } else {
          value = parameter.type === 'number' ? Number(control.value) : control.value;
        }
        applyParameterValue(agent, parameter, value);
      });
      return {
        element: control,
        sync(value) {
          if (document.activeElement === control) return;
          if (parameter.type === 'boolean' && control instanceof HTMLInputElement) control.checked = value === true;
          else control.value = value === undefined ? '' : String(value);
        },
      };
    };

    const renderControllerParameters = (agent: DungeonRuntimeAgent | undefined) => {
      const current = agent ? effectiveController(agent) : undefined;
      const nextKey = agent && current ? `${agent.binding.entity.id}:${current.config.controllerId}` : '';
      if (nextKey !== renderedParameterKey) {
        renderedParameterKey = nextKey;
        parameterControls.clear();
        if (!agent || !current?.definition) {
          controllerParameters.replaceChildren();
        } else if (!current.definition.parameters.length) {
          const empty = document.createElement('span');
          empty.className = 'lab-hint';
          empty.textContent = '此 Controller 没有可调参数。';
          controllerParameters.replaceChildren(empty);
        } else {
          controllerParameters.replaceChildren(...current.definition.parameters.map((parameter) => {
            const control = createParameterControl(agent, parameter);
            parameterControls.set(parameter.key, control);
            return createLabField(parameter.label, control.element);
          }));
        }
      }
      if (!agent || !current?.definition) return;
      current.definition.parameters.forEach((parameter) => {
        const control = parameterControls.get(parameter.key);
        if (!control) return;
        const value = current.config.parameters[parameter.key] ?? parameter.defaultValue;
        control.sync(value);
      });
    };

    const refreshPanel = () => {
      const agent = selectedAgent();
      if (agent) {
        const current = effectiveController(agent);
        const position = tilePosition(agent.tileIndex);
        positionInput.value = `(${position.tileX}, ${position.tileY}) · index ${agent.tileIndex}`;
        facingInput.value = agent.facing;
        const actor = state?.traversal.actors.get(agent.binding.entity.id);
        movementModeSelect.value = resolveDungeonMovementProfile(
          actor?.movementProfileId ?? agent.binding.gridAgent.movementProfileId,
        ).directionMode === 'eight-way' ? 'ground-eight-way' : 'ground-four-way';
        moveControls.querySelectorAll<HTMLButtonElement>('[data-agent-move*="-"]').forEach((button) => {
          button.disabled = movementModeSelect.value !== 'ground-eight-way';
        });
        controllerSelect.value = current.config.controllerId;
        controllerDescription.textContent = current.definition?.description
          ?? `未注册的 Controller：“${current.config.controllerId}”。`;
        controllerSource.value = agent.controllerOverride
          ? '本次运行覆盖（不写回地图）'
          : '地图初始配置';
        factionInput.value = agent.binding.faction?.factionId ?? 'neutral';
        priorityInput.value = String(resolveDungeonAgentPriority(agent));
        progressWeightInput.value = String(state?.movementResolver.config.progressWeight ?? '');
      } else {
        positionInput.value = '';
        facingInput.value = '';
        movementModeSelect.value = 'ground-four-way';
        moveControls.querySelectorAll<HTMLButtonElement>('[data-agent-move]').forEach((button) => {
          button.disabled = true;
        });
        controllerSelect.value = '';
        controllerDescription.textContent = '请先选择一个 Agent。';
        controllerSource.value = '';
        factionInput.value = '';
        priorityInput.value = '';
        progressWeightInput.value = '';
      }
      controllerSelect.disabled = !agent;
      movementModeSelect.disabled = !agent;
      resetControllerButton.disabled = !agent?.controllerOverride;
      resetPriorityButton.disabled = !agent || agent.priorityOverride === undefined;
      renderControllerParameters(agent);
      if (!panel.content.hidden) {
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
            effectivePriority: resolveDungeonAgentPriority(item),
            prioritySource: item.priorityOverride === undefined ? 'map' : 'runtime-override',
            movementProfileId: state.traversal.actors.get(item.binding.entity.id)?.movementProfileId
              ?? item.binding.gridAgent.movementProfileId,
            spatialFootprint: state.traversal.actors.get(item.binding.entity.id)?.spatialFootprint
              ?? item.binding.gridAgent.spatialFootprint
              ?? 'center',
            controllerId: resolveDungeonAgentControllerConfig(item).controllerId,
            controllerParameters: resolveDungeonAgentControllerConfig(item).parameters,
            controllerSource: item.controllerOverride ? 'runtime-override' : 'map',
            controllerState: item.controllerState,
            navigationPlan: item.navigationPlan,
            factionId: item.binding.faction?.factionId ?? 'neutral',
            movement: item.movement,
          })),
          occupantsByTile: state.traversal.occupantIdsByTile.map((occupants) => [...occupants]),
          pathReservationsByTile: state.traversal.pathReservationsByTile.map((reservations) => Object.fromEntries(reservations)),
          movement: state.movementResolver.debugSnapshot(),
        } : { loaded: false }, null, 2);
      }
    };
    const panelVisibilityObserver = new MutationObserver(() => {
      if (!panel.content.hidden) refreshPanel();
    });
    panelVisibilityObserver.observe(panel.content, { attributes: true, attributeFilter: ['hidden'] });

    priorityInput.addEventListener('change', () => {
      const agent = selectedAgent();
      const value = Number(priorityInput.value);
      if (!agent || !Number.isInteger(value)) {
        status.textContent = '移动冲突优先级必须是整数。';
        refreshPanel();
        return;
      }
      agent.priorityOverride = value;
      status.textContent = `已将移动冲突优先级设为 ${value}（仅本次运行）。`;
      refreshPanel();
    });
    progressWeightInput.addEventListener('change', () => {
      const value = Number(progressWeightInput.value);
      if (!state || !Number.isFinite(value) || value < 0) {
        status.textContent = '移动进度权重 X 必须是非负有限数。';
        refreshPanel();
        return;
      }
      state.movementResolver.updateConfig({ progressWeight: value });
      status.textContent = `已将移动进度权重 X 设为 ${value}（仅本次运行）。`;
      refreshPanel();
    });
    resetPriorityButton.addEventListener('click', () => {
      const agent = selectedAgent();
      if (!agent) return;
      delete agent.priorityOverride;
      status.textContent = '已恢复地图中的移动冲突优先级。';
      refreshPanel();
    });

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

    const moveSelectedAgent = (direction: DungeonMovementDirection) => {
      const agent = selectedAgent();
      if (!agent || !state || !loaded) return;
      const result = startDungeonAgentMovement(
        state,
        loaded.runtime.map,
        agent.binding.entity.id,
        direction,
        {
          durationSeconds: movementDuration(),
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
      button.addEventListener('click', () => moveSelectedAgent(button.dataset.agentMove as DungeonMovementDirection));
    });
    turnControls.querySelectorAll<HTMLButtonElement>('[data-agent-turn]').forEach((button) => {
      button.addEventListener('click', () => turnSelectedAgent(button.dataset.agentTurn as DungeonAgentTurn));
    });
    selectedAgentSelect.addEventListener('change', refreshPanel);
    movementModeSelect.addEventListener('change', () => {
      const agent = selectedAgent();
      if (!agent || !state) return;
      const actor = state.traversal.actors.get(agent.binding.entity.id);
      if (!actor) return;
      actor.movementProfileId = movementModeSelect.value;
      agent.navigationPlan = undefined;
      syncDungeonAgentPathReservation(state, agent);
      refreshPanel();
    });
    controllerSelect.addEventListener('change', () => {
      const agent = selectedAgent();
      const definition = controllerRegistry.get(controllerSelect.value);
      if (!agent || !definition) return;
      setDungeonAgentControllerOverride(
        agent,
        definition,
        createDefaultDungeonAgentControllerParameters(definition),
        state ?? undefined,
      );
      renderedParameterKey = '';
      status.textContent = `已将 ${agent.binding.entity.name ?? agent.binding.entity.id} 的 Controller 切换为“${definition.label}”；仅影响本次运行。`;
      refreshPanel();
    });
    resetControllerButton.addEventListener('click', () => {
      const agent = selectedAgent();
      if (!agent) return;
      clearDungeonAgentControllerOverride(agent, state ?? undefined);
      renderedParameterKey = '';
      status.textContent = `已恢复 ${agent.binding.entity.name ?? agent.binding.entity.id} 的地图 Controller 配置。`;
      refreshPanel();
    });
    debugToggle.input.addEventListener('change', renderMarkers);

    const frameObserver = context.scene.onBeforeRenderObservable.add(() => {
      if (!state || !loaded) return;
      const deltaSeconds = context.engine.getDeltaTime() / 1000;
      const completed = updateDungeonAgentMovements(state, deltaSeconds);
      const actions = controllerToggle.input.checked
        ? updateDungeonAgentControllers(state, loaded.runtime.map, controllerRegistry, deltaSeconds, {
          playerTileIndex: loaded.runtime.playerPosition.tileY * loaded.runtime.map.width
            + loaded.runtime.playerPosition.tileX,
          reservationPenalty: 2,
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
        state = createDungeonAgentRuntimeState(
          next.runtime.map,
          next.runtime.traversal,
          next.runtime.movementResolver,
        );
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
        {
          playerTileIndex: loaded.runtime.playerPosition.tileY * loaded.runtime.map.width
            + loaded.runtime.playerPosition.tileX,
          reservationPenalty: 2,
        },
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
      panelVisibilityObserver.disconnect();
      disposeMarkers();
      agentReferenceController.clear();
      context.services.delete(DUNGEON_AGENT_RUNTIME_SERVICE_KEY);
    };
  },
};
