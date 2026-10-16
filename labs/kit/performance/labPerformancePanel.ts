import type { LabUi } from '../labUi';
import type { LabViewportManager } from '../labViewportManager';
import type { LabPerformance } from './LabPerformance';
import './lab-performance.css';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => { const node = document.createElement(tag); node.textContent = text; return node; };
const ms = (value: number) => value.toFixed(3);
export function createLabPerformancePanel(ui: LabUi, viewport: LabViewportManager, stats: LabPerformance) {
  const panel = ui.addPanel('system-performance', 'Lab 性能统计'); panel.root.classList.add('lab-system-panel');
  const layer = viewport.openHtmlLayer({ id: 'lab:performance', title: 'Lab 性能统计工作台', mode: 'exclusive', initiallyVisible: false,
    interactive: true, pauseBabylonRendering: false, fullWindow: true });
  layer.root.classList.add('lab-memory-overlay'); layer.content.classList.add('lab-performance-workspace');
  const toolbar = el('div'), status = el('p'), notice = el('p'); toolbar.className = 'lab-performance-toolbar';
  const search = el('input'); search.placeholder = '搜索模块'; search.setAttribute('aria-label', '搜索性能统计模块');
  const mode = el('select'); mode.setAttribute('aria-label', '性能统计类型');
  for (const [value, label] of [['runtime', '运行耗时'], ['tasks', '模拟与 Debug 任务'], ['lifecycle', '初始化与释放'], ['async', '异步完成时间']]) { const option = el('option', label); option.value = value; mode.append(option); }
  const sort = el('select'); sort.setAttribute('aria-label', '性能排序');
  for (const [value, label] of [['total', '累计耗时'], ['mean', '平均每帧'], ['p95', '每帧 P95'], ['max', '最大单帧']]) { const option = el('option', label); option.value = value; sort.append(option); }
  const table = el('table'), head = el('thead'), body = el('tbody'); table.append(head, body);
  const rows = new Map<string, HTMLTableRowElement>();
  const updateRow = (key: string, values: string[]) => {
    let row = rows.get(key);
    if (!row) { row = el('tr'); row.dataset.performanceRow = key; values.forEach(() => row!.append(el('td'))); rows.set(key, row); }
    values.forEach((value, index) => { if (row!.cells[index].textContent !== value) row!.cells[index].textContent = value; }); return row;
  };
  let timer: ReturnType<typeof setInterval> | undefined, disposed = false, headerKey = '';
  const render = () => {
    if (disposed || !layer.visible) return;
    const snapshot = stats.inspect(), query = search.value.trim().toLowerCase();
    status.textContent = `${snapshot.enabled ? '正在采集' : '采集已停止'} · 已采集 ${snapshot.frames} 帧 · 数值单位：毫秒`;
    notice.textContent = snapshot.coverage + ' 初始化与释放始终独立记录。运行累计为去重后的同步入口时间；异步完成时间不可相加作为 CPU 时间。每帧指标不包含帧间通信回调。';
    const headers = mode.value === 'runtime'
      ? ['模块 / 公共开销', '入口调用数', '同步累计', '平均每帧', '每帧 P95', '最大单帧', '平均每次', '每次 P95', '最大一次', '异常数']
      : mode.value === 'tasks' ? ['模块', '阶段 / 任务', '运行次数', '判断次数', '同步累计', '平均每帧', '每帧 P95', '最大单帧', '平均每次运行', '运行 P95', '最大一次运行', '判断累计', '异常数']
      : ['模块', '类别', '完成次数', '完成累计', '平均完成时间', '完成 P95', '最大完成时间'];
    const signature = headers.join('|');
    if (signature !== headerKey) { headerKey = signature; const row = el('tr'); headers.forEach(label => row.append(el('th', label))); head.replaceChildren(row); body.replaceChildren(); rows.clear(); }
    const displayed: { key: string; values: string[] }[] = [];
    const matches = (id: string) => !query || id.toLowerCase().includes(query);
    if (mode.value === 'runtime') {
      const score = (row: typeof snapshot.modules[number]) => sort.value === 'mean' ? row.frame.meanMs : sort.value === 'p95' ? row.frame.p95Ms : sort.value === 'max' ? row.frame.maxMs : row.selfTotalMs;
      const sorted = snapshot.modules.filter(row => matches(row.moduleId)).sort((a, b) => {
        const publicA = a.moduleId.startsWith('lab:host'), publicB = b.moduleId.startsWith('lab:host');
        return Number(publicA) - Number(publicB) || score(b) - score(a) || a.moduleId.localeCompare(b.moduleId);
      });
      for (const row of sorted) displayed.push({ key: row.moduleId, values: [row.moduleId, String(row.calls), ms(row.selfTotalMs),
        snapshot.frames ? ms(row.frame.meanMs) : '—', snapshot.frames ? ms(row.frame.p95Ms) : '—', snapshot.frames ? ms(row.frame.maxMs) : '—', ms(row.invocation.meanMs), ms(row.invocation.p95Ms), ms(row.invocation.maxMs), String(row.errors)] });
    } else if (mode.value === 'tasks') {
      const phaseLabels = { simulation: '模拟', presentation: '表现', debug: 'Debug' };
      const tasks = snapshot.modules.filter(module => matches(module.moduleId)).flatMap(module => module.tasks.map(task => ({ moduleId: module.moduleId, ...task })));
      const score = (task: typeof tasks[number]) => sort.value === 'mean' ? task.frame.meanMs : sort.value === 'p95' ? task.frame.p95Ms : sort.value === 'max' ? task.frame.maxMs : task.self.totalMs;
      for (const task of tasks.sort((a, b) => score(b) - score(a) || a.moduleId.localeCompare(b.moduleId) || a.taskId.localeCompare(b.taskId))) displayed.push({
        key: JSON.stringify([task.moduleId, task.phase, task.taskId]),
        values: [task.moduleId, `${phaseLabels[task.phase]} · ${task.taskId}（${task.description}）`, String(task.runs), String(task.enabledChecks), ms(task.self.totalMs),
          snapshot.frames ? ms(task.frame.meanMs) : '—', snapshot.frames ? ms(task.frame.p95Ms) : '—', snapshot.frames ? ms(task.frame.maxMs) : '—',
          ms(task.run.meanMs), ms(task.run.p95Ms), ms(task.run.maxMs), ms(task.enabled.totalMs), String(task.errors)],
      });
    } else {
      const entries = mode.value === 'lifecycle' ? snapshot.lifecycle : snapshot.modules.flatMap(row => row.categories).filter(entry => entry.completion.count);
      const labels: Record<string, string> = { setup: '初始化', start: '启动', dispose: '释放', event: '事件监听', request: '请求处理', task: '调度任务', host: '公共开销' };
      for (const row of entries.filter(row => matches(row.moduleId)).sort((a, b) => b.completion.totalMs - a.completion.totalMs)) displayed.push({
        key: `${row.moduleId}:${row.kind}`, values: [row.moduleId, labels[row.kind], String(row.completion.count), ms(row.completion.totalMs), ms(row.completion.meanMs), ms(row.completion.p95Ms), ms(row.completion.maxMs)] });
    }
    const keep = new Set(displayed.map(row => row.key));
    for (const [key, row] of rows) if (!keep.has(key)) { row.remove(); rows.delete(key); }
    displayed.forEach((item, index) => { const row = updateRow(item.key, item.values); if (body.children[index] !== row) body.insertBefore(row, body.children[index] ?? null); });
    if (!displayed.length) { const row = updateRow('empty', ['尚无记录或没有匹配模块', ...Array(headers.length - 1).fill('')]); body.append(row); }
  };
  const button = (label: string, action: () => void, id: string) => { const node = el('button', label); node.type = 'button'; node.dataset.performanceAction = id; node.addEventListener('click', action); return node; };
  const syncTimer = () => { if (timer) clearInterval(timer); timer = undefined; if (!disposed && layer.visible) { render(); timer = setInterval(render, 1000); } };
  toolbar.append(el('strong', '模块级性能统计'),
    button('开始采集', () => { stats.start(); render(); }, 'start'), button('停止采集', () => { stats.stop(); render(); }, 'stop'),
    button('清空记录', () => { stats.clear(); render(); }, 'clear'), button('导出 JSON', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(stats.inspect(), null, 2)], { type: 'application/json' }));
      const link = el('a'); link.href = url; link.download = 'lab-performance.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    }, 'export'), search, mode, sort);
  layer.content.append(toolbar, status, notice, table);
  panel.content.append(el('p', '按模块统计耗时，可分别查看模拟与 Debug 任务。运行采集默认关闭。'), button('打开性能工作台', () => { layer.show(); syncTimer(); }, 'open'));
  search.addEventListener('input', render); mode.addEventListener('change', render); sort.addEventListener('change', render);
  const observer = new MutationObserver(syncTimer); observer.observe(layer.root, { attributes: true, attributeFilter: ['hidden'] });
  return () => { disposed = true; if (timer) clearInterval(timer); observer.disconnect(); layer.dispose(); panel.root.remove(); };
}
