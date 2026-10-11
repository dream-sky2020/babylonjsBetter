import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseModelMaterialBindings} from './modelMaterialBindings.ts';
import {parseSceneEnvironmentPreset} from '../../scene/sceneEnvironment.parser.ts';
const binding = [{selector:{gltfMaterialIndex:0}, textures:{baseColor:{path:'resources/Model/SharedTextures/a.png',uvSet:1,offset:[.2,.3],wrapU:2},normal:null},alphaMode:'MASK',alphaCutoff:.3}];
test('legacy optional fields and full binding survive scene parsing',()=>{
  const preset = {presetKey:'test',name:'test',clearColor:'#000000',objects:[],lights:[],models:[{id:'a',name:'a',modelPath:'resources/a.glb',position:[0,0,0],materialOverrides:binding}]};
  assert.deepEqual(parseSceneEnvironmentPreset(preset,'test').models[0].materialOverrides,binding);
  assert.equal(parseModelMaterialBindings(undefined),undefined);
  const result = parseModelMaterialBindings(binding); assert.notEqual(result,binding);
});
test('reject duplicate selectors, unknown fields, nonfinite values and unsafe resource paths',()=>{
  for(const value of [null,{},[...binding,...binding],[{selector:{gltfMaterialIndex:-1}}],[{selector:{gltfMaterialIndex:0},alphaCutoff:NaN}],
    [{selector:{gltfMaterialIndex:0},textures:{typo:null}}], ...['http://host/a.png','resources/../a.png','resources/%2e%2e/a.png','resources/a.png?x=1'].map(path=>[{selector:{gltfMaterialIndex:0},textures:{baseColor:{path}}}])]) assert.throws(()=>parseModelMaterialBindings(value));
});
