import { createDungeonObstacleStatesFromBindings } from '../dungeon-obstacle/dungeonObstacle.ts';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { setDungeonRuntimePlayerPosition } from '../dungeon-runtime/dungeonRuntime.ts';
import type { DungeonRuntime } from '../dungeon-runtime/dungeonRuntime.types.ts';
import type { DungeonMapDirection } from '../map';
import { isDungeonRuntimePositionInside } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS } from '../dungeon-movement/dungeonMovement.direction.ts';
import { indexSpatialBody, sweepSpatialBody, sweepSpatialPair } from '../dungeon-spatial/dungeonSpatialGeometry.ts';
import type {
  ApplyDungeonRuntimeSaveStateResult,
  DungeonRuntimeSaveState,
} from './dungeonRuntimeSave.types';

const DEFAULT_PLAYER_FACING: DungeonMapDirection = 'south';

export const createDungeonRuntimeSaveState = (
  dungeonPresetKey: string,
  runtime: DungeonRuntime,
  spawn: DungeonPlayerSpawnBinding,
): DungeonRuntimeSaveState | null => {
  const saveState: DungeonRuntimeSaveState = { version: 2, dungeonPresetKey };
  if (runtime.playerPosition.tileX !== spawn.tilePosition.x || runtime.playerPosition.tileY !== spawn.tilePosition.y) {
    saveState.playerPosition = { ...runtime.playerPosition };
  }
  if (runtime.playerFacing !== DEFAULT_PLAYER_FACING) saveState.playerFacing = runtime.playerFacing;
  const defaults = createDungeonObstacleStatesFromBindings(runtime.obstacles);
  const changed: Record<string, boolean> = {};
  runtime.obstacleStates.forEach((active, id) => {
    if (defaults.get(id) !== active) changed[id] = active;
  });
  if (Object.keys(changed).length) saveState.obstacleStates = changed;
  if (runtime.installedSystems?.traversal !== false) saveState.bodies = [...runtime.traversal.spatial.bodies.values()]
    .filter(body => body.id !== '$dungeon-player' && body.initialTileIndex >= 0 && (body.mobility === 'movable' || body.enabled !== body.initialEnabled))
    .map(body => ({ bodyId: body.bodyId, entityId: body.entityId, tileX: body.logicalPosition.tileX,
      tileY: body.logicalPosition.tileY, facing: body.facing, enabled: body.enabled }));
  return saveState.playerPosition || saveState.playerFacing || saveState.obstacleStates || saveState.bodies?.length ? saveState : null;
};

