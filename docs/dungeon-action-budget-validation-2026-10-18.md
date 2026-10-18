# 动作预算与可检查的故障暂停

旧实现将合法工作量超过128次边界也视为错误，SystemRunner因此停止整个Lab。现在保留128作为单次工作预算，执行完整边界及同步规则后让出，不抛错。tick返回 consumedSeconds、remainingSeconds、boundaries、yielded、paused，余量自动存入现有共享 dungeon.spatial-actions.timing.pendingSeconds；下次只传入新帧时间，不能再次把remainingSeconds加入。tick(0)只排积压。预算可通过第四参数maxBoundaries指定。暂停时不接收新的墙钟时间；地图切换的新会话和安全存档恢复不继承积压/故障。

独立动作轨道连续两次到达同一边界却未更新或结束，才记录no-progress诊断；另覆盖数值精度导致时间与动作状态均无法前进。诊断包含reason、repeatedBoundaryCount、对象/动作ID、状态、elapsedSeconds、boundarySeconds和remainingSeconds。普通移动镜像track不是独立时钟；合法碰撞等待允许时间经过，不误报无进展。检查通过同步投影之后进行，避免将尚未执行的规则当成卡死。

Loader显示积压提示。发生真实无进展时仅暂停地牢assembly，保留画面、相机和Debug/共享内存面板；显示诊断并提供“重新加载当前地图”。重载成功提交新会话时释放故障暂停令牌，失败则保留现场。没有提高原阈值，也没有在未完成占位事务中让出。未知异常的SystemRunner策略没有在此改动中放宽。

验证结果：

- 空间58/58：120秒合法连续移动逐帧排空且时间/规则不丢失；极小预算结果与一次执行一致；新帧时间只加入一次；暂停不累积墙钟；推动/换位的原子占位与完成规则不被分帧拆开；真实卡住轨道及到期零时长轨道诊断；镜像移动与正常等待不误报；安全恢复清除诊断和积压。
- 共享内存55/55、普通移动7/7、后台时钟3/3、地图Loader/预热5/5通过；空间专项类型检查通过。
- 真实Agent Lab的createLab帧回调：140个正常独立轨道触发预算让出，显示积压并在下一帧排空；随后注入不推进的轨道，确认诊断可见、仅assembly暂停、后续帧继续渲染，点击重载后恢复；原推动、换位、占位、朝向、Debug模型及后台恢复回归同页通过。errors=[]、writes=[]，报告actionBudget全部为true。

命令：npm run test:dungeon-spatial、npm run test:lab-memory、npm run test:dungeon-movement、npm run test:lab-clock、npm run test:scene-warmup。复用已有Vite后，node codex-tools/runElectronVerification.mjs codex-tools/verifyAgentInteractionRuntime.cjs。

输出在node_modules/.cache/action-budget-tests.log、action-budget-memory-tests.log、action-budget-movement-tests.log、action-budget-loader-tests.log、action-budget-types.log和agent-interaction-runtime-verification.json/png。
