import { Texture, type Scene } from '@babylonjs/core';
import { LoadFile } from '@babylonjs/core/Misc/fileTools';
import { resolvePublicResourceUrl } from '../../resources/appAssetUrl.ts';
export type TextureSettings = { gamma: boolean; noMipmap: boolean; samplingMode: number; wrapU: number; wrapV: number; useSRGBBuffer: boolean };
type Entry = { refs: number; promise: Promise<Texture> };
type Cache = { entries: Map<string, Entry>; bytes: Map<string, { refs: number; promise: Promise<ArrayBuffer> }>; pending: Set<() => void>; requests: number; hits: number; uploads: number; disposed: boolean };
const caches = new WeakMap<Scene, Cache>();
function cacheFor(scene: Scene): Cache {
  let cache = caches.get(scene); if (cache) return cache;
  cache = { entries: new Map(), bytes: new Map(), pending: new Set(), requests: 0, hits: 0, uploads: 0, disposed: false }; caches.set(scene,cache);
  scene.onDisposeObservable.addOnce(() => { cache!.disposed = true; for (const cancel of [...cache!.pending]) cancel(); cache!.pending.clear(); for (const e of cache!.entries.values()) void e.promise.then(t => t.dispose(), () => {}); cache!.entries.clear(); cache!.bytes.clear(); });
  return cache;
}
export function resolveModelDependencyUrl(url: string): Promise<string> {
  const marker = '/__shared_textures__/'; const at = url.lastIndexOf(marker);
  if (at < 0) return Promise.resolve(url);
  const name = url.slice(at + marker.length);
  // Author directories mirror GLB/artist_*; a single optional directory retains legacy URI support.
  if (!/^(?:artist_[a-z0-9][a-z0-9_-]{0,79}\/)?[a-f0-9]{64}\.(png|jpg)$/.test(name)) return Promise.reject(new Error('无效共享贴图标记'));
  return Promise.resolve(resolvePublicResourceUrl(`resources/Model/SharedTextures/${name}`));
}
/** A returned wrapper is exclusively owned by its caller; dispose it to release its lease. */
export async function acquireModelTexture(scene: Scene, url: string, settings: TextureSettings, signal?: AbortSignal): Promise<Texture> {
  signal?.throwIfAborted();
  const cache = cacheFor(scene); if (cache.disposed || scene.isDisposed) throw new Error('Scene disposed');
  const key = JSON.stringify([url,settings]); let entry = cache.entries.get(key);
  if (entry) cache.hits++;
  else {
    let bytes = cache.bytes.get(url);
    if (!bytes) { cache.requests++; bytes = { refs: 0, promise: new Promise<ArrayBuffer>((resolve,reject) => {
      const cancel = () => { reject(new Error('Scene disposed')); request.abort(); };
      const request = LoadFile(url, data => { cache.pending.delete(cancel); resolve(data as ArrayBuffer); }, undefined, undefined, true, (_request,error) => { cache.pending.delete(cancel); reject(error); });
      cache.pending.add(cancel);
    }) }; cache.bytes.set(url,bytes); }
    bytes.refs++;
    const promise = bytes.promise.then(data => new Promise<Texture>((resolve,reject) => {
      if (cache.disposed) { reject(new Error('Scene disposed')); return; }
      cache.uploads++;
      const cancel = () => { reject(new Error('Scene disposed')); texture.dispose(); }; cache.pending.add(cancel);
      const texture = new Texture(`data:model-shared:${key}`, scene, { buffer: new Uint8Array(data), deleteBuffer: false,
        invertY: false, noMipmap: settings.noMipmap, samplingMode: settings.samplingMode, useSRGBBuffer: settings.useSRGBBuffer,
        onLoad: () => { cache.pending.delete(cancel); resolve(texture); }, onError: (message) => { cache.pending.delete(cancel); texture.dispose(); reject(new Error(message ?? `贴图加载失败：${url}`)); } });
      texture.name = url; texture.gammaSpace = settings.gamma; texture.wrapU = settings.wrapU; texture.wrapV = settings.wrapV;
    }));
    entry = { refs: 0, promise }; cache.entries.set(key,entry);
  }
  entry.refs++;
  let released = false;
  const release = () => {
    if (released) return; released = true;
    if (--entry!.refs !== 0) return;
    if (cache.entries.get(key) === entry) cache.entries.delete(key);
    void entry!.promise.then(t => t.dispose(), () => {});
    const bytes = cache.bytes.get(url); if (bytes && --bytes.refs === 0) cache.bytes.delete(url);
  };
  let onAbort = () => {};
  try {
    const cancelled = new Promise<never>((_resolve,reject) => { onAbort = () => reject(signal?.reason ?? new Error('Texture acquisition aborted')); signal?.addEventListener('abort',onAbort,{once:true}); });
    const anchor = await (signal ? Promise.race([entry.promise,cancelled]) : entry.promise); if (cache.disposed) throw new Error('Scene disposed');
    const view = anchor.clone(); view.onDisposeObservable.addOnce(release); return view;
  } catch (error) { release(); throw error; } finally { signal?.removeEventListener('abort',onAbort); }
}
export function getModelTextureCacheStats(scene: Scene) {
  const c = caches.get(scene); return { requests: c?.requests ?? 0, hits: c?.hits ?? 0, uploads: c?.uploads ?? 0, textures: c?.entries.size ?? 0, images: c?.bytes.size ?? 0, leases: c ? [...c.entries.values()].reduce((n,e) => n + e.refs,0) : 0 };
}
