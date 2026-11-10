# 地牢统一交互

入口：`labs/composable/dungeon-interaction-lab/index.html`。独立配置：`config/labs/dungeon-interaction-lab.json`。原 Agent Lab 的地图与参数不改写。

## 触发服务

交互事件的「执行动作」选择「触发服务」，填写指令 ID 和 JSON 参数，支持主动交互或进入。主测试场 (7,7) 和 (9,7) 上按 E，分别以 `{"entityId":"room-contact-barrier","active":false}` 和 `{"entityId":"room-contact-barrier","active":true}` 调用 `obstacle.set-active`。可以开启「地牢阻碍」的静态阻碍 Debug，或走进 (7,4) 验证通行状态。

业务模块在 setup 使用 `context.services.set(token, service, actions)` 发布已有服务及其地图操作。操作校验参数，返回布尔结果；交互命中后通过 `invokeAction` 传入地图会话、发起者和交互来源。成功后显示可选提示并消耗一次性规则。失败由交互面板显示，临时调用及其结果可在「Lab 服务诊断 → 打开服务调用记录」查询。

专用的消息、视觉状态与对话动作通过 `invoke` 调用对应模块的现有接口，地图出口沿用切换请求。对话和传送适配器管理各自的候选与会话流程。

## 触发与动作执行

主动交互和空间触发各自接入原路由，由路由处理优先级和受阻接管。地图动作由 `dungeon-map-action-executor` 解释。地图实体的「变量变化触发」选择一个共享变量、条件和动作；条件刚成立时触发，初始化和切图只绑定规则。执行器仅在变量确实改变后发布通知，同一变化链中的同一规则只执行一次。

主测试场的计数踏板从 (12,8) 进入三次后解除 (7,4) 的石障。计数从 3 变为 4 时不重复触发。变量条件只处理后续的值变化；当前门的状态仍由障碍服务和地图运行态保存。

## 共享变量

在地图编辑器选中地图实体，添加「共享变量」，填写变量 ID、类型、初始值和作用域。每条声明对应共享内存数据表中的一个标量。交互事件选「修改共享变量」，从本地图的声明中选择目标。整数支持加减，布尔值支持翻转，所有类型都支持设置或重置。主测试场 (12,8) 每次从相邻格走入时把「脚踏板触发次数」加一，可在数据表搜索 `plate-trigger-count`。

变量首次成功申请后保留运行值。Lab 作用域可在不同地图声明同一 ID 和类型来共享；地图作用域按地图 ID 隔离，切回时也保留。初始值只在本次 Lab 的首次申请时使用，显式重置也使用该初始值。保存或切换地图不会重新初始化已有变量。

## 测试场景

两张地图各有一个无对白直通格。主测试场 `dungeon_interaction_test` 的「直通房间」在 (0,3)，传送房间 `dungeon_interaction_room` 的「直回测试场」在 (0,1)。走入直通格即传送，落地后可直接走开，要返回时再走回该格。原传送点仍可用于对白测试。

Agent Controller 在本 Lab 默认启用。`dungeon_interaction_test` 为 16×10，包含房间里的六个 Agent。踏板巡逻员每轮从北侧踩进 (6,2)，探路守卫每轮从南侧试撞 (7,4) 的石障，值班操作员每轮主动检查 (11,6) 的感应格。「传送后的房间」为 22×19，三个演示分在 (14,3)、(14,9) 和 (14,15)。三组结果每轮都在左上角显示消息。关闭 Controller 可停下自动行动，再手动测试玩家或单个 Agent。

主测试场的追踪守卫从 (1,0) 出发，尝试走进玩家占用格并被挡住时显示「追上你了！」。连续接触只提示一次，分开后再次被玩家挡住才重新提示。其控制器采用完整路径规划，停止距离设为 0。行动规则配置为「移动者：本实体」「阻挡者：指定玩家」。

