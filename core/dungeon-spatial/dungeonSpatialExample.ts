import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';

/** Small deterministic maps authored directly in the new component model. */
export function createSpatialExampleDocument(scenario: 'push'|'swap'|'narrow'='push') {
  const doc=migrateDungeonMapToDocumentV2({presetKey:'spatial-example',name:'统一空间动作示例',map:createDungeonMapData({id:'spatial-example',width:7,height:5})}).document;
  const rows: {id:string;x:number;y:number;movable:boolean;pushable:boolean}[]=[
    {id:'box',x:2,y:2,movable:true,pushable:true},
    {id:'peer',x:3,y:scenario==='push'?3:2,movable:true,pushable:false},
  ];
  if(scenario==='narrow')for(const x of [2,3])for(const y of [1,3])rows.push({id:`wall:${x}:${y}`,x,y,movable:false,pushable:false});
  for(const row of rows){
    doc.entities.push({id:row.id,entityType:'spatial-object',name:row.id});
    (doc.components['spatial-attachment']??=[]).push({id:row.id+':attachment',entityId:row.id,type:'spatial-attachment',version:1,targets:[{kind:'tile',tileId:doc.grid.tileIds[row.y*7+row.x]}]});
    (doc.components['spatial-body']??=[]).push({id:row.id+':body',entityId:row.id,type:'spatial-body',version:1,activeByDefault:true,mobility:row.movable?'movable':'fixed',pushable:row.pushable,initialFacing:'east',movementProfileId:'ground'});
    (doc.components['spatial-collider']??=[]).push({id:row.id+':collider',entityId:row.id,type:'spatial-collider',version:1,response:'block',footprint:row.movable?'center':'full-tile',shape:row.movable?'disc':'box',radius:.25,halfWidth:.5,halfHeight:.5,offsetX:0,offsetY:0});
  }
  return doc;
}
