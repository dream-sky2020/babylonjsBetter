import { GAME_EVENTS } from "../event/events.js";

export class DialogueModule {
  constructor(eventBus, manager, options = {}) {
    this.eventBus = eventBus;
    this.manager = manager;
    this.scene = manager.scene;
    this.camera = manager.camera;

    this.lines = Array.isArray(options.lines) ? options.lines : [];
    this.index = 0;
    this.visible = true;
    this.isAuto = false;
    this.isSkip = false;
    this.playbackSpeeds = [1, 2, 3];
    this.speedIndex = 0;
    this.buttonIcons = options.buttonIcons || {};
    this.defaultVisuals = options.defaultVisuals || {};
    this.onHistoryRequested =
      typeof options.onHistoryRequested === "function" ? options.onHistoryRequested : null;
    this.autoTimer = null;
    this.unsubscribers = [];

    this.meshes = {
      background: null,
      leftPortrait: null,
      rightPortrait: null,
      controls: {}
    };
    this.materials = {
      background: null,
      leftPortrait: null,
      rightPortrait: null,
      controls: {}
    };
    this.ui = {
      adt: null,
      dialoguePanel: null,
      speakerText: null,
      contentText: null,
      modeHintText: null
    };
    this._onResizeOrRenderBound = this._layoutPlanes.bind(this);
  }

  init() {
    if (!window.BABYLON?.GUI) {
      throw new Error("DialogueModule requires Babylon GUI. Please load babylon.gui.min.js.");
    }

    this._createScenePlanes();
    this._createTextUi();
    this._bindInputEvents();
    this._layoutPlanes();
    this.scene.onBeforeRenderObservable.add(this._onResizeOrRenderBound);
  }

  destroy() {
    this._clearAutoTimer();
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];

    if (this.scene.onBeforeRenderObservable.hasObservers()) {
      this.scene.onBeforeRenderObservable.removeCallback(this._onResizeOrRenderBound);
    }

    Object.values(this.meshes.controls).forEach((mesh) => mesh?.dispose(false, true));
    this.meshes.background?.dispose(false, true);
    this.meshes.leftPortrait?.dispose(false, true);
    this.meshes.rightPortrait?.dispose(false, true);

