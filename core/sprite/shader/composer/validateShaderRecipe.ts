import type { SpriteShaderRecipe } from './shaderModule.types.ts';

export const validateShaderRecipe = (recipe: SpriteShaderRecipe): void => {
  if (!recipe.id.trim()) throw new Error('Sprite shader recipe id is required.');
  const ids = new Set<string>();
  for (const module of recipe.modules) {
    if (ids.has(module.id)) throw new Error(`Duplicate sprite shader module: ${module.id}`);
    for (const dependency of module.requires ?? []) {
      if (!ids.has(dependency)) throw new Error(`Module ${module.id} requires ${dependency} before it.`);
    }
    const source = JSON.stringify({ vertex: module.vertex, fragment: module.fragment });
    for (const match of source.matchAll(/#include<([^>]+)>/g)) {
      if (!match[1]?.startsWith('mySprite')) throw new Error(`Module ${module.id} uses unprefixed include ${match[1]}.`);
    }
    ids.add(module.id);
  }
};
