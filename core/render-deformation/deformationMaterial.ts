import { MaterialPluginBase, Matrix, PBRBaseMaterial, ShaderMaterial, ShadowDepthWrapper, StandardMaterial,
  type AbstractEngine, type AbstractMesh, type Material, type MaterialDefines, type Scene, type SubMesh, type UniformBuffer } from '@babylonjs/core';
import { bindDeformationDepth, depthDeclaration, depthUniforms } from './deformationDepth.ts';

export const meshDeformationMatrices = new WeakMap<AbstractMesh, { world: Matrix; local: Matrix }>();
const identity = Matrix.Identity();
const installed = new WeakSet<Material>();
export const supportsDeformationMaterial = (material: Material): boolean =>
  material.shaderLanguage === 0 && (material instanceof StandardMaterial || material instanceof PBRBaseMaterial
    || (material instanceof ShaderMaterial && material.options.uniforms.includes('uVisualDeformationLocal')));

/** Injection after bones/baked animation and before world normals, depth and lighting varyings. */
export class VisualDeformationPlugin extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, 'VisualDeformation', 180, {}, true, false);
    this.doNotSerialize = true;
    this.registerForExtraEvents = true;
    this._enable(true);
  }
  override prepareDefines(defines: MaterialDefines & { NONUNIFORMSCALING?: boolean }): void {
    // Shear requires the full inverse-transpose, even when the source mesh has uniform scale.
    defines.NONUNIFORMSCALING = true;
  }
  override getUniforms() {
    return { ubo: [{ name: 'uVisualDeformationWorld', size: 16, type: 'mat4' }], vertex: 'uniform mat4 uVisualDeformationWorld;', externalUniforms: depthUniforms };
  }
  override hardBindForSubMesh(ubo: UniformBuffer, _scene: Scene, _engine: AbstractEngine, subMesh: SubMesh): void {
    ubo.updateMatrix('uVisualDeformationWorld', meshDeformationMatrices.get(subMesh.getRenderingMesh())?.world ?? identity);
    bindDeformationDepth(this._material.getEffect(), _scene);
  }
  override getCustomCode(stage: string): Record<string, string> | null {
    if (stage === 'fragment') return { CUSTOM_FRAGMENT_DEFINITIONS: depthDeclaration,
      CUSTOM_FRAGMENT_MAIN_END: 'if (uVisualDepthOptions.x > 0.5) { if (gl_FragColor.a < 0.4) discard; gl_FragColor = vdDepthColor(vPositionW); }' };
    if (stage !== 'vertex') return null;
    return {
      '!vec4 worldPos=finalWorld\\*vec4\\(positionUpdated,1\\.0\\);': 'finalWorld = uVisualDeformationWorld * finalWorld;\n$0',
      CUSTOM_VERTEX_MAIN_END: `
        #if (defined(BUMP) || defined(PARALLAX) || defined(CLEARCOAT_BUMP) || defined(ANISOTROPIC)) && defined(TANGENT) && defined(NORMAL)
          vec3 vdNormal = normalize(vNormalW);
          vec3 vdTangent = normalize(vTBN[0] - vdNormal * dot(vdNormal, vTBN[0]));
          vec3 vdBitangent = cross(vdNormal, vdTangent);
          vdBitangent *= sign(dot(vdBitangent, vTBN[1]));
          vTBN = mat3(vdTangent, vdBitangent, vdNormal);
        #endif
      `,
    };
  }
}

/** Install once per material; values are bound per draw, never stored as shared object settings. */
export function ensureDeformationMaterial(material: Material, withShadows = true): void {
  if (!installed.has(material)) {
    if (!supportsDeformationMaterial(material)) throw new Error(`材质 ${material.name} 尚未支持顶点变形`);
    if (material instanceof ShaderMaterial) {
      material.setMatrix('uVisualDeformationLocal', identity);
      material.onBindObservable.add(mesh => {
        // Direct effect binding is intentional: ShaderMaterial's cached uniforms were already bound.
        material.getEffect()?.setMatrix('uVisualDeformationLocal', meshDeformationMatrices.get(mesh)?.local ?? identity);
        bindDeformationDepth(material.getEffect(), material.getScene());
      });
    } else {
      new VisualDeformationPlugin(material);
    }
    installed.add(material);
  }
  if (withShadows && !material.shadowDepthWrapper) {
    const wrapper = new ShadowDepthWrapper(material, material.getScene()); material.shadowDepthWrapper = wrapper;
    // A sprite may have compiled before this optional feature was enabled. The wrapper needs
    // a fresh onEffectCreated notification for every submesh, even when the shader is cached.
    material.resetDrawCache();
    material.onDisposeObservable.addOnce(() => wrapper.dispose());
  }
}
