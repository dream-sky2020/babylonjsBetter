import { GAME_EVENTS } from "../event/events.js";

export class HistoryModule {
  constructor(eventBus, manager, options = {}) {
    this.eventBus = eventBus;
    this.manager = manager;
    this.scene = manager.scene;
    this.maxRecords = Math.max(20, Number(options.maxRecords ?? 300));
    this.title = options.title || "历史记录";
    this.unsubscribers = [];
    this.records = [];
    this.ui = {
      adt: null,
      panel: null,
      stack: null,
      titleText: null
    };
  }

  init() {
    if (!window.BABYLON?.GUI) {
      throw new Error("HistoryModule requires Babylon GUI. Please load babylon.gui.min.js.");
    }
    this._createUi();
    this._bindEvents();
  }

  destroy() {
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
    this.ui.adt?.dispose();
    this.records = [];
  }

  toggle() {
    if (!this.ui.panel) return;
    this.ui.panel.isVisible = !this.ui.panel.isVisible;
  }

  show() {
    if (!this.ui.panel) return;
    this.ui.panel.isVisible = true;
  }

  hide() {
    if (!this.ui.panel) return;
    this.ui.panel.isVisible = false;
  }

  clear() {
    this.records = [];
    this._rebuildRecordList();
  }

  _bindEvents() {
    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.DIALOGUE_LINE_CHANGED, (payload) => {
        this._append(payload?.line, payload?.index);
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.DIALOGUE_HISTORY_REQUESTED, () => {
        this.toggle();
      })
    );
  }

  _createUi() {
    const { GUI } = window.BABYLON;
    const adt = GUI.AdvancedDynamicTexture.CreateFullscreenUI("dialogue-history-ui", true, this.scene);
    this.ui.adt = adt;

    const panel = new GUI.Rectangle("dialogue-history-panel");
    panel.width = 0.74;
    panel.height = 0.76;
    panel.cornerRadius = 12;
    panel.thickness = 1;
    panel.color = "#596a98";
    panel.background = "rgba(8,10,18,0.93)";
    panel.isVisible = false;
    adt.addControl(panel);
    this.ui.panel = panel;

    const title = new GUI.TextBlock("dialogue-history-title", this.title);
    title.height = "42px";
    title.top = "-325px";
    title.fontSize = 24;
    title.color = "#dce4ff";
    panel.addControl(title);
    this.ui.titleText = title;

    const closeHint = new GUI.TextBlock("dialogue-history-close-hint", "点击 LOG 按钮关闭");
    closeHint.height = "32px";
    closeHint.top = "-287px";
    closeHint.fontSize = 16;
    closeHint.color = "#93a0c8";
    panel.addControl(closeHint);

    const scroll = new GUI.ScrollViewer("dialogue-history-scroll");
    scroll.width = 0.95;
    scroll.height = 0.83;
    scroll.thickness = 0;
    scroll.top = "22px";
    panel.addControl(scroll);

    const stack = new GUI.StackPanel("dialogue-history-stack");
    stack.isVertical = true;
    stack.spacing = 6;
    stack.paddingLeft = "18px";
    stack.paddingRight = "18px";
    stack.paddingTop = "10px";
    stack.paddingBottom = "10px";
    scroll.addControl(stack);
    this.ui.stack = stack;
  }

  _append(line, index) {
    if (!line) return;
    const speaker = line.speaker || "旁白";
    const text = line.text || "";
    this.records.push({ speaker, text, index });
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }
    this._rebuildRecordList();
  }

  _rebuildRecordList() {
    if (!this.ui.stack) return;
    while (this.ui.stack.children.length > 0) {
      this.ui.stack.removeControl(this.ui.stack.children[0]);
    }

    const { GUI } = window.BABYLON;
    this.records.forEach((record) => {
      const text = new GUI.TextBlock(
        "dialogue-history-line",
        `${record.speaker}：${record.text}`
      );
      text.color = "#d8def7";
      text.fontSize = 20;
      text.height = "30px";
      text.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      text.textWrapping = true;
      this.ui.stack.addControl(text);
    });
  }
}
