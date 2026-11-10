import type { LabMemoryRegistry } from './LabMemory';
import { createSharedDataInspector } from './sharedDataInspector';
import type { LabViewportManager } from '../labViewportManager';
import '../performance/lab-performance.css';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
};

const button = (text: string, action: () => void) => {
  const node = el('button', text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
};

const searchInput = (label: string) => {
  const node = el('input');
  node.type = 'search';
  node.placeholder = label;
  node.setAttribute('aria-label', label);
  return node;
};

export function createLabMemoryTable(
  viewport: LabViewportManager, memory: LabMemoryRegistry, openGraph: (key: string) => void,
) {
  const layer = viewport.openHtmlLayer({
    id: 'lab:memory-table', title: 'Lab 共享内存数据表', mode: 'exclusive',
    initiallyVisible: false, interactive: true, fullWindow: true, pauseBabylonRendering: false,
  });
  layer.root.classList.add('lab-memory-overlay');
  layer.content.classList.add('lab-performance-workspace', 'lab-memory-table');
  const toolbar = el('div'); toolbar.className = 'lab-performance-toolbar';
  const search = searchInput('搜索数据名称、键、类型或模块');
  const sort = el('select');
  sort.setAttribute('aria-label', '共享内存排序');
  for (const [value, title] of [['key', '按数据键'], ['creator', '按创建模块'], ['revision', '按数据修订号']]) {
    const option = el('option', title); option.value = value; sort.append(option);
  }
  toolbar.append(el('strong', '当前 Lab 的共享内存'), search, sort);
  const summary = el('p');
  const split = el('div'); split.className = 'lab-memory-table-split';
  const list = el('div'); list.className = 'lab-memory-table-list';
  const table = el('table'); table.setAttribute('aria-label', '当前 Lab 的共享内存');
  const head = table.createTHead().insertRow();
  for (const title of ['共享数据', '类型 / 版本', '首次创建模块', '申请模块', '修订号', '详情']) {
    const cell = el('th', title); cell.scope = 'col'; head.append(cell);
  }
  const body = table.createTBody();
  list.append(table);

  const detail = el('aside'); detail.className = 'lab-memory-table-detail'; detail.setAttribute('aria-label', '共享内存详情');
  const heading = el('h3', '选择一条共享内存');
  const meta = el('p', '点击「查看数据」，可浏览该条目的实时字段。');
  const actions = el('div'); actions.className = 'lab-memory-table-actions'; actions.hidden = true;
  const fieldSearch = searchInput('筛选字段路径或值');
  const inspector = createSharedDataInspector(); inspector.root.hidden = true;
  const refresh = button('刷新数据', () => { render(); sample(); });
  const showGraph = button('在关系图中查看', () => {
    if (!selectedKey) return;
    layer.hide(); stopSampling(); openGraph(selectedKey);
  });
  actions.append(fieldSearch, refresh, showGraph);
  detail.append(heading, meta, actions, inspector.root);
  split.append(list, detail); layer.content.append(toolbar, summary, split);

  let selectedKey: string | undefined;
  let frame = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let tableSignature = '';
  const visibleRows = new Map<string, { row: HTMLTableRowElement; revision: HTMLTableCellElement; select: HTMLButtonElement }>();
  const sample = () => {
    if (!layer.visible || !selectedKey) return;
    try { inspector.update(memory.inspectValue(selectedKey), fieldSearch.value); }
    catch (error) { inspector.update({ 读取失败: error instanceof Error ? error.message : String(error) }); }
  };
  const selectEntry = (key: string) => {
    if (selectedKey !== key) {
      selectedKey = key;
      fieldSearch.value = '';
      inspector.reset();
    }
    render(); sample();
  };
  const render = () => {
    if (!layer.visible) return;
    const entries = memory.inspect();
    const query = search.value.trim().toLowerCase();
    const matches = entries.filter(entry => [entry.key, entry.label, entry.typeId, entry.createdBy, ...entry.modules]
      .some(value => value.toLowerCase().includes(query)));
    matches.sort((a, b) => (sort.value === 'creator' ? a.createdBy.localeCompare(b.createdBy)
      : sort.value === 'revision' ? b.revision - a.revision : 0) || a.key.localeCompare(b.key));
    const nextSignature = JSON.stringify(matches.map(({ key, label, typeId, version, createdBy, modules }) =>
      [key, label, typeId, version, createdBy, modules]));
    if (tableSignature !== nextSignature) {
      tableSignature = nextSignature;
      visibleRows.clear();
      body.replaceChildren(...matches.map(entry => {
        const row = el('tr'); row.dataset.memoryKey = entry.key;
        const key = el('th'); key.scope = 'row'; key.append(el('strong', entry.label), el('code', entry.key));
        const type = el('td'); type.append(el('code', `${entry.typeId}@${entry.version}`));
        const creator = el('td'); creator.append(el('code', entry.createdBy));
        const modules = el('td');
        for (const module of entry.modules) modules.append(el('code', module));
        if (!entry.modules.length) modules.textContent = '—';
        const revision = el('td');
        const action = el('td');
        const select = button('查看数据', () => selectEntry(entry.key));
        select.setAttribute('aria-label', `查看 ${entry.key} 的数据`);
        action.append(select); row.append(key, type, creator, modules, revision, action);
        visibleRows.set(entry.key, { row, revision, select });
        return row;
      }));
      if (!matches.length) {
        const cell = body.insertRow().insertCell(); cell.colSpan = head.cells.length;
        cell.textContent = '没有匹配的共享内存。';
      }
    }
    summary.textContent = `共 ${entries.length} 块共享内存 · 显示 ${matches.length} 块`;
    for (const entry of matches) {
      const { row, revision, select } = visibleRows.get(entry.key)!;
      const selected = selectedKey === entry.key;
      row.classList.toggle('is-selected', selected);
      select.setAttribute('aria-pressed', String(selected));
      if (revision.textContent !== String(entry.revision)) revision.textContent = String(entry.revision);
    }
    const entry = entries.find(item => item.key === selectedKey);
    if (!entry) selectedKey = undefined;
    heading.textContent = entry?.label ?? '选择一条共享内存';
    meta.textContent = entry ? `${entry.key} · ${entry.typeId}@${entry.version} · 修订 ${entry.revision}`
      : '点击「查看数据」，可浏览该条目的实时字段。';
    actions.hidden = inspector.root.hidden = !entry;
  };
  const stopSampling = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };
  const visibility = new MutationObserver(() => { if (!layer.visible) stopSampling(); });
  visibility.observe(layer.root, { attributes: true, attributeFilter: ['hidden'] });
  const unsubscribe = memory.subscribe(() => {
    if (!layer.visible || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  });
  search.addEventListener('input', render);
  sort.addEventListener('change', render);
  fieldSearch.addEventListener('input', sample);

  return {
    open() {
      layer.show();
      render(); sample();
      timer ??= setInterval(sample, 250);
    },
    dispose() {
      unsubscribe(); visibility.disconnect(); stopSampling();
      if (frame) cancelAnimationFrame(frame);
      layer.dispose();
    },
  };
}
