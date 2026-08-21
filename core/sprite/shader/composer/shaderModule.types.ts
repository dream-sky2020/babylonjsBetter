export type ShaderStageSlots = {
  declarations?: string;
  functions?: string;
  beforePosition?: string;
  transformPosition?: string;
  afterPosition?: string;
  afterSample?: string;
  modifyField?: string;
  modifyColor?: string;
  beforeOutput?: string;
};

export type SpriteShaderModule = {
  id: string;
  requires?: readonly string[];
  attributes?: readonly string[];
  uniforms?: readonly string[];
  samplers?: readonly string[];
  vertex?: ShaderStageSlots;
  fragment?: ShaderStageSlots;
};

export type SpriteShaderRecipe = { id: string; modules: readonly SpriteShaderModule[] };
export type SpriteShaderTemplates = { vertex: string; fragment: string };
export type ComposedSpriteShaderProgram = {
  key: string;
  vertex: string;
  fragment: string;
  attributes: string[];
  uniforms: string[];
  samplers: string[];
};
