import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import type { DungeonTraversalActor } from '../dungeon-traversal/dungeonTraversal.ts';
import type { SpatialBodyDefinition } from './dungeonSpatialDefinition.ts';
import type { ISpatialColliderComponent } from '../entity/components/spatial-collider.component.ts';
import type { PlayerPushResponse } from '../entity/components/spatial-interaction.component.ts';

export type SpatialBody = DungeonTraversalActor & {
  bodyId: string; entityId: string; mobility: 'fixed' | 'movable'; pushable: boolean;
  facing: string; pose: { x: number; y: number }; logicalPosition: { tileX: number; tileY: number };
  colliderIds: string[]; source: 'map' | 'actor';
  initialTileIndex: number; initialEnabled: boolean;
  onPlayerPush: PlayerPushResponse;
  boundaries?: { ax: number; ay: number; bx: number; by: number }[];
  worldPosition?: [number, number, number]; worldRotationY?: number;
};
export type SpatialCollider = ISpatialColliderComponent & { bodyId: string };
export type SpatialState = {
  bodies: Map<string, SpatialBody>; colliders: Map<string, SpatialCollider>;
  bodyIdByEntity: Map<string, string>; bodyIdsBySide: Map<string, Set<string>>;
  bodyIdsByCell?: Map<string, Set<string>>; cellsByBody?: Map<string, string[]>;
  width?: number; height?: number; wrapX?: boolean; wrapY?: boolean;
};

/** Populate externally supplied storage once; all query indexes refer to these same records. */
export function installSpatialDefinitions(state: SpatialState, actors: Map<string, DungeonTraversalActor>,
  occupancy: ReadonlyArray<Set<string>>, map: DungeonRuntimeMap, definitions: readonly SpatialBodyDefinition[]) {
  for (const definition of definitions) {
    if (state.bodies.has(definition.id)) continue;
    const entity = map.document.entities.find(row => row.id === definition.entityId)!;
    const anchor = definition.anchor;
    const tile = anchor.kind === 'tile' ? map.topology.tileIds.indexOf(anchor.tileId) : -1;
    const sideIds = anchor.kind === 'side' ? [anchor.sideId] : anchor.kind === 'edge'
      ? map.document.grid.edges.find(edge => edge.id === anchor.edgeId)!.sideIds : [];
    const location = tile >= 0 ? { x: tile % map.width, y: Math.floor(tile / map.width) }
      : sideIds.length ? (() => {
        const side = map.document.grid.sides.find(row => row.id === sideIds[0])!;
        const index = map.topology.tileIds.indexOf(side.tileId);
        return { x: index % map.width, y: Math.floor(index / map.width) };
      })() : (() => { const point = map.document.grid.points.find(row => anchor.kind === 'point' && row.id === anchor.pointId)!;
        return { x: point.gridX - .5, y: point.gridY - .5 }; })();
    const enabled = entity.enabled !== false && definition.initial.enabled !== false && definition.initial.activeByDefault;
    const body: SpatialBody = {
      id: definition.entityId, entityId: definition.entityId, bodyId: definition.id, kind: 'dynamic',
      mobility: definition.initial.mobility, pushable: definition.initial.pushable,
      onPlayerPush: definition.interaction?.enabled === false ? 'block' : definition.interaction?.onPlayerPush ?? 'block',
      enabled, initialEnabled: enabled,
      get blocksMovement() { return this.colliderIds.some(id => { const c=state.colliders.get(id);return c?.enabled!==false&&c?.response==='block'; }); },
      set blocksMovement(value) { for(const id of this.colliderIds){const c=state.colliders.get(id);if(c)c.response=value?'block':'trigger';} },
      spatialFootprint: definition.colliders.some(c => c.enabled !== false && c.response === 'block' && c.footprint === 'full-tile') ? 'full-tile' : 'center',
      movementProfileId: definition.initial.movementProfileId, facing: definition.initial.initialFacing,
      logicalPosition: { tileX: location.x, tileY: location.y }, pose: { ...location },
      get tileIndex() { return tile < 0 && anchor.kind !== 'tile' ? -1 : this.logicalPosition.tileY * map.width + this.logicalPosition.tileX; },
      set tileIndex(index) { this.logicalPosition = { tileX: index < 0 ? -1 : index % map.width, tileY: index < 0 ? -1 : Math.floor(index / map.width) }; },
      initialTileIndex: tile, colliderIds: definition.colliders.map(c => c.id), source: 'map',
      boundaries: sideIds.map(sideId => {
        const side = map.document.grid.sides.find(row => row.id === sideId)!;
        const index = map.topology.tileIds.indexOf(side.tileId), x = index % map.width, y = Math.floor(index / map.width);
        return side.direction === 'north' ? { ax: x-.5, ay: y-.5, bx: x+.5, by: y-.5 }
          : side.direction === 'south' ? { ax: x-.5, ay: y+.5, bx: x+.5, by: y+.5 }
          : side.direction === 'west' ? { ax: x-.5, ay: y-.5, bx: x-.5, by: y+.5 }
          : { ax: x+.5, ay: y-.5, bx: x+.5, by: y+.5 };
      }),
    };
    state.bodies.set(body.bodyId, body); state.bodyIdByEntity.set(body.entityId, body.bodyId);
    actors.set(body.id, body); if (tile >= 0) occupancy[tile].add(body.id);
    for (const c of definition.colliders) state.colliders.set(c.id, { ...c, bodyId: body.bodyId });
    for (const sideId of sideIds) {
      const side = map.document.grid.sides.find(row => row.id === sideId)!;
      const index = map.topology.tileIds.indexOf(side.tileId);
      const key = `${index}:${side.direction}`;
      const ids = state.bodyIdsBySide.get(key) ?? new Set(); ids.add(body.bodyId); state.bodyIdsBySide.set(key, ids);
    }
  }
}

export const spatialBodyFor = (state: SpatialState, entityId: string) => state.bodies.get(state.bodyIdByEntity.get(entityId) ?? entityId);
