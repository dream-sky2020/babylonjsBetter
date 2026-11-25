import { MaterialPluginBase, PBRMaterial, type Material } from '@babylonjs/core';

export const environmentShaderPreviews = {
  source: { label: '原材质', shading: 'source', outline: false },
  toon: { label: '卡通', shading: 'toon', outline: false },
  outline: { label: '原材质 + 细描边', shading: 'source', outline: true },
  'toon-outline': { label: '卡通 + 细描边', shading: 'toon', outline: true },
  'ink-outline': { label: '黑白漫画 + 细描边', shading: 'ink', outline: true },
} as const;
export type EnvironmentShaderPreview = keyof typeof environmentShaderPreviews;
type PreviewShading = typeof environmentShaderPreviews[EnvironmentShaderPreview]['shading'];

export function canPreviewToon(material: Material | null): boolean {
  return material instanceof PBRMaterial && material.shaderLanguage === 0 && !material.unlit;
}

class EnvironmentToonPreviewPlugin extends MaterialPluginBase {
  constructor(material: Material, ink: boolean) {
    super(material, 'SceneEnvironmentToonPreview', 200, {
      SCENE_ENVIRONMENT_TOON_PREVIEW: true,
      SCENE_ENVIRONMENT_INK_PREVIEW: ink,
    }, true, true);
    this.doNotSerialize = true;
  }

  override getCustomCode(shaderType: string) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION: `
        #if defined(SCENE_ENVIRONMENT_TOON_PREVIEW) && !defined(UNLIT)
        float previewLight = dot(diffuseBase * vLightingIntensity.x, vec3(0.2126, 0.7152, 0.0722));
        float previewBlend = smoothstep(0.22, 0.26, previewLight);
        vec3 previewTone = mix(vec3(0.38, 0.43, 0.53), vec3(0.94), previewBlend);
        finalDiffuse = surfaceAlbedo * previewTone * ambientOcclusionForDirectDiffuse;
        #ifdef SPECULARTERM
          finalSpecularScaled *= 0.15;
        #endif
        #endif
      `,
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
        #ifdef SCENE_ENVIRONMENT_INK_PREVIEW
        float previewInk = dot(finalColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        finalColor.rgb = vec3(previewInk);
        #endif
      `,
    };
  }
}

export function createPreviewShading(shading: PreviewShading) {
  if (shading === 'source') return null;
  return (material: Material) => {
    if (canPreviewToon(material)) new EnvironmentToonPreviewPlugin(material, shading === 'ink');
  };
}
