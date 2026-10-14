# Dialogue Map Canvas Lab · V4

选中节点后，在“内容与端口”点击输出端口，即可配置激活方式、出口条件及触发事件。

滚轮以鼠标所在位置为中心连续缩放，支持鼠标滚轮与触控板小增量，范围 30%–220%；达到边界后不会继续移动画布。“适配全部”仍可恢复整体视图。拖动节点、平移或连线进行中暂停滚轮缩放。

画布文字按实际字体宽度排版：标题、说话者和输出标签单行省略；对白正文最多 3 行，输出摘要最多 2 行，超出时在末行显示省略号。正文保留手动换行，英文优先按词换行，长词和 emoji 以完整字符处理。节点最小高度、端口和点击区域根据排版结果同步更新，缩放只改变显示比例。文字区域独立裁剪；设定高度和保存的位置保持原值，可用“适应内容高度”显式修改设定高度。

字形使用真实字体边界定位基线，预留笔画安全区，并按屏幕像素比对齐字号和坐标。正文基准字号 12px，屏幕字号至少 10px；90% 以下显示简略内容，45% 以下隐藏正文。文字在本节点的装饰之后绘制，同时遵循不同节点的原叠放顺序。

- 条件支持字段比较、全部/任一条件组与取反；左右两侧均可选择常量或共享内存字段。
- 共享内存引用保存 `key` 和字符串数组 `path`，例如 `dungeon.player-state` / `['playerPosition', 'tileX']`。目录可搜索，未登记字段允许手动填写。
- 接收事件保存 `eventType` 与 `version`；触发事件还支持 `payload`。参数值复用常量/内存字段编辑器。参数重命名需点击“修改名称”，重复或空名称不能提交。
- 事件列表可添加、删除、排序；通过出口时的事件定义保存在 `effects`，本编辑器不执行游戏事件。
- 旧字符串显示为“旧版条件/效果”并原样保留。条件转换需重新配置，效果转换显式使用旧字符串作为事件名称和版本 1。可撤销转换。
- 工具栏支持撤销/重做；画布范围支持 Ctrl+Z、Ctrl+Shift+Z/Ctrl+Y。输入框中保留浏览器文本撤销。

字段与事件目录位于 `dialogueRuleCatalog.ts`，仅提供编辑元数据，不创建或读取运行会话。结构错误、已知类型不匹配和缺失必需参数阻止保存；未登记引用与旧版规则提示警告。

```json
{
  "id": "continue",
  "label": "继续",
  "activation": { "type": "choice" },
  "condition": {
    "type": "compare",
    "left": { "type": "memory", "key": "dungeon.player-state", "path": ["playerPosition", "tileX"] },
    "operator": "gte",
    "right": { "type": "literal", "value": 5 }
  },
  "effects": [{
    "type": "event",
    "eventType": "custom.checkpoint",
    "version": 1,
    "payload": { "name": { "type": "literal", "value": "gate" } }
  }]
}
```

验证：`npm run test:dialogue-map`、`npm run typecheck:dialogue-map`、`python -m unittest discover -s python -p test_dialogue_map_v4.py -v`。
