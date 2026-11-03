import type { DungeonRuntime } from '../dungeon-runtime/dungeonRuntime.types.ts';
import { setDungeonRuntimePlayerPosition } from '../dungeon-runtime/dungeonRuntime.ts';
import { DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '../dungeon-traversal/index.ts';
import { getDungeonMapTerrainProperties } from '../map-document/index.ts';
import { sweepSpatialBody } from '../dungeon-spatial/dungeonSpatialGeometry.ts';
import { scanDungeonDocumentExits } from '../dungeon-transition/dungeonTransition.document.ts';
import type { DungeonMapDirection } from '../map/dungeonMap.types.ts';

/** Run after state restoration and all actor preparations, before publishing the session. */
export function resolveDungeonPlayerArrival(runtime: DungeonRuntime, options: {
  radius?: number;
  resolveWorldPosition?: (x: number, y: number) => readonly [number, number, number];
} = {}): void {
  const radius = options.radius ?? 3;
  if (runtime.installedSystems?.traversal === false) return;
  const world = runtime.traversal;
  const player = world.body(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID);
  if (!player) return;
  const origin = player.tileIndex;
  const characterIds = new Set([...world.spatial.bodies.values()]
    .filter(body => world.isCharacter(body.id)).map(body => body.id));
  const exits = new Set(scanDungeonDocumentExits(runtime.map.document).flatMap(({ location }) =>
    location.kind === 'tile' ? [location.tileY * runtime.map.width + location.tileX] : []));
  const point = (tile: number) => ({ x: tile % runtime.map.width, y: Math.floor(tile / runtime.map.width) });
  const staticallySafe = (tile: number) => {
    const pose = point(tile);
    return getDungeonMapTerrainProperties(runtime.map.document.terrain, runtime.map.topology.tileIds[tile])?.walkable !== false
      && !sweepSpatialBody(world.spatial, player, pose, pose, characterIds).length;
  };
  const safe = (tile: number) => staticallySafe(tile)
    && ![...(world.occupantIdsByTile[tile] ?? [])].some(id => id !== player.id && world.isCharacter(id) && world.body(id)?.enabled)
    && !sweepSpatialBody(world.spatial, player, point(tile), point(tile), new Set([player.id])).length;

  let destination = safe(origin) ? origin : undefined;
  const directions: DungeonMapDirection[] = [runtime.playerFacing, 'north', 'east', 'south', 'west'];
  const order = [...new Set(directions)];
  const queue = [{ tile: origin, distance: 0 }], visited = new Set([origin]);
  for (let cursor = 0; destination === undefined && cursor < queue.length; cursor++) {
    const { tile, distance } = queue[cursor];
    if (distance >= radius) continue;
    for (const direction of order) {
      const step = world.inspectStep(player.id, tile, direction, { ignoreDynamicOccupancy: true });
      const next = step.toTileIndex;
      if (step.blockedReason || next === undefined || visited.has(next)) continue;
      // Check the complete static trajectory as well as discrete edges/terrain.
      const from = point(tile), vector = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] }[direction];
      const to = { x: from.x + vector[0], y: from.y + vector[1] };
      if (sweepSpatialBody(world.spatial, player, from, to, characterIds).length) continue;
      visited.add(next);
      if (!exits.has(next) && safe(next)) { destination = next; break; }
      // Do not route a fallback through another portal or an impassable tile.
      if (!exits.has(next) && staticallySafe(next)) queue.push({ tile: next, distance: distance + 1 });
    }
  }
  if (destination === undefined) {
    if (!staticallySafe(origin)) throw new Error('目标入口没有合法落点，请检查入口附近的地形和障碍。');
    // An occupied but otherwise valid entrance is usable with pair-specific escape permissions.
    destination = origin;
  }
  if (destination !== origin) {
    const pose = point(destination);
    setDungeonRuntimePlayerPosition(runtime, { tileX: pose.x, tileY: pose.y });
    const resolveWorldPosition = options.resolveWorldPosition
      ?? (runtime.installedSystems?.movement !== false ? runtime.movementResolver.worldPositionFor : undefined);
    if (resolveWorldPosition) runtime.playerWorldPosition = [...resolveWorldPosition(pose.x, pose.y)];
  }
  for (const id of characterIds) world.captureCharacterOverlaps(id);
}
