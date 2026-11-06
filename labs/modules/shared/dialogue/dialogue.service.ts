import { createServiceToken } from '@/core/system-runtime/ServiceToken';
import type { DialoguePlayback } from '@/core/dialogue-runtime/DialogueSession';

export type DialogueManagerState = {
  status: 'idle' | 'loading' | 'playing' | 'ended' | 'cancelled' | 'error';
  busy: boolean;
  error: string;
  playback: DialoguePlayback | null;
};
export type DialogueStartOptions = { presetKey?: string; entryNodeId?: string; uiPresetKey?: string };
export type DialogueManager = {
  start(options?: DialogueStartOptions): Promise<void>;
  next(): void;
  choose(id: string): void;
  cancel(): void;
  inspect(): DialogueManagerState;
  subscribe(listener: () => void): () => void;
};
export const LAB_DIALOGUE = createServiceToken<DialogueManager>('lab.dialogue');
