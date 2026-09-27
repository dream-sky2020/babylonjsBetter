import { Animation, Bone, Color3, DirectionalLight, Matrix, MeshBuilder, PBRMaterial, RawTexture, Skeleton, StandardMaterial,
  TransformNode, Vector3, VertexBuffer, type Scene } from '@babylonjs/core';
import { getVisualDeformationRegistry } from '@/core/render-deformation/visualDeformationRegistry.ts';
import { createSpriteEffectMaterial } from '@/core/sprite/render/createSpriteEffectMaterial.ts';

/** Representative world objects; both boxes intentionally share one material. */
export function createDeformationSamples(scene: Scene, origin = Vector3.Zero()) {
  const root = new TransformNode('deformation-samples', scene); root.position.copyFrom(origin);
  const registry = getVisualDeformationRegistry(scene);
  const shared = new PBRMaterial('samples-shared-pbr', scene); shared.albedoColor = Color3.FromHexString('#db964c'); shared.metallic = .15; shared.roughness = .6;
  const meshes = [];
  for (const [i, strengthLabel] of ['full', 'half'].entries()) {
    const box = MeshBuilder.CreateBox(`shared-${strengthLabel}`, { width: 1.6, height: 4, depth: 1.6 }, scene);
    box.position.set(i * 3 - 5, 2, 0); box.parent = root; box.material = shared; meshes.push(box);
    registry.register({ root: box, meshes: [box], kind: 'model', id: `sample:${strengthLabel}`, groupId: 'sample-models', tags: [strengthLabel], anchor: [0, -2, 0] });
  }
  const cylinder = MeshBuilder.CreateCylinder('animated-sample', { height: 4, diameterTop: .4, diameterBottom: 1.5 }, scene);
  cylinder.position.set(1, 2, 0); cylinder.parent = root;
  const matte = new StandardMaterial('sample-standard', scene); matte.diffuseColor = Color3.FromHexString('#42bdb4'); cylinder.material = matte;
  const skeleton = new Skeleton('sample-skeleton', 'sample-skeleton', scene);
  const bone = new Bone('sample-bone', skeleton, null, Matrix.Identity()); cylinder.skeleton = skeleton;
  const count = cylinder.getTotalVertices(); const indices = new Float32Array(count * 4); const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  cylinder.setVerticesData(VertexBuffer.MatricesIndicesKind, indices); cylinder.setVerticesData(VertexBuffer.MatricesWeightsKind, weights);
  const animation = new Animation('bone-sway', 'rotation.z', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  animation.setKeys([{ frame: 0, value: -.15 }, { frame: 30, value: .15 }, { frame: 60, value: -.15 }]);
  bone.animations.push(animation);
  registry.register({ root: cylinder, meshes: [cylinder], kind: 'model', id: 'sample:animated', groupId: 'sample-models', anchor: [0, -2, 0] }); meshes.push(cylinder);
  const texture = RawTexture.CreateRGBATexture(new Uint8Array([220, 90, 220, 255]), 1, 1, scene, false, false);
  const sprite = MeshBuilder.CreatePlane('shader-sprite-sample', { width: 2, height: 4 }, scene); sprite.parent = root; sprite.position.set(4, 2, 0);
  const shader = createSpriteEffectMaterial(scene, 'sample-composed-sprite', { mode: 'texture' }, { sourceTexture: texture }); sprite.material = shader.material;
  registry.register({ root: sprite, meshes: [sprite], kind: 'sprite', id: 'sample:sprite', groupId: 'sample-sprites', anchor: [0, -2, 0] }); meshes.push(sprite);
  const fill = new DirectionalLight('deformation-sample-light', new Vector3(-.5, -1, -.5), scene); fill.intensity = 1.5;
  // Demo lighting must not change the loaded map or models created after a map switch.
  fill.includedOnlyMeshes = meshes;
  return { root, meshes, shared, cylinder, sprite, skeleton, light: fill, shader,
    animate() { scene.beginAnimation(bone, 0, 60, true); },
    dispose() { scene.stopAnimation(bone); root.dispose(); skeleton.dispose(); shared.dispose(); matte.dispose(); shader.dispose(); texture.dispose(); fill.dispose(); },
  };
}
