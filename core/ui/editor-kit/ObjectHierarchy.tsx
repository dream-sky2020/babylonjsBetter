import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';

export type EditorHierarchyItem = {
  id: string;
  label: string;
  typeLabel?: string;
  parentId: string | null;
  childIds: string[];
  icon?: ReactNode;
  disabled?: boolean;
  locked?: boolean;
  draggable?: boolean;
  acceptsChildren?: boolean;
  badges?: Array<'hidden' | 'locked' | 'bound' | 'warning' | 'runtime'>;
  searchText?: string;
  title?: string;
};

export type EditorHierarchyDropPlacement = 'before' | 'after' | 'inside' | 'root-end';
export type EditorHierarchyDropIntent = {
  sourceIds: string[];
  placement: EditorHierarchyDropPlacement;
  targetId: string | null;
  parentId: string | null;
  targetIndex: number;
};

export type ObjectHierarchyProps = {
  items: Record<string, EditorHierarchyItem>;
  rootIds: string[];
  selectedIds: string[];
  eyebrow?: string;
  title?: string;
  status?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  emptyLabel?: string;
  searchPlaceholder?: string;
  className?: string;
  expandedIds?: ReadonlySet<string>;
  defaultExpandedIds?: Iterable<string>;
  onExpandedChange?(ids: Set<string>): void;
  onSelectionChange(ids: string[], mode: 'replace' | 'toggle'): void;
  onFocus?(id: string): void;
  onContextMenu?(event: MouseEvent, id: string): void;
  canDrop?(intent: EditorHierarchyDropIntent): boolean;
  onMove?(intent: EditorHierarchyDropIntent): void;
  onClearSelection?(): void;
};

const SearchIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>;
const Chevron = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 5 5-5 5" /></svg>;

