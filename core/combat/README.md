# Combat Core

`core/combat/` 保存与 UI、渲染器和具体游戏世界观无关的战斗数据定义与纯计算。

- `attributes.ts`：稳定属性 ID、通用名称、分组、单位和解释。概率在当前整备示例中以百分数值显示；尚未统一战斗结算的存储区间。
- `calculateAttributes.ts`：保留原有静态数值加成接口。
- `modifiers.ts`：按基础值变更、成长、固定加值、第一加乘、第二加乘、逐条独立乘区结算属性；比例用小数存储，例如 `0.1` 表示 +10%。输入不变，成长函数由游戏传入。
- `index.ts`：公共入口。

装备物品、附魔、技能等级和使用后损耗在 `core/items/`。整备 Lab 的角色初始值和显示格式保留在 `labs/draggable/equipment-lab/sampleAttributes.ts`，避免把示例数值和界面约定写入 Core。Press Turn 与 Clash 的行动规则目前仍在各自 Lab。
