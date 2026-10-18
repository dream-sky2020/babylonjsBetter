# 目标组件决定默认碰撞响应

## 当前行为

玩家只提交移动，目标 spatial-interaction.onPlayerPush 决定响应：block 阻挡、swap 换位、push 推动。无需交互按键；已删除之前的 Ctrl/Shift 解析、额外交互意图参数及按键选择模式。

两个正式地图现有 Agent（长廊4个、广场10个）均保留唯一启用组件并设为 swap。新建 Agent 的默认组件列表包含空间交互，单个/批量创建走同一工厂，默认响应为 swap，Body 为 movable。通用组件自身默认 block；未添加或禁用时仍阻挡。

本次批量配置仅修改14个 Agent 的响应，程序反向还原该字段后核对其余 JSON 数据一致。其他实体的推动/阻挡/换位配置保留。既有 pushable、Collider、身份、名称、飞行规则及 AI 参数保持当前值，包括之前已调整为阻挡碰撞的 wisp。未修改运行存档。

## 执行规则

- Core 直接读取目标响应，绝对/相对/连续移动共用同一动作执行器。
- 原受阻拦截优先级、原子占位提交、视觉轨迹、动画推进与同步格步顺序保留。
- 推动需要 movable + pushable，换位需要 movable。墙、边界、被占落点、轨迹空间不足或动作忙碌时仍受阻，不自动切换动作。
- 仍限制为四个正方向；不是任意方向的刚体物理求解。

## 验证

- 空间测试32/32：自动推动/换位、缺失/禁用/阻挡、空间失败不回退、历史/Delta/紧凑存储、预约/连续轨迹/原子提交等。
- 玩家移动及 Lab 装配回归25/25：原移动、相对移动、同步事件和连续输入；Lab 按钮无需修饰键，改变目标响应即可在推动与阻挡之间切换。
- `npm run typecheck:dungeon-spatial` 通过。
- `npm run build:dungeon-map-lab` 通过。
- Electron 逐一核对14个 Agent 默认换位、三项响应选项、可移动及阻挡碰撞；新建 Agent 自动带换位配置。浏览不变脏，errors=[]、writes=[]。报告：node_modules/.cache/agent-interaction-editor-verification.json。
- 全项目类型诊断仍为175条，与此前去除行列号比较无新增。

一次性配置脚本已清理。测试入口和复现方式见 codex-tools/README.md。

## 真实 Agent Lab 的图形同步修复

之前的配置编辑器验证和 Core 测试不足以证明真实 Lab 的画面正确。此次真实装配复现：广场 friendly-guard 从 (5,6) 换到 (4,6)，共享 Body/worldPosition 已正确变化，但 dungeon_agent_debug 图形节点仍在原位置。原因是 Agent 帧投影只刷新其自身动作的 active/changed 列表，被玩家的协同动作移动的静止 Agent 不在该列表中。

修复：Agent Lab 逐片读取共享动作组中的运行成员，并保留上一片的成员 ID，确保完成或取消后的最后姿态也投影；切图清空派生 ID 集合。未创建第二份位置或动作权威状态。Core 返回推动/换位的拒绝详情，Lab 展示目标忙碌、轨迹碰撞或预约冲突等原因，受阻回弹结束后保留提示。未放宽墙、碰撞或动作忙碌规则。

新增真实 Electron 回归：`node codex-tools/runElectronVerification.mjs codex-tools/verifyAgentInteractionRuntime.cjs`。页面复用 dungeon-agent-lab 的同一模块组合、两张正式地图及真实玩家按钮；检查14个 Agent 运行时配置，AI 开启时默认换位、相对移动推动、普通阻挡、目标忙碌提示，以及动作中10个采样点和完成后的玩家/Agent 图形节点与共享位置一致。推动响应只在验证会话内临时设置，不改正式预设。报告为 node_modules/.cache/agent-interaction-runtime-verification.json，浏览器错误及 HTTP 写请求均使验证失败。

本次结果：真实 Lab 验证通过，errors=[]、writes=[]；空间32/32、玩家移动25/25、空间专项类型检查通过。全项目类型诊断175条，去除行列号后与修改前一致，无新增。
