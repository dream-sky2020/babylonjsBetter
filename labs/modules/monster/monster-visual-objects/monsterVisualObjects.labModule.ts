import type { LabModule, LabStateJsonValue } from '@/labs/kit';
import { createLabField, createLabSwitch } from '@/labs/kit';
import type { LabObjectHistory, LabObjectRegistration } from '@/labs/kit/objects/LabObjects';
import { requestMonsterLibrary, MONSTER_CONFIG_API_PATH, MONSTER_STRIPE_PRESET_API_PATH, STRIPE_PRESET_API_PATH } from '@/core/monster/api/monsterApi';
import { normalizeMonsterConfigLibrary, normalizeMonsterStripePresetLibrary, normalizeStripePresetLibrary, MONSTER_LAYER_KEYS } from '@/core/monster/config/monsterConfig';
import type { MonsterLayerKey } from '@/core/monster/types/monster.types';
import type { MonsterVisualResources } from '@/core/monster/visual/monsterVisual.types';
import { createMonsterPanel, fillMonsterSelect } from '../monsterModuleUi';
import { MonsterVisualObjects } from './MonsterVisualObjects';
import { MONSTER_VISUAL_OBJECTS } from './monsterVisualObjects.service';
import { MonsterVisualObjectsDraft, createMonsterVisualObject, emptyMonsterVisualDocument, validateMonsterVisualDocument, MONSTER_LAYER_LABELS, type MonsterVisualObject } from './monsterVisualObjects.model';

