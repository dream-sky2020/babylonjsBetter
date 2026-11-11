import { DialogueSession, type DialogueFlowInstruction } from '@/core/dialogue-runtime/DialogueSession';
import type { CompiledDialogue } from '@/core/dialogue-map/dialogueCompiler';
import type { LabUiOverlay } from '../ui-runtime/uiRuntime.service';
import type { DialogueConfig } from './dialogue.config';
import type { DialogueManager, DialogueManagerState, DialogueMapContext, DialogueStartOptions } from './dialogue.service';

export type DialogueRuntimeOptions = {
  config: DialogueConfig;
  load(presetKey: string, entryNodeId: string): Promise<CompiledDialogue>;
  open(presetKey: string, context: Record<string, unknown>, onAction: (action: string) => void, needsChoices: boolean): Promise<LabUiOverlay>;
  acquireInput(): () => void;
  readMemory?: DialogueMapContext['readMemory'];
  validateEffect?(instruction: DialogueFlowInstruction, request: DialogueStartOptions): void;
  runEffect?(instruction: DialogueFlowInstruction, request: DialogueStartOptions, signal: AbortSignal): Promise<string | undefined>;
};

/** The service can be installed without mounting the test panel. */
export function createDialogueManager(options: DialogueRuntimeOptions): DialogueManager & { dispose(): void } {
  const session = new DialogueSession(), listeners = new Set<() => void>();
  let status: DialogueManagerState['status'] = 'idle', error = '', pending = false, disposed = false, generation = 0;
  let overlay: LabUiOverlay | null = null, releaseInput: (() => void) | null = null;
  let opening = false, hidden = false;
  type Run = { token: number; request: DialogueStartOptions; uiPreset: string; controller: AbortController };
  let run: Run | undefined;
  const inspect = (): DialogueManagerState => {
    const effect = session.effect;
    const wait = effect?.kind === 'event' && effect.mode === 'wait' ? effect.wait : undefined;
    return { status, busy: pending || opening || status === 'playing', error, waiting: !!wait, allowsMovement: wait?.allowMovement === true,
      playback: status === 'idle' || status === 'loading' ? null : session.inspect() };
  };
  const notify = () => listeners.forEach(listener => listener());
  const context = (): Record<string, unknown> => {
    const state = session.inspect();
    return { 'dialogue.speaker': state.speaker, 'dialogue.text': state.text,
      'dialogue.choices': JSON.stringify(state.choices), 'dialogue.canAdvance': Number(state.canAdvance) };
  };
  const cleanup = () => {
    const current = overlay; overlay = null; hidden = false;
    try { current?.dispose(); } finally { const release = releaseInput; releaseInput = null; release?.(); }
  };
  const active = (current: Run) => !disposed && current.token === generation;
  const fail = (current: Run, failure: unknown) => {
    if (!active(current)) return;
    current.controller.abort(); session.cancel(); status = 'error';
    error = failure instanceof Error ? failure.message : String(failure);
    cleanup(); notify();
  };
  const sync = async (current: Run) => {
    let steps = 0;
    while (active(current) && session.effect) {
      if (++steps > 100) throw new Error('对话连续执行超过 100 个非对白节点。');
      const instruction = session.effect;
      if (instruction.kind === 'event' && instruction.mode === 'wait') {
        if (instruction.wait.allowMovement) {
          if (overlay && !hidden) { overlay.hide(); hidden = true; }
          const release = releaseInput; releaseInput = null; release?.();
        } else {
          releaseInput ??= options.acquireInput();
          if (hidden) { overlay?.show(); hidden = false; }
          overlay?.update(context());
        }
      }
      const next = options.runEffect!(instruction, current.request, current.controller.signal);
      notify();
      const target = await next;
      if (!active(current)) return;
      session.advanceEffect(target);
    }
    if (!active(current)) return;
    if (session.inspect().status === 'ended') { status = 'ended'; cleanup(); notify(); return; }
    releaseInput ??= options.acquireInput();
    if (!overlay) {
      opening = true;
      try {
        const result = await options.open(current.uiPreset, context(), action => {
          if (!active(current) || status !== 'playing') return;
          if (action === 'dialogue.next') manager.next();
          else if (action === 'dialogue.cancel') manager.cancel();
          else if (action.startsWith('dialogue.choose:')) manager.choose(decodeURIComponent(action.slice('dialogue.choose:'.length)));
        }, session.hasChoices);
        if (!active(current)) { result.dispose(); return; }
        overlay = result;
      } finally { opening = false; if (!active(current) && !disposed) notify(); }
    }
    if (hidden) { overlay.show(); hidden = false; }
    overlay.update(context());
    notify();
  };
  const resume = (current: Run) => { void sync(current).catch(failure => fail(current, failure)); };
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
      const current: Run = { token, request: { ...request }, uiPreset, controller: new AbortController() };
      run = current;
      pending = true; status = 'loading'; error = ''; notify();
      try {
        const program = await options.load(preset, entry);
        if (disposed || token !== generation) return;
        const readMemory = current.request.map?.readMemory ?? options.readMemory;
        const playback = session.start(program, options.runEffect ? instruction => options.validateEffect?.(instruction, current.request) : undefined,
          binding => readMemory?.(binding.key, binding.path),
          (name, binding, error) => {
            const reference = binding ? [binding.key, ...binding.path].join('.') : '未绑定';
            console.warn(`对话预设「${preset}」的文本变量「${name}」不可读（${reference}）。`, ...(error === undefined ? [] : [error]));
          });
        if (playback.status === 'ended') { status = 'ended'; return; }
        status = 'playing';
        if (session.effect) resume(current);
        else await sync(current);
      } catch (failure) {
        if (active(current)) {
          fail(current, failure);
          throw failure;
        }
      } finally { pending = false; if (!disposed) notify(); }
    },
    next() { if (status === 'playing' && run && !opening && session.next()) resume(run); },
    choose(id) { if (status === 'playing' && run && !opening && !session.effect) { session.choose(id); resume(run); } },
    cancel() {
      if (disposed || !inspect().busy) return;
      generation++; run?.controller.abort(); run = undefined; session.cancel(); status = 'cancelled'; cleanup(); notify();
    },
    dispose() { if (disposed) return; disposed = true; generation++; run?.controller.abort(); run = undefined; session.cancel(); cleanup(); listeners.clear(); },
  };
  return manager;
}
