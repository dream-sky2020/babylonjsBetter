import { loadConfig } from '@/core/config';
import { requestMonsterLibrary, MONSTER_CONFIG_API_PATH, MONSTER_STRIPE_PRESET_API_PATH, STRIPE_PRESET_API_PATH,
  normalizeMonsterConfigLibrary, normalizeMonsterStripePresetLibrary, normalizeStripePresetLibrary } from '@/core/monster';
import { monsterMotionRegistry, normalizeMonsterMotionParameters, type MonsterMotionPresetLibrary } from '@/core/monster-motion';
import { monsterAttackRegistry, normalizeMonsterAttackParameters, type MonsterAttackPresetLibrary } from '@/core/monster-attack-motion';
import { monsterDeathRegistry, normalizeMonsterDeathParameters, type MonsterDeathPresetLibrary } from '@/core/monster-death-motion';
import type { LabModule } from '@/labs/kit';
import { MONSTER_BATTLEFIELD, MONSTER_VISUAL_LIBRARIES } from '../monsterVisual.memory';
import { monsterLibrariesChanged, monsterLibrariesReload } from '../monsterVisual.protocol';

export const monsterVisualLibrariesLabModule: LabModule = {
  id: 'monster-visual-libraries', events: [{ definition: monsterLibrariesChanged, publishes: true }],
  setup(context) {
    const memory = context.memory.acquire(MONSTER_VISUAL_LIBRARIES);
    const battlefield = context.memory.acquire(MONSTER_BATTLEFIELD);
    let revision = 0, generation = 0, disposed = false;
    const reload = async () => {
      const ticket = ++generation;
      const selectDevPayload = (payload: unknown) => (payload as { data: unknown }).data;
      const [configs, monsterStripes, stripes, movements, attacks, deaths] = await Promise.all([
        requestMonsterLibrary(MONSTER_CONFIG_API_PATH), requestMonsterLibrary(MONSTER_STRIPE_PRESET_API_PATH), requestMonsterLibrary(STRIPE_PRESET_API_PATH),
        loadConfig<MonsterMotionPresetLibrary>('monsterMovementConfigs.json', { devApiPath: '/api/monster-movement-configs', selectDevPayload: selectDevPayload as (v: unknown) => MonsterMotionPresetLibrary }),
        loadConfig<MonsterAttackPresetLibrary>('monsterAttackConfigs.json', { devApiPath: '/api/monster-attack-configs', selectDevPayload: selectDevPayload as (v: unknown) => MonsterAttackPresetLibrary }),
        loadConfig<MonsterDeathPresetLibrary>('monsterDeathConfigs.json', { devApiPath: '/api/monster-death-configs', selectDevPayload: selectDevPayload as (v: unknown) => MonsterDeathPresetLibrary }),
      ]);
      const normalizePresets = <T extends { modeId: string; parameters: Record<string, string | number | boolean> }>(
        library: Record<string, T>, normalize: (preset: T) => T | null,
      ): Record<string, T> => Object.fromEntries(Object.entries(library).flatMap(([key, preset]) => {
        const normalized = preset && typeof preset.modeId === 'string' ? normalize(preset) : null;
        return normalized ? [[key, normalized]] : [];
      }));
      const next = {
        configs: normalizeMonsterConfigLibrary(configs), monsterStripes: normalizeMonsterStripePresetLibrary(monsterStripes), stripes: normalizeStripePresetLibrary(stripes),
        movements: normalizePresets(movements, p => { const d = monsterMotionRegistry.get(p.modeId); return d ? { ...p, parameters: normalizeMonsterMotionParameters(d.parameters, p.parameters) } : null; }),
        attacks: normalizePresets(attacks, p => { const d = monsterAttackRegistry.get(p.modeId); return d ? { ...p, parameters: normalizeMonsterAttackParameters(d.parameters, p.parameters) } : null; }),
        deaths: normalizePresets(deaths, p => { const d = monsterDeathRegistry.get(p.modeId); return d ? { ...p, parameters: normalizeMonsterDeathParameters(d.parameters, p.parameters) } : null; }),
      };
      if (!Object.keys(next.configs).length) throw new Error('没有可用的怪物显示配置。');
      if (disposed || ticket !== generation) return;
      for (const monster of battlefield.current?.monsters ?? []) {
        if (!next.configs[monster.monsterConfigKey] || (monster.monsterStripePresetKey && !next.monsterStripes[monster.monsterStripePresetKey]))
          throw new Error(`新预设库缺少怪物 ${monster.id} 正在使用的配置；已保留原预设库。`);
      }
      memory.replace(next);
      await context.communication.publish(monsterLibrariesChanged, { revision: ++revision });
    };
    context.communication.handle(monsterLibrariesReload, reload);
    return { start: reload, dispose() { disposed = true; ++generation; memory.replace(null); } };
  },
};
