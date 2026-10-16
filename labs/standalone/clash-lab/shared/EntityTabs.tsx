import { useEffect, useId, useRef, type ReactNode } from 'react';

type Item = { id: string; label: string };
type Props = {
  label: string;
  items: Item[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  children: ReactNode;
};

export function EntityTabs({ label, items, selectedId, onSelect, onAdd, onRemove, disabled = false, children }: Props) {
  const prefix = useId();
  const strip = useRef<HTMLDivElement>(null);
  const selected = items.find(item => item.id === selectedId);
  const tabId = (id: string) => `${prefix}-tab-${id}`;
  const panelId = `${prefix}-panel`;
  useEffect(() => {
    const container = strip.current;
    const tab = container?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!container || !tab) return;
    const left = tab.offsetLeft;
    if (left < container.scrollLeft) container.scrollLeft = left;
    else if (left + tab.offsetWidth > container.scrollLeft + container.clientWidth) container.scrollLeft = left + tab.offsetWidth - container.clientWidth;
  }, [selectedId, items.length]);
  return <div className="xp-entity-tabs">
    <div className="xp-tab-strip">
      <span className="xp-tab-caption">{label}</span>
      <div className="xp-tabs-scroll" ref={strip} role="tablist" aria-label={label}>
        {items.map((item, index) => <button key={item.id} id={tabId(item.id)} role="tab" type="button" aria-selected={item.id === selectedId} aria-controls={panelId}
          tabIndex={disabled ? -1 : (selected ? item.id === selectedId : index === 0) ? 0 : -1} disabled={disabled} title={`${item.label} (${item.id})`}
          onClick={() => onSelect(item.id)} onKeyDown={event => {
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % items.length;
            else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = items.length - 1;
            else return;
            event.preventDefault(); onSelect(items[next].id);
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          }}><span>{item.label || '未命名'}</span></button>)}
        {!items.length && <span className="xp-tabs-empty">暂无项目</span>}
      </div>
      <button type="button" className="xp-tab-command" aria-label={`新建${label}`} title={`新建${label}`} disabled={disabled} onClick={onAdd}>＋ 新建</button>
      <button type="button" className="xp-tab-command" aria-label={`删除当前${label}`} title={selected ? `删除 ${selected.label}` : '请先选择项目'} disabled={disabled || !selected} onClick={() => { if (selected) onRemove(selected.id); }}>删除</button>
    </div>
    <div className="xp-tab-panel" role="tabpanel" id={panelId} aria-labelledby={selected ? tabId(selected.id) : undefined} aria-label={selected ? undefined : label}>{children}</div>
  </div>;
}
