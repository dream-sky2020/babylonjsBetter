// Lossless GLB image extraction. Candidates/backup stay outside public and dist.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
export const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function decode(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
  const chunks = [];
  for (let p = 12; p < bytes.length;) { const n = bytes.readUInt32LE(p); chunks.push([bytes.readUInt32LE(p + 4), bytes.subarray(p + 8, p + 8 + n)]); p += 8 + n; }
  assert.equal(chunks[0][0], 0x4e4f534a); assert.ok(chunks.length <= 2);
  return { json: JSON.parse(chunks[0][1].toString()), bin: chunks[1]?.[1] ?? Buffer.alloc(0) };
}
export function encode(json, bin) {
  const raw = Buffer.from(JSON.stringify(json)); const j = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(j);
  const b = Buffer.alloc(Math.ceil(bin.length / 4) * 4); bin.copy(b);
  const out = Buffer.alloc(12 + 8 + j.length + (b.length ? 8 + b.length : 0));
  [0x46546c67, 2, out.length, j.length, 0x4e4f534a].forEach((v, i) => out.writeUInt32LE(v, i * 4)); j.copy(out, 20);
  if (b.length) { out.writeUInt32LE(b.length, 20 + j.length); out.writeUInt32LE(0x004e4942, 24 + j.length); b.copy(out, 28 + j.length); }
  return out;
}
export function extract(bytes, author = '') {
  assert.ok(!author || /^artist_[a-z0-9][a-z0-9_-]{0,79}$/.test(author), 'Invalid texture author directory');
  const { json: original, bin } = decode(bytes); const json = structuredClone(original);
  // Unknown extensions may contain binary offsets rather than bufferView references.
  const allowed = new Set(['KHR_materials_unlit', 'KHR_texture_transform', 'KHR_materials_specular', 'KHR_materials_ior', 'KHR_materials_transmission', 'KHR_materials_clearcoat', 'KHR_materials_emissive_strength']);
  for (const extension of json.extensionsUsed ?? []) assert.ok(allowed.has(extension), `Unsupported extension ${extension}`);
  assert.ok((json.buffers?.length ?? 0) <= 1 && !json.buffers?.[0]?.uri, 'Only one embedded buffer is supported');
  const removed = new Set(); const images = new Map();
  for (const image of json.images ?? []) {
    assert.ok(Number.isInteger(image.bufferView), 'Already external image: use original backup to rebuild candidates');
    assert.ok(['image/png', 'image/jpeg'].includes(image.mimeType));
    const view = json.bufferViews[image.bufferView]; assert.equal(view.buffer, 0);
    const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const name = `${hash(data)}.${image.mimeType === 'image/png' ? 'png' : 'jpg'}`;
    images.set(name, data); removed.add(image.bufferView); delete image.bufferView; image.uri = `__shared_textures__/${author ? author + '/' : ''}${name}`;
  }
  const remap = new Map(); const parts = []; let length = 0;
  json.bufferViews = (original.bufferViews ?? []).flatMap((view, i) => {
    if (removed.has(i)) return [];
    assert.equal(view.buffer, 0); remap.set(i, remap.size);
    const pad = (4 - length % 4) % 4; parts.push(Buffer.alloc(pad)); length += pad;
    const offset = length; const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    assert.equal(data.length, view.byteLength); parts.push(data); length += data.length;
    return [{ ...view, byteOffset: offset }];
  });
  function rewrite(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'bufferView') { assert.ok(remap.has(child), 'Image view also referenced by non-image data'); value[key] = remap.get(child); }
      else rewrite(child);
    }
  }
  rewrite(json); if (json.buffers?.length) json.buffers[0].byteLength = Math.ceil(length / 4) * 4;
  const result = encode(json, Buffer.concat(parts));
  // Prove every retained binary view and every non-storage JSON field is identical.
  const candidate = decode(result); const restored = structuredClone(candidate.json);
  for (const [oldIndex, newIndex] of remap) {
    const a = original.bufferViews[oldIndex], b = candidate.json.bufferViews[newIndex];
    assert.deepEqual(bin.subarray(a.byteOffset ?? 0, (a.byteOffset ?? 0) + a.byteLength), candidate.bin.subarray(b.byteOffset ?? 0, (b.byteOffset ?? 0) + b.byteLength));
  }
  const reverse = new Map([...remap].map(([a,b]) => [b,a]));
  const undo = v => { if (v && typeof v === 'object') for (const [k,c] of Object.entries(v)) { if (k === 'bufferView') v[k] = reverse.get(c); else undo(c); } }; undo(restored);
  restored.images = original.images; restored.buffers = original.buffers; restored.bufferViews = original.bufferViews;
  assert.deepEqual(restored, original);
  return { result, images, removedViews: removed.size };
}
/** Test/export utility: re-embed shared encoded images without touching geometry. */
export function embed(bytes, images) {
  const {json,bin}=decode(bytes); const parts=[bin];let offset=bin.length;
  for(const image of json.images ?? []){
    if(!image.uri)continue;
    const name=image.uri.split('/').pop(),data=images.get(name);assert.ok(data,`Missing ${name}`);
    const pad=(4-offset%4)%4;parts.push(Buffer.alloc(pad));offset+=pad;
    image.bufferView=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length});delete image.uri;
    parts.push(data);offset+=data.length;
  }
  json.buffers[0].byteLength=Math.ceil(offset/4)*4;return encode(json,Buffer.concat(parts));
}
export async function verifyMigration() {
  const shared=path.resolve('public/resources/Model/SharedTextures/artist_valsekamerplant');const report=JSON.parse(await fs.readFile(path.join(shared,'valsekamerplant-manifest.json')));
  const images=new Map();let modelBytes=0;
  for(const m of report.models){
    const bytes=await fs.readFile(path.join('public/resources/Model/GLB/artist_valsekamerplant',m.path));assert.equal(hash(bytes),m.candidateSha256);modelBytes+=bytes.length;
    for(const image of decode(bytes).json.images ?? []){assert.equal(image.bufferView,undefined);assert.ok(image.uri.startsWith('__shared_textures__/artist_valsekamerplant/'));const name=image.uri.split('/').pop();assert.ok(m.images.includes(name));if(!images.has(name)){const data=await fs.readFile(path.join(shared,name));assert.equal(hash(data),name.split('.')[0]);images.set(name,data);}}
  }
  assert.equal(modelBytes,report.modelBytes);assert.equal([...images.values()].reduce((n,b)=>n+b.length,0),report.imageBytes);
  console.log(JSON.stringify({verifiedModels:report.modelCount,modelBytes,uniqueImages:images.size,imageBytes:report.imageBytes,combinedBytes:modelBytes+report.imageBytes,manifestBytes:(await fs.stat(path.join(shared,'valsekamerplant-manifest.json'))).size}));
}
async function files(dir) { return (await fs.readdir(dir, { withFileTypes: true })).flatMap(e => e.isDirectory() ? [] : [path.join(dir, e.name)]).concat(...await Promise.all((await fs.readdir(dir, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => files(path.join(dir,e.name))))); }
export async function migrate({ sample = false, commit = false } = {}) {
  const root = path.resolve('public/resources/Model/GLB/artist_valsekamerplant');
  const stage = path.resolve('.asset-migration/valsekamerplant'); const candidateRoot = path.join(stage, sample ? 'sample' : 'candidate');
  const models = (await files(root)).filter(f => /\.glb$/i.test(f)).sort();
  const selected = sample ? models.filter(f => /medieval/i.test(f)).slice(0, 2) : models;
  assert.ok(selected.length, 'No models selected');
  const report = { author: 'artist_valsekamerplant', uriLayout: 'author-folders-v1', modelCount: 0, beforeBytes: 0, modelBytes: 0, imageBytes: 0, uniqueImages: 0, models: [] }; const unique = new Map();
  for (const file of selected) {
    const bytes = await fs.readFile(file); const { result, images, removedViews } = extract(bytes, 'artist_valsekamerplant'); const relative = path.relative(root,file);
    const target = path.join(candidateRoot, 'models', relative); await fs.mkdir(path.dirname(target),{recursive:true}); await fs.writeFile(target,result);
    for (const [name,data] of images) unique.set(name,data);
    report.models.push({ path: relative.replaceAll('\\','/'), sourceSha256: hash(bytes), candidateSha256: hash(result), beforeBytes: bytes.length, afterBytes: result.length, removedViews, images: [...images.keys()] });
    report.modelCount++; report.beforeBytes += bytes.length; report.modelBytes += result.length;
  }
  await fs.mkdir(path.join(candidateRoot,'textures'),{recursive:true});
  for (const [name,data] of unique) { await fs.writeFile(path.join(candidateRoot,'textures',name),data); report.imageBytes += data.length; }
  report.uniqueImages = unique.size;
  await fs.writeFile(path.join(candidateRoot,'manifest.json'),JSON.stringify(report,null,2));
  if (commit) {
    assert.ok(!sample, 'Commit only the complete validated candidate');
    const shared = path.resolve('public/resources/Model/SharedTextures/artist_valsekamerplant'); await fs.mkdir(shared,{recursive:true});
    for (const [name,data] of unique) await fs.writeFile(path.join(shared,name),data);
    for (const m of report.models) {
      const file = path.join(root,m.path), backup = path.join(stage,'backup',m.path);
      assert.equal(hash(await fs.readFile(file)),m.sourceSha256,'Source changed during migration');
      await fs.mkdir(path.dirname(backup),{recursive:true}); await fs.copyFile(file,backup,1);
      await fs.copyFile(path.join(candidateRoot,'models',m.path),file);
    }
    await fs.copyFile(path.join(candidateRoot,'manifest.json'),path.join(shared,'valsekamerplant-manifest.json'));
  }
  console.log(JSON.stringify({ ...report, models: undefined, candidateRoot })); return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--verify'))await verifyMigration();else await migrate({ sample: process.argv.includes('--sample'), commit: process.argv.includes('--commit') });
}
