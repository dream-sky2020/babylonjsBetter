import type {
  LabCommunicationJournalReader,
  LabCommunicationLogEntry,
  LabCommunicationLogStatus,
} from './labCommunicationJournal';
import { createLabField, createLabStatus, type LabUi } from './labUi';

const PHASE_LABELS: Record<LabCommunicationLogEntry['phase'], string> = {
  'request-started': '请求开始',
  'request-completed': '请求完成',
  'request-failed': '请求失败',
  'event-published': '事件发布',
  'event-completed': '事件完成',
  'event-listener-failed': '监听失败',
};

const STATUS_LABELS: Record<LabCommunicationLogStatus, string> = {
  pending: '处理中',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
  timeout: '超时',
};

const formatTime = (timestamp: number): string => new Date(timestamp).toLocaleTimeString('zh-CN', {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
});

const createEntryElement = (entry: LabCommunicationLogEntry): HTMLElement => {
  const details = document.createElement('details');
  details.className = 'lab-communication-log-entry';
  details.dataset.status = entry.status;
  const summary = document.createElement('summary');
  const sequence = document.createElement('span');
  sequence.className = 'lab-communication-log-sequence';
  sequence.textContent = `#${entry.sequence}`;
  const type = document.createElement('strong');
  type.textContent = entry.type;
  const phase = document.createElement('span');
  phase.className = 'lab-communication-log-phase';
  phase.textContent = PHASE_LABELS[entry.phase];
  const status = document.createElement('span');
  status.className = 'lab-communication-log-status';
  status.textContent = STATUS_LABELS[entry.status];
  const time = document.createElement('time');
  time.textContent = formatTime(entry.timestamp);
  summary.append(sequence, type, phase, status, time);
  const route = document.createElement('div');
  route.className = 'lab-communication-log-route';
  route.textContent = entry.targetModuleId
    ? `${entry.sourceModuleId} → ${entry.targetModuleId}`
    : entry.sourceModuleId;
  const json = document.createElement('pre');
  json.className = 'lab-json lab-communication-log-json';
  json.textContent = JSON.stringify(entry, null, 2);
  details.append(summary, route, json);
  return details;
};

/** 为每个组合式 Lab 安装必备的通信日志 UI。 */
export const createLabCommunicationLogPanel = (
  ui: LabUi,
  journal: LabCommunicationJournalReader,
): (() => void) => {
  const panel = ui.addPanel('system-communication-log', `通信日志 · 最近 ${journal.capacity} 条`);
  panel.root.classList.add('lab-system-panel');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = '按协议或模块筛选';
  const filter = document.createElement('select');
  filter.append(...[
    ['all', '全部通信'],
    ['request', '仅请求'],
    ['event', '仅事件'],
    ['problem', '仅失败/超时'],
  ].map(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }));
  const actions = document.createElement('div');
  actions.className = 'lab-communication-log-actions';
  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.textContent = '清空';
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.textContent = '复制 JSON';
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = '导出 JSON';
  actions.append(clearButton, copyButton, exportButton);
  const status = createLabStatus('尚无通信记录。');
  const list = document.createElement('div');
  list.className = 'lab-communication-log-list';
  panel.content.append(
    createLabField('筛选', search),
    createLabField('类型', filter),
    actions,
    status,
    list,
  );

  let renderFrame: number | null = null;
  const render = () => {
    renderFrame = null;
    const query = search.value.trim().toLocaleLowerCase();
    const mode = filter.value;
    const allEntries = journal.getEntries();
    const entries = allEntries.filter((entry) => {
      if (mode === 'request' && entry.kind !== 'request') return false;
      if (mode === 'event' && entry.kind !== 'event') return false;
      if (mode === 'problem' && !['failed', 'timeout', 'cancelled'].includes(entry.status)) return false;
      if (!query) return true;
      return `${entry.type} ${entry.sourceModuleId} ${entry.targetModuleId ?? ''} ${entry.phase}`
        .toLocaleLowerCase().includes(query);
    }).reverse();
    list.replaceChildren(...entries.map(createEntryElement));
    status.textContent = allEntries.length
      ? `共保存 ${allEntries.length} 条，当前显示 ${entries.length} 条。`
      : '尚无通信记录。';
  };
  const scheduleRender = () => {
    if (renderFrame !== null) return;
    renderFrame = requestAnimationFrame(render);
  };
  const offJournal = journal.subscribe(scheduleRender);
  search.addEventListener('input', scheduleRender);
  filter.addEventListener('change', scheduleRender);
  clearButton.addEventListener('click', () => journal.clear());
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(journal.exportJson());
      status.textContent = '通信日志 JSON 已复制。';
    } catch {
      status.textContent = '浏览器拒绝访问剪贴板，请使用导出功能。';
    }
  });
  exportButton.addEventListener('click', () => {
    const blob = new Blob([journal.exportJson()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lab-communication-${new Date().toISOString().replaceAll(':', '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    status.textContent = '通信日志 JSON 已导出。';
  });
  render();

  return () => {
    offJournal();
    if (renderFrame !== null) cancelAnimationFrame(renderFrame);
    panel.root.remove();
  };
};

