# Monster core

怪物 Lab 与正式场景共用的无界面功能模块。页面中的 DOM、按钮、相机面板和编辑状态不应放在这里。

- `config/monsterConfig.ts`：默认值、规范化、旧数据兼容所需的稳定数据模型。
- `resource/monsterResources.ts`：怪物素材路径与 Vite 扫描结果整理。
- `api/monsterApi.ts`：读取、保存怪物显示配置和条纹预设。
- `render/createLayeredMonster.ts`：Babylon.js 四层怪物实体控制器，可作为受击、死亡效果的挂载对象。

```ts
import {
  createLayeredMonster,
  normalizeMonsterConfig,
  normalizeMonsterConfigLibrary
} from '@/core/monster';

const monster = createLayeredMonster(scene, 'previewMonster');
monster.load(config, monsterStripePreset, stripePresets);
monster.updateTime(scene.getEngine().getDeltaTime() / 1000);
```
