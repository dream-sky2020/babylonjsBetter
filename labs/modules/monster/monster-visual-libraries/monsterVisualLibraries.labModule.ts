import { requestMonsterLibrary, MONSTER_CONFIG_API_PATH, MONSTER_STRIPE_PRESET_API_PATH, STRIPE_PRESET_API_PATH,
  normalizeMonsterConfigLibrary, normalizeMonsterStripePresetLibrary, normalizeStripePresetLibrary } from '@/core/monster';
import type { LabModule } from '@/labs/kit';
import { MONSTER_VISUAL_LIBRARIES } from '../monsterVisual.memory';
import { monsterLibrariesChanged, monsterLibrariesReload, monsterLibrariesValidate } from '../monsterVisual.protocol';
import { createMonsterPanel } from '../monsterModuleUi';

export const monsterVisualLibrariesLabModule: LabModule = {
  id: 'monster-visual-libraries', events: [{ definition: monsterLibrariesChanged, publishes: true }],
  setup(context) {
    const memory = context.memory.acquire(MONSTER_VISUAL_LIBRARIES);
    const panel = createMonsterPanel(context, 'monster-visual-libraries', '怪物外观资源');
    let revision = 0, generation = 0, disposed = false;
    const reload = async () => {
      const ticket = ++generation;
      const [configs, monsterStripes, stripes] = await Promise.all([
        requestMonsterLibrary(MONSTER_CONFIG_API_PATH), requestMonsterLibrary(MONSTER_STRIPE_PRESET_API_PATH), requestMonsterLibrary(STRIPE_PRESET_API_PATH),
      ]);
      const next = { configs: normalizeMonsterConfigLibrary(configs), monsterStripes: normalizeMonsterStripePresetLibrary(monsterStripes), stripes: normalizeStripePresetLibrary(stripes) };
      if (!Object.keys(next.configs).length) throw new Error('没有可用的怪物显示配置。');
      if (disposed || ticket !== generation) return;
      if (context.communication.hasHandler(monsterLibrariesValidate)) await context.communication.request(monsterLibrariesValidate, next);
      if (disposed || ticket !== generation) return;
      memory.replace(next);
      await context.communication.publish(monsterLibrariesChanged, { revision: ++revision });
      panel.status.textContent = Object.keys(next.configs).length + ' 个外观，' + Object.keys(next.monsterStripes).length + ' 个怪物条纹预设。';
    };
    panel.button('重新读取外观与条纹', 'reload', reload);
    context.communication.handle(monsterLibrariesReload, reload);
    return { start: reload, dispose() { disposed = true; ++generation; memory.replace(null); panel.root.remove(); } };
  },
};
