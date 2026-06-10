import { GAME_EVENTS } from "./events.js";

export class EntityStateModule {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.state = new Map();
    this.unsubscribers = [];
  }

  init() {
    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.OBJECT_ADDED, ({ id, type, config }) => {
        this.state.set(id, {
          id,
          type,
          speed: config?.speed ?? 0,
          color: config?.color ?? null
        });
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.ENTITY_UPDATED, ({ id, properties }) => {
        const prev = this.state.get(id) || { id };
        this.state.set(id, { ...prev, ...properties });
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.OBJECT_REMOVED, ({ id }) => {
        this.state.delete(id);
      })
    );
  }

  getState() {
    return Array.from(this.state.values());
  }

  destroy() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.state.clear();
  }
}
