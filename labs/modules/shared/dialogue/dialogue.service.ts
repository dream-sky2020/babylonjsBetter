import { createServiceToken } from '@/core/system-runtime/ServiceToken';
import type { DialoguePlayback } from '@/core/dialogue-runtime/DialogueSession';
import type { DialogueMapAction, DialogueScalar } from '@/core/dialogue-map/dialogueMap.types';

export type DialogueManagerState = {
  status: 'idle' | 'loading' | 'playing' | 'ended' | 'cancelled' | 'error';
  busy: boolean;
  error: string;
  waiting: boolean;
  allowsMovement: boolean;
  playback: DialoguePlayback | null;
};
export type DialogueMapContext = {
  loadId: number;
  execute(action: DialogueMapAction): void | Promise<void>;
  readMemory(key: string, path: readonly string[]): DialogueScalar | undefined;
};
export type DialogueStartOptions = { presetKey?: string; entryNodeId?: string; uiPresetKey?: string; map?: DialogueMapContext };
export type DialogueManager = {
  start(options?: DialogueStartOptions): Promise<void>;
  next(): void;
  choose(id: string): void;
  cancel(): void;
  inspect(): DialogueManagerState;
  subscribe(listener: () => void): () => void;
};
export const LAB_DIALOGUE = createServiceToken<DialogueManager>('lab.dialogue');
