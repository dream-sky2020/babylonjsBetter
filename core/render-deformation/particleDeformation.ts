import { AbstractMesh, Effect, GPUParticleSystem, Matrix, ParticleSystem, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import { particlesVertexShader } from '@babylonjs/core/Shaders/particles.vertex.js';
import { gpuRenderParticlesVertexShader } from '@babylonjs/core/Shaders/gpuRenderParticles.vertex.js';
import '@babylonjs/core/Shaders/particles.fragment.js';
import '@babylonjs/core/Shaders/gpuRenderParticles.fragment.js';
import { getVisualDeformationRegistry, type VisualDeformationMetadata } from './visualDeformationRegistry.ts';

/** Reuses Babylon's complete particle variants, changing only the final world position. Simulation is untouched. */
export function registerParticleDeformation(scene: Scene, system: ParticleSystem | GPUParticleSystem, metadata: VisualDeformationMetadata = {}): () => void {
  const root = new TransformNode(`deformation:${system.name}`, scene);
  const gpu = system instanceof GPUParticleSystem;
  const source = gpu ? gpuRenderParticlesVertexShader.shader : particlesVertexShader.shader;
  const name = gpu ? 'visualDeformationGpuParticles' : 'visualDeformationParticles';
  const marker = gpu ? 'gl_Position=projection*viewPosition;' : 'vColor=color;';
  const code = 'vPositionW = (uVisualDeformationWorld * vec4(vPositionW, 1.0)).xyz; gl_Position = projection * view * vec4(vPositionW, 1.0);';
  if (!source.includes(marker)) throw new Error('Babylon 粒子 Shader 接口发生变化');
  Effect.ShadersStore[`${name}VertexShader`] ??= `uniform mat4 uVisualDeformationWorld;\n${source.replace(marker, `${marker}\n${code}`)}`;
  const previous = new Map<number, Effect | null>();
  const signatures = new Map<number, string>();
  const owned = new Map<number, Effect>();
  let matrix = Matrix.Identity();
  let active = false;
  const bindObserver = system.onBeforeDrawParticlesObservable.add(effect => { if (active) effect?.setMatrix('uVisualDeformationWorld', matrix); });
  const restore = () => {
    if (!active) return; active = false;
    previous.forEach((effect, blend) => { if (system.getCustomEffect(blend) === owned.get(blend)) system.setCustomEffect(effect, blend); });
    previous.clear(); signatures.clear(); owned.clear();
  };
  const unregister = getVisualDeformationRegistry(scene).register({ root, meshes: [], kind: 'particle', groupId: 'particles', ...metadata,
    adapter: {
      unsupported: () => scene.getEngine().isWebGPU ? '粒子变形目前支持 WebGL / GLSL'
        : [0, 1, 2, 3].some(blend => { const effect = system.getCustomEffect(blend); return effect && effect !== owned.get(blend); }) ? '粒子已使用其他自定义 Shader，需专用适配' : undefined,
      readAnchor: () => system.emitter instanceof AbstractMesh ? system.emitter.getAbsolutePosition()
        : system.emitter instanceof Vector3 ? system.emitter : Vector3.Zero(),
      apply(next) {
        if (!next) { restore(); return; }
        matrix = next;
        if (!active) for (const blend of [0, 1, 2, 3]) previous.set(blend, system.getCustomEffect(blend));
        for (const blend of [0, 1, 2, 3]) {
          const defines: string[] = []; const uniforms: string[] = []; const attributes: string[] = []; const samplers: string[] = [];
          system.fillDefines(defines, blend); system.fillUniformsAttributesAndSamplerNames(uniforms, attributes, samplers);
          const signature = [defines.join('\n'), attributes.join(','), uniforms.join(','), samplers.join(',')].join('|');
          if (signatures.get(blend) === signature) continue;
          const effect = scene.getEngine().createEffect({ vertex: name, fragment: gpu ? 'gpuRenderParticles' : 'particles' }, {
            attributes, uniformsNames: [...uniforms, 'uVisualDeformationWorld'], samplers, defines: defines.join('\n'), fallbacks: null, onCompiled: null, onError: null,
          }, scene.getEngine());
          system.setCustomEffect(effect, blend); owned.set(blend, effect); signatures.set(blend, signature);
        }
        active = true;
      },
    },
  });
  let disposed = false;
  const cleanup = () => {
    if (disposed) return; disposed = true;
    unregister(); restore(); system.onBeforeDrawParticlesObservable.remove(bindObserver);
    system.onDisposeObservable.remove(disposeObserver); root.dispose();
  };
  const disposeObserver = system.onDisposeObservable.add(cleanup);
  return cleanup;
}
