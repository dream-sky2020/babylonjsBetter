import { createLabField, createLabStatus, type LabUi } from '../labUi';
import type { LabState } from './LabState';

export const createLabStatePanel = (ui: LabUi, labState: LabState) => {
  const labId = labState.checkpointLabId;
  const panel = ui.addPanel('system-lab-state', labId ? 'Lab 存档' : 'LabState');
  panel.root.classList.add('lab-system-panel');
  const actions = document.createElement('div');
  const directoryControls = document.createElement('div');
  directoryControls.className = 'lab-save-directory-controls';
  directoryControls.style.display = 'grid';
  directoryControls.style.gap = '8px';
  actions.className = 'lab-communication-log-actions';
  const button = (label: string, action?: string) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = label;
    if (action) node.dataset.labCheckpoint = action;
    return node;
  };
  const save = button('快速保存', 'save');
  const load = button('快速读取', 'load');
  const copy = button('复制存档');
  const exportFile = button('导出 JSON', 'export');
  const refresh = button('刷新 Debug');
  if (labId) actions.append(save, load);
  actions.append(exportFile, copy, refresh);
  const importFile = document.createElement('input');
  importFile.type = 'file';
  importFile.accept = 'application/json,.json';
  importFile.setAttribute('aria-label', '导入存档');
  importFile.dataset.labCheckpoint = 'import';
  const status = createLabStatus(labId ? '快速存档在刷新或关闭页面后清空。' : '');
  status.setAttribute('role', 'status');
  status.dataset.labCheckpoint = 'status';
  const summary = createLabStatus('');
  const json = document.createElement('pre');
  json.className = 'lab-json';
  panel.content.append(directoryControls, actions, createLabField('导入 JSON', importFile), status, summary, json);

  const render = () => {
    const inspection = labState.inspect();
    json.textContent = JSON.stringify(inspection, null, 2);
    summary.textContent = `已注册 ${inspection.length} 项，其中 ${inspection.filter(({ persistent }) => persistent).length} 项进入存档。`;
  };
  let busy = false;
  let hasQuickSave = false;
  const syncActions = () => {
    save.disabled = copy.disabled = exportFile.disabled = importFile.disabled = busy;
    load.disabled = busy || !hasQuickSave;
  };
  const run = async (message: string, action: () => Promise<string>) => {
    if (busy) return;
    busy = true;
    syncActions();
    status.textContent = message;
    try { status.textContent = await action(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : '存档操作失败。'; }
    finally { busy = false; syncActions(); }
  };
  const capture = async () => labId ? labState.captureCheckpoint() : labState.createSnapshot();
  const offState = labState.subscribe(render);
  refresh.addEventListener('click', render);
  save.addEventListener('click', () => void run('正在等待可保存的检查点……', async () => {
    const time = await labState.quickSave();
    hasQuickSave = true;
    return `已快速保存 · ${new Date(time).toLocaleTimeString()}`;
  }));
  load.addEventListener('click', () => void run('正在读取快速存档……', async () => {
    await labState.quickLoad();
    return '已恢复快速存档。';
  }));
  copy.addEventListener('click', () => void run('正在生成存档……', async () => {
    const snapshot = await capture();
    try { await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2)); }
    catch { throw new Error('无法访问剪贴板，请使用导出功能。'); }
    return '当前 Lab 存档已复制。';
  }));
  exportFile.addEventListener('click', () => void run('正在生成存档……', async () => {
    const snapshot = await capture();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${labId ?? 'lab-state'}-${snapshot.createdAt.replaceAll(':', '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return '当前 Lab 存档已导出。';
  }));
  importFile.addEventListener('change', () => {
    const file = importFile.files?.[0];
    if (!file) return;
    importFile.value = '';
    void run('正在校验存档……', async () => {
      const snapshot: unknown = JSON.parse(await file.text());
      if (labId) await labState.restoreCheckpoint(snapshot);
      else await labState.restore(snapshot);
      return `已从“${file.name}”恢复存档。`;
    });
  });
  syncActions();
  render();

  return {
    directoryControls,
    dispose() { offState(); panel.root.remove(); },
  };
};
