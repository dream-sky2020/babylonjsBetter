# Runtime Store

`core/runtime/` 是业务无关的中央浅数据容器。目前不会自动替代
`GameRuntime`、`WorldRuntime` 或 `DungeonRuntime`。

组合式 Lab 不应自行调用 `createRuntimeDataStore()`；`createLab()` 已为每个页面创建独立实例，并通过 `context.runtime` 提供给所有模块。

## Runtime Value

每个 Data Key 直接对应以下四种值之一：

```ts
type RuntimeScalar = string | number | boolean | null;
type RuntimeFlatRecord = Readonly<Record<string, RuntimeScalar>>;
type RuntimeScalarArray = readonly RuntimeScalar[];
type RuntimeFlatRecordArray = readonly RuntimeFlatRecord[];
```

允许：

```ts
120
['door-a', 'door-b', null]
{ id: 'door-a', active: true }
[
  { id: 'door-a', active: true },
  { id: 'door-b', active: false },
]
```

不允许数组嵌套、对象嵌套、对象字段包含数组，或在同一数组中混合基础值和对象：

```ts
[[1, 2], [3, 4]]
{ position: { x: 1, y: 2 } }
{ tags: ['a', 'b'] }
[1, { id: 'door-a' }]
```

空数组是合法的 `RuntimeScalarArray`；第一次写入非空内容时由对应数据定义的类型和校验器确定元素结构。

`null` 是合法数据，因此 Store 使用 `undefined` 表示数据不存在或已被删除。Public Reader 读取 Private 数据仍返回 `null`；调用方可据此区分权限拒绝与缺失数据。

## 基本流程

```ts
const playTimeSeconds = defineRuntimeData<number>({
  key: 'playTimeSeconds',
  moduleId: 'game-time',
  scope: 'game',
  visibility: 'public',
  persistence: 'full',
  version: 1,
  createDefault: () => 0,
});

const runtime = createRuntimeDataStore();
const gameScope = runtime.createScope({ kind: 'game', key: 'main' });
const timeModule = runtime.registerModule('game-time');
timeModule.registerData(playTimeSeconds);

const time = timeModule.openScope(gameScope);
time.ensure(playTimeSeconds);
time.update(playTimeSeconds, (current) => (current ?? 0) + 1);

const publicCopy = runtime.publicData.read(playTimeSeconds, gameScope);
```

## 当前约束

- 每个 ModuleID 只能注册一次。
- Data Key 在整个 Store 中必须唯一。
- 同一个 `kind:key` Scope 只能存在一个；使用 `findScope()` 查找已有 Scope。
- 只有注册数据的模块 Handle 能读写 Private 数据和修改 Public 数据。
- Public Reader 对 Private 数据返回 `null`，订阅 Private 数据会抛错。
- Store 在读、写和事件通知边界复制数据，调用方不能通过保留引用绕过写权限。
- `inspect()` 会枚举已有数据，但 Private 值会被脱敏。

## 尚未实现

- `none / full / delta` 的快照生成和恢复。
- 数据版本迁移。
- 预设基准与差分 Codec。
- 当前激活 World/Dungeon/Session 的编排。
- Babylon.js Scene、Mesh、Binding 等非存档资源管理。