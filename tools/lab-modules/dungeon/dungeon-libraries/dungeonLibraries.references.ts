import type { DungeonLabLibraries } from './dungeonLibraries.protocol';

export type DungeonLabLibrariesReference = {
  readonly current: DungeonLabLibraries | null;
  require(): DungeonLabLibraries;
};

export type DungeonLabLibrariesReferenceController = {
  readonly reference: DungeonLabLibrariesReference;
  commit(libraries: DungeonLabLibraries): void;
  clear(): void;
};

/** setup 阶段即可公开稳定引用；start 阶段只提交异步加载结果。 */
export const createDungeonLabLibrariesReference = (): DungeonLabLibrariesReferenceController => {
  let current: DungeonLabLibraries | null = null;
  const reference: DungeonLabLibrariesReference = {
    get current() { return current; },
    require() {
      if (!current) throw new Error('地牢预设库尚未加载。');
      return current;
    },
  };
  return {
    reference,
    commit(libraries) { current = libraries; },
    clear() { current = null; },
  };
};
