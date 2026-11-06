# 地牢统一交互

入口：`labs/composable/dungeon-interaction-lab/index.html`。独立配置：`config/labs/dungeon-interaction-lab.json`。原 Agent Lab 的地图与参数不改写。

## 测试场景

1. 启动站在蓝格 (1,2)，面向南边橙色向导，按 E 对话；Esc 或“结束对话”关闭。
2. 原地转向后按 E 调查脚下蓝格 (1,2)，结束后可以再次按 E 调查。它的 once 关闭。
3. 向西走到新增蓝格 (0,2)，按 E 只调查一次。它的 once 开启；在同一张地图里走开再回来不会重置，离开地图再返回才重置。两格有各自的说明对白。
4. 向东经过出生格，到黄格 (2,2)，格步完成后自动对白，同格出口不会同时传送。
5. 关闭对白后按 E 传送到另一张地图；再按 E 返回。出生/入口放置不算 enter，不循环触发。

地图编辑器可以选择 `dungeon_interaction_test` / `dungeon_interaction_room` 编辑。

## 交互实体 Debug

“地牢交互”面板的“显示交互实体 Debug”控制自动轮廓与标签。参数为 dungeon-interaction.debug-entities，通用默认关闭，本测试 Lab 配置显式开启；保存参数不触发交互或重载地图。

| 颜色 | 含义 |
| --- | --- |
| 蓝色 | 按键对话 |
| 橙色 | 进入时对话 |
| 紫色 | 地图传送 |
| 灰色 | 已禁用，或一次性对话本次已启动 |

格子挂载显示低矮半透明轮廓，边挂载显示窄条。标签包含名称、按键/进入方式和可重复/仅一次/已触发；完整说明也显示在面板摘要中。同格对话与出口的标签分层。NPC 标记跟随当前空间表现位置，并与俯视显示变形保持一致。

Debug 只读描述，不参与碰撞、拾取或触发。关闭时移除标记并停止读取描述；切图/卸载释放旧 Mesh、材质和纹理。原先手工放置的三块彩色地面已删除，现在位置提示来自实际交互数据。其他模块的“全部格子 Debug”和“入口/出口 Debug”仍由各自开关控制。

## 数据

地图仍为磁盘 V3 / Runtime V2，原 `event` 升级为组件 v2。NPC 沿用 dungeon-agent，附加 event；无碰撞调查点使用新实体 interaction-point，其位置由 spatial-attachment 描述，添加时自带 event。

```json
{
  "id": "guide:event", "entityId": "guide", "type": "event", "version": 2,
  "trigger": "interact", "targetRule": "front", "priority": 10,
  "action": { "type": "dialogue", "presetKey": "dialogue_test", "entryNodeId": "greeting" }
}
```

- trigger 为 interact 或 enter，targetRule 为 front 或 self；enter 必须为 self，当前仅支持格子进入。front 可匹配面前一格或面前的边。
- action 仅保存对话与入口引用。可选 uiPresetKey 覆盖 UI，否则使用 Lab 对话模块的 UI 配置。
- priority 为整数，越大越优先；同优先级前方先于脚下。最高候选仍并列时明确报错，执行零个动作。
- once 只在当前地图 Session 记录。成功启动后消耗；加载失败/启动中取消不消耗；重新进入地图重置，不写入永久存档。
- 旧 v1 事件读取时无损升级为 legacy，保留 actionId、payload 和未知字段，不自动执行未知业务。

编辑器自动显示新实体和字段，允许逐步填写并保存未完成引用。运行准备阶段严格检查必填项、位置规则、对话入口与可选 UI 引用，失败不提交候选地图。Python 校验保存结构并允许草稿。

## 职责

core/dungeon-interaction 不依赖 DOM/Lab：Router 仲裁，Control 查询当前空间，validation 检查可执行声明。动态目标使用空间权威位置，移动/转向中或禁用的目标不参与，其他墙体阻挡前方查询。Loader 通过 dungeon:interaction-control 提供当前 Session 查询，不向共享内存暴露 Runtime。

dungeon-interaction 是唯一按键/完成格步 order 100/受阻尝试入口。每次实际格步只派发一次 enter，命中后停止连续续步与本次后续格步规则。运行读取 dungeon-interaction.enabled/key 配置；面板只改配置并发送测试请求。

dungeon-dialogue-interaction 适配模块调用 LAB_DIALOGUE，仅需要对话的 Lab 安装。切图/卸载取消本适配器启动的旧对白；忙碌期间禁止重复交互。对话锁住玩家输入，不主动暂停 NPC 模拟。

dungeon-transition 登记出口候选，继续拥有传送校验、输入锁和切图流程。目标地图、入口和三种 triggers 仍只保存在 dungeon-exit，未复制到 event。出口 priority 0，格子 rank 1、边 rank 0；旧多出口冲突检查保留。其运行开关也改为读取 LabConfig，交互键由统一模块设置。

保存 Lab 配置不执行交互或重新加载。生产沿用打包配置读取，无需 Python。测试构建仍含 Lab 工作台，发行包裁剪编辑器属于独立工作。目前未增加任务条件、剧情事件、宝箱/道具执行器或永久进度。

## 验证

- npm run test:dungeon-interaction：空间位置、遮挡、兼容、草稿、仲裁、互斥与原传送回归。
- Python 目录执行 python -m unittest test_dungeon_interactions：临时目录保存/读取与错误拒绝。
- npm run typecheck:lab-settings。
- npm run build:dungeon-interaction 后 npm run test:dungeon-interaction-webgl：隐藏 Electron 直接打开 file://，禁网络，验证 NPC/地块/传送、两个蓝格的重复/单次调查、切图重置和清理。
- 报告/截图：node_modules/.cache/dungeon-interaction.json / dungeon-interaction.png。
