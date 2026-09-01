# Runtime Store

`core/runtime/` 是业务无关的中央浅数据容器。目前不会自动替代
`GameRuntime`、`WorldRuntime` 或 `DungeonRuntime`。

组合式 Lab 不应自行调用 createRuntimeDataStore()；createLab() 已为每个页面创建独立实例，并通过 context.runtime 提供给所有模块。

## 基本流程

```ts
type ClockData = { playTimeSeconds: number; running: boolean };

const clockData = defineRuntimeData<ClockData>({
  key: 'game.clock',
  moduleId: 'game-clock',
  scope: 'world',
  visibility: 'public',
  persistence: 'full',
  version: 1,
  createDefault: () => ({ playTimeSeconds: 0, running: false }),
});

const runtime = createRuntimeDataStore();
const worldScope = runtime.createScope({ kind: 'world', key: 'main-world' });
const clockModule = runtime.registerModule('game-clock');
clockModule.registerData(clockData);

const clock = clockModule.openScope(worldScope);
clock.ensure(clockData);
clock.update(clockData, (current) => ({
  ...current!,
  playTimeSeconds: current!.playTimeSeconds + 1,
}));

const publicCopy = runtime.publicData.read(clockData, worldScope);
```

## 当前约束

- 每个 ModuleID 只能注册一次。
- Data Key 在整个 Store 中必须唯一。
- 同一个 `kind:key` Scope 只能存在一个；使用 `findScope()` 查找已有 Scope。
- 只有注册数据的模块 Handle 能读写 Private 数据和修改 Public 数据。
- Public Reader 对 Private 数据返回 `null`，订阅 Private 数据会抛错。
- 数据必须是单层对象；字段只能是有限数字、字符串、布尔值、`null` 或这些值的一维数组。
- Store 在读、写和事件通知边界复制数据，调用方不能通过保留引用绕过写权限。
- `inspect()` 会枚举已有数据，但 Private 值会被脱敏。

## 尚未实现

- `none / full / delta` 的快照生成和恢复。
- 数据版本迁移。
- 预设基准与差分 Codec。
- 当前激活 World/Dungeon/Session 的编排。
- Babylon.js Scene、Mesh、Binding 等非存档资源管理。