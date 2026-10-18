import type { DungeonActionEngine } from './dungeonActionEngine.ts';
import type { DungeonMovementDirection } from '../dungeon-movement/dungeonMovement.direction.ts';
import { getDungeonMovementDirectionVector } from '../dungeon-movement/dungeonMovement.direction.ts';
import { indexSpatialBody, sweepSpatialBody, bodySupport, sweepSpatialPair, type SpatialPoint } from '../dungeon-spatial/dungeonSpatialGeometry.ts';

export type SpatialActionGroup = {
  id: string; kind: 'push' | 'swap'; elapsed: number; duration: number; committed: boolean;
  members: { actorId: string; from: number; to: number; path: SpatialPoint[];
    sideOffset?: SpatialPoint; recoveryOffset?: SpatialPoint;
    swapArcLengths?: number[]; swapStartDelay?: number; swapTravelDuration?: number }[];
  cells: number[]; status: 'running' | 'completed' | 'cancelled';
  recovering?: boolean; blockedBy?: string[];
  contacted?: boolean;
  /** Group timing follows the initiator's ordinary one-tile duration. */
  secondsPerTile?: number;
  segmentEndProgress?: number[];
  /** Derived lookup for constant world-space speed along the presented swap curve. */
  includeSwapPresentationDistance?: boolean;
};
export type GroupResult = { accepted: boolean; actionId?: string; durationSeconds?: number; reason?: string; blockingEntityIds: string[] };
export const DEFAULT_SWAP_DURATION_SECONDS = 0;
const worldDistance = (engine: DungeonActionEngine, a: SpatialPoint, b: SpatialPoint): number => {
  const from=engine.worldPositionFor?.(a.x,a.y)??[a.x,0,a.y];
  const to=engine.worldPositionFor?.(b.x,b.y)??[b.x,0,b.y];
  return Math.hypot(...to.map((value,i)=>value-from[i]));
};
export function configureSwapTiming(engine: DungeonActionEngine, group: SpatialActionGroup): void {
  const actor=group.members[0],width=engine.traversal.map.width;
  const step=worldDistance(engine,{x:actor.from%width,y:Math.floor(actor.from/width)},
    {x:actor.to%width,y:Math.floor(actor.to/width)});
  const speed=step/group.secondsPerTile!;
  group.members.forEach(member=>{member.swapArcLengths=undefined;member.swapStartDelay=undefined;member.swapTravelDuration=undefined;});
  if(group.recovering) {
    const distances=actor.path.slice(1).map((_,i)=>Math.max(...group.members.map(member=>
      worldDistance(engine,member.path[i],member.path[i+1]))));
    const total=distances.reduce((sum,value)=>sum+value,0);
    const offset=group.includeSwapPresentationDistance?Math.max(...group.members.map(member=>{
      const start=member.path[0],side=member.recoveryOffset;
      return side?worldDistance(engine,start,{x:start.x+side.x,y:start.y+side.y}):0;
    })):0;
    group.duration=Math.max(group.duration,(total+offset)/speed);
    let covered=0;
    group.segmentEndProgress=distances.map(distance=>total?(covered+=distance)/total:1);
    return;
  }
  const sampleCount=1024;
  const lengths=group.members.map(member=>{
    const start=member.path[0],end=member.path[1],side=member.sideOffset??{x:0,y:0};
    if(!group.includeSwapPresentationDistance)return worldDistance(engine,start,end);
    const a=engine.worldPositionFor?.(start.x,start.y)??[start.x,0,start.y];
    const b=engine.worldPositionFor?.(end.x,end.y)??[end.x,0,end.y];
    const c=engine.worldPositionFor?.(start.x+side.x,start.y+side.y)??[start.x+side.x,0,start.y+side.y];
    const forward=b.map((value,i)=>value-a[i]),lateral=c.map((value,i)=>value-a[i]);
    const velocity=(t:number)=>Math.hypot(...forward.map((value,i)=>value+Math.PI*Math.cos(Math.PI*t)*lateral[i]));
    const arcLengths=[0];
    for(let i=1;i<=sampleCount;i++) {
      const left=(i-1)/sampleCount,right=i/sampleCount,mid=(left+right)/2;
      arcLengths.push(arcLengths[i-1]+(velocity(left)+4*velocity(mid)+velocity(right))/(6*sampleCount));
    }
    member.swapArcLengths=arcLengths;
    return arcLengths[sampleCount];
  });
  group.duration=Math.max(group.duration,...lengths.map(length=>length/speed));
  const longest=Math.max(...lengths);
  group.members.forEach((member,i)=>{
    member.swapTravelDuration=longest>0?group.duration*lengths[i]/longest:0;
    member.swapStartDelay=group.duration-member.swapTravelDuration;
  });
}
export function configurePushTiming(group: SpatialActionGroup): void {
  const distances=group.members[0].path.slice(1).map((_,i)=>Math.max(...group.members.map(m=>
    Math.hypot(m.path[i+1].x-m.path[i].x,m.path[i+1].y-m.path[i].y))));
  const total=distances.reduce((sum,value)=>sum+value,0);
  group.duration=Math.max(.001,total*group.secondsPerTile!);
  let covered=0;
  group.segmentEndProgress=distances.map(distance=>total?(covered+=distance)/total:1);
}
export function spatialGroupProgress(group: SpatialActionGroup,t:number,n:number,member=group.members[0]):number {
  if(group.kind==='swap'&&!group.recovering) {
    const local=member.swapTravelDuration!<=0 ? 1 : Math.max(0,Math.min(1,
      (t*group.duration-(member.swapStartDelay??0))/member.swapTravelDuration!));
    if(!member.swapArcLengths)return local*n;
    const lengths=member.swapArcLengths,total=lengths[lengths.length-1],target=local*total;
    if(local>=1)return n;
    let low=0,high=lengths.length-1;
    while(low+1<high){const mid=(low+high)>>1;if(lengths[mid]<target)low=mid;else high=mid;}
    const section=lengths[high]-lengths[low];
    return n*(low+(section?(target-lengths[low])/section:0))/(lengths.length-1);
  }
  if(group.segmentEndProgress) {
    if(t>=1)return n;
    let previous=0;
    for(let i=0;i<n;i++) {
      const end=group.segmentEndProgress[i];
      if(t<end||i===n-1)return i+(end>previous?Math.max(0,Math.min(1,(t-previous)/(end-previous))):1);
      previous=end;
    }
  }
  return t*n;
}
export function requestSpatialGroup(engine: DungeonActionEngine, kind: 'push'|'swap', actorId: string,
  target: string|DungeonMovementDirection, duration=kind==='swap'?DEFAULT_SWAP_DURATION_SECONDS:.6,
  secondsPerTile=kind==='swap'?.6:duration, includeSwapPresentationDistance=true,
  priority?: {basePriority?:number;progressWeight?:number}): GroupResult {
  const world=engine.traversal, actor=world.body(actorId), reject=(reason:string,ids:string[]=[]):GroupResult=>({accepted:false,reason,blockingEntityIds:ids});
  if(!Number.isFinite(duration)||duration<0||kind==='push'&&duration===0)throw new RangeError('协同动作时长必须为非负有限数。');
  if(!Number.isFinite(secondsPerTile)||secondsPerTile<=0)throw new RangeError('发起者每格耗时必须为正有限数。');
  if(kind==='swap'&&(!Number.isFinite(engine.swapPresentationOffset)||engine.swapPresentationOffset<0))throw new RangeError('换位错身幅度必须为非负有限数。');
  if(!actor?.enabled||actor.mobility!=='movable')return reject('actor-not-movable');
  let other, direction: DungeonMovementDirection;
  if(kind==='push') {
    direction=target as DungeonMovementDirection;if(direction.includes('-'))return reject('cardinal-push-only');
    const step=world.inspectStep(actorId,actor.tileIndex,direction,{ignoreDynamicOccupancy:true,checkStaticObstacles:false});
    if(step.toTileIndex===undefined)return reject('map-boundary');
    other=[...(world.occupantIdsByTile[step.toTileIndex]??[])].map(id=>world.body(id)).find(b=>b?.enabled&&b.blocksMovement);
    if(!other?.pushable||other.mobility!=='movable')return reject('not-pushable',other?[other.id]:[]);
  } else {
    other=world.body(target);if(!other?.enabled||other.mobility!=='movable')return reject('target-not-movable');
    const dx=other.logicalPosition.tileX-actor.logicalPosition.tileX,dy=other.logicalPosition.tileY-actor.logicalPosition.tileY;
    if(Math.abs(dx)+Math.abs(dy)!==1)return reject('swap-needs-neighbours');
    direction=dx>0?'east':dx<0?'west':dy>0?'south':'north';
  }
  const groupIds=new Set([actor.id,other.id]);
  const initiatorAction=engine.actionStateOf(actor.id),targetAction=engine.actionStateOf(other.id);
  if(initiatorAction.kind!=='idle'||kind==='push'&&targetAction.kind!=='idle'
    ||kind==='swap'&&targetAction.kind!=='idle'&&targetAction.kind!=='move')return reject('movement-in-progress');
  const oldTargetMove=targetAction.kind==='move'?targetAction.request:undefined;
  if(oldTargetMove) {
    const basePriority=priority?.basePriority??0,progressWeight=priority?.progressWeight??engine.config.progressWeight;
    if(!Number.isFinite(basePriority)||!Number.isFinite(progressWeight)||progressWeight<0)throw new RangeError('换位优先级必须为有效数值。');
    const difference=basePriority-engine.priorityOf(oldTargetMove);
    if(difference<0||difference===0&&actor.id.localeCompare(other.id)>=0)return reject('priority-conflict',[other.id]);
  }
  const vector=getDungeonMovementDirectionVector(direction),from=actor.tileIndex;
  if(kind==='swap') {
    const reverse=direction==='east'?'west':direction==='west'?'east':direction==='north'?'south':'north';
    for(const [body,dir] of [[actor,direction],[other,reverse]] as const) {
      const step=world.inspectStep(body.id,body.tileIndex,dir,{ignoreBodyIds:[...groupIds]});
      if(step.blockedReason)return reject(step.blockedReason,[...step.blockingEntityIds]);
    }
  }
  const last=kind==='push'?world.inspectStep(other.id,other.tileIndex,direction,{ignoreBodyIds:[...groupIds]}):{toTileIndex:from};
  if(last.toTileIndex===undefined||('blockedReason' in last&&last.blockedReason))return reject('blocked',('blockingEntityIds' in last?last.blockingEntityIds:[]) as string[]);
  const dest=last.toTileIndex, cells=new Set([from,other.tileIndex,dest]);
  const a={...actor.pose},b={...other.pose};
  const endA=kind==='swap'?{x:other.logicalPosition.tileX,y:other.logicalPosition.tileY}:{x:a.x+vector.x,y:a.y+vector.y};
  const endB=kind==='push'?{x:b.x+vector.x,y:b.y+vector.y}:{x:actor.logicalPosition.tileX,y:actor.logicalPosition.tileY};
  const gap=Math.min(1,Math.max(0,1-bodySupport(world.spatial,actor,vector)-bodySupport(world.spatial,other,{x:-vector.x,y:-vector.y})));
  const members:SpatialActionGroup['members']=kind==='push'
    ? [{actorId:actor.id,from,to:other.tileIndex,path:[a,{x:a.x+vector.x*gap,y:a.y+vector.y*gap},endA,endA]},
      {actorId:other.id,from:other.tileIndex,to:dest,path:[b,b,{x:b.x+vector.x*(1-gap),y:b.y+vector.y*(1-gap)},endB]}]
    : [{actorId:actor.id,from,to:other.tileIndex,path:[a,endA]},
      {actorId:other.id,from:other.tileIndex,to:from,path:[b,endB]}];
  // Swap participants deliberately pass each other; only their mutual collision is ignored.
  if(kind==='push')for(let i=1;i<members[0].path.length;i++)if(sweepSpatialPair(world.spatial,actor,members[0].path[i-1],members[0].path[i],other,members[1].path[i-1],members[1].path[i]))return reject('participants-overlap');
  for(const m of members) for(let i=1;i<m.path.length;i++) {
    const p=m.path[i],prev=m.path[i-1];
    if(p.x<-.25||p.y<-.25||p.x>world.map.width-.75||p.y>world.map.height-.75)return reject('no-space-for-trajectory');
    const hits=sweepSpatialBody(world.spatial,world.body(m.actorId)!,prev,p,groupIds);if(hits.length)return reject('trajectory-blocked',hits);
    for(let x=Math.floor(Math.min(p.x,prev.x)+.25);x<=Math.floor(Math.max(p.x,prev.x)+.75);x++)
      for(let y=Math.floor(Math.min(p.y,prev.y)+.25);y<=Math.floor(Math.max(p.y,prev.y)+.75);y++)
        if(x>=0&&x<world.map.width&&y>=0&&y<world.map.height)cells.add(y*world.map.width+x);
  }
  if(kind==='swap') {
    // Cosmetic sidestep never decides whether a logical swap is legal. Reduce it
    // near third-party geometry/edges, down to a straight crossing when necessary.
    for(const amplitude of [engine.swapPresentationOffset,engine.swapPresentationOffset/2,0]) {
      const offsets=members.map((_,i)=>({x:-vector.y*amplitude*(i?-1:1),y:vector.x*amplitude*(i?-1:1)}));
      const clear=members.every((m,i)=>{
        let previous=m.path[0];
        for(let sample=1;sample<=16;sample++) {
          const t=sample/16,s=t,arc=sample===16?0:Math.sin(Math.PI*t);
          const point={x:m.path[0].x+(m.path[1].x-m.path[0].x)*s+offsets[i].x*arc,
            y:m.path[0].y+(m.path[1].y-m.path[0].y)*s+offsets[i].y*arc};
          if(point.x<-.25||point.y<-.25||point.x>world.map.width-.75||point.y>world.map.height-.75
            ||sweepSpatialBody(world.spatial,world.body(m.actorId)!,previous,point,groupIds).length)return false;
          previous=point;
        }
        return true;
      });
      if(clear){members.forEach((m,i)=>{m.sideOffset=offsets[i];});break;}
    }
  }
  for(const cell of cells)if([...engine.movementReservationsByTile[cell]??[]].some(([owner])=>owner!==oldTargetMove?.actorId))return reject('reservation-conflict');
  for(const g of engine.storage.groups!.values())if(g.status==='running'&&g.cells.some(c=>cells.has(c)))return reject('reservation-conflict');
  const id=`${kind}:${engine.storage.nextRequestSequence++}`;
  const group:SpatialActionGroup={id,kind,elapsed:0,duration,committed:false,members,cells:[...cells],status:'running'};
  if(kind==='push'){group.secondsPerTile=duration;configurePushTiming(group);}
  if(kind==='swap'){group.secondsPerTile=secondsPerTile;group.includeSwapPresentationDistance=includeSwapPresentationDistance;configureSwapTiming(engine,group);}
  engine.storage.groups!.set(id,group);
  if(oldTargetMove)engine.supersedeMoveForSwap(oldTargetMove,id);
  return {accepted:true,actionId:id,durationSeconds:group.duration,blockingEntityIds:[]};
}
export function advanceSpatialGroups(engine:DungeonActionEngine,delta:number,ready:()=>boolean=()=>true) {
  groups: for(const group of engine.storage.groups!.values()) {
    if (!ready()) return;
    if(group.status!=='running')continue;
    const nextElapsed=Math.min(group.duration,group.elapsed+delta),t=nextElapsed/group.duration;
    const poses = group.members.map(m => {
      const n=m.path.length-1,scaled=spatialGroupProgress(group,t,n,m);
      const i=Math.min(n-1,Math.floor(scaled)),u=Math.min(1,scaled-i),a=m.path[i],b=m.path[i+1];
      return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
    });
    const ignore=new Set(group.members.map(m=>m.actorId));
    for(let i=0;i<group.members.length;i++) {
      const body=engine.traversal.body(group.members[i].actorId)!;
      const hits=sweepSpatialBody(engine.traversal.spatial,body,body.pose,poses[i],ignore);
      if(hits.length) {group.blockedBy=hits;if(!group.recovering)engine.cancelGroup(group.id);continue groups;}
    }
    group.elapsed=nextElapsed;
    for(const m of group.members) {
      const body=engine.traversal.body(m.actorId)!;
      body.pose=poses[group.members.indexOf(m)];indexSpatialBody(engine.traversal.spatial,body);
      const offset=group.recovering?m.recoveryOffset:m.sideOffset;
      const swapParameter=group.kind==='swap'&&!group.recovering?spatialGroupProgress(group,t,1,m):t;
      const weight=t>=1?0:group.recovering?1-t:Math.sin(Math.PI*swapParameter);
      body.presentationOffset=offset&&weight?{x:offset.x*weight,y:offset.y*weight}:undefined;
      engine.projectBody(body);
    }
    if(group.kind==='push'&&!group.recovering&&!group.contacted&&t>=(group.segmentEndProgress?.[0]??0)){group.contacted=true;engine.groupChanged(group,'contact');}
    if(t>=(group.kind==='swap'?1:.5)&&!group.committed&&!group.recovering){engine.traversal.commitGroup(group.members);group.committed=true;engine.groupChanged(group,'committed');}
    if(t>=1){group.status=group.recovering?'cancelled':'completed';engine.groupChanged(group,group.recovering?'cancelled':'completed');}
  }
}
