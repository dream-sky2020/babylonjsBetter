# Dungeon 显示变形模块

模块 ID：`dungeon-visual-deformation`。依赖 `dungeon-overhead-view` 和 `dungeon-map-loader`，已注册到 Dungeon Catalog。

在 `createLab` 的模块列表加入此 ID 即可显示“显示变形 · 批量控制”面板。面板提供自动俯角补偿、手动倾斜、高度倍率、默认强度、全部/规则范围和对象列表；对象列表会说明不支持的原因。对象规则 > 标签 > 分组 > 类型，同级后条覆盖；0 强度表示排除。

当前角度只订阅 `dungeon-overhead-view` 的有效配置。第一人称、关闭玩家绑定或没有有效俯视配置时恢复原形；恢复俯视后重新应用。自动补偿要求正交，手动模式可配合透视俯视。模块不监听键鼠，也不接管 Viewport。

持久化分两层：

1. 正式地图：在地图级 `dungeon-overhead-view` Entity 添加 v1 `visual-deformation` Component，沿现有地图编辑/保存通道写入。角度仍保存在原俯视 Component；没有新增另一份当前相机俯角。
2. Lab 草稿：`dungeon-visual-deformation/settings` v1 保存 `{draft}`，通过 Lab Snapshot 导出/恢复。点击“恢复地图变形配置”清除草稿。无组件且无草稿时关闭变形。临时 `runtime:` 对象规则不写入 Snapshot。

服务 `dungeon:visual-deformation` 提供 `settings` 只读副本和 `setDraft(settings | null)`；其他模块创建对象时通过 Core Registry 注册元数据，不直接修改别人的材质 uniform。模块卸载释放视角和地图订阅、LabState 引用、Registry 控制句柄、深度覆盖及面板。

公共 API、公式、自动接入范围与渲染限制见 `core/render-deformation/README.md`。
