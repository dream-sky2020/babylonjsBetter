# 换位速度与发起者移动速度一致

换位原来固定使用 0.25 秒，并对双方的中心位移使用缓动。快速移动的一方可能被固定耗时拖慢，慢速移动的一方则可能在换位中突然加速。3D 的轻微错身还会让呈现姿态比中心位移走得更远。

现在玩家尝试换位时，沿用普通移动的计时模式。世界单位/秒模式默认计算双方含正弦错身的完整视觉路径弧长，再按发起者的移动速度逐段等速推进。玩家设为每秒 10 世界单位时，换位视觉也以约每秒 10 世界单位移动，而非仅让瞬时峰值达到 10。秒/格模式直接让换位用一格的配置耗时，不计算错身附加距离；视觉错身照常显示。

玩家移动面板增加“换位计时忽略轻微错身距离”开关。世界速度模式勾选后，以两个格心间的距离和发起者速度计时；因此视觉错身可暂时快于格心移动，这是明确选择忽略该距离的结果。秒/格模式本来就忽略它，开关不改变结果。面板的“换位最短耗时”默认0，即自动按速度或秒/格配置计时；手动填写更长时长才放慢。实际时长返回给玩家连续输入。

取消进行中的换位时，双方从当前连续姿态回到原锚点。按当前是否计入错身距离的设置计算回退耗时。空间动作仍使用现有 dungeon.spatial-actions 组数据，完成时原子提交；对墙、第三方物体及预约的检查不变。独立调用 `requestSwap(actorId, otherId, minimumDuration, secondsPerTile, includePresentationDistance)` 时，第四参数是发起者普通移动一格的耗时，省略时使用0.6秒；第五参数默认为 true。

验证：空间测试43/43，包括两种玩家计时模式、世界X/Z不同格距、双方逐帧速度、忽略错身距离开关、取消回退及原子提交。玩家移动测试25/25、空间专项类型检查及空间动作Lab构建通过；全项目类型检查仍是与原有基线一致的175条诊断，无新增。真实 Agent Lab 将玩家设为每秒10世界单位，默认换位实际耗时约0.83秒，双方观测最小与最大速度均约10；开启忽略开关后实际耗时0.8秒，符合格心距离。推动仍以每秒60世界单位验证。浏览器错误和预设写入均为零；构建版WebGL推动、换位与窄道换位回归通过。

运行 `npm run test:dungeon-spatial`、`npm run typecheck:dungeon-spatial`、`npm run test:dungeon-player-movement`。真实 Lab 在现有 Vite 服务上运行 `node codex-tools/runElectronVerification.mjs codex-tools/verifyAgentInteractionRuntime.cjs`；构建后的图形回归运行 `node codex-tools/runElectronVerification.mjs codex-tools/verifySpatialActions.cjs`。
