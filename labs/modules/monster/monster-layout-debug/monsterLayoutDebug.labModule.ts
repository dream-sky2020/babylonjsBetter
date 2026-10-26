import type { LabModule } from '@/labs/kit';
import { MonsterLayoutHelpers } from '@/core/monster/visual/MonsterLayoutHelpers';
import { MONSTER_VISUAL_SERVICE } from '../monster-visual/monsterVisual.service';
import { createMonsterPanel } from '../monsterModuleUi';
import { persistMonsterState } from '../monsterModuleState';
import { MONSTER_LAYOUT_SETTINGS } from './monsterLayoutDebug.memory';
import { monsterLayoutSettingsCommand } from './monsterLayoutDebug.protocol';

export const monsterLayoutDebugLabModule: LabModule = {
  id: 'monster-layout-debug', dependencies: ['monster-visual'],
  setup(context) {
    const visual = context.services.get(MONSTER_VISUAL_SERVICE), uninstall = visual.runtime.installCapability(MonsterLayoutHelpers);
    const settings = context.memory.acquire(MONSTER_LAYOUT_SETTINGS);
    visual.runtime.layout.setHelpersVisible(false);
    const panel = createMonsterPanel(context, 'monster-layout-debug', '怪物布局辅助显示');
    const visible = panel.toggle('显示编队网格、占位与选择标记', 'layout-visible');
    const apply = () => { visual.runtime.layout.setHelpersVisible(settings.current.visible); visible.checked = settings.current.visible; visual.sync(); };
    const state = persistMonsterState(context, 'monster-layout-debug', 'settings', MONSTER_LAYOUT_SETTINGS, settings, apply);
    context.communication.handle(monsterLayoutSettingsCommand, command => { settings.replace({ ...command }); state.changed(); apply(); });
    visible.addEventListener('change', () => void panel.run(() => context.communication.request(monsterLayoutSettingsCommand, { visible: visible.checked })));
    return { start: apply, dispose() { uninstall(); state.dispose(); panel.root.remove(); } };
  },
};
