const { app, ipcMain } = require("electron");

function registerAppMemoryHandler() {
  ipcMain.handle("performance:get-app-memory", event => {
    if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return null;

    const isWindows = process.platform === "win32";
    const field = isWindows ? "privateBytes" : "workingSetSize";
    const processes = app.getAppMetrics();
    if (!processes.length) return null;
    let kib = 0;
    for (const { memory } of processes) {
      const value = memory[field];
      if (!Number.isFinite(value) || value < 0) return null;
      kib += value;
    }
    return {
      kind: isWindows ? "private-commit" : "working-set-sum",
      bytes: kib * 1024,
    };
  });
}

module.exports = { registerAppMemoryHandler };
