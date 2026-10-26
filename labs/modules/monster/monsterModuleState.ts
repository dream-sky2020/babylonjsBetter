import type { LabContext, LabStateJsonValue } from '@/labs/kit';
import { defineLabMemoryType, defineLabSharedData, type LabSharedData, type LabSharedDataDefinition } from '../../kit/shared-memory/LabMemory.ts';

export const monsterRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const monsterNumber = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export function defineMonsterState<T>(key: string, label: string, create: () => T, validate: (value: unknown) => value is T) {
  return defineLabSharedData<T>({ key, label, create, type: defineLabMemoryType(key, validate), inspect: value => structuredClone(value) });
}
export function persistMonsterState<T>(context: LabContext, moduleId: string, key: string, definition: LabSharedDataDefinition<T>, memory: LabSharedData<T>,
  afterRestore: () => void | Promise<void>, legacy?: readonly { moduleId: string; key: string; select(saved: unknown): unknown }[]) {
  const registration = context.labState.registerReference({ moduleId, key, version: 1, value: memory, legacy,
    inspect: value => structuredClone(value.current) as LabStateJsonValue,
    save: {
      serialize: value => structuredClone(value.current) as LabStateJsonValue,
      validate(saved, version) {
        if (version !== 1 || !definition.type.validate(saved)) throw new Error(`${definition.label}存档无效。`);
        return structuredClone(saved) as LabStateJsonValue;
      },
      restore(value, saved) { value.replace(structuredClone(saved) as T); }, afterRestore,
    },
  });
  return { changed() { memory.markChanged(); registration.markChanged(); }, dispose() { registration.unregister(); } };
}
