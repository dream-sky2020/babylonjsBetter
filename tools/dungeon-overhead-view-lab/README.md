# 俯视比例测试 Lab

启动项目开发服务后访问 `/tools/dungeon-overhead-view-lab/index.html`，或从首页选择 Dungeon Overhead View Lab。

1. 默认加载原有地图，使用独立 45° 正交草稿；格子与障碍 Debug 自动显示。
2. 在“俯视显示 · 统一配置”面板把俯视角改成 30°，点击应用。等宽深格子的 Z 显示倍率应为 2，地面投影仍为方格。
3. 调整正交垂直半范围，改变窗口宽高，确认方格比例不变。
4. 玩家移动中切换角度；V 切第一人称后回到原布局与透视 FOV，再按 V 恢复补偿。
5. 关闭协调或点击恢复地图配置，比较原布局；无对应地图组件时没有缩放。修改草稿不会写入地图，可通过 Lab Snapshot 导出/恢复。

此 Lab 只验证 Debug 与玩家标记，场景美术保持原状。若关闭了玩家相机绑定，请重新开启再测试俯视。

自动验证：`npm run test:dungeon-overhead-view`；生产入口构建：`npm run build:camera-labs`。
