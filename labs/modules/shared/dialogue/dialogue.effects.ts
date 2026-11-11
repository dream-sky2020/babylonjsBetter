import type { DialogueFlowInstruction } from '@/core/dialogue-runtime/DialogueSession';
import type { DialogueComparison, DialogueCondition, DialogueValue } from '@/core/dialogue-map/dialogueMap.types';
import type { LabCommunicationScope } from '@/labs/kit/labCommunication';
import { createLabEvent, LabCommunicationError } from '@/labs/kit/labCommunication.types';
import type { DialogueStartOptions } from './dialogue.service';
import { evaluateDialogueFormula } from '@/core/dialogue-map/dialogueFormula';

function readField(value: unknown, field: string): unknown {
  return value && typeof value === 'object' && Object.hasOwn(value, field) ? (value as Record<string, unknown>)[field] : undefined;
}

function resolveValue(value: DialogueValue, request: DialogueStartOptions): unknown {
  if (value.type === 'literal') return value.value;
  const current = request.map?.readMemory(value.key, value.path);
  if (current === undefined) throw new Error(`对话共享内存字段不可读：${[value.key, ...value.path].join('.')}`);
  return current;
}

function compare(left: unknown, operator: DialogueComparison['operator'], right: unknown): boolean {
  if (left === undefined || right === undefined || typeof left !== typeof right) return false;
  if (operator === 'eq') return left === right;
  if (operator === 'ne') return left !== right;
  if (typeof left !== 'number' || typeof right !== 'number') return false;
  switch (operator) {
    case 'gt': return left > right;
    case 'gte': return left >= right;
    case 'lt': return left < right;
    case 'lte': return left <= right;
  }
}

function evaluateCondition(condition: DialogueCondition, request: DialogueStartOptions): boolean {
  const matches = ({ left, operator, right }: DialogueComparison) => compare(resolveValue(left, request), operator, resolveValue(right, request));
  if (condition.type === 'compare') return matches(condition);
  return condition.type === 'all' ? condition.conditions.every(matches) : condition.conditions.some(matches);
}

export function validateDialogueEffect(instruction: DialogueFlowInstruction, request: DialogueStartOptions): void {
  if (instruction.kind === 'action' && !request.map) throw new Error(`节点“${instruction.id}”需要当前地牢地图提供动作执行能力。`);
}

export async function runDialogueEffect(
  communication: LabCommunicationScope,
  instruction: DialogueFlowInstruction,
  request: DialogueStartOptions,
  signal: AbortSignal,
  readMemory = request.map?.readMemory,
): Promise<string | undefined> {
  if (instruction.kind === 'action') {
    await request.map!.execute(instruction.action);
    return instruction.next;
  }
  if (instruction.kind === 'condition') {
    const result = 'formula' in instruction
      ? evaluateDialogueFormula(instruction.formula, binding => readMemory?.(binding.key, binding.path))
      : evaluateCondition(instruction.condition, request);
    const branch = result ? 'true' : 'false';
    const port = Object.keys(instruction.branches).find(id => instruction.branches[id] === branch);
    return port ? instruction.routes[port] : undefined;
  }
  if (instruction.mode === 'send') {
    for (const event of instruction.events) {
      signal.throwIfAborted();
      const payload = Object.fromEntries(Object.entries(event.payload ?? {}).map(([key, value]) => [key, resolveValue(value, request)]));
      await communication.publish(createLabEvent<typeof payload>(event.eventType, event.version), payload, { correlationId: event.correlationId });
    }
    return instruction.next;
  }
  const [event] = instruction.events;
  const { filters, correlationId, sourceModuleId, timeoutMs } = instruction.wait;
  const expected = filters.map(filter => ({ ...filter, expected: resolveValue(filter.value, request) }));
  try {
    await communication.waitFor(createLabEvent<unknown>(event.eventType, event.version), {
      signal, timeoutMs,
      predicate(payload, message) {
        if (sourceModuleId && sourceModuleId !== message.sourceModuleId || correlationId && correlationId !== message.correlationId) return false;
        const eventLoadId = readField(payload, 'loadId');
        if (request.map && eventLoadId !== undefined && eventLoadId !== request.map.loadId) return false;
        return expected.every(({ field, operator, expected }) => compare(readField(payload, field), operator, expected));
      },
    });
    return instruction.next;
  } catch (error) {
    if (error instanceof LabCommunicationError && error.code === 'TIMEOUT' && instruction.timeout) return instruction.timeout;
    throw error;
  }
}
