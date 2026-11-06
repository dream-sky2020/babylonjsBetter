import { validateDungeonInteractionDocument } from '@/core/dungeon-interaction/dungeonInteraction.validation';
import { DungeonInteractionRouter, DUNGEON_INTERACTION_SERVICE, type InteractionQuery } from '@/core/dungeon-interaction/DungeonInteractionRouter';
import { DUNGEON_PLAYER_STEP_SERVICE_KEY } from '@/core/dungeon-player-movement/dungeonPlayerStepEvents';
import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import { DUNGEON_PLAYER_STATE_MEMORY } from '../dungeon-runtime/dungeonRuntime.memory';
import { PLAYER_MOVEMENT_BLOCKED_ATTEMPT_SERVICE_KEY, type DungeonPlayerBlockedAttemptService } from '../player-movement/playerMovement.blockedAttempt';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { controlSetting, createLabStatus, createLabSwitch, createLabField, type LabModule } from '@/labs/kit';
import { DUNGEON_INTERACTION_CONTROL } from '@/core/dungeon-interaction/dungeonInteractionControl';
import { DUNGEON_GRID_MEMORY } from '../dungeon-grid/dungeonGrid.memory';
import { DUNGEON_OVERHEAD_VIEW_SERVICE_KEY, type DungeonOverheadViewService } from '../dungeon-overhead-view/dungeonOverheadView.references';
import { createDungeonInteractionDebug } from './dungeonInteractionDebug';

