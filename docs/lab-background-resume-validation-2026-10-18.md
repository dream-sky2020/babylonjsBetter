# 组合式 Lab 后台恢复修复

后续更新：128次已改为可让出工作预算，不再抛错停机。后台时钟策略仍保留；相关测试现验证后台时间不会形成积压，新的预算、诊断及恢复验证见 dungeon-action-budget-validation-2026-10-18.md。下文保留首次定位背景。

用户复现条件：长期离开页面后重新打开。createLab 原来直接将 engine.getDeltaTime()/1000 交给 SystemRunner；浏览器后台节流或休眠后，这个值可能包含整个停留间隔。DungeonActionEngine 为保持格步完成规则与续步顺序，会在一帧内逐个处理动作边界。连续移动和 AI 决策补跑超过128个边界后抛错，SystemRunner 将任务标为失败并停止模拟，外层显示 dungeon-map-loader/spatial-actions (simulation)。这条异常与 runtime.lastError 消息通道报错不是同一条异常链。

修复在 Lab 宿主时钟层：隐藏时不执行帧循环；visibilitychange、pagehide、pageshow 重置恢复状态，恢复首帧仅使用0秒，后续正常帧按真实前台间隔推进。没有收到可见性事件、但间隔超过1秒时视为浏览器/系统暂停，同样不补跑该间隔。这是明确的 Lab 前台模拟策略，不是修改 Core 的动作推进算法或提高128次上限。手动调度暂停保持原行为。销毁和初始化回滚移除事件监听器。已因旧异常停止的 Lab 需要刷新页面后恢复。

验证：

- `npm run test:lab-clock`：3/3。真实普通格步连续续步的 tick(120) 复现相同128次错误；接入新时钟后隐藏时间不推进、恢复不补跑、后续帧继续。另覆盖可见性重置及无事件休眠。
- `npm run test:dungeon-spatial`：50/50；`npm run typecheck:dungeon-spatial` 通过。
- `npm run test:lab-performance`：原调度/性能统计回归通过。
- `node codex-tools/runElectronVerification.mjs codex-tools/verifyAgentInteractionRuntime.cjs`：真实模块装配与 createLab 帧回调通过。执行玩家普通移动，注入隐藏一小时、恢复首帧与无事件两小时休眠；请求 elapsed 保持，后续16ms准确继续，无模拟任务失败。原有占位、朝向、推动、换位、接管及 Debug 模型验证同页通过，errors=[]、writes=[]。
- 全项目类型诊断175条，与既有 swap-timing-types.log 去除行列号后比较一致，无新增。

报告：node_modules/.cache/agent-interaction-runtime-verification.json 的 backgroundResume 字段；其余结果在 background-resume-spatial-tests.log、background-resume-performance-tests.log、background-resume-types.log。
