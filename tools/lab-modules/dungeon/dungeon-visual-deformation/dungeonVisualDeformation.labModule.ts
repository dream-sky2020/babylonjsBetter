import { DEFAULT_DEFORMATION_SETTINGS, parseDeformationSettings, selectDeformationView, type DeformationSettings, type DeformationRule } from '@/core/render-deformation/deformation.ts';
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
    let lease: ReturnType<typeof registry.acquire> | null = null;
    const panel = context.ui.addPanel('dungeon-visual-deformation', '物体变形');
    const restoreOutsideOverhead = createLabSwitch('离开俯视视角时恢复物体原形', false);
    restoreOutsideOverhead.input.dataset.deformationRestoreOutsideOverhead = '';
    const status = document.createElement('p'); status.dataset.deformationStatus = '';
    const targets = document.createElement('details'); targets.className = 'lab-deformation-targets';
    const targetSummary = document.createElement('summary');
    const targetSearch = document.createElement('input'); targetSearch.type = 'search'; targetSearch.placeholder = '按名称、分组或状态筛选';
    const targetCount = document.createElement('small'); targetCount.className = 'lab-deformation-target-count';
    const targetList = document.createElement('div'); targetList.className = 'lab-deformation-target-list';
    targets.append(targetSummary, createLabField('筛选对象', targetSearch), targetCount, targetList);
    const select = (items: [string, string][]) => {
      const input = document.createElement('select'); items.forEach(([value, label]) => input.append(new Option(label, value))); return input;
    };
    const selection = select([['all', '全部已接入对象'], ['rules', '仅匹配分组 / 手选对象']]);
    const mode = select([['automatic', '按俯角补偿'], ['manual', '手动倾斜']]);
    const numbers = new Map<string, HTMLInputElement>();
    panel.content.append(createLabField('作用范围', selection), createLabField('变形方式', mode));
    for (const [key, label, min, max, step] of [
      ['strength', '默认强度（0 原形，1 完整补偿）', 0, 1, .05], ['referencePitchDeg', '参考俯角（当前角度来自统一俯视配置）', 0, 89.99, 1],
      ['heightScale', '高度倍率', .25, 4, .05], ['shear', '手动倾斜量', -4, 4, .05],
    ] as const) {
      const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step);
      input.dataset.deformationField = key; numbers.set(key, input); panel.content.append(createLabField(label, input));
    }
    const rulesSection = document.createElement('section'); rulesSection.className = 'lab-deformation-rules';
    const rulesHeading = document.createElement('div'); rulesHeading.className = 'lab-deformation-rules-heading';
    const rulesTitle = document.createElement('strong'); rulesTitle.textContent = '匹配规则';
    const rulesCount = document.createElement('small');
    rulesHeading.append(rulesTitle, rulesCount);
    const rulesEmpty = document.createElement('p'); rulesEmpty.className = 'lab-deformation-empty';
    rulesEmpty.textContent = '当前没有规则。选择“全部已接入对象”时无需添加规则。';
    const rulesBox = document.createElement('div'); rulesBox.className = 'lab-deformation-rule-list';
    const ruleInputs: { root: HTMLDetailsElement; selector: HTMLSelectElement; value: HTMLInputElement; strength: HTMLInputElement; ordinal: HTMLElement; title: HTMLElement; amount: HTMLElement }[] = [];
    const selectorLabels: Record<DeformationRule['selector'], string> = { group: '分组', tag: '标签', kind: '类型', id: '对象 ID' };
    const refreshRuleSummaries = () => {
      rulesCount.textContent = `${ruleInputs.length} 条`;
      rulesEmpty.hidden = ruleInputs.length > 0;
      ruleInputs.forEach((entry, index) => {
        const label = selectorLabels[entry.selector.value as DeformationRule['selector']] ?? entry.selector.value;
        entry.ordinal.textContent = `#${index + 1}`;
        entry.title.textContent = `${label} · ${entry.value.value.trim() || '未填写匹配值'}`;
        entry.amount.textContent = `强度 ${entry.strength.value}`;
      });
    };
    const addRule = (rule: DeformationRule = { selector: 'group', value: '', strength: 1 }, open = false) => {
      const root = document.createElement('details'); root.className = 'lab-deformation-rule-entry'; root.open = open;
      const summary = document.createElement('summary');
      const ordinal = document.createElement('span'); ordinal.className = 'lab-deformation-rule-ordinal';
      const title = document.createElement('strong');
      const amount = document.createElement('span'); amount.className = 'lab-deformation-rule-amount';
      summary.append(ordinal, title, amount);
      const selector = select([['group', '分组'], ['tag', '标签'], ['kind', '类型'], ['id', '对象 ID']]); selector.value = rule.selector;
      const value = document.createElement('input'); value.value = rule.value; value.placeholder = '分组名 / 标签 / 稳定对象 ID';
      const strength = document.createElement('input'); strength.type = 'number'; strength.min = '0'; strength.max = '1'; strength.step = '.05'; strength.value = String(rule.strength);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除这条规则';
      const fields = document.createElement('div'); fields.className = 'lab-deformation-rule-fields';
      fields.append(createLabField('匹配方式', selector), createLabField('匹配值', value), createLabField('强度（0 排除，1 完整补偿）', strength), remove);
      const entry = { root, selector, value, strength, ordinal, title, amount }; ruleInputs.push(entry);
      remove.onclick = () => { ruleInputs.splice(ruleInputs.indexOf(entry), 1); root.remove(); refreshRuleSummaries(); };
      selector.addEventListener('change', refreshRuleSummaries);
      value.addEventListener('input', refreshRuleSummaries);
      strength.addEventListener('input', refreshRuleSummaries);
      root.append(summary, fields); rulesBox.append(root); refreshRuleSummaries();
      return root;
    };
    const add = document.createElement('button'); add.type = 'button'; add.textContent = '添加规则'; add.onclick = () => addRule(undefined, true);
    rulesSection.append(rulesHeading, rulesEmpty, rulesBox, add);
    const apply = document.createElement('button'); apply.textContent = '应用变形草稿';
    const reset = document.createElement('button'); reset.textContent = '恢复地图变形配置';
    panel.content.append(rulesSection, apply, reset, status, targets);
    const state: { draft: DeformationSettings | null } = { draft: null };
    let current = structuredClone(DEFAULT_DEFORMATION_SETTINGS);
    const applicable = () => {
      numbers.get('shear')!.disabled = mode.value !== 'manual'; numbers.get('referencePitchDeg')!.disabled = mode.value !== 'automatic';
    };
    mode.onchange = applicable;
    const syncForm = () => {
      restoreOutsideOverhead.input.checked = current.restoreOutsideOverhead;
      selection.value = current.selection; mode.value = current.config.mode;
      numbers.forEach((input, key) => { input.value = String(current.config[key as keyof typeof current.config]); });
      rulesBox.replaceChildren(); ruleInputs.length = 0; current.rules.forEach(rule => addRule(rule)); refreshRuleSummaries(); applicable();
    };
    const renderTargets = () => {
      const all = registry.list();
      targetSummary.textContent = `可选对象 · ${all.filter(target => target.supported).length} / ${all.length} 可变形`;
      if (!targets.open) { targetList.replaceChildren(); return; }
      const query = targetSearch.value.trim().toLocaleLowerCase();
      const filtered = all.filter(target => !query || `${target.label} ${target.groupId} ${target.id} ${target.status}`.toLocaleLowerCase().includes(query));
      const visible = filtered.slice(0, 50);
      targetCount.textContent = `显示 ${visible.length} / ${filtered.length} 个对象；对象规则优先于标签、分组和类型，同级后条覆盖。`;
      targetList.replaceChildren();
      for (const target of visible) {
        const row = document.createElement('div'); row.className = 'lab-deformation-target-entry';
        const label = document.createElement('div');
        const name = document.createElement('strong'); name.textContent = target.label;
        const detail = document.createElement('small'); detail.textContent = `${target.groupId} · ${target.status}`;
        label.append(name, detail);
        const button = document.createElement('button'); button.type = 'button'; button.textContent = target.persistent ? '添加规则' : '添加临时规则'; button.disabled = !target.supported;
        button.onclick = () => {
          const rule = addRule({ selector: 'id', value: target.id, strength: 1 }, true);
          selection.value = 'rules'; targets.open = false;
          rule.scrollIntoView({ block: 'nearest' });
        };
        row.append(label, button); targetList.append(row);
      }
    };
    targets.addEventListener('toggle', renderTargets);
    targetSearch.addEventListener('input', renderTargets);
    const reconcile = () => {
      try {
        current = state.draft ?? (refs.current ? readDeformationSettings(refs.current.document) : null)
          ?? { ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true };
        const deformationView = selectDeformationView(current, view.view?.config ?? null, view.configuredView?.config ?? null);
        if (!current.enabled || !deformationView) { lease?.release(); lease = null; }
        else { lease ??= registry.acquire('dungeon-visual-deformation'); lease.apply(current, deformationView); }
        status.textContent = !current.enabled ? '地图组件或测试草稿已关闭变形。'
          : !deformationView ? view.configuredView && current.restoreOutsideOverhead ? '已按设置恢复原形：当前未处于俯视视角。' : '已暂停：等待有效俯视配置。'
            : current.config.mode === 'automatic' && deformationView.projection !== 'orthographic' ? '自动补偿只在正交俯视生效；透视可选手动倾斜。'
              : `${state.draft ? '测试草稿' : '地图组件'} · ${view.view ? '当前' : '沿用配置的'}俯角 ${deformationView.pitchDeg}°。脚底固定，不重复缩放格子。`;
        syncForm();
      } catch (error) {
        lease?.release(); lease = null; status.textContent = String(error);
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
    restoreOutsideOverhead.input.addEventListener('change', () => {
      service.setDraft({ ...current, restoreOutsideOverhead: restoreOutsideOverhead.input.checked });
    });
    const unmountTransitionControl = view.mountTransitionControl(restoreOutsideOverhead.row, () => {
      if (restoreOutsideOverhead.input.checked !== current.restoreOutsideOverhead) {
        service.setDraft({ ...current, restoreOutsideOverhead: restoreOutsideOverhead.input.checked });
      }
    });
    apply.onclick = () => {
      try { service.setDraft(parseDeformationSettings({ enabled: true, restoreOutsideOverhead: restoreOutsideOverhead.input.checked, selection: selection.value,
        config: { mode: mode.value, ...Object.fromEntries([...numbers].map(([key, input]) => [key, Number(input.value)])) },
        rules: ruleInputs.map(row => ({ selector: row.selector.value, value: row.value.value, strength: Number(row.strength.value) })),
      })); } catch (error) { status.textContent = String(error); }
    };
    reset.onclick = () => service.setDraft(null);
    const offView = view.subscribe(reconcile); const offMap = context.communication.on(dungeonMapChangedEvent, reconcile);
    const offTargets = registry.subscribe(renderTargets); reconcile(); renderTargets();
    return () => {
      offView(); offMap(); offTargets(); unmountTransitionControl(); lease?.release(); registration.unregister();
      context.services.delete(DUNGEON_VISUAL_DEFORMATION_SERVICE_KEY); panel.root.remove();
    };
  },
};
