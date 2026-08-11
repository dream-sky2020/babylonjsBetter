# Monster Motion 模式规范

每个完整移动方式放在独立目录：core/monster-motion/modes/<mode-id>/index.ts。

registry.ts 使用 import.meta.glob 自动发现。模式定义同时提供名称、说明、版本、参数 schema 和按标准化进度采样动画的 sample 函数。

配置文件 config/monsterMovementConfigs.json 只保存可复用的配置实例，包含 presetKey、name、modeId 和 parameters。

怪物不绑定移动配置。调用方选择任意配置并传入起点、终点即可播放。
