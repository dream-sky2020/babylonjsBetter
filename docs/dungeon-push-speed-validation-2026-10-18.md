# 推动速度上限修复

旧推动把走一格的总耗时分为20%接近、60%推动、20%回收，物体一格位移挤在60%时间内，速度约为普通移动的1.67倍；玩家还会超过终点再返回。

现在 requestPush 的第三参数明确为普通移动一格的耗时。按每个阶段所有参与者的最大移动距离分配时间，整段耗时是“接触间隙距离 + 一格距离”除以普通移动速度。接近后双方同速向前；玩家到目标格心停下，物体在同一速度上限内补齐剩余位移，不再让玩家越过格心后回收。例如格距8、速度60、间隙0.5格时，推动总耗时0.2秒，接近、共同推进、物体完成各约0.0667秒，双方瞬时速度上限仍为60。

取消前后都保留当前连续姿态，恢复阶段重新按同一速度上限计算时间；不再固定0.25秒快速拉回。推动仍在整段50%原子提交占位，接触事件在接触姿态投影后发出，完成事件/同步格步/扫掠阻挡与预约保留。换位的独立0.25秒计时不变。GroupResult.durationSeconds 及玩家 actionDurationSeconds 返回实际整段耗时，供 Lab 连续输入使用。运行数据仍位于既有共享动作组，没有新建第二份玩家状态。此次未实现重量、推动力或多对象推动。

验证结果：

- 空间回归40/40：36组方向/碰撞间隙/耗时组合逐样本检查世界空间瞬时速度，玩家不超过终点；另覆盖世界单位/秒、秒/格自动推动，以及提交前后取消恢复的速度上限。
- 玩家移动及 Lab 模块装配25/25通过；专项 `npm run typecheck:dungeon-spatial` 通过。
- 真实 Agent Lab：相对移动推动60个采样点，玩家/物体峰值约60、普通移动上限60；实际耗时0.2秒，零浏览器错误、零HTTP写请求。换位、阻挡、忙碌说明及minimal-city推动地图回归通过。
- 空间动作 Lab 构建通过，构建产物 Electron WebGL 推动、换位和窄道换位通过。验证等待按更长推动耗时更新。
- 全项目类型检查仍175条既有诊断，去除行列号后与此前一致，无新增。

复现：`npm run test:dungeon-spatial`、`npm run test:dungeon-player-movement`；复用现有 Vite 后用 `node codex-tools/runElectronVerification.mjs codex-tools/verifyAgentInteractionRuntime.cjs`。构建版为 `npm run build:spatial-actions` 后同 launcher 执行 `codex-tools/verifySpatialActions.cjs`。结果见 node_modules/.cache/push-speed-tests.log、push-speed-build.log、push-speed-types.log、agent-interaction-runtime-verification.json 和 spatial-actions-verification.json。
