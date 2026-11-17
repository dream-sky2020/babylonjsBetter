import type { DungeonRuntime } from './dungeonRuntime.types.ts';
import type { DungeonAgentCommands } from '../dungeon-agent/dungeonAgentControl.ts';
import type { DungeonPlayerCommands } from '../dungeon-player-movement/dungeonPlayerControl.ts';
import { validateDungeonActorAction, DUNGEON_PLAYER_TARGET_ID, type DungeonActorAction } from '../dungeon-interaction/dungeonActorAction.ts';
import { sweepSpatialBody } from '../dungeon-spatial/dungeonSpatialGeometry.ts';
import { getDungeonMapTerrainProperties } from '../map-document/dungeonMapDocument.terrain.ts';

export function executeDungeonActorAction(action: DungeonActorAction, session: {
  runtime: DungeonRuntime;
  signal: AbortSignal;
  player(): DungeonPlayerCommands | null;
  agent(): DungeonAgentCommands | null;
  onTeleport(): void;
}): boolean | Promise<boolean> {
  const errors = validateDungeonActorAction(action, true);
  if (errors.length) throw new Error(errors.join(' '));
  const { runtime, signal } = session;
  signal.throwIfAborted();
  const { traversal, movementResolver: engine, map } = runtime;
  const actorId = action.targetEntityId;
  const isPlayer = actorId === DUNGEON_PLAYER_TARGET_ID;
  const body = traversal.body(actorId);
  if (!body?.enabled || body.mobility !== 'movable' || body.kind !== (isPlayer ? 'player' : 'agent')) {
    throw new Error(`角色「${actorId}」不存在、不可用或不可移动。`);
  }
  const player = isPlayer ? session.player() : null;
  const agent = isPlayer ? null : session.agent();
  if (!player && !agent) throw new Error('当前 Lab 未装配目标角色的控制模块。');
  if (engine.isBusy(actorId)) throw new Error(`角色「${actorId}」仍在执行动作。`);

  if (action.type === 'actor-teleport') {
    const tileIndex = map.topology.tileIds.indexOf(action.tileId);
    if (tileIndex < 0) throw new Error(`当前地图没有落点格「${action.tileId}」。`);
    if (getDungeonMapTerrainProperties(map.document.terrain, action.tileId)?.walkable === false) {
      throw new Error('落点地形不可站立。');
    }
    const pose = { x: tileIndex % map.width, y: Math.floor(tileIndex / map.width) };
    const occupants = traversal.blockingOccupants(tileIndex, actorId);
    if (occupants.length || sweepSpatialBody(traversal.spatial, body, pose, pose, new Set([actorId])).length) {
      throw new Error('传送落点被占用或与阻碍碰撞。');
    }
    if ([...engine.movementReservationsByTile[tileIndex].keys(), ...traversal.pathReservationsByTile[tileIndex].keys()]
      .some(owner => owner !== actorId) || [...engine.storage.groups!.values()]
      .some(group => group.status === 'running' && group.cells.includes(tileIndex))) {
      throw new Error('传送落点已被其他角色预留。');
    }
    if (tileIndex === body.tileIndex) return true;
    if (player) {
      if (!engine.worldPositionFor) throw new Error('当前地图没有配置玩家位置投影。');
      player.teleport({ tileX: pose.x, tileY: pose.y }, engine.worldPositionFor(pose.x, pose.y));
      traversal.clearReservations(actorId);
    } else {
      agent!.teleport(actorId, tileIndex);
    }
    engine.projectBody(body);
    session.onTeleport();
    return true;
  }

  const result = player ? player.move(action.direction, {
    scriptedStep: true,
    movementTimingMode: 'seconds-per-tile',
    movementSecondsPerTile: .6,
    resolveWorldPosition: ({ tileX, tileY }) => {
      if (!engine.worldPositionFor) throw new Error('当前地图没有配置玩家位置投影。');
      return engine.worldPositionFor(tileX, tileY);
    },
  }) : agent!.move(actorId, action.direction, { durationSeconds: .6 });
  if (!result.started || result.blockedReason) throw new Error(`角色「${actorId}」无法走格（${result.blockedReason ?? '未接受移动'}）。`);
  if (result.completed) return true;
  const id = engine.getActiveRequest(actorId)?.id;
  if (!id) throw new Error('未找到已发起的移动请求。');
  return new Promise<boolean>((resolve, reject) => {
    const finish = (error?: unknown) => {
      off();
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve(true);
    };
    const onAbort = () => finish(signal.reason);
    const off = engine.subscribe(change => {
      if (change.requestId !== id || change.actorId !== actorId) return;
      if (change.kind === 'completed') queueMicrotask(() => finish(signal.aborted ? signal.reason : undefined));
      else if (change.kind === 'rolled-back' || change.kind === 'cancelled' || change.kind === 'superseded') {
        finish(new Error(`角色「${actorId}」的移动未完成（${change.kind}）。`));
      }
    });
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}
