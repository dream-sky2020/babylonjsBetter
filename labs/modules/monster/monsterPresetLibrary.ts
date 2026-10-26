import { loadConfig } from '@/core/config';
import type { LabSharedData } from '@/labs/kit/shared-memory/LabMemory';

export function createMonsterPresetLoader<T>(memory: LabSharedData<Record<string, T> | null>, file: string, api: string,
  normalize: (value: unknown) => Record<string, T>, committed: () => void) {
  let generation = 0, disposed = false;
  return {
    async reload() {
      const ticket = ++generation;
      const raw = await loadConfig<unknown>(file, { devApiPath: api, selectDevPayload: value => (value as { data: unknown }).data });
      const next = normalize(raw);
      if (disposed || ticket !== generation) return;
      memory.replace(next); committed();
    },
    dispose() { disposed = true; ++generation; memory.replace(null); },
  };
}
export function normalizeMonsterActionPresets<T extends { modeId: string }>(value: unknown, normalize: (preset: T) => T | null): Record<string, T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('动作预设库无效。');
  return Object.fromEntries(Object.entries(value).flatMap(([key, raw]) => {
    if (!raw || typeof raw !== 'object' || typeof (raw as T).modeId !== 'string') return [];
    const preset = normalize(raw as T); return preset ? [[key, preset]] : [];
  }));
}
export function resolveMonsterPreset<T>(library: Record<string, T> | null, key: string): T {
  const preset = library?.[key]; if (!preset) throw new Error('所选表现预设不存在，请重新选择。'); return preset;
}
