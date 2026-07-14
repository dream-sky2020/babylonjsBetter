type ElectronRuntime = "electron";

type ElectronInvokeChannel =
  | "pet:get-state"
  | "pet:set-state"
  | "window:switch-to-pet-mode"
  | "window:switch-to-game-mode"
  | "sprite-presets:read-json"
  | "sprite-presets:write-json";

type ElectronEventChannel = "pet://state_changed" | "pet://heartbeat";

type ElectronApiBridge = {
  runtime: ElectronRuntime;
  invoke: (channel: ElectronInvokeChannel, payload?: unknown) => Promise<unknown>;
  listen: (channel: ElectronEventChannel, callback: (payload: unknown) => void) => Promise<() => void> | (() => void);
};

declare global {
  interface Window {
    electronAPI?: ElectronApiBridge;
  }
}

export {};
