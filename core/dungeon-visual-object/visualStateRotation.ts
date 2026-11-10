import type { VisualRotationMode } from '../entity/components/visual-state.component.ts';

export type VisualShuffleProgress = { remaining: readonly string[]; last: string };

/** Selection has no side effects; the caller commits shuffle progress only after applying the state. */
export function chooseVisualState(
  stateIds: readonly string[],
  mode: VisualRotationMode,
  current?: string,
  progress?: VisualShuffleProgress,
  random = Math.random,
): { stateId: string; progress?: VisualShuffleProgress } {
  if (!stateIds.length) throw new Error('轮替组没有可用状态。');
  const index = stateIds.indexOf(current ?? '');
  if (mode === 'next') return { stateId: stateIds[(index + 1) % stateIds.length] };
  if (mode === 'previous') return { stateId: stateIds[index <= 0 ? stateIds.length - 1 : index - 1] };
  if (mode === 'random') return { stateId: stateIds[Math.floor(random() * stateIds.length)] };
  if (mode !== 'shuffle') throw new Error(`未知的视觉轮替操作：${mode}。`);
  let remaining: string[];
  if (progress?.remaining.length) {
    remaining = [...progress.remaining];
  } else {
    remaining = [...stateIds];
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    if (remaining.length > 1 && remaining[0] === progress?.last) {
      const j = 1 + Math.floor(random() * (remaining.length - 1));
      [remaining[0], remaining[j]] = [remaining[j], remaining[0]];
    }
  }
  const [stateId, ...rest] = remaining;
  return { stateId, progress: { remaining: rest, last: stateId } };
}
