import type { IEventComponent, InteractionLocalSide, InteractionWorldSide } from '../entity/components/event.component.ts';
import { getDungeonRuntimeNeighbor, type DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { getDungeonMovementDirectionVector, type DungeonMovementDirection } from '../dungeon-movement/dungeonMovement.direction.ts';

const compass = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;
const cardinal = ['north', 'east', 'south', 'west'] as const;
const local = ['front', 'right', 'back', 'left'] as const;
export const interactionOnceKey = (event: Pick<IEventComponent, 'id' | 'onceScope' | 'once'>, entityId: string): string =>
  event.once && event.onceScope === 'entity' ? `entity:${entityId}` : `rule:${event.id}`;
export const oppositeInteractionSide = (direction: InteractionWorldSide): InteractionWorldSide => cardinal[(cardinal.indexOf(direction) + 2) % 4];
/** Exact 45-degree boundaries belong to the clockwise sector. No camera/visual pose dependency. */
export function relativeInteractionSide(side: DungeonMovementDirection, facing: string): InteractionLocalSide | null {
  const direction = compass.indexOf(side), forward = compass.indexOf(facing as DungeonMovementDirection);
  if (direction < 0 || forward < 0) return null;
  return local[Math.floor(((direction - forward + 8) % 8 + 1) / 2) % 4];
}
export function interactionArrivalSide(map: DungeonRuntimeMap, to: { tileX: number; tileY: number }, from?: { tileX: number; tileY: number }, movementDirection?: DungeonMovementDirection): DungeonMovementDirection | null {
  if (!from || from.tileX === to.tileX && from.tileY === to.tileY) return null;
  if (movementDirection) {
    const delta = getDungeonMovementDirectionVector(movementDirection);
    let target: typeof from | undefined = from;
    if (delta.y) target = getDungeonRuntimeNeighbor(map, target, delta.y < 0 ? 'north' : 'south');
    if (delta.x && target) target = getDungeonRuntimeNeighbor(map, target, delta.x < 0 ? 'west' : 'east');
    return target?.tileX === to.tileX && target?.tileY === to.tileY ? compass[(compass.indexOf(movementDirection) + 4) % 8] : null;
  }
  const same = (p: { tileX: number; tileY: number } | undefined) => p?.tileX === from.tileX && p?.tileY === from.tileY;
  for (const direction of cardinal) if (same(getDungeonRuntimeNeighbor(map, to, direction))) return direction;
  for (const [a, b, direction] of [['north', 'east', 'north-east'], ['south', 'east', 'south-east'], ['south', 'west', 'south-west'], ['north', 'west', 'north-west']] as const) {
    const next = getDungeonRuntimeNeighbor(map, to, a);
    if (next && same(getDungeonRuntimeNeighbor(map, next, b))) return direction;
  }
  return null;
}
export function worldInteractionSide(side: DungeonMovementDirection): InteractionWorldSide {
  return cardinal[Math.floor((compass.indexOf(side) + 1) / 2) % 4];
}
export const interactionDirectionText = (event: Pick<IEventComponent, 'directionSpace' | 'worldSides' | 'localSides'>): string => {
  const labels: Record<string, string> = { north: '北侧', east: '东侧', south: '南侧', west: '西侧', front: '正面', right: '右侧', back: '背面', left: '左侧' };
  return event.directionSpace === 'world' ? `地图：${(event.worldSides ?? []).map(side => labels[side]).join(' / ')}`
    : event.directionSpace === 'target-local' ? `自身：${(event.localSides ?? []).map(side => labels[side]).join(' / ')}` : '任意方向';
};