export const dungeonInteractionLabModule: LabModule = {
  id: 'dungeon-interaction', dependencies: ['player-movement', 'dungeon-map-loader', 'dungeon-overhead-view'],
  setup(context) {
    const defaults = { enabled: true, key: 'KeyE', 'debug-entities': false };
    const config = context.config ? context.config.register('dungeon-interaction', {
      enabled: { defaultValue: true, valid: value => typeof value === 'boolean' },
      key: { defaultValue: 'KeyE', valid: value => typeof value === 'string' && /^(Key[A-Z]|Enter|Space)$/.test(value) },
      'debug-entities': { defaultValue: false, valid: value => typeof value === 'boolean' },
    }) as typeof defaults : defaults;
    const player = context.memory.acquire(DUNGEON_PLAYER_STATE_MEMORY);
    const grid = context.memory.acquire(DUNGEON_GRID_MEMORY);
    const control = context.services.get(DUNGEON_INTERACTION_CONTROL);
    const overhead = context.services.get<DungeonOverheadViewService>(DUNGEON_OVERHEAD_VIEW_SERVICE_KEY);
    const assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    const offPreparation = assembly.registerPreparation('dungeon-interaction', runtime => {
      const errors = validateDungeonInteractionDocument(runtime.map.document);
      if (errors.length) throw new Error(errors.join('\n'));
    });
    const steps = context.services.get(DUNGEON_PLAYER_STEP_SERVICE_KEY);
    const blocked = context.services.get<DungeonPlayerBlockedAttemptService>(PLAYER_MOVEMENT_BLOCKED_ATTEMPT_SERVICE_KEY);
    const router = new DungeonInteractionRouter();
    const dispatch = (query: InteractionQuery) => {
      const current = player.current;
      if (!config.enabled || !current || current.loadId !== query.loadId || assembly.isPaused || context.scheduler.isPaused) return false;
      if (query.trigger === 'interact' && current.playerMovement) return false;
      return router.dispatch(query);
    };
    context.services.set(DUNGEON_INTERACTION_SERVICE, { register: provider => router.register(provider), dispatch,
      inspect: () => router.inspect(), subscribe: listener => router.subscribe(listener), isConsumed: (loadId, id) => router.isConsumed(loadId, id) });
    const interact = () => {
      const current = player.current;
      return !!current && dispatch({ trigger: 'interact', loadId: current.loadId, position: { ...current.playerPosition }, facing: current.playerFacing });
    };
    const keyboard = context.keyboard.register({ id: 'dungeon-interaction', label: '地牢统一交互', keys: [config.key], enabled: config.enabled,
      priority: 70, intercept: true, preventDefault: true,
      onKeyDown: event => event.repeat ? 'handled' : interact() ? 'handled' : 'ignored' });
    let lastStep = 0;
    const offStep = steps.subscribe('dungeon-interaction', 100, event => {
      if (event.loadId !== player.current?.loadId || event.stepId <= lastStep) return;
      lastStep = event.stepId;
      if (dispatch({ trigger: 'enter', loadId: event.loadId, position: event.to, from: event.from, facing: event.facing })) return true;
    });
    const offBlocked = blocked.register(attempt => {
      const current = player.current;
      if (!current || !['north', 'east', 'south', 'west'].includes(attempt.direction)) return false;
      return dispatch({ trigger: 'move-attempt', loadId: current.loadId, position: attempt.from,
        facing: attempt.direction as InteractionQuery['facing'] });
    });
    const panel = context.ui.addPanel('dungeon-interaction', '地牢交互');
    const enabled = createLabSwitch('启用统一交互', config.enabled);
    const debug = createLabSwitch('显示交互实体 Debug', config['debug-entities']); debug.input.dataset.interactionDebugToggle = '';
    const legend = document.createElement('small'); legend.textContent = '蓝：按键对话；橙：进入对话；紫：传送；灰：已禁用 / 本次已触发。格子轮廓表示挂载位置，窄条表示边；仅辅助显示。';
    const debugSummary = createLabStatus('交互实体 Debug 已关闭。'); debugSummary.dataset.interactionDebugSummary = '';
    debugSummary.style.whiteSpace = 'pre-line'; debugSummary.style.lineHeight = '1.55';
    const debugView = createDungeonInteractionDebug(context.scene);
    const syncDebug = () => {
      const loaded = grid.current;
      debugView.setView(overhead.displayedView);
      if (!config['debug-entities'] || !loaded) { debugView.clear(); debugSummary.textContent = '交互实体 Debug 已关闭。'; debugSummary.dataset.count = '0'; return; }
      try {
        const captions = debugView.sync(control.describe(loaded.loadId), loaded, config.key, id => router.isConsumed(loaded.loadId, id));
        debugSummary.dataset.count = String(captions.length); debugSummary.textContent = captions.length ? captions.join('\n') : '当前地图没有可显示的交互实体。';
      } catch (error) {
        debugView.clear(); debugSummary.dataset.count = '0';
        debugSummary.textContent = `交互 Debug 显示失败：${error instanceof Error ? error.message : String(error)}`;
      }
    };
    const offView = overhead.subscribe(syncDebug);
    const stopDebug = context.scheduler.register({ id: 'interaction-debug', phase: 'presentation', order: 320, intervalSeconds: .05,
      description: '仅 Debug 开启时跟随交互实体的当前空间位置', run: () => { if (config['debug-entities']) syncDebug(); } });
    const offMap = context.communication.on(dungeonMapChangedEvent, () => { lastStep = 0; router.reset(); debugView.clear(); syncDebug(); });
    const key = document.createElement('input'); key.value = config.key; key.type = 'text';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = '触发当前位置 / 前方交互'; button.dataset.dungeonInteract = '';
    button.addEventListener('click', interact);
    const status = createLabStatus('等待交互。'); status.dataset.interactionStatus = '';
    const render = () => {
      const state = router.inspect(); status.textContent = state.error || (state.target ? `${state.busy ? '正在处理' : '最近目标'}：${state.target}` : '等待交互。');
      status.dataset.error = String(!!state.error);
    };
    const offStatus = router.subscribe(() => { render(); syncDebug(); });
    panel.content.append(enabled.row, createLabField('交互键代码', key), button, status, debug.row, legend, debugSummary);
    const settings = context.ui.registerSettings('dungeon-interaction', [
      controlSetting('enabled', '启用统一交互', enabled.input),
      controlSetting('key', '交互键代码', key, { valid: value => typeof value === 'string' && /^(Key[A-Z]|Enter|Space)$/.test(value) }),
      controlSetting('debug-entities', '显示交互实体 Debug', debug.input),
    ], () => {
      if (!context.config) { config.enabled = enabled.input.checked; config.key = key.value; config['debug-entities'] = debug.input.checked; }
      keyboard.setEnabled(config.enabled); keyboard.setKeys([config.key]);
      syncDebug();
    });
    if (!context.config) {
      enabled.input.addEventListener('change', () => { config.enabled = enabled.input.checked; keyboard.setEnabled(config.enabled); });
      key.addEventListener('change', () => { if (/^(Key[A-Z]|Enter|Space)$/.test(key.value)) { config.key = key.value; keyboard.setKeys([config.key]); } });
      debug.input.addEventListener('change', () => { config['debug-entities'] = debug.input.checked; syncDebug(); });
    }
    return () => { settings.dispose(); offPreparation(); offStep(); offBlocked(); offMap(); offStatus(); offView(); stopDebug(); debugView.clear(); keyboard.dispose(); router.dispose();
      context.services.delete(DUNGEON_INTERACTION_SERVICE); panel.root.remove(); };
  },
};
