import { GAME_EVENTS } from "../../event/events.js";

export class ObservableGameManager {
  constructor(engine, scene, camera, eventBus) {
    if (!engine || !scene || !camera) {
      throw new Error("ObservableGameManager requires engine, scene, and camera.");
    }
    if (!eventBus) {
      throw new Error("ObservableGameManager requires an eventBus.");
    }
    this.engine = engine;
    this.scene = scene;
    this.camera = camera;
    this.eventBus = eventBus;
    this.entities = new Map();
    this.targetFPS = 60;
    this.isPaused = false;
    this._lastRenderTime = 0;
    this._renderLoopBound = this._renderLoop.bind(this);
    this._defaultCameraPosition = camera.position.clone();
  }

  initializeDefaultEntities() {
    this.addObject("plane", {
      id: "player",
      width: 1.2,
      height: 1.2,
      color: "#4ea8ff",
      position: { x: 0, y: 0, z: 0 },
      speed: 0
    });
  }

  start() {
    this.engine.runRenderLoop(this._renderLoopBound);
  }

  pause() {
    if (this.isPaused) return;
    this.isPaused = true;
    this.engine.stopRenderLoop(this._renderLoopBound);
    this.emit(GAME_EVENTS.PAUSED, { isPaused: true });
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this._lastRenderTime = 0;
    this.engine.runRenderLoop(this._renderLoopBound);
    this.emit(GAME_EVENTS.RESUMED, { isPaused: false });
  }

  setTargetFPS(fps) {
    const value = Number(fps);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("setTargetFPS(fps) requires a positive number.");
    }
    this.targetFPS = value;
    this.emit(GAME_EVENTS.FPS_CHANGED, { targetFPS: this.targetFPS });
  }

  resetGame() {
    for (const id of [...this.entities.keys()]) {
      this.removeObject(id);
    }
    this.camera.position.copyFrom(this._defaultCameraPosition);
    this.initializeDefaultEntities();
    this.emit(GAME_EVENTS.GAME_RESET, { entities: [...this.entities.keys()] });
  }

  updateEntity(id, properties = {}) {
    const BABYLON = window.BABYLON;
    const entity = this.entities.get(id);
    if (!entity) {
      throw new Error(`Entity "${id}" does not exist.`);
    }
    const { mesh } = entity;

    if (properties.position) {
      const { x = mesh.position.x, y = mesh.position.y, z = mesh.position.z } = properties.position;
      mesh.position.set(x, y, z);
    }
    if (properties.rotation) {
      const { x = mesh.rotation.x, y = mesh.rotation.y, z = mesh.rotation.z } = properties.rotation;
      mesh.rotation.set(x, y, z);
    }
    if (properties.scaling) {
      const { x = mesh.scaling.x, y = mesh.scaling.y, z = mesh.scaling.z } = properties.scaling;
      mesh.scaling.set(x, y, z);
    }
    if (typeof properties.visible === "boolean") {
      mesh.isVisible = properties.visible;
    }
    if (typeof properties.speed === "number") {
      entity.speed = properties.speed;
    }
    if (typeof properties.isCustomControlled === "boolean") {
      entity.isCustomControlled = properties.isCustomControlled;
    }
    if (properties.color) {
      if (!mesh.material) {
        mesh.material = new BABYLON.StandardMaterial(`${id}-mat`, this.scene);
      }
      const color = BABYLON.Color3.FromHexString(properties.color);
      mesh.material.diffuseColor = color;
      mesh.material.emissiveColor = color.scale(0.2);
    }

    this.emit(GAME_EVENTS.ENTITY_UPDATED, { id, properties });
  }

  addObject(type, config = {}) {
    const BABYLON = window.BABYLON;
    const id = config.id || `${type}-${Math.random().toString(36).slice(2, 8)}`;
    if (this.entities.has(id)) {
      throw new Error(`Entity "${id}" already exists.`);
    }

    let mesh;
    if (type === "plane") {
      mesh = BABYLON.MeshBuilder.CreatePlane(
        id,
        { width: config.width ?? 1, height: config.height ?? 1 },
        this.scene
      );
    } else if (type === "line") {
      const points = config.points || [
        new BABYLON.Vector3(-1, 0, 0),
        new BABYLON.Vector3(1, 0, 0)
      ];
      mesh = BABYLON.MeshBuilder.CreateLines(id, { points }, this.scene);
    } else {
      throw new Error(`Unsupported object type "${type}". Use "plane" or "line".`);
    }

    const entity = {
      id,
      type,
      mesh,
      speed: config.speed ?? 0,
      isCustomControlled: Boolean(config.isCustomControlled)
    };
    this.entities.set(id, entity);
    this.updateEntity(id, config);
    this.emit(GAME_EVENTS.OBJECT_ADDED, { id, type, config });
    return id;
  }

  removeObject(id) {
    const entity = this.entities.get(id);
    if (!entity) return false;
    entity.mesh.dispose(false, true);
    this.entities.delete(id);
    this.emit(GAME_EVENTS.OBJECT_REMOVED, { id });
    return true;
  }

  subscribe(eventName, callback) {
    return this.eventBus.subscribe(eventName, callback);
  }

  emit(eventName, data) {
    this.eventBus.emit(eventName, data);
  }

  async toggleDebugLayer() {
    if (this.scene.debugLayer.isVisible()) {
      this.scene.debugLayer.hide();
      this.emit(GAME_EVENTS.DEBUG_LAYER_TOGGLED, { visible: false });
      return false;
    }

    if (!window.BABYLON?.Inspector) {
      await this._loadInspectorScript();
    }
    await this.scene.debugLayer.show();
    this.emit(GAME_EVENTS.DEBUG_LAYER_TOGGLED, { visible: true });
    return true;
  }

  captureScreenshot() {
    return new Promise((resolve) => {
      const BABYLON = window.BABYLON;
      BABYLON.Tools.CreateScreenshotUsingRenderTarget(
        this.engine,
        this.camera,
        { width: 1280, height: 720 },
        (data) => {
          this.emit(GAME_EVENTS.SCREENSHOT_CAPTURED, { dataUrl: data });
          resolve(data);
        },
        "image/png"
      );
    });
  }

  _renderLoop() {
    for (const entity of this.entities.values()) {
      // 如果实体有自定义的移动逻辑，不要在此处自动位移
      if (entity.isCustomControlled) continue;

      if (entity.speed && entity.mesh) {
        entity.mesh.position.x += entity.speed;
      }
    }

    this.scene.render();
  }

  _loadInspectorScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.babylonjs.com/inspector/babylon.inspector.bundle.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Babylon Inspector."));
      document.head.appendChild(script);
    });
  }
}
