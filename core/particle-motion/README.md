# Particle Motion 插件规范

每个运动模式放在独立目录中：

```text
core/particle-motion/modes/<mode-id>/index.ts
```

`registry.ts` 使用 `import.meta.glob('./modes/*/index.ts')` 自动发现所有模式，禁止手工维护模式列表。

## 最小模板

```ts
import { defineParticleMotion } from '../../defineParticleMotion';

type ExampleState = {
  phase: number;
};

export default defineParticleMotion<ExampleState>({
  id: 'example',
  name: '示例模式',
  description: '说明该模式的运动效果。',
  version: 1,
  parameters: {
    speed: {
      type: 'number',
      label: '速度',
      default: 1,
      min: 0,
      max: 10,
      step: 0.1,
      group: '运动'
    }
  },
  createState: ({ random }) => ({ phase: random() * Math.PI * 2 }),
  initialize: (particle, state) => {
    particle.position.x = Math.cos(state.phase);
  },
  update: (particle, state, context, parameters) => {
    state.phase += Number(parameters.speed) * context.deltaSeconds;
    particle.position.x = Math.cos(state.phase);
  }
});
```

## 生命周期

- `createState`：为每个粒子创建模式私有状态。
- `initialize`：生成或重新生成粒子时设置初始状态。
- `update`：每个模拟帧更新粒子，不能操作 React 状态或 DOM。

## 参数类型

目前参数面板自动支持：

- `number`
- `boolean`
- `select`
- `vector3`

参数结构发生不兼容变化时必须增加 `version`。模式 `id` 必须全局唯一，重复 ID 会在启动时直接报错。
