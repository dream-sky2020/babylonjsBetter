# 数字精灵

数字精灵把一段数字文本拆成多个 Babylon Plane，每个字符使用
`config/numberSpriteConfigs.json` 中配置的单图或 TexturePacker 图集帧。

```ts
import {
  createNumberSprite,
  getNumberSpritePreset,
  loadNumberSpritePresets
} from '@/core/sprite';

await loadNumberSpritePresets();
const preset = getNumberSpritePreset('number_default');
if (!preset) throw new Error('数字精灵配置不存在');

const number = await createNumberSprite(scene, '-1284', preset);
number.root.position.set(0, 2.5, 0);

await number.setText('9999');
number.setDebugVisible(true); // 显示每个数字 Plane 的包围框
number.dispose();
```

`spacing` 是所有相邻字符的基础间距。启用 `groupingEnabled` 后，整数部分会从右侧每三位额外加入
`groupingExtraSpacing`，例如 `1 | 234 | 567`；不会插入逗号，也不会影响小数部分。

配置工具：`/tools/number-sprite-lab/index.html`。
