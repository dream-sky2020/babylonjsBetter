# 怪物视觉组合模块

`monsterLabModuleCatalog` 与 Dungeon catalog 独立。声明 `monster-visual-debug` 时，怪物依赖链只展开四个模块：

- `monster-visual-libraries`：加载外观、两级条纹、移动、攻击、死亡预设；开发 API 不可用时使用统一打包配置。重新读取采用代次保护并保留失败前的库。
- `monster-battlefield`：持有当前怪物实例和行列布局，处理增删／替换／显示参数覆盖／移动目标命令。校验成功后提交同一共享句柄；存档版本 1。
- `monster-visual`：在 Host 的同一个 Scene 中创建一个 MonsterVisualManager；唯一 presentation / 200 任务推进表现。默认隐藏管理器自带的布局辅助对象，不安装地牢格子、玩家、AI、通行或逻辑移动系统。
- `monster-visual-debug`：测试控件、选择、包围盒与暂停；通过协议调用模块，不访问其他模块私有 DOM。当前实例的显示覆盖与外观预设分开存放，不改写配置库。

测试页面 `labs/composable/monster-visual-lab/` 直接合并既有 Dungeon catalog，并额外声明 `dungeon-config`。依赖自动补齐 `dungeon-libraries` 与 `dungeon-map-loader`，复用其他组合式 Lab 的地图选择／场景加载功能；合计七项模块。没有新增场景实现，也不装配玩家、AI、格子 Debug、通行或逻辑移动模块。地图按原有组件加载场景；怪物仍使用独立的测试战场布局，切图不重建怪物实例。

三块共享内存：`monster.visual-libraries`、`monster.battlefield`、`monster.visual-settings`。所有模块导入同一 `.memory.ts` 定义；没有镜像 Store、逐帧请求或状态轮询。管理器、Mesh、材质及可重建的显示配置缓存属于视觉模块，不进入存档。战场和测试设置通过 LabState 保存；恢复会停止旧动作并按当前布局重建，暂不保存动画中间进度。

命令／事件统一从 `monsterVisual.protocol.ts` 导入：

```ts
await context.communication.request(monsterBattlefieldCommand, {
  kind: 'add', configKey: 'monster_default_1',
});
await context.communication.request(monsterVisualCommand, {
  kind: 'attack', monsterId, presetKey: 'forward_lunge',
});
```

移动通过 `monsterBattlefieldCommand` 的 `move` 提交目标行列及移动预设；视觉模块从旧姿态插值到目标。这里测试的是表现，不做战斗占位、碰撞、寻路或伤害判定。`patch` 直接应用布局。实例 ID 必须唯一；同一外观可供多个实例使用。

同一个怪物的测试动作互相替换，不同怪物可同时播放。`monster.visual.action-changed` 带 actionId、monsterId、kind 与 started/completed/cancelled；重置、替换和销毁会取消未完成动作。已提交战场事件带递增 generation，视觉模块拒绝过期事件。Host 模拟暂停和怪物局部暂停都会冻结管理器，相机仍可操作。

原 `labs/standalone/monster-3d-visual-lab/` 保留，继续负责图层素材、条纹和正式配置编辑／保存。新测试页不扫描整个素材目录、不保存服务器预设。特殊状态、感叹号、跳字和其他覆盖层尚未在此页装配；它们可继续使用原独立 Lab，后续接入相应模块。

验证：`npm run test:monster-visual`、`npm run test:monster-visual-webgl`（复用 127.0.0.1:1184 的开发服务）、`npm run build:monster-visual`、`npm run test:lab-entries`。专项构建不复制 public；真实图形验证拒绝所有写请求，报告和截图位于 `node_modules/.cache/monster-visual-verification.*`。`tsconfig.monster-visual.json` 可检查本入口依赖；目前会报告既有的 MonsterVisualManager 感叹号可选字段与 exclamationMarkRepository 类型错误，新模块无对应诊断。
