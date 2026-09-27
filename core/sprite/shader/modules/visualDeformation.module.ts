import type { SpriteShaderModule } from '../composer/shaderModule.types.ts';
import { depthDeclaration, depthUniforms } from '../../../render-deformation/deformationDepth.ts';

/** Runs after local sprite motion/erosion. World-space affine matrix is converted to local by the owner. */
export const visualDeformationModule: SpriteShaderModule = {
  id: 'visual-deformation-v1', requires: ['base-sprite'], uniforms: ['uVisualDeformationLocal', 'world', 'viewProjection', ...depthUniforms],
  vertex: {
    declarations: 'uniform mat4 uVisualDeformationLocal; uniform mat4 world; uniform mat4 viewProjection; varying vec3 vVisualPositionW;',
    afterPosition: `vec4 worldPos = world * uVisualDeformationLocal * vec4(mySpritePosition, 1.0);
      gl_Position = viewProjection * worldPos; vVisualPositionW = worldPos.xyz;`,
  },
  fragment: { declarations: `varying vec3 vVisualPositionW; ${depthDeclaration}`,
    afterOutput: `float alpha = gl_FragColor.a;
      if (alpha < 0.001) discard;
      if (uVisualDepthOptions.x > 0.5) { if (alpha < 0.4) discard; gl_FragColor = vdDepthColor(vVisualPositionW); }`,
  },
};
