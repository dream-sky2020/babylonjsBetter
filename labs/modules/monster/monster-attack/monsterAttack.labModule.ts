import { Vector3 } from '@babylonjs/core';
import { MonsterAttackController } from '@/core/monster/visual/MonsterAttackController';
import { monsterAttackRegistry, normalizeMonsterAttackParameters, type MonsterAttackPreset } from '@/core/monster-attack-motion';
import type { LabModule } from '@/labs/kit';
import { MONSTER_SELECTION } from '../monsterVisual.memory';
import { MONSTER_VISUAL_SERVICE } from '../monster-visual/monsterVisual.service';
import { monsterBattlefieldChanged, monsterSelectionChanged, monsterVisualActionChanged } from '../monsterVisual.protocol';
import { createMonsterPanel, fillMonsterSelect } from '../monsterModuleUi';
import { persistMonsterState, monsterNumber } from '../monsterModuleState';
import { createMonsterPresetLoader, normalizeMonsterActionPresets, resolveMonsterPreset } from '../monsterPresetLibrary';
import { MONSTER_ATTACK_LIBRARY, MONSTER_ATTACK_SETTINGS } from './monsterAttack.memory';
import { monsterAttackCommand, monsterAttackReload, monsterAttackSettingsCommand } from './monsterAttack.protocol';

export const monsterAttackLabModule: LabModule = {
  id: 'monster-attack', dependencies: ['monster-visual', 'monster-battlefield'],
  setup(context) {
    const visual = context.services.get(MONSTER_VISUAL_SERVICE), uninstall = visual.runtime.installCapability(MonsterAttackController), attack = visual.runtime.attack;
    const offAction = visual.registerAction('attack', id => id ? attack.stopMonsterAttack(id) : attack.stopAllAttacks());
    const library = context.memory.acquire(MONSTER_ATTACK_LIBRARY), settings = context.memory.acquire(MONSTER_ATTACK_SETTINGS), selection = context.memory.acquire(MONSTER_SELECTION);
    const panel = createMonsterPanel(context, 'monster-attack', '怪物攻击表现');
    const preset = panel.select('攻击预设', 'attack'), x = panel.number('攻击方向 X', 'attack-x', -1000, 1000, .1), z = panel.number('攻击方向 Z', 'attack-z', -1000, 1000, .1);
    let started = false;
    const render = () => {
      fillMonsterSelect(preset, Object.entries(library.current ?? {}).map(([key, item]) => [key, item.name]), settings.current.presetKey);
      x.value = String(settings.current.directionX); z.value = String(settings.current.directionZ);
      play.disabled = !selection.current.selectedId || !library.current?.[settings.current.presetKey];
    };
    const state = persistMonsterState(context, 'monster-attack', 'settings', MONSTER_ATTACK_SETTINGS, settings, () => { if (started) { visual.cancel(undefined, 'attack'); render(); } });
    const loader = createMonsterPresetLoader(library, 'monsterAttackConfigs.json', '/api/monster-attack-configs',
      raw => normalizeMonsterActionPresets<MonsterAttackPreset>(raw, item => { const definition = monsterAttackRegistry.get(item.modeId); return definition ? { ...item, parameters: normalizeMonsterAttackParameters(definition.parameters, item.parameters) } : null; }),
      () => { visual.cancel(undefined, 'attack'); if (!library.current?.[settings.current.presetKey]) { settings.replace({ ...settings.current, presetKey: Object.keys(library.require())[0] ?? '' }); state.changed(); } render(); });
    context.communication.handle(monsterAttackReload, loader.reload);
    context.communication.handle(monsterAttackSettingsCommand, patch => { settings.replace({ ...settings.current, ...patch }); state.changed(); render(); });
    context.communication.handle(monsterAttackCommand, command => {
      visual.assertPlayable(command.monsterId); const motion = resolveMonsterPreset(library.current, command.presetKey);
      const dx = command.directionX ?? settings.current.directionX, dz = command.directionZ ?? settings.current.directionZ;
      if (!monsterNumber(dx, -1000, 1000) || !monsterNumber(dz, -1000, 1000)) throw new Error('攻击方向无效。');
      visual.begin(command.monsterId, 'attack', done => { visual.sync(); return attack.playMonsterAttack(command.monsterId, motion, new Vector3(dx, 0, dz), done); });
    });
    const saveInputs = () => context.communication.request(monsterAttackSettingsCommand, { presetKey: preset.value, directionX: Number(x.value), directionZ: Number(z.value) });
    for (const input of [preset, x, z]) input.addEventListener('change', () => void panel.run(saveInputs));
    const play = panel.button('播放攻击', 'attack', async () => { await saveInputs(); await context.communication.request(monsterAttackCommand, { monsterId: selection.current.selectedId, ...settings.current }); });
    panel.button('停止并恢复攻击', 'attack-reset', () => { visual.cancel(selection.current.selectedId || undefined, 'attack'); visual.sync(); });
    panel.button('重新读取攻击预设', 'attack-reload', loader.reload);
    context.communication.on(monsterBattlefieldChanged, render); context.communication.on(monsterSelectionChanged, render);
    context.communication.on(monsterVisualActionChanged, event => { if (event.kind === 'attack') { panel.status.textContent = '攻击 · ' + event.outcome; panel.status.dataset.outcome = event.outcome; } });
    return { async start() { started = true; await loader.reload(); render(); }, dispose() { started = false; offAction(); uninstall(); loader.dispose(); state.dispose(); panel.root.remove(); } };
  },
};
