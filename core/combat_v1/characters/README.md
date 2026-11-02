# 角色数据

`character.ts` 的 `CombatCharacter` 是 v1 的角色运行数据定义，`CharacterDefinition` 是创建输入，`createCombatCharacter` 深拷贝输入创建独立实例。

- `id` / `name`：战斗实例标识和名称；调用方保证 ID 在战斗中唯一。
- `faction`：`ally` 我方、`enemy` 敌人、`neutral` 中立。敌人与中立同属非我方行动阶段，不表示它们彼此结盟。
- `stats`：现有 `CharacterStats` 全属性，包括当前 HP/MP/SP 与上限；不在角色顶层重复保存资源。
- `statuses`：沿用当前效果结算的状态 ID → 剩余回合数表示。
- `actionDefinition`：正常行动配置，默认每个角色回合 1 次；Boss 可配置多次。
- `actions`：剩余正常/额外行动。创建时均为 0，由 `battleFlow` 在进入所属阶段时直接分配，不再定义独立行动类型。
- `skills`：技能 ID、等级、启用状态，以及按 battle/field 分开的可变使用限制。
- `equipment`：装备位置 → 物品单元。

`stats` 是当前属性快照；基础成长和装备修正的来源及重算时机仍由调用方管理。现有效果函数使用扁平的 `EffectTargetState`，本次未自动适配该接口，也未迁移 Lab 的角色数据。

已有的 `labs/data/equipment.ts` 中 `Actor` 是整备示例，`labs/draggable/press-turn-lab/types.ts` 中 `Unit` 是旧 Press Turn 实验定义，继续保留，不影响用户后续手写战斗流程。

## 两阶段回合

`../turns/turnPhase.ts` 定义 `TurnPhaseState`：`round` 从 1 开始，`phase` 在 `ally`（我方回合）与 `nonAlly`（非我方回合）间切换。

`createTurnPhase()` 从我方开始；我方结束后调用 `advanceTurnPhase()` 进入非我方，非我方结束后再调用进入下一轮我方阶段。敌人和中立单位都在非我方阶段，内部顺序、可行动判定和主动结束规则由用户编写。

阶段切换不自动刷新角色行动、推进冷却或状态时长。阶段（我方/非我方）、角色的行动机会和单次行动是不同概念，避免额外行动意外触发冷却递减。
