import type { RuntimeScopeAddress, RuntimeScopeToken } from './runtime.types';

export const normalizeRuntimeScopeAddress = (address: RuntimeScopeAddress): RuntimeScopeAddress => {
  const key = address.key.trim();
  if (!key) throw new Error(`Runtime ${address.kind} Scope Key 不能为空。`);
  return Object.freeze({ kind: address.kind, key });
};

export const createRuntimeScopeToken = (address: RuntimeScopeAddress): RuntimeScopeToken => (
  Object.freeze({ address: normalizeRuntimeScopeAddress(address) }) as RuntimeScopeToken
);

export const getRuntimeScopeId = (scope: RuntimeScopeToken): string => (
  `${scope.address.kind}:${scope.address.key}`
);