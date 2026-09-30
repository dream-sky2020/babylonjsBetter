# 俯视顶点变形

`VisualDeformationRegistry` 是每个 Babylon Scene 的显示对象注册表。相机角度继续由 `dungeon-overhead-view` 提供；本层只处理物体高度对应的倾斜、法线、显示包围盒和拾取。它不修改相机、格子布局、模型顶点数据、角色姿态、碰撞或粒子模拟。

## 参数与公式

- `strength`：0 保持原形，1 完整变形，中间值线性混合。
- `mode: automatic`：从统一俯视配置读取 `pitchDeg/yawDeg`，只在正交下补偿。
- `referencePitchDeg`：希望保留的屏幕投影高度所对应的参考俯角；默认 0°，保留正面观察时的竖直高度。
- `heightScale`：世界 Y 高度倍率，默认 1，允许 0.25–4。
- `mode: manual`、`shear`：每单位世界高度沿水平观察轴偏移多少世界单位；负值背离相机，允许 -4–4。此模式也可配合透视俯视。
- `anchor`：对象根节点局部空间中的基准点。世界空间经过它的水平面固定；默认根节点原点。美术原点不在脚底时应显式提供。

设当前俯角为 θ、参考俯角为 φ、高度倍率为 k：自动倾斜量 `s = (k*cos(θ) - cos(φ))/sin(θ)`。相对锚点高度为 h 的顶点，Y 变化为 `h*(k-1)`，水平变化为 `h*s`，再乘强度。当前俯角限定 15°–89.99°，避免水平视角的奇异值。整个对象在世界空间统一变形，子零件、骨骼和旋转不会各自绕不同脚点错开。

地面 X/Z 格距仍由 `core/dungeon-view` 管理，这里不重复应用格子补偿。Dungeon 俯视协调器通过场景 View Consumer 映射场景对象的位置；本层只处理相对于对象锚点的高度倾斜。

## 注册与控制

```ts
const registry = getVisualDeformationRegistry(scene);
const unregister = registry.register({
  id: 'tree:oak:1', groupId: 'trees', tags: ['outdoor'], kind: 'model',
  root, meshes, anchor: [0, 0, 0],
});
const controller = registry.acquire('my-view');
controller.apply(settings, { pitchDeg: 45, yawDeg: 0, projection: 'orthographic' });
// 离开该显示模式：恢复矩阵、拾取、包围盒和深度通道。
controller.release();
unregister();
```

每个 Scene 只允许一个控制者；旧句柄释放后不能继续应用。晚创建对象自动继承设置。对象根销毁自动注销，Scene 销毁释放全部订阅。只在启用变形时订阅渲染前更新；节点动画完成后、活动 Mesh/阴影/深度评估前更新矩阵。

控制“全部”指全部已注册且支持的显示对象，不遍历并改写任意 Shader。规则可选 `id / tag / group / kind`，按此顺序决定优先级，同级最后一条生效；规则强度覆盖默认强度，不连乘。`selection: rules` 时未匹配对象保持原形；强度 0 可作为排除规则。共享材质按每次绘制绑定各自矩阵，不需要克隆材质。

稳定 ID 可以保存；缺省 ID 为 `runtime:<uniqueId>`，组合式 Lab 不把临时对象规则写入快照。热切图期间允许同一个逻辑 ID 的新旧实例短暂共存，一个 Mesh 不能被两个对象重复注册。

## 已接入的创建入口

| 入口 | 默认分组 | 处理方式 |
| --- | --- | --- |
| `createModelEntity` | `models` | GLB/glTF 的 Standard/PBR 材质，整实例共用锚点 |
| `createSceneEnvironment` | `scene-models`、`scene-geometry` | 场景声明 ID 转为稳定 ID，场景 key 为标签 |
| `createAtlasSpritePlane` | 调用方 role | 普通/条纹/消散 Recipe 共用变形 Module |
| `createLayeredMonster` | `monsters` | 多层精灵共用脚底；禁止逐层重复注册 |
| `createCompositeSprite` | `composite-sprites` | 绑定姿态的底部为整个组合的共同锚点 |
| `createSpriteAshEffect` | `effect-preview` | 消散预览精灵 |
| `createBurstParticleEffect` | `particles` | Babylon 粒子 Shader 适配 |
| `createSpriteDeathParticles` | `sprite-death-particles` | 死亡粒子 Shader 适配 |
| `createMonsterStatusParticle` | `status-particles` | CPU SolidParticleSystem Mesh 接材质插件 |

