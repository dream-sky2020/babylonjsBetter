import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {extract,decode,hash,embed} from './sharedTextureMigration.mjs';
test('sample migration removes image bytes and preserves every retained buffer view',async()=>{
  const manifest=JSON.parse(await fs.readFile('public/resources/Model/SharedTextures/artist_valsekamerplant/valsekamerplant-manifest.json'));
  for(const model of manifest.models.filter(m=>/medieval/i.test(m.path)).slice(0,2)){
    const backup=path.join('.asset-migration/valsekamerplant/backup',model.path);
    const hasBackup=await fs.access(backup).then(()=>true,()=>false);
    const current=await fs.readFile(path.join('public/resources/Model/GLB/artist_valsekamerplant',model.path));
    const images=new Map(await Promise.all(model.images.map(async name=>[name,await fs.readFile(path.join('public/resources/Model/SharedTextures/artist_valsekamerplant',name))])));
    const original=hasBackup?await fs.readFile(backup):embed(current,images);
    const candidate=extract(original, 'artist_valsekamerplant'); const json=decode(candidate.result).json;
    if(hasBackup)assert.equal(hash(candidate.result),model.candidateSha256);
    assert.ok(json.images.every(i=>i.bufferView===undefined && i.uri.startsWith('__shared_textures__/')));
    assert.ok(candidate.result.length<original.length);
    for(const [name,data] of candidate.images)assert.ok(name.startsWith(hash(data)));
  }
});
