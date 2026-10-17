import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createDungeonMapData } from '../core/map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../core/map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntime } from '../core/dungeon-runtime/dungeonRuntime.ts';
import { DungeonObstacleIndex } from '../core/dungeon-obstacle/dungeonObstacleIndex.ts';
const count=1200,iterations=20000;
const doc=migrateDungeonMapToDocumentV2({presetKey:'benchmark',name:'Benchmark',map:createDungeonMapData({id:'benchmark',width:64,height:64})}).document;
for(let i=0;i<count;i++){
  const id=`wall:${i}`,x=10+i%50,y=10+Math.floor(i/50);
  doc.entities.push({id,entityType:'spatial-object'});
  (doc.components['spatial-attachment']??=[]).push({id:id+':attachment',entityId:id,type:'spatial-attachment',version:1,targets:[{kind:'tile',tileId:doc.grid.tileIds[y*64+x]}]});
  (doc.components['spatial-body']??=[]).push({id:id+':body',entityId:id,type:'spatial-body',version:1,activeByDefault:true,mobility:'fixed',pushable:false,initialFacing:'south',movementProfileId:'ground'});
  (doc.components['spatial-collider']??=[]).push({id:id+':collider',entityId:id,type:'spatial-collider',version:1,response:'block',footprint:'full-tile',shape:'box',radius:.25,halfWidth:.5,halfHeight:.5,offsetX:0,offsetY:0});
}
const start=performance.now(),runtime=createDungeonRuntime(doc,{tilePosition:{x:1,y:1},worldPosition:[1,0,1]},'east'),prepareMs=performance.now()-start;
const old=new DungeonObstacleIndex(runtime.obstacles,runtime.obstacleStates),from={tileX:1,tileY:1},to={tileX:2,tileY:1};
const measure=run=>{for(let i=0;i<1000;i++)run();const start=performance.now();for(let i=0;i<iterations;i++)run();return performance.now()-start;};
const previousIndexedQueryMs=measure(()=>old.findStep(from,to,'east'));
const unifiedIndexedQueryMs=measure(()=>runtime.traversal.obstacleIndex.findStep(from,to,'east'));
const map=runtime.traversal.spatial.bodies,get=map.get.bind(map);let bodyLookups=0;map.get=id=>{bodyLookups++;return get(id);};
const inspectionMs=measure(()=>runtime.traversal.inspectStep('$dungeon-player',65,'east'));
const lookupsPerInspection=bodyLookups/(iterations+1000);
if(lookupsPerInspection>20)throw new Error('查询不再是局部查询。');
bodyLookups=0;
const hitFrom={tileX:9,tileY:10},hitTo={tileX:10,tileY:10};
const previousBlockedQueryMs=measure(()=>old.findStep(hitFrom,hitTo,'east'));
const unifiedBlockedQueryMs=measure(()=>runtime.traversal.obstacleIndex.findStep(hitFrom,hitTo,'east'));
const lookupsPerBlockedQuery=bodyLookups/(2*(iterations+1000));
if(lookupsPerBlockedQuery>20)throw new Error('命中障碍时查询退化为全表扫描。');
const result={staticBodies:count,iterations,prepareMs,previousIndexedQueryMs,unifiedIndexedQueryMs,inspectionMs,lookupsPerInspection,
  previousBlockedQueryMs,unifiedBlockedQueryMs,lookupsPerBlockedQuery,
  note:'Same empty and occupied local routes; previous and new static indexed query compared separately from complete traversal inspection. Timings are a local microbenchmark, not frame-rate or real-asset performance.'};
fs.writeFileSync('node_modules/.cache/spatial-actions-benchmark.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
