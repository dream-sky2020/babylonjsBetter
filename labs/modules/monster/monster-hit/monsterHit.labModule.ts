import { Color3 } from '@babylonjs/core';
import { MonsterHitController } from '@/core/monster/visual/MonsterHitController';
import type { LabModule } from '@/labs/kit';
import { createLabField } from '@/labs/kit';
import { MONSTER_SELECTION } from '../monsterVisual.memory';
import { MONSTER_VISUAL_SERVICE } from '../monster-visual/monsterVisual.service';
import { monsterBattlefieldChanged, monsterSelectionChanged, monsterVisualActionChanged } from '../monsterVisual.protocol';
import { createMonsterPanel } from '../monsterModuleUi';
import { persistMonsterState } from '../monsterModuleState';
import { MONSTER_HIT_SETTINGS } from './monsterHit.memory';
import { monsterHitCommand, monsterHitSettingsCommand } from './monsterHit.protocol';

export const monsterHitLabModule: LabModule = {
  id: 'monster-hit', dependencies: ['monster-visual', 'monster-battlefield'],
  setup(context) {
    const visual = context.services.get(MONSTER_VISUAL_SERVICE), uninstall = visual.runtime.installCapability(MonsterHitController), hit = visual.runtime.hit;
    const offAction = visual.registerAction('hit', id => id ? hit.stopMonsterHit(id) : hit.stopAllHits());
    const settings = context.memory.acquire(MONSTER_HIT_SETTINGS), selection = context.memory.acquire(MONSTER_SELECTION);
    const panel = createMonsterPanel(context, 'monster-hit', '怪物受击表现');
    const duration = panel.number('持续时间（毫秒）', 'hit-duration', 1, 60000, 10), amplitude = panel.number('抖动幅度', 'hit-amplitude', 0, 100, .01);
    const frequency = panel.number('抖动频率', 'hit-frequency', 0, 200, 1), strength = panel.number('叠加强度', 'hit-strength', 0, 1, .05);
    const color = document.createElement('input'); color.type = 'color'; color.dataset.monsterControl = 'hit-color'; panel.append(createLabField('受击颜色', color));
    let started = false;
    const render = () => {
      const value = settings.current; duration.value = String(value.durationMs); amplitude.value = String(value.shakeAmplitude);
      frequency.value = String(value.shakeFrequency); strength.value = String(value.overlayStrength); color.value = value.color;
      play.disabled = !selection.current.selectedId;
    };
    const state = persistMonsterState(context, 'monster-hit', 'settings', MONSTER_HIT_SETTINGS, settings, () => { if (started) { visual.cancel(undefined, 'hit'); render(); } });
    context.communication.handle(monsterHitSettingsCommand, patch => { settings.replace({ ...settings.current, ...patch }); state.changed(); render(); });
    context.communication.handle(monsterHitCommand, command => {
      visual.assertPlayable(command.monsterId);
      visual.begin(command.monsterId, 'hit', done => { visual.sync(); return hit.playMonsterHit(command.monsterId,
        { ...settings.current, color: Color3.FromHexString(settings.current.color) }, done); });
    });
    const saveInputs = () => context.communication.request(monsterHitSettingsCommand, { durationMs: Number(duration.value), shakeAmplitude: Number(amplitude.value),
      shakeFrequency: Number(frequency.value), overlayStrength: Number(strength.value), color: color.value });
    for (const input of [duration, amplitude, frequency, strength, color]) input.addEventListener('change', () => void panel.run(saveInputs));
    const play = panel.button('播放受击', 'hit', async () => { await saveInputs(); await context.communication.request(monsterHitCommand, { monsterId: selection.current.selectedId }); });
    panel.button('停止并恢复受击', 'hit-reset', () => { visual.cancel(selection.current.selectedId || undefined, 'hit'); visual.sync(); });
    context.communication.on(monsterBattlefieldChanged, render); context.communication.on(monsterSelectionChanged, render);
    context.communication.on(monsterVisualActionChanged, event => { if (event.kind === 'hit') { panel.status.textContent = '受击 · ' + event.outcome; panel.status.dataset.outcome = event.outcome; } });
    return { start() { started = true; render(); }, dispose() { started = false; offAction(); uninstall(); state.dispose(); panel.root.remove(); } };
  },
};
