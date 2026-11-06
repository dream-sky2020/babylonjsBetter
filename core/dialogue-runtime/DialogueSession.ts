import type { CompiledDialogue, DialogueInstruction } from '../dialogue-map/dialogueCompiler.ts';

export type DialoguePlayback = {
  status: 'idle' | 'playing' | 'ended' | 'cancelled';
  presetKey: string;
  nodeId: string;
  lineIndex: number;
  speaker: string;
  text: string;
  choices: { id: string; text: string }[];
  canAdvance: boolean;
};
type Speech = Extract<DialogueInstruction, { kind: 'choice' }>;

/** Dialogue/choice playback only. No DOM, editor, Lab, input or persistence dependency. */
export class DialogueSession {
  private program?: CompiledDialogue;
  private node?: Speech;
  private lineIndex = 0;
  private status: DialoguePlayback['status'] = 'idle';

  start(source: CompiledDialogue): DialoguePlayback {
    const program = structuredClone(source);
    if (program.version !== 1 || !Object.hasOwn(program.instructions, program.entryNodeId)) throw new Error('对话入口不存在。');
    // Reject unsupported reachable nodes before opening a UI or executing any part of the story.
    const pending = [program.entryNodeId], visited = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const instruction = program.instructions[id];
      if (!instruction) throw new Error(`对话目标节点不存在：${id}`);
      if (instruction.kind !== 'choice') throw new Error(`节点“${id}”需要${instruction.kind === 'condition' ? '条件判断' : '剧情事件'}接入；当前测试播放只支持对白和选项。`);
      pending.push(...Object.values(instruction.routes));
    }
    this.program = program;
    this.enter(program.entryNodeId);
    return this.inspect();
  }
  private enter(id: string): void {
    this.node = this.program!.instructions[id] as Speech;
    this.lineIndex = 0;
    this.status = this.node.lines.length || this.node.choices.length ? 'playing' : 'ended';
  }
  inspect(): DialoguePlayback {
    const line = this.node?.lines[this.lineIndex];
    const atLast = !this.node || this.lineIndex >= this.node.lines.length - 1;
    return {
      status: this.status, presetKey: this.program?.presetKey ?? '', nodeId: this.node?.id ?? '', lineIndex: this.lineIndex,
      speaker: line?.speaker ?? '', text: line?.text ?? '',
      choices: this.status === 'playing' && atLast ? structuredClone(this.node?.choices ?? []) : [],
      canAdvance: this.status === 'playing' && (!atLast || !this.node?.choices.length),
    };
  }
  next(): boolean {
    if (!this.inspect().canAdvance) return false;
    if (this.lineIndex + 1 < this.node!.lines.length) this.lineIndex++;
    else this.status = 'ended';
    return true;
  }
  choose(id: string): void {
    if (!this.inspect().choices.some(choice => choice.id === id)) throw new Error('当前对话选项不可用。');
    const target = this.node!.routes[id];
    if (target) this.enter(target);
    else this.status = 'ended';
  }
  cancel(): void { if (this.status === 'playing') this.status = 'cancelled'; }
}