编辑交互事件时统一选择「移动受阻」。移动者和阻挡者各自可选任意实体、本实体或指定实体 ID，玩家的 ID 为 `$dungeon-player`。「发现阻挡时」可在玩家换位或推动前由一条规则接管；「确认受阻后」允许多个消息规则响应。对白接管、成功发起换位或推动、仲裁失败都不会发出确认受阻通知。面板会显示最近一次玩家与 Agent 尝试的编号和结果。

玩家自身的规则在「地牢交互 → 玩家角色 · 实体行动规则」中编辑，Lab 自带一条默认禁用的 JSON 样例，应用后可用顶部按钮保存。该规则在本 Lab 的各地图生效。

在「传送后的房间」选择移动方向，直接尝试走进以下目标格即可触发对白。招呼守卫 (8,9) 的四侧共用一句招呼，四向巡守 (8,14) 初始朝北，正面、右侧、背面、左侧各有一句对白，封路石障 (14,9) 用于测试非 Agent 障碍。三种测试都使用「移动受阻尝试」，可以在同一个房间重复体验。主动对话守卫在 (3,3)，四向控制台在 (8,3)，来路感应格在 (3,9)。

方向升级测试：在“地牢配置”中选择 `dungeon_direction_test`（方向交互测试场）。NPC 在 (2,3)，初始面北；站在北侧面向南按 E 是正面交谈，南侧是背面，东西两侧共用侧面对白。“Dungeon Agent”面板可手动转身，逻辑朝向改变后正背面随之改变。尝试直接走入 NPC 会触发独立的碰撞提醒。

四向机关在 (4,1)，从北、南、东、西侧面向它按 E 使用对应规则；东西两条规则开启 once 并采用 entity 范围，因此本次进入共用一次机会，北南仍可重复。来路调查格在 (0,1)：从北进入使用专属对白，其他方向进入使用后备；背对目标后退进入仍按真实来路判断。测试辅助的瞬移不算 enter。原地图 `dungeon_interaction_test` / `dungeon_interaction_room` 保留下面的兼容场景。

1. 启动站在蓝格 (1,2)，面向南边橙色向导，按 E 对话；Esc 或“结束对话”关闭。
2. 原地转向后按 E 调查脚下蓝格 (1,2)，结束后可以再次按 E 调查。它的 once 关闭。
3. 向西走到新增蓝格 (0,2)，按 E 只调查一次。它的 once 开启；在同一张地图里走开再回来不会重置，离开地图再返回才重置。两格有各自的说明对白。
4. 向东经过出生格，到黄格 (2,2)，格步完成后自动对白，同格出口不会同时传送。
5. 关闭对白后按 E 传送到另一张地图；再按 E 返回。出生/入口放置不算 enter，不循环触发。

地图编辑器可以选择 `dungeon_interaction_test` / `dungeon_interaction_room` 编辑。

## 交互实体 Debug

“地牢交互”面板的“显示交互实体 Debug”是总开关。地块着色与轮廓（debug-color）和文字标签（debug-labels）可分别开关，支持仅着色、仅标签或同时显示。标签内容可分别选择实体名称（debug-name）、触发方式 / 按键（debug-trigger）、交互类型（debug-action）、启用与触发状态（debug-state）；默认显示名称、触发方式和状态。总开关参数为 dungeon-interaction.debug-entities，通用默认关闭，本测试 Lab 配置显式开启；所有选择均接入 Lab 配置，保存参数不触发交互或重载地图。

| 颜色 | 含义 |
| --- | --- |
| 蓝色 | 按键对话 |
| 橙色 | 进入时对话 |
| 紫色 | 地图传送 |
| 灰色 | 已禁用，或一次性对话本次已启动 |

格子挂载显示低矮半透明轮廓，边挂载显示窄条。文字使用视口 HTML 叠加层，以浏览器原生 13px 字体显示；名称略加重，信息行使用常规字重。每个渲染帧投影三维锚点，相机缩放不拉伸文字贴图；相机背后及近远裁剪范围外的标签隐藏。完整说明始终保留在面板摘要中。同格标签按实际高度叠放，间隔为 4px；减少字段会同步缩小高度。NPC 标签跟随当前空间表现位置，并与俯视显示变形保持一致。标签层透传鼠标，不占用键盘或暂停场景。

