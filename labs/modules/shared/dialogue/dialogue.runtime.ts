import { DialogueSession } from '@/core/dialogue-runtime/DialogueSession';
import type { CompiledDialogue } from '@/core/dialogue-map/dialogueCompiler';
import type { LabUiOverlay } from '../ui-runtime/uiRuntime.service';
import type { DialogueConfig } from './dialogue.config';
import type { DialogueManager, DialogueManagerState, DialogueStartOptions } from './dialogue.service';

export type DialogueRuntimeOptions = {
  config: DialogueConfig;
  load(presetKey: string, entryNodeId: string): Promise<CompiledDialogue>;
  open(presetKey: string, context: Record<string, unknown>, onAction: (action: string) => void): Promise<LabUiOverlay>;
  acquireInput(): () => void;
};

/** The service can be installed without mounting the test panel. */
export function createDialogueManager(options: DialogueRuntimeOptions): DialogueManager & { dispose(): void } {
  const session = new DialogueSession(), listeners = new Set<() => void>();
  let status: DialogueManagerState['status'] = 'idle', error = '', pending = false, disposed = false, generation = 0;
  let overlay: LabUiOverlay | null = null, releaseInput: (() => void) | null = null;
  const inspect = (): DialogueManagerState => ({ status, busy: pending || status === 'playing', error,
    playback: status === 'idle' || status === 'loading' ? null : session.inspect() });
  const notify = () => listeners.forEach(listener => listener());
  const context = (): Record<string, unknown> => {
    const state = session.inspect();
    return { 'dialogue.speaker': state.speaker, 'dialogue.text': state.text,
      'dialogue.choices': JSON.stringify(state.choices), 'dialogue.canAdvance': Number(state.canAdvance) };
  };
  const cleanup = () => {
    const current = overlay; overlay = null;
    try { current?.dispose(); } finally { const release = releaseInput; releaseInput = null; release?.(); }
  };
  const sync = () => {
    const playback = session.inspect();
    if (playback.status === 'ended') { status = 'ended'; cleanup(); }
    else overlay?.update(context());
    notify();
  };
  const manager: DialogueManager & { dispose(): void } = {
    inspect,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async start(request: DialogueStartOptions = {}) {
      if (disposed) throw new Error('对话管理模块已释放。');
      if (inspect().busy) throw new Error('已有对话正在启动或播放，请先结束当前对话。');
      const token = ++generation;
      // Capture this request; editing configuration affects only the next conversation.
      const preset = request.presetKey ?? options.config.preset, entry = request.entryNodeId ?? options.config.entry;
      const uiPreset = request.uiPresetKey ?? options.config['ui-preset'];
      pending = true; status = 'loading'; error = ''; notify();
      try {
        const program = await options.load(preset, entry);
        if (disposed || token !== generation) return;
        const playback = session.start(program);
        if (playback.status === 'ended') { status = 'ended'; return; }
        releaseInput = options.acquireInput();
        status = 'playing';
        const result = await options.open(uiPreset, context(), action => {
          if (disposed || token !== generation || status !== 'playing') return;
          if (action === 'dialogue.next') manager.next();
          else if (action === 'dialogue.cancel') manager.cancel();
          else if (action.startsWith('dialogue.choose:')) manager.choose(decodeURIComponent(action.slice('dialogue.choose:'.length)));
        });
        if (disposed || token !== generation || status !== 'playing') { result.dispose(); return; }
        overlay = result; overlay.update(context());
      } catch (failure) {
        if (!disposed && token === generation) {
          session.cancel(); status = 'error'; error = failure instanceof Error ? failure.message : String(failure); cleanup();
          throw failure;
        }
      } finally { pending = false; if (!disposed) notify(); }
    },
    next() { if (status === 'playing') { session.next(); sync(); } },
    choose(id) { if (status === 'playing') { session.choose(id); sync(); } },
    cancel() {
      if (disposed || !inspect().busy) return;
      generation++; session.cancel(); status = 'cancelled'; cleanup(); notify();
    },
    dispose() { if (disposed) return; disposed = true; generation++; session.cancel(); cleanup(); listeners.clear(); },
  };
  return manager;
}
