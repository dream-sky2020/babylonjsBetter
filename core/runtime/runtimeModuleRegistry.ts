import type { RuntimeModuleId } from './runtime.types';

declare const runtimeModuleTokenBrand: unique symbol;

export type RuntimeModuleToken = {
  readonly id: RuntimeModuleId;
  readonly [runtimeModuleTokenBrand]: true;
};

export class RuntimeModuleRegistry {
  private readonly tokensById = new Map<RuntimeModuleId, RuntimeModuleToken>();
  private readonly knownTokens = new WeakSet<object>();

  register(moduleIdValue: RuntimeModuleId): RuntimeModuleToken {
    const moduleId = moduleIdValue.trim();
    if (!moduleId) throw new Error('Runtime Module ID 不能为空。');
    if (this.tokensById.has(moduleId)) throw new Error(`Runtime 模块“${moduleId}”已经注册。`);
    const token = Object.freeze({ id: moduleId }) as RuntimeModuleToken;
    this.tokensById.set(moduleId, token);
    this.knownTokens.add(token);
    return token;
  }

  owns(token: RuntimeModuleToken, expectedModuleId?: RuntimeModuleId): boolean {
    return this.knownTokens.has(token)
      && this.tokensById.get(token.id) === token
      && (expectedModuleId === undefined || token.id === expectedModuleId);
  }

  requireOwner(token: RuntimeModuleToken, expectedModuleId?: RuntimeModuleId): void {
    if (!this.owns(token, expectedModuleId)) throw new Error('Runtime Module Token 无效或不属于该模块。');
  }

  get moduleIds(): readonly RuntimeModuleId[] {
    return [...this.tokensById.keys()];
  }
}