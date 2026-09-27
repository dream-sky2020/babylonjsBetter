import { DEFAULT_DEFORMATION_SETTINGS, parseDeformationSettings, type DeformationSettings, type DeformationRule } from '@/core/render-deformation/deformation.ts';
import { readDeformationSettings } from '@/core/render-deformation/deformation.document.ts';
import { getVisualDeformationRegistry } from '@/core/render-deformation/visualDeformationRegistry.ts';
import { createLabField, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import { DUNGEON_OVERHEAD_VIEW_SERVICE_KEY, type DungeonOverheadViewService } from '../dungeon-overhead-view/dungeonOverheadView.references';
import { DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY, type DungeonMapLoaderReferences } from '../dungeon-map-loader/dungeonMapLoader.references';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';

export const DUNGEON_VISUAL_DEFORMATION_SERVICE_KEY = 'dungeon:visual-deformation';
export type DungeonVisualDeformationService = { setDraft(settings: DeformationSettings | null): void; readonly settings: DeformationSettings };
export const dungeonVisualDeformationLabModule: LabModule = {
  id: 'dungeon-visual-deformation', dependencies: ['dungeon-overhead-view', 'dungeon-map-loader'],
  setup(context) {
    const view = context.services.get<DungeonOverheadViewService>(DUNGEON_OVERHEAD_VIEW_SERVICE_KEY);
    const refs = context.services.get<DungeonMapLoaderReferences>(DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY);
    const registry = getVisualDeformationRegistry(context.scene);
    const lease = registry.acquire('dungeon-visual-deformation');
    const panel = context.ui.addPanel('dungeon-visual-deformation', '显示变形 · 批量控制');
    const enabled = createLabSwitch('启用物体倾斜与高度补偿', false);
    const status = document.createElement('p'); status.dataset.deformationStatus = '';
    const targets = document.createElement('div');
    const select = (items: [string, string][]) => {
      const input = document.createElement('select'); items.forEach(([value, label]) => input.append(new Option(label, value))); return input;
    };
    const selection = select([['all', '全部已接入对象'], ['rules', '仅匹配分组 / 手选对象']]);
    const mode = select([['automatic', '按俯角补偿'], ['manual', '手动倾斜']]);
    const numbers = new Map<string, HTMLInputElement>();
    panel.content.append(enabled.row, createLabField('作用范围', selection), createLabField('变形方式', mode));
    for (const [key, label, min, max, step] of [
      ['strength', '默认强度（0 原形，1 完整补偿）', 0, 1, .05], ['referencePitchDeg', '参考俯角（当前角度来自统一俯视配置）', 0, 89.99, 1],
      ['heightScale', '高度倍率', .25, 4, .05], ['shear', '手动倾斜量', -4, 4, .05],
    ] as const) {
      const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step);
      input.dataset.deformationField = key; numbers.set(key, input); panel.content.append(createLabField(label, input));
    }
    const rulesBox = document.createElement('div');
    const ruleInputs: { root: HTMLElement; selector: HTMLSelectElement; value: HTMLInputElement; strength: HTMLInputElement }[] = [];
    const addRule = (rule: DeformationRule = { selector: 'group', value: '', strength: 1 }) => {
      const root = document.createElement('div'); root.className = 'lab-field';
      const selector = select([['group', '分组'], ['tag', '标签'], ['kind', '类型'], ['id', '对象 ID']]); selector.value = rule.selector;
      const value = document.createElement('input'); value.value = rule.value; value.placeholder = '分组名 / 标签 / 稳定对象 ID';
      const strength = document.createElement('input'); strength.type = 'number'; strength.min = '0'; strength.max = '1'; strength.step = '.05'; strength.value = String(rule.strength);
      const remove = document.createElement('button'); remove.textContent = '删除规则';
      const entry = { root, selector, value, strength }; ruleInputs.push(entry);
      remove.onclick = () => { ruleInputs.splice(ruleInputs.indexOf(entry), 1); root.remove(); };
      root.append(selector, value, strength, remove); rulesBox.append(root);
    };
    const add = document.createElement('button'); add.textContent = '添加分组规则'; add.onclick = () => addRule();
    const apply = document.createElement('button'); apply.textContent = '应用变形草稿';
    const reset = document.createElement('button'); reset.textContent = '恢复地图变形配置';
    panel.content.append(rulesBox, add, apply, reset, status, targets);
    const state: { draft: DeformationSettings | null } = { draft: null };
    let current = structuredClone(DEFAULT_DEFORMATION_SETTINGS);
    const applicable = () => {
      numbers.get('shear')!.disabled = mode.value !== 'manual'; numbers.get('referencePitchDeg')!.disabled = mode.value !== 'automatic';
    };
    mode.onchange = applicable;
    const syncForm = () => {
      enabled.input.checked = current.enabled; selection.value = current.selection; mode.value = current.config.mode;
      numbers.forEach((input, key) => { input.value = String(current.config[key as keyof typeof current.config]); });
      rulesBox.replaceChildren(); ruleInputs.length = 0; current.rules.forEach(addRule); applicable();
    };
    const renderTargets = () => {
      targets.replaceChildren();
      const all = registry.list();
      const summary = document.createElement('p'); summary.textContent = `已接入 ${all.filter(t => t.supported).length} / ${all.length}；对象覆盖优先于标签、分组和类型，同级后条覆盖。`;
      targets.append(summary);
      for (const target of all) {
        const row = document.createElement('div'); row.className = 'lab-field';
        const label = document.createElement('span'); label.textContent = `${target.label} · ${target.groupId} · ${target.status}`;
        const button = document.createElement('button'); button.textContent = target.persistent ? '添加此对象规则' : '添加临时对象规则（不保存）'; button.disabled = !target.supported;
        button.onclick = () => { addRule({ selector: 'id', value: target.id, strength: 1 }); selection.value = 'rules'; };
        row.append(label, button); targets.append(row);
      }
    };
    const reconcile = () => {
      try {
        current = state.draft ?? (refs.current ? readDeformationSettings(refs.current.document) : null) ?? structuredClone(DEFAULT_DEFORMATION_SETTINGS);
        lease.apply(current, view.view?.config ?? null);
        status.textContent = !current.enabled ? '已恢复原形。' : !view.view ? '已暂停：等待有效俯视配置，或当前为第一人称。'
          : current.config.mode === 'automatic' && view.view.config.projection !== 'orthographic' ? '自动补偿只在正交俯视生效；透视可选手动倾斜。'
            : `${state.draft ? '测试草稿' : '地图组件'} · 当前俯角 ${view.view.config.pitchDeg}°。脚底固定，不重复缩放格子。`;
        syncForm();
      } catch (error) {
        lease.apply(structuredClone(DEFAULT_DEFORMATION_SETTINGS), null); status.textContent = String(error);
      }
    };
    const registration = context.labState.registerReference({ moduleId: 'dungeon-visual-deformation', key: 'settings', version: 1, value: state,
      inspect: value => ({ draft: value.draft }), save: {
        serialize: value => ({ draft: value.draft ? { ...value.draft, rules: value.draft.rules.filter(r => r.selector !== 'id' || !r.value.startsWith('runtime:')) } : null }),
        validate: (value, version) => {
          if (version !== 1 || !value || typeof value !== 'object' || !('draft' in value)) throw new Error('变形快照格式无效');
          return { draft: value.draft === null ? null : parseDeformationSettings(value.draft) };
        }, restore: (value, saved) => { value.draft = saved.draft; }, afterRestore: reconcile,
      },
    });
    const service: DungeonVisualDeformationService = {
      get settings() { return structuredClone(current); },
      setDraft(settings) { state.draft = settings === null ? null : parseDeformationSettings(settings); reconcile(); registration.markChanged(); },
    };
    context.services.set(DUNGEON_VISUAL_DEFORMATION_SERVICE_KEY, service);
    apply.onclick = () => {
      try { service.setDraft(parseDeformationSettings({ enabled: enabled.input.checked, selection: selection.value,
        config: { mode: mode.value, ...Object.fromEntries([...numbers].map(([key, input]) => [key, Number(input.value)])) },
        rules: ruleInputs.map(row => ({ selector: row.selector.value, value: row.value.value, strength: Number(row.strength.value) })),
      })); } catch (error) { status.textContent = String(error); }
    };
    reset.onclick = () => service.setDraft(null);
    const offView = view.subscribe(reconcile); const offMap = context.communication.on(dungeonMapChangedEvent, reconcile);
    const offTargets = registry.subscribe(renderTargets); reconcile(); renderTargets();
    return () => {
      offView(); offMap(); offTargets(); lease.release(); registration.unregister();
      context.services.delete(DUNGEON_VISUAL_DEFORMATION_SERVICE_KEY); panel.root.remove();
    };
  },
};
