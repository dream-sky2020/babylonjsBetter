import type { LabModule, LabStateJsonValue } from '@/labs/kit';
import { createLabField } from '@/labs/kit';
import { loadConfig } from '@/core/config/configLoader';
import { normalizeMonsterDissolveLibrary, type MonsterDissolveLibrary } from '@/core/monster/dissolve/monsterDissolve';
import { MONSTER_VISUAL_OBJECTS } from '../monster-visual-objects/monsterVisualObjects.service';
import { createMonsterPanel, fillMonsterSelect } from '../monsterModuleUi';
import { MonsterDissolvePreview } from './MonsterDissolvePreview';

export const monsterDissolvePreviewLabModule: LabModule = {
  id: 'monster-dissolve-preview', dependencies: ['monster-visual-objects'],
  manifest: { kind: 'system', responsibility: '对选中的怪物播放独立 Lab 消散预设，身体与线稿消散，底部两层渐隐',
    core: [{ path: 'core/sprite/dissolve/createSpriteNoiseErodeOptions.ts', symbols: 'createSpriteNoiseErodeOptions', purpose: '复用独立怪物消散 Lab 的参数转换' },
      { path: 'core/effects/sprite-death/particles/createSpriteDeathParticles.ts', symbols: 'createSpriteDeathParticles', purpose: '复用同一消散粒子' }],
    services: ['消费 monster.visual-objects'], protocols: ['当前 Host 选择；消散预设只读'], scheduling: 'presentation / 210；不持有独立渲染循环' },
  setup(context) {
    const objects = context.services.get(MONSTER_VISUAL_OBJECTS), preview = new MonsterDissolvePreview(context.scene, objects);
    const panel = createMonsterPanel(context, 'monster-dissolve-preview', '怪物消散测试');
    const selected = document.createElement('strong'); selected.dataset.monsterDissolveSelected = ''; panel.append(selected);
    const presets = panel.select('消散效果', 'dissolve-preset');
    let library: MonsterDissolveLibrary = {}, disposed = false, ready = false;
    const settings = { presetKey: '' };
    const current = () => library[settings.presetKey];
    const selectedId = () => { const selected = objects.selected(); if (!selected) throw new Error('请在对象树或画面中选中怪物或其图层。'); return selected.id; };
    const play = panel.button('对选中怪物播放', 'dissolve-play', () => { const preset = current(); if (!preset) throw new Error('请选择可用的消散效果。'); preview.play(selectedId(), preset); render(); });
    const restore = panel.button('恢复选中怪物', 'dissolve-reset', () => { preview.reset(selectedId()); render(); });
    const restoreAll = panel.button('恢复全部测试对象', 'dissolve-reset-all', () => { preview.resetAll(); render(); });
    const progress = document.createElement('input'); progress.type = 'range'; progress.min = '0'; progress.max = '1'; progress.step = '.001'; progress.value = '0'; progress.dataset.monsterControl = 'dissolve-progress'; panel.append(createLabField('预览进度', progress));
    progress.addEventListener('input', () => void panel.run(() => { const preset = current(); if (preset) preview.scrub(selectedId(), preset, progress.valueAsNumber); render(); }));
    const progressNumber = document.createElement('input'); progressNumber.type = 'number'; progressNumber.min = '0'; progressNumber.max = '100'; progressNumber.step = '0.1'; progressNumber.dataset.monsterControl = 'dissolve-progress-number'; panel.append(createLabField('消散进度（%）', progressNumber));
    progressNumber.addEventListener('change', () => void panel.run(() => { const preset = current(); if (preset && Number.isFinite(progressNumber.valueAsNumber)) preview.scrub(selectedId(), preset, progressNumber.valueAsNumber / 100); render(); }));
    const note = document.createElement('small'); note.textContent = '复用独立怪物消散 Lab 的预设和粒子。底部两层根据消散预设渐隐。恢复后回到对象原有显隐。测试进度不写入对象文档。'; panel.append(note);
    const state = context.labState.registerReference({ moduleId: 'monster-dissolve-preview', key: 'settings', version: 1, value: settings,
      inspect: value => ({ ...value }), save: { serialize: value => ({ ...value }),
        validate(saved, version) { const value = saved as { presetKey?: unknown }; if (version !== 1 || !value || typeof value.presetKey !== 'string' || (ready && value.presetKey && !library[value.presetKey])) throw new Error('消散测试预设选择无效。'); return { presetKey: value.presetKey } as LabStateJsonValue; },
        restore(value, saved) { value.presetKey = (saved as { presetKey: string }).presetKey; preview.resetAll(); if (ready) render(); },
      } });
    presets.addEventListener('change', () => { settings.presetKey = presets.value; state.markChanged(); render(); });
    const render = () => {
      if (disposed) return;
      const object = objects.selected(), active = object ? preview.status(object.id) : null, preset = current();
      selected.textContent = object ? `当前怪物：${object.name}` : '请选择怪物视觉对象或其图层'; selected.dataset.monsterDissolveSelected = object?.id ?? '';
      presets.disabled = !ready; if (ready) presets.value = settings.presetKey;
      play.disabled = !ready || !object || !preset; restore.disabled = !object || !active;
      restoreAll.disabled = !ready; progress.disabled = !ready || !object || !preset; progress.value = String(active?.progress ?? 0); progressNumber.disabled = progress.disabled; if (document.activeElement !== progressNumber) progressNumber.value = String(Math.round((active?.progress ?? 0) * 1000) / 10);
      panel.root.dataset.dissolveProgress = String(active?.progress ?? 0); panel.root.dataset.dissolvePlaying = String(active?.playing ?? false);
      panel.status.textContent = active ? `${active.presetName} · ${active.playing ? '播放中' : active.progress >= 1 ? '播放完成' : '手动预览'} · ${Math.round(active.progress * 100)}%`
        : preset ? `${Object.keys(library).length} 个消散预设 · ${preset.duration} 秒` : '正在加载消散预设…';
    };
    const offSelection = objects.subscribe(() => { preview.prune(); render(); });
    let uiTime = 0;
    const stop = context.scheduler.register({ id: 'monster-dissolve-preview-update', phase: 'presentation', order: 210, description: '推进身体与线稿的消散预览',
      run(dt) { if (context.scheduler.isPaused) return; preview.update(dt); uiTime += dt; if (uiTime >= .05) { uiTime = 0; render(); } } });
    const pauseObserver = context.scene.onBeforeRenderObservable.add(() => preview.setPaused(context.scheduler.isPaused));
    render();
    return { async start() {
      const raw = await loadConfig('monsterDissolvePresets.json', { devApiPath: '/api/monster-dissolve-presets', selectDevPayload: payload => {
        const value = payload as Record<string, unknown>; return value.data ?? value;
      } });
      if (disposed) return;
      library = normalizeMonsterDissolveLibrary(raw);
      if (!Object.keys(library).length) library = normalizeMonsterDissolveLibrary(await loadConfig('spriteAshPresets.json'));
      if (disposed) return;
      if (!Object.keys(library).length) throw new Error('没有可用的怪物消散预设。');
      if (!library[settings.presetKey]) settings.presetKey = Object.keys(library)[0]!;
      fillMonsterSelect(presets, Object.entries(library).map(([key, preset]) => [key, preset.name]), settings.presetKey);
      ready = true; state.markChanged(); render(); panel.root.dataset.monsterReady = 'true';
    }, dispose() { disposed = true; offSelection(); stop(); context.scene.onBeforeRenderObservable.remove(pauseObserver); preview.dispose(); state.unregister(); panel.root.remove(); } };
  },
};
