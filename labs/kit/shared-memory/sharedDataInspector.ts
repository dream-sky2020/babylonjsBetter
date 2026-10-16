import { flattenSharedData } from './flattenSharedData.ts';

type Step = { kind: 'property'; key: string } | { kind: 'map'; key: unknown; index: number } | { kind: 'set'; index: number };
type Row = {
  id: string; name: string; path: Step[]; text: string; depth: number;
  action?: 'expand' | 'enter' | 'page'; open?: boolean; page?: number; pages?: number;
};
const PAGE_SIZE = 20;
const MAX_ROWS = 200;
const missing = Symbol('missing');
const label = (step: Step) => step.kind === 'property' ? step.key : step.kind === 'map' ? String(step.key) : `[${step.index}]`;
const identity = (path: Step[]) => JSON.stringify(path.map(step => step.kind === 'property' ? ['p', step.key]
  : step.kind === 'map' ? ['m', typeof step.key, typeof step.key === 'object' ? step.index : String(step.key)] : ['s', step.index]));
const pathText = (path: Step[]) => path.map(label).join('.');
const container = (value: unknown): value is object => value !== null && typeof value === 'object' && !(value instanceof Date);
const size = (value: object) => value instanceof Map || value instanceof Set ? value.size : Object.keys(value).length;
const preview = (value: unknown): string => {
  if (value === missing) return '[内容已移除]';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '[无效日期]' : value.toISOString();
  if (container(value)) return `${Array.isArray(value) ? '数组' : value instanceof Map ? 'Map' : value instanceof Set ? 'Set' : '对象'} · ${size(value)} 项`;
  const text = String(value);
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
};
const read = (value: unknown, step: Step): unknown => {
  if (!container(value)) return missing;
  if (step.kind === 'map') return value instanceof Map && value.has(step.key) ? value.get(step.key) : missing;
  if (step.kind === 'set') return value instanceof Set && step.index < value.size ? [...value].at(step.index) : missing;
  return Object.hasOwn(value, step.key) ? (value as Record<string, unknown>)[step.key] : missing;
};
const children = (value: object, page: number): { step: Step; value: unknown }[] => {
  const start = page * PAGE_SIZE, end = start + PAGE_SIZE;
  const result: { step: Step; value: unknown }[] = [];
  if (value instanceof Map || value instanceof Set) {
    let index = 0;
    for (const entry of value instanceof Map ? value.entries() : value.values()) {
      if (index >= end) break;
      if (index >= start) result.push(value instanceof Map
        ? { step: { kind: 'map', key: entry[0], index }, value: entry[1] }
        : { step: { kind: 'set', index }, value: entry });
      index += 1;
    }
  } else {
    for (const key of Object.keys(value).slice(start, end)) {
      try { result.push({ step: { kind: 'property', key }, value: read(value, { kind: 'property', key }) }); }
      catch (error) { result.push({ step: { kind: 'property', key }, value: `[读取失败：${error instanceof Error ? error.message : String(error)}]` }); }
    }
  }
  return result;
};

export type SharedDataInspector = {
  root: HTMLDivElement;
  update(value: unknown, filter?: string): void;
  reset(): void;
};

