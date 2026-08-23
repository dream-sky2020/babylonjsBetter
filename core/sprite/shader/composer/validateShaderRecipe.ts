import type { SpriteShaderRecipe } from './shaderModule.types.ts';

export const validateShaderRecipe = (recipe: SpriteShaderRecipe): void => {
  if (!recipe.id.trim()) throw new Error('Sprite shader recipe id is required.');
  const ids = new Set<string>();
  const toggleOptions = new Set<string>();
  const toggleUniforms = new Set<string>();
  for (const module of recipe.modules) {
    if (ids.has(module.id)) throw new Error(`Duplicate sprite shader module: ${module.id}`);
    for (const dependency of module.requires ?? []) {
      if (!ids.has(dependency)) throw new Error(`Module ${module.id} requires ${dependency} before it.`);
    }
    for (const toggle of module.runtimeToggles ?? []) {
      if (!toggle.optionKey.trim() || !toggle.uniform.trim()) throw new Error(`Module ${module.id} has an invalid runtime toggle.`);
      if (!module.uniforms?.includes(toggle.uniform)) throw new Error(`Module ${module.id} runtime toggle ${toggle.uniform} is not declared in its uniforms.`);
      if (toggleOptions.has(toggle.optionKey)) throw new Error(`Duplicate runtime toggle option: ${toggle.optionKey}`);
      if (toggleUniforms.has(toggle.uniform)) throw new Error(`Duplicate runtime toggle uniform: ${toggle.uniform}`);
      toggleOptions.add(toggle.optionKey); toggleUniforms.add(toggle.uniform);
    }
    const source = JSON.stringify({ vertex: module.vertex, fragment: module.fragment });
    for (const match of source.matchAll(/#include<([^>]+)>/g)) {
      if (!match[1]?.startsWith('mySprite')) throw new Error(`Module ${module.id} uses unprefixed include ${match[1]}.`);
    }
    ids.add(module.id);
  }
};
