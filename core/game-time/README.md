# Game Time Core

`core/game-time` 只负责时间状态的数据定义、校验与计算，不依赖 Lab、UI、通信或生命周期。

`createGameTime()` 返回 `GameTimeController`。控制器和业务模块共享同一个 `GameTimeState` 引用；业务模块在高频路径直接通过控制器或该引用工作，不需要经过中央容器中转。

组合式 Lab 若使用时间模块，应由对应的 `tools/lab-modules/...` 适配器把 `controller.state` 注册到 `context.labState`。LabState 只保留同一引用，用于 Debug、存档生成和存档恢复，不接管业务访问。

```ts
const controller = createGameTime();
const state = controller.state;

controller.start();
controller.update(deltaSeconds);

// 高频读取仍然命中模块自己的引用。
console.log(state.playTimeSeconds);
```