/** Bounded debug-only tree. Keeps controls, expansion, pagination and unchanged field DOM stable. */
export const createSharedDataInspector = (): SharedDataInspector => {
  const root = document.createElement('div'); root.className = 'lab-memory-value-inspector';
  const controls = document.createElement('div'); controls.className = 'lab-memory-value-controls';
  const mode = document.createElement('select'); mode.setAttribute('aria-label', '数据显示方式');
  for (const [value, text] of [['nested', '有限嵌套'], ['flat', '平铺路径']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; mode.append(option);
  }
  const depth = document.createElement('select'); depth.setAttribute('aria-label', '显示层数');
  for (const value of ['2', '3']) {
    const option = document.createElement('option'); option.value = value; option.textContent = `${value} 层`; depth.append(option);
  }
  controls.append(mode, depth);
  const breadcrumbs = document.createElement('nav'); breadcrumbs.className = 'lab-memory-breadcrumbs'; breadcrumbs.setAttribute('aria-label', '数据位置');
  const note = document.createElement('p'); note.className = 'lab-memory-empty';
  const table = document.createElement('table'); table.className = 'lab-memory-fields';
  const head = document.createElement('thead'), header = document.createElement('tr');
  for (const text of ['字段', '当前值']) { const cell = document.createElement('th'); cell.textContent = text; header.append(cell); }
  head.append(header); const body = document.createElement('tbody'); table.append(head, body);
  root.append(controls, breadcrumbs, note, table);
  let value: unknown;
  let filter = '';
  let location: Step[] = [];
  const expanded = new Set<string>();
  const collapsed = new Set<string>();
  const pages = new Map<string, number>();
  const rowElements = new Map<string, { row: HTMLTableRowElement; name: HTMLTableCellElement; text: HTMLTableCellElement; signature: string; item: Row }>();
  let breadcrumbSignature = '';

  const resolve = () => {
    let current = value;
    for (const step of location) { current = read(current, step); if (current === missing) break; }
    return current;
  };
  const render = () => {
    depth.hidden = mode.value === 'flat';
    const crumbKey = identity(location);
    if (crumbKey !== breadcrumbSignature) {
      breadcrumbs.replaceChildren();
      for (let index = 0; index <= location.length; index += 1) {
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = index === 0 ? '根数据' : label(location[index - 1]);
        button.disabled = index === location.length;
        button.addEventListener('click', () => { location = location.slice(0, index); render(); }); breadcrumbs.append(button);
      }
      breadcrumbSignature = crumbKey;
    }
    const current = resolve();
    const rows: Row[] = [];
    let truncated = false;
    const add = (row: Row) => { if (rows.length < MAX_ROWS) rows.push(row); else truncated = true; };
    if (mode.value === 'flat') {
      for (const field of flattenSharedData(current)) {
        if (`${field.path} ${field.value}`.toLowerCase().includes(filter)) add({ id: `flat:${field.path}`, name: field.path, path: [], text: field.value, depth: 0 });
      }
    } else if (!container(current)) {
      if (preview(current).toLowerCase().includes(filter)) add({ id: 'scalar', name: '值', path: location, text: preview(current), depth: 0 });
    } else {
      const walk = (parent: object, path: Step[], level: number, ancestors: Set<object>) => {
        if (rows.length >= MAX_ROWS) { truncated = true; return; }
        const id = identity(path), total = size(parent), lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
        const page = Math.min(pages.get(id) ?? 0, lastPage);
        for (const child of children(parent, page)) {
          if (rows.length >= MAX_ROWS) { truncated = true; break; }
          const childPath = [...path, child.step], childId = identity(childPath);
          const cycle = container(child.value) && ancestors.has(child.value);
          const text = cycle ? '[循环引用]' : preview(child.value);
          const expandable = container(child.value) && size(child.value) > 0 && !cycle;
          const open = expanded.has(childId) || (level === 0 && path.length === location.length && !collapsed.has(childId));
          const action = expandable ? (level + 1 < Number(depth.value) ? 'expand' : 'enter') : undefined;
          const start = rows.length;
          const matches = `${pathText(childPath)} ${text}`.toLowerCase().includes(filter);
          add({ id: childId, name: Array.isArray(parent) ? `[${label(child.step)}]` : label(child.step), path: childPath, text, depth: level, action, open });
          if (action === 'expand' && (open || !!filter)) walk(child.value as object, childPath, level + 1, new Set([...ancestors, child.value as object]));
          if (filter && !matches && rows.length === start + 1) rows.pop();
        }
        if (total > PAGE_SIZE) add({ id: `${id}:page`, name: '列表分页', path, text: `${page + 1} / ${lastPage + 1} 页 · ${total} 项`, depth: level, action: 'page', page, pages: lastPage + 1 });
        if (!total && path.length === location.length) add({ id: 'empty', name: '值', path, text: preview(parent), depth: level });
      };
      walk(current, location, 0, new Set([current]));
    }
    note.textContent = truncated ? `当前最多显示 ${MAX_ROWS} 行，请收起分组或进入具体内容。`
      : !rows.length ? '当前页和层级没有匹配字段。' : '分组最多展示所选层数；更深内容可进入查看。集合每页 20 项。';
    const active = new Set(rows.map(row => row.id));
    for (const [id, entry] of rowElements) if (!active.has(id)) { entry.row.remove(); rowElements.delete(id); }
    rows.forEach((item, index) => {
      let entry = rowElements.get(item.id);
      if (!entry) {
        const row = document.createElement('tr'), name = document.createElement('td'), text = document.createElement('td');
        row.append(name, text); entry = { row, name, text, signature: '', item }; rowElements.set(item.id, entry);
      }
      entry.item = item;
      const signature = JSON.stringify([item.name, item.action, item.open, item.depth, item.page, item.pages]);
      if (signature !== entry.signature) {
        entry.name.replaceChildren(); entry.name.style.paddingLeft = `${5 + item.depth * 12}px`;
        if (item.action === 'expand' || item.action === 'enter') {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'lab-memory-field-toggle';
          button.textContent = `${item.action === 'enter' ? '↗' : item.open ? '▾' : '▸'} ${item.name}`;
          button.setAttribute('aria-label', `${item.action === 'enter' ? '进入' : item.open ? '收起' : '展开'} ${item.name}`);
          if (item.action === 'expand') button.setAttribute('aria-expanded', String(item.open));
          button.addEventListener('click', () => {
            const latest = rowElements.get(item.id)!.item;
            if (latest.action === 'enter') location = latest.path;
            else if (latest.open) { expanded.delete(latest.id); collapsed.add(latest.id); }
            else { expanded.add(latest.id); collapsed.delete(latest.id); }
            render();
          }); entry.name.append(button);
        } else if (item.action === 'page') {
          for (const [text, delta] of [['上一页', -1], ['下一页', 1]] as const) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
            button.setAttribute('aria-label', `${pathText(item.path) || '根数据'} ${text}`);
            button.disabled = (item.page! + delta) < 0 || (item.page! + delta) >= item.pages!;
            button.addEventListener('click', () => { const latest = rowElements.get(item.id)!.item; pages.set(identity(latest.path), latest.page! + delta); render(); }); entry.name.append(button);
          }
        } else entry.name.textContent = item.name;
        entry.signature = signature;
      }
      if (entry.text.textContent !== item.text) entry.text.textContent = item.text;
      if (body.children[index] !== entry.row) body.insertBefore(entry.row, body.children[index] ?? null);
    });
  };
  mode.addEventListener('change', render); depth.addEventListener('change', render);
  return {
    root,
    update(next, nextFilter = '') { value = next; filter = nextFilter.trim().toLowerCase(); render(); },
    reset() { location = []; expanded.clear(); collapsed.clear(); pages.clear(); breadcrumbSignature = ''; rowElements.clear(); body.replaceChildren(); },
  };
};
