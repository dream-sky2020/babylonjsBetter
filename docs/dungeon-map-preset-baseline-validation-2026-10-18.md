# 地图预设未保存误报修复

## 原因

Agent 寻路测试广场预设仍含旧 `grid-agent`、`movement-obstacle` 空间组件。Activity 原先先按原文档的地图投影建立 savedPresetFingerprints，随后 installDocumentStore 才将旧组件转换为 spatial-body / spatial-collider / agent-timing。显示内容与保存基准处于不同格式，虽然 Store 尚无编辑历史、dirty 为 false，投影指纹仍不相等，因此显示“未保存”；重新加载同样复现。

## 修改

新增纯函数 prepareDungeonMapEditorDocument，复用既有空间转换。首次读取整库和显式重载先规范化，再建立文档集合、预设投影、比较基准及 Store。安装 Store 保留防御性的幂等转换；普通切换不重置保存基准，因此不会掩盖此前真实编辑。源文件不被改写，用户显式保存仍沿用原流程。

## 验证

- `npm run test:dungeon-map-workbench`：13/13，含三个专项测试：稳定旧组件夹具重现指纹差异、规范化后基准一致且输入不变；真正编辑与撤销重做；当前项目 Agent 广场的规范化幂等性。夹具不依赖正式预设必须保持旧格式。
- `node codex-tools/runElectronVerification.mjs codex-tools/verifyDungeonMapPresetBaseline.cjs`：7 项真实页面检查通过：首次载入、打开广场、无修改重载无放弃提示、只浏览实体不变脏、编辑/撤销/重做、跨预设保留真实修改、真实修改仍触发放弃提示。控制台 errors=[]，writes=[]，测试主动拒绝写请求。
- `npm run build:dungeon-map-lab`：通过，保留已有大包提示。
- 全项目类型检查仍有 175 条既有诊断；与之前记录去除行列号后比较，无新增。日志在 `.asset-migration/spatial-upgrade/map-baseline-types.log`。

不修改正式地图预设、共享内存或运行时物理行为。
