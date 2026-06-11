# event 模块说明

该目录提供了项目内的轻量事件系统，以及一个基于事件驱动的实体状态缓存模块。

## 文件结构

- `event-bus.js`：事件总线实现（发布/订阅、取消订阅、清理）。
- `events.js`：统一事件名常量定义，避免硬编码字符串。
- `entity-state-module.js`：监听实体相关事件并维护内存状态快照。

## EventBus 用法

`EventBus` 提供以下方法：

- `subscribe(eventName, callback)`：订阅事件，返回取消订阅函数。
- `unsubscribe(eventName, callback)`：取消指定回调订阅。
- `emit(eventName, payload)`：发布事件并传递载荷数据。
- `clear(eventName?)`：清理指定事件监听器；不传参数时清空全部监听器。

示例：

```js
import { EventBus } from "./event-bus.js";
import { GAME_EVENTS } from "./events.js";

const eventBus = new EventBus();

const unsubscribe = eventBus.subscribe(GAME_EVENTS.PAUSED, () => {
  console.log("Game paused");
});

eventBus.emit(GAME_EVENTS.PAUSED);
unsubscribe();
```

## GAME_EVENTS 事件清单

`events.js` 中定义的事件：

- `game:paused`
- `game:resumed`
- `game:fpsChanged`
- `game:reset`
- `input:trigger`
- `input:confirm`
- `rhythm:testTrigger`
- `rhythm:start`
- `rhythm:judgeTriggered`
- `rhythm:noteHit`
- `rhythm:noteMiss`
- `entity:updated`
- `entity:added`
- `entity:removed`
- `debug:layerToggled`
- `debug:screenshotCaptured`

建议业务代码始终使用 `GAME_EVENTS.XXX` 引用事件名，避免拼写错误。

## EntityStateModule 说明

`EntityStateModule` 依赖 `EventBus`，在 `init()` 后会监听以下事件：

- `GAME_EVENTS.OBJECT_ADDED`：新增实体到状态池，记录 `id`、`type`、`speed`、`color`。
- `GAME_EVENTS.ENTITY_UPDATED`：按 `id` 合并更新实体属性。
- `GAME_EVENTS.OBJECT_REMOVED`：按 `id` 删除实体状态。

公开方法：

- `init()`：开始监听事件。
- `getState()`：返回实体状态数组快照。
- `destroy()`：解除监听并清空内部状态。

最小接入示例：

```js
import { EventBus } from "./event-bus.js";
import { EntityStateModule } from "./entity-state-module.js";
import { GAME_EVENTS } from "./events.js";

const eventBus = new EventBus();
const entityState = new EntityStateModule(eventBus);
entityState.init();

eventBus.emit(GAME_EVENTS.OBJECT_ADDED, {
  id: "enemy-1",
  type: "enemy",
  config: { speed: 3, color: "red" }
});

console.log(entityState.getState());
entityState.destroy();
```

## 维护建议

- 新增事件时，先在 `events.js` 添加常量，再在模块中订阅/发布。
- 事件 `payload` 字段建议保持稳定并补充注释，降低模块耦合成本。
- 在模块销毁阶段务必调用 `destroy()`，避免监听器泄漏。