export function ObjectHierarchy({
  items, rootIds, selectedIds, eyebrow = 'OBJECTS', title = '层级', status, action, footer,
  emptyLabel = '没有匹配对象', searchPlaceholder = '搜索对象', className = '', expandedIds,
  defaultExpandedIds, onExpandedChange, onSelectionChange, onFocus, onContextMenu, canDrop, onMove, onClearSelection,
}: ObjectHierarchyProps) {
  const [query, setQuery] = useState('');
  const [localExpanded, setLocalExpanded] = useState<Set<string>>(() => new Set(defaultExpandedIds));
  const [dragIds, setDragIds] = useState<string[]>([]);
  const [dropIntent, setDropIntent] = useState<EditorHierarchyDropIntent | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const expandTimerRef = useRef<number | undefined>(undefined);
  const expandTargetRef = useRef<string | null>(null);
  const expanded = expandedIds ?? localExpanded;
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  useEffect(() => () => window.clearTimeout(expandTimerRef.current), []);
  const selectedAncestors = useMemo(() => {
    const result = new Set<string>();
    selectedIds.forEach((id) => { let parentId = items[id]?.parentId ?? null; while (parentId) { result.add(parentId); parentId = items[parentId]?.parentId ?? null; } });
    return result;
  }, [items, selectedIds]);

  const matches = (id: string): boolean => {
    const item = items[id]; if (!item) return false;
    const ownText = `${item.label} ${item.typeLabel ?? ''} ${item.searchText ?? ''}`.toLocaleLowerCase();
    return ownText.includes(normalizedQuery) || item.childIds.some(matches);
  };
  const visibleRoots = normalizedQuery ? rootIds.filter(matches) : rootIds.filter((id) => Boolean(items[id]));
  const setExpanded = (next: Set<string>) => { if (!expandedIds) setLocalExpanded(next); onExpandedChange?.(next); };
  const toggle = (id: string) => { const next = new Set(expanded); if (next.has(id)) next.delete(id); else next.add(id); setExpanded(next); };
  const select = (event: MouseEvent, id: string) => onSelectionChange([id], event.ctrlKey || event.metaKey || event.shiftKey ? 'toggle' : 'replace');
  const clearDrag = () => { window.clearTimeout(expandTimerRef.current); expandTargetRef.current = null; setDragIds([]); setDropIntent(null); };
  const siblingsOf = (parentId: string | null) => parentId ? items[parentId]?.childIds ?? [] : rootIds;
  const isDescendantOf = (candidateId: string | null, ancestorId: string) => {
    let cursor = candidateId;
    while (cursor) { if (cursor === ancestorId) return true; cursor = items[cursor]?.parentId ?? null; }
    return false;
  };
  const validIntent = (intent: EditorHierarchyDropIntent) => {
    if (!intent.sourceIds.length || intent.sourceIds.some(id => items[id]?.locked || items[id]?.draggable === false)) return false;
    if (intent.placement === 'inside' && (!intent.targetId || !items[intent.targetId]?.acceptsChildren || items[intent.targetId]?.locked)) return false;
    if (intent.parentId && items[intent.parentId]?.locked) return false;
    if (intent.sourceIds.some(id => intent.targetId === id || isDescendantOf(intent.parentId, id))) return false;
    return canDrop?.(intent) ?? true;
  };
  const rowIntent = (event: DragEvent<HTMLDivElement>, targetId: string): EditorHierarchyDropIntent | null => {
    if (!dragIds.length) return null;
    const target = items[targetId]; if (!target) return null;
    const rect = event.currentTarget.getBoundingClientRect(); const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
    const placement: EditorHierarchyDropPlacement = target.acceptsChildren && ratio >= .25 && ratio <= .75 ? 'inside' : ratio < .5 ? 'before' : 'after';
    const parentId = placement === 'inside' ? targetId : target.parentId;
    const siblings = siblingsOf(parentId); const targetIndex = placement === 'inside' ? target.childIds.length : Math.max(0, siblings.indexOf(targetId) + (placement === 'after' ? 1 : 0));
    return { sourceIds: dragIds, placement, targetId, parentId, targetIndex };
  };
  const scheduleExpand = (intent: EditorHierarchyDropIntent) => {
    if (intent.placement !== 'inside' || !intent.targetId || expanded.has(intent.targetId)) { window.clearTimeout(expandTimerRef.current); expandTargetRef.current = null; return; }
    if (expandTargetRef.current === intent.targetId) return;
    window.clearTimeout(expandTimerRef.current); expandTargetRef.current = intent.targetId;
    expandTimerRef.current = window.setTimeout(() => { const next = new Set(expanded); next.add(intent.targetId as string); setExpanded(next); expandTargetRef.current = null; }, 500);
  };
  const autoScroll = (clientY: number) => {
    const tree = treeRef.current; if (!tree) return; const rect = tree.getBoundingClientRect(); const edge = 32;
    if (clientY < rect.top + edge) tree.scrollBy({ top: -18 }); else if (clientY > rect.bottom - edge) tree.scrollBy({ top: 18 });
  };
  const previewRowDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    if (!onMove) return; event.preventDefault(); event.stopPropagation(); autoScroll(event.clientY);
    const intent = rowIntent(event, targetId); if (!intent) return; const valid = validIntent(intent);
    event.dataTransfer.dropEffect = valid ? 'move' : 'none'; setDropIntent(intent); if (valid) scheduleExpand(intent);
  };
  const commitRowDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    if (!onMove) return; event.preventDefault(); event.stopPropagation(); const intent = rowIntent(event, targetId);
    if (intent && validIntent(intent)) onMove(intent); clearDrag();
  };
  const rootIntent = (): EditorHierarchyDropIntent => ({ sourceIds: dragIds, placement: 'root-end', targetId: null, parentId: null, targetIndex: rootIds.length });
  const describeIntent = (intent: EditorHierarchyDropIntent) => {
    const count = intent.sourceIds.length > 1 ? `${intent.sourceIds.length} 个对象` : `“${items[intent.sourceIds[0]]?.label ?? '对象'}”`;
    if (intent.placement === 'root-end') return `${count}移至根层级末尾`;
    const target = items[intent.targetId ?? '']?.label ?? '目标';
    return intent.placement === 'inside' ? `${count}移入“${target}”` : `${count}放到“${target}”${intent.placement === 'before' ? '之前' : '之后'}`;
  };

  const renderItem = (id: string, depth: number): ReactNode => {
    const item = items[id]; if (!item) return null;
    const childIds = normalizedQuery ? item.childIds.filter(matches) : item.childIds.filter((childId) => Boolean(items[childId]));
    const open = Boolean(normalizedQuery) || expanded.has(id) || selectedAncestors.has(id);
    const activeDrop = dropIntent?.targetId === id ? dropIntent : null; const dropValid = activeDrop ? validIntent(activeDrop) : false;
    return <div className="editor-hierarchy-branch" key={id}>
      <div className={`editor-hierarchy-row${selected.has(id) ? ' selected' : ''}${item.disabled ? ' disabled' : ''}${activeDrop ? ` drop-${activeDrop.placement}${dropValid ? '' : ' drop-invalid'}` : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }} title={item.title}
        draggable={Boolean(onMove) && item.draggable !== false && !item.locked}
        onDragStart={event => { const ids = selected.has(id) ? selectedIds.filter(selectedId => items[selectedId] && !items[selectedId].locked && items[selectedId].draggable !== false) : [id]; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-editor-objects', JSON.stringify(ids)); setDragIds(ids); }}
        onDragEnd={clearDrag} onDragOver={event => previewRowDrop(event, id)} onDrop={event => commitRowDrop(event, id)}
        onClick={event => select(event, id)} onDoubleClick={() => onFocus?.(id)} onContextMenu={event => onContextMenu?.(event, id)}>
        <button className={`editor-hierarchy-chevron${childIds.length ? '' : ' empty'}${open ? ' open' : ''}`} aria-label={open ? '收起' : '展开'} onClick={event => { event.stopPropagation(); toggle(id); }}><Chevron /></button>
        <span className="editor-hierarchy-icon">{item.icon ?? <i />}</span><span className="editor-hierarchy-label">{item.label}</span>
        {item.badges?.length ? <span className="editor-hierarchy-badges">{item.badges.map(badge => <i key={badge} className={badge} title={badge} />)}</span> : null}{item.typeLabel && <small>{item.typeLabel}</small>}
        {activeDrop && <span className="editor-hierarchy-drop-hint">{dropValid ? describeIntent(activeDrop) : '不能放置在这里'}</span>}
      </div>
      {open && childIds.map(childId => renderItem(childId, depth + 1))}
    </div>;
  };

  const activeRootDrop = dropIntent?.placement === 'root-end' ? dropIntent : null; const rootDropValid = activeRootDrop ? validIntent(activeRootDrop) : false;
  return <aside className={`editor-hierarchy ${className}`.trim()} aria-label={`${title}层级`}>
    <header className="editor-hierarchy-heading"><div><b>{eyebrow}</b><span>{title}</span></div><div className="editor-hierarchy-heading-actions">{status && <em>{status}</em>}{action}</div></header>
    <label className="editor-hierarchy-search"><SearchIcon /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={searchPlaceholder} /></label>
    <div ref={treeRef} className="editor-hierarchy-tree" onClick={event => { if (event.target === event.currentTarget) onClearSelection?.(); }}>{visibleRoots.length ? visibleRoots.map(id => renderItem(id, 0)) : <p>{emptyLabel}</p>}</div>
    {onMove && <div className={`editor-hierarchy-root-drop${activeRootDrop ? ` active${rootDropValid ? '' : ' invalid'}` : ''}`}
      onDragOver={event => { event.preventDefault(); const intent = rootIntent(); event.dataTransfer.dropEffect = validIntent(intent) ? 'move' : 'none'; setDropIntent(intent); }}
      onDrop={event => { event.preventDefault(); const intent = rootIntent(); if (validIntent(intent)) onMove(intent); clearDrag(); }}>
      {activeRootDrop ? (rootDropValid ? describeIntent(activeRootDrop) : '不能移至根层级') : '拖到这里移至根层级末尾'}
    </div>}
    {footer && <footer>{footer}</footer>}
  </aside>;
}
