export const isDungeonInteractionCommandId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 128 && value === value.trim() && /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(value);
