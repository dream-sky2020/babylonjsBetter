import type { DungeonObstacleBinding } from './dungeonObstacle.ts';
import type { DungeonMapDirection } from '../map/index.ts';
import type { DungeonRuntimePlayerPosition } from '../dungeon-runtime/dungeonRuntime.types.ts';

type IndexedObstacle = { binding: DungeonObstacleBinding; order: number };
const opposite: Record<DungeonMapDirection, DungeonMapDirection> = { north: 'south', east: 'west', south: 'north', west: 'east' };
const tileKey = (x: number, y: number) => `${x},${y}`;
const sideKey = (x: number, y: number, direction: DungeonMapDirection) => `${x},${y},${direction}`;

/** Rebuildable placement index for one map session. Enabled state stays in the shared live Map. */
export class DungeonObstacleIndex {
  private readonly tiles = new Map<string, IndexedObstacle[]>();
  private readonly sides = new Map<string, IndexedObstacle[]>();
  private readonly states: ReadonlyMap<string, boolean>;
  constructor(obstacles: readonly DungeonObstacleBinding[], states: ReadonlyMap<string, boolean>) {
    this.states = states;
    obstacles.forEach((binding, order) => {
      const placement = binding.placement;
      const table = placement.kind === 'tile' ? this.tiles : this.sides;
      const key = placement.kind === 'shared-edge' ? sideKey(placement.side.x, placement.side.y, placement.side.direction)
        : placement.kind === 'tile-edge' ? sideKey(placement.tileX, placement.tileY, placement.direction) : tileKey(placement.tileX, placement.tileY);
      const bucket = table.get(key) ?? []; bucket.push({ binding, order }); table.set(key, bucket);
    });
  }
  findTile(x: number, y: number): DungeonObstacleBinding[] {
    return (this.tiles.get(tileKey(x, y)) ?? []).filter(row => this.states.get(row.binding.entity.id) === true).map(row => row.binding);
  }
  findStep(from: DungeonRuntimePlayerPosition, to: DungeonRuntimePlayerPosition, direction: DungeonMapDirection): DungeonObstacleBinding[] {
    const candidates = [
      ...(this.tiles.get(tileKey(to.tileX, to.tileY)) ?? []),
      ...(this.sides.get(sideKey(from.tileX, from.tileY, direction)) ?? []),
      ...(this.sides.get(sideKey(to.tileX, to.tileY, opposite[direction])) ?? []),
    ];
    // Preserve scan order (including multiple components with the same entity ID).
    return candidates.filter(row => this.states.get(row.binding.entity.id) === true).sort((a, b) => a.order - b.order).map(row => row.binding);
  }
}
