import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PanelOptions, PanelSettingField, PanelValue } from './panelSettings.ts';
export function PanelContextMenu({ title, x, y, fields, options, disabled, change, reset, openSettings, close }: { title: string; x: number; y: number; fields: readonly PanelSettingField[]; options: PanelOptions; disabled: boolean; change: (key: string, value: PanelValue) => void; reset: () => void; openSettings: () => void; close: () => void }) {
  const menu = useRef<HTMLDivElement>(null); const [position, setPosition] = useState({ x, y });
  useLayoutEffect(() => { const box = menu.current!.getBoundingClientRect(); setPosition({ x: Math.max(4, Math.min(x, window.innerWidth - box.width - 4)), y: Math.max(4, Math.min(y, window.innerHeight - box.height - 4)) }); menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, [x, y]);
  useEffect(() => {
    const dismiss = (event: Event) => { if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    document.addEventListener('pointerdown', dismiss, true); window.addEventListener('keydown', key); window.addEventListener('resize', close); window.addEventListener('scroll', dismiss, true);
    return () => { document.removeEventListener('pointerdown', dismiss, true); window.removeEventListener('keydown', key); window.removeEventListener('resize', close); window.removeEventListener('scroll', dismiss, true); };
  }, [close]);
  return createPortal(<div ref={menu} className="wb-panel-menu" role="menu" aria-label={`${title}设置菜单`} style={{ left: position.x, top: position.y }} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    const buttons = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); if (!buttons.length) return;
    event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length].focus();
  }}><strong>{title}</strong>{fields.map(field => <div role="group" aria-label={field.label} key={field.key}><small>{field.label}</small>{field.type === 'select' ? field.options.map(value => <button disabled={disabled} key={String(value.value)} role="menuitemradio" aria-checked={options[field.key] === value.value} onClick={() => change(field.key, value.value)}>{options[field.key] === value.value ? '✓ ' : '　'}{value.label}</button>) : field.type === 'boolean' ? <button disabled={disabled} role="menuitemcheckbox" aria-checked={options[field.key] === true} onClick={() => change(field.key, options[field.key] !== true)}>{options[field.key] ? '✓ ' : '　'}{field.label}</button> : <button disabled={disabled} role="menuitem" onClick={openSettings}>调整{field.label}…</button>}</div>)}{!fields.length && <small>此面板暂无自定义选项</small>}<button role="menuitem" onClick={openSettings}>在布局设置中调整…</button><button role="menuitem" disabled={disabled || !fields.length} onClick={reset}>恢复此面板默认设置</button><button role="menuitem" onClick={close}>关闭菜单</button></div>, document.body);
}
