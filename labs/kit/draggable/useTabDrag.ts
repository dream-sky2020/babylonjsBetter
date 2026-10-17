import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export type TabPoint = { x: number; y: number };
export function useTabDrag() {
  const cleanup = useRef<() => void>(() => {});
  const suppressClick = useRef(false);
  useEffect(() => () => cleanup.current(), []);
  return {
    suppressClick,
    start(event: ReactPointerEvent<HTMLElement>, threshold: number, update: (point: TabPoint) => void, finish: (point: TabPoint | null) => void) {
      if (event.button !== 0 || !event.isPrimary) return;
      cleanup.current();
      const start = { x: event.clientX, y: event.clientY }; const pointerId = event.pointerId;
      let dragging = false;
      const point = (input: PointerEvent) => ({ x: input.clientX + window.scrollX, y: input.clientY + window.scrollY });
      const move = (input: PointerEvent) => {
        if (input.pointerId !== pointerId) return;
        if (!dragging && Math.hypot(input.clientX - start.x, input.clientY - start.y) < Math.max(3, threshold)) return;
        dragging = true; input.preventDefault(); suppressClick.current = true; update(point(input));
      };
      const remove = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', escape); window.removeEventListener('blur', cancel); cleanup.current = () => {}; };
      const end = (position: TabPoint | null) => { remove(); if (dragging) finish(position); setTimeout(() => { suppressClick.current = false; }, 0); };
      const up = (input: PointerEvent) => { if (input.pointerId === pointerId) end(point(input)); };
      const cancel = () => end(null);
      const escape = (input: KeyboardEvent) => { if (input.key === 'Escape') { input.preventDefault(); cancel(); } };
      window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', escape); window.addEventListener('blur', cancel); cleanup.current = remove;
    },
  };
}
