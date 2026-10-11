# Valsekamerplant 展示预设生成输入

`manifest.json` 与 `validation.json` 是共享贴图迁移前的导入清单及 Babylon.js 包围盒测量记录，供 `scripts/buildValsekamerplantShowcase.mjs` 生成展示布局。模型路径和几何未因贴图迁移改变，因此仍可用于布局；记录中的 SHA-256 是迁移前哈希，不代表当前 GLB。

当前模型与图片哈希以 `public/resources/Model/SharedTextures/artist_valsekamerplant/valsekamerplant-manifest.json` 为准。这里只保存开发输入，不参与 public 资源发布。
