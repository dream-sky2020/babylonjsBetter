import type { SpatialState, SpatialBody, SpatialCollider } from './dungeonSpatialState.ts';
export type SpatialPoint = { x: number; y: number };
export function bodySupport(state:SpatialState,body:SpatialBody,axis:SpatialPoint):number {
  return Math.max(0,...body.colliderIds.map(id=>{const c=state.colliders.get(id)!;if(c.response!=='block'||c.enabled===false)return 0;
    const e=extents(c);return c.offsetX*axis.x+c.offsetY*axis.y+Math.abs(axis.x)*e.x+Math.abs(axis.y)*e.y;}));
}
export function sweepSpatialPair(state:SpatialState,a:SpatialBody,fromA:SpatialPoint,toA:SpatialPoint,b:SpatialBody,fromB:SpatialPoint,toB:SpatialPoint):boolean {
  for(const ia of a.colliderIds)for(const ib of b.colliderIds){
    const ca=state.colliders.get(ia)!,cb=state.colliders.get(ib)!;if(ca.response!=='block'||cb.response!=='block'||ca.enabled===false||cb.enabled===false)continue;
    const p={x:fromA.x-fromB.x+ca.offsetX-cb.offsetX,y:fromA.y-fromB.y+ca.offsetY-cb.offsetY},
      q={x:toA.x-toB.x+ca.offsetX-cb.offsetX,y:toA.y-toB.y+ca.offsetY-cb.offsetY};
    if(ca.shape==='disc'&&cb.shape==='disc'){
      const dx=q.x-p.x,dy=q.y-p.y,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,-(p.x*dx+p.y*dy)/len)):0;
      if(Math.hypot(p.x+dx*t,p.y+dy*t)<ca.radius+cb.radius-1e-8)return true;
    }else{const ea=extents(ca),eb=extents(cb);if(segmentBox(p,q,-ea.x-eb.x,ea.x+eb.x,-ea.y-eb.y,ea.y+eb.y))return true;}
  }
  return false;
}
const extents = (c: SpatialCollider) => c.shape === 'disc' || c.shape === 'point'
  ? { x: c.shape === 'point' ? 0 : c.radius, y: c.shape === 'point' ? 0 : c.radius }
  : { x: c.halfWidth, y: c.halfHeight };
const cellKey=(state:SpatialState,x:number,y:number)=>`${state.wrapX?((x%state.width!)+state.width!)%state.width!:x},${state.wrapY?((y%state.height!)+state.height!)%state.height!:y}`;
export function indexSpatialBody(state: SpatialState, body: SpatialBody) {
  const cells = state.bodyIdsByCell ??= new Map(), reverse = state.cellsByBody ??= new Map();
  for (const key of reverse.get(body.bodyId) ?? []) { const ids = cells.get(key); ids?.delete(body.bodyId); if (!ids?.size) cells.delete(key); }
  const keys = new Set<string>();
  for (const id of body.colliderIds) {
    const c = state.colliders.get(id)!; const e = extents(c);
    const bounds = body.boundaries?.length ? body.boundaries.map(s => ({ l: Math.min(s.ax,s.bx), r: Math.max(s.ax,s.bx), t: Math.min(s.ay,s.by), b: Math.max(s.ay,s.by) }))
      : [{ l: body.pose.x+c.offsetX-e.x, r: body.pose.x+c.offsetX+e.x, t: body.pose.y+c.offsetY-e.y, b: body.pose.y+c.offsetY+e.y }];
    for (const box of bounds) for(let x=Math.floor(box.l+.5);x<=Math.floor(box.r+.5);x++) for(let y=Math.floor(box.t+.5);y<=Math.floor(box.b+.5);y++) keys.add(cellKey(state,x,y));
  }
  for(const key of keys) { const ids=cells.get(key)??new Set();ids.add(body.bodyId);cells.set(key,ids); }
  reverse.set(body.bodyId,[...keys]);
}
const segmentBox = (a: SpatialPoint,b: SpatialPoint,l:number,r:number,t:number,d:number) => {
  let lo=0,hi=1;
  for(const [p,v,min,max] of [[a.x,b.x-a.x,l,r],[a.y,b.y-a.y,t,d]]) {
    if(Math.abs(v)<1e-12) { if(p<=min+1e-8 || p>=max-1e-8) return false; }
    else { let x=(min-p)/v,y=(max-p)/v;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>=hi-1e-8)return false; }
  }
  return hi>1e-8 && lo<1-1e-8;
};
export function sweepSpatialBody(state: SpatialState, body: SpatialBody, a: SpatialPoint,b: SpatialPoint, ignore: ReadonlySet<string> = new Set()): string[] {
  if(!state.bodyIdsByCell) for(const item of state.bodies.values()) indexSpatialBody(state,item);
  const found=new Set<string>();
  for(const id of body.colliderIds) {
    const own=state.colliders.get(id)!;if(own.response!=='block'||own.enabled===false)continue;
    const e=extents(own),from={x:a.x+own.offsetX,y:a.y+own.offsetY},to={x:b.x+own.offsetX,y:b.y+own.offsetY};
    const candidates=new Set<string>();
    for(let x=Math.floor(Math.min(from.x,to.x)-e.x+.5);x<=Math.floor(Math.max(from.x,to.x)+e.x+.5);x++)
      for(let y=Math.floor(Math.min(from.y,to.y)-e.y+.5);y<=Math.floor(Math.max(from.y,to.y)+e.y+.5);y++)
        for(const target of state.bodyIdsByCell!.get(cellKey(state,x,y))??[])candidates.add(target);
    for(const target of candidates) {
      const other=state.bodies.get(target);if(!other||other===body||!other.enabled||ignore.has(other.id)||ignore.has(other.bodyId))continue;
      for(const colliderId of other.colliderIds) {
        const c=state.colliders.get(colliderId)!;if(c.response!=='block'||c.enabled===false)continue;
        const f=extents(c),shiftX=state.wrapX?Math.round(((from.x+to.x)/2-other.pose.x)/state.width!)*state.width!:0,
          shiftY=state.wrapY?Math.round(((from.y+to.y)/2-other.pose.y)/state.height!)*state.height!:0,
          cx=other.pose.x+c.offsetX+shiftX,cy=other.pose.y+c.offsetY+shiftY;
        let hit=false;
        if(c.shape==='boundary'&&other.boundaries?.length) hit=other.boundaries.some(s=>segmentBox(from,to,Math.min(s.ax,s.bx)+shiftX-e.x,Math.max(s.ax,s.bx)+shiftX+e.x,Math.min(s.ay,s.by)+shiftY-e.y,Math.max(s.ay,s.by)+shiftY+e.y));
        else if(own.shape==='disc'&&c.shape==='disc') {
          const dx=to.x-from.x,dy=to.y-from.y,len=dx*dx+dy*dy;
          const u=len?Math.max(0,Math.min(1,((cx-from.x)*dx+(cy-from.y)*dy)/len)):0;
          hit=Math.hypot(from.x+dx*u-cx,from.y+dy*u-cy)<own.radius+c.radius-1e-8;
        } else hit=segmentBox(from,to,cx-f.x-e.x,cx+f.x+e.x,cy-f.y-e.y,cy+f.y+e.y);
        if(hit)found.add(other.id);
      }
    }
  }
  return [...found];
}