export const applyDungeonRuntimeSaveState = (
  runtime: DungeonRuntime,
  saveState: DungeonRuntimeSaveState,
  resolveWorldPosition: (position: Readonly<{ tileX: number; tileY: number }>) => readonly [number, number, number],
): ApplyDungeonRuntimeSaveStateResult => {
  if (saveState.version !== 1 && saveState.version !== 2) {
    throw new Error(`不支持 DungeonRuntimeSaveState 版本 ${String(saveState.version)}。`);
  }
  const warnings: string[] = [];
  const hasSpatialWorld = runtime.installedSystems?.traversal !== false;
  if (hasSpatialWorld) {
    // Loading a safe snapshot ends all old tracks, including cooperative actions.
    for (const body of runtime.traversal.spatial.bodies.values()) {
      runtime.movementResolver.cancelActor(body.id);
      body.presentationOffset = undefined;
      body.pose = { x: body.logicalPosition.tileX, y: body.logicalPosition.tileY };
      indexSpatialBody(runtime.traversal.spatial, body);
    }
    runtime.movementResolver.storage.tracks!.clear();
    runtime.movementResolver.storage.samples!.clear();
    runtime.movementResolver.storage.groups!.clear();
    if(runtime.movementResolver.storage.timing)runtime.movementResolver.storage.timing={pendingSeconds:0};
  }
  let restorePlayer = true;
  if (saveState.version === 2 && runtime.installedSystems?.traversal !== false) {
    const world = runtime.traversal;
    // Validate a complete candidate before touching indexes; swaps remain atomic on restore.
    const seen = new Set<string>();
    let invalid = false;
    const rows = (saveState.bodies ?? []).flatMap(row => {
      const body = world.body(row.entityId);
      if (!body || body.bodyId !== row.bodyId) { warnings.push(`空间存档物体“${row.entityId}”已不存在或身份改变。`);return []; }
      if (seen.has(row.bodyId) || body.id === '$dungeon-player' || !Number.isInteger(row.tileX) || !Number.isInteger(row.tileY)
        || !isDungeonRuntimePositionInside(runtime.map,row.tileX,row.tileY)
        || (body.mobility === 'fixed' && row.tileY*runtime.map.width+row.tileX !== body.initialTileIndex)
        || typeof row.enabled !== 'boolean' || !DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS.some(direction => direction === row.facing)) {
        invalid = true; warnings.push(`空间存档物体“${row.entityId}”数据无效。`);return [];
      }
      seen.add(row.bodyId);
      return [{row,body,to:row.tileY*runtime.map.width+row.tileX}];
    });
    const player = world.body('$dungeon-player');
    const position = saveState.playerPosition ?? runtime.playerPosition;
    if (player && Number.isInteger(position.tileX) && Number.isInteger(position.tileY)
      && isDungeonRuntimePositionInside(runtime.map,position.tileX,position.tileY)) {
      rows.push({body:player,to:position.tileY*runtime.map.width+position.tileX,row:{bodyId:player.bodyId,entityId:player.entityId,
        ...position,facing:saveState.playerFacing??player.facing,enabled:player.enabled}});
    } else if (saveState.playerPosition) invalid = true;
    const owned = new Set(rows.map(item=>item.body.id));
    const targets = new Set<number>();
    const valid = !invalid && rows.every(item => !item.row.enabled || !item.body.blocksMovement || (!targets.has(item.to)
      && (targets.add(item.to),true) && ![...(world.occupantIdsByTile[item.to]??[])].some(id=>!owned.has(id)&&world.body(id)?.enabled&&world.body(id)?.blocksMovement)));
    const geometryValid = valid && rows.every((item,index) => !item.row.enabled || (
      !sweepSpatialBody(world.spatial,item.body,{x:item.row.tileX,y:item.row.tileY},{x:item.row.tileX,y:item.row.tileY},owned).length
      && rows.slice(index+1).every(other => !other.row.enabled || !sweepSpatialPair(world.spatial,item.body,
        {x:item.row.tileX,y:item.row.tileY},{x:item.row.tileX,y:item.row.tileY},other.body,
        {x:other.row.tileX,y:other.row.tileY},{x:other.row.tileX,y:other.row.tileY}))));
    if (!geometryValid) { restorePlayer = false; warnings.push('空间存档存在冲突，整组位置保持恢复前状态。'); }
    else {
      for(const {body} of rows)world.occupantIdsByTile[body.tileIndex]?.delete(body.id);
      for(const {body,row,to} of rows){body.tileIndex=to;body.enabled=row.enabled;body.facing=row.facing;
        body.pose={x:row.tileX,y:row.tileY};world.occupantIdsByTile[to].add(body.id);indexSpatialBody(world.spatial,body);}
    }
  }
  if (saveState.playerPosition && restorePlayer) {
    if (isDungeonRuntimePositionInside(runtime.map, saveState.playerPosition.tileX, saveState.playerPosition.tileY)) {
      setDungeonRuntimePlayerPosition(runtime, saveState.playerPosition);
      runtime.playerWorldPosition = [...resolveWorldPosition(saveState.playerPosition)];
    } else {
      warnings.push(
        `玩家存档位置 (${saveState.playerPosition.tileX}, ${saveState.playerPosition.tileY}) 已超出当前地图，已使用出生点。`,
      );
    }
  }
  if (saveState.playerFacing) {
    runtime.playerFacing = saveState.playerFacing;
    runtime.playerWorldRotationY = saveState.playerFacing === 'north' ? Math.PI
      : saveState.playerFacing === 'east' ? Math.PI / 2
        : saveState.playerFacing === 'west' ? -Math.PI / 2 : 0;
  }
  Object.entries(saveState.obstacleStates ?? {}).forEach(([id, active]) => {
    if (!runtime.obstacleStates.has(id)) {
      warnings.push(`地牢运行时存档中的阻碍“${id}”在当前预设中不存在，已忽略。`);
      return;
    }
    runtime.obstacleStates.set(id, active);
  });
  runtime.playerMovement = null;
  return { warnings };
};