模型、Atlas Plane、多层怪物与组合精灵的创建参数可传 `deformation` 元数据，或 `false` 排除。`createModelEntity` 保留现有 `instantiateModelsToScene` 调用；Babylon 9.11 默认 `doNotInstantiate: true`，得到独立 Mesh 并共享几何/材质，不需要为变形改变旧 Lab 的模型创建策略。其他入口显式创建的硬件实例需由所属创建方改为独立 Mesh 后才能变形。

## 渲染路径与边界

- 当前适配并验证 Babylon **9.11.0 / WebGL2 / GLSL**。Standard/PBR 在骨骼和 Morph 后、世界位置和法线计算前接入仿射矩阵，使用逆转置法线并校正 TBN。
- Sprite Recipe 在自身顶点效果之后应用同一变形，新增 `afterOutput` 插槽复用 alpha 与深度输出。原来的噪声/消散参数不承担俯视配置。
- CPU/GPU 粒子使用独立 Shader 名称复制 Babylon 完整渲染变体，只改变最终显示顶点，原发射、模拟、碰撞及存活期保持不变。启用与卸载保存/恢复已有 Effect；已有自定义粒子 Shader 会被明确排除。
- 阴影通过 `ShadowDepthWrapper` 复用同一源材质。DepthRenderer 使用源材质覆盖对应 render pass，支持线性、非线性、camera-z、浮点/packed 编码；普通及 CSM/DepthReducer 创建的深度渲染器由桥接器自动发现。释放时恢复此前 pass 材质。
- 深度桥接器在一个文件中读取 Babylon 9.11 的 `_depthRenderer`、`_storeNonLinearDepth`、`_storeCameraSpaceZ`；粒子模板和材质注入位置同样与版本相关。升级 Babylon 后必须运行 WebGL 验证，并复核这些适配点。
- 显示包围盒覆盖原形和变形后的范围；普通三角形拾取用逆矩阵转换射线，并返回变形后的世界命中点。骨骼动画和其他非线性 Shader 效果的 CPU 精确拾取仍受 Babylon 原有 CPU 几何能力限制，不等同于完整 GPU 轮廓。
- 未支持：WebGPU/WGSL、硬件/Thin Instances、未知自定义材质和全朝向 Billboard。PrePass/G-buffer/MRT/速度通道尚未适配，开启时对象保持原形并报告原因；关闭后重新应用设置。Outline/Highlight/Gizmo 等独立渲染器未接变形，不能承诺轮廓吻合。屏幕 GUI、SVG/Canvas 和 Three.js 视图不在此 Babylon 世界对象系统内。

## 验证

`npm run test:deformation`：公式、规则、地图 V3 保存恢复、共享材质、拾取/包围盒、生命周期、实际 Lab UI apply/reset/快照、视角发布与模块卸载。

`npm run typecheck:deformation`：共享变形层、Sprite Shader 和组件的类型检查。全仓类型检查存在其他模块的既有错误。

启动开发服务后执行 `npm run test:deformation-webgl`：隐藏 Electron 窗口使用 SwiftShader WebGL2，验证真实 PBR/Standard/骨骼/精灵编译、画面变形和还原、共享材质隔离、阴影、浮点深度、CPU/GPU 粒子四种 blend Shader 及实际绘制，最后启动完整俯视 Lab 并截图。它不是实体显卡/WebGPU 的覆盖证明。可通过 `DEFORMATION_TEST_URL` 指定验证页面 URL。

测试 Lab 使用方法见 `tools/dungeon-overhead-view-lab/README.md`。
