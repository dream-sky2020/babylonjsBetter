# 俯视比例测试 Lab

启动项目开发服务后访问 `/tools/dungeon-overhead-view-lab/index.html`，或从首页选择 Dungeon Overhead View Lab。

1. 默认加载原有地图，使用独立 45° 正交草稿；格子与障碍 Debug 自动显示。
2. 在“俯视显示”面板把俯视角改成 30°，点击应用。等宽深格子的 Z 显示倍率应为 2，地面投影仍为方格。
3. 调整正交垂直半范围，改变窗口宽高，确认方格比例不变。
4. 玩家移动中切换角度；V 切第一人称后默认保留 Grid、障碍 Debug、玩家标记和相机位置的显示缩放，第一人称仍使用透视 FOV。勾选“切到第一人称时恢复地图原比例”并应用草稿可测试原始布局，再按 V 回到俯视。
5. 关闭协调或点击恢复地图配置，比较原布局；无对应地图组件时没有缩放。修改草稿不会写入地图，可通过 Lab Snapshot 导出/恢复。

俯视 Lab 保留 `dungeon-visual-deformation` 模块及其“物体变形”面板；有效俯视配置会自动启用默认变形参数，地图中的变形配置仍会生效，也可以在面板中应用草稿。格子显示比例和物体变形的视角切换设置都在“俯视显示”面板，点击“应用测试草稿”一并应用。默认不生成变形样例，也不启用针对样例分组的草稿。若关闭了玩家相机绑定，请重新开启再测试俯视。

变形面板中的“离开俯视视角时恢复原形”默认关闭：V 切第一人称后，已有变形继续沿用配置中的俯角；勾选并应用草稿后，切到第一人称才恢复原形。地图组件中的同名选项可正式保存该行为。

变形样例只在独立的 `/tools/dungeon-overhead-view-lab/verification.html` 渲染验证页中创建，不进入俯视 Lab 的 Dungeon 场景。该验证会比较 Standard/PBR 场景对象在示例补光开关前后的像素颜色。

自动验证：`npm run test:dungeon-overhead-view`；独立变形验证可运行 `npm run test:deformation`，启动开发服务后可运行 `npm run test:deformation-webgl`。生产入口构建：`npm run build:camera-labs`。
