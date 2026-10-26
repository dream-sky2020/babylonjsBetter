import { createLabField, type LabModule } from '@/labs/kit';
import { MonsterDistanceStripeRules, normalizeDistanceStripeRuleConfig } from '@/core/monster/visual/MonsterDistanceStripeRules';
import { MONSTER_VISUAL_SERVICE } from '../monster-visual/monsterVisual.service';
import { MONSTER_BATTLEFIELD, MONSTER_VISUAL_LIBRARIES } from '../monsterVisual.memory';
import { monsterBattlefieldChanged, monsterLibrariesChanged } from '../monsterVisual.protocol';
import { createMonsterPanel, fillMonsterSelect } from '../monsterModuleUi';
import { persistMonsterState, monsterRecord } from '../monsterModuleState';
import { createMonsterPresetLoader } from '../monsterPresetLibrary';
import { MONSTER_DISTANCE_STRIPE_LIBRARY, MONSTER_DISTANCE_STRIPE_SETTINGS } from './monsterDistanceStripes.memory';
import { monsterDistanceStripeReload, monsterDistanceStripeSettingsCommand } from './monsterDistanceStripes.protocol';

export const monsterDistanceStripesLabModule: LabModule = {
  id: 'monster-distance-stripes', dependencies: ['monster-visual', 'monster-battlefield', 'monster-visual-libraries'],
  setup(context) {
    const visual = context.services.get(MONSTER_VISUAL_SERVICE), uninstall = visual.runtime.installCapability(MonsterDistanceStripeRules);
    const settings = context.memory.acquire(MONSTER_DISTANCE_STRIPE_SETTINGS), library = context.memory.acquire(MONSTER_DISTANCE_STRIPE_LIBRARY);
    const field = context.memory.acquire(MONSTER_BATTLEFIELD), resources = context.memory.acquire(MONSTER_VISUAL_LIBRARIES);
    const panel = createMonsterPanel(context, 'monster-distance-stripes', '怪物距离条纹规则');
    const enabled = panel.toggle('启用按行距离条纹', 'distance-enabled'), preset = panel.select('规则预设', 'distance-preset');
    const list = document.createElement('div'); panel.append(list);
    let started = false;
    const apply = () => {
      visual.runtime.distanceStripes.clear();
      if (settings.current.enabled && field.current) visual.runtime.distanceStripes.setDistanceStripeRules({ battlefieldId: field.current.id, name: '当前测试规则', rules: settings.current.rules });
      visual.sync();
    };
    const render = () => {
      enabled.checked = settings.current.enabled;
      fillMonsterSelect(preset, Object.entries(library.current ?? {}).map(([key, item]) => [key, item.name]), settings.current.presetKey);
      list.replaceChildren();
      settings.current.rules.forEach((rule, index) => {
        const row = document.createElement('input'); row.type = 'number'; row.min = '1'; row.max = '101'; row.step = '1'; row.value = String(rule.startRow);
        const stripe = document.createElement('select'); fillMonsterSelect(stripe, Object.entries(resources.current?.monsterStripes ?? {}).map(([key, item]) => [key, item.name]), rule.monsterStripePresetKey);
        const change = () => panel.run(() => context.communication.request(monsterDistanceStripeSettingsCommand, { rules: settings.current.rules.map(item => item.id === rule.id ? { ...item, startRow: Number(row.value), monsterStripePresetKey: stripe.value } : item) }));
        row.addEventListener('change', () => void change()); stripe.addEventListener('change', () => void change());
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除规则';
        remove.addEventListener('click', () => void panel.run(() => context.communication.request(monsterDistanceStripeSettingsCommand, { rules: settings.current.rules.filter(item => item.id !== rule.id) })));
        list.append(createLabField('规则 ' + (index + 1) + '：起始行（从 1 开始）', row), createLabField('怪物条纹', stripe), remove);
      });
    };
    const state = persistMonsterState(context, 'monster-distance-stripes', 'settings', MONSTER_DISTANCE_STRIPE_SETTINGS, settings, () => { if (started) { apply(); render(); } });
    const loader = createMonsterPresetLoader(library, 'monsterBattlefieldStripeRules.json', '/api/monster-battlefield-stripe-rules', raw => {
      if (!monsterRecord(raw)) throw new Error('距离条纹规则库无效。');
      return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, normalizeDistanceStripeRuleConfig(key, value as Parameters<typeof normalizeDistanceStripeRuleConfig>[1])]));
    }, () => {
      if (!settings.current.presetKey) {
        const key = Object.keys(library.require())[0] ?? '';
        settings.replace({ ...settings.current, presetKey: key, rules: structuredClone(library.require()[key]?.rules ?? []) }); state.changed();
      }
      apply(); render();
    });
    context.communication.handle(monsterDistanceStripeSettingsCommand, patch => {
      const next = { ...settings.current, ...patch };
      if (patch.presetKey !== undefined && patch.rules === undefined) {
        const chosen = library.current?.[patch.presetKey]; if (!chosen) throw new Error('距离条纹预设不存在。'); next.rules = structuredClone(chosen.rules);
      }
      if (next.enabled && next.rules.some(rule => !resources.require().monsterStripes[rule.monsterStripePresetKey])) throw new Error('规则引用的怪物条纹预设不存在。');
      settings.replace(next); state.changed(); apply(); render();
    });
    context.communication.handle(monsterDistanceStripeReload, loader.reload);
    enabled.addEventListener('change', () => void panel.run(() => context.communication.request(monsterDistanceStripeSettingsCommand, { enabled: enabled.checked })));
    preset.addEventListener('change', () => void panel.run(() => context.communication.request(monsterDistanceStripeSettingsCommand, { presetKey: preset.value })));
    panel.button('添加距离规则', 'distance-add', () => {
      const key = Object.keys(resources.require().monsterStripes)[0]; if (!key) throw new Error('没有可用的怪物条纹预设。');
      return context.communication.request(monsterDistanceStripeSettingsCommand, { rules: [...settings.current.rules, { id: crypto.randomUUID(), startRow: 1, monsterStripePresetKey: key }] });
    });
    panel.button('重新读取距离规则预设', 'distance-reload', loader.reload);
    context.communication.on(monsterBattlefieldChanged, apply); context.communication.on(monsterLibrariesChanged, () => { apply(); render(); });
    return { async start() { started = true; await loader.reload(); apply(); render(); }, dispose() { started = false; uninstall(); loader.dispose(); state.dispose(); panel.root.remove(); } };
  },
};
