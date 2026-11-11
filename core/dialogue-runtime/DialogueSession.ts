import type { CompiledDialogue, DialogueInstruction } from '../dialogue-map/dialogueCompiler.ts';
import { renderDialogueText } from '../dialogue-map/dialogueText.ts';

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
export type DialogueFlowInstruction = Exclude<DialogueInstruction, Speech>;

/** Dialogue flow state. The host runs effects and supplies their continuation. */
export class DialogueSession {
  private program?: CompiledDialogue;
  private node?: DialogueInstruction;
  private lineIndex = 0;
  private text = '';
  private renderLine?: (text: string) => string;
  private status: DialoguePlayback['status'] = 'idle';
  private reachableChoices = false;

  get hasChoices(): boolean { return this.reachableChoices; }

  start(source: CompiledDialogue, validateEffect?: (instruction: DialogueFlowInstruction) => void,
    readTextVariable?: Parameters<typeof renderDialogueText>[2], onMissing?: Parameters<typeof renderDialogueText>[3]): DialoguePlayback {
    const program = structuredClone(source);
    if (program.version !== 1 || !Object.hasOwn(program.instructions, program.entryNodeId)) throw new Error('对话入口不存在。');
    // Reject unsupported reachable nodes before opening a UI or executing any part of the story.
    const pending = [program.entryNodeId], visited = new Set<string>();
    let hasChoices = false;
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const instruction = program.instructions[id];
      if (!instruction) throw new Error(`对话目标节点不存在：${id}`);
      if (instruction.kind === 'choice') hasChoices ||= instruction.choices.length > 0;
      else if (validateEffect) validateEffect(instruction);
      else throw new Error(`节点“${id}”需要${instruction.kind === 'condition' ? '条件判断' : '剧情事件'}接入。`);
      pending.push(...Object.values(instruction.routes));
    }
    this.program = program;
    this.renderLine = (text: string) => renderDialogueText(text, program.textVariables, readTextVariable ?? (() => undefined), onMissing);
    this.reachableChoices = hasChoices;
    this.enter(program.entryNodeId);
    return this.inspect();
  }
  private enter(id: string): void {
    this.node = this.program!.instructions[id];
    this.lineIndex = 0;
    this.status = this.node.kind !== 'choice' || this.node.lines.length || this.node.choices.length ? 'playing' : 'ended';
    this.captureLine();
  }
  private captureLine(): void {
    const line = this.node?.kind === 'choice' ? this.node.lines[this.lineIndex] : undefined;
    this.text = line ? this.renderLine!(line.text) : '';
  }
  get effect(): DialogueFlowInstruction | undefined {
    return this.status === 'playing' && this.node && this.node.kind !== 'choice' ? this.node : undefined;
  }
  advanceEffect(target?: string): void {
    if (!this.effect) return;
    if (target) this.enter(target);
    else this.status = 'ended';
  }
  inspect(): DialoguePlayback {
    const speech = this.node?.kind === 'choice' ? this.node : undefined;
    const line = speech?.lines[this.lineIndex];
    const atLast = !speech || this.lineIndex >= speech.lines.length - 1;
    return {
      status: this.status, presetKey: this.program?.presetKey ?? '', nodeId: this.node?.id ?? '', lineIndex: this.lineIndex,
      speaker: line?.speaker ?? '', text: this.text,
      choices: this.status === 'playing' && atLast ? structuredClone(speech?.choices ?? []) : [],
      canAdvance: this.status === 'playing' && !!speech && (!atLast || !speech.choices.length),
    };
  }
  next(): boolean {
    if (!this.inspect().canAdvance || this.node?.kind !== 'choice') return false;
    if (this.lineIndex + 1 < this.node.lines.length) { this.lineIndex++; this.captureLine(); }
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
