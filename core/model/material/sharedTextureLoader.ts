import { registerGLTFExtension } from '@babylonjs/loaders/glTF/2.0/glTFLoaderExtensionRegistry';
import { acquireModelTexture, resolveModelDependencyUrl } from './modelTextureCache.ts';
import type { Texture } from '@babylonjs/core';
// Babylon 9.11 adapter. Only our per-call loader options opt in; no global URL callback.
registerGLTFExtension('PROJECT_shared_images', false, loader => {
  let disposed = false, ready = false;
  const views = new Set<Texture>();
  return {
  name: 'PROJECT_shared_images', enabled: loader.parent.preprocessUrlAsync === resolveModelDependencyUrl,
  onReady() { ready = true; },
  dispose() { disposed = true; if (!ready) views.forEach(t => t.dispose()); views.clear(); },
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    const info = material.pbrMetallicRoughness?.baseColorTexture;
    const texture = info && loader.gltf.textures?.[info.index];
    const image = texture && loader.gltf.images?.[texture.source!];
    if (!['MASK','BLEND'].includes(material.alphaMode ?? '') || !image?.uri || image.uri.startsWith('data:')) return null;
    // Babylon normally assigns a texture synchronously before setting alpha flags.
    // Our shared view arrives asynchronously, so restore those flags once assigned.
    // The loader's extension recursion guard delegates this call to other extensions.
    return loader.loadMaterialPropertiesAsync(context,material,babylonMaterial).then(() => {
      loader.loadMaterialAlphaProperties(context,material,babylonMaterial);
    });
  },
  _loadTextureAsync(_context, texture, assign) {
    const image = loader.gltf.images?.[texture.source!];
    if (!image?.uri || image.uri.startsWith('data:') || texture.extensions) return null;
    if (image.uri.includes('..')) throw new Error('External image URI may not contain ..');
    const sampler = texture.sampler === undefined ? {} : loader.gltf.samplers![texture.sampler];
    // The version adapter preserves Babylon's exact glTF filter mapping, not an approximation.
    const data = (loader as unknown as { _loadSampler(c: string, s: unknown): { noMipMaps: boolean; samplingMode: number; wrapU: number; wrapV: number } })._loadSampler('/samplers',sampler);
    return loader.parent.preprocessUrlAsync(`${loader.rootUrl}${image.uri}`).then(async url => {
      const view = await acquireModelTexture(loader.babylonScene,url,{ gamma: !texture._textureInfo.nonColorData, noMipmap: data.noMipMaps,
        samplingMode: data.samplingMode, wrapU: data.wrapU, wrapV: data.wrapV, useSRGBBuffer: !texture._textureInfo.nonColorData && loader.parent.useSRGBBuffers });
      if (disposed) { view.dispose(); throw new Error('模型依赖加载已取消'); }
      views.add(view);
      view._parentContainer = loader._assetContainer;
      try { assign(view); return view; } catch (error) { view.dispose(); throw error; }
    });
  },
}; });
