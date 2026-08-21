import type { ComposedSpriteShaderProgram, ShaderStageSlots, SpriteShaderRecipe, SpriteShaderTemplates } from './shaderModule.types.ts';
import { validateShaderRecipe } from './validateShaderRecipe.ts';

const slotMarker = (stage: 'vertex' | 'fragment', slot: keyof ShaderStageSlots) => `/* mySprite:${stage}:${slot} */`;
const unique = (values: readonly (readonly string[] | undefined)[]) => [...new Set(values.flatMap((value) => value ?? []))];

const composeStage = (source: string, stage: 'vertex' | 'fragment', recipe: SpriteShaderRecipe): string => {
  const slots: Array<keyof ShaderStageSlots> = stage === 'vertex'
    ? ['declarations', 'functions', 'beforePosition', 'transformPosition', 'afterPosition']
    : ['declarations', 'functions', 'afterSample', 'modifyField', 'modifyColor', 'beforeOutput'];
  return slots.reduce((result, slot) => result.replace(
    slotMarker(stage, slot),
    recipe.modules.map((module) => module[stage]?.[slot] ?? '').join('\n')
  ), source);
};

export const composeSpriteShader = (recipe: SpriteShaderRecipe, templates: SpriteShaderTemplates): ComposedSpriteShaderProgram => {
  validateShaderRecipe(recipe);
  return {
    key: ['mySprite', recipe.id, ...recipe.modules.map((module) => module.id)].join(':'),
    vertex: composeStage(templates.vertex, 'vertex', recipe),
    fragment: composeStage(templates.fragment, 'fragment', recipe),
    attributes: unique(recipe.modules.map((module) => module.attributes)),
    uniforms: unique(recipe.modules.map((module) => module.uniforms)),
    samplers: unique(recipe.modules.map((module) => module.samplers))
  };
};
