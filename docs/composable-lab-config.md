# 组合式 Lab 配置

组合式 Lab 是装配、场景与测试单位，不额外增加游戏方案层。`main.ts` 中的 `labId` 对应 `config/labs/<labId>.json`；模块组合继续由 Lab 的 `modules/catalog` 定义管理。

## 使用

1. 重启 `python/server.py`，提供新增 `/api/lab-configs/<labId>` GET/PUT 接口。
2. 打开组合式 Lab。Host 在创建 Engine 和模块 setup 前读取配置；加载失败显示错误和重新加载入口，不悄悄回退到旧缓存。
3. 调整已登记的模块参数，当前运行配置立即更新；点击顶部“保存 Lab 配置”，通过 Python 写入当前 Lab 的独立 JSON。保存只校验控件并序列化当前运行配置，不重新采集参数、不重新应用配置、不重新加载页面或地图。
4. 顶部显示未保存修改、保存中和保存失败。取消离开页面不会销毁运行中的 Lab；实际离开时通过 pagehide 清理，进入浏览器往返缓存则保留运行实例。保存失败保留当前参数；保存过程中产生的新修改不会被误标为已保存。多个页面保存同一 Lab 时检查内容版本，冲突不覆盖文件。
5. 以前 localStorage 中的游戏参数不自动恢复。如需沿用，在原页面点击“导入旧本机参数”，核对后保存。导入不会删除旧记录，显式“不记住”的字段不导入。

生产模式通过构建收录的 JSON 模块加载，不访问 Python、不依赖开发服务器或工程绝对路径。`configDocument` 可由后续单 Lab 构建入口直接注入。开发编辑接口不负责正式游戏存档。

## 配置格式

```json
{
  "format": "lab-config",
  "version": 1,
  "labId": "dungeon-player-movement-lab",
  "modules": {
    "player-movement": {
      "bounds": true,
      "movement-timing-mode": "seconds-per-tile",
      "movement-timing-values": {
        "world-units-per-second": "60",
        "seconds-per-tile": "0.2"
      }
    }
  }
}
```

`modules` 中使用现有稳定设置组 ID，通常与模块 ID 相同；保留 `dungeon-player-camera`、`dungeon-grid-debug` 等既有标识。一个模块可以拥有多个设置组，不使用面板标题或控件顺序作为存储键。相机自动匹配构图的正交范围使用 `null`，不转换成 0。缺失字段采用模块默认值，已提供的非法字段拒绝初始化；未知字段保留以免其他模块或较新版本的数据被保存操作删除。

初始 13 份配置来自各 Lab 原有启动设置，不读取用户浏览器缓存。Dungeon Agent 的俯视和跟随区域初始值已迁入其配置文件。

## 运行与编辑边界

`labs/kit/config/LabConfig.ts` 不依赖 DOM、storage、Python 或 Babylon。运行模块通过 `context.config.register(groupId, fields)` 在 setup 开头注册独立的默认值与校验器，获得该 Lab 的活配置；通过 `update` 统一修改，`subscribe` 同步依赖系统。不要在每帧或每次动作中读取 HTML 控件。需要复制 JSON 时使用 `read/snapshot`；模块持有的活引用不能绕过 update 私自修改。

玩家移动已使用 `playerMovement.config.ts` 独立声明所有运行参数和计时换算，移动、转向、碰撞约束、连续输入及键盘参数读取配置对象。

原有其余模块通过 `LabConfigBinding` 兼容已登记的 `registerSettings` 字段：全部 setup 和初始 LabState 完成后、所有 start 之前应用文件参数，异步资源按模块已有的稳定标识恢复机制完成接入。编辑时调用原有整组 apply 同步派生状态，不模拟点击、不执行测试动作。面板布局和折叠继续使用本机偏好；位置、血量、动作、领域对象文档、地图和预设保持各自的所有权。

**这是配置持久化与运行参数分离的第一阶段。兼容适配器不等于所有旧模块已经脱离面板。** 旧模块仍有 DOM 与运行逻辑混合，当前常规 Vite 构建也仍包含编辑器页面、共享库和资源。不能将当前构建当作安全的无编辑器游戏发行包。

后续正式发行入口需要逐模块拆分 runtime/panel、独立的无工作台 Host、仅选择目标 Lab 的静态引用、预设和资源依赖清单，以及禁止编辑器进入构建的检查。不能用 CSS 隐藏或空面板替身代替这些工作。

## 新增 Lab

复制组合页时同时创建新的 `config/labs/<labId>.json`，修改 `labId`，并在 `createLab` 中指定同一 ID。可复制旧 Lab 的参数作为起点，之后分别保存。模块组合仍在入口显式声明。

未指定 `labId` 的旧验证 Host 保留原有 localStorage 行为，便于旧测试和独立工具逐步迁移；正式组合页都已显式指定 ID。

## 验证

- `npm run test:lab-config`：独立配置、字段校验、原子更新、存储优先级、实时应用、显式导入旧参数和保存期间的修改。
- `npm run typecheck:lab-settings`：配置、面板和模块类型检查。
- `python -m unittest test_lab_configs`（在 python 目录）：临时目录中的 GET/PUT、隔离、冲突、非法数据与可靠写入。
- `npm run test:lab-config-webgl`：独立 1185 端口和独立 Vite 缓存并启用 HMR，真实 13 个组合页初始化、保存、刷新、隔离、失败保留，以及保存和文件监听事件不重载页面/地图；模拟配置读写，不写正式文件。报告 `node_modules/.cache/lab-config.json`。
- `npm run build:lab-config-verification`，再 `npm run test:lab-config-production`：最小生产构建在 file:// 下读取配置，禁止所有 HTTP/HTTPS 请求；这是配置加载验证，不是完整游戏发行验证。
- 玩家移动现有 `playerMovementModule.test.mjs` 同时覆盖旧 Host 和配置 Host，检查移除面板 DOM 后键盘移动仍读取运行配置。
