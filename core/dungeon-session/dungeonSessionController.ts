import { createDungeonDelta } from '../dungeon-delta';
import { setWorldRuntimeDungeonDelta } from '../world-runtime';
import { createDungeonSession, disposeDungeonSession } from './createDungeonSession';
import type {
  DungeonSession,
  DungeonSessionChanged,
  DungeonSessionControllerOptions,
} from './dungeonSession.types';

export type DungeonSessionListener = (event: DungeonSessionChanged) => void | Promise<void>;

export class DungeonSessionController {
  private generation = 0;
  private readonly listeners = new Set<DungeonSessionListener>();

  constructor(private readonly options: DungeonSessionControllerOptions) {}

  get current(): DungeonSession | null {
    return this.options.worldRuntime.activeDungeonSession;
  }

  subscribe(listener: DungeonSessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private saveDelta(session: DungeonSession): void {
    setWorldRuntimeDungeonDelta(
      this.options.worldRuntime,
      session.dungeonPresetKey,
      createDungeonDelta(session.dungeonPresetKey, session.runtime, session.spawn),
    );
  }

  async switchDungeon(dungeonPresetKey: string): Promise<DungeonSession | null> {
    const generation = ++this.generation;
    const previous = this.current;
    if (previous) this.saveDelta(previous);
    const next = await createDungeonSession(this.options, dungeonPresetKey, generation);
    if (generation !== this.generation) {
      disposeDungeonSession(next);
      return null;
    }
    this.options.worldRuntime.activeDungeonSession = next;
    const event = { previous, current: next };
    try {
      for (const listener of this.listeners) await listener(event);
    } finally {
      if (previous && previous !== next) disposeDungeonSession(previous);
    }
    return next;
  }

  dispose(): void {
    this.generation += 1;
    const current = this.current;
    if (current) {
      this.saveDelta(current);
      disposeDungeonSession(current);
      this.options.worldRuntime.activeDungeonSession = null;
    }
    this.listeners.clear();
  }
}
