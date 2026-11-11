import { controlSetting, createLabField, createLabStatus, type LabUi } from '@/labs/kit/labUi';
import type { DialogueConfig } from './dialogue.config';
import type { DialogueManager } from './dialogue.service';
import type { getDialogueUiOptions } from '@/core/dialogue-preview/dialogueUiCompatibility';

export type DialogueCatalogEntry = { key: string; name: string; entries: { id: string; name: string }[] };
type UiOptionsProvider = (preset: string, entry: string) => ReturnType<typeof getDialogueUiOptions>;
/** Authoring/testing only. Removing this adapter does not remove the dialogue service. */
export function mountDialoguePanel(ui: LabUi, manager: DialogueManager, config: DialogueConfig,
  updateConfig: (patch: Partial<DialogueConfig>) => void) {
  const panel = ui.addPanel('dialogue', '对话管理');
  const preset = document.createElement('select'), entry = document.createElement('select'), uiPreset = document.createElement('select');
  uiPreset.add(new Option(config['ui-preset'], config['ui-preset']));
  uiPreset.disabled = true;
  const start = document.createElement('button'); start.type = 'button'; start.textContent = '开始测试对话'; start.dataset.dialogueTest = '';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '结束当前对话'; cancel.dataset.dialogueStop = '';
  const actions = document.createElement('div'); actions.className = 'lab-module-actions'; actions.append(start, cancel);
  const status = createLabStatus('正在读取对话预设……'); status.dataset.dialogueStatus = '';
  const hint = createLabStatus('Enter / 空格继续，数字键选择，Esc 结束。地牢动作需从地图中的对话入口启动。');
  panel.content.append(createLabField('对话预设', preset), createLabField('入口节点', entry), createLabField('UI 预设', uiPreset), actions, status, hint);
  let catalog: readonly DialogueCatalogEntry[] = [], getUiOptions: UiOptionsProvider | undefined;
  let uiIssue = '';
  const fillEntries = () => {
    const selected = catalog.find(item => item.key === config.preset);
    entry.replaceChildren(...(selected?.entries ?? []).map(item => new Option(`${item.name} · ${item.id}`, item.id)));
    entry.value = config.entry;
  };
  const render = () => {
    const state = manager.inspect();
    start.disabled = !getUiOptions || !!uiIssue || state.busy; cancel.disabled = !state.busy;
    const labels = { idle: '等待开始', loading: '正在准备对话', playing: '对话进行中', ended: '对话已结束', cancelled: '对话已取消', error: '无法开始对话' };
    const selectionError = !state.busy && uiIssue;
    status.textContent = selectionError || state.error || (state.waiting ? '等待事件' : `${labels[state.status]}${state.playback?.status === 'playing' ? ` · ${state.playback.speaker || '旁白'}` : ''}`);
    status.dataset.error = String(!!selectionError || state.status === 'error');
  };
  const fillUiPresets = () => {
    if (!getUiOptions) return;
    const options = getUiOptions(config.preset, config.entry);
    const selected = options.find(option => option.key === config['ui-preset']);
    uiIssue = selected ? selected.issues.join('；') : `UI 预设不存在：${config['ui-preset']}`;
    uiPreset.replaceChildren(...options.map(({ key, name, issues }) => {
      const option = new Option(`${name} · ${key}${issues.length ? `（${issues.join('；')}）` : ''}`, key);
      option.disabled = !!issues.length;
      return option;
    }));
    if (!selected) {
      const option = new Option(`${config['ui-preset']}（不存在）`, config['ui-preset']);
      option.disabled = true;
      uiPreset.add(option);
    }
    uiPreset.value = config['ui-preset'];
    uiPreset.disabled = !options.some(option => !option.issues.length);
  };
  start.addEventListener('click', () => { void manager.start().catch(() => {}); });
  cancel.addEventListener('click', () => manager.cancel());
  preset.addEventListener('change', () => {
    updateConfig({ preset: preset.value });
    const selected = catalog.find(item => item.key === preset.value);
    if (selected && !selected.entries.some(item => item.id === config.entry)) updateConfig({ entry: selected.entries[0]?.id ?? config.entry });
    fillEntries(); fillUiPresets(); render();
  });
  entry.addEventListener('change', () => { updateConfig({ entry: entry.value }); fillUiPresets(); render(); });
  uiPreset.addEventListener('change', () => { if (uiPreset.value.trim()) updateConfig({ 'ui-preset': uiPreset.value }); fillUiPresets(); render(); });
  const valid = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 256;
  const binding = ui.registerSettings('dialogue', [
    controlSetting('preset', '对话预设', preset, { read: () => preset.value || config.preset, valid }),
    controlSetting('entry', '入口节点', entry, { read: () => entry.value || config.entry, valid }),
    controlSetting('ui-preset', 'UI 预设', uiPreset, { read: () => uiPreset.value || config['ui-preset'], valid }),
  ], () => { fillEntries(); fillUiPresets(); render(); });
  const off = manager.subscribe(render); render();
  return {
    setCatalog(next: readonly DialogueCatalogEntry[], uiOptions: UiOptionsProvider) {
      catalog = next; getUiOptions = uiOptions;
      preset.replaceChildren(...catalog.map(item => new Option(`${item.name} · ${item.key}`, item.key)));
      preset.value = config.preset; fillEntries(); fillUiPresets(); render();
    },
    dispose() { binding.dispose(); off(); panel.root.remove(); },
  };
}
