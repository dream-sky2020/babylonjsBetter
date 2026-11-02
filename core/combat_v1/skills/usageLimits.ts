/** Mutable data owned by a character + skill + usage context, never shared between characters. */
export type UsageLimits = {
  cost: { mp?: number; sp?: number };
  actionCost?: 0 | 1;
  cooldown?: { turns: number; remaining: number };
  uses?: { limit: number; remaining: number };
};

function count(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('使用限制次数必须是非负安全整数。');
}

export function validateUsageLimits(limits: UsageLimits): void {
  for (const value of Object.values(limits.cost)) {
    if (!Number.isFinite(value) || value < 0) throw new Error('技能消耗无效。');
  }
  if (limits.actionCost !== undefined && limits.actionCost !== 0 && limits.actionCost !== 1) throw new Error('行动消耗无效。');
  if (limits.cooldown) { count(limits.cooldown.turns); count(limits.cooldown.remaining); }
  if (limits.uses) {
    count(limits.uses.limit); count(limits.uses.remaining);
    if (limits.uses.remaining > limits.uses.limit) throw new Error('剩余使用次数不能超过上限。');
  }
}

/** Deep copy the template before assigning it to a character. */
export function createUsageLimits(template: UsageLimits): UsageLimits {
  validateUsageLimits(template);
  return structuredClone(template);
}

export function consumeUsageLimits(limits: UsageLimits): UsageLimits {
  const next = createUsageLimits(limits);
  if (next.cooldown?.remaining) throw new Error('技能仍在冷却中。');
  if (next.uses && next.uses.remaining === 0) throw new Error('技能使用次数不足。');
  if (next.cooldown) next.cooldown.remaining = next.cooldown.turns;
  if (next.uses) next.uses.remaining -= 1;
  return next;
}

/** Caller decides which boundary advances cooldown; extra actions do not advance it automatically. */
export function advanceUsageCooldown(limits: UsageLimits, turns = 1): UsageLimits {
  count(turns);
  const next = createUsageLimits(limits);
  if (next.cooldown) next.cooldown.remaining = Math.max(0, next.cooldown.remaining - turns);
  return next;
}

/** Caller decides when charges reset (battle start, rest, etc.). */
export function restoreUsageCount(limits: UsageLimits): UsageLimits {
  const next = createUsageLimits(limits);
  if (next.uses) next.uses.remaining = next.uses.limit;
  return next;
}
