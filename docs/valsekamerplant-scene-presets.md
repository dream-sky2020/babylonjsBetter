# Valsekamerplant 分类展示预设

原 1239 件总览已拆成 7 个独立主题场景，每次只加载所选主题，最多 411 个模型。模型路径和共享贴图保持不变；全部 1239 条模型路径恰好分配一次。

在 Scene Environment Lab 的预设列表选择以下主题并加载。每个场景在原点附近排列展台，按现有包围盒居中、落地、统一展示大小；不继承千模型总览。原 `artist-valsekamerplant-model-test` 已从目录移除。

| 主题 | 模型数 | 预设键 |
|---|---:|---|
| 灌木 · 全部季节与根部（262 件） | 262 | `artist-valsekamerplant-bushes-model-test` |
| 城市场景 · 围墙、路障、卫生与设施（411 件） | 411 | `artist-valsekamerplant-urban-environment-model-test` |
| 办公 · 家具、设备与杂物（180 件） | 180 | `artist-valsekamerplant-office-model-test` |
| 中世纪 · 建筑、屋顶、装饰与集市（193 件） | 193 | `artist-valsekamerplant-medieval-model-test` |
| 城市道路 · 全部样式与路边构件（104 件） | 104 | `artist-valsekamerplant-urban-roads-model-test` |
| 围栏套件 · 全部材质（79 件） | 79 | `artist-valsekamerplant-fences-model-test` |
| 盆栽 · 植物与花盆（10 件） | 10 | `artist-valsekamerplant-plants-model-test` |

由 `node --experimental-strip-types codex-tools/buildValsekamerplantShowcase.mjs` 生成；该命令会覆盖这些主题预设。`--check` 仅验证生成输入及候选目录，不写文件。布局使用 `codex-tools/model-assets/valsekamerplant/` 的历史包围盒。
