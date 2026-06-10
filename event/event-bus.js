export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  subscribe(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);
    return () => this.unsubscribe(eventName, callback);
  }

  unsubscribe(eventName, callback) {
    const bucket = this.listeners.get(eventName);
    if (!bucket) return;
    bucket.delete(callback);
    if (bucket.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  emit(eventName, payload) {
    const bucket = this.listeners.get(eventName);
    if (!bucket) return;
    for (const callback of bucket) {
      callback(payload);
    }
  }

  clear(eventName) {
    if (eventName) {
      this.listeners.delete(eventName);
      return;
    }
    this.listeners.clear();
  }
}
