# 怪物组合式模块

`labs/composable/monster-dissolve-lab/` 在视觉对象页的地图加载和对象模块之上增加 `monster-dissolve-preview`。在对象树/画面选中怪物或其任一图层，到“怪物消散测试”面板选择独立 Lab 的预设，点击“对选中怪物播放”。身体和线稿应用消散，底部填充和边框的渐隐终点由怪物消散预设指定，在怪物消散效果 Lab 编辑；恢复时遵循对象原有显隐。支持手动预览进度、恢复单个/全部对象，多个怪物分别持有预览状态。选中场景对象时禁止播放。测试模块只保存预设选择，不修改怪物文档或预设库。

`monster-visual-objects/monsterVisualObjects.service.ts` 是预览模块的唯一对象访问入口；分层目标 revision 在资源重载或文档恢复时变化，测试效果及时清理。原始视觉页仍不安装测试模块。新页本机对象文档按 pathname 隔离，原页保存数据继续使用原键。通过 `test:monster-dissolve` / `test:monster-dissolve-webgl` 验证新模块与七个现有预设。

Monster Visual 组合页现在仅使用 `monster-visual-objects`，另保留 dungeon-config 的场景加载链。该怪物模块无其他模块依赖，直接读取外观及视觉样式资源，复用底层四层精灵渲染，不引入战场和动作运行时。

对象根节点支持整体移动/旋转/缩放；四层各有稳定父节点，可独立编辑局部变换、资源路径及显隐。选中根节点还可编辑外观尺寸、内部倍率/偏移、面向轴及视觉样式。对象树显隐和属性显隐共用领域文档与历史。实例配置为独立副本，不写公共预设。保存到本机后刷新自动恢复；文档可导入/导出 JSON，也随本模块 LabState 保存。模块面板保留文档级撤销入口，删除最后一个对象后仍能撤销。

`monsterVisualObjects.model.ts` 管理文档校验和历史；`MonsterVisualObjects.ts` 绑定渲染节点及编辑能力；`.labModule.ts` 持有资源加载、Host 适配和 UI。整体变换、外观内部变换、图层局部变换分别保存；刷新资源保留各层父节点，恢复文档会取消未完成编辑。空图片路径保留可编辑父节点，可稍后补回资源。

`test:monster-visual-objects` 与 `test:monster-visual-objects-webgl` 覆盖新页。旧动作模块的回归装配位于 codex-tools/monsterVisualRuntimePage.html，原独立 Lab 完整保留。

monsterLabModuleCatalog 同时保留以下九项动作测试模块及新视觉对象模块。模块按 Host 公共执行计划创建各自面板：依赖层级优先，同层按发现顺序。

| 模块 | 依赖 | 状态与面板 |
| --- | --- | --- |
| monster-visual-libraries | 无 | 外观、两级条纹资源；独立重载入口；不读取动作预设 |
| monster-battlefield | visual-libraries | 实例、选择、布局；唯一战场数据写入者 |
| monster-visual | visual-libraries、battlefield | 唯一基础渲染器；外观覆盖、包围盒、公共播放暂停 |
| monster-layout-debug | visual | 网格、占位与选中标记；默认关闭 |
| monster-distance-stripes | visual、battlefield、visual-libraries | 独立距离规则库、启用开关、可编辑规则 |
| monster-movement | visual、battlefield | 独立移动预设库、目标行列、移动与停止 |
| monster-attack | visual、battlefield | 独立攻击预设库、方向、攻击与停止 |
| monster-hit | visual、battlefield | 受击时长、分层抖动、颜色；无动作预设读取 |
| monster-death | visual、battlefield | 独立死亡预设库、死亡与恢复 |

## 装配与调度

只声明 monster-hit 会补齐三项基础依赖，不安装移动、攻击或死亡模块，不发起这些动作库的读取请求，也不创建它们的面板和命令处理器。其他能力同理。

monster-visual 拥有 monster.visual.runtime 服务。可选模块 setup 时注册各自 Core 能力，并在释放时注销。所有能力由唯一 presentation / 200 任务按固定顺序推进；模块不创建额外 Scene、相机、Engine 或循环。Host 暂停与基础显示面板的公共暂停均冻结表现，相机保持可操作。

同一实例的测试动作互相替换，不同实例独立。monsterActionLifecycle.ts 只协调已注册能力的停止与 actionId 终态，不加载资源、不构建面板。清空、重置、配置更新和销毁取消相关动作；移除单项能力只取消该类表现。动作回归工具页显式列出所有选装模块，复用 dungeon-config 场景加载链，切图保持怪物实例。正式 Monster Visual 组合页使用上面的单一视觉对象模块。

## 数据与协议

- monster.visual-libraries：基础外观与条纹。
- monster.battlefield、monster.selection：由实例模块持有。
- monster.visual-settings：基础显示的包围盒与公共暂停。
- monster.movement / attack / hit / death / layout / distance-stripes 下的 settings：各模块持有自己的参数。
- movement、attack、death、distance-stripes 的 library：各模块加载和释放；不进入存档。

各能力目录分别提供 .memory.ts、.protocol.ts、.labModule.ts。通用的 monsterModuleUi.ts 只提供控件构建工具；monsterPresetLibrary.ts 只复用加载代次与规范化工具，不持有汇总库或集中面板。

基础实例命令仍从 monsterVisual.protocol.ts 导入。移动命令已迁至 monster-movement/monsterMovement.protocol.ts；攻击、受击、死亡各自提供独立请求。基础 monster.visual.command 只处理刷新显示和全局重置。

移动模块先校验目标及播放条件，开始移动后通过实例模块的 monster.battlefield.writer 提交目标；基础显示收到 move 变化时保留正在插值的姿态。其他实例更新不会取消当前动作。行列布局只用于视觉测试，不执行战斗碰撞、寻路或伤害判定。

所有设置经独立定义校验，再替换共享引用；模块面板从各自设置恢复。LabState 仍用 v1 格式，保存实例和各模块参数，不保存动画中间进度。旧 monster-visual-debug/settings 在恢复时拆为实例选择与基础显示设置；新存档不再输出旧模块。迁移别名只读，多个来源重复指向同一状态时拒绝，保持恢复前的完整校验。

## 验证

npm run test:monster-visual 检查布局、共享数据和测试动作生命周期。
npm run test:lab-state 检查恢复原子性与旧状态拆分。
npm run test:monster-visual-webgl 检查七种最小模块组合、各自资源/命令/面板、参数恢复、面板公共顺序、唯一表现任务、完整动作与旧存档，并覆盖十一项独立 Lab。
npm run build:monster-visual 构建组合式页及十一项独立页面，不复制 public。

图形检查复用 127.0.0.1:1184，阻止写请求，报告和截图位于 node_modules/.cache/monster-visual-verification.*。tsconfig.monster-visual.json 覆盖全部迁移入口；外围地牢 UI 等既有类型诊断单独处理。原外观配置编辑器和其他独立 Lab 继续提供正式配置编辑与保存。

怪物消散预设包含 `bottomFillEnd` 和 `bottomBorderEnd`（0–1）；旧预设缺失时默认为 1。独立编辑器、组合式预览和死亡表现模块选择消散预设时共用分层效果。死亡模块保留原有死亡效果选项，选择消散预设时进度按死亡动作总时长计算。
