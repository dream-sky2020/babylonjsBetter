import { Effect } from '@babylonjs/core';
import type { ComposedSpriteShaderProgram } from './shaderModule.types.ts';

export type RegisteredSpriteShaderProgram = ComposedSpriteShaderProgram & { vertexName: string; fragmentName: string };
const cache = new Map<string, RegisteredSpriteShaderProgram>();
const safeName = (key: string) => key.replace(/[^a-zA-Z0-9_]/g, '_');

export const registerSpriteShaderProgram = (program: ComposedSpriteShaderProgram): RegisteredSpriteShaderProgram => {
  const cached = cache.get(program.key);
  if (cached) return cached;
  const name = safeName(program.key);
  const vertexName = `${name}Vertex`;
  const fragmentName = `${name}Fragment`;
  Effect.ShadersStore[`${vertexName}VertexShader`] = program.vertex;
  Effect.ShadersStore[`${vertexName}Shader`] = program.vertex;
  Effect.ShadersStore[`${fragmentName}PixelShader`] = program.fragment;
  Effect.ShadersStore[`${fragmentName}FragmentShader`] = program.fragment;
  Effect.ShadersStore[`${fragmentName}Shader`] = program.fragment;
  const registered = { ...program, vertexName, fragmentName };
  cache.set(program.key, registered);
  return registered;
};

export const clearSpriteShaderProgramCache = (): void => cache.clear();
