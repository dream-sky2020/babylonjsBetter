import { modelUvCoverage, type UvTexture } from './sceneEnvironmentUvCoverage';
self.onmessage = (event: MessageEvent<{ id: string; textures: UvTexture[] }>) => {
  try { self.postMessage({ id: event.data.id, coverage: modelUvCoverage(event.data.textures) }); }
  catch { self.postMessage({ id: event.data.id, coverage: { percent: null, detail: 'UV 数据无法分析' } }); }
};
