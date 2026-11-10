import { validateDungeonInteractionDocument } from '@/core/dungeon-interaction/dungeonInteraction.validation';
import { createServiceToken } from '@/core/system-runtime/ServiceToken';
import { DUNGEON_MAP_ACTION_EXECUTOR } from '../dungeon-map-action-executor/dungeonMapActionExecutor.labModule';
import { DungeonInteractionRouter, DUNGEON_INTERACTION_SERVICE, isAgentInteraction, type InteractionQuery } from '@/core/dungeon-interaction/DungeonInteractionRouter';
import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import { DUNGEON_PLAYER_STATE_MEMORY } from '../dungeon-runtime/dungeonRuntime.memory';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { controlSetting, createLabStatus, createLabSwitch, createLabField, type LabModule } from '@/labs/kit';
import { DUNGEON_INTERACTION_CONTROL } from '@/core/dungeon-interaction/dungeonInteractionControl';
import { DUNGEON_GRID_MEMORY } from '../dungeon-grid/dungeonGrid.memory';
import { DUNGEON_OVERHEAD_VIEW_SERVICE_KEY, type DungeonOverheadViewService } from '../dungeon-overhead-view/dungeonOverheadView.references';
import { createDungeonInteractionDebug } from './dungeonInteractionDebug';
import { validateInteractionEvent, type IEventComponent } from '@/core/entity/components/event.component';
import { DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '@/core/dungeon-traversal/dungeonTraversal';
import type { ConfigValue } from '@/labs/kit/config/LabConfig';
import type { DungeonMovementAttemptOutcome } from '@/core/dungeon-movement/dungeonMovementAttempt';

function validPlayerRules(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((rule: IEventComponent) => {
    if (!rule || rule.type !== 'event' || rule.version !== 2 || typeof rule.id !== 'string' || !rule.id.trim() || ids.has(rule.id)
      || rule.trigger !== 'move-attempt' || (!rule.movementPhase && rule.ruleKind !== 'action') || validateInteractionEvent(rule).length) return false;
    ids.add(rule.id);
    return true;
  });
}

export const DUNGEON_INTERACTION_INPUTS = createServiceToken<{
  bindInteract(handler: () => boolean): () => void;
  reportInteractMiss(): void;
  enabled(): boolean;
  keyboardSettings(): { enabled: boolean; key: string };
  onKeyboardSettings(listener: () => void): () => void;
  reportAttempt(attemptId: number, actorId: string, outcome: DungeonMovementAttemptOutcome): void;
}>('dungeon:interaction-inputs');

export const dungeonInteractionLabModule: LabModule = {
  id: 'dungeon-interaction', dependencies: ['player-movement', 'dungeon-map-loader', 'dungeon-overhead-view', 'dungeon-map-action-executor'],
  setup(context) {
    const debugDefaults = { 'debug-color': true, 'debug-labels': true, 'debug-name': true,
      'debug-trigger': true, 'debug-action': false, 'debug-state': true, 'debug-direction': false, 'debug-reasons': false };
    const defaults = { enabled: true, key: 'KeyE', 'player-action-rules': [] as IEventComponent[], 'debug-entities': false, ...debugDefaults };
    const config = context.config ? context.config.register('dungeon-interaction', {
      enabled: { defaultValue: true, valid: value => typeof value === 'boolean' },
      key: { defaultValue: 'KeyE', valid: value => typeof value === 'string' && /^(Key[A-Z]|Enter|Space)$/.test(value) },
      'player-action-rules': { defaultValue: [], valid: validPlayerRules },
      'debug-entities': { defaultValue: false, valid: value => typeof value === 'boolean' },
      ...Object.fromEntries(Object.entries(debugDefaults).map(([key, value]) => [key, { defaultValue: value, valid: (next: unknown) => typeof next === 'boolean' }])),
    }) as unknown as typeof defaults : defaults;
    const player = context.memory.acquire(DUNGEON_PLAYER_STATE_MEMORY);
    const grid = context.memory.acquire(DUNGEON_GRID_MEMORY);
    const control = context.services.get(DUNGEON_INTERACTION_CONTROL);
    const overhead = context.services.get<DungeonOverheadViewService>(DUNGEON_OVERHEAD_VIEW_SERVICE_KEY);
    const assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    const executor = context.services.get(DUNGEON_MAP_ACTION_EXECUTOR);
    const offPreparation = assembly.registerPreparation('dungeon-interaction', runtime => {
      const errors = validateDungeonInteractionDocument(runtime.map.document);
      if (errors.length) throw new Error(errors.join('\n'));
    });
    const router = new DungeonInteractionRouter();
    const consumedActions = new Set<string>();
    const contacts = new Map<string, Map<string, Set<string>>>();
    let offContact = () => {};
    const resetInteractions = () => {
      consumedActions.clear();
      contacts.clear();
    };
    const offActions = router.register({
      id: 'dungeon-feedback',
      acceptsAgents: true,
      acceptsBlockedMovement: true,
      isConsumed: (loadId, key) => consumedActions.has(`${loadId}:${key}`),
      find(query) {
        const actorId = query.actorId ?? DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID;
        return control.find(query).flatMap(match => {
          const action = match.action;
          if (action.type === 'dialogue' || router.isConsumed(query.loadId, match.onceKey)) return [];
          const seen = contacts.get(actorId)?.get(match.onceKey);
          if (match.contactBlockers?.every(id => seen?.has(id))) return [];
          return [{
            id: `${action.type}:${match.id}`, entityId: match.entityId, label: match.label,
            priority: match.priority, rank: match.rank, stopMovement: match.claimsMovement === true,
            execute() {
              if (match.once && router.isConsumed(query.loadId, match.onceKey)) return;
              if (match.contactBlockers) {
                let actorContacts = contacts.get(actorId);
                if (!actorContacts) contacts.set(actorId, actorContacts = new Map());
                const previous = actorContacts.get(match.onceKey);
                actorContacts.set(match.onceKey, new Set([...(previous ?? []), ...match.contactBlockers]));
              }
              const result = executor.execute(action, { loadId: query.loadId, ruleId: match.id, sourceEntityId: match.entityId,
                actorId, actorLabel: match.actorLabel });
              const markConsumed = () => {
                if (match.once && player.current?.loadId === query.loadId) consumedActions.add(`${query.loadId}:${match.onceKey}`);
              };
              if (result) return result.then(markConsumed);
              markConsumed();
            },
          }];
        });
      },
    });
    const status = createLabStatus('等待交互。'); status.dataset.interactionStatus = '';
    const attemptStatus = createLabStatus('等待移动尝试。'); attemptStatus.dataset.movementAttemptStatus = '';
    const agentAttemptStatus = createLabStatus('等待 Agent 移动尝试。');
    const outcomeText: Record<DungeonMovementAttemptOutcome, string> = {
      claimed: '已由规则接管', 'swap-started': '已进入换位', 'push-started': '已进入推动',
      blocked: '确认受阻', 'arbitration-rejected': '仲裁未通过',
    };
    const showAttempt = (attemptId: number, actorId: string, outcome: DungeonMovementAttemptOutcome) => {
      const playerAttempt = actorId === DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID;
      const output = playerAttempt ? attemptStatus : agentAttemptStatus;
      output.textContent = `移动尝试 #${attemptId} · ${playerAttempt ? '玩家' : actorId} · ${outcomeText[outcome]}`;
      output.dataset.outcome = outcome;
    };
    const dispatch = (query: InteractionQuery) => {
      const current = player.current;
      if (!config.enabled || !current || current.loadId !== query.loadId || assembly.isPaused || context.scheduler.isPaused) return false;
      if (!isAgentInteraction(query) && query.trigger === 'interact' && current.playerMovement) return false;
      return router.dispatch(query.trigger === 'move-attempt' ? { ...query, playerRules: config['player-action-rules'] } : query);
    };
    context.services.set(DUNGEON_INTERACTION_SERVICE, { register: provider => router.register(provider), dispatch,
      inspect: () => router.inspect(), subscribe: listener => router.subscribe(listener), isConsumed: (loadId, id) => router.isConsumed(loadId, id) });
    let interact: (() => boolean) | undefined;
    const reportInteractMiss = () => {
      const current = player.current;
      if (current && config.enabled) {
        status.dataset.error = 'false';
        status.textContent = assembly.isPaused || context.scheduler.isPaused ? '场景已暂停，恢复后可交互。'
          : current.playerMovement ? '移动或转向尚未结束，请停稳后再按交互键。'
          : '当前位置没有可触发的交互。试着站在目标相邻格并面向它。';
      }
    };
    const keyboardListeners = new Set<() => void>();
    const notifyKeyboard = () => { for (const listener of keyboardListeners) listener(); };
    context.services.set(DUNGEON_INTERACTION_INPUTS, {
      bindInteract(handler) { interact = handler; return () => { if (interact === handler) interact = undefined; }; },
      reportInteractMiss, enabled: () => config.enabled,
      keyboardSettings: () => ({ enabled: config.enabled, key: config.key }),
      onKeyboardSettings(listener) { keyboardListeners.add(listener); return () => { keyboardListeners.delete(listener); }; },
      reportAttempt: showAttempt,
    });
    const panel = context.ui.addPanel('dungeon-interaction', '地牢交互');
    const enabled = createLabSwitch('启用统一交互', config.enabled);
    const debug = createLabSwitch('显示交互实体 Debug', config['debug-entities']); debug.input.dataset.interactionDebugToggle = '';
    const debugControls = [
      ['debug-color', '显示地块着色与轮廓'], ['debug-labels', '显示文字标签'],
      ['debug-name', '实体名称'], ['debug-trigger', '触发方式 / 按键'],
      ['debug-action', '交互类型'], ['debug-state', '启用与触发状态'],
      ['debug-direction', '方向条件与正面箭头'], ['debug-reasons', '面板显示当前方向判定原因'],
    ].map(([key, label]) => {
      const field = key as keyof typeof debugDefaults;
      const toggle = createLabSwitch(label, config[field]); toggle.input.dataset.interactionDebugOption = field;
      return { field, label, ...toggle };
    });
    const labelFields = document.createElement('fieldset');
    const labelLegend = document.createElement('legend'); labelLegend.textContent = '标签显示内容';
    labelFields.append(labelLegend, ...debugControls.slice(2).map(control => control.row));
    const legend = document.createElement('small'); legend.textContent = '蓝：按键对话；橙：进入对话；紫：传送；灰：已禁用 / 本次已触发。格子轮廓表示挂载位置，窄条表示边；仅辅助显示。';
    const debugSummary = createLabStatus('交互实体 Debug 已关闭。'); debugSummary.dataset.interactionDebugSummary = '';
    debugSummary.style.whiteSpace = 'pre-line'; debugSummary.style.lineHeight = '1.55';
    const labelLayer = context.viewport.openHtmlLayer({ id: 'dungeon:interaction-debug', title: '交互标签', mode: 'overlay',
      inputMode: 'passthrough', interactive: false, chrome: false, closable: false });
    const debugView = createDungeonInteractionDebug(context.scene, labelLayer.content);
    const reasonText = (query: InteractionQuery): string => {
      const labels: Record<string, string> = { front: '正面', back: '背面', left: '左侧', right: '右侧', north: '北', east: '东', south: '南', west: '西' };
      return control.explain(query).map(row => `${row.label}：${row.side ? `玩家位于${labels[row.side] ?? row.side}${row.facing ? `（目标朝${labels[row.facing] ?? row.facing}）` : ''} → ` : ''}${router.isConsumed(query.loadId, row.onceKey) ? '本次已触发' : row.reason}`).join('\n');
    };
    const syncDebug = () => {
      const loaded = grid.current;
      debugView.setView(overhead.displayedView);
      if (!config['debug-entities'] || !loaded) { debugView.clear(); labelLayer.hide(); debugSummary.textContent = '交互实体 Debug 已关闭。'; debugSummary.dataset.count = '0'; return; }
      try {
        if (config['debug-labels']) labelLayer.show(); else labelLayer.hide();
        const captions = debugView.sync(control.describe(loaded.loadId), loaded, config.key, id => router.isConsumed(loaded.loadId, id), {
          color: config['debug-color'], labels: config['debug-labels'], name: config['debug-name'],
          trigger: config['debug-trigger'], action: config['debug-action'], state: config['debug-state'], direction: config['debug-direction'],
        });
        debugSummary.dataset.count = String(captions.length); debugSummary.textContent = captions.length ? captions.join('\n') : '当前地图没有可显示的交互实体。';
        const current = player.current;
        if (config['debug-reasons'] && current?.loadId === loaded.loadId) debugSummary.textContent += `\n\n按交互键的当前判定：\n${reasonText({ trigger: 'interact', loadId: loaded.loadId, position: { ...current.playerPosition }, facing: current.playerFacing })}`;
      } catch (error) {
        debugView.clear(); labelLayer.hide(); debugSummary.dataset.count = '0';
        debugSummary.textContent = `交互 Debug 显示失败：${error instanceof Error ? error.message : String(error)}`;
      }
    };
    const offView = overhead.subscribe(syncDebug);
    const stopDebug = context.scheduler.register({ id: 'interaction-debug', phase: 'presentation', order: 320, intervalSeconds: .05,
      description: '仅 Debug 开启时跟随交互实体的当前空间位置', run: () => { if (config['debug-entities']) syncDebug(); } });
    const offMap = context.communication.on(dungeonMapChangedEvent, ({ loadId }) => {
      resetInteractions(); router.reset(); debugView.clear(); syncDebug();
      attemptStatus.textContent = '等待移动尝试。'; delete attemptStatus.dataset.outcome;
      agentAttemptStatus.textContent = '等待 Agent 移动尝试。'; delete agentAttemptStatus.dataset.outcome;
      offContact();
      offContact = control.observeMovementContact(loadId, () => {
        for (const [actorId, rules] of contacts) {
          const current = control.movementBlockers(loadId, actorId);
          for (const [rule, blockers] of rules) {
            for (const blocker of blockers) if (!current.has(blocker)) blockers.delete(blocker);
            if (!blockers.size) rules.delete(rule);
          }
          if (!rules.size) contacts.delete(actorId);
        }
      });
    });
    const key = document.createElement('input'); key.value = config.key; key.type = 'text';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = '触发当前位置 / 前方交互'; button.dataset.dungeonInteract = '';
    button.addEventListener('click', () => interact?.());
    const render = () => {
      const state = router.inspect(); status.textContent = state.error || (state.target ? `${state.busy ? '正在处理' : '最近目标'}：${state.target}` : '等待交互。');
      status.dataset.error = String(!!state.error);
    };
    const offStatus = router.subscribe(() => { render(); syncDebug(); });
    panel.content.append(enabled.row, createLabField('交互键代码', key), button, status, attemptStatus, agentAttemptStatus, debug.row,
      ...debugControls.slice(0, 2).map(control => control.row), labelFields, legend, debugSummary);
    const playerRules = document.createElement('details');
    const playerRulesTitle = document.createElement('summary'); playerRulesTitle.textContent = '玩家角色 · 实体行动规则';
    const playerRulesInput = document.createElement('textarea'); playerRulesInput.rows = 7;
    playerRulesInput.value = JSON.stringify(config['player-action-rules'], null, 2);
    const playerRulesStatus = createLabStatus('规则跟随玩家，可用顶部保存配置。');
    const applyPlayerRules = document.createElement('button'); applyPlayerRules.type = 'button'; applyPlayerRules.textContent = '应用玩家规则';
    applyPlayerRules.addEventListener('click', () => {
      try {
        const rules = JSON.parse(playerRulesInput.value);
        if (!validPlayerRules(rules)) throw new Error('请输入有效的行动规则数组，规则 ID 必须唯一。');
        if (context.config) context.config.update('dungeon-interaction', { 'player-action-rules': rules as ConfigValue });
        else config['player-action-rules'] = rules;
        contacts.clear();
        playerRulesStatus.textContent = '玩家行动规则已应用。';
        playerRulesStatus.dataset.error = 'false';
      } catch (error) {
        playerRulesStatus.textContent = error instanceof Error ? error.message : String(error);
        playerRulesStatus.dataset.error = 'true';
      }
    });
    playerRules.append(playerRulesTitle, createLabField('规则 JSON', playerRulesInput), applyPlayerRules, playerRulesStatus);
    panel.content.append(playerRules);
    const settings = context.ui.registerSettings('dungeon-interaction', [
      controlSetting('enabled', '启用统一交互', enabled.input),
      controlSetting('key', '交互键代码', key, { valid: value => typeof value === 'string' && /^(Key[A-Z]|Enter|Space)$/.test(value) }),
      controlSetting('debug-entities', '显示交互实体 Debug', debug.input),
      ...debugControls.map(control => controlSetting(control.field, control.label, control.input)),
    ], () => {
      if (!context.config) { config.enabled = enabled.input.checked; config.key = key.value; config['debug-entities'] = debug.input.checked; }
      if (!context.config) for (const control of debugControls) config[control.field] = control.input.checked;
      notifyKeyboard();
      syncDebug();
    });
    if (!context.config) {
      enabled.input.addEventListener('change', () => { config.enabled = enabled.input.checked; notifyKeyboard(); });
      key.addEventListener('change', () => { if (/^(Key[A-Z]|Enter|Space)$/.test(key.value)) { config.key = key.value; notifyKeyboard(); } });
      debug.input.addEventListener('change', () => { config['debug-entities'] = debug.input.checked; syncDebug(); });
      for (const control of debugControls) control.input.addEventListener('change', () => { config[control.field] = control.input.checked; syncDebug(); });
    }
    return () => { settings.dispose(); offPreparation(); offMap(); offContact(); offStatus(); offView(); stopDebug(); debugView.dispose(); labelLayer.dispose();
      offActions(); keyboardListeners.clear(); resetInteractions(); router.dispose();
      context.services.delete(DUNGEON_INTERACTION_INPUTS); context.services.delete(DUNGEON_INTERACTION_SERVICE); panel.root.remove(); };
  },
};