    this.ui.adt?.dispose();
  }

  setScript(lines = []) {
    this.lines = Array.isArray(lines) ? lines : [];
    this.index = 0;
  }

  start() {
    if (this.lines.length === 0) return;
    this.index = 0;
    this._renderCurrentLine();
    this._scheduleAuto();
  }

  next() {
    if (this.lines.length === 0) return;
    if (this.index >= this.lines.length - 1) {
      this._clearAutoTimer();
      this.ui.modeHintText.text = "对话结束";
      return;
    }
    this.index += 1;
    this._renderCurrentLine();
    this._scheduleAuto();
  }

  toggleAuto() {
    this.isAuto = !this.isAuto;
    if (this.isAuto) {
      this.isSkip = false;
    }
    this._updateControlLabels();
    this._scheduleAuto();
  }

  toggleSkip() {
    this.isSkip = !this.isSkip;
    if (this.isSkip) {
      this.isAuto = true;
    }
    this._updateControlLabels();
    this._scheduleAuto();
  }

  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % this.playbackSpeeds.length;
    this._updateControlLabels();
    this._scheduleAuto();
  }

  toggleHide() {
    this.visible = !this.visible;
    this._setVisualVisibility(this.visible);
    this._updateControlLabels();
  }

  toggleHistory() {
    const payload = {
      source: "dialogue-module",
      index: this.index,
      line: this.lines[this.index] || null
    };
    if (this.onHistoryRequested) {
      this.onHistoryRequested(payload);
    }
    this.eventBus.emit(GAME_EVENTS.DIALOGUE_HISTORY_REQUESTED, payload);
    this.ui.modeHintText.text = "已触发历史记录按钮（由外部模块处理）";
  }

  _bindInputEvents() {
    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.INPUT_CONFIRM, () => {
        this.next();
      })
    );
  }

  _createScenePlanes() {
    const { BABYLON } = window;

    this.meshes.background = BABYLON.MeshBuilder.CreatePlane(
      "dialogue-bg-plane",
      { width: 20, height: 12 },
      this.scene
    );
    this.meshes.background.position.z = 2;
    this.materials.background = this._createBackgroundMaterial(this.defaultVisuals.background || {});
    this.meshes.background.material = this.materials.background;

    this.meshes.leftPortrait = BABYLON.MeshBuilder.CreatePlane(
      "dialogue-left-portrait",
      { width: 4.4, height: 7.2 },
      this.scene
    );
    this.meshes.leftPortrait.position.set(-4.2, -0.2, 0.6);
    this.materials.leftPortrait = this._createPortraitMaterial("dialogue-left-portrait-mat", this.defaultVisuals.leftPortrait, {
      baseColor: "#24314e",
      accentColor: "#89b4fa",
      text: "LEFT"
    });
    this.meshes.leftPortrait.material = this.materials.leftPortrait;

    this.meshes.rightPortrait = BABYLON.MeshBuilder.CreatePlane(
      "dialogue-right-portrait",
      { width: 4.4, height: 7.2 },
      this.scene
    );
    this.meshes.rightPortrait.position.set(4.2, -0.2, 0.5);
    this.materials.rightPortrait = this._createPortraitMaterial("dialogue-right-portrait-mat", this.defaultVisuals.rightPortrait, {
      baseColor: "#3a2f4f",
      accentColor: "#f5c2e7",
      text: "RIGHT"
    });
    this.meshes.rightPortrait.material = this.materials.rightPortrait;

    this.meshes.controls.skip = this._createControlPlane("skip", "dialogue-btn-skip", "SKIP", () => this.toggleSkip());
    this.meshes.controls.auto = this._createControlPlane("auto", "dialogue-btn-auto", "AUTO", () => this.toggleAuto());
    this.meshes.controls.speed = this._createControlPlane("speed", "dialogue-btn-speed", "1x", () => this.cycleSpeed());
    this.meshes.controls.hide = this._createControlPlane("hide", "dialogue-btn-hide", "HIDE", () => this.toggleHide());
    this.meshes.controls.history = this._createControlPlane("history", "dialogue-btn-history", "LOG", () => this.toggleHistory());
  }

  _createTextUi() {
    const { GUI } = window.BABYLON;
    const adt = GUI.AdvancedDynamicTexture.CreateFullscreenUI("dialogue-text-ui", true, this.scene);
    this.ui.adt = adt;

    const panel = new GUI.Rectangle("dialogue-text-panel");
    panel.width = 0.86;
    panel.height = "230px";
    panel.cornerRadius = 16;
    panel.thickness = 0;
    panel.background = "rgba(10,12,20,0.82)";
    panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.top = "-20px";
    panel.paddingLeft = "22px";
    panel.paddingRight = "22px";
    panel.paddingTop = "16px";
    panel.paddingBottom = "16px";
    adt.addControl(panel);
    this.ui.dialoguePanel = panel;

    const speaker = new GUI.TextBlock("dialogue-speaker", "");
    speaker.color = "#FFD98A";
    speaker.fontSize = 30;
    speaker.height = "42px";
    speaker.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    speaker.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    speaker.paddingBottom = "8px";
    panel.addControl(speaker);
    this.ui.speakerText = speaker;

    const content = new GUI.TextBlock("dialogue-content", "");
    content.color = "#F1F4FF";
    content.fontSize = 26;
    content.textWrapping = true;
    content.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    content.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    content.top = "20px";
    panel.addControl(content);
    this.ui.contentText = content;

    const hint = new GUI.TextBlock("dialogue-hint", "");
    hint.color = "#A7B2D5";
    hint.fontSize = 18;
    hint.height = "30px";
    hint.top = "86px";
    hint.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    hint.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.addControl(hint);
    this.ui.modeHintText = hint;

  }

  _layoutPlanes() {
    if (!this.camera || this.camera.mode !== window.BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      return;
    }
    const left = this.camera.orthoLeft ?? -8;
    const right = this.camera.orthoRight ?? 8;
    const bottom = this.camera.orthoBottom ?? -6;

    const spacing = 2;
    const startX = right - 1.4 - spacing * 4;
    const y = bottom + 1.0;
    const z = -0.9;

    this.meshes.controls.skip.position.set(startX + spacing * 0, y, z);
    this.meshes.controls.auto.position.set(startX + spacing * 1, y, z);
    this.meshes.controls.speed.position.set(startX + spacing * 2, y, z);
    this.meshes.controls.hide.position.set(startX + spacing * 3, y, z);
    this.meshes.controls.history.position.set(startX + spacing * 4, y, z);

    this.meshes.background.position.set((left + right) * 0.5, 0, 2);
  }

  _renderCurrentLine() {
    const line = this.lines[this.index];
    if (!line) return;

    this.ui.speakerText.text = line.speaker || "旁白";
    this.ui.contentText.text = line.text || "";
    this.ui.modeHintText.text = this._buildModeHint();

    this._updateBackground(line.background);
    this._updatePortraits(line.portraits);
    this._updateControlLabels();
    this.eventBus.emit(GAME_EVENTS.DIALOGUE_LINE_CHANGED, {
      source: "dialogue-module",
      index: this.index,
      line
    });
  }

  _scheduleAuto() {
    this._clearAutoTimer();
    if (!this.isAuto) {
      return;
    }
    if (this.index >= this.lines.length - 1) {
      return;
    }

    const speed = this.playbackSpeeds[this.speedIndex];
    const baseMs = this.isSkip ? 220 : 2200;
    const delay = baseMs / speed;
    this.autoTimer = window.setTimeout(() => {
      this.next();
    }, delay);
  }

  _clearAutoTimer() {
    if (this.autoTimer) {
      window.clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }

  _setVisualVisibility(visible) {
    this.meshes.background.isVisible = visible;
    this.meshes.leftPortrait.isVisible = visible;
    this.meshes.rightPortrait.isVisible = visible;
    Object.values(this.meshes.controls).forEach((mesh) => {
      mesh.isVisible = true;
    });
    this.ui.dialoguePanel.isVisible = visible;
  }

  _updateBackground(background = {}) {
    const merged = { ...(this.defaultVisuals.background || {}), ...(background || {}) };
    this._replaceMeshMaterial("background", this.meshes.background, this._createBackgroundMaterial(merged));
  }

  _updatePortraits(portraits = {}) {
    if (portraits.left || this.defaultVisuals.leftPortrait) {
      const mergedLeft = { ...(this.defaultVisuals.leftPortrait || {}), ...(portraits.left || {}) };
      this._replaceMeshMaterial(
        "leftPortrait",
        this.meshes.leftPortrait,
        this._createPortraitMaterial("dialogue-left-portrait-mat", mergedLeft, {
          baseColor: mergedLeft.baseColor || "#25395f",
          accentColor: mergedLeft.accentColor || "#8db0ff",
          text: mergedLeft.label || "LEFT"
        })
      );
    }
    if (portraits.right || this.defaultVisuals.rightPortrait) {
      const mergedRight = { ...(this.defaultVisuals.rightPortrait || {}), ...(portraits.right || {}) };
      this._replaceMeshMaterial(
        "rightPortrait",
        this.meshes.rightPortrait,
        this._createPortraitMaterial("dialogue-right-portrait-mat", mergedRight, {
          baseColor: mergedRight.baseColor || "#3d3157",
          accentColor: mergedRight.accentColor || "#ffc4ef",
          text: mergedRight.label || "RIGHT"
        })
      );
    }
  }

  _updateControlLabels() {
    this._setControlVisual(
      "skip",
      this.meshes.controls.skip,
      this.isSkip ? "SKIP*" : "SKIP",
      this.isSkip ? "#F9E2AF" : "#CAD3F5"
    );
    this._setControlVisual(
      "auto",
      this.meshes.controls.auto,
      this.isAuto ? "AUTO*" : "AUTO",
      this.isAuto ? "#A6E3A1" : "#CAD3F5"
    );
    this._setControlVisual(
      "speed",
      this.meshes.controls.speed,
      `${this.playbackSpeeds[this.speedIndex]}x`,
      "#89DCEB"
    );
    this._setControlVisual(
      "hide",
      this.meshes.controls.hide,
      this.visible ? "HIDE" : "SHOW",
      "#F5C2E7"
    );
    this._setControlVisual(
      "history",
      this.meshes.controls.history,
      "LOG",
      "#FAB387"
    );
    this.ui.modeHintText.text = this._buildModeHint();
  }

  _buildModeHint() {
    const speed = this.playbackSpeeds[this.speedIndex];
    const mode = this.isSkip ? "跳过中" : this.isAuto ? "自动播放" : "手动";
    return `模式：${mode} | 速度：${speed}x | 空格/回车：下一句`;
  }

  _createControlPlane(controlKey, id, label, onPick) {
    const { BABYLON } = window;
    const mesh = BABYLON.MeshBuilder.CreatePlane(id, { width: 1.6, height: 0.7 }, this.scene);
    mesh.position.z = -0.9;
    mesh.isPickable = true;
    mesh.renderingGroupId = 4;
    this._setControlVisual(controlKey, mesh, label, "#cad3f5");

    mesh.actionManager = new BABYLON.ActionManager(this.scene);
    mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
      onPick();
    }));
    return mesh;
  }

  _setControlVisual(controlKey, mesh, label, accentColor) {
    if (!mesh) return;
    const iconConfig = this.buttonIcons[controlKey];
    let mat;
    if (iconConfig?.textureUrl) {
      mat = this._createTextureMaterial(`${mesh.name}-icon-mat`, iconConfig.textureUrl, {
        tintColor: accentColor
      });
    } else {
      const matName = `${mesh.name}-mat-${label}-${accentColor}`;
      mat = this._createTextMaterial(matName, {
        baseColor: "#1f2433",
        accentColor,
        text: label,
        fontSize: 84
      });
    }
    this._replaceMeshMaterial(`control:${controlKey}`, mesh, mat);
  }

  _replaceMeshMaterial(slot, mesh, material) {
    if (!mesh || !material) return;
    const old =
      slot.startsWith("control:")
        ? this.materials.controls[slot]
        : this.materials[slot];
    if (old && old !== material) {
      old.dispose(true, true);
    }
    mesh.material = material;
    if (slot.startsWith("control:")) {
      this.materials.controls[slot] = material;
    } else {
      this.materials[slot] = material;
    }
  }

  _createColorMaterial(name, hex) {
    const { BABYLON } = window;
    const mat = new BABYLON.StandardMaterial(name, this.scene);
    const color = BABYLON.Color3.FromHexString(hex);
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.12);
    mat.specularColor = BABYLON.Color3.Black();
    return mat;
  }

  _createTextureMaterial(name, textureUrl, options = {}) {
    const { BABYLON } = window;
    const mat = new BABYLON.StandardMaterial(name, this.scene);
    const tex = new BABYLON.Texture(textureUrl, this.scene, false, true);
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.backFaceCulling = false;
    mat.specularColor = BABYLON.Color3.Black();
    if (options.tintColor) {
      mat.emissiveColor = BABYLON.Color3.FromHexString(options.tintColor).scale(0.35);
    }
    return mat;
  }

  _createBackgroundMaterial(config = {}) {
    if (config.textureUrl) {
      return this._createTextureMaterial("dialogue-bg-tex-mat", config.textureUrl);
    }
    return this._createColorMaterial("dialogue-bg-mat", config.color || "#1f2a44");
  }

  _createPortraitMaterial(name, config = {}, fallback = {}) {
    if (config?.textureUrl) {
      return this._createTextureMaterial(name, config.textureUrl);
    }
    return this._createTextMaterial(name, fallback);
  }

  _createTextMaterial(name, options = {}) {
    const { BABYLON } = window;
    const dt = new BABYLON.DynamicTexture(`${name}-dt`, { width: 512, height: 512 }, this.scene, true);
    const ctx = dt.getContext();
    const baseColor = options.baseColor || "#262a3b";
    const accentColor = options.accentColor || "#d9e0ee";
    const text = options.text || "";
    const fontSize = options.fontSize ?? 120;

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, 492, 492);
    ctx.fillStyle = accentColor;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 262);
    dt.update();

    const mat = new BABYLON.StandardMaterial(name, this.scene);
    mat.diffuseTexture = dt;
    mat.emissiveTexture = dt;
    mat.specularColor = BABYLON.Color3.Black();
    return mat;
  }
}
