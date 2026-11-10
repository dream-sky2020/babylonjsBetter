import { fitGraphView, graphWorldPoint, type GraphPoint, type GraphView } from '@/core/ui/node-graph/graphViewport';
import type { LabModule } from '../labKit.types';
import type { LabUi } from '../labUi';
import type { LabViewportManager } from '../labViewportManager';
import type { LabServiceInspection, LabServiceRegistry } from '../labServiceRegistry';
import type { LabMemoryInspection, LabMemoryRegistry } from './LabMemory';
import { flattenSharedData } from './flattenSharedData';
import { createSharedDataInspector } from './sharedDataInspector';
import { createLabMemoryTable } from './labMemoryTable';
import './shared-memory.css';

type Selection = { kind: 'module' | 'memory' | 'service'; id: string };
type GraphNode = Selection & { x: number; y: number; width: number; height: number; title: string; lines: string[] };
type LinkRole = 'acquire' | 'provide' | 'consume';
const nodeId = (node: Selection) => `${node.kind}:${node.id}`;
const labels = { module: '模块', memory: '共享内存', service: '服务' };
let arrowId = 0;
function linkPath(source: GraphNode, target: GraphNode, role: LinkRole) {
  const shift = role === 'provide' ? -7 : role === 'consume' ? 7 : 0;
  const direction = source.kind === 'module' ? 1 : -1;
  const x = source.x + (direction > 0 ? source.width : 0), y = source.y + source.height / 2 + shift;
  const tx = target.x + (direction < 0 ? target.width : 0), ty = target.y + target.height / 2 + shift;
  return `M${x},${y} C${x + direction * 70},${y} ${tx - direction * 70},${ty} ${tx},${ty}`;
}
const shorten = (text: string, max = 30) => text.length > max ? `${text.slice(0, max - 1)}…` : text;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  node.className = className; node.textContent = text;
  return node;
};
const button = (text: string, action: () => void) => {
  const node = element('button', '', text); node.type = 'button'; node.addEventListener('click', action); return node;
};
const svgElement = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string> = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
};

/** Both relationship views use the same canvas and navigation. */
export const createLabMemoryPanel = (
  ui: LabUi, viewport: LabViewportManager, memory: LabMemoryRegistry, modules: readonly LabModule[],
): (() => void) => {
  const panel = ui.addPanel('system-shared-memory', '系统与共享内存');
  panel.root.classList.add('lab-system-panel');
  const count = element('p');
  const view = createRelationshipGraph(ui, viewport, modules, { memory }, text => { count.textContent = text; });
  const table = createLabMemoryTable(viewport, memory, view.open);
  panel.content.append(count, button('打开系统图与共享数据', () => view.open()),
    button('打开共享内存数据表', table.open));
  return () => { table.dispose(); view.dispose(); panel.root.remove(); };
};

export const createLabServiceGraph = (ui: LabUi, viewport: LabViewportManager, services: LabServiceRegistry, modules: readonly LabModule[]) =>
  createRelationshipGraph(ui, viewport, modules, { services });

