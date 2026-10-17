# Lab 导航路径保护验证（2026-10-18）

用户报告地址：
`/labs/labs/standalone/scene-environment-lab/labs/standalone/dungeon-map-canvas-lab/index.html`

## 根因与修改

- 组合式 Lab 迁入 labs/composable 后，共用 createLab 首页链接仍为 ../../index.html，落到不存在的 /labs/index.html；修正为 ../../../index.html。
- Vite 默认 SPA 回退会在错误地址返回根 index.html，首页相对链接继承错误目录，反复叠加 labs 路径；改为 appType: mpa。
- labNavigation.ts 同时保护开发和预览服务。真实入口优先，仅按构建入口白名单恢复重复 labs/tools/apps 前缀和旧首页地址，保留查询参数；浏览器实测锚点也保留。未知页面返回 404 和 /index.html 链接，资源/API 与 POST 请求不重定向。
- 保留 base: './' 与正常页面的相对链接，支持 Electron/file://。HTTP 恢复中间件仅属于 Vite 开发/预览服务，其他静态部署需自行配置跳转规则。

## 验证

- `npm run test:lab-entries`：8/8。包含全部组合式 Lab 返回首页并解析全部首页链接的 HTTP/file:// 检查、旧可拖拽地址兼容、重复路径/目录入口恢复，以及临时真实开发/预览服务的成功、404、HEAD、POST、资源/API 边界。
- `npm run test:lab-navigation-browser`：4 条真实 Electron 导航链通过：
  1. 首页 → 场景环境 Lab → 首页 → 地图工作台。
  2. 用户报告的完整重复地址 → 正确地图工作台；查询参数与锚点保留。
  3. 旧 /labs/index.html → 根首页 → 组合式空间动作 Lab → 根首页。
  4. 未知页面 → 404 → 根首页。
  过程中未提交写请求。输出：node_modules/.cache/lab-navigation-verification.json。
- `npm run build:dungeon-map-lab`：通过；保留已有大包体积提示。
- `tsc --noEmit -p tsconfig.node.json`：未通过，剩余 5 条诊断位于未修改的 core/model/preset/firstPersonWeaponPreset.ts（unknown 到 boolean 两处）和 core/resources/appAssetUrl.ts（ImportMeta.env、location）；导航文件无诊断。

不修改地图内容、共享内存、物理世界、游戏行为或用户预设。
