import { controlSetting, createLabField, createLabStatus, type LabUi } from '@/labs/kit/labUi';
import type { DialogueConfig } from './dialogue.config';
import type { DialogueManager } from './dialogue.service';

export type DialogueCatalogEntry = { key: string; name: string; entries: { id: string; name: string }[] };
/** Authoring/testing only. Removing this adapter does not remove the dialogue service. */
export function mountDialoguePanel(ui: LabUi, manager: DialogueManager, config: DialogueConfig,
  updateConfig: (patch: Partial<DialogueConfig>) => void) {
  const panel = ui.addPanel('dialogue', '对话管理');
  const preset = document.createElement('select'), entry = document.createElement('select'), uiPreset = document.createElement('input');
  uiPreset.type = 'text'; uiPreset.value = config['ui-preset'];
  const start = document.createElement('button'); start.type = 'button'; start.textContent = '开始测试对话'; start.dataset.dialogueTest = '';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '结束当前对话'; cancel.dataset.dialogueStop = '';
  const actions = document.createElement('div'); actions.className = 'lab-module-actions'; actions.append(start, cancel);
  const status = createLabStatus('正在读取对话预设……'); status.dataset.dialogueStatus = '';
  const hint = createLabStatus('对白和选项测试。Enter / 空格继续，数字键选择，Esc 结束；条件与剧情事件尚未接入。');
  panel.content.append(createLabField('对话预设', preset), createLabField('入口节点', entry), createLabField('UI 预设', uiPreset), actions, status, hint);
  let catalog: readonly DialogueCatalogEntry[] = [], ready = false;
  const fillEntries = () => {
    const selected = catalog.find(item => item.key === config.preset);
    entry.replaceChildren(...(selected?.entries ?? []).map(item => new Option(`${item.name} · ${item.id}`, item.id)));
    entry.value = config.entry;
  };
  const render = () => {
    const state = manager.inspect();
    start.disabled = !ready || state.busy; cancel.disabled = !state.busy;
    const labels = { idle: '等待开始', loading: '正在准备对话', playing: '对话进行中', ended: '对话已结束', cancelled: '对话已取消', error: '无法开始对话' };
    status.textContent = state.error || `${labels[state.status]}${state.playback?.status === 'playing' ? ` · ${state.playback.speaker || '旁白'}` : ''}`;
    status.dataset.error = String(state.status === 'error');
  };
  start.addEventListener('click', () => { void manager.start().catch(() => {}); });
  cancel.addEventListener('click', () => manager.cancel());
  preset.addEventListener('change', () => {
    updateConfig({ preset: preset.value });
    const selected = catalog.find(item => item.key === preset.value);
    if (selected && !selected.entries.some(item => item.id === config.entry)) updateConfig({ entry: selected.entries[0]?.id ?? config.entry });
    fillEntries();
  });
  entry.addEventListener('change', () => updateConfig({ entry: entry.value }));
  uiPreset.addEventListener('change', () => { if (uiPreset.value.trim()) updateConfig({ 'ui-preset': uiPreset.value }); });
  const valid = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 256;
  const binding = ui.registerSettings('dialogue', [
    controlSetting('preset', '对话预设', preset, { read: () => preset.value || config.preset, valid }),
    controlSetting('entry', '入口节点', entry, { read: () => entry.value || config.entry, valid }),
    controlSetting('ui-preset', 'UI 预设', uiPreset, { valid }),
  ], () => { fillEntries(); render(); });
  const off = manager.subscribe(render); render();
  return {
    setCatalog(next: readonly DialogueCatalogEntry[]) {
      catalog = next; ready = true;
      preset.replaceChildren(...catalog.map(item => new Option(`${item.name} · ${item.key}`, item.key)));
      preset.value = config.preset; fillEntries(); render();
    },
    dispose() { binding.dispose(); off(); panel.root.remove(); },
  };
}
