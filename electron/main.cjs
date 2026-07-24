const { app, BrowserWindow, ipcMain, screen, Menu } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

// Runtime mode flags:
// - dev: load pages from Vite dev server URL
// - prod: load pages from local dist files
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const rendererBaseUrl = process.env.ELECTRON_RENDERER_URL || null;
const distDir = path.join(__dirname, "..", "dist");
const preloadPath = path.join(__dirname, "preload.cjs");

/** @type {{ mood: "idle" | "happy" | "sleep"; animation_speed: number }} */
let petState = {
  mood: "idle",
  animation_speed: 1,
};

/** @type {NodeJS.Timeout | null} */
let heartbeatTimer = null;
/** @type {BrowserWindow | null} */
let gameWindow = null;
/** @type {BrowserWindow | null} */
let petWindow = null;
const RESOLUTION_PRESETS = [
  { width: 1024, height: 576 },
  { width: 1152, height: 648 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
];

// File used to persist sprite-anchor presets in Electron app data.
const SPRITE_PRESETS_FILENAME = "sprite-anchor-presets.json";

// Resolve app data file path and ensure parent directory exists.
const getSpritePresetPath = () => {
  const dir = app.getPath("userData");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, SPRITE_PRESETS_FILENAME);
};

// Unified page loader:
// - in dev, load from dev server
// - in prod, load built html file
const loadPage = (window, relativePath) => {
  if (rendererBaseUrl) {
    return window.loadURL(`${rendererBaseUrl}/${relativePath}`);
  }
  return window.loadFile(path.join(distDir, relativePath));
};

// Broadcast an event to both windows when they exist.
const sendPetEvent = (channel, payload) => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send(channel, payload);
  }
  if (gameWindow && !gameWindow.isDestroyed()) {
    gameWindow.webContents.send(channel, payload);
  }
};

// Keep pet window docked near the bottom-left of current display.
const positionPetWindow = () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, height } = display.workArea;
  const [width, petHeight] = petWindow.getSize();
  petWindow.setPosition(x + 16, y + height - petHeight - 16);
  petWindow.setSize(width, petHeight);
};

// Create and initialize both app windows:
// - MainGame: regular app window
// - DesktopPet: frameless always-on-top helper window
const createWindows = async () => {
  gameWindow = new BrowserWindow({
    title: "MainGame",
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: true,
    transparent: false,
    frame: true,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  gameWindow.setMenu(null);

  petWindow = new BrowserWindow({
    title: "DesktopPet",
    width: 320,
    height: 320,
    minWidth: 220,
    minHeight: 220,
    show: false,
    transparent: true,
    frame: false,
    shadow: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  positionPetWindow();

  await Promise.all([
    loadPage(gameWindow, "apps/mainGame/index.html"),
    loadPage(petWindow, "apps/desktopPet/index.html?debug=1"),
  ]);
};

// Register all renderer-to-main IPC handlers.
// Handlers are grouped by feature domain:
// - pet state
// - window mode switching
// - sprite preset persistence
const registerIpcHandlers = () => {
  // Return current pet state snapshot.
  ipcMain.handle("pet:get-state", async () => petState);

  // Update pet state and notify renderers.
  ipcMain.handle("pet:set-state", async (_event, payload) => {
    if (payload && typeof payload === "object") {
      petState = {
        mood: payload.mood || "idle",
        animation_speed: Number.isFinite(payload.animation_speed)
          ? Math.max(0.1, Number(payload.animation_speed))
          : 1,
      };
      sendPetEvent("pet://state_changed", petState);
    }
    return petState;
  });

  // Enter pet mode: show pet window, hide game window.
  ipcMain.handle("window:switch-to-pet-mode", async () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.show();
      petWindow.focus();
    }
    if (gameWindow && !gameWindow.isDestroyed()) {
      gameWindow.hide();
    }
  });

  // Enter game mode: show game window, hide pet window.
  ipcMain.handle("window:switch-to-game-mode", async () => {
    if (gameWindow && !gameWindow.isDestroyed()) {
      gameWindow.show();
      gameWindow.focus();
    }
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.hide();
    }
  });

  // Read current main game window display settings and built-in presets.
  ipcMain.handle("window:get-display-settings", async () => {
    if (!gameWindow || gameWindow.isDestroyed()) {
      return {
        width: 1280,
        height: 720,
        fullscreen: false,
        resolutions: RESOLUTION_PRESETS,
      };
    }
    const [width, height] = gameWindow.getSize();
    return {
      width,
      height,
      fullscreen: gameWindow.isFullScreen(),
      resolutions: RESOLUTION_PRESETS,
    };
  });

  // Apply main game window size/fullscreen settings.
  ipcMain.handle("window:apply-display-settings", async (_event, payload) => {
    if (!gameWindow || gameWindow.isDestroyed()) {
      return { ok: false, message: "game window not available" };
    }
    const nextWidth = Number(payload?.width);
    const nextHeight = Number(payload?.height);
    const nextFullscreen = Boolean(payload?.fullscreen);

    if (Number.isFinite(nextWidth) && Number.isFinite(nextHeight)) {
      gameWindow.setSize(Math.max(640, Math.round(nextWidth)), Math.max(360, Math.round(nextHeight)));
    }
    gameWindow.setFullScreen(nextFullscreen);
    const [width, height] = gameWindow.getSize();
    return {
      ok: true,
      width,
      height,
      fullscreen: gameWindow.isFullScreen(),
    };
  });

  // Read sprite presets json from Electron app data.
  ipcMain.handle("sprite-presets:read-json", async () => {
    const filePath = getSpritePresetPath();
    if (!fs.existsSync(filePath)) return "{}";
    return fs.readFileSync(filePath, "utf8");
  });

  // Write sprite presets json to Electron app data.
  ipcMain.handle("sprite-presets:write-json", async (_event, json) => {
    const filePath = getSpritePresetPath();
    fs.writeFileSync(filePath, String(json ?? "{}"), "utf8");
  });
};

// Emit heartbeat events so renderers can track host health/tick.
const startHeartbeat = () => {
  heartbeatTimer = setInterval(() => {
    sendPetEvent("pet://heartbeat", { unix_ms: Date.now() });
  }, 5000);
};

// Stop heartbeat timer during shutdown.
const stopHeartbeat = () => {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
};

// Electron bootstrap:
// 1) register IPC
// 2) create windows
// 3) start heartbeat
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  await createWindows();
  startHeartbeat();

  // macOS convention: recreate windows on dock click when none exists.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindows();
    }
  });
});

// Graceful cleanup before app exits.
app.on("before-quit", () => {
  stopHeartbeat();
});

// Quit app when all windows are closed (except macOS).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Dev-only flag to reduce local CORS friction.
if (isDev) {
  app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");
}
