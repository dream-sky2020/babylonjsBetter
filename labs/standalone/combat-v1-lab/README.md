# Combat v1 · XP 战斗实验室

入口：`/labs/standalone/combat-v1-lab/index.html`，根首页普通 Lab 分组亦可进入。纯 HTML/CSS/TypeScript，使用本地样例数据，无外部素材或服务器存档。

1. 选择我方角色与目标，使用普通攻击、火焰冲击、治疗或振奋。
2. 正常行动优先消耗，随后消耗额外行动；振奋不消耗行动，每场一次。
3. 点击“结束我方回合”可放弃剩余行动，进入非我方阶段。
4. 点击“非我方单步”，依次执行 Boss 的两次攻击、史莱姆攻击和中立旅人自疗。全部行动完成后再点一次进入下一轮。
5. 角色倒下后不能行动；中立单位不影响胜负。战斗结束后可点“新战斗”重开。

Core 提供 battleState、battleFlow、角色与技能限制、resolveSkillUse 和来源记录类型。`model.ts` 只持有本 Lab 的技能数值、目标阵营规则、角色与旧效果接口适配、扣行动、非我方决策及记录生成；不导入旧 Press Turn。当前示例是固定伤害，无防御、暴击或护盾，记录按实际扣血与过量部分拆分。治疗按实际恢复/过量拆分。

本 Lab 的冷却规则：进入角色所属阶段时减少 1，额外行动不减少。使用次数每场战斗独立；重开恢复。非我方在固定顺序下单步执行，旅人资源或次数不足则放弃行动。状态、样例人物、技能与日志仅保留在页面内存。

验证：`npm run test:combat-v1`、`npm run typecheck:combat-v1`、`npm run build:combat-v1`。真实页面检查：构建后执行 `node codex-tools/runElectronVerification.mjs codex-tools/verifyCombatV1Lab.cjs`，验证构建产物的按钮、技能限制、非我方阶段、治疗、重置及窄屏布局；报告与截图保存在 `node_modules/.cache/combat-v1-lab.json` / `.png`。
