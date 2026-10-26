import type { MonsterActionKind } from './monsterVisual.service';
import type { MonsterVisualAction } from '../monsterVisual.protocol';

/** Lab test policy: one active test per instance, with exactly one terminal event. */
export class MonsterActionLifecycle {
  private readonly stops = new Map<MonsterActionKind, (id?: string) => void>();
  private readonly active = new Map<string, Omit<MonsterVisualAction, 'outcome'>>();
  private sequence = 0;
  constructor(privatePublish: (event: MonsterVisualAction) => void) { this.publish = privatePublish; }
  private readonly publish: (event: MonsterVisualAction) => void;
  register(kind: MonsterActionKind, stop: (id?: string) => void): () => void {
    if (this.stops.has(kind)) throw new Error(`表现能力重复注册：${kind}`);
    this.stops.set(kind, stop);
    return () => { this.cancel(undefined, kind); this.stops.delete(kind); };
  }
  cancel(monsterId?: string, kind?: MonsterActionKind): void {
    for (const [id, action] of this.active) {
      if ((monsterId && id !== monsterId) || (kind && kind !== action.kind)) continue;
      this.active.delete(id); this.publish({ ...action, outcome: 'cancelled' });
    }
    for (const [registeredKind, stop] of this.stops) if (!kind || registeredKind === kind) stop(monsterId);
  }
  begin(monsterId: string, kind: MonsterActionKind, play: (done: () => void) => boolean): void {
    if (!this.stops.has(kind)) throw new Error(`未安装表现能力：${kind}`);
    this.cancel(monsterId);
    const action = { actionId: ++this.sequence, monsterId, kind };
    this.active.set(monsterId, action);
    let completed = false, announced = false;
    const finish = () => {
      completed = true;
      if (!announced || this.active.get(monsterId) !== action) return;
      this.active.delete(monsterId); this.publish({ ...action, outcome: 'completed' });
    };
    try {
      if (!play(finish)) throw new Error('怪物视觉尚未就绪，或表现预设无效。');
    } catch (error) { this.active.delete(monsterId); this.stops.get(kind)?.(monsterId); throw error; }
    this.publish({ ...action, outcome: 'started' }); announced = true;
    if (completed) finish();
  }
}
