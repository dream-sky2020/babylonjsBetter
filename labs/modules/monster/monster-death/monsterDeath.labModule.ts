import { loadConfig } from '@/core/config/configLoader';
import { normalizeMonsterDissolveLibrary, type MonsterDissolveLibrary } from '@/core/monster/dissolve/monsterDissolve';
import { MonsterDeathController } from '@/core/monster/visual/MonsterDeathController';
import { monsterDeathRegistry, normalizeMonsterDeathParameters, type MonsterDeathPreset } from '@/core/monster-death-motion';
import type { LabModule } from '@/labs/kit';
import { MONSTER_SELECTION } from '../monsterVisual.memory';
import { MONSTER_VISUAL_SERVICE } from '../monster-visual/monsterVisual.service';
import { monsterBattlefieldChanged, monsterSelectionChanged, monsterVisualActionChanged } from '../monsterVisual.protocol';
import { createMonsterPanel, fillMonsterSelect } from '../monsterModuleUi';
import { persistMonsterState } from '../monsterModuleState';
import { createMonsterPresetLoader, normalizeMonsterActionPresets, resolveMonsterPreset } from '../monsterPresetLibrary';
import { MONSTER_DEATH_LIBRARY, MONSTER_DEATH_SETTINGS } from './monsterDeath.memory';
import { monsterDeathCommand, monsterDeathReload, monsterDeathSettingsCommand } from './monsterDeath.protocol';

export const monsterDeathLabModule: LabModule = {
  id: 'monster-death', dependencies: ['monster-visual', 'monster-battlefield'],
  setup(context) {
    const visual = context.services.get(MONSTER_VISUAL_SERVICE), uninstall = visual.runtime.installCapability(MonsterDeathController), death = visual.runtime.death;
    const offAction = visual.registerAction('death', id => id ? death.stopMonsterDeath(id) : death.stopAllDeaths());
    const library = context.memory.acquire(MONSTER_DEATH_LIBRARY), settings = context.memory.acquire(MONSTER_DEATH_SETTINGS), selection = context.memory.acquire(MONSTER_SELECTION);
    const panel = createMonsterPanel(context, 'monster-death', '怪物死亡表现');
    const preset = panel.select('死亡预设', 'death');
    const dissolveSelect = panel.select('怪物消散预设', 'death-dissolve');
    let dissolves: MonsterDissolveLibrary = {};
    let started = false;
    const render = () => {
      fillMonsterSelect(preset, Object.entries(library.current ?? {}).map(([key, item]) => [key, item.name]), settings.current.presetKey);
      fillMonsterSelect(dissolveSelect, [['', '沿用死亡预设原效果'], ...Object.entries(dissolves).map(([key, item]): [string, string] => [key, item.name])], settings.current.dissolvePresetKey ?? '');
      play.disabled = !selection.current.selectedId || !library.current?.[settings.current.presetKey];
    };
    const state = persistMonsterState(context, 'monster-death', 'settings', MONSTER_DEATH_SETTINGS, settings, () => { if (started) { visual.cancel(undefined, 'death'); render(); } });
    const loader = createMonsterPresetLoader(library, 'monsterDeathConfigs.json', '/api/monster-death-configs',
      raw => normalizeMonsterActionPresets<MonsterDeathPreset>(raw, item => { const definition = monsterDeathRegistry.get(item.modeId); return definition ? { ...item, parameters: normalizeMonsterDeathParameters(definition.parameters, item.parameters) } : null; }),
      () => { visual.cancel(undefined, 'death'); if (!library.current?.[settings.current.presetKey]) { settings.replace({ presetKey: Object.keys(library.require())[0] ?? '' }); state.changed(); } render(); });
    const reload = async () => { await loader.reload(); const raw = await loadConfig('monsterDissolvePresets.json', { devApiPath: '/api/monster-dissolve-presets', selectDevPayload: payload => { const value = payload as Record<string, unknown>; return value.data ?? value; } }); if (!started) return; dissolves = normalizeMonsterDissolveLibrary(raw); render(); };
    context.communication.handle(monsterDeathReload, reload);
    context.communication.handle(monsterDeathSettingsCommand, patch => { settings.replace({ ...settings.current, ...patch }); state.changed(); render(); });
    context.communication.handle(monsterDeathCommand, command => {
      visual.assertPlayable(command.monsterId); const motion = resolveMonsterPreset(library.current, command.presetKey);
      visual.begin(command.monsterId, 'death', done => { visual.sync(); return death.playMonsterDeath(command.monsterId, motion, done, dissolves[settings.current.dissolvePresetKey ?? '']); });
    });
    dissolveSelect.addEventListener('change', () => { settings.replace({ ...settings.current, dissolvePresetKey: dissolveSelect.value }); state.changed(); render(); });
    preset.addEventListener('change', () => void panel.run(() => context.communication.request(monsterDeathSettingsCommand, { presetKey: preset.value })));
    const play = panel.button('播放死亡', 'death', () => context.communication.request(monsterDeathCommand, { monsterId: selection.current.selectedId, presetKey: settings.current.presetKey }));
    panel.button('停止并恢复死亡效果', 'death-reset', () => { visual.cancel(selection.current.selectedId || undefined, 'death'); visual.sync(); });
    panel.button('重新读取死亡和消散预设', 'death-reload', reload);
    context.communication.on(monsterBattlefieldChanged, render); context.communication.on(monsterSelectionChanged, render);
    context.communication.on(monsterVisualActionChanged, event => { if (event.kind === 'death') { panel.status.textContent = '死亡 · ' + event.outcome; panel.status.dataset.outcome = event.outcome; } });
    return { async start() { started = true; await reload(); if (!started) return; render(); panel.root.dataset.monsterReady = 'true'; }, dispose() { started = false; offAction(); uninstall(); loader.dispose(); state.dispose(); panel.root.remove(); } };
  },
};