function createRelationshipGraph(
  ui: LabUi, viewport: LabViewportManager, modules: readonly LabModule[],
  source: { memory: LabMemoryRegistry; services?: never } | { memory?: never; services: LabServiceRegistry },
  onCount?: (text: string) => void,
) {
  const { memory, services } = source;
  const objectKind = services ? 'service' : 'memory';
  const choiceLabel = `选择模块或${labels[objectKind]}`;
  const searchLabel = `搜索模块或${labels[objectKind]}`;
  const relationLabel = services ? '提供模块 → 服务 → 持有模块' : '连线表示实际申请关系。';
  const layer = viewport.openHtmlLayer({
    id: services ? 'lab:service-graph' : 'lab:shared-memory', title: services ? '模块与服务关系图' : '系统与共享内存', mode: 'exclusive',
    initiallyVisible: false, interactive: true, pauseBabylonRendering: false,
    fullWindow: true,
  });
  layer.root.classList.add('lab-memory-overlay');
  layer.content.classList.add('lab-memory-layer');
  const workspace = element('div', 'lab-memory-workspace');
  const sidebar = element('aside', 'lab-memory-sidebar');
  const search = element('input'); search.placeholder = searchLabel; search.setAttribute('aria-label', searchLabel);
  const list = element('div', 'lab-memory-list');
  sidebar.append(search, list);
  const stage = element('main', 'lab-memory-stage');
  const toolbar = element('div', 'lab-memory-toolbar');
  const graphHost = element('div', 'lab-memory-graph');
  const svg = svgElement('svg', { role: 'group', 'aria-label': `模块与${labels[objectKind]}关系图`, tabindex: '0' });
  const graph = svgElement('g'); svg.append(graph); graphHost.append(svg);
  const arrows = new Map<LinkRole, string>();
  if (services) {
    const defs = svgElement('defs');
    const id = ++arrowId;
    for (const [role, color] of [['provide', '#9f9cfa'], ['consume', '#49d2ba']] as const) {
      const markerId = `lab-service-${role}-${id}`;
      const marker = svgElement('marker', { id: markerId, markerWidth: '7', markerHeight: '7', refX: '6', refY: '3.5', orient: 'auto' });
      marker.append(svgElement('polygon', { points: '0 0, 7 3.5, 0 7', fill: color })); defs.append(marker);
      arrows.set(role, `url(#${markerId})`);
    }
    svg.append(defs);
  }
  const hint = element('div', 'lab-memory-hint', services
    ? '紫色实线：注册 · 青色虚线：持有 · 临时调用见记录 · 拖动空白平移 · 滚轮缩放 · 点击查看详情'
    : '拖动节点调整布局 · 拖动空白平移 · 滚轮缩放 · 点击查看数据');
  stage.append(toolbar, graphHost, hint);
  const inspector = element('aside', 'lab-memory-inspector');
  const heading = element('h3', '', choiceLabel);
  const meta = element('p', 'lab-memory-meta');
  const fieldSearch = element('input'); fieldSearch.placeholder = '筛选字段路径或值'; fieldSearch.setAttribute('aria-label', '筛选字段路径或值');
  const details = element('div', 'lab-memory-details');
  const valueInspector = createSharedDataInspector();
  inspector.append(heading, meta, fieldSearch, details);
  workspace.append(sidebar, stage, inspector); layer.content.append(workspace);

  let selection: Selection | undefined;
  let detailsViewKey = '';
  let applicantsKey = '';
  let moduleDetailsKey = '';
  const moduleCards = new Map<string, { meta: HTMLElement; summary: HTMLElement }>();
  const info = element('div', 'lab-memory-applicants');
  let view: GraphView = { x: 30, y: 30, scale: 1 };
  let entries: readonly LabMemoryInspection[] = [];
  let registrations: readonly LabServiceInspection[] = [];
  let nodes: GraphNode[] = [];
  const positions = new Map<string, GraphPoint>();
  const nodeElements = new Map<string, SVGGElement>();
  let links: { element: SVGPathElement; source: GraphNode; target: GraphNode; role: LinkRole }[] = [];
  let frame = 0;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let gesture: { pointerId: number; start: GraphPoint; origin: GraphPoint; node?: GraphNode; moved: boolean } | undefined;
  const showRegistered = element('input'); showRegistered.type = 'checkbox';
  const registeredLabel = element('label');
  registeredLabel.append(showRegistered, document.createTextNode(' 显示仅注册的服务'));
  const sampling = element('input'); sampling.type = 'checkbox'; sampling.checked = true;
  const sampleLabel = element('label'); sampleLabel.append(sampling, document.createTextNode('当前数据采样 · 4Hz'));

  const summary = (key: string) => {
    try { return flattenSharedData(memory?.inspectValue(key), 4).filter(field => field.path !== '…').map(field => `${field.path}: ${shorten(field.value, 35)}`).join(' · '); }
    catch (error) { return `观察失败：${error instanceof Error ? error.message : String(error)}`; }
  };
  const select = (next?: Selection) => {
    if (selection?.kind === next?.kind && selection?.id === next?.id) return;
    if (!selection || !next || nodeId(selection) !== nodeId(next)) { valueInspector.reset(); inspector.scrollTop = 0; }
    selection = next; fieldSearch.value = '';
    if (services && next && search.value && !nodes.some(node => nodeId(node) === nodeId(next))) {
      search.value = ''; render(); fit(); return;
    }
    syncSelection(); renderDetails();
  };

  const renderDetails = () => {
    if (!layer.visible) return;
    if (!selection) { details.replaceChildren(); detailsViewKey = ''; heading.textContent = choiceLabel; meta.textContent = relationLabel; fieldSearch.hidden = true; return; }
    fieldSearch.hidden = selection.kind !== 'memory';
    heading.textContent = selection.id;
    if (services) {
      renderServiceDetails(selection);
      return;
    }
    if (selection.kind === 'module') {
      const module = modules.find(module => module.id === selection!.id);
      const acquired = entries.filter(entry => entry.modules.includes(selection!.id));
      const key = JSON.stringify([selection.id, acquired.map(entry => [entry.key, entry.label, entry.typeId, entry.version]), ui.hasModulePanels(selection.id)]);
      meta.textContent = `${module?.manifest?.responsibility ?? 'Lab 模块'} · 已申请 ${acquired.length} 块共享内存`;
      if (moduleDetailsKey !== key || detailsViewKey !== `module:${selection.id}`) {
      moduleDetailsKey = key; detailsViewKey = `module:${selection.id}`; moduleCards.clear(); details.replaceChildren();
      if (ui.hasModulePanels(selection.id)) details.append(button('打开模块功能面板', () => { layer.hide(); ui.showModulePanels(selection!.id); }));
      if (!acquired.length) details.append(element('p', 'lab-memory-empty', '该模块尚未申请共享内存。'));
      for (const entry of acquired) {
        const card = element('section', 'lab-memory-data-card');
        const cardMeta = element('small'), cardSummary = element('p');
        card.append(button(entry.label, () => select({ kind: 'memory', id: entry.key })),
          element('code', '', entry.key), cardMeta, cardSummary);
        moduleCards.set(entry.key, { meta: cardMeta, summary: cardSummary });
        details.append(card);
      }
      }
      for (const entry of acquired) {
        const card = moduleCards.get(entry.key)!;
        const text = `${entry.typeId}@${entry.version} · revision ${entry.revision}`, value = summary(entry.key);
        if (card.meta.textContent !== text) card.meta.textContent = text;
        if (card.summary.textContent !== value) card.summary.textContent = value;
      }
      return;
    }
    const entry = entries.find(entry => entry.key === selection!.id);
    if (!entry) { details.replaceChildren(); detailsViewKey = ''; meta.textContent = '共享内存已释放。'; return; }
    meta.textContent = `${entry.label} · ${entry.typeId}@${entry.version} · revision ${entry.revision}`;
    if (detailsViewKey !== entry.key) {
      details.replaceChildren(info, valueInspector.root); detailsViewKey = entry.key; applicantsKey = '';
    }
    const nextApplicantsKey = JSON.stringify([entry.createdBy, entry.modules]);
    if (nextApplicantsKey !== applicantsKey) {
      info.replaceChildren(element('small', '', `首次创建：${entry.createdBy}`));
      for (const moduleId of entry.modules) info.append(button(moduleId, () => select({ kind: 'module', id: moduleId })));
      applicantsKey = nextApplicantsKey;
    }
    try {
      valueInspector.update(memory?.inspectValue(entry.key), fieldSearch.value);
    } catch (error) { valueInspector.update({ error: error instanceof Error ? error.message : String(error) }); }
  };

  const renderServiceDetails = ({ kind, id }: Selection) => {
    details.replaceChildren();
    if (kind === 'module') {
      const provides = registrations.filter(service => service.owner === id);
      const uses = registrations.filter(service => service.consumers.includes(id));
      meta.textContent = modules.find(module => module.id === id)?.manifest?.responsibility ?? 'Lab 模块';
      if (ui.hasModulePanels(id)) details.append(button('打开模块功能面板', () => { layer.hide(); ui.showModulePanels(id); }));
      for (const [label, items] of [['注册的服务', provides], ['已获取的服务', uses]] as const) {
        const section = element('section', 'lab-memory-data-card');
        section.append(element('h4', '', `${label} · ${items.length}`));
        for (const service of items) section.append(button(service.id, () => select({ kind: 'service', id: service.id })));
        if (!items.length) section.append(element('p', 'lab-memory-empty', '无'));
        details.append(section);
      }
      return;
    }
    const service = registrations.find(entry => entry.id === id);
    meta.textContent = service ? '当前已注册 · 持有模块通过 get/find 获取服务。' : '服务已注销。';
    if (!service) return;
    const owner = element('section', 'lab-memory-data-card');
    owner.append(element('h4', '', '注册模块'), button(service.owner, () => select({ kind: 'module', id: service.owner })));
    const consumers = element('section', 'lab-memory-data-card');
    if (service.actions.length) details.append(element('p', 'lab-memory-meta', `公开操作 · ${service.actions.join(' · ')}`));
    consumers.append(element('h4', '', `持有模块 · ${service.consumers.length}`));
    for (const id of service.consumers) consumers.append(button(id, () => select({ kind: 'module', id })));
    if (!service.consumers.length) consumers.append(element('p', 'lab-memory-empty', '尚无消费者'));
    details.append(owner, consumers);
  };

  const buildNodes = () => {
    const filter = search.value.trim().toLowerCase();
    if (services) {
      const contains = (value: string) => value.toLowerCase().includes(filter);
      const visibleServices = registrations.filter(service =>
        (showRegistered.checked || !!filter || service.consumers.length > 0)
        && [service.id, service.owner, ...service.consumers, ...service.actions].some(contains));
      const related = new Set(visibleServices.flatMap(service => [service.owner, ...service.consumers]));
      const moduleIds = filter || showRegistered.checked
        ? [...new Set([...modules.map(module => module.id), ...related])].filter(id => contains(id) || related.has(id))
        : [...related];
      nodes = [
        ...moduleIds.map((id, index): GraphNode => ({
          kind: 'module', id, title: id, x: 40, y: index * 100 + 30, width: 270, height: 80,
          lines: [`提供 ${registrations.filter(service => service.owner === id).length} 项`,
            `已获取 ${registrations.filter(service => service.consumers.includes(id)).length} 项`],
        })),
        ...visibleServices.map((service, index): GraphNode => ({
          kind: 'service', id: service.id, title: service.id, x: 450, y: index * 100 + 30, width: 320, height: 80,
          lines: [`注册：${service.owner}`, `${service.consumers.length} 个持有模块`],
        })),
      ].map(node => ({ ...node, ...positions.get(nodeId(node)) }));
      return;
    }
    const visibleModules = modules.filter(module => !filter || module.id.toLowerCase().includes(filter)
      || entries.some(entry => entry.modules.includes(module.id) && `${entry.key} ${entry.label}`.toLowerCase().includes(filter)));
    const visibleEntries = entries.filter(entry => !filter || `${entry.key} ${entry.label}`.toLowerCase().includes(filter)
      || entry.modules.some(id => id.toLowerCase().includes(filter)));
    nodes = [
      ...visibleModules.map((module, index): GraphNode => {
        const acquired = entries.filter(entry => entry.modules.includes(module.id));
        const lines = acquired.slice(0, 2).map(entry => entry.key);
        if (acquired.length > 2) lines.push(`另 ${acquired.length - 2} 项 · 点击查看`);
        if (!lines.length) lines.push('尚未申请共享内存');
        return { kind: 'module', id: module.id, title: module.id, x: 40, y: index * 112 + 30, width: 270, height: 100, lines };
      }),
      ...visibleEntries.map((entry, index): GraphNode => ({
        kind: 'memory', id: entry.key, title: entry.label, x: 450, y: index * 130 + 30, width: 270, height: 100,
        lines: [entry.key, `${entry.typeId}@${entry.version}`, `${entry.modules.length} 个模块 · revision ${entry.revision}`],
      })),
    ].map(node => ({ ...node, ...positions.get(nodeId(node)) }));
  };

  const draw = () => {
    nodeElements.clear(); links = [];
    graph.replaceChildren(); graph.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.scale})`);
    const byId = new Map(nodes.map(node => [nodeId(node), node]));
    const appendLink = (moduleId: string, objectId: string, role: LinkRole) => {
      const module = byId.get(`module:${moduleId}`), object = byId.get(`${objectKind}:${objectId}`);
      if (!module || !object) return;
      const [source, target] = role === 'consume' ? [object, module] : [module, object];
      const arrow = arrows.get(role);
      const line = svgElement('path', {
        d: linkPath(source, target, role), fill: 'none', 'data-module': moduleId, [`data-${objectKind}`]: objectId, 'data-role': role,
        ...(arrow ? { 'marker-end': arrow } : {}),
      });
      const title = svgElement('title');
      title.textContent = `${moduleId} ${role === 'provide' ? '注册' : role === 'consume' ? '获取' : '申请'} ${objectId}`;
      line.append(title); graph.append(line);
      links.push({ element: line, source, target, role });
    };
    for (const entry of entries) for (const id of entry.modules) appendLink(id, entry.key, 'acquire');
    for (const service of registrations) {
      appendLink(service.owner, service.id, 'provide');
      for (const id of service.consumers) appendLink(id, service.id, 'consume');
    }
    for (const node of nodes) {
      const active = selection && nodeId(selection) === nodeId(node);
      const group = svgElement('g', {
        transform: `translate(${node.x} ${node.y})`, class: `lab-memory-node is-${node.kind}${active ? ' is-selected' : ''}`,
        tabindex: '0', role: 'button', 'aria-label': `${labels[node.kind]} ${node.title}`, 'data-node': nodeId(node),
      });
      group.append(svgElement('rect', { width: String(node.width), height: String(node.height), rx: '8' }));
      group.append(svgElement('rect', { width: String(node.width), height: '34', rx: '8', class: 'lab-memory-node-header' }));
      const title = svgElement('text', { x: '12', y: '22', class: 'lab-memory-node-title' }); title.textContent = shorten(node.title, 29); group.append(title);
      node.lines.forEach((line, index) => {
        const text = svgElement('text', { x: '12', y: String(53 + index * 16) }); text.textContent = shorten(line, 35); group.append(text);
      });
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(node); } });
      group.addEventListener('dblclick', () => { if (node.kind === 'module' && ui.hasModulePanels(node.id)) { layer.hide(); ui.showModulePanels(node.id); } });
      graph.append(group);
      nodeElements.set(nodeId(node), group);
    }
  };
  const syncGeometry = (node?: GraphNode) => {
    graph.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.scale})`);
    if (!node) return;
    nodeElements.get(nodeId(node))?.setAttribute('transform', `translate(${node.x} ${node.y})`);
    for (const link of links) if (nodeId(link.source) === nodeId(node) || nodeId(link.target) === nodeId(node)) {
      link.element.setAttribute('d', linkPath(link.source, link.target, link.role));
    }
  };
  const syncSelection = () => {
    const selectedId = selection ? nodeId(selection) : undefined;
    for (const [id, group] of nodeElements) group.classList.toggle('is-selected', id === selectedId);
    for (const link of links) {
      const active = !selection || nodeId(link.source) === selectedId || nodeId(link.target) === selectedId;
      link.element.classList.toggle('is-active', active); link.element.classList.toggle('is-dimmed', !active);
    }
    for (const item of list.querySelectorAll<HTMLButtonElement>('button')) item.classList.toggle('is-active', item.dataset.node === selectedId);
  };

  const render = () => {
    if (!layer.visible && !onCount) return;
    entries = memory?.inspect() ?? [];
    registrations = services?.inspect() ?? [];
    onCount?.(`${modules.length} 个模块 · ${entries.length} 块共享内存`);
    if (!layer.visible) return;
    buildNodes();
    if (gesture?.node) gesture.node = nodes.find(node => nodeId(node) === nodeId(gesture!.node!));
    list.replaceChildren();
    for (const kind of ['module', objectKind] as const) {
      list.append(element('h4', '', labels[kind]));
      for (const node of nodes.filter(node => node.kind === kind)) {
        const item = button(node.title, () => select(node));
        item.className = selection && nodeId(selection) === nodeId(node) ? 'is-active' : '';
        item.dataset.node = nodeId(node);
        item.title = node.id; list.append(item);
      }
    }
    if (!nodes.length) list.append(element('p', 'lab-memory-empty', `没有匹配的模块或${labels[objectKind]}。`));
    draw(); syncSelection(); renderDetails();
  };
  const fit = () => { view = fitGraphView(nodes, { width: graphHost.clientWidth, height: graphHost.clientHeight }, 0.12); syncGeometry(); };
  const schedule = () => {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  };
  const syncSampling = () => {
    if (timer) clearInterval(timer); timer = undefined;
    if (memory && !disposed && layer.visible && sampling.checked) timer = setInterval(renderDetails, 250);
  };
  const open = (key?: string) => {
    layer.show();
    if (key) {
      search.value = key;
      selection = { kind: objectKind, id: key };
      if (memory) { valueInspector.reset(); fieldSearch.value = ''; inspector.scrollTop = 0; }
    }
    else if (services) { search.value = ''; selection = undefined; }
    render(); fit(); syncSampling();
  };
  toolbar.append(element('strong', '', services ? relationLabel : '模块 → 共享内存'), button('适配全部', fit), button('刷新数据', render));
  if (memory) toolbar.append(sampleLabel);
  else toolbar.append(registeredLabel);
  showRegistered.addEventListener('change', () => { render(); fit(); });
  search.addEventListener('input', () => { render(); fit(); });
  fieldSearch.addEventListener('input', renderDetails);
  sampling.addEventListener('change', syncSampling);
  const visibilityObserver = new MutationObserver(syncSampling);
  visibilityObserver.observe(layer.root, { attributes: true, attributeFilter: ['hidden'] });
  const resizeObserver = new ResizeObserver(() => { if (layer.visible) fit(); }); resizeObserver.observe(graphHost);
  const point = (event: MouseEvent): GraphPoint => {
    const bounds = svg.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    const id = target.closest('[data-node]')?.getAttribute('data-node');
    const node = nodes.find(node => nodeId(node) === id);
    gesture = { pointerId: event.pointerId, start: point(event), origin: node ? { x: node.x, y: node.y } : { ...view }, node, moved: false };
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const next = point(event), dx = next.x - gesture.start.x, dy = next.y - gesture.start.y;
    gesture.moved ||= Math.hypot(dx, dy) > 4;
    if (gesture.node) {
      gesture.node.x = gesture.origin.x + dx / view.scale; gesture.node.y = gesture.origin.y + dy / view.scale;
      positions.set(nodeId(gesture.node), { x: gesture.node.x, y: gesture.node.y });
    } else { view.x = gesture.origin.x + dx; view.y = gesture.origin.y + dy; }
    syncGeometry(gesture.node);
  });
  svg.addEventListener('pointerup', event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const previous = gesture; gesture = undefined;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (!previous.moved) select(previous.node);
  });
  svg.addEventListener('pointercancel', () => { gesture = undefined; });
  svg.addEventListener('wheel', event => {
    event.preventDefault(); const anchor = point(event); const world = graphWorldPoint(anchor, view);
    const scale = Math.max(0.08, Math.min(2.5, view.scale * Math.exp(-event.deltaY * 0.001)));
    view = { x: anchor.x - world.x * scale, y: anchor.y - world.y * scale, scale }; syncGeometry();
  }, { passive: false });
  const offMemory = memory?.subscribe(schedule);
  const offServices = services?.subscribe(schedule);
  render();
  return { open, dispose() {
    disposed = true; offMemory?.(); offServices?.(); if (frame) cancelAnimationFrame(frame); if (timer) clearInterval(timer);
    visibilityObserver.disconnect(); resizeObserver.disconnect(); layer.dispose();
  } };
}
