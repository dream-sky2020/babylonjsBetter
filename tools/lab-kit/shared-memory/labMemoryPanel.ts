import { fitGraphView, graphWorldPoint, type GraphPoint, type GraphView } from '@/core/ui/node-graph/graphViewport';
import type { LabModule } from '../labKit.types';
import type { LabUi } from '../labUi';
import type { LabViewportManager } from '../labViewportManager';
import type { LabMemoryInspection, LabMemoryRegistry } from './LabMemory';
import { flattenSharedData } from './flattenSharedData';
import { createSharedDataInspector } from './sharedDataInspector';
import './shared-memory.css';

type Selection = { kind: 'module' | 'memory'; id: string };
type GraphNode = Selection & { x: number; y: number; width: number; height: number; title: string; lines: string[] };
const nodeId = (node: Selection) => `${node.kind}:${node.id}`;
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

/** Dialogue-style system workspace: node canvas, flat list and inspector. */
export const createLabMemoryPanel = (
  ui: LabUi, viewport: LabViewportManager, memory: LabMemoryRegistry, modules: readonly LabModule[],
): (() => void) => {
  const panel = ui.addPanel('system-shared-memory', '系统与共享内存');
  panel.root.classList.add('lab-system-panel');
  const count = element('p');
  const layer = viewport.openHtmlLayer({
    id: 'lab:shared-memory', title: '系统与共享内存', mode: 'exclusive',
    initiallyVisible: false, interactive: true, pauseBabylonRendering: false,
    fullWindow: true,
  });
  layer.root.classList.add('lab-memory-overlay');
  layer.content.classList.add('lab-memory-layer');
  const workspace = element('div', 'lab-memory-workspace');
  const sidebar = element('aside', 'lab-memory-sidebar');
  const search = element('input'); search.placeholder = '搜索模块或共享内存'; search.setAttribute('aria-label', '搜索模块或共享内存');
  const list = element('div', 'lab-memory-list');
  sidebar.append(search, list);
  const stage = element('main', 'lab-memory-stage');
  const toolbar = element('div', 'lab-memory-toolbar');
  const graphHost = element('div', 'lab-memory-graph');
  const svg = svgElement('svg', { role: 'group', 'aria-label': '模块与共享内存关系图', tabindex: '0' });
  const graph = svgElement('g'); svg.append(graph); graphHost.append(svg);
  const hint = element('div', 'lab-memory-hint', '拖动节点调整布局 · 拖动空白平移 · 滚轮缩放 · 点击查看数据');
  stage.append(toolbar, graphHost, hint);
  const inspector = element('aside', 'lab-memory-inspector');
  const heading = element('h3', '', '选择模块或共享内存');
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
  let nodes: GraphNode[] = [];
  const positions = new Map<string, GraphPoint>();
  const nodeElements = new Map<string, SVGGElement>();
  let links: { element: SVGPathElement; source: GraphNode; target: GraphNode }[] = [];
  let frame = 0;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let gesture: { pointerId: number; start: GraphPoint; origin: GraphPoint; node?: GraphNode; moved: boolean } | undefined;
  const sampling = element('input'); sampling.type = 'checkbox'; sampling.checked = true;
  const sampleLabel = element('label'); sampleLabel.append(sampling, document.createTextNode('当前数据采样 · 4Hz'));

  const summary = (key: string) => {
    try { return flattenSharedData(memory.inspectValue(key), 4).filter(field => field.path !== '…').map(field => `${field.path}: ${shorten(field.value, 35)}`).join(' · '); }
    catch (error) { return `观察失败：${error instanceof Error ? error.message : String(error)}`; }
  };
  const select = (next?: Selection) => {
    if (selection?.kind === next?.kind && selection?.id === next?.id) return;
    if (!selection || !next || nodeId(selection) !== nodeId(next)) { valueInspector.reset(); inspector.scrollTop = 0; }
    selection = next; fieldSearch.value = ''; syncSelection(); renderDetails();
  };

  const renderDetails = () => {
    if (!layer.visible) return;
    if (!selection) { details.replaceChildren(); detailsViewKey = ''; heading.textContent = '选择模块或共享内存'; meta.textContent = '连线表示实际申请关系。'; fieldSearch.hidden = true; return; }
    fieldSearch.hidden = selection.kind !== 'memory';
    heading.textContent = selection.id;
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
      valueInspector.update(memory.inspectValue(entry.key), fieldSearch.value);
    } catch (error) { valueInspector.update({ error: error instanceof Error ? error.message : String(error) }); }
  };

  const buildNodes = () => {
    const filter = search.value.toLowerCase();
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
    for (const entry of entries) {
      const target = nodes.find(node => node.kind === 'memory' && node.id === entry.key);
      if (!target) continue;
      for (const moduleId of entry.modules) {
        const source = nodes.find(node => node.kind === 'module' && node.id === moduleId);
        if (!source) continue;
        const active = !selection || (selection.kind === 'module' ? selection.id === moduleId : selection.id === entry.key);
        const fromX = source.x + source.width, fromY = source.y + source.height / 2;
        const toX = target.x, toY = target.y + target.height / 2;
        const line = svgElement('path', {
          d: `M${fromX},${fromY} C${fromX + 70},${fromY} ${toX - 70},${toY} ${toX},${toY}`,
          class: active ? 'is-active' : 'is-dimmed', fill: 'none', 'data-module': moduleId, 'data-memory': entry.key,
        });
        const title = svgElement('title'); title.textContent = `${moduleId} 申请 ${entry.key}`; line.append(title); graph.append(line);
        links.push({ element: line, source, target });
      }
    }
    for (const node of nodes) {
      const active = selection && nodeId(selection) === nodeId(node);
      const group = svgElement('g', {
        transform: `translate(${node.x} ${node.y})`, class: `lab-memory-node is-${node.kind}${active ? ' is-selected' : ''}`,
        tabindex: '0', role: 'button', 'aria-label': `${node.kind === 'module' ? '模块' : '共享内存'} ${node.title}`, 'data-node': nodeId(node),
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
      const x = link.source.x + link.source.width, y = link.source.y + link.source.height / 2, tx = link.target.x, ty = link.target.y + link.target.height / 2;
      link.element.setAttribute('d', `M${x},${y} C${x + 70},${y} ${tx - 70},${ty} ${tx},${ty}`);
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
    entries = memory.inspect(); count.textContent = `${modules.length} 个模块 · ${entries.length} 块共享内存`;
    if (!layer.visible) return;
    buildNodes();
    if (gesture?.node) gesture.node = nodes.find(node => nodeId(node) === nodeId(gesture!.node!));
    list.replaceChildren();
    for (const kind of ['module', 'memory'] as const) {
      list.append(element('h4', '', kind === 'module' ? '模块' : '共享内存'));
      for (const node of nodes.filter(node => node.kind === kind)) {
        const item = button(node.title, () => select(node));
        item.className = selection && nodeId(selection) === nodeId(node) ? 'is-active' : '';
        item.dataset.node = nodeId(node);
        item.title = node.id; list.append(item);
      }
    }
    if (!nodes.length) list.append(element('p', 'lab-memory-empty', '没有匹配的模块或内存。'));
    draw(); renderDetails();
  };
  const fit = () => { view = fitGraphView(nodes, { width: graphHost.clientWidth, height: graphHost.clientHeight }, 0.12); syncGeometry(); };
  const schedule = () => {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  };
  const syncSampling = () => {
    if (timer) clearInterval(timer); timer = undefined;
    if (!disposed && layer.visible && sampling.checked) timer = setInterval(renderDetails, 250);
  };
  const open = () => { layer.show(); render(); fit(); syncSampling(); };
  panel.content.append(count, button('打开系统图与共享数据', open));
  toolbar.append(element('strong', '', '模块 → 共享内存'), button('适配全部', fit), button('刷新数据', render), sampleLabel);
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
  const offMemory = memory.subscribe(schedule);
  render();
  return () => {
    disposed = true; offMemory(); if (frame) cancelAnimationFrame(frame); if (timer) clearInterval(timer);
    visibilityObserver.disconnect(); resizeObserver.disconnect(); layer.dispose(); panel.root.remove();
  };
};