Debug 只读描述，不参与碰撞、拾取或触发。关闭时移除标记并停止读取描述；切图释放旧 Mesh、材质、锚点和 HTML 标签，卸载另移除逐帧投影订阅与视口层。文字不再创建纹理或标签平面。原先手工放置的三块彩色地面已删除，现在位置提示来自实际交互数据。其他模块的“全部格子 Debug”和“入口/出口 Debug”仍由各自开关控制。

## 数据

方向规则继续挂在 event v2 上，无需改变地图磁盘 V3。旧 event 缺省 `directionSpace: any`、`onceScope: rule`，保持原行为。每条规则新增：

| 字段 | 含义 |
| --- | --- |
| ruleName | 规则名称，用于编辑和调试 |
| directionSpace | any（任意/后备）、world（地图侧面）、target-local（目标自身侧面） |
| worldSides | north/east/south/west，多选，仅 world 模式生效 |
| localSides | front/right/back/left，多选，仅 target-local 模式生效 |
| onceScope | rule 各规则独立；entity 让同实体中选择 entity 且开启 once 的规则共用一次 |

编辑器提供四侧多选图，左右可共用一条。`targetRule` 表示主动或进入交互的搜索位置，enter 使用 self。移动受阻直接使用尝试方向和实际阻挡者，相对方向以该阻挡者的朝向为准。

NPC 朝向只读当前 Agent 状态，移动或转向中不可交互；普通空间物体读取 Body，固定无 Body 实体可添加“格子朝向”grid-facing 组件。相对规则没有可用朝向时拒绝执行准备，编辑保存仍允许未完成草稿。world 与镜头无关。八方向朝向/进入采用四个 90° 扇区，45° 边界归顺时针一侧，例如东北算地图东侧；循环地图按真实邻接识别来路，普通格步/相对移动/瞬时格步另传真实 movementDirection，避免两列循环地图把东西来路混淆。

先筛位置/遮挡/方向，再在同实体、同搜索位置内用明确方向规则替换任意方向后备；最后才走原全局优先级。明确方向规则之间并列仍报冲突，不依赖文档顺序。once 消耗在方向选择后过滤：明确规则消费完后不会退回通用对白。共享计数只在当前地图 Session 内有效，离开并重新进入重置。

Debug 的“方向条件与正面箭头”显示允许侧面与目标朝向；“面板显示当前方向判定原因”解释按 E 时命中哪条规则和对话入口，或为何被排除（方向、遮挡、移动、禁用、消费完毕、后备被替换）。所有文字沿用原生 HTML 清晰显示，两项默认关闭，可随 Lab 配置保存。

地图仍为磁盘 V3 / Runtime V2，原 `event` 升级为组件 v2。NPC 沿用 dungeon-agent，附加 event；无碰撞调查点使用新实体 interaction-point，其位置由 spatial-attachment 描述，添加时自带 event。

```json
{
  "id": "guide:event", "entityId": "guide", "type": "event", "version": 2,
  "trigger": "interact", "targetRule": "front", "priority": 10,
  "action": { "type": "dialogue", "presetKey": "dialogue_test", "entryNodeId": "greeting" }
}
```

- trigger 为 interact、enter 或 move-attempt。interact 和 enter 用 front 或 self 搜索目标。move-attempt 根据 `movementPhase` 选择接管或通知，并直接匹配移动者与阻挡者。
- action 仅保存对话与入口引用。可选 uiPresetKey 覆盖 UI，否则使用 Lab 对话模块的 UI 配置。
- priority 为整数，越大越优先；同优先级前方先于脚下。最高候选仍并列时明确报错，执行零个动作。
- once 只在当前地图 Session 记录。成功启动后消耗；加载失败/启动中取消不消耗；重新进入地图重置，不写入永久存档。
- 旧 v1 事件读取时无损升级为 legacy，保留 actionId、payload 和未知字段，不自动执行未知业务。

编辑器自动显示新实体和字段，允许逐步填写并保存未完成引用。运行准备阶段严格检查必填项、位置规则、对话入口与可选 UI 引用，失败不提交候选地图。Python 校验保存结构并允许草稿。

