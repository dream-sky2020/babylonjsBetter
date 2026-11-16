# 本地开发后端 · Node.js

在项目根目录运行 `npm run dev`，网页和 Node.js API 一起通过 Vite 提供，默认地址为 `http://127.0.0.1:1184`。用 `npm run electron:dev` 启动桌面开发版时也会启动同一套 API。场景编辑、UI 预设和武器预设有各自的 Vite 处理器。

需要单独联调 API 时可以使用独立入口：

```powershell
npm run backend:node
```

服务用 Node.js 22 运行，无需安装新的 npm 依赖。也可以直接执行 `node nodejs/server.mjs`。默认监听 `127.0.0.1:4550`，端口被占用时沿用现有前端的 4550–4600 扫描范围。可用 `--port` 指定起始端口，用 `--image-dir` 指定图片池，用 `--help` 查看参数。

首次接入后，重启原有的 Vite 开发服务。Vite、独立 Node.js 和 Python 使用相同的 `config/`、`public/` 和默认图片池。并发控制覆盖单个服务进程，多个服务同时运行时请避免写同一份配置。

| Node.js 文件 | 对应职责 |
| --- | --- |
| `server.mjs` | 服务启动、路由表、HTTP 响应及本地来源检查 |
| `configRoutes.mjs` | 单个 JSON 文件的配置 API |
| `catalogRoutes.mjs` | 地牢地图、对话地图、UI 预设的分文件目录及索引 |
| `sceneEnvironmentPresets.mjs` | 只读场景索引、继承与材质校验 |
| `labConfigs.mjs` | Lab 配置读写、版本冲突检测和文档校验 |
| `labSaves.mjs` | `/api/lab-saves` 的同源校验、目录选择和检查点存读 |
| `resourceRoutes.mjs`、`imagePicker.mjs` | 图片池、资源查找、图片上传、文件选择和图集 JSON |
| `validation/` | 与 Python 侧对应的领域校验，包括动画、武器、材质、交互、对话和各类预设 |
| `storage.mjs` | 路径限制、同目录临时文件替换、串行写入 |

默认图片池仍指向 `python/Identity_Skill_Icons/`，旧图片可以直接读取。选择文件由系统窗口完成，Windows 使用 PowerShell 调用系统对话框，macOS 使用 osascript，Linux 需要 Zenity 和桌面会话。图片代理只读取 `public/` 和配置的图片池。服务只接受本机地址和本机网页来源。分文件目录更新时，只有旧索引登记且已移除的预设会被清理。保留 `index` 等系统文件名，限制大小写冲突。

`/api/lab-saves` 在 Vite 和独立 Node.js 入口中使用同一处理器，默认写入 `saves/<labId>/`。Electron 正式版通过桌面桥接读写应用数据目录。检查点校验和磁盘读写由 `runtime/` 中的共享模块提供。

用 `npm run test:backend:node` 验证 HTTP、配置、并发保存、检查点存读、预设目录和图片接口。测试写入临时目录。修改接口时，先核对调用方，以现有 JSON 样例验证读取和写入，并覆盖有影响的旧格式。

这是编辑器的本地开发服务。Vite 的同源开发接口和 Electron 的运行时存档桥接各自沿用原入口。正式网页版的配置资源由前端构建提供。若以后需要让 Electron 安装包写编辑器配置，可以复用 Node.js 模块，通过主进程向页面提供专用接口。