const STORAGE_KEY = 'monster-visual-objects.document.v1';
export const monsterVisualObjectsLabModule: LabModule = {
  id: 'monster-visual-objects',
  manifest: { kind: 'system', responsibility: '创建、管理和编辑四层怪物视觉对象；持有对象文档、属性、历史及本机保存',
    core: [{ path: 'core/monster/render/createLayeredMonster.ts', symbols: 'createLayeredMonster', purpose: '纯四层精灵渲染与稳定图层父节点' }],
    services: ['monster.visual-objects'], protocols: ['Host 对象树、变换及领域属性接口'], scheduling: 'presentation / 200 只推进视觉材质时间，无战场或动作能力' },
  setup(context) {
    const storageKey = location.pathname.endsWith('/monster-visual-lab/index.html') ? STORAGE_KEY : `${STORAGE_KEY}:${location.pathname}`;
    const panel = createMonsterPanel(context, 'monster-visual-objects', '怪物视觉对象');
    const source = panel.select('创建使用的外观', 'object-source');
    let resources: MonsterVisualResources | null = null, binding: MonsterVisualObjects | null = null, registration: LabObjectRegistration | undefined;
    let activeId: string | null = null, disposed = false, restored = false, time = 0;
    const inspectors = new Set<() => void>();
    context.services.set(MONSTER_VISUAL_OBJECTS, {
      selected() {
        const record = context.objects?.getSelected();
        if (record?.ownerId !== 'monster-visual-objects') return null;
        const object = draft.value.objects.find(item => item.id === record.id.split('/')[0]);
        return object ? { id: object.id, name: object.name } : null;
      },
      target: id => binding?.target(id) ?? null,
      subscribe: listener => context.objects?.subscribe(listener) ?? (() => {}),
      refresh: () => registration?.refresh(),
    });
    const draft = new MonsterVisualObjectsDraft(emptyMonsterVisualDocument(), () => {
      if (disposed) return;
      binding?.sync(); registration?.refresh(); state.markChanged(); render(); for (const refresh of inspectors) refresh();
    });
    const history: LabObjectHistory = { label: '怪物视觉对象文档', canUndo: () => draft.history.canUndo, canRedo: () => draft.history.canRedo, dirty: () => draft.dirty,
      undo: () => draft.history.undo(), redo: () => draft.history.redo(), saveLabel: '保存到本机',
      save() { localStorage.setItem(storageKey, JSON.stringify(draft.value)); draft.markSaved(); },
    };
    const state = context.labState.registerReference({ moduleId: 'monster-visual-objects', key: 'document', version: 1, value: draft,
      inspect: value => structuredClone(value.value) as unknown as LabStateJsonValue,
      save: { serialize: value => structuredClone(value.value) as unknown as LabStateJsonValue,
        validate(value, version) { if (version !== 1) throw new Error('怪物视觉文档版本无效。'); return validateMonsterVisualDocument(value) as unknown as LabStateJsonValue; },
        restore(value, saved) { restored = true; value.replace(saved); },
      },
    });
    const selected = () => draft.value.objects.find(object => object.id === activeId);
    const add = panel.button('创建怪物对象', 'object-add', () => {
      const config = resources?.configs[source.value]; if (!config) throw new Error('请先选择可用外观。');
      const object = createMonsterVisualObject(source.value, config, crypto.randomUUID());
      draft.history.set({ ...draft.value, objects: [...draft.value.objects, object] }); activeId = object.id; registration?.select(object.id); render();
    });
    const duplicate = panel.button('复制选中怪物', 'object-duplicate', () => {
      const current = selected(); if (!current) return;
      const object = structuredClone(current); object.id = crypto.randomUUID(); object.name += ' 副本'; object.transform.position.x += 3;
      draft.history.set({ ...draft.value, objects: [...draft.value.objects, object] }); activeId = object.id; registration?.select(object.id); render();
    });
    const remove = panel.button('删除选中怪物', 'object-remove', () => {
      if (!selected()) return;
      draft.history.set({ ...draft.value, objects: draft.value.objects.filter(object => object.id !== activeId) }); activeId = null; render();
    });
    const undo = panel.button('撤销对象修改', 'object-undo', history.undo), redo = panel.button('重做对象修改', 'object-redo', history.redo);
    const save = panel.button('保存到本机', 'object-save', history.save!);
    panel.button('导出对象 JSON', 'object-export', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(draft.value, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'monster-visual-objects.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true; panel.append(file);
    panel.button('导入对象 JSON', 'object-import', () => file.click());
    file.addEventListener('change', () => void panel.run(async () => {
      try { const selectedFile = file.files?.[0]; if (!selectedFile) return; const document = validateMonsterVisualDocument(JSON.parse(await selectedFile.text()));
        if (disposed) return; draft.history.set(document); registration?.select(document.objects[0]?.id ?? null);
      } finally { file.value = ''; }
    }));
    const help = document.createElement('p'); help.textContent = '在左侧选择怪物或图层，右侧编辑变换与视觉属性。保存到本机可在刷新后恢复；JSON 可用于迁移对象。'; panel.append(help);
    const render = () => {
      source.disabled = add.disabled = !resources;
      duplicate.disabled = remove.disabled = !selected();
      undo.disabled = !history.canUndo(); redo.disabled = !history.canRedo(); save.disabled = !draft.dirty;
      panel.status.textContent = `${draft.value.objects.length} 个怪物视觉对象 · ${draft.dirty ? '有未保存修改' : '已保存到本机或初始状态'}`;
    };
    const mountInspector = (id: string, layer?: MonsterLayerKey) => (element: HTMLElement) => {
      activeId = id; render();
      const fields: Array<(object: MonsterVisualObject) => void> = [];
      const run = (work: () => void) => void panel.run(work);
      const heading = document.createElement('strong'); heading.textContent = layer ? `${MONSTER_LAYER_LABELS[layer]} · 视觉属性` : '怪物视觉属性'; element.append(heading);
      const text = (label: string, key: string, read: (object: MonsterVisualObject) => string, write: (object: MonsterVisualObject, value: string) => void) => {
        const input = document.createElement('input'); input.type = 'text'; input.dataset.monsterProperty = key;
        element.append(createLabField(label, input)); input.addEventListener('change', () => run(() => draft.update(id, object => write(object, input.value))));
        fields.push(object => { if (document.activeElement !== input) input.value = read(object); }); return input;
      };
      const select = (label: string, key: string, entries: Array<[string, string]>, read: (object: MonsterVisualObject) => string, write: (object: MonsterVisualObject, value: string) => void) => {
        const input = document.createElement('select'); input.dataset.monsterProperty = key;
        element.append(createLabField(label, input)); input.addEventListener('change', () => run(() => draft.update(id, object => write(object, input.value))));
        fields.push(object => { const value = read(object); fillMonsterSelect(input, entries.some(([key]) => key === value) ? entries : [...entries, [value, `${value}（文档值）`]], value); }); return input;
      };
      if (!layer) {
        text('对象名称', 'name', object => object.name, (object, value) => { object.name = value; });
        const visible = createLabSwitch('显示怪物对象'); visible.input.dataset.monsterProperty = 'visible'; element.append(visible.row);
        visible.input.addEventListener('change', () => run(() => draft.update(id, object => { object.visible = visible.input.checked; })));
        fields.push(object => { visible.input.checked = object.visible; });
        select('外观预设（应用到此对象）', 'config', Object.entries(resources!.configs).map(([key, value]) => [key, value.name]), object => object.configKey,
          (object, value) => { object.configKey = value; object.config = structuredClone(resources!.configs[value]!); });
        for (const [key, label, min, step] of [ ['scaleSize', '外观尺寸', 1, 1], ['scene3dScale', '外观倍率', .01, .1], ['scene3dHeight', '外观内部高度', -100000, .1], ['scene3dOffsetX', '外观内部水平偏移', -100000, .1] ] as const) {
          const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.step = String(step); input.dataset.monsterProperty = key;
          element.append(createLabField(label, input));
          input.addEventListener('change', () => run(() => { const value = Number(input.value); if (input.value === '' || !Number.isFinite(value) || value < min) throw new Error('视觉参数数值无效。'); draft.update(id, object => { object.config[key] = value; }); }));
          fields.push(object => { if (document.activeElement !== input) input.value = String(object.config[key]); });
        }
        select('精灵面向轴', 'facing', [['+Z', '+Z'], ['-Z', '-Z']], object => object.config.spriteFacingAxis, (object, value) => { object.config.spriteFacingAxis = value as '+Z' | '-Z'; });
        select('视觉条纹样式', 'stripe', [['', '原始精灵图'], ...Object.entries(resources!.monsterStripes).map(([key, value]): [string, string] => [key, value.name])],
          object => object.config.monsterStripePresetKey, (object, value) => { object.config.monsterStripePresetKey = value; });
      }
      for (const key of layer ? [layer] : MONSTER_LAYER_KEYS) {
        text(`${MONSTER_LAYER_LABELS[key]}图片`, `path-${key}`, object => object.config.layers[key].path, (object, value) => { object.config.layers[key].path = value.trim(); });
        const visible = createLabSwitch(`显示${MONSTER_LAYER_LABELS[key]}`); visible.input.dataset.monsterProperty = `visible-${key}`;
        element.append(visible.row); visible.input.addEventListener('change', () => run(() => draft.update(id, object => { object.layers[key].visible = visible.input.checked; })));
        fields.push(object => { visible.input.checked = object.layers[key].visible; });
      }
      const note = document.createElement('small'); note.textContent = layer ? '变换相对于怪物视觉空间；图片留空可移除此层精灵。' : '整体变换与外观内部参数分别保存。此处修改仅属于该对象。'; element.append(note);
      const refresh = () => { const object = draft.value.objects.find(item => item.id === id); if (object) fields.forEach(update => update(object)); };
      inspectors.add(refresh); refresh();
      return () => { inspectors.delete(refresh); element.replaceChildren(); if (activeId === id) activeId = null; render(); };
    };
    const stop = context.scheduler.register({ id: 'monster-visual-objects-time', phase: 'presentation', order: 200, description: '怪物视觉材质时间',
      run(dt) { if (!context.scheduler.isPaused) { time += dt; binding?.update(time); } } });
    render();
    return {
      async start() {
        const [configs, monsterStripes, stripes] = await Promise.all([requestMonsterLibrary(MONSTER_CONFIG_API_PATH), requestMonsterLibrary(MONSTER_STRIPE_PRESET_API_PATH), requestMonsterLibrary(STRIPE_PRESET_API_PATH)]);
        if (disposed) return;
        resources = { configs: normalizeMonsterConfigLibrary(configs), monsterStripes: normalizeMonsterStripePresetLibrary(monsterStripes), stripes: normalizeStripePresetLibrary(stripes) };
        const entries = Object.entries(resources.configs); if (!entries.length) throw new Error('没有可用的怪物视觉资源。');
        fillMonsterSelect(source, entries.map(([key, value]) => [key, value.name]), entries[0]![0]);
        let warning = '';
        if (!restored) {
          try { const saved = localStorage.getItem(storageKey); if (saved) { draft.replace(JSON.parse(saved), true); restored = true; } }
          catch (error) { warning = `本机文档读取失败：${error instanceof Error ? error.message : String(error)}`; }
          if (!restored) draft.replace({ ...emptyMonsterVisualDocument(), objects: [createMonsterVisualObject(entries[0]![0], entries[0]![1], crypto.randomUUID())] }, true);
        }
        binding = new MonsterVisualObjects(context.scene, draft, resources, history, mountInspector); binding.sync();
        registration = context.objects?.register({ id: 'monster-visual-objects', label: '怪物视觉对象', objects: binding.objects, roots: binding.roots,
          onSelect(id) { activeId = id?.split('/')[0] ?? null; render(); } });
        registration?.select(draft.value.objects[0]?.id ?? null); render();
        panel.root.dataset.monsterReady = 'true'; if (warning) { panel.status.textContent = warning; panel.status.dataset.error = 'true'; }
      },
      dispose() { disposed = true; stop(); registration?.dispose(); binding?.dispose(); state.unregister(); inspectors.clear(); panel.root.remove(); },
    };
  },
};
