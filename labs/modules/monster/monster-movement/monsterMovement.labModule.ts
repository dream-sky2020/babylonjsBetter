import { MonsterMovementController } from '@/core/monster/visual/MonsterMovementController';
import { monsterMotionRegistry, normalizeMonsterMotionParameters, type MonsterMotionPreset } from '@/core/monster-motion';
import type { LabModule } from '@/labs/kit';
import { MONSTER_BATTLEFIELD, MONSTER_SELECTION } from '../monsterVisual.memory';
import { validateMonsterBattlefield } from '../monsterBattlefield.model';
import { MONSTER_VISUAL_SERVICE } from '../monster-visual/monsterVisual.service';
import { MONSTER_BATTLEFIELD_SERVICE } from '../monster-battlefield/monsterBattlefield.service';
import { monsterBattlefieldChanged, monsterSelectionChanged, monsterVisualActionChanged } from '../monsterVisual.protocol';
import { createMonsterPanel, fillMonsterSelect } from '../monsterModuleUi';
import { persistMonsterState } from '../monsterModuleState';
import { createMonsterPresetLoader, normalizeMonsterActionPresets, resolveMonsterPreset } from '../monsterPresetLibrary';
import { MONSTER_MOVEMENT_LIBRARY, MONSTER_MOVEMENT_SETTINGS } from './monsterMovement.memory';
import { monsterMovementCommand, monsterMovementReload, monsterMovementSettingsCommand } from './monsterMovement.protocol';

export const monsterMovementLabModule: LabModule = {
  id: 'monster-movement', dependencies: ['monster-visual', 'monster-battlefield'],
  setup(context) {
    const visual = context.services.get(MONSTER_VISUAL_SERVICE), writer = context.services.get(MONSTER_BATTLEFIELD_SERVICE);
    const uninstall = visual.runtime.installCapability(MonsterMovementController), movement = visual.runtime.movement;
    const offAction = visual.registerAction('move', id => id ? movement.stopMonsterMovement(id) : movement.stopAllMovements());
    const library = context.memory.acquire(MONSTER_MOVEMENT_LIBRARY), settings = context.memory.acquire(MONSTER_MOVEMENT_SETTINGS);
    const field = context.memory.acquire(MONSTER_BATTLEFIELD), selection = context.memory.acquire(MONSTER_SELECTION);
    const panel = createMonsterPanel(context, 'monster-movement', '怪物移动表现');
    const preset = panel.select('移动预设', 'movement'), row = panel.number('目标行', 'move-row', 0, 100, 1), column = panel.number('目标列', 'move-column', 0, 31, 1);
    let started = false;
    const render = () => {
      fillMonsterSelect(preset, Object.entries(library.current ?? {}).map(([key, item]) => [key, item.name]), settings.current.presetKey);
      row.value = String(settings.current.row); column.value = String(settings.current.column); column.max = String((field.current?.width ?? 32) - 1);
      play.disabled = !selection.current.selectedId || !library.current?.[settings.current.presetKey];
    };
    const state = persistMonsterState(context, 'monster-movement', 'settings', MONSTER_MOVEMENT_SETTINGS, settings, () => { if (started) { visual.cancel(undefined, 'move'); render(); } });
    const loader = createMonsterPresetLoader(library, 'monsterMovementConfigs.json', '/api/monster-movement-configs',
      raw => normalizeMonsterActionPresets<MonsterMotionPreset>(raw, item => { const definition = monsterMotionRegistry.get(item.modeId); return definition ? { ...item, parameters: normalizeMonsterMotionParameters(definition.parameters, item.parameters) } : null; }),
      () => { visual.cancel(undefined, 'move'); if (!library.current?.[settings.current.presetKey]) { settings.replace({ ...settings.current, presetKey: Object.keys(library.require())[0] ?? '' }); state.changed(); } render(); });
    context.communication.handle(monsterMovementReload, loader.reload);
    context.communication.handle(monsterMovementSettingsCommand, patch => { settings.replace({ ...settings.current, ...patch }); state.changed(); render(); });
    context.communication.handle(monsterMovementCommand, async command => {
      visual.assertPlayable(command.monsterId);
      const motion = resolveMonsterPreset(library.current, command.presetKey), next = structuredClone(field.require());
      const monster = next.monsters.find(item => item.id === command.monsterId)!;
      monster.position.row = command.row; monster.position.column = command.column; validateMonsterBattlefield(next);
      visual.begin(monster.id, 'move', done => movement.moveMonster(next, monster, motion, done));
      try { await writer.commitMove(next, monster.id); } catch (error) { visual.cancel(monster.id, 'move'); visual.sync(); throw error; }
    });
    const saveInputs = () => context.communication.request(monsterMovementSettingsCommand, { presetKey: preset.value, row: Number(row.value), column: Number(column.value) });
    for (const input of [preset, row, column]) input.addEventListener('change', () => void panel.run(saveInputs));
    const play = panel.button('移动到目标行列', 'move', async () => { await saveInputs(); await context.communication.request(monsterMovementCommand, { monsterId: selection.current.selectedId, ...settings.current }); });
    panel.button('停止并恢复移动', 'move-reset', () => { visual.cancel(selection.current.selectedId || undefined, 'move'); visual.sync(); });
    panel.button('重新读取移动预设', 'move-reload', loader.reload);
    context.communication.on(monsterBattlefieldChanged, render); context.communication.on(monsterSelectionChanged, render);
    context.communication.on(monsterVisualActionChanged, event => { if (event.kind === 'move') { panel.status.textContent = '移动 · ' + event.outcome; panel.status.dataset.outcome = event.outcome; } });
    return { async start() { started = true; await loader.reload(); render(); }, dispose() { started = false; offAction(); uninstall(); loader.dispose(); state.dispose(); panel.root.remove(); } };
  },
};
