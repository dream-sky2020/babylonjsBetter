import { useRef, useState, type ReactNode } from 'react';
import { dockRects, moveDockPanel, setDockRatio, type DockEdge, type DockNode } from './dockLayout.ts';
import './DockWorkspace.css';

export function DockWorkspace<P extends string>({ panels, labels, tree, visible, collapsed, contents, onTreeChange, onCollapse, onHide, classPrefix = 'editor' }: {
  panels: readonly P[]; labels: Record<P, string>; tree: DockNode<P>; visible: readonly P[];
  collapsed: Partial<Record<P, boolean>>; contents: Record<P, ReactNode>;
  onTreeChange(tree: DockNode<P>): void; onCollapse(panel: P): void; onHide(panel: P): void; classPrefix?: string;
}) {
  const area = useRef<HTMLDivElement>(null);
  const dragged = useRef<{ panel: P; x: number; y: number; moved: boolean } | null>(null);
  const skipClick = useRef(false);
  const [drop, setDrop] = useState<{ target: P; edge: DockEdge } | null>(null);
  const positions = dockRects(tree, visible);
  const targetAt = (x: number, y: number) => {
    const target = [...(area.current?.querySelectorAll<HTMLElement>(':scope > .editor-dock-panel:not([hidden])') ?? [])].find(element => {
      const rect = element.getBoundingClientRect();
      return element.dataset.panel !== dragged.current?.panel && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    const distances = { left: (x - rect.left) / rect.width, right: (rect.right - x) / rect.width, top: (y - rect.top) / rect.height, bottom: (rect.bottom - y) / rect.height };
    return { target: target.dataset.panel as P, edge: (Object.keys(distances) as DockEdge[]).sort((a, b) => distances[a] - distances[b])[0] };
  };
  return <div ref={area} className={`editor-dock-area ${classPrefix}-dock-area`}>
    {panels.map(panel => {
      const rect = positions.leaves.get(panel), folded = collapsed[panel];
      return <section key={panel} className={`editor-dock-panel ${classPrefix}-dock-panel`} data-panel={panel} aria-label={labels[panel]} hidden={!rect}
        style={rect ? { left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` } : undefined}>
        <header data-dock-drag aria-label={`拖动${labels[panel]}`} title="拖动标题栏到其他面板边缘，调整排列位置"
          onPointerDown={event => { skipClick.current = false; if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return; dragged.current = { panel, x: event.clientX, y: event.clientY, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { const drag = dragged.current; if (!drag || drag.panel !== panel || !event.currentTarget.hasPointerCapture(event.pointerId)) return; if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) drag.moved = true; if (drag.moved) { event.preventDefault(); setDrop(targetAt(event.clientX, event.clientY)); } }}
          onPointerUp={event => { const drag = dragged.current; if (drag?.moved) { skipClick.current = true; const target = targetAt(event.clientX, event.clientY); if (target) onTreeChange(moveDockPanel(tree, panel, target.target, target.edge)); } dragged.current = null; setDrop(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { dragged.current = null; setDrop(null); }}
          onClickCapture={event => { if (skipClick.current) { event.stopPropagation(); skipClick.current = false; } }}>
          <span className="editor-dock-grip" aria-hidden="true">⠿</span><button type="button" aria-expanded={!folded} onClick={() => onCollapse(panel)}>{folded ? '▸' : '▾'} {labels[panel]}</button><button type="button" aria-label={`隐藏${labels[panel]}`} onClick={() => onHide(panel)}>×</button>
        </header>
        <div className={`editor-dock-body ${classPrefix}-list-panel-body`} hidden={folded}>{contents[panel]}</div>
        {drop?.target === panel && <div className={`editor-dock-drop ${classPrefix}-panel-drop-preview ${drop.edge}`}>放到{({ left: '左侧', right: '右侧', top: '上方', bottom: '下方' })[drop.edge]}</div>}
      </section>;
    })}
    {positions.splits.map(split => <div key={split.id} className={`editor-dock-splitter ${classPrefix}-dock-splitter ${split.axis}`} role="separator" aria-label={`调整面板分区 ${split.id}`} aria-orientation={split.axis === 'x' ? 'vertical' : 'horizontal'} aria-valuemin={15} aria-valuemax={85} aria-valuenow={Math.round(split.ratio * 100)} tabIndex={0}
      style={split.axis === 'x' ? { left: `calc(${(split.rect.x + split.rect.w * split.ratio) * 100}% - 3px)`, top: `${split.rect.y * 100}%`, height: `${split.rect.h * 100}%`, width: 6 } : { top: `calc(${(split.rect.y + split.rect.h * split.ratio) * 100}% - 3px)`, left: `${split.rect.x * 100}%`, width: `${split.rect.w * 100}%`, height: 6 }}
      onPointerDown={event => { if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId) || !area.current) return;
        const rect = area.current.getBoundingClientRect(), extent = split.axis === 'x' ? rect.width * split.rect.w : rect.height * split.rect.h;
        if (extent <= 0) return;
        const relative = split.axis === 'x' ? (event.clientX - rect.left) - rect.width * split.rect.x : (event.clientY - rect.top) - rect.height * split.rect.y;
        const minimum = Math.min(.45, (split.axis === 'x' ? 100 : 70) / extent);
        onTreeChange(setDockRatio(tree, split.id, Math.max(minimum, Math.min(1 - minimum, relative / extent))));
      }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onDoubleClick={() => onTreeChange(setDockRatio(tree, split.id, .5))}
      onKeyDown={event => { const keys = split.axis === 'x' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']; if (keys.includes(event.key)) { event.preventDefault(); onTreeChange(setDockRatio(tree, split.id, split.ratio + (event.key === keys[0] ? -.05 : .05))); } }} />)}
  </div>;
}
