export type PetMood = "idle" | "happy" | "sleep";

// Shared payload shape for pet state sync.
export type PetStatePayload = {
  mood: PetMood;
  animation_speed: number;
};

// Periodic ping from main process for health/tick updates.
export type HeartbeatPayload = {
  unix_ms: number;
};

export type DisplayResolution = {
  width: number;
  height: number;
};

export type DisplaySettingsSnapshot = {
  width: number;
  height: number;
  fullscreen: boolean;
  resolutions: DisplayResolution[];
};

export type ApplyDisplaySettingsPayload = {
  width: number;
  height: number;
  fullscreen: boolean;
};

export type ApplyDisplaySettingsResult = {
  ok: boolean;
  width?: number;
  height?: number;
  fullscreen?: boolean;
  message?: string;
};

// Event channels pushed from Electron main process to renderer.
type NativeEventPayloadMap = {
  "pet://state_changed": PetStatePayload;
  "pet://heartbeat": HeartbeatPayload;
};

// Invoke channels called from renderer to Electron main process.
// Value type is the payload type required by each command.
type NativeInvokeMap = {
  "pet:get-state": undefined;
  "pet:set-state": PetStatePayload;
  "window:switch-to-pet-mode": undefined;
  "window:switch-to-game-mode": undefined;
  "window:get-display-settings": undefined;
  "window:apply-display-settings": ApplyDisplaySettingsPayload;
  "sprite-presets:read-json": undefined;
  "sprite-presets:write-json": string;
};

export type RuntimeKind = "electron" | "web";

// Detect current runtime environment.
export const getRuntimeKind = (): RuntimeKind => {
  if (typeof window !== "undefined" && window.electronAPI?.runtime === "electron") {
    return "electron";
  }
  return "web";
};

// Convenience helper for runtime checks.
export const isElectronRuntime = (): boolean => getRuntimeKind() === "electron";

// Typed wrapper around window.electronAPI.invoke.
// Prevents native calls in pure web runtime.
export const invokeNative = async <TResponse, TCommand extends keyof NativeInvokeMap>(
  command: TCommand,
  payload?: NativeInvokeMap[TCommand]
): Promise<TResponse> => {
  if (!isElectronRuntime()) {
    throw new Error("Native invoke is only available in Electron runtime");
  }
  return window.electronAPI.invoke(command, payload) as Promise<TResponse>;
};

// Typed wrapper around window.electronAPI.listen.
// Returns an unsubscribe function from preload bridge.
export const listenNative = async <TEvent extends keyof NativeEventPayloadMap>(
  eventName: TEvent,
  handler: (payload: NativeEventPayloadMap[TEvent]) => void
): Promise<() => void> => {
  if (!isElectronRuntime()) {
    throw new Error("Native listen is only available in Electron runtime");
  }
  return window.electronAPI.listen(eventName, handler as (payload: unknown) => void);
};
