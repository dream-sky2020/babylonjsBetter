const { contextBridge, ipcRenderer } = require("electron");

// Expose a minimal, controlled API to renderer:
// - invoke: request/response IPC
// - listen: event subscription with unsubscribe
contextBridge.exposeInMainWorld("electronAPI", {
  // Runtime marker used by renderer to detect Electron host.
  runtime: "electron",

  // Call ipcMain.handle(channel, ...) from renderer.
  invoke(channel, payload) {
    return ipcRenderer.invoke(channel, payload);
  },

  // Subscribe to main-process pushed events.
  // Returns an unsubscribe function for cleanup.
  listen(channel, callback) {
    const listener = (_event, payload) => {
      callback(payload);
    };
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
});
