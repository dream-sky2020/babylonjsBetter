# Game Time

`game-time` 是第一个迁入中央 `RuntimeDataStore` 的业务模块，也是后续迁移的参考实现。

## 注册数据

模块在 `game` Scope 注册四份 Public 数据：

| Key | Runtime Value | 内容 |
| --- | --- | --- |
| `playTimeSeconds` | `RuntimeScalar(number)` | 累计游戏时间 |
| `isRunning` | `RuntimeScalar(boolean)` | 游戏时间是否正在累计 |
| `realTime` | `RuntimeScalar(string)` | 当前 ISO 现实时间，按秒更新 |
| `recentBattleTimes` | `RuntimeFlatRecordArray` | 最近 20 条战斗时间记录 |

每条战斗时间记录保持为扁平对象：

```ts
{
  startedAt: '2026-09-02T12:00:00Z',
  endedAt: '2026-09-02T12:00:08Z',
  durationSeconds: 8.125,
  battleDataSequence: 42,
}
```

其中不保存 `Date`、嵌套对象或数组。开始／结束时间使用字符串，持续时间和序号使用数字。

只有 `GameTimeController` 持有的模块 Handle 可以修改这些数据。其他模块可以通过公共读取入口取得副本：

```ts
const battleTimes = context.runtime.publicData.read(
  recentBattleTimesData,
  context.runtimeScopes.game,
);
```

新增战斗计时项必须继续由本模块注册，不能写入地图加载器或 `DungeonRuntime`。

## 兼容边界

旧的游戏/世界运行时兼容层已经删除；组合式 Lab 的时间权威数据只存在于 Runtime Store。
