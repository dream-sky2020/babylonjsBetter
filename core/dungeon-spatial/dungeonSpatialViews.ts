import type { DungeonTraversalWorld } from '../dungeon-traversal/dungeonTraversal.ts';

/** Map-shaped compatibility view. It owns no enabled flags; all values live on Body. */
export class SpatialEnabledMap extends Map<string, boolean> {
  private readonly world: DungeonTraversalWorld;
  constructor(world: DungeonTraversalWorld) { super(); this.world = world; }
  private rows() { return [...this.world.spatial.bodies.values()].filter(body => body.source === 'map'); }
  override get size() { return this.rows().length; }
  override has(id: string) { return this.world.body(id)?.source === 'map'; }
  override get(id: string) { const body = this.world.body(id); return body?.source === 'map' ? body.enabled : undefined; }
  override set(id: string, value: boolean) { const body = this.world.body(id); if (!body) throw new Error('不存在空间物体：' + id); body.enabled = value; return this; }
  override *entries(): MapIterator<[string, boolean]> { for (const body of this.rows()) yield [body.entityId, body.enabled]; }
  override *keys(): MapIterator<string> { for (const body of this.rows()) yield body.entityId; }
  override *values(): MapIterator<boolean> { for (const body of this.rows()) yield body.enabled; }
  override [Symbol.iterator]() { return this.entries(); }
  override forEach(fn: (value: boolean, key: string, map: Map<string, boolean>) => void, thisArg?: unknown) {
    for (const body of this.rows()) fn.call(thisArg, body.enabled, body.entityId, this);
  }
}
