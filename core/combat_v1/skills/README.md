# 技能使用限制

主动技能在 `active.battle.usageLimits` 或 `active.field.usageLimits` 保存限制模板：

```ts
usageLimits: {
  cost: { mp: 5, sp: 0 },
  actionCost: 1,
  cooldown: { turns: 2, remaining: 0 },
  uses: { limit: 3, remaining: 3 },
}
```

这些都是可修改的数据：减耗可以修改 `cost.mp`，缩短冷却可以修改 `cooldown.turns`，立即冷却可以修改 `cooldown.remaining`，补充次数可以修改 `uses.remaining`。次数必须是非负安全整数，剩余次数不能超过上限；降低上限时同时调整剩余次数。省略 `cooldown` 表示无冷却，省略 `uses` 表示不限次数。`actionCost` 省略时战斗默认 1，战斗外始终 0；暂时沿用原来的 0/1 行动成本语义。

为每个角色、技能和使用场景调用 `createUsageLimits(action.usageLimits)` 创建独立实例。不要把模板本身当作所有角色的运行状态。

```ts
let limits = createUsageLimits(action.usageLimits);
limits.cost.mp = 2;
const result = resolveSkillUse(
  skill, 'battle', caster, targets, true, effectSets, random, limits,
);
limits = result.usageLimits; // 与 caster、targets 一起提交
limits = advanceUsageCooldown(limits); // 在你规定的时机执行
limits = restoreUsageCount(limits);    // 在你规定的恢复时机执行
```

`resolveSkillUse` 的最后一个参数是当前限制实例，未传时从技能模板计算一次。持续战斗必须保存并传回结果，仓库演示已按技能和场景保存。成功发动才返回已扣次数、已进入冷却的新实例；失败不修改输入。新设置的冷却不会因为本次使用的行动消耗自动减少；额外行动也不自动推进冷却。冷却递减边界、次数的恢复周期及双方场景是否共享限制均由调用方决定。本模块不推进 Press Turn 流程。
