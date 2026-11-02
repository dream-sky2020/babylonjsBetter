# Combat v1

第一版战斗逻辑和数据定义，合并原 `core/combat/` 与 `core/items/`。本次迁移保持既有计算行为，不新增回合流程或被动触发规则。

后续新增的简易流程位于 `battleState.ts` 与 `battleFlow.ts`，与原 Lab 流程独立，使用方式见下方。

- `attributes/`：角色属性目录、静态加成和分阶段属性修正。
- `turns/`：我方与非我方两阶段、轮数和显式阶段切换，敌人与中立单位同属非我方阶段。
- `characters/`：统一的角色实例数据，包含阵营、属性、状态、行动、技能限制和装备；见 [角色说明](./characters/README.md)。
- `records/`：带来源、角色和用户归属的伤害/治疗最终结算记录；见 [记录说明](./records/README.md)。
- `items/`：物品与装备类型、库存、附魔、耐久和概率损耗。
- `skills/`：装备授予技能、有效技能等级、主动技能使用与分类。
- `effects/`：物品和技能共享的目标、效果、资源与状态结算，以及背包/仓库使用和补给规则。
- `index.ts`：统一公共入口；也可直接从各子目录导入。
- `battleState.ts`：参战角色、轮数、阶段、结果与结算记录，以及状态创建和记录提交。
- `battleFlow.ts`：开始战斗、查询可行动角色、结束阶段和胜负检查。

这些模块只处理数据，不依赖 UI、Babylon.js 或平台 API。样例角色、技能和装备目录仍归 `labs/data/`，界面和演示会话状态仍归各 Lab。

整备与仓库 Lab 已使用这里的规则。Press Turn 与 Clash 的行动、伤害和回合流程仍在各自 Lab，尚未迁入此模块；Press Turn 的后续战斗逻辑由用户手写。

`v1` 表示本套规则体系；常规修订继续在此维护，需要并存不兼容的规则体系时再另建版本。

## 简易战斗流程

```ts
let battle = createBattleState('battle-001', characters);
battle = startBattle(battle); // 第 1 轮我方阶段；仅分配我方行动
const actors = getPhaseActors(battle);
// 自行执行技能：更新角色数据、扣行动、提交本次伤害/治疗记录。
battle = appendBattleRecords(battle, records);
battle = checkBattleResult(battle); // 每次完整行动提交后检查胜负
if (battle.status === 'active') {
  battle = endBattlePhase(battle); // 本阶段行动耗尽后进入非我方阶段
}
```

上述标识和角色/记录由调用方提供。所有公开写入函数返回独立的新状态，不修改输入；请保存返回值。记录提交只记账，不应用生命变化，必须与自己的行动结算结果一并提交。不能通过日志再次执行伤害。

开始战斗先检查胜负，再分配当前阶段可行动角色的正常行动，额外行动为 0；不恢复生命、冷却或技能次数。默认可行动条件为生命大于 0。阶段结束会清空旧行动余额，为新阶段角色分配行动；额外行动不跨阶段保留。非我方包含 enemy 与 neutral，仍由调用方选择其内部行动顺序。

`endBattlePhase(battle, { endEarly: true })` 可主动放弃当前阶段的剩余行动。空阶段可直接结束，但不会自动跳过或循环推进。函数不自动选择行动、不执行技能、不推进冷却或状态时长。

`BattleFlowRules` 可注入 `canAct` 与 `evaluateResult`。默认歼灭规则：我方无存活角色则失败，敌人无存活角色则胜利，双方均无存活角色则平局，中立单位不影响胜负。剧情战斗可替换判定；请对开始、查询、检查与阶段切换传入同一组规则，回调应只读且无副作用。`finishBattle` 可显式提交逃跑或其他结果。战斗结束后不能再切换阶段、发放行动或追加记录。

现有角色 `stats` 与旧效果接口的适配、行动执行和记录生成仍需调用方实现；本流程尚未接入 Press Turn。`npm run test:combat-v1` 覆盖状态与阶段流程。

验证入口：`npm run test:equipment`、`npm run test:warehouse`、`npm run typecheck:equipment`、`npm run typecheck:warehouse`。

## 行动数据

角色直接使用内联对象 actions: { normal: number; extra: number } 保存剩余正常/额外行动，不再提供独立 actions 模块或 ActionBudget 类型。actionDefinition: { normalActionsPerTurn: number } 也直接内联，默认 1，Boss 可配置多次。battleFlow 进入阶段时分配正常行动并将额外行动清零；次数须为非负安全整数。技能或特殊机制直接修改角色字段，扣减及额外行动获取条件由调用方控制。

独立 XP 示例位于 labs/standalone/combat-v1-lab/，提供攻击、治疗、振奋、非我方单步、阶段切换与来源记录，复用本模块的状态、流程和技能结算。
