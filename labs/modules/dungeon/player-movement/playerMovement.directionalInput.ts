import type { DungeonMapDirection } from '@/core/map';
import type { DungeonMovementDirection, DungeonMovementDirectionMode } from '@/core/dungeon-movement';

const TOP_DOWN_WASD_DIRECTIONS = {
  w: 'north',
  a: 'east',
  s: 'south',
  d: 'west',
} as const satisfies Readonly<Record<'w' | 'a' | 's' | 'd', DungeonMapDirection>>;

/** 俯视角绝对移动：方向键与 WASD 始终共享同一组方向定义。 */
export const DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS: Readonly<Record<string, DungeonMapDirection>> = {
  KeyW: TOP_DOWN_WASD_DIRECTIONS.w,
  ArrowUp: TOP_DOWN_WASD_DIRECTIONS.w,
  KeyA: TOP_DOWN_WASD_DIRECTIONS.a,
  ArrowLeft: TOP_DOWN_WASD_DIRECTIONS.a,
  KeyS: TOP_DOWN_WASD_DIRECTIONS.s,
  ArrowDown: TOP_DOWN_WASD_DIRECTIONS.s,
  KeyD: TOP_DOWN_WASD_DIRECTIONS.d,
  ArrowRight: TOP_DOWN_WASD_DIRECTIONS.d,
};

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
  private bufferedEightWayDirection: DungeonMovementDirection | null = null;
  private hasBufferedInput = false;

  get hasHeldDirection(): boolean {
    return this.heldDirections.size > 0;
  }

  clear(): void {
    this.heldDirections.clear();
    this.bufferedDirection = null;
    this.bufferedEightWayDirection = null;
    this.hasBufferedInput = false;
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
    this.bufferedEightWayDirection = this.resolveHeldEightWayDirection();
    this.hasBufferedInput = true;
  }

  keyUp(code: string): void {
    this.heldDirections.delete(code);
  }

  private resolveHeldEightWayDirection(minimumPressedAtMilliseconds = Number.POSITIVE_INFINITY): DungeonMovementDirection | null {
    let north = false;
    let east = false;
    let south = false;
    let west = false;
    this.heldDirections.forEach((entry) => {
      if (entry.pressedAtMilliseconds > minimumPressedAtMilliseconds) return;
      if (entry.direction === 'north') north = true;
      else if (entry.direction === 'east') east = true;
      else if (entry.direction === 'south') south = true;
      else west = true;
    });
    const vertical = north === south ? '' : north ? 'north' : 'south';
    const horizontal = east === west ? '' : east ? 'east' : 'west';
    if (vertical && horizontal) return `${vertical}-${horizontal}` as DungeonMovementDirection;
    return (vertical || horizontal || null) as DungeonMovementDirection | null;
  }

  consume(
    nowMilliseconds: number,
    minimumHeldSeconds = 0,
    directionMode: DungeonMovementDirectionMode = 'four-way',
  ): DungeonMovementDirection | null {
    if (directionMode === 'eight-way' && this.hasBufferedInput) {
      const direction = this.bufferedEightWayDirection;
      this.bufferedEightWayDirection = null;
      this.bufferedDirection = null;
      this.hasBufferedInput = false;
      return direction;
    }
    if (this.bufferedDirection) {
      const direction = this.bufferedDirection;
      this.bufferedDirection = null;
      this.bufferedEightWayDirection = null;
      this.hasBufferedInput = false;
      return direction;
    }
    const minimumHeldMilliseconds = Math.max(0, minimumHeldSeconds) * 1000;
    let latest: HeldDirection | null = null;
    this.heldDirections.forEach((entry) => {
      if (nowMilliseconds - entry.pressedAtMilliseconds < minimumHeldMilliseconds) return;
      if (!latest || entry.sequence > latest.sequence) latest = entry;
    });
    if (directionMode === 'eight-way') {
      return this.resolveHeldEightWayDirection(nowMilliseconds - minimumHeldMilliseconds);
    }
    return latest?.direction ?? null;
  }
}
