# 怪物视觉能力

`MonsterVisualRenderer` 持有四层精灵、基础变换、附件挂点和实例生命周期。输入 `MonsterVisualInput[]` 使用世界位置与外观引用，可独立运行；不加载配置，不推进动作，不创建编队辅助物。

`MonsterVisualRuntime` 是显式装配入口：将既有 `VisualBattlefield` 转为渲染输入，并按顺序推进已安装的能力。默认只创建基础渲染器。独立页面通过构造参数传入能力；组合式模块通过 `installCapability(Capability)` 在 setup 阶段注册，返回注销函数。缺失能力访问报错；重复安装拒绝。`removeCapability(key)` 释放指定能力及其效果，保留基础渲染。

```ts
import { MonsterVisualRuntime } from './MonsterVisualRuntime';
import { MonsterHitController } from './MonsterHitController';

const visual = new MonsterVisualRuntime(scene, { capabilities: [MonsterHitController] });
visual.sync(battlefield, resources);
visual.hit.playMonsterHit(monsterId, parameters);
visual.update(deltaSeconds);
visual.dispose();
```

| 能力 | 职责 |
| --- | --- |
| MonsterMovementController | 移动采样与完成回调 |
| MonsterAttackController | 攻击方向、姿态与完成回调 |
| MonsterHitController | 四层抖动、闪色与完成回调 |
| MonsterDeathController | 死亡采样、既有 sprite-death 运行时及资源释放 |
| MonsterDistanceStripeRules | 行距离规则的配置、查询和选择 |
| MonsterLayoutHelpers | 网格、占位标记、选择高亮；隐藏时释放网格和标记 |
| MonsterSpecialStatusAttachments | 特殊状态组的怪物挂点绑定、异步代次和释放 |
| MonsterExclamationAttachments | 感叹号组的怪物挂点绑定、结构复用和进度 |

动作控制器提交 `MonsterVisualFrame`，由渲染器统一应用。固定通道顺序为 movement、attack、hit、death；位置/姿态取最后一个提供该字段的通道，颜色和图层效果按对应字段覆盖。附件挂点跟随最终位置和旋转，保持自身比例语义。死亡消散通过渲染器提供的表面效果接口驱动原有死亡视觉运行时。

`MonsterActionCoordinator` 保留原有替换规则：移动替换攻击，攻击替换移动，死亡替换移动/攻击/受击，受击可与姿态表现叠加。组合式 Lab 另外保留同实例测试动作互斥的策略与 actionId 事件；事件与场景调度属于 Lab。能力不创建 Engine、相机或渲染循环。

`sync` 保持正在移动或攻击的实例姿态；只更新发生变化的外观和条纹。移除实例先通知能力释放动作、粒子与附件，再销毁精灵。`clear` 清空实例和表现，保留距离条纹规则配置；`dispose` 释放全部能力和渲染器。正式配置和 LabState 格式保持原样。

独立特殊状态预览使用 `core/special-status/preview/SpecialStatusPreviewController.ts`，独立感叹号预览使用 `core/sprite/exclamation/ExclamationPreviewController.ts`。两者不依赖怪物运行时。异步状态/数字创建在 Scene 销毁时失效，避免延迟结果重新创建场景对象。

## 调用方装配

| Lab | 安装能力 |
| --- | --- |
| monster-3d-visual-lab | 基础显示 |
| monster-formation-lab | layout |
| monster-battlefield-stripe-rules-lab | layout、distanceStripes |
| monster-movement-lab | layout、distanceStripes、movement |
| monster-attack-lab | layout、distanceStripes、attack |
| monster-hit-feedback-lab | hit |
| monster-knockback-lab | death |
| monster-special-status-position-lab | specialStatuses |
| monster-exclamation-position-lab | exclamations |
| 组合式 monster-visual 模块 | 基础显示；服务供其他模块分别注册能力 |

旧 `MonsterVisualManager` 已移除。新增调用方使用以上能力，公共类型位于 `monsterVisual.types.ts`。专项构建覆盖全部调用页面；图形回归覆盖最小能力装配、卸载、动作替换、实例隔离、辅助物、存档恢复、异步销毁与各页面实际操作。
