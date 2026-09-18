import type { DungeonMapDirection } from '@/core/map';

export const resolveDungeonPlayerContinuousHoldThreshold = (
  movementDurationSeconds: number,
  multiplier = 0.8,
  offsetSeconds = 0,
): number => Math.max(0, movementDurationSeconds * multiplier + offsetSeconds);

type HeldDirection = Readonly<{
  direction: DungeonMapDirection;
  sequence: number;
  pressedAtMilliseconds: number;
}>;

/**
 * 区分一次格步、移动中的单次方向缓冲与真正长按。
 * KeyboardEvent.repeat 受操作系统设置影响，因此只用于忽略重复 keydown，
 * 是否续步只由真实按住时长和当前格步耗时决定。
 */
export class DungeonPlayerDirectionalInput {
  private readonly heldDirections = new Map<string, HeldDirection>();
  private inputSequence = 0;
  private bufferedDirection: DungeonMapDirection | null = null;

  get hasHeldDirection(): boolean {
    return this.heldDirections.size > 0;
  }

  clear(): void {
    this.heldDirections.clear();
    this.bufferedDirection = null;
  }

  keyDown(
    code: string,
    direction: DungeonMapDirection,
    pressedAtMilliseconds: number,
    repeat: boolean,
  ): void {
    if (repeat || this.heldDirections.has(code)) return;
    this.heldDirections.set(code, {
      direction,
      sequence: ++this.inputSequence,
      pressedAtMilliseconds,
    });
    this.bufferedDirection = direction;
  }

  keyUp(code: string): void {
    this.heldDirections.delete(code);
  }

  consume(nowMilliseconds: number, minimumHeldSeconds = 0): DungeonMapDirection | null {
    if (this.bufferedDirection) {
      const direction = this.bufferedDirection;
      this.bufferedDirection = null;
      return direction;
    }
    const minimumHeldMilliseconds = Math.max(0, minimumHeldSeconds) * 1000;
    let latest: HeldDirection | null = null;
    this.heldDirections.forEach((entry) => {
      if (nowMilliseconds - entry.pressedAtMilliseconds < minimumHeldMilliseconds) return;
      if (!latest || entry.sequence > latest.sequence) latest = entry;
    });
    return latest?.direction ?? null;
  }
}
