# Dungeon 显示变形模块

模块 ID：`dungeon-visual-deformation`。依赖 `dungeon-overhead-view` 和 `dungeon-map-loader`，已注册到 Dungeon Catalog。

在 `createLab` 的模块列表加入此 ID 即可显示“物体变形”面板。模块跟随“俯视显示”的有效配置自动接管变形，不再提供独立的 Lab 启用开关；变形面板编辑自动俯角补偿、手动倾斜、高度倍率、默认强度和全部/规则范围。默认没有匹配规则；已有规则以可展开列表显示，点击一条规则后编辑或删除。可选对象另放在默认收起的列表中，展开后可搜索并查看对象是否支持变形，避免把已接入对象误看作默认规则。对象规则 > 标签 > 分组 > 类型，同级后条覆盖；0 强度表示排除。

变形角度读取 `dungeon-overhead-view` 的已配置俯视角。切到第一人称或关闭玩家相机绑定时，默认继续沿用该角度保持物体变形；“离开俯视视角时恢复物体原形”设置显示在“俯视显示”的“切换视角后的显示”区域，勾选后立即写入变形草稿并生效，也可随该面板的“应用测试草稿”或变形面板的“应用变形草稿”应用。没有有效俯视配置时始终恢复原形。自动补偿要求配置为正交投影，手动模式可配合透视俯视。模块不监听键鼠，也不接管 Viewport。

持久化分两层：

1. 正式地图：在地图级 `dungeon-overhead-view` Entity 添加 v1 `visual-deformation` Component，沿现有地图编辑/保存通道写入。`restoreOutsideOverhead` 保存切换视角后的行为，旧地图缺少该字段时默认保持变形。角度仍保存在原俯视 Component；没有新增另一份当前相机俯角。
2. Lab 草稿：`dungeon-visual-deformation/settings` v1 保存 `{draft}`，通过 Lab Snapshot 导出/恢复。点击“恢复地图变形配置”清除草稿。无组件且无草稿时使用默认变形参数，随有效俯视配置自动生效；没有有效俯视配置时不接管 Registry。地图组件的通用禁用状态和旧草稿里的 `enabled: false` 仍会被尊重。临时 `runtime:` 对象规则不写入 Snapshot。

服务 `dungeon:visual-deformation` 提供 `settings` 只读副本和 `setDraft(settings | null)`；其他模块创建对象时通过 Core Registry 注册元数据，不直接修改别人的材质 uniform。模块卸载释放视角和地图订阅、LabState 引用、Registry 控制句柄、深度覆盖及面板。

公共 API、公式、自动接入范围与渲染限制见 `core/render-deformation/README.md`。
