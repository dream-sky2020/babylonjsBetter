/** Compatibility names over the single spatial-world implementation. */
export { DungeonSpatialWorld as DungeonTraversalWorld, createDungeonSpatialWorld as createDungeonTraversalWorld,
  DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '../dungeon-spatial/dungeonSpatialWorld.ts';
export type { DungeonTraversalActor, DungeonTraversalChange, DungeonTraversalBlockedReason,
  DungeonTraversalInspection, DungeonTraversalInspectionOptions, DungeonDirectionalTraversalInspection,
  DungeonTraversalStorage } from '../dungeon-spatial/dungeonSpatialWorld.ts';
