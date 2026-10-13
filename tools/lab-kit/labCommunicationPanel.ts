import { fitGraphView, graphWorldPoint, type GraphView } from '@/core/ui/node-graph/graphViewport';
import type { LabCommunication } from './labCommunication';
import type { LabUi } from './labUi';
import type { LabViewportManager } from './labViewportManager';
import { createSharedDataInspector } from './shared-memory/sharedDataInspector';
import './shared-memory/shared-memory.css';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
};
const button = (label: string, action: () => void) => {
  const node = el('button', '', label); node.type = 'button'; node.addEventListener('click', action); return node;
};
const svgEl = (tag: string, attrs: Record<string, string> = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); return node;
};
type Node = { id: string; title: string; subtitle: string; x: number; y: number; width: number; height: number; protocol?: string; moduleId?: string };
type Selection = { kind: 'module' | 'event'; id: string };

/** Events describe routing; history describes dispatch-time recipients and bounded payload snapshots. */
export const createLabCommunicationPanel = (ui: LabUi, viewport: LabViewportManager, communication: LabCommunication): (() => void) => {
  const panel = ui.addPanel('system-communication', '模块通信系统'); panel.root.classList.add('lab-system-panel');
  const layer = viewport.openHtmlLayer({ id: 'lab:communication', title: '模块通信系统', mode: 'exclusive',
    initiallyVisible: false, interactive: true, pauseBabylonRendering: false, fullWindow: true });
  layer.root.classList.add('lab-memory-overlay'); layer.content.classList.add('lab-memory-layer');
  const workspace = el('div', 'lab-memory-workspace');
  const sidebar = el('aside', 'lab-memory-sidebar'), stage = el('main', 'lab-memory-stage'), details = el('aside', 'lab-memory-inspector');
  const search = el('input'); search.placeholder = '搜索事件或模块'; search.setAttribute('aria-label', '搜索通信事件或模块');
  const filter = el('select'); filter.setAttribute('aria-label', '通信事件筛选');
  for (const [value, label] of [['all', '全部事件'], ['unheard', '无监听者'], ['failed', '最近记录有失败']]) {
    const option = el('option', '', label); option.value = value; filter.append(option);
  }
  const list = el('div', 'lab-memory-list'); sidebar.append(search, filter, list);
  const toolbar = el('div', 'lab-memory-toolbar'), host = el('div', 'lab-memory-graph');
  const svg = svgEl('svg', { role: 'group', 'aria-label': '模块与事件通信关系图', tabindex: '0' });
  const graph = svgEl('g'); svg.append(graph); host.append(svg);
  stage.append(toolbar, host, el('div', 'lab-memory-hint', '发布模块 → 事件 → 监听模块 · 实线为已观察发布，虚线为声明 · 拖动空白平移，滚轮缩放'));
  const heading = el('h3', '', '选择模块或事件'), meta = el('p', 'lab-memory-meta'), contract = el('section');
  const bindings = el('section'), history = el('section'), payload = createSharedDataInspector();
  details.append(heading, meta, contract, bindings, history, payload.root);
  workspace.append(sidebar, stage, details); layer.content.append(workspace);
  let selection: Selection | undefined, selectedMessage: string | undefined;
  let contractKey = '', bindingsKey = '', historyKey = '', moduleDetailsKey = '';
  let view: GraphView = { x: 30, y: 30, scale: 1 }, nodes: Node[] = [];
  let frame = 0, disposed = false, structureDirty = true;
  let gesture: { id: number; x: number; y: number; origin: GraphView; moved: boolean } | undefined;
  const entries = () => communication.journal.getEntries().filter(entry => entry.kind === 'event');
  const select = (next?: Selection) => {
    if (selection?.kind === next?.kind && selection?.id === next?.id) return;
    selection = next; selectedMessage = undefined; payload.reset(); details.scrollTop = 0;
    contractKey = bindingsKey = historyKey = moduleDetailsKey = '';
    syncSelection(); renderDetails();
  };
  const renderDetails = () => {
    if (selection?.kind === 'module') {
      const moduleId = selection.id, events = communication.inspectEvents();
      const groups = [
        ['声明发布', events.filter(event => event.declaredPublishers.includes(moduleId))],
        ['实际发布过', events.filter(event => event.observedPublishers.includes(moduleId))],
        ['当前监听', events.filter(event => event.listeners.some(listener => listener.moduleId === moduleId))],
      ] as const;
      const key = JSON.stringify([moduleId, groups.map(([label, matches]) => [label, matches.map(event => [event.protocol, event.definition.metadata?.label])])]);
      if (key === moduleDetailsKey) return;
      moduleDetailsKey = key;
      heading.textContent = moduleId; meta.textContent = '模块通信关系 · 点击事件查看规范与触发记录';
      contract.replaceChildren(); bindings.replaceChildren(); history.replaceChildren(); payload.root.hidden = true;
      for (const [label, matches] of groups) {
        bindings.append(el('h4', '', label));
        if (!matches.length) bindings.append(el('p', '', '无'));
        for (const event of matches) {
          const item = button(event.definition.metadata?.label ?? event.protocol, () => select({ kind: 'event', id: event.protocol }));
          item.title = event.protocol; bindings.append(item);
        }
      }
      return;
    }
    const event = selection?.kind === 'event' ? communication.inspectEvents().find(event => event.protocol === selection?.id) : undefined;
    if (!event) { heading.textContent = '选择模块或事件'; meta.textContent = '声明后，即使尚未触发或没有监听者，也会出现在目录。'; contract.replaceChildren(); bindings.replaceChildren(); history.replaceChildren(); payload.root.hidden = true; return; }
    heading.textContent = event.definition.metadata?.label ?? event.protocol;
    meta.textContent = `${event.protocol} · 当前 ${event.moduleCount} 个监听模块 / ${event.listenerCount} 个回调`;
    const definition = event.definition.metadata;
    const nextContractKey = JSON.stringify([event.protocol, definition]);
    if (contractKey !== nextContractKey) {
    contractKey = nextContractKey;
    contract.replaceChildren(el('h4', '', '事件规范'), el('p', '', definition?.description ?? '旧协议尚未补充说明。'), el('p', '', `触发时机：${definition?.trigger ?? '尚未声明'}`));
    for (const field of definition?.fields ?? []) contract.append(el('p', '', `${field.name} · ${field.type} · ${field.required === false ? '可选' : '必需'}${field.description ? ` · ${field.description}` : ''}`));
    }
    const nextBindingsKey = JSON.stringify([event.protocol, event.declaredPublishers, event.observedPublishers, event.listeners.map(listener => listener.moduleId)]);
    if (bindingsKey !== nextBindingsKey) {
    bindingsKey = nextBindingsKey;
    bindings.replaceChildren(el('h4', '', '当前关系'),
      el('p', '', `声明发布：${event.declaredPublishers.join('、') || '无'}`),
      el('p', '', `实际发布过：${event.observedPublishers.join('、') || '尚无'}`));
    const counts = new Map<string, number>();
    for (const listener of event.listeners) counts.set(listener.moduleId, (counts.get(listener.moduleId) ?? 0) + 1);
    for (const [moduleId, count] of counts) bindings.append(el('p', '', `${moduleId} · ${count} 个监听回调`));
    }
    const records = entries().filter(entry => `${entry.type}@${entry.version}` === event.protocol);
    const nextHistoryKey = JSON.stringify([event.protocol, selectedMessage, records.map(entry => entry.sequence)]);
    if (historyKey === nextHistoryKey) return;
    historyKey = nextHistoryKey;
    const byMessage = new Map<string, typeof records>();
    for (const record of records) { const messages = byMessage.get(record.messageId) ?? []; messages.push(record); byMessage.set(record.messageId, messages); }
    const ids = [...new Set(records.map(entry => entry.messageId))].reverse().slice(0, 50);
    history.replaceChildren(el('h4', '', '最近触发 · 最多 50 次'));
    for (const id of ids) {
      const messages = byMessage.get(id)!;
      const start = messages.find(entry => entry.phase === 'event-published'), end = messages.find(entry => entry.phase === 'event-completed');
      const first = start ?? messages[0];
      const item = button(`${new Date(first.timestamp).toLocaleTimeString('zh-CN', { hour12: false })} · ${first.sourceModuleId} · ${end ? (end.failedCount ? '有失败' : '完成') : '处理中 / 记录不完整'}`, () => {
        if (id === (selectedMessage ?? ids[0])) return;
        selectedMessage = id; payload.reset(); renderDetails();
      });
      item.classList.toggle('is-active', id === (selectedMessage ?? ids[0])); history.append(item);
    }
    if (!ids.length) history.append(el('p', '', '尚未触发。'));
    const id = selectedMessage ?? ids[0];
    const messages = byMessage.get(id) ?? [];
    const start = messages.find(entry => entry.phase === 'event-published'), end = messages.find(entry => entry.phase === 'event-completed');
    payload.root.hidden = !id;
    if (id) payload.update({ messageId: id, source: (start ?? end)?.sourceModuleId,
      payloadPreview: start ? start.payloadPreview : '参数记录已超出日志保留范围',
      previewNotice: '触发当时的有限快照；深度、条目和长文本可能截断。',
      recipientsAtDispatch: start?.recipients ?? end?.recipients ?? [],
      listenerResults: end?.listenerResults ?? [],
      status: end?.status ?? '处理中 / 记录不完整', durationMs: end?.durationMs,
      deliveredCount: end?.deliveredCount, failedCount: end?.failedCount });
  };
  const draw = () => {
    graph.replaceChildren(); graph.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.scale})`);
    const events = communication.inspectEvents();
    for (const event of events) {
      const target = nodes.find(node => node.protocol === event.protocol); if (!target) continue;
      const link = (from: Node, to: Node, declared: boolean) => {
        const moduleId = from.moduleId ?? to.moduleId!;
        const active = !selection || (selection.kind === 'module' ? selection.id === moduleId : selection.id === event.protocol);
        const x = from.x + from.width, y = from.y + from.height / 2, tx = to.x, ty = to.y + to.height / 2;
        graph.append(svgEl('path', { d: `M${x},${y} C${x + 55},${y} ${tx - 55},${ty} ${tx},${ty}`,
          class: active ? 'is-active' : 'is-dimmed', fill: 'none', 'data-module': moduleId, 'data-protocol': event.protocol,
          ...(declared ? { 'stroke-dasharray': '6 5' } : {}) }));
      };
      for (const id of new Set([...event.declaredPublishers, ...event.observedPublishers])) {
        const node = nodes.find(node => node.id === `publisher:${id}`); if (node) link(node, target, !event.observedPublishers.includes(id));
      }
      for (const id of new Set(event.listeners.map(listener => listener.moduleId))) {
        const node = nodes.find(node => node.id === `listener:${id}`); if (node) link(target, node, false);
      }
    }
    for (const node of nodes) {
      const next: Selection = node.protocol ? { kind: 'event', id: node.protocol } : { kind: 'module', id: node.moduleId! };
      const isSelected = selection?.kind === next.kind && selection.id === next.id;
      const group = svgEl('g', { transform: `translate(${node.x},${node.y})`, class: `lab-memory-node is-${node.protocol ? 'memory' : 'module'}${isSelected ? ' is-selected' : ''}`,
        tabindex: '0', role: 'button', 'aria-label': node.title, 'data-communication-node': node.id });
      group.append(svgEl('rect', { width: String(node.width), height: String(node.height), rx: '8' }));
      const title = svgEl('text', { x: '12', y: '25' }); title.textContent = node.title.length > 29 ? `${node.title.slice(0, 28)}…` : node.title;
      const subtitle = svgEl('text', { x: '12', y: '49' }); subtitle.textContent = node.subtitle;
      group.append(title, subtitle);
      const activate = () => select(next);
      group.addEventListener('click', activate); group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
      graph.append(group);
    }
  };
  const syncView = () => graph.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.scale})`);
  const syncSelection = () => {
    const byId = new Map(nodes.map(node => [node.id, node]));
    for (const group of graph.querySelectorAll<SVGGElement>('[data-communication-node]')) {
      const node = byId.get(group.dataset.communicationNode!)!;
      group.classList.toggle('is-selected', !!selection && (selection.kind === 'event' ? node.protocol === selection.id : node.moduleId === selection.id));
    }
    for (const line of graph.querySelectorAll<SVGPathElement>('path')) {
      const active = !selection || (selection.kind === 'event' ? line.dataset.protocol === selection.id : line.dataset.module === selection.id);
      line.classList.toggle('is-active', active); line.classList.toggle('is-dimmed', !active);
    }
    for (const item of list.querySelectorAll<HTMLButtonElement>('button')) item.classList.toggle('is-active', selection?.kind === 'event' && item.title === selection.id);
  };
  const render = () => {
    if (!layer.visible || disposed) return;
    if (structureDirty || filter.value === 'failed') {
      structureDirty = false;
      const query = search.value.toLowerCase(), failed = new Set(entries().filter(entry => entry.status === 'failed').map(entry => `${entry.type}@${entry.version}`));
      const events = communication.inspectEvents().filter(event => (filter.value !== 'unheard' || !event.listenerCount)
        && (filter.value !== 'failed' || failed.has(event.protocol))
        && (!query || [event.protocol, event.definition.metadata?.label ?? '', ...event.declaredPublishers, ...event.observedPublishers, ...event.listeners.map(listener => listener.moduleId)].some(value => value.toLowerCase().includes(query))));
      list.replaceChildren();
      for (const event of events) {
        const item = button(`${event.definition.metadata?.label ?? event.protocol} · ${event.moduleCount} 模块 / ${event.listenerCount} 回调`, () => select({ kind: 'event', id: event.protocol }));
        item.title = event.protocol; item.classList.toggle('is-active', selection?.kind === 'event' && event.protocol === selection.id); list.append(item);
      }
      if (!events.length) list.append(el('p', '', '没有匹配的事件。'));
      const publishers = [...new Set(events.flatMap(event => [...event.declaredPublishers, ...event.observedPublishers]))];
      const listeners = [...new Set(events.flatMap(event => event.listeners.map(listener => listener.moduleId)))];
      nodes = [
        ...publishers.map((id, i): Node => ({ id: `publisher:${id}`, title: id, subtitle: '发布模块', moduleId: id, x: 20, y: i * 94 + 20, width: 250, height: 70 })),
        ...events.map((event, i): Node => ({ id: event.protocol, protocol: event.protocol, title: event.definition.metadata?.label ?? event.protocol, subtitle: `${event.moduleCount} 模块 · ${event.listenerCount} 回调`, x: 350, y: i * 94 + 20, width: 250, height: 70 })),
        ...listeners.map((id, i): Node => ({ id: `listener:${id}`, title: id, subtitle: '监听模块', moduleId: id, x: 680, y: i * 94 + 20, width: 250, height: 70 })),
      ]; draw();
    }
    renderDetails();
  };
  const fit = () => { view = fitGraphView(nodes, { width: host.clientWidth, height: host.clientHeight }, 0.12); syncView(); };
  const schedule = () => {
    if (disposed || !layer.visible || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  };
  const open = () => { layer.show(); structureDirty = true; render(); fit(); };
  panel.content.append(el('p', '', '查看事件规范、实际监听关系与触发参数。'), button('打开通信系统', open));
  toolbar.append(el('strong', '', '模块 → 事件 → 模块'), button('适配全部', fit), button('刷新', () => { structureDirty = true; render(); }));
  search.addEventListener('input', () => { structureDirty = true; render(); fit(); });
  filter.addEventListener('change', () => { structureDirty = true; render(); fit(); });
  const visibility = new MutationObserver(() => { if (layer.visible) { structureDirty = true; schedule(); } else if (frame) { cancelAnimationFrame(frame); frame = 0; } });
  visibility.observe(layer.root, { attributes: true, attributeFilter: ['hidden'] });
  const resize = new ResizeObserver(() => { if (layer.visible) fit(); }); resize.observe(host);
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || (event.target as Element).closest('[data-communication-node]')) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: { ...view }, moved: false }; svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', event => { if (gesture?.id === event.pointerId) { gesture.moved ||= Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 4; view = { ...gesture.origin, x: gesture.origin.x + event.clientX - gesture.x, y: gesture.origin.y + event.clientY - gesture.y }; syncView(); } });
  const endGesture = () => { if (gesture && svg.hasPointerCapture(gesture.id)) svg.releasePointerCapture(gesture.id); gesture = undefined; };
  svg.addEventListener('pointerup', event => { if (gesture?.id !== event.pointerId) return; const clear = !gesture.moved; endGesture(); if (clear) select(); });
  svg.addEventListener('pointercancel', endGesture);
  svg.addEventListener('wheel', event => {
    event.preventDefault(); const bounds = svg.getBoundingClientRect(), anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const world = graphWorldPoint(anchor, view), scale = Math.max(0.08, Math.min(2.5, view.scale * Math.exp(-event.deltaY * 0.001)));
    view = { x: anchor.x - world.x * scale, y: anchor.y - world.y * scale, scale }; syncView();
  }, { passive: false });
  const offBindings = communication.subscribeBindings(() => { structureDirty = true; schedule(); });
  const offJournal = communication.journal.subscribe(schedule);
  return () => { disposed = true; offBindings(); offJournal(); if (frame) cancelAnimationFrame(frame); visibility.disconnect(); resize.disconnect(); layer.dispose(); panel.root.remove(); };
};