## 职责

core/dungeon-interaction 不依赖 DOM/Lab：Router 仲裁，Control 查询当前空间，validation 检查可执行声明。动态目标使用空间权威位置，移动/转向中或禁用的目标不参与，其他墙体阻挡前方查询。Loader 通过 dungeon:interaction-control 提供当前 Session 查询，不向共享内存暴露 Runtime。

dungeon-interaction 是唯一按键/完成格步 order 100/受阻尝试入口。每次实际格步只派发一次 enter，命中后停止连续续步与本次后续格步规则。运行读取 dungeon-interaction.enabled/key 配置；面板只改配置并发送测试请求。

dungeon-dialogue-interaction 适配模块调用 LAB_DIALOGUE，仅需要对话的 Lab 安装。切图/卸载取消本适配器启动的旧对白；忙碌期间禁止重复交互。对话锁住玩家输入，不主动暂停 NPC 模拟。

`message` 动作通过 `LAB_MESSAGE_BAR.show({ text, durationSeconds, channel })` 发送给共享 `message-bar` 模块。`dungeon-interaction` 负责规则匹配与计次，切图通过频道只清理地牢消息。其他 Lab 可单独装配 `message-bar`，声明依赖后调用同一服务。

踏板点灯使用「切换视觉状态」动作。地图编辑器中的「目标视觉实体」「目标视觉状态」来自当前地图，成功提示仍使用消息栏。灯本身通过视觉实体上的「加载视觉对象」「视觉状态」配置；「地牢视觉对象控制」面板可试切换。初始状态随切图重新应用。

房间东北侧的蓝灰色区域是四色灯测试区，灯在 (19,4)。在 (19,1)、(17,4)、(21,4)、(19,7) 按 E，分别测试下一个、上一个、独立随机和洗牌轮替。编辑交互时选择操作，指定状态使用状态下拉框，其余操作使用轮替组下拉框。成功提示可写 `{state}` 显示实际选中的状态名。洗牌进度由同一实体的同一轮替组共享，手动指定状态不会消耗本轮候选。

「消息栏 → UI 预设」选择写入本 Lab 的 `message-bar.ui-preset`，默认 `message_bar_default`。在 UI 编辑器中可复制并调整该预设；保留「消息列表」节点和 `message-bar.items` 绑定，新的预设就会出现在下拉列表。选择会立即应用，点击 Lab 顶部保存可保留到下次启动。

dungeon-transition 登记出口候选，继续拥有传送校验、输入锁和切图流程。目标地图、入口和三种 triggers 仍只保存在 dungeon-exit，未复制到 event。出口 priority 0，格子 rank 1、边 rank 0；旧多出口冲突检查保留。其运行开关也改为读取 LabConfig，交互键由统一模块设置。

保存 Lab 配置不执行交互或重新加载。生产沿用打包配置读取，无需 Python。测试构建仍含 Lab 工作台，发行包裁剪编辑器属于独立工作。目前未增加任务条件、剧情事件、宝箱/道具执行器或永久进度。

## 验证

- npm run test:dungeon-interaction：空间位置、遮挡、兼容、草稿、仲裁、互斥与原传送回归。
- Python 目录执行 python -m unittest test_dungeon_interactions：临时目录保存/读取与错误拒绝。
- npm run typecheck:lab-settings。
- npm run build:dungeon-interaction 后 npm run test:dungeon-interaction-webgl：隐藏 Electron 直接打开 file://，禁网络，验证 NPC/地块/传送、两个蓝格的重复/单次调查、切图重置和清理。
- 报告/截图：node_modules/.cache/dungeon-interaction.json / dungeon-interaction.png。
- `node codex-tools/runElectronVerification.mjs codex-tools/verifyDirectionalInteractionEditor.cjs`：先 build:dungeon-map-lab，验证真实四侧多选、模式切换保留值和撤销/重做，不写正式预设；报告/截图为 dungeon-direction-editor.json / .png。方向运行截图为 dungeon-direction-debug.png。
