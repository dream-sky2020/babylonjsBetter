# Codex 工具与资源处理档案

本目录集中保存 Codex 编写或维护的项目辅助工具，以及模型导入、贴图迁移的清单与验证记录。原目录名为 scripts。

- 根目录：仍由 package.json 或项目代码使用的构建、迁移与验证工具。
- shared-textures/：共享贴图加载验证页面和测试入口。
- model-assets/：按作者归档的来源、许可、导入清单、处理报告与验证页面。
- `instanceDeformationVerification.html`：开发服务中的模型硬件实例图形回归入口，验证变形、阴影、深度、绘制次数和 crossroads 实例材质编辑；结果输出到页面 `#result`。
- `sceneWarmupVerification.html`：启动开发服务后访问 `/codex-tools/sceneWarmupVerification.html`，用真实 crossroads 模型验证视野外完整预热、阴影/变形/深度及预热后浏览无新增着色器；结果输出到 `#result`。逻辑与 Loader 生命周期回归使用 `npm run test:scene-warmup`。
- `dungeonRenderVerification.html`：启动开发服务后访问 `/codex-tools/dungeonRenderVerification.html`，验证真实 dungeon-agent-lab 的静态变形缓存、同帧父变换、Debug 分块绘制数及正交/透视格子像素一致性；结果输出到 `#result`。格子逻辑回归使用 `npm run test:dungeon-grid-rendering`。
- `buildDialogueMapLab.mjs`：只构建 Dialogue Map Canvas Lab 到 node_modules/.cache/dialogue-map-build，不复制 public 资产。
- `labEntries.test.mjs`：通过 `npm run test:lab-entries` 检查首页分组、链接目标、组合式 Lab 构建入口和目录归属。
- `dialogueTextVerification.html`：通过开发服务打开，比较旧版顶部基线裁剪与新字形安全区绘制，在 8 种缩放和 DPR 1/1.25/2 下统计丢失笔画像素，并确认文字实际绘制；结果保存在页面 `#result`，passed 表示所有 24 组新绘制均无裁剪损失。

这里同时包含可执行工具与历史档案；归档不代表所有文件都已停用。修改或删除工具前，检查 package.json、Vite 配置和代码引用。

后续 Codex 工作先检查并复用现有工具。需要长期保留的新辅助工具放在本目录，说明用途及调用方式。一次性临时工具放入被 Git 忽略的 .asset-migration/，完成后清理；不要重新创建 scripts/ 或把临时工具散落到项目根目录。
