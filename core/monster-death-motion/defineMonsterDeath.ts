import type { MonsterDeathDefinition, MonsterDeathParameterSchema, MonsterDeathParameterValues } from './types';

export const defineMonsterDeath = (definition: MonsterDeathDefinition): MonsterDeathDefinition => definition;

export const createDefaultMonsterDeathParameters = (schema: MonsterDeathParameterSchema): MonsterDeathParameterValues =>
  Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, value.default]));

export const normalizeMonsterDeathParameters = (
  schema: MonsterDeathParameterSchema,
  input: unknown
): MonsterDeathParameterValues => {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(schema).map(([key, definition]) => {
    const raw = source[key];
    if (definition.type === 'number') {
      const value = Number(raw);
      return [key, Math.max(definition.min, Math.min(definition.max, Number.isFinite(value) ? value : definition.default))];
    }
    if (definition.type === 'boolean') return [key, typeof raw === 'boolean' ? raw : definition.default];
    if (definition.type === 'color') return [key, typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw : definition.default];
    return [key, definition.options.some((option) => option.value === raw) ? String(raw) : definition.default];
  }));
};
