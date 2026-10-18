import type { DungeonTraversalWorld } from '../dungeon-traversal/index.ts';
import { requestSpatialGroup, advanceSpatialGroups, spatialGroupProgress, configurePushTiming, configureSwapTiming, DEFAULT_SWAP_DURATION_SECONDS, type SpatialActionGroup } from './dungeonActionGroup.ts';
import { indexSpatialBody, sweepSpatialBody } from '../dungeon-spatial/dungeonSpatialGeometry.ts';
import type { SpatialBody } from '../dungeon-spatial/dungeonSpatialState.ts';
import { spatialPresentationPose } from '../dungeon-spatial/dungeonSpatialState.ts';
import type { DungeonMovementDirection } from '../dungeon-movement/dungeonMovement.direction.ts';
import type {
  DungeonMoveAdvanceResult,
  DungeonMoveRequest,
  DungeonMoveRequestOptions,
  DungeonMoveRequestResult,
  DungeonMovementDebugSnapshot,
  DungeonMovementResolverConfig,
  DungeonMovementChange,
  DungeonMovementStorage,
  DungeonActionTickResult,
  DungeonActionStall,
} from '../dungeon-movement/dungeonMovement.types.ts';
import {
  getDungeonDiagonalCornerIndex, getDungeonMovementDirectionVector,
  isDungeonDiagonalDirection,
  resolveDungeonMovementProfile,
} from '../dungeon-movement/dungeonMovement.direction.ts';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const requireUnitInterval = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label}必须位于 0 到 1 之间。`);
  }
  return value;
};

/** One authoritative classification for action admission; a presentation track may mirror a move. */
export type DungeonActorActionState =
  | { kind: 'idle' }
  | { kind: 'move' | 'rollback'; request: DungeonMoveRequest }
  | { kind: 'track' }
  | { kind: 'group'; group: SpatialActionGroup };

/**
 * 管理格步的临时目标占位。实占位仍由 DungeonTraversalWorld 持有，只有 Commit 时才移动。
 * Resolver 不依赖 Babylon；表现层只读取 visualProgress 播放 Forward 或 Rollback。
 */
export class DungeonActionEngine {
  readonly traversal: DungeonTraversalWorld;
  readonly storage: DungeonMovementStorage;
  externallyDriven = false;
  private readonly groupListeners = new Set<(group: SpatialActionGroup) => void>();
  subscribeGroupCompleted(run: (group: SpatialActionGroup) => void) { this.groupListeners.add(run);return()=>{this.groupListeners.delete(run);}; }
  groupChanged(group: SpatialActionGroup, kind: 'contact'|'committed'|'completed'|'cancelled') {
    for(const member of group.members)this.changed({kind,actorId:member.actorId,requestId:group.id,fromTileIndex:member.from,toTileIndex:member.to});
    if(kind==='completed')for(const run of this.groupListeners)run(group);
  }
  cancelGroup(id: string): void {
    const group=this.storage.groups!.get(id);if(!group||group.status!=='running'||group.recovering)return;
    for(const member of group.members) {
      const body=this.traversal.body(member.actorId)!,original=member.path;
      member.recoveryOffset=body.presentationOffset?{...body.presentationOffset}:undefined;
      const scaled=spatialGroupProgress(group,group.elapsed/group.duration,original.length-1,member);
      const index=Math.min(original.length-2,Math.floor(scaled));
      member.path=group.committed?[{...body.pose},...original.slice(index+1)]:[{...body.pose},...original.slice(0,index+1).reverse()];
      if(member.path.length<2)member.path.push({...body.pose});
    }
    group.elapsed=0;group.duration=group.kind==='swap'?.001:.25;group.recovering=true;
    if(group.kind==='push'&&group.secondsPerTile)configurePushTiming(group);
    if(group.kind==='swap'&&group.secondsPerTile)configureSwapTiming(this,group);
  }
  worldPositionFor?: (x: number, y: number) => [number, number, number];
  /** Cosmetic distance in tile units; zero gives a plain 2D crossing. */
  swapPresentationOffset = .12;
  projectBody(body: SpatialBody) { if (this.worldPositionFor) { const pose=spatialPresentationPose(body);body.worldPosition = this.worldPositionFor(pose.x, pose.y); } }
  /** The duration of walking one tile; contact distance adds time instead of accelerating the push. */
  requestPush(actorId: string, direction: DungeonMovementDirection, secondsPerTile = .6) { return requestSpatialGroup(this, 'push', actorId, direction, secondsPerTile); }
  /** Presented path follows initiator speed by default; tile timing can ignore the cosmetic detour. */
  requestSwap(actorId: string, otherId: string, minimumDuration = DEFAULT_SWAP_DURATION_SECONDS,
    secondsPerTile = .6, includePresentationDistance = true,
    priority?: {basePriority?:number;progressWeight?:number}) {
    return requestSpatialGroup(this, 'swap', actorId, otherId, minimumDuration, secondsPerTile, includePresentationDistance,priority);
  }
  private advanceGroups(delta: number, ready: () => boolean) { advanceSpatialGroups(this, delta, ready); }
  get samples() { return this.storage.samples!; }
  /** A committed move owns its destination; its old tile may be entered while its pose finishes travelling. */
  private releasedTileHandoffIds(request: DungeonMoveRequest): Set<string> {
    const partners = new Set<string>();
    if (request.state === 'rollback') return partners;
    if (request.state === 'forward-after-commit') for (const actorId of request.releasedTileHandoffActorIds ?? []) {
      const body = this.traversal.body(actorId);
      const next = this.getActiveRequest(actorId);
      if (body?.tileIndex === request.fromTileIndex
        || (next?.state !== 'rollback' && (next?.fromTileIndex === request.fromTileIndex
          || next?.toTileIndex === request.fromTileIndex))) partners.add(actorId);
    }
    for (const other of this.requests.values()) {
      if (other.actorId === request.actorId || other.state === 'rollback') continue;
      const handoff = (other.state === 'forward-after-commit' && other.fromTileIndex === request.toTileIndex)
        || (request.state === 'forward-after-commit' && request.fromTileIndex === other.toTileIndex);
      if (handoff) partners.add(other.actorId);
    }
    return partners;
  }
  /** Only this method advances physical requests in a composed session. Projectors read samples. */
  tick(delta: number, project: (delta: number) => void = () => {}, ready: () => boolean = () => true,
    options: { maxBoundaries?: number } = {}): DungeonActionTickResult {
    if (!Number.isFinite(delta) || delta < 0) throw new RangeError('动作时间必须非负有限。');
    const budget=options.maxBoundaries??128;
    if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('动作处理预算必须为正整数。');
    const timing=this.storage.timing??={pendingSeconds:0};
    let remaining=timing.pendingSeconds,consumed=0,count=0;
    const finish=(yielded=false,paused=false):DungeonActionTickResult=>{
      timing.pendingSeconds=remaining;
      return timing.lastTick={consumedSeconds:consumed,remainingSeconds:remaining,boundaries:count,yielded,paused,
        ...(timing.stall?{stall:timing.stall}:{})};
    };
    if (!ready()||timing.stall) return finish(false,true);
    remaining+=delta;
    if(!Number.isFinite(remaining))throw new RangeError('累计动作时间超出有限数值范围。');
    this.samples.clear(); project(0);
    const history=[...this.storage.groups!.values()].filter(g=>g.status!=='running');
    for(const group of history.slice(0,Math.max(0,history.length-50)))this.storage.groups!.delete(group.id);
    do {
      if (!ready()) return finish(false,true);
      let slice = remaining;
      // Rotation and blocked-attempt tracks share the same event boundaries.
      // Their projectors consume only this slice; the engine owns all remainder.
      const trackBoundaries:Array<{actorId:string;value:unknown;elapsed:number;duration:number;until:number}>=[];
      for (const [actorId,value] of this.storage.tracks!) {
        if (!value || typeof value !== 'object') continue;
        const track = value as { elapsedSeconds?: number; durationSeconds?: number;
          movementDurationSeconds?: number; turnDurationSeconds?: number; requestId?:string };
        // A move's presentation facade has no independent clock or boundary.
        if(track.requestId&&this.getActiveRequest(actorId)?.id===track.requestId)continue;
        const duration = Math.max(track.durationSeconds ?? 0, track.movementDurationSeconds ?? 0, track.turnDurationSeconds ?? 0);
        const until = duration - (track.elapsedSeconds ?? 0);
        if(Number.isFinite(until))trackBoundaries.push({actorId,value,elapsed:track.elapsedSeconds??0,duration,until});
        if (Number.isFinite(until) && until > 1e-9) slice = Math.min(slice, until);
      }
      for (const group of this.storage.groups!.values()) if (group.status === 'running') {
        const marks=[...new Set([...(group.segmentEndProgress??[]),...(group.recovering||group.kind==='swap'?[]:[.5]),1])].sort((a,b)=>a-b);
        for(const mark of marks){const until=group.duration*mark-group.elapsed;if(until>1e-9){slice=Math.min(slice,until);break;}}
      }
      for (const request of this.requests.values()) {
        const until = request.state === 'rollback' ? (request.rollbackDurationSeconds ?? 0) - (request.rollbackElapsedSeconds ?? 0)
          : request.durationSeconds * (request.state === 'forward-before-commit' ? request.commitProgress : 1) - request.elapsedSeconds;
        if (until > 1e-9) slice = Math.min(slice, until);
      }
      this.samples.clear();
      const cannotConsumeTime=remaining>0&&remaining-slice===remaining;
      const before=cannotConsumeTime?this.boundaryFingerprint():undefined;
      const actors = [...this.requests.values()].sort((a,b)=>this.priorityOf(b)-this.priorityOf(a)||a.actorId.localeCompare(b.actorId)).map(request => request.actorId);
      for (const actorId of actors) {
        if (!ready()) return finish(false,true);
        const request = this.getActiveRequest(actorId); if (!request) continue;
        let waiting = request.waitForActorIds?.some(id => this.getActiveRequest(id)?.state === 'rollback');
        const body=this.traversal.body(actorId);
        if(!waiting&&!request.ignoreDynamicOccupancy&&body&&request.fromTileIndex>=0) {
          const vector=getDungeonMovementDirectionVector(request.direction);
          const progress=request.state==='rollback'
            ? (request.rollbackStartProgress??0)*(1-Math.min(1,((request.rollbackElapsedSeconds??0)+slice)/Math.max(1e-9,request.rollbackDurationSeconds??0)))
            : Math.min(1,(request.elapsedSeconds+slice)/Math.max(1e-9,request.durationSeconds));
          const target={x:request.fromTileIndex%this.traversal.map.width+vector.x*progress,y:Math.floor(request.fromTileIndex/this.traversal.map.width)+vector.y*progress};
          const hits=sweepSpatialBody(this.traversal.spatial,body,body.pose,target,this.releasedTileHandoffIds(request));
          if(hits.length){
            if(request.state==='forward-before-commit')this.beginRollback(request);
            else waiting=true;
          }
        }
        this.samples.set(actorId, this.advanceRequest(actorId, waiting ? 0 : slice));
        this.updatePose(request);
      }
      this.advanceGroups(slice, ready);
      this.storage.simulationSeconds! += slice;
      consumed+=slice;
      const nextRemaining=Math.max(0,remaining-slice);
      if (!ready()) {remaining=nextRemaining;return finish(false,true);}
      project(slice);
      count++;
      remaining=nextRemaining;
      if(!ready())return finish(false,true);
      const unchangedTracks=trackBoundaries.filter(boundary=>{
        const current=this.storage.tracks!.get(boundary.actorId) as {elapsedSeconds?:number;durationSeconds?:number;movementDurationSeconds?:number;turnDurationSeconds?:number}|undefined;
        return boundary.until<=slice+1e-12&&current===boundary.value&&(current?.elapsedSeconds??0)===boundary.elapsed
          &&Math.max(current?.durationSeconds??0,current?.movementDurationSeconds??0,current?.turnDurationSeconds??0)===boundary.duration;
      });
      const fingerprint=unchangedTracks.length?JSON.stringify(unchangedTracks.map(({actorId,elapsed,duration})=>({actorId,elapsed,duration}))):undefined;
      timing.noProgressBoundary=fingerprint?{fingerprint,repeats:timing.noProgressBoundary?.fingerprint===fingerprint?timing.noProgressBoundary.repeats+1:1}:undefined;
      const repeats=timing.noProgressBoundary?.repeats??0;
      if((cannotConsumeTime&&before===this.boundaryFingerprint())||repeats>=2) {
        timing.stall={kind:'no-progress',reason:repeats>=2?'independent-track':'time-resolution',repeatedBoundaryCount:repeats,
          message:repeats>=2?'独立动作轨道连续到达同一边界却未推进，已暂停模拟；可查看现场并重新加载当前地图。'
            :'动作时间和边界状态均未前进，已暂停模拟；可查看现场并重新加载当前地图。',
          simulationSeconds:this.storage.simulationSeconds!,remainingSeconds:remaining,actors:this.boundaryActors()};
        return finish(false,true);
      }
      // Rules/projectors have completed this entire boundary before we yield.
      if(count>=budget&&remaining>0)return finish(true);
      if (!remaining) break;
    } while (remaining > 0);
    return finish();
  }
  private boundaryActors(): DungeonActionStall['actors'] {
    return [
      ...[...this.requests.values()].map(request=>({actorId:request.actorId,actionId:request.id,kind:request.state,
        elapsedSeconds:request.state==='rollback'?request.rollbackElapsedSeconds:request.elapsedSeconds,
        boundarySeconds:request.state==='rollback'?request.rollbackDurationSeconds:request.durationSeconds*(request.state==='forward-before-commit'?request.commitProgress:1)})),
      ...[...this.storage.groups!.values()].filter(group=>group.status==='running').flatMap(group=>group.members.map(member=>({
        actorId:member.actorId,actionId:group.id,kind:group.recovering?'group-recovery':group.kind,elapsedSeconds:group.elapsed,boundarySeconds:group.duration}))),
      ...[...this.storage.tracks!.entries()].map(([actorId,value])=>{
        const track=value as {kind?:string;requestId?:string;elapsedSeconds?:number;durationSeconds?:number;movementDurationSeconds?:number;turnDurationSeconds?:number};
        return {actorId,actionId:track?.requestId,kind:track?.kind??'track',elapsedSeconds:track?.elapsedSeconds,
          boundarySeconds:Math.max(track?.durationSeconds??0,track?.movementDurationSeconds??0,track?.turnDurationSeconds??0)};
      }),
    ];
  }
  private boundaryFingerprint(): string { return JSON.stringify(this.boundaryActors()); }
  private updatePose(request: DungeonMoveRequest) {
    const body = this.traversal.body(request.actorId); if (!body) return;
    const vector = getDungeonMovementDirectionVector(request.direction);
    const sample = this.samples.get(request.actorId);
    const p = sample?.visualProgress ?? (request.durationSeconds <= 0 ? 1 : request.elapsedSeconds / request.durationSeconds);
    const x = request.fromTileIndex % this.traversal.map.width, y = Math.floor(request.fromTileIndex / this.traversal.map.width);
    body.pose = { x: x + vector.x * p, y: y + vector.y * p };
    if(sample?.completed&&!sample.rolledBack&&request.toTileIndex>=0)body.pose={x:body.logicalPosition.tileX,y:body.logicalPosition.tileY};
    indexSpatialBody(this.traversal.spatial, body); this.projectBody(body);
  }
  advanceActor(actorId: string, deltaSeconds: number): DungeonMoveAdvanceResult {
    if (!this.externallyDriven || (deltaSeconds === 0 && this.getActiveRequest(actorId)?.durationSeconds === 0)) {
      const request=this.getActiveRequest(actorId),result=this.advanceRequest(actorId,deltaSeconds);
      if(request){this.samples.set(actorId,result);this.updatePose(request);}return result;
    }
    const sample = this.samples.get(actorId);
    if (sample) return sample;
    const request = this.getActiveRequest(actorId);
    return { active: !!request, completed: false, committed: false, rolledBack: false,
      request, state: request?.state, visualProgress: request ? request.elapsedSeconds / Math.max(1e-9, request.durationSeconds) : 1,
      consumedSeconds: deltaSeconds, remainingSeconds: 0 };
  }
  get config() { return this.storage.config; }
  set config(value: DungeonMovementResolverConfig) { this.storage.config = value; }
  get movementReservationsByTile() { return this.storage.movementReservationsByTile; }
  get movementReservationsByPoint() { return this.storage.movementReservationsByPoint; }
  private get requests() { return this.storage.activeRequests; }
  private get activeRequestIdByActor() { return this.storage.activeRequestIdByActor; }
  private get nextRequestSequence() { return this.storage.nextRequestSequence; }
  private set nextRequestSequence(value: number) { this.storage.nextRequestSequence = value; }
  private readonly changeListeners = new Set<(change: DungeonMovementChange) => void>();

  subscribe(listener: (change: DungeonMovementChange) => void): () => void {
    this.changeListeners.add(listener);
    return () => { this.changeListeners.delete(listener); };
  }

  private changed(change: DungeonMovementChange): void {
    this.changeListeners.forEach((listener) => {
      try { listener(change); } catch (error) { console.error('Dungeon 移动状态监听失败。', error); }
    });
  }

  private rejected(actorId: string, result: DungeonMoveRequestResult): DungeonMoveRequestResult {
    this.changed({ kind: 'request-rejected', actorId, blockedReason: result.blockedReason,
      blockingEntityIds: result.blockingEntityIds });
    return result;
  }

  constructor(
    traversal: DungeonTraversalWorld,
    config: Partial<DungeonMovementResolverConfig> = {},
    storage?: DungeonMovementStorage,
  ) {
    this.traversal = traversal;
    // Standalone callers retain their convenience allocation; composed hosts inject storage.
    this.storage = storage ?? {
      config: {
        progressWeight: config.progressWeight ?? 1,
        commitProgress: requireUnitInterval(config.commitProgress ?? 0.5, '默认提交进度'),
        playerBasePriority: config.playerBasePriority ?? 1000,
      },
      activeRequests: new Map(), activeRequestIdByActor: new Map(), nextRequestSequence: 1,
      movementReservationsByTile: Array.from({ length: traversal.occupantIdsByTile.length }, () => new Map()),
      movementReservationsByPoint: Array.from({ length: traversal.map.topology.pointIds.length }, () => new Map()),
    };
    this.storage.samples ??= new Map(); this.storage.groups ??= new Map(); this.storage.tracks ??= new Map(); this.storage.simulationSeconds ??= 0;
    requireUnitInterval(this.config.commitProgress, '默认提交进度');
    if (!Number.isFinite(this.config.progressWeight) || this.config.progressWeight < 0) {
      throw new RangeError('移动进度优先级权重必须是非负有限数。');
    }
    if (!Number.isFinite(this.config.playerBasePriority)) {
      throw new RangeError('玩家基础移动优先级必须是有限数。');
    }
    if (this.movementReservationsByTile.length !== traversal.occupantIdsByTile.length
      || this.movementReservationsByPoint.length !== traversal.map.topology.pointIds.length) {
      throw new RangeError('移动存储的预留表尺寸与地图不一致。');
    }
  }

  updateConfig(next: Partial<DungeonMovementResolverConfig>): void {
    const progressWeight = next.progressWeight ?? this.config.progressWeight;
    const commitProgress = next.commitProgress ?? this.config.commitProgress;
    const playerBasePriority = next.playerBasePriority ?? this.config.playerBasePriority;
    if (!Number.isFinite(progressWeight) || progressWeight < 0) {
      throw new RangeError('移动进度优先级权重必须是非负有限数。');
    }
    if (!Number.isFinite(playerBasePriority)) {
      throw new RangeError('玩家基础移动优先级必须是有限数。');
    }
    this.config = {
      progressWeight,
      commitProgress: requireUnitInterval(commitProgress, '默认提交进度'),
      playerBasePriority,
    };
    this.changed({ kind: 'config-changed' });
  }

  getActiveRequest(actorId: string): DungeonMoveRequest | undefined {
    const requestId = this.activeRequestIdByActor.get(actorId);
    return requestId ? this.requests.get(requestId) : undefined;
  }

  getRequest(requestId: string): DungeonMoveRequest | undefined {
    return this.requests.get(requestId);
  }

  isBusy(actorId: string): boolean {
    return this.actionStateOf(actorId).kind !== 'idle';
  }
  actionStateOf(actorId: string): DungeonActorActionState {
    const group=[...this.storage.groups!.values()].find(value=>value.status==='running'
      && value.members.some(member=>member.actorId===actorId));
    if(group)return {kind:'group',group};
    const request=this.getActiveRequest(actorId);
    const hasTrack=this.storage.tracks!.has(actorId),track=this.storage.tracks!.get(actorId);
    if(request?.state==='rollback')return {kind:'rollback',request};
    if(hasTrack) {
      if(!request || track===null || typeof track!=='object' || !('kind' in track) || !('requestId' in track)
        || track.kind!=='move' || track.requestId!==request.id)return {kind:'track'};
    }
    return request?{kind:'move',request}:{kind:'idle'};
  }
  get hasActiveRequests(): boolean {
    return this.requests.size > 0 || [...this.storage.groups!.values()].some(group => group.status === 'running');
  }
  /** Live request records for shared diagnostics; no snapshot or per-frame copy. */
  get activeRequests(): ReadonlyMap<string, DungeonMoveRequest> { return this.requests; }

  priorityOf(request: DungeonMoveRequest): number {
    const progress = request.durationSeconds <= 0 ? 1 : clamp01(request.elapsedSeconds / request.durationSeconds);
    return request.basePriority + request.progressWeight * progress;
  }

  private reservationWinner(tileIndex: number): DungeonMoveRequest | undefined {
    const requestId = [...(this.movementReservationsByTile[tileIndex]?.values() ?? [])][0];
    return requestId ? this.requests.get(requestId) : undefined;
  }

  private releaseReservation(request: DungeonMoveRequest): void {
    this.movementReservationsByTile[request.toTileIndex]?.delete(request.actorId);
    if (request.crossingPointIndex !== undefined) {
      this.movementReservationsByPoint[request.crossingPointIndex]?.delete(request.actorId);
    }
  }

  /** Called only after a replacement swap has passed all collision and reservation checks. */
  supersedeMoveForSwap(request: DungeonMoveRequest, actionId: string): void {
    if (this.getActiveRequest(request.actorId)?.id !== request.id) throw new Error('被换位接管的移动已失效。');
    this.releaseReservation(request);
    this.activeRequestIdByActor.delete(request.actorId);
    this.requests.delete(request.id);
    this.samples.delete(request.actorId);
    this.changed({ kind: 'superseded', actorId: request.actorId, requestId: request.id,
      fromTileIndex: request.fromTileIndex, toTileIndex: request.toTileIndex,
      replacedByActionId: actionId, wasCommitted: request.state === 'forward-after-commit' });
  }

  private beginRollback(request: DungeonMoveRequest): void {
    if (request.state !== 'forward-before-commit') return;
    const progress = request.durationSeconds <= 0 ? 0 : clamp01(request.elapsedSeconds / request.durationSeconds);
    this.releaseReservation(request);
    request.state = 'rollback';
    request.rollbackStartProgress = progress;
    request.rollbackElapsedSeconds = 0;
    request.rollbackDurationSeconds = progress <= 0 ? 0 : Math.max(0.08, request.durationSeconds * progress);
    this.changed({ kind: 'rollback-started', actorId: request.actorId, requestId: request.id,
      fromTileIndex: request.fromTileIndex, toTileIndex: request.toTileIndex });
  }

  requestMove(options: DungeonMoveRequestOptions): DungeonMoveRequestResult {
    if (!Number.isFinite(options.durationSeconds) || options.durationSeconds < 0) {
      throw new RangeError('移动时长必须是非负有限数。');
    }
    if (this.isBusy(options.actorId)) {
      return this.rejected(options.actorId,
        { accepted: false, blockedReason: 'movement-in-progress', blockingEntityIds: [] });
    }
    const actor = this.traversal.actors.get(options.actorId);
    if (!actor) throw new Error(`不存在通行 Actor“${options.actorId}”。`);
    if(!actor.enabled||this.traversal.body(options.actorId)?.mobility==='fixed')return this.rejected(options.actorId,
      {accepted:false,blockedReason:'movement-obstacle',blockingEntityIds:[actor.id]});
    const outsideTarget = options.outsideMapStep?.toTileIndex;
    if (outsideTarget !== undefined && (outsideTarget !== -1 && (!Number.isInteger(outsideTarget) || !this.traversal.occupantIdsByTile[outsideTarget]))) throw new RangeError('地图外移动的目标索引无效。');
    const inspection = outsideTarget !== undefined ? {
      toTileIndex: outsideTarget,
      blockingEntityIds: options.ignoreDynamicOccupancy ? [] : this.traversal.blockingOccupants(outsideTarget, actor.id),
      blockedReason: undefined,
    } : this.traversal.inspectStep(actor.id, actor.tileIndex, options.direction, {
      checkTerrain: options.checkTerrain,
      checkStaticObstacles: options.checkStaticObstacles,
      ignoreDynamicOccupancy: options.ignoreDynamicOccupancy,
    });
    if (outsideTarget !== undefined && inspection.blockingEntityIds.length) return this.rejected(actor.id, { accepted: false, blockedReason: 'occupied', blockingEntityIds: inspection.blockingEntityIds });
    if (inspection.blockedReason || inspection.toTileIndex === undefined) {
      return this.rejected(options.actorId, {
        accepted: false,
        blockedReason: inspection.blockedReason ?? 'map-boundary',
        blockingEntityIds: inspection.blockingEntityIds,
      });
    }

    const request: DungeonMoveRequest = {
      id: `move:${this.nextRequestSequence++}:${options.actorId}`,
      actorId: options.actorId,
      direction: options.direction,
      fromTileIndex: actor.tileIndex,
      toTileIndex: inspection.toTileIndex,
      ...(isDungeonDiagonalDirection(options.direction)
        && !options.ignoreDynamicOccupancy && outsideTarget === undefined
        && resolveDungeonMovementProfile(actor.movementProfileId).reserveDiagonalCrossing
        ? {
          crossingPointIndex: this.traversal.map.topology.pointIndices[
            actor.tileIndex * 4 + getDungeonDiagonalCornerIndex(options.direction)
          ],
        }
        : {}),
      durationSeconds: options.durationSeconds,
      commitProgress: requireUnitInterval(options.commitProgress ?? this.config.commitProgress, '提交进度'),
      basePriority: options.basePriority ?? 0,
      progressWeight: options.progressWeight ?? this.config.progressWeight,
      ignoreDynamicOccupancy: options.ignoreDynamicOccupancy,
      allowOutsideMap: outsideTarget !== undefined,
      state: 'forward-before-commit',
      elapsedSeconds: 0,
    };
    const groupConflict = [...this.storage.groups!.values()].find(group => group.status === 'running'
      && (group.cells.includes(request.toTileIndex) || group.members.some(member => member.actorId === options.actorId)));
    if (groupConflict) return this.rejected(options.actorId, { accepted: false, blockedReason: 'reservation-conflict',
      blockingEntityIds: groupConflict.members.map(member => member.actorId) });
    const tileWinner = options.ignoreDynamicOccupancy ? undefined : this.reservationWinner(request.toTileIndex);
    const pointRequestId = request.crossingPointIndex === undefined
      ? undefined
      : [...(this.movementReservationsByPoint[request.crossingPointIndex]?.values() ?? [])][0];
    const pointWinner = pointRequestId ? this.requests.get(pointRequestId) : undefined;
    const winners = [...new Map(
      [tileWinner, pointWinner].filter((winner): winner is DungeonMoveRequest => !!winner)
        .map((winner) => [winner.id, winner]),
    ).values()];
    for (const winner of winners) {
      const scoreDelta = this.priorityOf(request) - this.priorityOf(winner);
      const requestWins = scoreDelta > 0
        || (scoreDelta === 0 && request.actorId.localeCompare(winner.actorId) < 0);
      if (!requestWins) {
        return this.rejected(options.actorId, {
          accepted: false,
          blockedReason: 'reservation-conflict',
          blockingEntityIds: [winner.actorId],
        });
      }
    }
    winners.forEach((winner) => this.beginRollback(winner));
    if (winners.length) request.waitForActorIds = winners.map(winner => winner.actorId);
    for (const other of this.requests.values()) {
      // World listeners run inside moveActor(), before the request state flips.
      const committed = other.state === 'forward-after-commit'
        || (other.state === 'forward-before-commit'
          && this.traversal.body(other.actorId)?.tileIndex === other.toTileIndex);
      if (!committed || other.fromTileIndex !== request.toTileIndex) continue;
      (other.releasedTileHandoffActorIds ??= []).push(request.actorId);
    }
    this.requests.set(request.id, request);
    this.activeRequestIdByActor.set(request.actorId, request.id);
    if (!options.ignoreDynamicOccupancy) this.movementReservationsByTile[request.toTileIndex]?.set(request.actorId, request.id);
    if (request.crossingPointIndex !== undefined && request.crossingPointIndex >= 0) {
      this.movementReservationsByPoint[request.crossingPointIndex].set(request.actorId, request.id);
    }
    this.changed({ kind: 'request-accepted', actorId: request.actorId, requestId: request.id,
      fromTileIndex: request.fromTileIndex, toTileIndex: request.toTileIndex,
      crossingPointIndex: request.crossingPointIndex });
    return {
      accepted: true,
      request,
      ...(winners[0] ? { displacedRequestId: winners[0].id } : {}),
      blockingEntityIds: [],
    };
  }

  cancelActor(actorId: string): void {
    // Explicit teleport/despawn API: abort the whole group at its committed anchors.
    // Normal gameplay interruptions use cancelGroup's continuous recovery instead.
    for(const group of this.storage.groups!.values())if(group.status==='running'&&group.members.some(m=>m.actorId===actorId)){
      group.status='cancelled';for(const member of group.members){const body=this.traversal.body(member.actorId);if(body){
          body.presentationOffset=undefined;
          body.pose={x:body.logicalPosition.tileX,y:body.logicalPosition.tileY};indexSpatialBody(this.traversal.spatial,body);this.projectBody(body);}}
      this.groupChanged(group,'cancelled');
    }
    const request = this.getActiveRequest(actorId);
    if (!request) return;
    this.releaseReservation(request);
    this.activeRequestIdByActor.delete(actorId);
    this.requests.delete(request.id);
    this.changed({ kind: 'cancelled', actorId, requestId: request.id,
      fromTileIndex: request.fromTileIndex, toTileIndex: request.toTileIndex });
  }

  private advanceRequest(actorId: string, deltaSeconds: number): DungeonMoveAdvanceResult {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('移动帧时间必须是非负有限数。');
    }
    const request = this.getActiveRequest(actorId);
    if (!request) {
      return {
        active: false, completed: false, committed: false, rolledBack: false,
        visualProgress: 1, consumedSeconds: 0, remainingSeconds: deltaSeconds,
      };
    }

    let committed = false;
    let completed = false;
    let rolledBack = false;
    let consumedSeconds: number;
    let visualProgress: number;

    if (request.state === 'rollback') {
      const duration = request.rollbackDurationSeconds ?? 0;
      const elapsed = request.rollbackElapsedSeconds ?? 0;
      consumedSeconds = Math.min(deltaSeconds, Math.max(0, duration - elapsed));
      request.rollbackElapsedSeconds = elapsed + consumedSeconds;
      const rollbackProgress = duration <= 0 ? 1 : clamp01(request.rollbackElapsedSeconds / duration);
      visualProgress = (request.rollbackStartProgress ?? 0) * (1 - rollbackProgress);
      if (rollbackProgress >= 1) {
        completed = true;
        rolledBack = true;
      }
    } else {
      consumedSeconds = Math.min(deltaSeconds, Math.max(0, request.durationSeconds - request.elapsedSeconds));
      request.elapsedSeconds += consumedSeconds;
      visualProgress = request.durationSeconds <= 0 ? 1 : clamp01(request.elapsedSeconds / request.durationSeconds);
      if (request.state === 'forward-before-commit' && visualProgress >= request.commitProgress) {
        // A debug/teleporting actor can enter an already reserved tile between request and commit.
        if (!request.ignoreDynamicOccupancy && this.traversal.blockingOccupants(request.toTileIndex, request.actorId).length) {
          this.beginRollback(request);
          return { active: true, completed: false, committed: false, rolledBack: false, state: request.state, request, visualProgress, consumedSeconds, remainingSeconds: 0 };
        }
        this.traversal.moveActor(request.actorId, request.toTileIndex, request.id, { ...request, preservePose: true });
        this.releaseReservation(request);
        request.state = 'forward-after-commit';
        committed = true;
        this.changed({ kind: 'committed', actorId, requestId: request.id,
          fromTileIndex: request.fromTileIndex, toTileIndex: request.toTileIndex });
      }
      if (visualProgress >= 1) completed = true;
    }

    if (completed) {
      this.activeRequestIdByActor.delete(actorId);
      this.requests.delete(request.id);
      this.changed({ kind: rolledBack ? 'rolled-back' : 'completed', actorId, requestId: request.id,
        fromTileIndex: request.fromTileIndex, toTileIndex: request.toTileIndex });
    }
    return {
      active: !completed,
      completed,
      committed,
      rolledBack,
      state: request.state,
      request,
      visualProgress,
      consumedSeconds,
      remainingSeconds: completed ? Math.max(0, deltaSeconds - consumedSeconds) : 0,
    };
  }

  debugSnapshot(): DungeonMovementDebugSnapshot {
    return {
      config: this.config,
      activeMoves: this.debugActiveMoves(),
      movementReservationsByTile: this.movementReservationsByTile
        .map((reservations) => Object.fromEntries(reservations)),
      movementReservationsByPoint: this.movementReservationsByPoint
        .map((reservations) => Object.fromEntries(reservations)),
    };
  }

  debugActiveMoves(limit = Number.POSITIVE_INFINITY): DungeonMovementDebugSnapshot['activeMoves'] {
    const moves: Array<DungeonMovementDebugSnapshot['activeMoves'][number]> = [];
    for (const request of this.requests.values()) {
      if (moves.length >= limit) break;
      moves.push({
        requestId: request.id,
        actorId: request.actorId,
        fromTileIndex: request.fromTileIndex,
        toTileIndex: request.toTileIndex,
        state: request.state,
        progress: request.state === 'rollback'
          ? (request.rollbackStartProgress ?? 0) * (1 - clamp01(
            (request.rollbackElapsedSeconds ?? 0) / Math.max(request.rollbackDurationSeconds ?? 0, Number.EPSILON),
          ))
          : request.durationSeconds <= 0 ? 1 : clamp01(request.elapsedSeconds / request.durationSeconds),
        commitProgress: request.commitProgress,
        priority: this.priorityOf(request),
      });
    }
    return moves;
  }
}

export const createDungeonActionEngine = (
  traversal: DungeonTraversalWorld,
  config: Partial<DungeonMovementResolverConfig> = {},
  storage?: DungeonMovementStorage,
): DungeonActionEngine => new DungeonActionEngine(traversal, config, storage);
