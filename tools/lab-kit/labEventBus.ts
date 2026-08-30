export type LabEventListener<T = unknown> = (payload: T) => void | Promise<void>;

export class LabEventBus {
  private readonly listeners = new Map<string, Set<LabEventListener>>();

  on<T>(eventName: string, listener: LabEventListener<T>): () => void {
    const listeners = this.listeners.get(eventName) ?? new Set<LabEventListener>();
    listeners.add(listener as LabEventListener);
    this.listeners.set(eventName, listeners);
    return () => listeners.delete(listener as LabEventListener);
  }

  async emit<T>(eventName: string, payload: T): Promise<void> {
    for (const listener of this.listeners.get(eventName) ?? []) {
      await listener(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
