# Game Time

`game-time` 是第一个迁入中央 `RuntimeDataStore` 的业务模块，也是后续迁移的参考实现。

## 数据所有权

模块注册唯一 Public 数据定义 `playTimeSeconds`：

```ts
{
  key: 'playTimeSeconds',
  moduleId: 'game-time',
  scope: 'game',
  visibility: 'public',
  persistence: 'full',
  version: 1,
}
```

数据值直接使用 `RuntimeScalar`，不再重复包装：

```ts
120.5
```

只有 `GameTimeController` 持有的模块 Handle 可以修改它。其他模块可以通过公共读取入口取得数字副本：

```ts
const playTime = context.runtime.publicData.read(
  playTimeSecondsData,
  context.runtimeScopes.game,
);
```

`running` 是计时控制器的临时执行状态，不属于存档数据。未来的战斗时间等计时项应在本模块增加自己的数据定义，不得重新写回 `GameRuntime` 或 `WorldRuntime`。

## 兼容边界

组合式 Lab 已不再读写 `WorldRuntime.playTimeSeconds` 和 `playTimeRunning`。旧字段和旧 `GameRuntimeSnapshot` 暂时保留，等待中央 Runtime 存档能力实现后单独迁移，当前不能作为新时间数据的权威来源。