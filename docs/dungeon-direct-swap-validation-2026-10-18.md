# 相邻直线换位验证

替代旧的0.8格侧移、三段折线路径与50%提交。双方物理姿态沿起终点直线使用 smoothstep 推进，默认独立0.25秒；玩家移动面板可调整换位时长。保持目标朝向，玩家继续遵守绝对/相对移动的原朝向规则。

表现层最多偏移0.12格，按 sin(π·推进进度) 在交会时错身。偏移只用于 worldPosition/Agent 标记投影，Body.pose、碰撞索引和格子占位不使用它；engine.swapPresentationOffset=0 可得到2D直接交叉。附近静态几何或边界不允许时依次减到0.06、0，合法换位不会因表现通道不够而被拒绝。仍使用保守碰撞体校验表现空间，没有骨骼侧身或转身动画。

双方必须启用、可移动、正交相邻且空闲；玩家自动触发仍要求目标启用 swap 响应并阻挡移动。正反两个逻辑格步均检查墙体、地形和第三方；沿直线做连续第三方扫掠。仅组内两者互相忽略碰撞，不修改 Collider 的 response。两个格子受组预约保护。完成前占位不变；结束时双方原子提交，再触发一次玩家格步规则。途中取消连续回到原锚点并清除表现偏移；完成后的事实保留。存档只保存已提交位置，不序列化表现偏移。推动的接触、分段时序和50%提交保留。

验证入口：

- `npm run test:dungeon-spatial`：直线姿态、小幅表现、完成提交、单格窄道、贴墙零偏移、2D零偏移、墙体禁止、第三方预约与动态阻断、打断恢复、途中安全存档，以及推动和同步规则回归。
- `npm run test:dungeon-player-movement`：25项玩家输入、移动与真实 Lab 模块装配回归。
- `npm run typecheck:dungeon-spatial`：专项类型检查。
- `npm run build:spatial-actions`，再运行 `node codex-tools/runElectronVerification.mjs codex-tools/verifySpatialActions.cjs`：构建产物 WebGL 验证推动、完成换位和单格窄道换位。
- 复用现有 Vite，运行 `node codex-tools/runElectronVerification.mjs codex-tools/verifyAgentInteractionRuntime.cjs`：真实 Agent Lab 的14个运行时配置、AI开启时换位、相对移动推动、阻挡和目标忙碌说明；10个采样点检查真实玩家/Agent图形节点、物理直线、最多0.12格错身及结束前不提交。HTTP写请求被拦截，正式地图与存档不写入。

输出：node_modules/.cache/direct-swap-tests.log、direct-swap-build.log、direct-swap-types.log，以及 agent-interaction-runtime-verification.json/png、spatial-actions-verification.json/png。真实 Lab 和构建版验证通过，errors=[]，真实 Lab writes=[]；专项类型检查通过，玩家25/25。全项目类型诊断仍175条，去除行列号后与此前一致，无新增。
