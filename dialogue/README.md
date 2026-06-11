# dialogue 模块说明

`dialogue-module.js` 提供一个基于 Babylon.js 的文字冒险 UI，`history-module.js` 提供独立历史面板：

- 立绘、背景、控制按钮全部使用 3D `Plane`
- 文字显示使用 `BABYLON.GUI`
- 支持 `textureUrl` 配置：背景、立绘、按钮图标均可替换为真实图片资源
- 历史记录面板由独立 `HistoryModule` 实现，通过事件与 `DialogueModule` 对接
- 支持手动推进、自动播放、跳过、1x/2x/3x 速度、隐藏/显示、历史回看

## 接入方式

1. 在 `index.html` 引入 GUI：

```html
<script src="https://cdn.babylonjs.com/gui/babylon.gui.min.js"></script>
```

2. 创建并初始化模块：

```js
import { DialogueModule } from "./dialogue/dialogue-module.js";
import { HistoryModule } from "./dialogue/history-module.js";

const historyModule = new HistoryModule(eventBus, manager);
const dialogueModule = new DialogueModule(eventBus, manager, {
  defaultVisuals: {
    background: { textureUrl: "./assets/bg/default.png" },
    leftPortrait: { textureUrl: "./assets/portrait/hero.png" },
    rightPortrait: { textureUrl: "./assets/portrait/npc.png" }
  },
  buttonIcons: {
    skip: { textureUrl: "./assets/ui/skip.png" },
    auto: { textureUrl: "./assets/ui/auto.png" },
    speed: { textureUrl: "./assets/ui/speed.png" },
    hide: { textureUrl: "./assets/ui/hide.png" },
    history: { textureUrl: "./assets/ui/log.png" }
  },
  lines
});
historyModule.init();
dialogueModule.init();
dialogueModule.start();
```

## 对话数据结构

`lines` 是数组，每条结构如下：

```js
{
  speaker: "角色名",
  text: "当前对白内容",
  background: {
    color: "#1d2e52",                  // 无贴图时可用纯色
    textureUrl: "./assets/bg/scene1.png" // 有贴图则优先贴图
  },
  portraits: {
    left: {
      label: "YOU",
      baseColor: "#263e66",
      accentColor: "#8db0ff",
      textureUrl: "./assets/portrait/you-idle.png"
    },
    right: {
      label: "MIO",
      baseColor: "#3b2f55",
      accentColor: "#ffc6f2",
      textureUrl: "./assets/portrait/mio-smile.png"
    }
  }
}
```

说明：

- `background.textureUrl`：当前句背景贴图（3D 背景 Plane）
- `portraits.left.textureUrl` / `portraits.right.textureUrl`：左右立绘贴图（3D 立绘 Plane）
- `buttonIcons.*.textureUrl`：控制按钮图标贴图（3D 按钮 Plane）
- 如果未提供 `textureUrl`，模块会自动回退到占位材质（纯色/文字）

## 交互说明

- 空格/回车：下一句（由 `INPUT_CONFIRM` 事件驱动）
- `SKIP`：快速跳过（会自动播放）
- `AUTO`：自动播放
- `1x/2x/3x`：播放速度循环切换
- `HIDE/SHOW`：隐藏或显示对话可视层
- `LOG`：仅触发历史按钮事件（具体历史面板由外部模块实现）

## 常用 API

- `setScript(lines)`：替换剧情脚本并重置进度
- `start()`：从第一句开始播放
- `next()`：手动推进一句
- `toggleAuto()` / `toggleSkip()` / `cycleSpeed()`
- `toggleHide()` / `toggleHistory()`
- `destroy()`：销毁 UI、Mesh、事件监听

## 历史按钮事件

`LOG` 按钮不再管理内置历史面板，只会发出事件，供外部模块接管：

- `eventBus.emit(GAME_EVENTS.DIALOGUE_HISTORY_REQUESTED, payload)`
- `payload` 结构：`{ source, index, line }`

`DialogueModule` 每次切换到新句子时会发出：

- `eventBus.emit(GAME_EVENTS.DIALOGUE_LINE_CHANGED, { source, index, line })`

`HistoryModule` 默认就会订阅上面两个事件并自动工作。

也可在构造参数传入回调：

```js
const dialogueModule = new DialogueModule(eventBus, manager, {
  lines,
  onHistoryRequested(payload) {
    console.log("history request", payload);
  }
});
```
