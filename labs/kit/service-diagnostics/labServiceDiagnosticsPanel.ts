import type { LabModule } from '../labKit.types';
import type { LabServiceCall, LabServiceRegistry } from '../labServiceRegistry';
import type { LabUi } from '../labUi';
import type { LabViewportManager } from '../labViewportManager';
import { createLabServiceGraph } from '../shared-memory/labMemoryPanel';
import '../performance/lab-performance.css';
import './lab-service-diagnostics.css';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
};
const button = (label: string, action: () => void) => {
  const node = el('button', label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
};
const select = (label: string, options: readonly (readonly [string, string])[]) => {
  const node = el('select');
  node.setAttribute('aria-label', label);
  for (const [value, text] of options) {
    const option = el('option', text); option.value = value; node.append(option);
  }
  return node;
};

export function createLabServiceDiagnosticsPanel(
  ui: LabUi, viewport: LabViewportManager, registry: LabServiceRegistry, modules: readonly LabModule[],
): () => void {
  const panel = ui.addPanel('system-services', 'Lab 服务诊断');
  panel.root.classList.add('lab-system-panel');
  const graph = createLabServiceGraph(ui, viewport, registry, modules);
  const layer = viewport.openHtmlLayer({
    id: 'lab:service-registry', title: 'Lab 服务注册表工作台', mode: 'exclusive',
    initiallyVisible: false, interactive: true, fullWindow: true, pauseBabylonRendering: false,
  });
  layer.root.classList.add('lab-memory-overlay');
  layer.content.classList.add('lab-performance-workspace', 'lab-service-registry');
  const toolbar = el('div'); toolbar.className = 'lab-performance-toolbar';
  const summary = el('p'); summary.setAttribute('aria-live', 'polite');
  const search = el('input');
  search.type = 'search'; search.placeholder = '搜索服务 ID、公开操作、注册模块或持有模块';
  search.setAttribute('aria-label', search.placeholder);
  const filter = select('消费者筛选', [['all', '全部服务'], ['used', '已有消费者'], ['unused', '尚无消费者']]);
  const sort = select('服务排序', [['id', '按服务 ID'], ['owner', '按注册模块'], ['consumers', '按消费者数']]);
  toolbar.append(el('strong', '当前 Lab 的注册服务'), search, filter, sort);

  const table = el('table');
  table.setAttribute('aria-label', 'Lab 服务注册表');
  const head = table.createTHead().insertRow();
  for (const label of ['服务 ID', '注册模块', '消费者数', '持有模块', '查看']) {
    const cell = el('th', label); cell.scope = 'col'; head.append(cell);
  }
  const body = table.createTBody();
  layer.content.append(toolbar, summary, el('p', '持有模块通过 get/find 获取服务。临时调用单独记录。'), table);

  const render = () => {
    if (!layer.visible) return;
    const entries = registry.inspect();
    const query = search.value.trim().toLowerCase();
    const rows = entries.filter(entry =>
      (filter.value === 'all' || (entry.consumers.length > 0) === (filter.value === 'used'))
      && [entry.id, entry.owner, ...entry.consumers, ...entry.actions].some(text => text.toLowerCase().includes(query)));
    rows.sort((a, b) => (sort.value === 'owner' ? a.owner.localeCompare(b.owner)
      : sort.value === 'consumers' ? b.consumers.length - a.consumers.length : 0) || a.id.localeCompare(b.id));
    summary.textContent = `共注册 ${entries.length} 项服务 · 显示 ${rows.length} 项`;
    body.replaceChildren(...rows.map(entry => {
      const row = el('tr');
      row.dataset.serviceId = entry.id;
      const id = el('th'); id.scope = 'row'; id.append(el('code', entry.id));
      if (entry.actions.length) id.append(el('small', entry.actions.join(' · ')));
      const owner = el('td'); owner.append(el('code', entry.owner));
      const consumers = el('td');
      const list = [...entry.consumers].sort((a, b) => a.localeCompare(b));
      if (list.length) for (const consumer of list) consumers.append(el('code', consumer));
      else consumers.textContent = '尚无消费者';
      const action = el('td');
      const showGraph = button('在图中查看', () => { layer.hide(); graph.open(entry.id); });
      showGraph.setAttribute('aria-label', `在关系图中查看 ${entry.id}`);
      action.append(showGraph);
      row.append(id, owner, el('td', String(list.length)), consumers, action);
      return row;
    }));
    if (!rows.length) { const cell = body.insertRow().insertCell(); cell.colSpan = head.cells.length; cell.textContent = '没有匹配的服务。'; }
  };
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  sort.addEventListener('change', render);
  const off = registry.subscribe(render);
  const calls = viewport.openHtmlLayer({
    id: 'lab:service-calls', title: 'Lab 服务调用记录', mode: 'exclusive',
    initiallyVisible: false, interactive: true, fullWindow: true, pauseBabylonRendering: false,
  });
  calls.root.classList.add('lab-memory-overlay');
  calls.content.classList.add('lab-performance-workspace', 'lab-service-calls');
  const callToolbar = el('div'); callToolbar.className = 'lab-performance-toolbar';
  const callSearch = el('input');
  callSearch.type = 'search'; callSearch.placeholder = '搜索来源、服务、操作或目标';
  callSearch.setAttribute('aria-label', callSearch.placeholder);
  const callFilter = select('调用结果筛选', [['all', '全部结果'], ['succeeded', '成功'], ['rejected', '已拒绝'], ['failed', '失败'], ['pending', '执行中']]);
  callToolbar.append(el('strong', '最近 100 次临时调用'), callSearch, callFilter);
  const callTable = el('table'); callTable.setAttribute('aria-label', 'Lab 服务调用记录');
  const callHead = callTable.createTHead().insertRow();
  for (const label of ['时间', '调用来源', '服务 / 提供模块', '操作', '目标', '结果']) {
    const cell = el('th', label); cell.scope = 'col'; callHead.append(cell);
  }
  const callBody = callTable.createTBody();
  calls.content.append(callToolbar, callTable);
  const outcomes: Record<LabServiceCall['status'], string> = {
    pending: '执行中', succeeded: '成功', rejected: '已拒绝', failed: '失败',
  };
  const renderCalls = () => {
    if (!calls.visible) return;
    const query = callSearch.value.trim().toLowerCase();
    const rows = registry.inspectCalls().filter(call =>
      (callFilter.value === 'all' || call.status === callFilter.value)
      && [call.caller, call.source, call.actorId, call.serviceId, call.owner, call.operation, call.target, call.error]
        .some(value => value?.toLowerCase().includes(query) || !query)).reverse();
    callBody.replaceChildren(...rows.map(call => {
      const row = el('tr');
      row.dataset.operation = call.operation;
      row.dataset.status = call.status;
      const from = el('td');
      from.append(el('code', call.caller));
      if (call.source) from.append(el('small', call.source));
      if (call.actorId && call.actorId !== call.source) from.append(el('small', call.actorId));
      const service = el('td');
      service.append(el('code', call.serviceId ?? '未找到'));
      if (call.owner) service.append(el('small', call.owner));
      const result = el('td', outcomes[call.status]);
      if (call.error) result.append(el('small', call.error));
      row.append(el('td', new Date(call.at).toLocaleTimeString()), from, service,
        el('td', call.operation), el('td', call.target ?? '—'), result);
      return row;
    }));
    if (!rows.length) { const cell = callBody.insertRow().insertCell(); cell.colSpan = callHead.cells.length; cell.textContent = '没有匹配的调用。'; }
  };
  callSearch.addEventListener('input', renderCalls);
  callFilter.addEventListener('change', renderCalls);
  const offCalls = registry.subscribeCalls(renderCalls);
  panel.content.append(
    button('打开服务关系图', () => graph.open()),
    button('打开服务注册表', () => { layer.show(); render(); }),
    button('打开服务调用记录', () => { calls.show(); renderCalls(); }),
  );
  return () => { off(); offCalls(); graph.dispose(); layer.dispose(); calls.dispose(); panel.root.remove(); };
}
