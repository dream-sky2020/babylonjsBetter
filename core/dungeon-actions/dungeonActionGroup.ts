import type { DungeonActionEngine } from './dungeonActionEngine.ts';
import type { DungeonMovementDirection } from '../dungeon-movement/dungeonMovement.direction.ts';
import { getDungeonMovementDirectionVector } from '../dungeon-movement/dungeonMovement.direction.ts';
import { indexSpatialBody, sweepSpatialBody, bodySupport, sweepSpatialPair, type SpatialPoint } from '../dungeon-spatial/dungeonSpatialGeometry.ts';

export type SpatialActionGroup = {
  id: string; kind: 'push' | 'swap'; elapsed: number; duration: number; committed: boolean;
  members: { actorId: string; from: number; to: number; path: SpatialPoint[] }[];
  cells: number[]; status: 'running' | 'completed' | 'cancelled';
  recovering?: boolean; blockedBy?: string[];
  contacted?: boolean;
};
export type GroupResult = { accepted: boolean; actionId?: string; reason?: string; blockingEntityIds: string[] };
export function spatialGroupProgress(group: SpatialActionGroup,t:number,n:number):number {
  return group.recovering?t*n:group.kind==='push'?(t<.2?t/.2:t<.8?1+(t-.2)/.6:2+(t-.8)/.2):t*n;
}
export function requestSpatialGroup(engine: DungeonActionEngine, kind: 'push'|'swap', actorId: string,
  target: string|DungeonMovementDirection, duration=0.6): GroupResult {
  const world=engine.traversal, actor=world.body(actorId), reject=(reason:string,ids:string[]=[]):GroupResult=>({accepted:false,reason,blockingEntityIds:ids});
  if(!Number.isFinite(duration)||duration<=0)throw new RangeError('协同动作时长必须为正有限数。');
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
  if([...groupIds].some(id=>engine.storage.tracks!.has(id)||engine.getActiveRequest(id)||[...engine.storage.groups!.values()].some(g=>g.status==='running'&&g.members.some(m=>m.actorId===id))))return reject('movement-in-progress');
  const vector=getDungeonMovementDirectionVector(direction),from=actor.tileIndex;
  const last=kind==='push'?world.inspectStep(other.id,other.tileIndex,direction,{ignoreBodyIds:[...groupIds]}):{toTileIndex:from};
  if(last.toTileIndex===undefined||('blockedReason' in last&&last.blockedReason))return reject('blocked',('blockingEntityIds' in last?last.blockingEntityIds:[]) as string[]);
  const dest=last.toTileIndex, cells=new Set([from,other.tileIndex,dest]);
  const a={...actor.pose},b={...other.pose};
  const endA={x:a.x+vector.x,y:a.y+vector.y},endB=kind==='push'?{x:b.x+vector.x,y:b.y+vector.y}:a;
  const perpendicular={x:-vector.y*.8,y:vector.x*.8};
  const gap=Math.max(0,1-bodySupport(world.spatial,actor,vector)-bodySupport(world.spatial,other,{x:-vector.x,y:-vector.y}));
  const members:SpatialActionGroup['members']=kind==='push'
    ? [{actorId:actor.id,from,to:other.tileIndex,path:[a,{x:a.x+vector.x*gap,y:a.y+vector.y*gap},{x:endA.x+vector.x*gap,y:endA.y+vector.y*gap},endA]},
      {actorId:other.id,from:other.tileIndex,to:dest,path:[b,b,endB,endB]}]
    : [{actorId:actor.id,from,to:other.tileIndex,path:[a,{x:a.x+perpendicular.x,y:a.y+perpendicular.y},{x:b.x+perpendicular.x,y:b.y+perpendicular.y},b]},
      {actorId:other.id,from:other.tileIndex,to:from,path:[b,{x:b.x-perpendicular.x,y:b.y-perpendicular.y},{x:a.x-perpendicular.x,y:a.y-perpendicular.y},a]}];
  for(let i=1;i<members[0].path.length;i++)if(sweepSpatialPair(world.spatial,actor,members[0].path[i-1],members[0].path[i],other,members[1].path[i-1],members[1].path[i]))return reject('participants-overlap');
  for(const m of members) for(let i=1;i<m.path.length;i++) {
    const p=m.path[i],prev=m.path[i-1];
    if(p.x<-.25||p.y<-.25||p.x>world.map.width-.75||p.y>world.map.height-.75)return reject('no-space-for-trajectory');
    const hits=sweepSpatialBody(world.spatial,world.body(m.actorId)!,prev,p,groupIds);if(hits.length)return reject('trajectory-blocked',hits);
    for(let x=Math.floor(Math.min(p.x,prev.x)+.25);x<=Math.floor(Math.max(p.x,prev.x)+.75);x++)
      for(let y=Math.floor(Math.min(p.y,prev.y)+.25);y<=Math.floor(Math.max(p.y,prev.y)+.75);y++)
        if(x>=0&&x<world.map.width&&y>=0&&y<world.map.height)cells.add(y*world.map.width+x);
  }
  for(const cell of cells)if(engine.movementReservationsByTile[cell]?.size)return reject('reservation-conflict');
  for(const g of engine.storage.groups!.values())if(g.status==='running'&&g.cells.some(c=>cells.has(c)))return reject('reservation-conflict');
  const id=`${kind}:${engine.storage.nextRequestSequence++}`;
  engine.storage.groups!.set(id,{id,kind,elapsed:0,duration,committed:false,members,cells:[...cells],status:'running'});
  return {accepted:true,actionId:id,blockingEntityIds:[]};
}
export function advanceSpatialGroups(engine:DungeonActionEngine,delta:number,ready:()=>boolean=()=>true) {
  groups: for(const group of engine.storage.groups!.values()) {
    if (!ready()) return;
    if(group.status!=='running')continue;
    const nextElapsed=Math.min(group.duration,group.elapsed+delta),t=nextElapsed/group.duration;
    const poses = group.members.map(m => {
      const n=m.path.length-1,scaled=spatialGroupProgress(group,t,n);
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
    if(group.kind==='push'&&!group.recovering&&!group.contacted&&t>=.2){group.contacted=true;engine.groupChanged(group,'contact');}
    for(const m of group.members) {
      const body=engine.traversal.body(m.actorId)!;
      body.pose=poses[group.members.indexOf(m)];indexSpatialBody(engine.traversal.spatial,body);
      engine.projectBody(body);
    }
    if(t>=.5&&!group.committed&&!group.recovering){engine.traversal.commitGroup(group.members);group.committed=true;engine.groupChanged(group,'committed');}
    if(t>=1){group.status=group.recovering?'cancelled':'completed';engine.groupChanged(group,group.recovering?'cancelled':'completed');}
  }
}
