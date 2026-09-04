import { createLabStatus, type LabUi } from '../labUi';
import type { LabState } from './LabState';

export const createLabStatePanel = (ui: LabUi, labState: LabState): (() => void) => {
  const panel = ui.addPanel('system-lab-state', 'LabState');
  panel.root.classList.add('lab-system-panel');
  const actions = document.createElement('div');
  actions.className = 'lab-communication-log-actions';
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.textContent = '刷新 Debug';
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.textContent = '复制存档';
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = '导出存档';
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  actions.append(refreshButton, copyButton, exportButton, importInput);
  const status = createLabStatus('尚无 LabState 注册数据。');
  const json = document.createElement('pre');
  json.className = 'lab-json';
  panel.content.append(actions, status, json);

  const render = () => {
    const inspection = labState.inspect();
    json.textContent = JSON.stringify(inspection, null, 2);
    status.textContent = `已注册 ${inspection.length} 项，其中 ${inspection.filter(({ persistent }) => persistent).length} 项进入存档。`;
  };
  const offState = labState.subscribe(render);
  refreshButton.addEventListener('click', render);
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(labState.createSnapshot(), null, 2));
      status.textContent = '当前 LabState 存档已复制。';
    } catch {
      status.textContent = '浏览器拒绝访问剪贴板，请使用导出功能。';
    }
  });
  exportButton.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(labState.createSnapshot(), null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lab-state-${new Date().toISOString().replaceAll(':', '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    status.textContent = '当前 LabState 存档已导出。';
  });
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      await labState.restore(JSON.parse(await file.text()));
      render();
      status.textContent = `已从“${file.name}”恢复 LabState。`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'LabState 存档恢复失败。';
    } finally {
      importInput.value = '';
    }
  });
  render();

  return () => {
    offState();
    panel.root.remove();
  };
};
