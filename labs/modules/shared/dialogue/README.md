# 对话管理模块（第一版）

入口：`labs/composable/dialogue-test-lab/index.html`，首页“组合式 Lab → 对话测试 Lab”。

操作面板选择对话预设、入口节点和 UI 预设，点击“开始测试对话”。默认配置位于 `config/labs/dialogue-test-lab.json`，使用 `dialogue_test` / `greeting` 和 `dialogue_test_ui`。支持逐句继续、选项分支、正常结束、主动取消与重复开始。Enter / Space 继续，1–9 选择对应选项，Esc 结束；长按不跳过多句。更多选项仍可在滚动列表中点击。

对白、选项、条件与事件通过同一运行时推进。发布卡调用 Lab 通信；等待卡按协议、来源、关联 ID 和字段筛选下一次匹配，并可设置超时出口。允许移动的等待会隐藏对话并释放输入，命中后恢复界面；Esc、取消、切图和卸载会清理等待。执行动作卡由地牢适配层传入当前地图执行能力，独立对话测试 Lab 可运行对白及独立事件。地牢交互 Lab 在 (12,9) 的调查点使用 `village_gate` 验证任务事件、石障操作和踏板等待。

「UI 预设」根据当前入口判断兼容性。所有界面需要可见正文绑定 `dialogue.text`；入口能走到选项时，还需要可见的「对话操作与选项」绑定 `dialogue.choices`。姓名、头像与继续按钮可按样式选用；纯对白可用键盘推进。地图可指定自己的 UI，留空沿用 Lab 的 `dialogue.ui-preset`。不兼容的配置会说明原因，运行不会打开对应的覆盖层。

## 职责

- `core/dialogue-runtime/DialogueSession.ts`：只读编译后的剧情快照，管理对白、选择、效果节点及流程推进；不依赖 DOM、Lab 或编辑器。
- `dialogue.effects.ts`：对接 Lab 通信及地图适配层，执行效果并返回下一节点。
- `dialogue.runtime.ts`：加载、打开 UI、管理输入占用及取消/错误/卸载清理。可以不创建测试面板而独立安装。
- `dialogue.panel.ts`：只负责选择配置、发起开始/取消请求和显示状态。游戏播放不从控件读取参数。
- `dialogue.labModule.ts`：适配现有预设仓库、编译器、ui-runtime 和键盘仲裁，注册 `LAB_DIALOGUE` 服务。

一次开始请求捕获配置；播放期间改参数只影响下一次开始。保存 Lab 配置不启动、取消或重新加载当前对话。模块参数选择不是剧情进度，当前对话状态不写入配置或预设。

调用方声明 `dialogue` 依赖后，可以通过 `context.services.get(LAB_DIALOGUE)` 调用 `start({ presetKey, entryNodeId, uiPresetKey })`、`next/choose/cancel` 和 `inspect/subscribe`。不带参数时采用当前 Lab 的配置。一个模块实例同时只运行一段对话，启动中再次请求会拒绝。

对话覆盖层使用 modal 模式阻止场景鼠标输入，键盘锁只放行对话消费者。完成、取消、UI 加载失败和卸载均释放锁。不会主动暂停其他游戏系统的模拟。取消或卸载时迟到的异步 UI 会立即销毁，不会重新打开。

## UI 预设绑定

测试预设与原 `default_dialogue_ui` 独立，原预设不改写。UI 组件布局和样式可在现有 UI 编辑器调整：

| 数据名 | 内容 |
| --- | --- |
| `dialogue.speaker` | 当前说话人 |
| `dialogue.text` | 当前完整对白 |
| `dialogue.choices` | `[{ id, text }]` 的 JSON 字符串 |
| `dialogue.canAdvance` | 0 或 1，当前是否可以继续 |

新预制组件 `对话/DialogueActions.ui.tsx` 自动出现在 UI 编辑器添加菜单，按数据渲染任意数量的选项，并发送 `dialogue.next`、`dialogue.cancel` 和 `dialogue.choose:<编码后的选项ID>`。选项和继续按钮通过语义绑定连接，不依赖 UI 节点 ID。姓名牌和对白框沿用现有 text 绑定。

## 验证

- `npm run test:dialogue-runtime`：独立会话、分支、非法入口/不支持节点、无面板运行、取消/失败/卸载与异步清理。
- `npm run typecheck:lab-settings`：模块和 UI 组件类型。
- `npm run build:dialogue-test`，再 `npm run test:dialogue-test-webgl`：构建页面通过 file:// 实际点击测试按钮，检查对白、选项、键盘和重启；禁止网络请求，不改正式预设。
- 报告和截图：`node_modules/.cache/dialogue-test.json` / `dialogue-test.png`。

该构建是完整 Lab 验证产物，包含工作台，不是去除编辑器的正式发行包。
